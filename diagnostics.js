(() => {
  'use strict';

  const config = window.APP_CONFIG || {};
  const resultsRoot = document.getElementById('diagnostics-results');
  const summaryRoot = document.getElementById('diagnostics-summary');
  const runButton = document.getElementById('run-diagnostics');
  const clearButton = document.getElementById('clear-diagnostics');
  const secretInput = document.getElementById('diagnostics-secret');
  const testReportButton = document.getElementById('send-test-report');
  const testNotificationButton = document.getElementById('send-test-notification');
  const testOutput = document.getElementById('telegram-test-output');
  const checks = [];

  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function functionEndpoint() {
    const base = String(config.supabase?.url || '').trim().replace(/\/+$/, '');
    return base ? `${base}/functions/v1/notify-telegram` : '';
  }

  function clearResults() {
    checks.length = 0;
    if (resultsRoot) resultsRoot.innerHTML = '';
    if (summaryRoot) summaryRoot.innerHTML = '';
  }

  function renderSummary() {
    if (!summaryRoot) return;
    const total = checks.length;
    const failed = checks.filter((item) => item.status === 'error').length;
    const running = checks.filter((item) => item.status === 'running').length;
    const ok = checks.filter((item) => item.status === 'ok').length;
    const stateClass = failed ? 'error' : (total && !running ? 'ok' : '');
    const label = running
      ? `Проверяется… ${ok}/${total}`
      : failed
        ? `Ошибок: ${failed} · успешно: ${ok}`
        : total
          ? `Все проверки пройдены: ${ok}/${total}`
          : 'Нет результатов';
    summaryRoot.innerHTML = `<span class="diag-summary-badge ${stateClass}">${esc(label)}</span>`;
  }

  function addCheck({ id, label, stage, status = 'running', detail = 'Проверяется…' }) {
    const record = { id, label, stage, status, detail };
    checks.push(record);
    renderChecks();
    return record;
  }

  function updateCheck(record, status, detail) {
    record.status = status;
    record.detail = String(detail || '');
    renderChecks();
  }

  function renderChecks() {
    if (!resultsRoot) return;
    resultsRoot.innerHTML = checks.map((item) => {
      const icon = item.status === 'ok' ? '✓' : item.status === 'error' ? '!' : '…';
      return `<article class="diag-item is-${esc(item.status)}">
        <div class="diag-icon" aria-hidden="true">${icon}</div>
        <div class="diag-copy">
          <strong>${esc(item.label)}</strong>
          <div class="diag-meta">Этап: ${esc(item.stage)}</div>
          <p class="diag-detail">${esc(item.detail)}</p>
        </div>
      </article>`;
    }).join('');
    renderSummary();
  }

  function errorDetail(error) {
    if (!error) return 'Неизвестная ошибка';
    return String(error.message || error.details || error.hint || error);
  }

  async function edgeRequest(payload, secret = '', allowResultFailure = false) {
    const endpoint = functionEndpoint();
    if (!endpoint) throw new Error('В config.js не задан supabase.url');
    const headers = { 'content-type': 'application/json' };
    if (secret) headers['x-notify-secret'] = secret;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
    if (!response.ok || (!allowResultFailure && !result?.ok)) {
      const stage = result?.stage ? `${result.stage}: ` : '';
      throw new Error(`${stage}${result?.error || `HTTP ${response.status}`}`);
    }
    return result;
  }

  async function makeSupabaseClient() {
    if (!window.supabase?.createClient) throw new Error('supabase-js не загрузился');
    const url = String(config.supabase?.url || '').trim();
    const anonKey = String(config.supabase?.anonKey || '').trim();
    if (!url) throw new Error('В config.js отсутствует supabase.url');
    if (!anonKey) throw new Error('В config.js отсутствует supabase.anonKey');
    return window.supabase.createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  }

  async function testLocalStorage() {
    const check = addCheck({ id: 'local-storage', label: 'localStorage', stage: 'browser' });
    const key = `english_space_diagnostics_${Date.now()}`;
    try {
      localStorage.setItem(key, 'ok');
      if (localStorage.getItem(key) !== 'ok') throw new Error('Записанное значение не читается обратно');
      localStorage.removeItem(key);
      updateCheck(check, 'ok', 'Запись, чтение и удаление работают.');
    } catch (error) {
      updateCheck(check, 'error', errorDetail(error));
    }
  }

  async function testSupabase() {
    const sdk = addCheck({ id: 'supabase-sdk', label: 'Supabase SDK и config.js', stage: 'browser → supabase' });
    let client;
    try {
      client = await makeSupabaseClient();
      updateCheck(sdk, 'ok', `Клиент создан для ${new URL(config.supabase.url).hostname}.`);
    } catch (error) {
      updateCheck(sdk, 'error', errorDetail(error));
      return null;
    }

    const studentId = String(config.student?.id || 'olya');
    const tables = [
      ['homework_progress', 'lesson_id'],
      ['vocabulary_progress', 'word_key'],
      ['vocabulary_topic_progress', 'topic_id'],
      ['grammar_progress', 'topic_id']
    ];

    for (const [table, selectColumn] of tables) {
      const check = addCheck({ id: `read-${table}`, label: `Чтение ${table}`, stage: 'supabase select' });
      try {
        const { error } = await client.from(table).select(selectColumn).eq('student_id', studentId).limit(1);
        if (error) throw error;
        updateCheck(check, 'ok', 'SELECT для прогресса Оли доступен.');
      } catch (error) {
        updateCheck(check, 'error', errorDetail(error));
      }
    }

    const diagnosticStudentId = `__diagnostics__-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const writeCheck = addCheck({ id: 'supabase-write', label: 'Сохранение прогресса в Supabase', stage: 'supabase insert/update/read' });
    try {
      const now = new Date().toISOString();
      const writeOperations = [
        client.from('homework_progress').upsert({
          student_id: diagnosticStudentId,
          student_name: 'Diagnostics',
          lesson_id: '__probe__',
          lesson_title: 'Diagnostics insert',
          status: 'checked',
          answers: { probe: 1 },
          score_correct: 0,
          score_total: 1,
          score_percent: 0,
          checked_at: now
        }, { onConflict: 'student_id,lesson_id' }),
        client.from('vocabulary_progress').upsert({
          student_id: diagnosticStudentId,
          word_key: '__probe__',
          word_id: '__probe__',
          en: 'diagnostics',
          ru: 'диагностика',
          source_topic_id: '__probe__',
          status: 'difficult'
        }, { onConflict: 'student_id,word_key' }),
        client.from('vocabulary_topic_progress').upsert({
          student_id: diagnosticStudentId,
          topic_id: '__probe__',
          tests: [],
          legacy_learned_count: 0,
          legacy_total: 0,
          legacy_source: 'diagnostics-insert'
        }, { onConflict: 'student_id,topic_id' }),
        client.from('grammar_progress').upsert({
          student_id: diagnosticStudentId,
          topic_id: '__probe__',
          passed: false,
          attempts: 0,
          best_score: 0
        }, { onConflict: 'student_id,topic_id' })
      ];
      const insertResults = await Promise.all(writeOperations);
      const insertError = insertResults.find((item) => item.error)?.error;
      if (insertError) throw insertError;

      const updateOperations = [
        client.from('homework_progress').update({ lesson_title: 'Diagnostics update', answers: { probe: 2 } }).eq('student_id', diagnosticStudentId).eq('lesson_id', '__probe__'),
        client.from('vocabulary_progress').update({ en: 'diagnostics update' }).eq('student_id', diagnosticStudentId).eq('word_key', '__probe__'),
        client.from('vocabulary_topic_progress').update({ legacy_source: 'diagnostics-update' }).eq('student_id', diagnosticStudentId).eq('topic_id', '__probe__'),
        client.from('grammar_progress').update({ attempts: 1 }).eq('student_id', diagnosticStudentId).eq('topic_id', '__probe__')
      ];
      const updateResults = await Promise.all(updateOperations);
      const updateError = updateResults.find((item) => item.error)?.error;
      if (updateError) throw updateError;

      const readBack = await Promise.all([
        client.from('homework_progress').select('lesson_title,answers').eq('student_id', diagnosticStudentId).eq('lesson_id', '__probe__').single(),
        client.from('vocabulary_progress').select('en').eq('student_id', diagnosticStudentId).eq('word_key', '__probe__').single(),
        client.from('vocabulary_topic_progress').select('legacy_source').eq('student_id', diagnosticStudentId).eq('topic_id', '__probe__').single(),
        client.from('grammar_progress').select('attempts').eq('student_id', diagnosticStudentId).eq('topic_id', '__probe__').single()
      ]);
      const readError = readBack.find((item) => item.error)?.error;
      if (readError) throw readError;
      if (readBack[0].data?.answers?.probe !== 2 || readBack[3].data?.attempts !== 1) {
        throw new Error('Обновлённые значения не прочитались обратно');
      }
      updateCheck(writeCheck, 'ok', 'INSERT, UPDATE и повторное чтение работают во всех четырёх таблицах прогресса.');
    } catch (error) {
      updateCheck(writeCheck, 'error', errorDetail(error));
    } finally {
      const cleanup = addCheck({ id: 'supabase-cleanup', label: 'Очистка диагностических строк', stage: 'edge function → service role delete' });
      try {
        await edgeRequest({ action: 'diagnostics_cleanup', diagnosticStudentId });
        updateCheck(cleanup, 'ok', 'Диагностические строки удалены; данные Оли не затронуты.');
      } catch (error) {
        updateCheck(cleanup, 'error', `Тестовые строки относятся только к ${diagnosticStudentId}. Очистка не выполнена: ${errorDetail(error)}`);
      }
    }

    return client;
  }

  async function testEdgeAndTelegram(secret) {
    const check = addCheck({ id: 'edge-diagnostics', label: 'Supabase Edge Function', stage: 'browser → edge function' });
    try {
      const result = await edgeRequest({ action: 'diagnostics' }, secret, true);
      updateCheck(check, result.ok ? 'ok' : 'error', result.ok ? 'Функция notify-telegram отвечает, все серверные проверки пройдены.' : 'Функция отвечает, но одна или несколько серверных проверок выявили ошибку.');
      (result.checks || []).forEach((item) => {
        const serverCheck = addCheck({
          id: `server-${item.id}`,
          label: item.label || item.id,
          stage: item.stage || 'edge function',
          status: item.ok ? 'ok' : 'error',
          detail: item.detail || ''
        });
        serverCheck.status = item.ok ? 'ok' : 'error';
      });
      (result.recentPublications || []).forEach((item, index) => {
        const status = String(item.status || 'unknown');
        const isOk = status === 'sent' || status === 'skipped';
        const kind = item.materialType === 'homework_report' ? 'Отчёт ДЗ' : item.materialType === 'lesson_bundle' ? 'Уведомление' : item.materialType || 'Отправка';
        const message = item.error
          ? `${status}: ${item.error}`
          : `${status}${item.telegramMessageId ? ` · Telegram message id ${item.telegramMessageId}` : ''}${item.sentAt ? ` · ${item.sentAt}` : ''}`;
        addCheck({
          id: `publication-${index}`,
          label: `${kind}: ${item.materialId || '—'}`,
          stage: 'material_publications',
          status: isOk ? 'ok' : 'error',
          detail: message
        });
      });
      renderChecks();
    } catch (error) {
      updateCheck(check, 'error', errorDetail(error));
    }
  }

  async function runAll() {
    if (runButton) runButton.disabled = true;
    clearResults();
    try {
      await testLocalStorage();
      await testSupabase();
      await testEdgeAndTelegram(String(secretInput?.value || '').trim());
    } finally {
      if (runButton) runButton.disabled = false;
      renderSummary();
    }
  }

  async function sendTelegramTest(action) {
    const secret = String(secretInput?.value || '').trim();
    if (!secret) {
      testOutput.textContent = 'Ошибка authorization: введите NOTIFY_WEBHOOK_SECRET. Ключ не сохраняется.';
      secretInput?.focus();
      return;
    }

    const button = action === 'diagnostic_test_report' ? testReportButton : testNotificationButton;
    if (button) button.disabled = true;
    testOutput.textContent = 'Отправляется…';
    try {
      const payload = { action };
      if (action === 'diagnostic_test_notification') {
        payload.siteUrl = new URL('homework.html', window.location.href).toString();
      }
      const result = await edgeRequest(payload, secret);
      testOutput.textContent = [
        'OK',
        `Telegram message id: ${result.telegramMessageId ?? '—'}`,
        `message_thread_id: ${result.messageThreadId ?? '—'}`,
        'Проверьте, что сообщение появилось именно в теме 5.'
      ].join('\n');
    } catch (error) {
      testOutput.textContent = `Ошибка: ${errorDetail(error)}`;
    } finally {
      if (button) button.disabled = false;
    }
  }

  runButton?.addEventListener('click', runAll);
  clearButton?.addEventListener('click', clearResults);
  testReportButton?.addEventListener('click', () => sendTelegramTest('diagnostic_test_report'));
  testNotificationButton?.addEventListener('click', () => sendTelegramTest('diagnostic_test_notification'));
})();
