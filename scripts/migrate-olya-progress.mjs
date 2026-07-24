import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = process.cwd()
const STUDENT_ID = 'olya'
const OLD_URL = (process.env.OLD_SUPABASE_URL || 'https://echffgdxkcxvobrwwiyw.supabase.co').replace(/\/+$/, '')
const NEW_URL = (process.env.NEW_SUPABASE_URL || 'https://zqzgarvmpqqqaobeicpc.supabase.co').replace(/\/+$/, '')
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY?.trim()
const NEW_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY?.trim()
if (!OLD_KEY) throw new Error('Missing OLD_SUPABASE_SERVICE_ROLE_KEY')
if (!NEW_KEY) throw new Error('Missing NEW_SUPABASE_SERVICE_ROLE_KEY')
console.log(`Old project key type: ${keyKindForLog(OLD_KEY)}`)
console.log(`New project key type: ${keyKindForLog(NEW_KEY)}`)

function keyKindForLog(key) {
  if (key.startsWith('sb_secret_')) return 'new secret key (sb_secret_...)'
  if (key.startsWith('sb_publishable_')) return 'ERROR: publishable key'
  if (key.split('.').length === 3) return 'legacy JWT key'
  return 'unknown format'
}

function keyKind(key) {
  if (key.startsWith('sb_secret_')) return 'new secret key'
  if (key.startsWith('sb_publishable_')) return 'publishable key (wrong for migration)'
  if (key.split('.').length === 3) return 'legacy JWT key'
  return 'unknown key format'
}
function headers(key, extra = {}) {
  const result = { apikey: key, 'content-type': 'application/json', ...extra }
  // New sb_secret_* keys are opaque API keys, not JWTs. Sending them as
  // Authorization: Bearer makes PostgREST try to parse them as a JWT.
  if (!key.startsWith('sb_secret_') && !key.startsWith('sb_publishable_')) {
    result.Authorization = `Bearer ${key}`
  }
  return result
}
function projectLabel(base) {
  if (base.includes('echffgdxkcxvobrwwiyw')) return 'OLD Supabase (echffgdxkcxvobrwwiyw)'
  if (base.includes('zqzgarvmpqqqaobeicpc')) return 'NEW Supabase (zqzgarvmpqqqaobeicpc)'
  return base
}
async function getRows(base, key, table, query) {
  const response = await fetch(`${base}/rest/v1/${table}?${query}`, { headers: headers(key) })
  if (response.status === 404) return []
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`${projectLabel(base)} / ${table}: HTTP ${response.status}: ${data?.message || data?.error || 'request failed'}; key type: ${keyKind(key)}`)
  }
  return Array.isArray(data) ? data : []
}
async function upsert(table, rows, conflict) {
  if (!rows.length) return
  const response = await fetch(`${NEW_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`, {
    method: 'POST',
    headers: headers(NEW_KEY, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(rows),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(`${table} upsert: ${data?.message || response.status}`)
  }
}
function parseScore(value, fallbackTotal = 0) {
  const match = String(value ?? '').match(/(\d+)\s*\/\s*(\d+)/)
  if (match) return { correct: Number(match[1]), total: Number(match[2]) }
  const numeric = Number(value)
  return Number.isFinite(numeric) && fallbackTotal ? { correct: numeric, total: fallbackTotal } : null
}
function percent(correct, total) { return total > 0 ? Math.round(correct / total * 100) : 0 }
function normalize(value) { return String(value ?? '').normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ') }

function loadVocabulary() {
  const source = fs.readFileSync(path.join(root, 'data', 'vocabulary-data.js'), 'utf8')
  const sandbox = { window: {} }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox)
  return sandbox.window.VOCABULARY_DATA || []
}
const topics = loadVocabulary()
const byLegacy = new Map()
for (const topic of topics) {
  for (const word of topic.words || []) {
    byLegacy.set(`${topic.id}\u0000${normalize(word.legacyKey || word.en)}`, { topic, word })
  }
}
function vocabularyRow(topicId, legacyKey, source = 'legacy-cloud') {
  const record = byLegacy.get(`${topicId}\u0000${normalize(legacyKey)}`)
  if (!record) return null
  const wordKey = normalize(record.word.uniqueKey || record.word.en).replace(/^[\s.,!?;:()[\]{}"“”]+|[\s.,!?;:()[\]{}"“”]+$/g, '')
  return {
    student_id: STUDENT_ID,
    word_key: wordKey,
    word_id: record.word.id,
    en: record.word.en,
    ru: record.word.ru,
    source_topic_id: topicId,
    status: 'known',
    learned_at: new Date().toISOString(),
  }
}

const lessonTotals = { hw1: 35, hw2: 35, hw3: 5, hw4: 12 }
const homeworkResults = await getRows(OLD_URL, OLD_KEY, 'homework_results', `student=eq.${STUDENT_ID}&select=*`)
const homeworkProgress = await getRows(OLD_URL, OLD_KEY, 'homework_progress', `student=eq.${STUDENT_ID}&select=*`)
const currentHomework = await getRows(NEW_URL, NEW_KEY, 'homework_progress', `student_id=eq.${STUDENT_ID}&select=*`)
const currentHomeworkByLesson = new Map(currentHomework.map((row) => [row.lesson_id, row]))
const mergedHomework = new Map()
for (const row of [...homeworkResults, ...homeworkProgress]) {
  const hwId = String(row.hw_id || '')
  if (!/^hw[1-4]$/.test(hwId)) continue
  const parsed = parseScore(row.score, Number(row.max_score || lessonTotals[hwId]))
  if (!parsed) continue
  const lessonId = `lesson-${hwId.slice(2)}`
  const updated = row.submitted_at || row.updated_at || new Date().toISOString()
  const previous = mergedHomework.get(lessonId)
  if (previous && Date.parse(previous.updated_at) > Date.parse(updated)) continue
  mergedHomework.set(lessonId, {
    student_id: STUDENT_ID,
    student_name: 'Оля',
    lesson_id: lessonId,
    lesson_title: `Migrated ${hwId}`,
    status: 'submitted',
    answers: {},
    legacy_answers: row,
    migrated_from_legacy: true,
    score_correct: parsed.correct,
    score_total: parsed.total,
    score_percent: percent(parsed.correct, parsed.total),
    checked_at: updated,
    submitted_at: updated,
    updated_at: updated,
  })
}
const homeworkRowsToUpsert = [...mergedHomework.values()].map((legacyRow) => {
  const current = currentHomeworkByLesson.get(legacyRow.lesson_id)
  if (!current) return legacyRow

  // Never erase answers or a newer result already created on the rebuilt site.
  // The legacy row may still upgrade an old checked result to submitted.
  const currentIsNewer = Date.parse(current.updated_at || '') >= Date.parse(legacyRow.updated_at || '')
  return {
    ...legacyRow,
    ...current,
    status: current.status === 'submitted' || legacyRow.status === 'submitted' ? 'submitted' : 'checked',
    answers: current.answers && Object.keys(current.answers).length ? current.answers : legacyRow.answers,
    legacy_answers: current.legacy_answers || legacyRow.legacy_answers,
    migrated_from_legacy: Boolean(current.migrated_from_legacy || legacyRow.migrated_from_legacy),
    score_correct: currentIsNewer && current.score_total ? current.score_correct : legacyRow.score_correct,
    score_total: currentIsNewer && current.score_total ? current.score_total : legacyRow.score_total,
    score_percent: currentIsNewer && current.score_total ? current.score_percent : legacyRow.score_percent,
    checked_at: currentIsNewer && current.checked_at ? current.checked_at : legacyRow.checked_at,
    submitted_at: current.submitted_at || legacyRow.submitted_at,
    updated_at: currentIsNewer ? current.updated_at : legacyRow.updated_at,
  }
})
await upsert('homework_progress', homeworkRowsToUpsert, 'student_id,lesson_id')

const legacySets = {
  'unit2a-nouns': { topicId: 'vocab-unit2a' },
  'unit2a-verbs': { topicId: 'vocab-unit2a' },
  holidays: { topicId: 'vocab-holidays' },
}
const vocabRowsOld = await getRows(OLD_URL, OLD_KEY, 'vocab_progress', `student=eq.${STUDENT_ID}&select=*`)
const currentWordRows = await getRows(NEW_URL, NEW_KEY, 'vocabulary_progress', `student_id=eq.${STUDENT_ID}&select=*`)
const currentWordKeys = new Set(currentWordRows.map((row) => row.word_key))
const currentTopicRows = await getRows(NEW_URL, NEW_KEY, 'vocabulary_topic_progress', `student_id=eq.${STUDENT_ID}&select=*`)
const currentTopicsById = new Map(currentTopicRows.map((row) => [row.topic_id, row]))
const newWordRows = new Map()
const topicRows = new Map()
for (const row of vocabRowsOld) {
  const mapping = legacySets[row.set_id]
  if (!mapping) continue
  const knownWords = String(row.known_words || '').split(',').map((value) => value.trim()).filter(Boolean)
  for (const knownWord of knownWords) {
    const converted = vocabularyRow(mapping.topicId, knownWord)
    if (converted) newWordRows.set(converted.word_key, converted)
  }
  const prev = topicRows.get(mapping.topicId) || { count: 0, total: 0 }
  prev.count = Math.max(prev.count, Number(row.known_count || knownWords.length))
  prev.total = Math.max(prev.total, (topics.find((topic) => topic.id === mapping.topicId)?.words || []).length)
  topicRows.set(mapping.topicId, prev)
}
const irregRows = await getRows(OLD_URL, OLD_KEY, 'irreg_progress', `student=eq.${STUDENT_ID}&select=*`)
for (const row of irregRows) {
  const knownVerbs = String(row.known_verbs || '').split(',').map((value) => value.trim()).filter(Boolean)
  for (const verb of knownVerbs) {
    const converted = vocabularyRow('vocab-irregular-verbs', verb)
    if (converted) newWordRows.set(converted.word_key, converted)
  }
  topicRows.set('vocab-irregular-verbs', {
    count: Math.max(Number(row.known_count || 0), knownVerbs.length),
    total: (topics.find((topic) => topic.id === 'vocab-irregular-verbs')?.words || []).length,
  })
}
const missingWordRows = [...newWordRows.values()].filter((row) => !currentWordKeys.has(row.word_key))
await upsert('vocabulary_progress', missingWordRows, 'student_id,word_key')
const topicRowsToUpsert = [...topicRows.entries()].map(([topicId, state]) => {
  const current = currentTopicsById.get(topicId) || {}
  return {
    student_id: STUDENT_ID,
    topic_id: topicId,
    tests: Array.isArray(current.tests) ? current.tests : [],
    legacy_learned_count: Math.max(Number(current.legacy_learned_count || 0), state.count),
    legacy_total: Math.max(Number(current.legacy_total || 0), state.total),
    legacy_source: current.legacy_source || 'legacy-cloud:echffgdxkcxvobrwwiyw',
    legacy_updated_at: current.legacy_updated_at || new Date().toISOString(),
  }
})
await upsert('vocabulary_topic_progress', topicRowsToUpsert, 'student_id,topic_id')

console.log(`Prepared ${homeworkRowsToUpsert.length} homework rows, added ${missingWordRows.length} missing exact known words, and merged ${topicRowsToUpsert.length} vocabulary topic summaries.`)
