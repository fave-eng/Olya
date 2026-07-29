import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = process.cwd()

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function loadWindowArray(relativePath, globalName) {
  const absolutePath = path.join(root, relativePath)
  if (!fs.existsSync(absolutePath)) return []

  const source = fs.readFileSync(absolutePath, 'utf8')
  const sandbox = { window: {} }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox, { filename: relativePath, timeout: 2000 })

  const data = sandbox.window[globalName]
  return Array.isArray(data) ? data : []
}

function loadLessons() {
  const lessonsDir = path.join(root, 'data', 'lessons')
  if (!fs.existsSync(lessonsDir)) return []

  return fs.readdirSync(lessonsDir)
    .filter((filename) => /^lesson-\d+\.json$/i.test(filename))
    .map((filename) => {
      const absolutePath = path.join(lessonsDir, filename)
      const source = fs.readFileSync(absolutePath, 'utf8')
      return JSON.parse(source)
    })
}

function pageUrl(baseUrl, page, fallback) {
  const target = typeof page === 'string' && page.trim() ? page.trim() : fallback
  return new URL(target, `${baseUrl}/`).toString()
}

const siteBaseUrl = requiredEnv('SITE_BASE_URL').replace(/\/+$/, '')
const studentId = requiredEnv('STUDENT_ID')
const projectId = requiredEnv('SUPABASE_PROJECT_ID')
const notifySecret = requiredEnv('NOTIFY_WEBHOOK_SECRET')
const selectedLessonId = requiredEnv('LESSON_ID')

const lesson = loadLessons().find((item) => item.id === selectedLessonId)

if (!lesson) {
  throw new Error(
    `Lesson ${selectedLessonId} was not found in data/lessons. `
      + 'Check the lesson_id entered when starting the workflow.',
  )
}

if (lesson.status !== 'available') {
  throw new Error(
    `Lesson ${selectedLessonId} has status "${lesson.status ?? 'missing'}". `
      + 'Set status to "available" before sending the notification.',
  )
}

const vocabularyData = loadWindowArray('data/vocabulary-data.js', 'VOCABULARY_DATA')
const grammarData = loadWindowArray('data/grammar-data.js', 'GRAMMAR_DATA')

let vocabulary = null
if (typeof lesson.vocabularyId === 'string' && lesson.vocabularyId.trim()) {
  const vocabularyId = lesson.vocabularyId.trim()
  const topic = vocabularyData.find((item) => item.id === vocabularyId)

  if (!topic || !Array.isArray(topic.words) || topic.words.length === 0) {
    throw new Error(
      `Lesson ${selectedLessonId} refers to vocabulary ${vocabularyId}, `
        + 'but that vocabulary topic was not found or contains no words. '
        + 'Fix vocabularyId or remove it from the lesson.',
    )
  }

  vocabulary = {
    id: topic.id,
    title: topic.title || 'Слова к уроку',
    wordCount: topic.words.length,
    url: pageUrl(
      siteBaseUrl,
      topic.page,
      `vocabulary.html?id=${encodeURIComponent(topic.id)}`,
    ),
  }
}

const explicitGrammarIds = Array.isArray(lesson.grammarIds)
  ? lesson.grammarIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim())
  : []

for (const grammarId of explicitGrammarIds) {
  const topic = grammarData.find((item) => item.id === grammarId)
  if (!topic) {
    throw new Error(
      `Lesson ${selectedLessonId} refers to grammar ${grammarId}, `
        + 'but that grammar topic was not found. Fix grammarIds or remove this ID.',
    )
  }

  if (topic.status !== 'available') {
    throw new Error(
      `Grammar topic ${grammarId} is not available. `
        + 'Set its status to "available" or remove it from grammarIds.',
    )
  }
}

const grammar = grammarData
  .filter((topic) => topic.status === 'available')
  .filter((topic) => explicitGrammarIds.includes(topic.id) || topic.linkedLessonId === lesson.id)
  .map((topic) => ({
    id: topic.id,
    title: topic.title || 'Грамматика',
    url: pageUrl(
      siteBaseUrl,
      topic.page,
      `grammar-topic.html?id=${encodeURIComponent(topic.id)}`,
    ),
  }))

const notificationVersion = Number(lesson.notification?.version || 1)
if (!Number.isInteger(notificationVersion) || notificationVersion < 1) {
  throw new Error(
    `Invalid notification version for ${selectedLessonId}. `
      + 'Use a positive integer, for example: "version": 1.',
  )
}

const payload = {
  studentId,
  materialType: 'lesson_bundle',
  materialId: lesson.id,
  notificationVersion,
  homework: {
    id: lesson.id,
    title: lesson.title || 'Домашняя работа',
    url: pageUrl(
      siteBaseUrl,
      lesson.page,
      `lesson.html?id=${encodeURIComponent(lesson.id)}`,
    ),
  },
  vocabulary,
  grammar,
}

const endpoint = process.env.NOTIFY_ENDPOINT?.trim()
  || `https://${projectId}.supabase.co/functions/v1/notify-telegram`

console.log(`Manual notification requested for ${lesson.id}.`)
console.log(`Vocabulary included: ${vocabulary ? 'yes' : 'no'}.`)
console.log(`Grammar topics included: ${grammar.length}.`)

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-notify-secret': notifySecret,
  },
  body: JSON.stringify(payload),
})

const result = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))

if (!response.ok || !result.ok) {
  console.error(`Failed ${lesson.id}:`, result)
  process.exitCode = 1
} else if (result.skipped) {
  console.log(`Skipped ${lesson.id}: ${result.reason}`)
  console.log(
    'This notification version may already have been sent. '
      + 'Increase notification.version in the lesson JSON to send it again.',
  )
} else {
  console.log(`Sent ${lesson.id}; Telegram message id: ${result.telegramMessageId}`)
}
