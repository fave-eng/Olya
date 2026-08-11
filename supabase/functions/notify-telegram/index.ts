import { withSupabase } from 'npm:@supabase/server'

const encoder = new TextEncoder()
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-notify-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DIAGNOSTIC_VERSION = 'olya-diagnostics-v2'
const DIAGNOSTIC_STUDENT_ID = 'olya'
const DIAGNOSTIC_THREAD_ID = 5
const DIAGNOSTIC_COOLDOWN_MS = 30_000

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders })
}

function secureEqual(left: string, right: string): boolean {
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  if (a.length !== b.length) return false

  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index] ^ b[index]
  }
  return diff === 0
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function parseTelegramId(value: unknown): number | null {
  const normalized = String(value ?? '').trim()
  if (!/^-?\d+$/.test(normalized)) return null

  const parsed = Number(normalized)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function maskChatId(chatId: number | null): string | null {
  if (!Number.isSafeInteger(chatId)) return null
  const value = String(chatId)
  if (value.length <= 7) return value
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

function buildMaterialMessage(hasVocabulary: boolean): string {
  if (hasVocabulary) {
    return [
      '🚀 <b>Новые материалы уже доступны!</b>',
      '',
      'Сначала изучи слова к уроку — так выполнять домашнюю работу будет легче. Затем переходи к заданиям.',
      '',
      'Удачи! Если что-то будет непонятно, отметь вопросы — разберём их на следующем уроке ✨',
    ].join('\n')
  }

  return [
    '🚀 <b>Новая домашняя работа уже доступна!</b>',
    '',
    'Переходи к заданиям. Если что-то будет непонятно, отметь вопросы — разберём их на следующем уроке.',
    '',
    'Удачи! ✨',
  ].join('\n')
}

function buildHomeworkReport(row: Record<string, any>, isTest = false): string {
  const studentName = String(row.student_name || 'Оля').trim() || 'Оля'
  const lessonTitle = String(row.lesson_title || row.lesson_id || 'Домашняя работа').trim()
  const correct = Number(row.score_correct)
  const total = Number(row.score_total)
  const percent = Number(row.score_percent)
  const submittedAt = row.submitted_at ? new Date(row.submitted_at) : null
  const submittedLabel = submittedAt && Number.isFinite(submittedAt.getTime())
    ? submittedAt.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
    : 'не указано'

  const lines = [
    isTest ? '🧪 <b>Тестовый отчёт о домашней работе</b>' : '📝 <b>Отчёт о домашней работе</b>',
    '',
    `👩‍🎓 Ученик: <b>${escapeTelegramHtml(studentName)}</b>`,
    `📚 Задание: <b>${escapeTelegramHtml(lessonTitle)}</b>`,
  ]

  if (Number.isFinite(correct) && Number.isFinite(total) && total > 0) {
    const safePercent = Number.isFinite(percent) ? percent : Math.round((correct / total) * 100)
    lines.push(`✅ Результат: <b>${correct} / ${total}</b> (${safePercent}%)`)
  } else {
    lines.push('✅ Результат: сохранён без автоматического балла')
  }

  lines.push(`🕒 Отправлено: ${escapeTelegramHtml(submittedLabel)}`)
  if (isTest) lines.push('', 'Это тест из страницы диагностики. Реальные данные ученика не изменялись.')
  return lines.join('\n')
}

function escapeTelegramHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function telegramApi(token: string, method: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.ok) {
    const description = result?.description || `Telegram HTTP ${response.status}`
    throw new Error(description)
  }
  return result.result
}

async function sendTelegramMessage(
  token: string,
  chatId: number,
  messageThreadId: number | null,
  text: string,
  inlineKeyboard: Array<Array<{ text: string; url: string }>> = [],
) {
  const requestBody: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  }

  if (inlineKeyboard.length) requestBody.reply_markup = { inline_keyboard: inlineKeyboard }
  if (messageThreadId !== null) requestBody.message_thread_id = messageThreadId

  return telegramApi(token, 'sendMessage', requestBody)
}

async function resolveRecipient(ctx: any, studentId: string) {
  const envChatId = parseTelegramId(Deno.env.get('TEACHER_CHAT_ID'))
  const envThreadId = parseTelegramId(Deno.env.get('TEACHER_MESSAGE_THREAD_ID'))

  const { data: recipient, error: recipientError } = await ctx.supabaseAdmin
    .from('telegram_recipients')
    .select('chat_id, message_thread_id, enabled')
    .eq('student_id', studentId)
    .maybeSingle()

  if (recipientError) throw new Error(`telegram_recipients: ${recipientError.message}`)

  // Explicit Edge Function settings take precedence. This keeps reports and
  // manual notifications in the configured forum topic even if an old DB row
  // still points to the group without a topic.
  const hasEnvOverride = envChatId !== null || envThreadId !== null
  const chatId = envChatId ?? parseTelegramId(recipient?.chat_id)
  const messageThreadId = envThreadId ?? parseTelegramId(recipient?.message_thread_id)

  if (!hasEnvOverride && recipient && recipient.enabled === false) {
    throw new Error('Telegram recipient is disabled')
  }
  if (!Number.isSafeInteger(chatId)) {
    throw new Error('Telegram chat is not configured (TEACHER_CHAT_ID)')
  }
  if (!Number.isSafeInteger(messageThreadId) || Number(messageThreadId) <= 0) {
    throw new Error('Telegram topic is not configured (TEACHER_MESSAGE_THREAD_ID)')
  }

  return {
    chatId: Number(chatId),
    messageThreadId: Number(messageThreadId),
    enabled: hasEnvOverride ? true : recipient?.enabled !== false,
    source: hasEnvOverride ? 'edge_function_settings' : 'database',
  }
}

function requireNotifySecret(req: Request): Response | null {
  const expectedSecret = Deno.env.get('NOTIFY_WEBHOOK_SECRET') ?? ''
  const actualSecret = req.headers.get('x-notify-secret') ?? ''
  if (!expectedSecret || !secureEqual(actualSecret, expectedSecret)) {
    return json({ ok: false, stage: 'authorization', error: 'Unauthorized' }, 401)
  }
  return null
}

async function runDiagnostics(ctx: any) {
  const checks: Array<Record<string, unknown>> = []
  const add = (id: string, label: string, ok: boolean, detail: string, stage: string) => {
    checks.push({ id, label, ok, detail, stage })
  }

  const token = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
  add(
    'telegram-token',
    'TELEGRAM_BOT_TOKEN',
    Boolean(token),
    token ? 'Секрет настроен в Supabase Edge Functions.' : 'Секрет TELEGRAM_BOT_TOKEN отсутствует.',
    'edge-config',
  )

  let recipient: Awaited<ReturnType<typeof resolveRecipient>> | null = null
  try {
    recipient = await resolveRecipient(ctx, 'olya')
    add(
      'telegram-target',
      'Получатель Telegram',
      true,
      `Чат ${maskChatId(recipient.chatId)}, тема ${recipient.messageThreadId}. Источник: ${recipient.source}.`,
      'recipient',
    )
    add(
      'telegram-topic',
      'Тема Telegram',
      recipient.messageThreadId === 5,
      recipient.messageThreadId === 5
        ? 'Настроен message_thread_id = 5.'
        : `Ожидалась тема 5, сейчас настроена тема ${recipient.messageThreadId}.`,
      'recipient',
    )
  } catch (error) {
    add('telegram-target', 'Получатель Telegram', false, error instanceof Error ? error.message : String(error), 'recipient')
    add('telegram-topic', 'Тема Telegram', false, 'Невозможно проверить тему без корректного получателя.', 'recipient')
  }

  let recentPublications: Array<Record<string, unknown>> = []
  try {
    const { data, error } = await ctx.supabaseAdmin
      .from('material_publications')
      .select('material_type, material_id, status, telegram_message_id, error_message, sent_at, created_at')
      .eq('student_id', 'olya')
      .order('created_at', { ascending: false })
      .limit(8)
    if (error) throw error
    recentPublications = (data || []).map((row: any) => ({
      materialType: row.material_type,
      materialId: row.material_id,
      status: row.status,
      telegramMessageId: row.telegram_message_id,
      error: row.error_message || null,
      sentAt: row.sent_at || null,
      createdAt: row.created_at || null,
    }))
    const failed = recentPublications.filter((item: any) => item.status === 'failed').length
    add(
      'publication-log',
      'Журнал отправок',
      true,
      failed
        ? `Таблица доступна. Среди последних отправок найдено ошибок: ${failed}; подробности показаны ниже.`
        : `Таблица material_publications доступна. Последних записей: ${recentPublications.length}.`,
      'supabase-admin',
    )
  } catch (error) {
    add('publication-log', 'Журнал отправок', false, error instanceof Error ? error.message : String(error), 'supabase-admin')
  }

  if (token) {
    try {
      const bot = await telegramApi(token, 'getMe')
      add(
        'telegram-bot-api',
        'Telegram Bot API',
        true,
        bot?.username ? `Бот отвечает: @${bot.username}.` : 'Бот отвечает на getMe.',
        'telegram-api',
      )
    } catch (error) {
      add('telegram-bot-api', 'Telegram Bot API', false, error instanceof Error ? error.message : String(error), 'telegram-api')
    }
  } else {
    add('telegram-bot-api', 'Telegram Bot API', false, 'Проверка невозможна без TELEGRAM_BOT_TOKEN.', 'telegram-api')
  }

  if (token && recipient) {
    try {
      const chat = await telegramApi(token, 'getChat', { chat_id: recipient.chatId })
      const title = String(chat?.title || '').trim()
      add(
        'telegram-chat-access',
        'Доступ бота к чату',
        true,
        title ? `Чат доступен боту: ${title}.` : 'Чат доступен боту.',
        'telegram-api',
      )
    } catch (error) {
      add('telegram-chat-access', 'Доступ бота к чату', false, error instanceof Error ? error.message : String(error), 'telegram-api')
    }
  } else {
    add('telegram-chat-access', 'Доступ бота к чату', false, 'Нет токена или получателя для проверки.', 'telegram-api')
  }

  return json({
    ok: checks.every((item) => item.ok),
    diagnosticVersion: DIAGNOSTIC_VERSION,
    checks,
    target: recipient
      ? { chatId: maskChatId(recipient.chatId), messageThreadId: recipient.messageThreadId, source: recipient.source }
      : null,
    recentPublications,
  })
}

async function cleanupDiagnostics(ctx: any, diagnosticStudentId: string) {
  if (!/^__diagnostics__-[a-z0-9-]{8,80}$/i.test(diagnosticStudentId)) {
    return json({ ok: false, stage: 'cleanup', error: 'Invalid diagnostics student id' }, 400)
  }

  const targets = [
    ['homework_progress', 'student_id'],
    ['vocabulary_progress', 'student_id'],
    ['vocabulary_topic_progress', 'student_id'],
    ['grammar_progress', 'student_id'],
  ] as const

  const errors: string[] = []
  for (const [table, column] of targets) {
    const { error } = await ctx.supabaseAdmin.from(table).delete().eq(column, diagnosticStudentId)
    if (error) errors.push(`${table}: ${error.message}`)
  }

  if (errors.length) return json({ ok: false, stage: 'cleanup', error: errors.join(' | ') }, 500)
  return json({ ok: true })
}

async function sendHomeworkReport(ctx: any, payload: any) {
  const studentId = typeof payload.studentId === 'string' ? payload.studentId.trim() : ''
  const lessonId = typeof payload.lessonId === 'string' ? payload.lessonId.trim() : ''
  if (!studentId || !/^lesson-\d+$/.test(lessonId)) {
    return json({ ok: false, stage: 'report-validation', error: 'Invalid studentId or lessonId' }, 400)
  }

  const token = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
  if (!token) return json({ ok: false, stage: 'edge-config', error: 'TELEGRAM_BOT_TOKEN is not configured' }, 500)

  const { data: row, error: rowError } = await ctx.supabaseAdmin
    .from('homework_progress')
    .select('student_id, student_name, lesson_id, lesson_title, status, score_correct, score_total, score_percent, submitted_at')
    .eq('student_id', studentId)
    .eq('lesson_id', lessonId)
    .maybeSingle()

  if (rowError) return json({ ok: false, stage: 'supabase-homework', error: rowError.message }, 500)
  if (!row) return json({ ok: false, stage: 'supabase-homework', error: 'Submitted homework row was not found' }, 404)
  if (row.status !== 'submitted' || !row.submitted_at) {
    return json({ ok: false, stage: 'supabase-homework', error: 'Homework is not marked as submitted yet' }, 409)
  }

  let recipient
  try {
    recipient = await resolveRecipient(ctx, studentId)
  } catch (error) {
    return json({ ok: false, stage: 'recipient', error: error instanceof Error ? error.message : String(error) }, 500)
  }

  const materialType = 'homework_report'
  const materialId = lessonId
  const notificationVersion = 1

  const { data: existing, error: existingError } = await ctx.supabaseAdmin
    .from('material_publications')
    .select('id, status, telegram_message_id')
    .eq('student_id', studentId)
    .eq('material_type', materialType)
    .eq('material_id', materialId)
    .eq('notification_version', notificationVersion)
    .maybeSingle()

  if (existingError) return json({ ok: false, stage: 'publication-log', error: existingError.message }, 500)
  if (existing?.status === 'sent') {
    return json({
      ok: true,
      skipped: true,
      reason: 'already_sent',
      telegramMessageId: existing.telegram_message_id,
      messageThreadId: recipient.messageThreadId,
    })
  }

  let publicationId = existing?.id as string | undefined
  const publicationPayload = {
    studentId,
    lessonId,
    submittedAt: row.submitted_at,
    score: { correct: row.score_correct, total: row.score_total, percent: row.score_percent },
  }

  if (publicationId) {
    const { error } = await ctx.supabaseAdmin
      .from('material_publications')
      .update({ status: 'pending', payload: publicationPayload, error_message: null })
      .eq('id', publicationId)
    if (error) return json({ ok: false, stage: 'publication-log', error: error.message }, 500)
  } else {
    const { data: created, error } = await ctx.supabaseAdmin
      .from('material_publications')
      .insert({
        student_id: studentId,
        material_type: materialType,
        material_id: materialId,
        notification_version: notificationVersion,
        status: 'pending',
        payload: publicationPayload,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') return json({ ok: true, skipped: true, reason: 'already_claimed' })
      return json({ ok: false, stage: 'publication-log', error: error.message }, 500)
    }
    publicationId = created.id
  }

  try {
    const telegramMessage = await sendTelegramMessage(
      token,
      recipient.chatId,
      recipient.messageThreadId,
      buildHomeworkReport(row),
    )

    const { error: updateError } = await ctx.supabaseAdmin
      .from('material_publications')
      .update({
        status: 'sent',
        telegram_message_id: telegramMessage.message_id,
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', publicationId)

    if (updateError) throw new Error(`Telegram sent, but log update failed: ${updateError.message}`)

    return json({
      ok: true,
      skipped: false,
      telegramMessageId: telegramMessage.message_id,
      messageThreadId: recipient.messageThreadId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await ctx.supabaseAdmin
      .from('material_publications')
      .update({ status: 'failed', error_message: message })
      .eq('id', publicationId)
    return json({ ok: false, stage: 'telegram-send-report', error: message }, 502)
  }
}


async function diagnosticsHealthV2(ctx: any, payload: any) {
  const requestedStudentId = typeof payload?.studentId === 'string' ? payload.studentId.trim().toLowerCase() : DIAGNOSTIC_STUDENT_ID
  if (requestedStudentId !== DIAGNOSTIC_STUDENT_ID) {
    return json({ ok: false, error: 'Diagnostics are available only for the configured student.' }, 400)
  }

  const database: Record<string, any> = {
    ok: false,
    homeworkRows: 0,
    suspiciousHomework: [],
  }

  try {
    const { data, error } = await ctx.supabaseAdmin
      .from('homework_progress')
      .select('lesson_id,status,checked_at,submitted_at')
      .eq('student_id', DIAGNOSTIC_STUDENT_ID)
      .order('lesson_id', { ascending: false })
      .limit(100)
    if (error) throw error

    const rows = data || []
    const suspicious = rows
      .filter((row: any) => {
        if (!['checked', 'submitted'].includes(String(row.status || ''))) return true
        if (row.status === 'submitted' && !row.submitted_at) return true
        if (row.status === 'checked' && row.submitted_at) return true
        return false
      })
      .map((row: any) => String(row.lesson_id || 'unknown'))

    database.ok = true
    database.homeworkRows = rows.length
    database.suspiciousHomework = suspicious
  } catch (error) {
    database.error = error instanceof Error ? error.message : String(error)
  }

  const recipientState: Record<string, any> = { ok: false, enabled: false, threadId: null }
  let recipient: Awaited<ReturnType<typeof resolveRecipient>> | null = null
  try {
    recipient = await resolveRecipient(ctx, DIAGNOSTIC_STUDENT_ID)
    recipientState.ok = true
    recipientState.enabled = Boolean(recipient.enabled)
    recipientState.threadId = recipient.messageThreadId
    recipientState.source = recipient.source
  } catch (error) {
    recipientState.error = error instanceof Error ? error.message : String(error)
  }

  const telegram: Record<string, any> = {
    bot: { ok: false },
    chat: { ok: false },
  }
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''

  if (!token) {
    telegram.bot.error = 'TELEGRAM_BOT_TOKEN is not configured'
    telegram.chat.error = 'Cannot check chat without TELEGRAM_BOT_TOKEN'
  } else {
    try {
      const bot = await telegramApi(token, 'getMe')
      telegram.bot = { ok: true, username: bot?.username || null, id: bot?.id || null }
    } catch (error) {
      telegram.bot = { ok: false, error: error instanceof Error ? error.message : String(error) }
    }

    if (recipient) {
      try {
        const chat = await telegramApi(token, 'getChat', { chat_id: recipient.chatId })
        telegram.chat = {
          ok: true,
          type: chat?.type || null,
          title: chat?.title || null,
        }
      } catch (error) {
        telegram.chat = { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    } else {
      telegram.chat.error = 'Recipient is not configured'
    }
  }

  return json({
    ok: database.ok && recipientState.ok && recipientState.enabled && recipientState.threadId === DIAGNOSTIC_THREAD_ID && telegram.bot.ok && telegram.chat.ok,
    diagnosticVersion: DIAGNOSTIC_VERSION,
    database,
    recipient: recipientState,
    telegram,
  })
}

async function diagnosticsHomeworkProbeV2(ctx: any, payload: any) {
  const studentId = typeof payload?.studentId === 'string' ? payload.studentId.trim().toLowerCase() : ''
  const lessonId = typeof payload?.lessonId === 'string' ? payload.lessonId.trim() : ''

  if (studentId !== DIAGNOSTIC_STUDENT_ID || !/^__diagnostic_probe__\d+_[a-z0-9]{3,16}$/i.test(lessonId)) {
    return json({ ok: false, error: 'Invalid diagnostics homework probe identity' }, 400)
  }

  const stages: Record<string, unknown> = {}
  try {
    const { data: row, error: readError } = await ctx.supabaseAdmin
      .from('homework_progress')
      .select('student_id,lesson_id,status,submitted_at')
      .eq('student_id', studentId)
      .eq('lesson_id', lessonId)
      .maybeSingle()
    if (readError) throw new Error(`read probe: ${readError.message}`)

    if (!row) {
      stages.cleanup = 'row already absent'
      return json({ ok: true, stages })
    }

    stages.browserInsert = `row found with status=${row.status}`

    if (row.status !== 'submitted') {
      const submittedAt = new Date().toISOString()
      const { error: updateError } = await ctx.supabaseAdmin
        .from('homework_progress')
        .update({ status: 'submitted', submitted_at: submittedAt })
        .eq('student_id', studentId)
        .eq('lesson_id', lessonId)
      if (updateError) throw new Error(`transition checked→submitted: ${updateError.message}`)
      stages.transition = 'checked → submitted'
    } else {
      stages.transition = 'already submitted'
    }

    const { data: verified, error: verifyError } = await ctx.supabaseAdmin
      .from('homework_progress')
      .select('status,submitted_at')
      .eq('student_id', studentId)
      .eq('lesson_id', lessonId)
      .single()
    if (verifyError) throw new Error(`verify submitted row: ${verifyError.message}`)
    if (verified?.status !== 'submitted' || !verified?.submitted_at) {
      throw new Error('Submitted row did not persist expected status/submitted_at')
    }
    stages.verify = 'submitted row read back successfully'

    const { error: deleteError } = await ctx.supabaseAdmin
      .from('homework_progress')
      .delete()
      .eq('student_id', studentId)
      .eq('lesson_id', lessonId)
    if (deleteError) throw new Error(`cleanup probe: ${deleteError.message}`)
    stages.cleanup = 'technical row deleted'

    return json({ ok: true, stages })
  } catch (error) {
    // Best-effort cleanup is intentionally restricted to the diagnostics prefix.
    await ctx.supabaseAdmin
      .from('homework_progress')
      .delete()
      .eq('student_id', DIAGNOSTIC_STUDENT_ID)
      .eq('lesson_id', lessonId)
    return json({ ok: false, error: error instanceof Error ? error.message : String(error), stages }, 500)
  }
}

async function diagnosticsSendReportV2(ctx: any, payload: any) {
  const studentId = typeof payload?.studentId === 'string' ? payload.studentId.trim().toLowerCase() : ''
  if (studentId !== DIAGNOSTIC_STUDENT_ID) {
    return json({ ok: false, error: 'Invalid diagnostics student id' }, 400)
  }

  const token = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
  if (!token) return json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' }, 500)

  let recipient
  try {
    recipient = await resolveRecipient(ctx, DIAGNOSTIC_STUDENT_ID)
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
  }

  if (recipient.messageThreadId !== DIAGNOSTIC_THREAD_ID) {
    return json({ ok: false, error: `Telegram thread mismatch: ${recipient.messageThreadId}; expected ${DIAGNOSTIC_THREAD_ID}` }, 409)
  }

  const nowMs = Date.now()
  const bucket = Math.floor(nowMs / DIAGNOSTIC_COOLDOWN_MS)
  const materialId = `diagnostics-${bucket}`
  const retryAfterSeconds = Math.max(1, Math.ceil((DIAGNOSTIC_COOLDOWN_MS - (nowMs % DIAGNOSTIC_COOLDOWN_MS)) / 1000))

  const { data: publication, error: claimError } = await ctx.supabaseAdmin
    .from('material_publications')
    .insert({
      student_id: DIAGNOSTIC_STUDENT_ID,
      material_type: 'diagnostics_report',
      material_id: materialId,
      notification_version: 1,
      status: 'pending',
      payload: {
        kind: 'diagnostics_send_report',
        pageUrl: isHttpUrl(payload?.pageUrl) ? payload.pageUrl : null,
        diagnosticVersion: DIAGNOSTIC_VERSION,
      },
    })
    .select('id')
    .single()

  if (claimError) {
    if (claimError.code === '23505') {
      return json({ ok: true, skipped: true, retryAfterSeconds })
    }
    return json({ ok: false, error: `publication log: ${claimError.message}` }, 500)
  }

  try {
    const message = await sendTelegramMessage(
      token,
      recipient.chatId,
      recipient.messageThreadId,
      buildHomeworkReport({
        student_name: 'Оля',
        lesson_id: 'diagnostics',
        lesson_title: 'Диагностика отправки отчёта',
        score_correct: 4,
        score_total: 5,
        score_percent: 80,
        submitted_at: new Date().toISOString(),
      }, true),
    )

    const { error: logError } = await ctx.supabaseAdmin
      .from('material_publications')
      .update({
        status: 'sent',
        telegram_message_id: message.message_id,
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', publication.id)
    if (logError) throw new Error(`Telegram sent, but publication log update failed: ${logError.message}`)

    return json({
      ok: true,
      skipped: false,
      telegramMessageId: message.message_id,
      threadId: recipient.messageThreadId,
      diagnosticVersion: DIAGNOSTIC_VERSION,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await ctx.supabaseAdmin
      .from('material_publications')
      .update({ status: 'failed', error_message: message })
      .eq('id', publication.id)
    return json({ ok: false, error: message }, 502)
  }
}

async function sendDiagnosticMessage(req: Request, ctx: any, action: string, payload: any) {
  const unauthorized = requireNotifySecret(req)
  if (unauthorized) return unauthorized

  const token = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
  if (!token) return json({ ok: false, stage: 'edge-config', error: 'TELEGRAM_BOT_TOKEN is not configured' }, 500)

  let recipient
  try {
    recipient = await resolveRecipient(ctx, 'olya')
  } catch (error) {
    return json({ ok: false, stage: 'recipient', error: error instanceof Error ? error.message : String(error) }, 500)
  }

  try {
    let telegramMessage
    if (action === 'diagnostic_test_report') {
      telegramMessage = await sendTelegramMessage(
        token,
        recipient.chatId,
        recipient.messageThreadId,
        buildHomeworkReport({
          student_name: 'Оля',
          lesson_id: 'diagnostics',
          lesson_title: 'Диагностика отправки отчёта',
          score_correct: 4,
          score_total: 5,
          score_percent: 80,
          submitted_at: new Date().toISOString(),
        }, true),
      )
    } else {
      const siteUrl = isHttpUrl(payload.siteUrl) ? payload.siteUrl : null
      const keyboard = siteUrl ? [[{ text: '📝 Открыть Homework', url: siteUrl }]] : []
      telegramMessage = await sendTelegramMessage(
        token,
        recipient.chatId,
        recipient.messageThreadId,
        [
          '🧪 <b>Тестовое уведомление о домашней работе</b>',
          '',
          'Это тест из страницы диагностики. Если сообщение пришло в эту тему, маршрут уведомлений настроен правильно.',
        ].join('\n'),
        keyboard,
      )
    }

    return json({
      ok: true,
      telegramMessageId: telegramMessage.message_id,
      messageThreadId: recipient.messageThreadId,
    })
  } catch (error) {
    return json({
      ok: false,
      stage: action === 'diagnostic_test_report' ? 'telegram-send-report' : 'telegram-send-notification',
      error: error instanceof Error ? error.message : String(error),
    }, 502)
  }
}

async function sendMaterialNotification(req: Request, ctx: any, payload: any) {
  const unauthorized = requireNotifySecret(req)
  if (unauthorized) return unauthorized

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
  if (!botToken) return json({ ok: false, stage: 'edge-config', error: 'TELEGRAM_BOT_TOKEN is not configured' }, 500)

  const studentId = typeof payload.studentId === 'string' ? payload.studentId.trim() : ''
  const materialType = typeof payload.materialType === 'string' ? payload.materialType.trim() : ''
  const materialId = typeof payload.materialId === 'string' ? payload.materialId.trim() : ''
  const notificationVersion = Number(payload.notificationVersion)
  const homework = payload.homework
  const vocabulary = payload.vocabulary
  const grammar = Array.isArray(payload.grammar) ? payload.grammar : []

  if (!studentId || !materialType || !materialId || !Number.isInteger(notificationVersion) || notificationVersion < 1) {
    return json({ ok: false, stage: 'notification-validation', error: 'Missing or invalid notification identity' }, 400)
  }

  if (!homework || !isHttpUrl(homework.url)) {
    return json({ ok: false, stage: 'notification-validation', error: 'A valid homework URL is required' }, 400)
  }
  if (vocabulary && !isHttpUrl(vocabulary.url)) {
    return json({ ok: false, stage: 'notification-validation', error: 'Invalid vocabulary URL' }, 400)
  }
  for (const item of grammar) {
    if (!item || !isHttpUrl(item.url)) {
      return json({ ok: false, stage: 'notification-validation', error: 'Invalid grammar URL' }, 400)
    }
  }

  let recipient
  try {
    recipient = await resolveRecipient(ctx, studentId)
  } catch (error) {
    return json({ ok: false, stage: 'recipient', error: error instanceof Error ? error.message : String(error) }, 500)
  }

  const { data: existing, error: existingError } = await ctx.supabaseAdmin
    .from('material_publications')
    .select('id, status, telegram_message_id')
    .eq('student_id', studentId)
    .eq('material_type', materialType)
    .eq('material_id', materialId)
    .eq('notification_version', notificationVersion)
    .maybeSingle()

  if (existingError) return json({ ok: false, stage: 'publication-log', error: existingError.message }, 500)
  if (existing?.status === 'sent') {
    return json({
      ok: true,
      skipped: true,
      reason: 'already_sent',
      telegramMessageId: existing.telegram_message_id,
      messageThreadId: recipient.messageThreadId,
    })
  }

  let publicationId = existing?.id as string | undefined
  if (publicationId) {
    const { error } = await ctx.supabaseAdmin
      .from('material_publications')
      .update({ status: 'pending', payload, error_message: null })
      .eq('id', publicationId)
    if (error) return json({ ok: false, stage: 'publication-log', error: error.message }, 500)
  } else {
    const { data: created, error } = await ctx.supabaseAdmin
      .from('material_publications')
      .insert({
        student_id: studentId,
        material_type: materialType,
        material_id: materialId,
        notification_version: notificationVersion,
        status: 'pending',
        payload,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') return json({ ok: true, skipped: true, reason: 'already_claimed' })
      return json({ ok: false, stage: 'publication-log', error: error.message }, 500)
    }
    publicationId = created.id
  }

  const keyboard: Array<Array<{ text: string; url: string }>> = []
  if (vocabulary) keyboard.push([{ text: '💥 Открыть словарь', url: vocabulary.url }])
  keyboard.push([{ text: '📝 Перейти к заданию', url: homework.url }])
  grammar.forEach((item: any, index: number) => {
    const label = grammar.length === 1
      ? '📐 Повторить грамматику'
      : `📐 ${String(item.title || `Грамматика ${index + 1}`).slice(0, 48)}`
    keyboard.push([{ text: label, url: item.url }])
  })

  try {
    const telegramMessage = await sendTelegramMessage(
      botToken,
      recipient.chatId,
      recipient.messageThreadId,
      buildMaterialMessage(Boolean(vocabulary)),
      keyboard,
    )

    const { error: updateError } = await ctx.supabaseAdmin
      .from('material_publications')
      .update({
        status: 'sent',
        telegram_message_id: telegramMessage.message_id,
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', publicationId)

    if (updateError) throw new Error(`Telegram sent, but log update failed: ${updateError.message}`)

    return json({
      ok: true,
      skipped: false,
      recipientSource: recipient.source,
      telegramMessageId: telegramMessage.message_id,
      messageThreadId: recipient.messageThreadId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await ctx.supabaseAdmin
      .from('material_publications')
      .update({ status: 'failed', error_message: message })
      .eq('id', publicationId)
    return json({ ok: false, stage: 'telegram-send-notification', error: message }, 502)
  }
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

    let payload: any
    try {
      payload = await req.json()
    } catch {
      return json({ ok: false, stage: 'request', error: 'Invalid JSON' }, 400)
    }

    const kind = typeof payload?.kind === 'string' ? payload.kind.trim() : ''
    if (kind === 'diagnostics_health') return diagnosticsHealthV2(ctx, payload)
    if (kind === 'diagnostics_homework_probe') return diagnosticsHomeworkProbeV2(ctx, payload)
    if (kind === 'diagnostics_send_report') return diagnosticsSendReportV2(ctx, payload)

    const action = typeof payload?.action === 'string' ? payload.action.trim() : 'material_notification'

    if (action === 'diagnostics') {
      const unauthorized = requireNotifySecret(req)
      if (unauthorized) return unauthorized
      return runDiagnostics(ctx)
    }
    if (action === 'diagnostics_cleanup') return cleanupDiagnostics(ctx, String(payload.diagnosticStudentId || '').trim())
    if (action === 'homework_report') return sendHomeworkReport(ctx, payload)
    if (action === 'diagnostic_test_report' || action === 'diagnostic_test_notification') {
      return sendDiagnosticMessage(req, ctx, action, payload)
    }
    if (action === 'material_notification') return sendMaterialNotification(req, ctx, payload)

    return json({ ok: false, stage: 'request', error: `Unknown action: ${action}` }, 400)
  }),
}
