(() => {
  'use strict';

  const config = window.APP_CONFIG || {};
  const student = config.student || {};
  let HOMEWORK_DATA = [];
  const RAW_VOCABULARY_DATA = Array.isArray(window.VOCABULARY_DATA) ? window.VOCABULARY_DATA : [];
  const GRAMMAR_DATA = Array.isArray(window.GRAMMAR_DATA) ? window.GRAMMAR_DATA : [];
  const lessonCache = new Map();
  const lessonsPath = 'data/lessons';
  const maxLessonNumber = 200;
  const maxConsecutiveMissingLessons = 3;

  const safeText = (value, fallback = '') => value === undefined || value === null ? fallback : String(value);
  const escapeHtml = (value) => safeText(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const byId = (id) => document.getElementById(id);
  const queryParam = (name) => new URLSearchParams(window.location.search).get(name) || '';
  const unique = (items) => [...new Set(Array.isArray(items) ? items : [])];
  const safePercent = (value, total) => {
    const numerator = Number(value) || 0;
    const denominator = Number(total) || 0;
    if (denominator <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)));
  };
  const shuffled = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const dateMs = (value) => {
    const time = Date.parse(value || '');
    return Number.isFinite(time) ? time : 0;
  };

  function normalizeLesson(rawLesson, requestedId = '') {
    if (!rawLesson || typeof rawLesson !== 'object') return null;
    const id = safeText(rawLesson.id || requestedId).trim();
    if (!/^lesson-\d+$/.test(id)) return null;
    const inferredNumber = Number(id.replace('lesson-', '')) || 0;
    return {
      ...rawLesson,
      id,
      number: Number(rawLesson.number || inferredNumber),
      title: safeText(rawLesson.title, `Lesson ${inferredNumber}`),
      subtitle: safeText(rawLesson.subtitle, 'Интерактивное домашнее задание'),
      status: safeText(rawLesson.status, 'available'),
      page: `lesson.html?id=${encodeURIComponent(id)}`,
      blocks: Array.isArray(rawLesson.blocks) ? rawLesson.blocks : []
    };
  }

  async function fetchLessonFile(id) {
    const cleanId = safeText(id).trim();
    if (!/^lesson-\d+$/.test(cleanId)) return null;
    if (lessonCache.has(cleanId)) return lessonCache.get(cleanId);

    const promise = (async () => {
      const url = new URL(`${lessonsPath}/${cleanId}.json`, document.baseURI);
      url.searchParams.set('_', Date.now().toString());
      const response = await fetch(url, { cache: 'no-store' });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Не удалось загрузить ${cleanId}.json: ${response.status}`);
      const lesson = normalizeLesson(await response.json(), cleanId);
      if (!lesson) throw new Error(`Файл ${cleanId}.json имеет неверную структуру.`);
      return lesson;
    })();

    lessonCache.set(cleanId, promise);
    try {
      const lesson = await promise;
      // Не запоминаем отсутствующий файл навсегда: он может быть опубликован позже.
      if (!lesson) lessonCache.delete(cleanId);
      return lesson;
    } catch (error) {
      lessonCache.delete(cleanId);
      throw error;
    }
  }

  async function discoverHomeworkData() {
    const lessonsById = new Map();
    let highestKnownLessonNumber = 0;

    try {
      const indexUrl = new URL(`${lessonsPath}/index.json`, document.baseURI);
      indexUrl.searchParams.set('_', Date.now().toString());
      const response = await fetch(indexUrl, { cache: 'no-store' });
      if (response.ok) {
        const payload = await response.json();
        const ids = Array.isArray(payload) ? payload : payload.lessons;
        if (Array.isArray(ids)) {
          const indexedLessons = (await Promise.all(ids.map((id) => fetchLessonFile(id)))).filter(Boolean);
          indexedLessons.forEach((lesson) => {
            lessonsById.set(lesson.id, lesson);
            highestKnownLessonNumber = Math.max(highestKnownLessonNumber, Number(lesson.number || 0));
          });
        }
      }
    } catch (error) {
      console.warn('Не удалось загрузить индекс уроков, используется автоматический поиск:', error);
    }

    // Даже если index.json устарел, автоматически ищем lesson-1.json, lesson-2.json и далее.
    // Поиск заканчивается после трёх отсутствующих файлов подряд за последним найденным уроком.
    let consecutiveMissing = 0;
    for (let number = 1; number <= maxLessonNumber; number += 1) {
      const lesson = await fetchLessonFile(`lesson-${number}`);
      if (lesson) {
        lessonsById.set(lesson.id, lesson);
        highestKnownLessonNumber = Math.max(highestKnownLessonNumber, Number(lesson.number || number));
        consecutiveMissing = 0;
      } else {
        consecutiveMissing += 1;
        if (number > highestKnownLessonNumber && consecutiveMissing >= maxConsecutiveMissingLessons) break;
      }
    }

    return [...lessonsById.values()]
      .sort((a, b) => Number(a.number || 0) - Number(b.number || 0));
  }

  async function loadHomeworkData() {
    const view = document.body?.dataset?.view || '';
    const requestedId = queryParam('id');

    if (view === 'lesson' && requestedId) {
      const lesson = await fetchLessonFile(requestedId);
      HOMEWORK_DATA = lesson ? [lesson] : [];
    } else {
      HOMEWORK_DATA = await discoverHomeworkData();
    }

    window.HOMEWORK_DATA = HOMEWORK_DATA;
    return HOMEWORK_DATA;
  }

  async function resolveLessonContent(lesson) {
    return lesson || null;
  }

  function normalizeWordKey(value) {
    return safeText(value)
      .normalize('NFKC')
      .toLocaleLowerCase('en')
      .replace(/[’‘`]/g, "'")
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^[\s.,!?;:()[\]{}"“”]+|[\s.,!?;:()[\]{}"“”]+$/g, '');
  }

  function buildVocabularyCatalog(topics) {
    const seen = new Map();
    const byKey = new Map();
    const idToKey = new Map();
    const duplicates = [];
    const preparedTopics = topics.map((topic) => {
      const words = [];
      (Array.isArray(topic.words) ? topic.words : []).forEach((sourceWord) => {
        const wordKey = normalizeWordKey(sourceWord.uniqueKey || sourceWord.en);
        if (!wordKey) return;
        idToKey.set(safeText(sourceWord.id), wordKey);
        if (seen.has(wordKey)) {
          duplicates.push({ wordKey, skippedTopicId: topic.id, firstTopicId: seen.get(wordKey).topicId });
          return;
        }
        const word = { ...sourceWord, __wordKey: wordKey };
        const record = { word, topicId: topic.id };
        seen.set(wordKey, record);
        byKey.set(wordKey, record);
        words.push(word);
      });
      return { ...topic, words };
    });
    if (duplicates.length) {
      console.info('Повторяющиеся слова исключены из словаря:', duplicates);
    }
    return {
      topics: preparedTopics.filter((topic) => topic.words.length > 0),
      allTopics: preparedTopics,
      allWords: [...byKey.values()].map((item) => item.word),
      byKey,
      idToKey,
      duplicates
    };
  }

  const VOCABULARY_CATALOG = buildVocabularyCatalog(RAW_VOCABULARY_DATA);
  const VOCABULARY_DATA = VOCABULARY_CATALOG.topics;

  function showToast(message) {
    const toast = byId('app-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3000);
  }

  const storage = {
    read(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (error) {
        console.warn('Не удалось прочитать локальный прогресс:', error);
        return fallback;
      }
    },
    write(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.warn('Не удалось сохранить локальный прогресс:', error);
        return false;
      }
    }
  };

  const studentId = safeText(student.id, 'student').toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'student';
  const key = (section) => `english_space_${studentId}_${section}`;
  const tables = {
    homework: config.supabase?.tables?.homework || 'homework_progress',
    vocabulary: config.supabase?.tables?.vocabulary || 'vocabulary_progress',
    vocabularyTopics: config.supabase?.tables?.vocabularyTopics || 'vocabulary_topic_progress',
    grammar: config.supabase?.tables?.grammar || 'grammar_progress'
  };

  const CloudService = {
    client: null,
    syncing: false,
    timers: {},
    isConfigured() {
      return Boolean(
        config.features?.cloudSync &&
        safeText(config.supabase?.url).trim() &&
        safeText(config.supabase?.anonKey).trim() &&
        window.supabase?.createClient
      );
    },
    async init() {
      if (!this.isConfigured()) return null;
      if (!this.client) {
        // Удаляем сохранённую сессию старой версии сайта.
        // Иначе Supabase может отправлять запросы как authenticated,
        // хотя новая схема рассчитана на роль anon.
        try {
          const projectRef = new URL(config.supabase.url).hostname.split('.')[0];
          window.localStorage.removeItem(`sb-${projectRef}-auth-token`);
        } catch (error) {
          console.warn('Не удалось очистить старую Supabase-сессию:', error);
        }

        const emptyAuthStorage = {
          getItem() { return null; },
          setItem() {},
          removeItem() {}
        };

        this.client = window.supabase.createClient(
          config.supabase.url,
          config.supabase.anonKey,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
              storage: emptyAuthStorage
            }
          }
        );
      }
      return this.client;
    },
    queue(section) {
      if (!this.isConfigured() || !this.client || this.syncing) return;
      window.clearTimeout(this.timers[section]);
      this.timers[section] = window.setTimeout(() => {
        window.ProgressService.syncToCloud(section).catch((error) => {
          console.error('Ошибка облачного сохранения:', error);
          showToast('Не удалось сохранить прогресс в Supabase');
        });
      }, 450);
    }
  };

  function migrateLegacyOlyaProgress() {
    const marker = key('legacy_migration_v1');
    if (window.localStorage.getItem(marker)) return;

    const now = new Date().toISOString();
    const readRawJson = (storageKey, fallback = null) => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        return raw ? JSON.parse(raw) : fallback;
      } catch (error) {
        console.warn(`Не удалось прочитать старый ключ ${storageKey}:`, error);
        return fallback;
      }
    };
    const parseScore = (value, fallbackTotal = 0) => {
      const match = safeText(value).match(/(\d+)\s*\/\s*(\d+)/);
      if (match) return { correct: Number(match[1]), total: Number(match[2]) };
      const numeric = Number(value);
      return Number.isFinite(numeric) && fallbackTotal > 0 ? { correct: numeric, total: fallbackTotal } : null;
    };
    const prepareHomework = () => {
      const progress = storage.read(key('homework'), { completedIds: [], results: {}, submissions: {} });
      progress.completedIds = unique(progress.completedIds);
      progress.results = progress.results && typeof progress.results === 'object' ? progress.results : {};
      progress.submissions = progress.submissions && typeof progress.submissions === 'object' ? progress.submissions : {};
      return progress;
    };
    const saveLegacyLesson = (homework, number, score, answers, completed, checkedAt, rawLegacy) => {
      if (!score) return;
      const lessonId = `lesson-${number}`;
      const previous = homework.results[lessonId] || {};
      homework.results[lessonId] = {
        ...previous,
        correct: Number(score.correct || 0),
        total: Number(score.total || 0),
        percent: safePercent(score.correct, score.total),
        answers: answers && typeof answers === 'object' ? answers : (previous.answers || {}),
        legacyAnswers: rawLegacy || previous.legacyAnswers || null,
        checkedAt: checkedAt || previous.checkedAt || now,
        migratedAt: previous.migratedAt || now
      };
      if (completed) {
        if (!homework.completedIds.includes(lessonId)) homework.completedIds.push(lessonId);
        homework.submissions[lessonId] = homework.submissions[lessonId] || { savedAt: checkedAt || now, status: 'migrated-local' };
      }
    };
    const mapHw1Answers = (saved) => {
      const inputs = saved?.inputs || {};
      const answers = { 'l1-ex1a': {}, 'l1-ex1b': {}, 'l1-ex1c': {}, 'l1-ex1d': {} };
      for (let index = 1; index <= 7; index += 1) {
        if (inputs[`group_regular_${index}`] !== undefined) answers['l1-ex1a'][`reg-${index}`] = inputs[`group_regular_${index}`];
        if (inputs[`group_irregular_${index}`] !== undefined) answers['l1-ex1a'][`irr-${index}`] = inputs[`group_irregular_${index}`];
      }
      for (let index = 0; index < 5; index += 1) if (inputs[`b${index}`] !== undefined) answers['l1-ex1b'][String(index + 1)] = inputs[`b${index}`];
      for (let index = 1; index <= 10; index += 1) if (inputs[`c${index}`] !== undefined) answers['l1-ex1c'][String(index)] = inputs[`c${index}`];
      for (let index = 0; index < 6; index += 1) if (inputs[`d${index}`] !== undefined) answers['l1-ex1d'][String(index + 1)] = inputs[`d${index}`];
      return answers;
    };
    const mapHw2Answers = (saved) => {
      const inputs = saved?.inputs || {};
      const answers = { 'l2-exa': {}, 'l2-exb': {}, 'l2-exc': {} };
      Object.entries(inputs).forEach(([oldKey, value]) => {
        if (oldKey.startsWith('g_irr_')) answers['l2-exa'][`irr-${oldKey.slice(6)}`] = value;
        else if (oldKey.startsWith('g_reg_')) answers['l2-exa'][`reg-${oldKey.slice(6)}`] = value;
        else if (/^b\d+$/.test(oldKey)) answers['l2-exb'][String(Number(oldKey.slice(1)) + 1)] = value;
        else if (/^c\d+$/.test(oldKey)) answers['l2-exc'][oldKey.slice(1)] = value;
      });
      return answers;
    };

    try {
      const homework = prepareHomework();
      const hw1 = readRawJson('olya_hw1_answers', null);
      const hw2 = readRawJson('olya_hw2_answers', null);
      const hw4 = readRawJson('olya_hw_hw4', null);
      saveLegacyLesson(homework, 1, parseScore(hw1?.score || window.localStorage.getItem('olya_hw1_score'), 35), mapHw1Answers(hw1), Boolean(window.localStorage.getItem('olya_hw1_done')), hw1?.submitted_at, hw1);
      saveLegacyLesson(homework, 2, parseScore(hw2?.score || window.localStorage.getItem('olya_hw2_score'), 35), mapHw2Answers(hw2), Boolean(window.localStorage.getItem('olya_hw2_done')), hw2?.submitted_at, hw2);
      saveLegacyLesson(homework, 3, parseScore(window.localStorage.getItem('olya_hw3_score'), 5), {}, Boolean(window.localStorage.getItem('olya_hw3_done')), now, null);
      const hw4Total = Number(hw4?.total ?? (hw4?.scores ? Object.values(hw4.scores).reduce((sum, value) => sum + Number(value || 0), 0) : NaN));
      saveLegacyLesson(homework, 4, Number.isFinite(hw4Total) ? { correct: hw4Total, total: 12 } : null, {}, Boolean(window.localStorage.getItem('olya_hw4_done')), hw4?.updatedAt, hw4);
      homework.completedIds = unique(homework.completedIds);
      storage.write(key('homework'), homework);

      const vocabulary = normalizeVocabularyProgress(storage.read(key('vocabulary'), {}));
      const topicById = new Map(VOCABULARY_CATALOG.allTopics.map((topic) => [topic.id, topic]));
      const findByLegacyKey = (topicId, legacyKey) => topicById.get(topicId)?.words?.find((word) => normalizeWordKey(word.legacyKey || word.en) === normalizeWordKey(legacyKey));
      const setWord = (topicId, legacyKey, status) => {
        const word = findByLegacyKey(topicId, legacyKey);
        if (!word?.__wordKey) return;
        const previous = vocabulary.words[word.__wordKey] || {};
        if (previous.status === 'known' && status === 'difficult') return;
        vocabulary.words[word.__wordKey] = {
          status,
          topicId,
          learnedAt: status === 'known' ? (previous.learnedAt || now) : null,
          updatedAt: now
        };
      };
      const importBooleanMap = (storageKey, topicId, legacyWords) => {
        const state = readRawJson(storageKey, null);
        if (!state || typeof state !== 'object') return;
        Object.entries(state).forEach(([index, value]) => {
          const word = legacyWords[Number(index)];
          if (!word) return;
          setWord(topicId, word, value === true ? 'known' : 'difficult');
        });
      };
      importBooleanMap('olya_vocab_unit2a-nouns', 'vocab-unit2a', ['title','lost','last','top','view','distance','for a while','thing','probably','out','terrible','angry','table','could','find','decide','climb']);
      importBooleanMap('olya_vocab_unit2a-verbs', 'vocab-unit2a', ['climb','want','decide','start','arrive','book','check','look','wait','travel']);
      importBooleanMap('olya_vocab_holidays', 'vocab-holidays', ['go camping','go for a walk','book a flight online','go abroad','go swimming','go out at night','stay in a hotel','go sightseeing','sunbathe on the beach','go away for the weekend','go on holiday','go by bus','go by car','go by plane','go by train','go skiing','go walking','go cycling','go sailing','go surfing','go fishing','stay at a campsite','stay with friends','take photos','buy souvenirs','have a good time','spend money','spend time','rent an apartment','hire a bicycle','hire skis','comfortable','sunny','crowded','noisy','unhelpful','basic','friendly','helpful','lovely','beautiful','cloudy','luxurious','dirty','uncomfortable','unfriendly','windy','foggy','great','wonderful','fantastic','OK','not bad','all right','awful','horrible','terrible']);
      importBooleanMap('olya_irreg_known', 'vocab-irregular-verbs', ['be','bring','buy','can','choose','come','do','drink','drive','eat','find','fly','get','give','go','have','know','leave','make','meet','read','run','say','see','send','speak','spend','take','think','understand','write','sit','feel']);
      storage.write(key('vocabulary'), normalizeVocabularyProgress(vocabulary));

      window.localStorage.setItem(marker, 'done');
    } catch (error) {
      console.warn('Не удалось полностью перенести старый локальный прогресс Оли:', error);
    }
  }

  function findLegacyLessonTarget(lessonId, legacyKey) {
    const keyText = safeText(legacyKey);
    let match;
    if (lessonId === 'lesson-4') {
      if ((match = keyText.match(/^1\.(\d+)$/))) return ['l4-key-vocab', match[1]];
      if ((match = keyText.match(/^12\.1\.(\d+)$/))) return ['l4-12-1', String(Number(match[1]) - 1)];
      if ((match = keyText.match(/^12\.2\.(\d+)$/))) return ['l4-12-2', String(Number(match[1]) - 1)];
      if ((match = keyText.match(/^12\.4\.(\d+)$/))) return ['l4-12-4', String(Number(match[1]) - 1)];
      if ((match = keyText.match(/^free_(\d+)$/))) return ['l4-over-to-you', match[1]];
      if (keyText === 'matrix') return ['l4-collocations', 'matrix'];
    }
    if (lessonId === 'lesson-5') {
      if ((match = keyText.match(/^q1_(.+)$/))) return ['l5-ex1', match[1]];
      if ((match = keyText.match(/^q2_(\d+)$/))) return ['l5-ex2', match[1]];
      if ((match = keyText.match(/^q3_1_(\d+)$/))) return ['l5-ex31', match[1]];
      if ((match = keyText.match(/^q3_2_(\d+)$/))) return ['l5-ex32', match[1]];
      if ((match = keyText.match(/^q3_3_(\d+)$/))) return ['l5-ex33', match[1]];
    }
    if (lessonId === 'lesson-6') {
      if (keyText === 'q7') return ['l6-ex7', '1'];
      if ((match = keyText.match(/^q8_(\d+)$/))) return ['l6-ex8', match[1]];
      if ((match = keyText.match(/^q9_(\d+)$/))) return ['l6-ex9', match[1]];
    }
    if (lessonId === 'lesson-7') {
      if ((match = keyText.match(/^q1_(\d+)$/))) return ['l7-ex1', match[1]];
      if ((match = keyText.match(/^q2_(.+)$/))) return ['l7-ex2', match[1]];
      if ((match = keyText.match(/^q43_1_(\d+)$/))) return ['l7-ex431', match[1]];
      if ((match = keyText.match(/^q43_2_(\d+)$/))) return ['l7-ex432', String(Number(match[1]) - 1)];
    }
    if (lessonId === 'lesson-8') {
      if ((match = keyText.match(/^q3_(\d+)$/))) return ['l8-ex3', match[1]];
      if ((match = keyText.match(/^q99_(\d+)$/))) return ['l8-ex992', match[1]];
      if ((match = keyText.match(/^q4_(\d+)$/))) return ['l8-ex4', match[1]];
      if ((match = keyText.match(/^pred_(\d+)$/))) return ['l8-predictions', match[1]];
      if (keyText === 'q5') return ['l8-ex5', '1'];
      if ((match = keyText.match(/^listen_(\d+)$/))) return ['l8-listening', match[1]];
    }
    return null;
  }

  function convertLegacyChoiceValue(item, value) {
    if (!item || !['single', 'select'].includes(item.input)) return value;
    if (value === undefined || value === null || value === '') return '';
    const options = Array.isArray(item.options) ? item.options : [];
    if (Number.isInteger(value) && value >= 0 && value < options.length) return value;
    const raw = safeText(value).trim();
    if (/^[a-z]$/i.test(raw)) {
      const index = raw.toLowerCase().charCodeAt(0) - 97;
      if (index >= 0 && index < options.length) return index;
    }
    if (/^[tf]$/i.test(raw) && options.length === 2) return raw.toUpperCase() === 'T' ? 0 : 1;
    if (/^\d+$/.test(raw)) {
      const index = Number(raw);
      if (index >= 0 && index < options.length) return index;
    }
    const normalized = normalizeAnswer(raw);
    const index = options.findIndex((option) => {
      const optionNormalized = normalizeAnswer(option);
      return optionNormalized === normalized || optionNormalized.includes(normalized) || normalized.includes(optionNormalized);
    });
    return index >= 0 ? index : value;
  }

  function convertLegacyHomeworkAnswers(lessonId, legacyAnswers, lesson) {
    if (!legacyAnswers || typeof legacyAnswers !== 'object' || !lesson) return {};
    const converted = {};
    const blocks = Array.isArray(lesson.blocks) ? lesson.blocks : [];
    Object.entries(legacyAnswers).forEach(([legacyKey, rawValue]) => {
      const alreadyNewBlock = blocks.find((block) => block.id === legacyKey);
      if (alreadyNewBlock) {
        converted[legacyKey] = rawValue;
        return;
      }
      const target = findLegacyLessonTarget(lessonId, legacyKey);
      if (!target) return;
      const [blockId, itemId] = target;
      const block = blocks.find((item) => item.id === blockId);
      const item = block?.items?.find((entry) => safeText(entry.id) === safeText(itemId));
      if (!block || !item) return;
      if (!converted[blockId] || typeof converted[blockId] !== 'object') converted[blockId] = {};
      if (item.input === 'multiple' && !Array.isArray(rawValue)) return;
      converted[blockId][itemId] = convertLegacyChoiceValue(item, rawValue);
    });
    return converted;
  }

  function mergeLessonAnswers(legacyAnswers, currentAnswers) {
    const merged = { ...(legacyAnswers && typeof legacyAnswers === 'object' ? legacyAnswers : {}) };
    Object.entries(currentAnswers && typeof currentAnswers === 'object' ? currentAnswers : {}).forEach(([blockId, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value) && merged[blockId] && typeof merged[blockId] === 'object' && !Array.isArray(merged[blockId])) {
        merged[blockId] = { ...merged[blockId], ...value };
      } else {
        merged[blockId] = value;
      }
    });
    return merged;
  }

  function normalizeVocabularyProgress(value) {
    const words = value?.words && typeof value.words === 'object' ? { ...value.words } : {};
    const topics = {};
    Object.entries(value?.topics && typeof value.topics === 'object' ? value.topics : {}).forEach(([topicId, topic]) => {
      topics[topicId] = {
        tests: Array.isArray(topic?.tests) ? topic.tests : [],
        legacyLearnedCount: Math.max(0, Number(topic?.legacyLearnedCount || 0)),
        legacyTotal: Math.max(0, Number(topic?.legacyTotal || 0)),
        legacySource: safeText(topic?.legacySource),
        legacyUpdatedAt: topic?.legacyUpdatedAt || null
      };
      unique(topic?.known).forEach((legacyId) => {
        const wordKey = VOCABULARY_CATALOG.idToKey.get(safeText(legacyId));
        if (wordKey) words[wordKey] = { status: 'known', topicId, learnedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      });
      unique(topic?.difficult).forEach((legacyId) => {
        const wordKey = VOCABULARY_CATALOG.idToKey.get(safeText(legacyId));
        if (wordKey && words[wordKey]?.status !== 'known') words[wordKey] = { status: 'difficult', topicId, updatedAt: new Date().toISOString() };
      });
    });
    Object.entries(words).forEach(([wordKey, item]) => {
      if (!['known', 'difficult'].includes(item?.status)) delete words[wordKey];
    });
    return { words, topics };
  }

  window.ProgressService = {
    loadHomeworkProgress() {
      const value = storage.read(key('homework'), {});
      return {
        completedIds: unique(value.completedIds),
        results: value.results && typeof value.results === 'object' ? value.results : {},
        submissions: value.submissions && typeof value.submissions === 'object' ? value.submissions : {}
      };
    },
    saveHomeworkProgress(progress) {
      const ok = storage.write(key('homework'), progress || {});
      CloudService.queue('homework');
      return ok;
    },
    loadVocabularyProgress() {
      return normalizeVocabularyProgress(storage.read(key('vocabulary'), {}));
    },
    saveVocabularyProgress(progress) {
      const normalized = normalizeVocabularyProgress(progress || {});
      const ok = storage.write(key('vocabulary'), normalized);
      const difficult = Object.entries(normalized.words)
        .filter(([, item]) => item.status === 'difficult')
        .map(([wordKey]) => wordKey);
      storage.write(key('difficult_words'), difficult);
      CloudService.queue('vocabulary');
      return ok;
    },
    loadGrammarProgress() {
      const value = storage.read(key('grammar'), {});
      return { topics: value.topics && typeof value.topics === 'object' ? value.topics : {} };
    },
    saveGrammarProgress(progress) {
      const ok = storage.write(key('grammar'), progress || {});
      CloudService.queue('grammar');
      return ok;
    },
    async syncFromCloud() {
      if (!CloudService.isConfigured()) return false;
      if (!CloudService.client) await CloudService.init();
      CloudService.syncing = true;
      try {
        const client = CloudService.client;
        const [homeworkResponse, vocabularyResponse, vocabularyTopicsResponse, grammarResponse] = await Promise.all([
          client.from(tables.homework).select('*').eq('student_id', studentId),
          client.from(tables.vocabulary).select('*').eq('student_id', studentId),
          client.from(tables.vocabularyTopics).select('*').eq('student_id', studentId),
          client.from(tables.grammar).select('*').eq('student_id', studentId)
        ]);
        [homeworkResponse, vocabularyResponse, vocabularyTopicsResponse, grammarResponse].forEach((response) => {
          if (response.error) throw response.error;
        });

        const homework = this.loadHomeworkProgress();
        (homeworkResponse.data || []).forEach((row) => {
          const localResult = homework.results[row.lesson_id] || {};
          const cloudLegacyAnswers = row.legacy_answers && typeof row.legacy_answers === 'object' ? row.legacy_answers : null;
          if (!Object.keys(localResult).length || dateMs(row.updated_at) >= dateMs(localResult.checkedAt)) {
            homework.results[row.lesson_id] = {
              ...localResult,
              correct: Number(row.score_correct || 0),
              total: Number(row.score_total || 0),
              percent: Number(row.score_percent || 0),
              answers: row.answers && typeof row.answers === 'object' ? row.answers : {},
              legacyAnswers: cloudLegacyAnswers || localResult.legacyAnswers || null,
              checkedAt: row.checked_at || row.updated_at,
              migratedAt: row.migrated_from_legacy ? (localResult.migratedAt || row.updated_at) : localResult.migratedAt
            };
          } else if (cloudLegacyAnswers && !localResult.legacyAnswers) {
            homework.results[row.lesson_id] = { ...localResult, legacyAnswers: cloudLegacyAnswers };
          }
          if (row.status === 'submitted' || row.migrated_from_legacy) {
            homework.submissions[row.lesson_id] = {
              savedAt: row.submitted_at || row.updated_at,
              status: row.migrated_from_legacy ? 'migrated-cloud' : 'cloud'
            };
          }
          if (row.status === 'submitted' || row.migrated_from_legacy) {
            homework.completedIds.push(row.lesson_id);
          }
        });
        homework.completedIds = unique(homework.completedIds);
        storage.write(key('homework'), homework);

        const vocabulary = this.loadVocabularyProgress();
        (vocabularyResponse.data || []).forEach((row) => {
          const local = vocabulary.words[row.word_key];
          if (!local || dateMs(row.updated_at) >= dateMs(local.updatedAt)) {
            vocabulary.words[row.word_key] = {
              status: row.status,
              topicId: row.source_topic_id || '',
              learnedAt: row.learned_at || null,
              updatedAt: row.updated_at
            };
          }
        });
        (vocabularyTopicsResponse.data || []).forEach((row) => {
          const localTopic = vocabulary.topics[row.topic_id] || {};
          const localTests = localTopic.tests || [];
          const cloudTests = Array.isArray(row.tests) ? row.tests : [];
          const merged = new Map();
          [...localTests, ...cloudTests].forEach((test) => merged.set(test.completedAt || JSON.stringify(test), test));
          vocabulary.topics[row.topic_id] = {
            tests: [...merged.values()],
            legacyLearnedCount: Math.max(Number(localTopic.legacyLearnedCount || 0), Number(row.legacy_learned_count || 0)),
            legacyTotal: Math.max(Number(localTopic.legacyTotal || 0), Number(row.legacy_total || 0)),
            legacySource: localTopic.legacySource || row.legacy_source || '',
            legacyUpdatedAt: dateMs(row.legacy_updated_at) >= dateMs(localTopic.legacyUpdatedAt)
              ? row.legacy_updated_at
              : localTopic.legacyUpdatedAt
          };
        });
        storage.write(key('vocabulary'), normalizeVocabularyProgress(vocabulary));

        const grammar = this.loadGrammarProgress();
        (grammarResponse.data || []).forEach((row) => {
          const local = grammar.topics[row.topic_id] || {};
          grammar.topics[row.topic_id] = {
            ...local,
            passed: Boolean(local.passed || row.passed),
            passedAt: local.passedAt || row.passed_at || null,
            attempts: Math.max(Number(local.attempts || 0), Number(row.attempts || 0)),
            bestScore: Math.max(Number(local.bestScore || 0), Number(row.best_score || 0)),
            updatedAt: dateMs(row.updated_at) >= dateMs(local.updatedAt) ? row.updated_at : local.updatedAt
          };
        });
        storage.write(key('grammar'), grammar);
        await this.syncToCloud();
        return true;
      } finally {
        CloudService.syncing = false;
      }
    },
    async syncToCloud(section = 'all') {
      if (!CloudService.isConfigured()) return false;
      if (!CloudService.client) await CloudService.init();
      const client = CloudService.client;
      const sections = section === 'all' ? ['homework', 'vocabulary', 'grammar'] : [section];

      if (sections.includes('homework')) {
        const progress = this.loadHomeworkProgress();
        const lessonIds = unique([...Object.keys(progress.results), ...Object.keys(progress.submissions)]);
        const rows = lessonIds.map((lessonId) => {
          const result = progress.results[lessonId] || {};
          const submission = progress.submissions[lessonId];
          const lesson = HOMEWORK_DATA.find((item) => item.id === lessonId) || {};
          const total = Number(result.total || 0);
          const correct = Number(result.correct || 0);
          return {
            student_id: studentId,
            student_name: safeText(student.nameRu || student.nameEn),
            lesson_id: lessonId,
            lesson_title: safeText(lesson.title, lessonId),
            status: submission ? 'submitted' : 'checked',
            answers: result.answers && typeof result.answers === 'object' ? result.answers : {},
            legacy_answers: result.legacyAnswers && typeof result.legacyAnswers === 'object' ? result.legacyAnswers : null,
            migrated_from_legacy: Boolean(result.migratedAt || result.legacyAnswers),
            score_correct: total > 0 ? correct : null,
            score_total: total > 0 ? total : null,
            score_percent: total > 0 ? safePercent(correct, total) : null,
            checked_at: result.checkedAt || null,
            submitted_at: submission?.savedAt || null
          };
        });
        if (rows.length) {
          const { error } = await client.from(tables.homework).upsert(rows, { onConflict: 'student_id,lesson_id' });
          if (error) throw error;
        }
      }

      if (sections.includes('vocabulary')) {
        const progress = this.loadVocabularyProgress();
        const wordRows = Object.entries(progress.words).filter(([wordKey]) => VOCABULARY_CATALOG.byKey.has(wordKey)).map(([wordKey, state]) => {
          const record = VOCABULARY_CATALOG.byKey.get(wordKey);
          return {
            student_id: studentId,
            word_key: wordKey,
            word_id: safeText(record?.word?.id, wordKey),
            en: safeText(record?.word?.en, wordKey),
            ru: safeText(record?.word?.ru),
            source_topic_id: state.topicId || record?.topicId || null,
            status: state.status,
            learned_at: state.status === 'known' ? (state.learnedAt || new Date().toISOString()) : null
          };
        });
        if (wordRows.length) {
          const { error } = await client.from(tables.vocabulary).upsert(wordRows, { onConflict: 'student_id,word_key' });
          if (error) throw error;
        }
        const topicRows = Object.entries(progress.topics)
          .filter(([, topic]) => (Array.isArray(topic.tests) && topic.tests.length) || Number(topic.legacyLearnedCount || 0) > 0)
          .map(([topicId, topic]) => ({
            student_id: studentId,
            topic_id: topicId,
            tests: Array.isArray(topic.tests) ? topic.tests : [],
            legacy_learned_count: Math.max(0, Number(topic.legacyLearnedCount || 0)),
            legacy_total: Math.max(0, Number(topic.legacyTotal || 0)),
            legacy_source: safeText(topic.legacySource) || null,
            legacy_updated_at: topic.legacyUpdatedAt || null
          }));
        if (topicRows.length) {
          const { error } = await client.from(tables.vocabularyTopics).upsert(topicRows, { onConflict: 'student_id,topic_id' });
          if (error) throw error;
        }
      }

      if (sections.includes('grammar')) {
        const progress = this.loadGrammarProgress();
        const rows = Object.entries(progress.topics).map(([topicId, state]) => ({
          student_id: studentId,
          topic_id: topicId,
          passed: Boolean(state.passed),
          attempts: Number(state.attempts || 0),
          best_score: Number(state.bestScore || 0),
          passed_at: state.passed ? (state.passedAt || state.updatedAt || new Date().toISOString()) : null
        }));
        if (rows.length) {
          const { error } = await client.from(tables.grammar).upsert(rows, { onConflict: 'student_id,topic_id' });
          if (error) throw error;
        }
      }
      return true;
    }
  };

  function fillConfig() {
    const values = {
      nameRu: student.nameRu,
      nameEn: student.nameEn,
      level: student.level,
      textbook: student.textbook,
      textbookEdition: student.textbookEdition
    };
    document.querySelectorAll('[data-config]').forEach((node) => {
      node.textContent = safeText(values[node.dataset.config]);
    });
    if (student.nameEn) document.title = `${document.title} · ${student.nameEn}`;
  }

  function markNavigation() {
    const page = document.body.dataset.page;
    document.querySelectorAll('[data-nav]').forEach((link) => {
      const active = link.dataset.nav === page;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
    });
  }

  function progressMarkup(label, value, total, tone = '') {
    const percent = safePercent(value, total);
    return `<div class="progress-row">
      <div class="progress-row-head"><strong>${escapeHtml(label)}</strong><span>${Number(value) || 0} из ${Number(total) || 0}</span></div>
      <div class="progress-track" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
        <div class="progress-fill ${tone}" style="width:${percent}%"></div>
      </div>
    </div>`;
  }

  function exactKnownCountForTopic(progress, topic) {
    return (topic?.words || []).filter((word) => progress.words[word.__wordKey]?.status === 'known').length;
  }

  function effectiveKnownCountForTopic(progress, topic) {
    const exact = exactKnownCountForTopic(progress, topic);
    const legacy = Math.max(0, Number(progress.topics[topic?.id]?.legacyLearnedCount || 0));
    return Math.min(Number(topic?.words?.length || 0), Math.max(exact, legacy));
  }

  function effectiveKnownTotal(progress) {
    return VOCABULARY_DATA.reduce((sum, topic) => sum + effectiveKnownCountForTopic(progress, topic), 0);
  }

  function totals() {
    const hwProgress = window.ProgressService.loadHomeworkProgress();
    const vocabProgress = window.ProgressService.loadVocabularyProgress();
    const grammarProgress = window.ProgressService.loadGrammarProgress();
    const publishedHomework = HOMEWORK_DATA.filter((item) => ['available', 'completed', 'locked'].includes(item.status));
    const completedHomework = publishedHomework.filter((item) => hwProgress.completedIds.includes(item.id) || Boolean(hwProgress.submissions[item.id]) || item.status === 'completed').length;
    const knownWordCount = effectiveKnownTotal(vocabProgress);
    const passedGrammar = GRAMMAR_DATA.filter((topic) => grammarProgress.topics[topic.id]?.passed === true || topic.passed === true).length;
    return {
      homeworkTotal: publishedHomework.length,
      homeworkCompleted: completedHomework,
      vocabularyTotal: VOCABULARY_CATALOG.allWords.length,
      vocabularyKnown: knownWordCount,
      vocabularyTopics: VOCABULARY_DATA.length,
      grammarTotal: GRAMMAR_DATA.filter((topic) => topic.status !== 'draft').length,
      grammarPassed: passedGrammar
    };
  }

  function emptyState(icon, title, text) {
    return `<div class="card empty-state"><div class="empty-state-icon">${icon}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div>`;
  }

  function renderHome() {
    const t = totals();
    if (byId('home-stat-completed')) byId('home-stat-completed').textContent = t.homeworkCompleted;
    if (byId('vocab-stat-known')) byId('vocab-stat-known').textContent = t.vocabularyKnown;
    if (byId('grammar-stat-passed')) byId('grammar-stat-passed').textContent = t.grammarPassed;
    const list = byId('home-progress-list');
    if (list) list.innerHTML = [
      progressMarkup('Домашние задания', t.homeworkCompleted, t.homeworkTotal),
      progressMarkup('Словарный запас', t.vocabularyKnown, t.vocabularyTotal, 'rose'),
      progressMarkup('Грамматика', t.grammarPassed, t.grammarTotal, 'green')
    ].join('');
    const current = byId('current-material');
    if (current) {
      const homeworkProgress = window.ProgressService.loadHomeworkProgress();
      const currentHomework = HOMEWORK_DATA
        .filter((item) => item.status === 'available' && !homeworkProgress.completedIds.includes(item.id) && !homeworkProgress.submissions[item.id])
        .sort((a, b) => dateMs(b.publishedAt) - dateMs(a.publishedAt) || Number(b.number || 0) - Number(a.number || 0))[0];

      if (currentHomework) {
        const href = currentHomework.page || `lesson.html?id=${encodeURIComponent(currentHomework.id)}`;
        current.innerHTML = `<a class="card interactive item-card current-material-card" href="${escapeHtml(href)}">
          <div class="item-icon">✨</div>
          <div class="item-main"><h3>${escapeHtml(safeText(currentHomework.title, 'Текущее задание'))}</h3><p>${escapeHtml(safeText(currentHomework.subtitle, 'Продолжить работу с опубликованным материалом.'))}</p></div>
          <span class="status-badge status-available">Продолжить</span>
        </a>`;
      } else {
        const publishedHomework = HOMEWORK_DATA.filter((item) => ['available', 'completed'].includes(item.status));
        const everythingCompleted = publishedHomework.length > 0 && publishedHomework.every((item) => item.status === 'completed' || homeworkProgress.completedIds.includes(item.id) || Boolean(homeworkProgress.submissions[item.id]));
        current.innerHTML = everythingCompleted
          ? '<a class="card interactive item-card current-material-card" href="homework.html"><div class="item-icon">✅</div><div class="item-main"><h3>Все опубликованные материалы выполнены</h3><p>Новый материал появится после следующей публикации преподавателя.</p></div><span class="arrow" aria-hidden="true">→</span></a>'
          : '<div class="card disabled empty-state"><div class="empty-state-icon">✨</div><h3>Текущий материал пока не опубликован</h3><p>Здесь автоматически появится последнее доступное домашнее задание.</p></div>';
      }
    }

    const knowledge = byId('knowledge-list');
    if (knowledge) {
      const publishedTopics = GRAMMAR_DATA
        .filter((topic) => topic.status !== 'draft' && topic.status !== 'locked')
        .sort((a, b) => Number(b.order || 0) - Number(a.order || 0));

      if (!publishedTopics.length) {
        knowledge.innerHTML = emptyState('🧠', 'Теория пока не опубликована', 'Новые памятки и правила появятся здесь после уроков.');
      } else {
        const latestTopics = publishedTopics.slice(0, 3);
        const topicCards = latestTopics.map((topic) => {
          const state = window.ProgressService.loadGrammarProgress().topics[topic.id] || {};
          const isPassed = state.passed === true || topic.passed === true;
          const href = topic.page || `grammar-topic.html?id=${encodeURIComponent(topic.id)}`;
          const description = topic.overview?.keyRule || topic.overview?.lead || 'Памятка, примеры и мини-тест.';
          return `<a class="card interactive item-card" href="${escapeHtml(href)}">
            <div class="item-icon">${isPassed ? '✅' : '🧠'}</div>
            <div class="item-main"><h3>${escapeHtml(safeText(topic.title, 'Грамматическая тема'))}</h3><p>${escapeHtml(safeText(description, 'Памятка, примеры и мини-тест.'))}</p></div>
            <span class="status-badge status-${isPassed ? 'completed' : 'available'}">${isPassed ? 'Пройдено' : 'Открыть'}</span>
          </a>`;
        }).join('');

        knowledge.innerHTML = `${topicCards}
          <a class="card interactive item-card" href="grammar.html">
            <div class="item-icon">📐</div>
            <div class="item-main"><h3>Все темы грамматики</h3><p>Открыть полный справочник и мини-тесты по опубликованным темам.</p></div>
            <span class="arrow" aria-hidden="true">→</span>
          </a>`;
      }
    }
  }

  function renderHomework() {
    const progress = window.ProgressService.loadHomeworkProgress();
    const published = HOMEWORK_DATA.filter((item) => item.status !== 'draft');

    const isComplete = (item) => progress.completedIds.includes(item.id)
      || Boolean(progress.submissions[item.id])
      || item.status === 'completed';

    const completionTime = (item) => {
      const submission = progress.submissions[item.id] || {};
      const result = progress.results[item.id] || {};
      const candidates = [
        submission.savedAt,
        submission.submittedAt,
        result.submittedAt,
        result.updatedAt,
        item.completedAt
      ];
      for (const value of candidates) {
        const timestamp = dateMs(value);
        if (timestamp) return timestamp;
      }
      return 0;
    };

    const newestLessonFirst = (a, b) => dateMs(b.publishedAt) - dateMs(a.publishedAt)
      || Number(b.number || 0) - Number(a.number || 0);

    const completedNewestFirst = (a, b) => completionTime(b) - completionTime(a)
      || Number(b.number || 0) - Number(a.number || 0);

    const completed = published.filter(isComplete).length;
    const percent = safePercent(completed, published.length);
    byId('hw-completed').textContent = completed;
    byId('hw-total').textContent = published.length;
    byId('hw-percent').textContent = `${percent}%`;
    byId('hw-overall-progress').innerHTML = progressMarkup('Общий прогресс', completed, published.length);

    const root = byId('homework-list');
    if (!published.length) {
      root.innerHTML = emptyState('📝', 'Домашних заданий пока нет', 'После первого урока преподаватель добавит сюда интерактивное задание.');
      return;
    }

    const renderCard = (item) => {
      const locked = item.status === 'locked';
      const complete = isComplete(item);
      const lessonNumber = Number(item.number || 0);
      const numberPrefix = lessonNumber > 0 ? `Lesson ${lessonNumber} · ` : '';
      const title = locked
        ? `🔒 ${numberPrefix}Coming soon`
        : `${numberPrefix}${safeText(item.title, 'Задание')}`;
      const savedResult = progress.results[item.id];
      const scoreSuffix = savedResult && Number(savedResult.total || 0) > 0
        ? ` · Результат ${Number(savedResult.correct || 0)}/${Number(savedResult.total || 0)}`
        : '';
      const subtitle = locked
        ? 'Материал откроется после публикации преподавателем.'
        : `${safeText(item.subtitle, 'Интерактивное задание')}${scoreSuffix}`;
      const status = complete ? 'completed' : safeText(item.status, 'available');
      const label = complete ? 'Выполнено' : status === 'available' ? 'Доступно' : status === 'locked' ? 'Закрыто' : 'Черновик';
      const tag = locked ? 'div' : 'a';
      const href = locked ? '' : ` href="${escapeHtml(item.page || `lesson.html?id=${encodeURIComponent(item.id)}`)}"`;
      return `<${tag} class="card item-card ${locked ? 'disabled' : 'interactive'}"${href}>
        <div class="item-icon">${complete ? '✅' : locked ? '🔒' : '📝'}</div>
        <div class="item-main"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(subtitle)}</p></div>
        <span class="status-badge status-${escapeHtml(status)}">${escapeHtml(label)}</span>
      </${tag}>`;
    };

    const renderGroup = (title, items, tone = '') => {
      if (!items.length) return '';
      return `<section class="homework-group ${tone}" aria-label="${escapeHtml(title)}">
        <div class="homework-group-heading">
          <h3>${escapeHtml(title)}</h3>
          <span>${items.length}</span>
        </div>
        <div class="homework-group-list">${items.map(renderCard).join('')}</div>
      </section>`;
    };

    const toDo = published
      .filter((item) => !isComplete(item) && item.status !== 'locked')
      .sort(newestLessonFirst);
    const done = published
      .filter(isComplete)
      .sort(completedNewestFirst);
    const comingSoon = published
      .filter((item) => !isComplete(item) && item.status === 'locked')
      .sort((a, b) => Number(a.number || 0) - Number(b.number || 0));

    root.innerHTML = [
      renderGroup('Нужно выполнить', toDo, 'homework-group-todo'),
      renderGroup('Выполненные', done, 'homework-group-done'),
      renderGroup('Скоро', comingSoon, 'homework-group-locked')
    ].join('');
  }

  function renderGrammar() {
    const progress = window.ProgressService.loadGrammarProgress();
    const published = GRAMMAR_DATA.filter((topic) => topic.status !== 'draft');
    const passed = published.filter((topic) => progress.topics[topic.id]?.passed || topic.passed).length;
    byId('grammar-passed').textContent = passed;
    byId('grammar-total').textContent = published.length;
    byId('grammar-overall-progress').innerHTML = progressMarkup('Общий прогресс', passed, published.length, 'green');
    const root = byId('grammar-list');
    if (!published.length) {
      root.innerHTML = emptyState('📐', 'Грамматические темы пока не опубликованы', `Материалы будут добавляться в соответствии с уроками и учебником «${safeText(student.textbook)}».`);
      return;
    }
    root.innerHTML = [...published].sort((a,b) => (a.order || 0) - (b.order || 0)).map((topic) => {
      const locked = topic.status === 'locked';
      const isPassed = progress.topics[topic.id]?.passed || topic.passed;
      const title = locked ? '🔒 Coming soon' : safeText(topic.title, 'Грамматическая тема');
      const tag = locked ? 'div' : 'a';
      const href = locked ? '' : ` href="${escapeHtml(topic.page || `grammar-topic.html?id=${encodeURIComponent(topic.id)}`)}"`;
      return `<${tag} class="card item-card ${locked ? 'disabled' : 'interactive'}"${href}>
        <div class="item-icon">${isPassed ? '✅' : locked ? '🔒' : '📐'}</div>
        <div class="item-main"><h3>${escapeHtml(title)}</h3><p>${locked ? 'Материал ещё не опубликован.' : `${escapeHtml(topic.level || student.level)} · ${Number(progress.topics[topic.id]?.attempts || topic.attempts || 0)} попыток`}</p></div>
        <span class="status-badge status-${isPassed ? 'completed' : locked ? 'locked' : 'available'}">${isPassed ? 'Пройдено' : locked ? 'Закрыто' : 'Открыть'}</span>
      </${tag}>`;
    }).join('');
  }

  function renderVocabularyHub() {
    const progress = window.ProgressService.loadVocabularyProgress();
    const totalWords = VOCABULARY_CATALOG.allWords.length;
    const knownCount = effectiveKnownTotal(progress);
    byId('vocab-known').textContent = knownCount;
    byId('vocab-total').textContent = totalWords;
    byId('vocab-topics').textContent = VOCABULARY_DATA.length;
    byId('vocab-percent').textContent = `${safePercent(knownCount, totalWords)}%`;
    byId('vocab-overall-progress').innerHTML = progressMarkup('Общий прогресс', knownCount, totalWords, 'rose');
    const root = byId('vocabulary-list');
    const filters = byId('vocab-filters');

    const draw = (filter = 'all') => {
      const filtered = VOCABULARY_DATA.filter((topic) => {
        const topicKnown = effectiveKnownCountForTopic(progress, topic);
        const complete = topic.words.length > 0 && topicKnown >= topic.words.length;
        if (filter === 'completed') return complete;
        if (filter === 'lesson') return topic.type === 'lesson';
        if (filter === 'extra') return topic.type === 'extra';
        return true;
      });
      if (!filtered.length) {
        root.innerHTML = emptyState('💥', 'Словарных тренажёров пока нет', 'Новые темы появятся после уроков. Повторяющиеся слова автоматически исключаются.');
        return;
      }
      root.innerHTML = filtered.map((topic) => {
        const wordCount = topic.words.length;
        const topicKnown = effectiveKnownCountForTopic(progress, topic);
        const complete = wordCount > 0 && topicKnown >= wordCount;
        return `<a class="card item-card interactive" href="${escapeHtml(topic.page || `vocabulary.html?id=${encodeURIComponent(topic.id)}`)}">
          <div class="item-icon">${escapeHtml(topic.icon || '💬')}</div>
          <div class="item-main"><h3>${escapeHtml(topic.title || 'Словарная тема')}</h3><p>${escapeHtml(topic.label || '')} · ${topicKnown} из ${wordCount} слов</p></div>
          <span class="status-badge status-${complete ? 'completed' : 'available'}">${complete ? 'Завершено' : 'Открыть'}</span>
        </a>`;
      }).join('');
    };
    if (filters) {
      filters.onclick = (event) => {
        const button = event.target.closest('[data-filter]');
        if (!button) return;
        filters.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
        draw(button.dataset.filter);
      };
    }
    draw();
  }

  function renderReadingSections(block) {
    const sections = Array.isArray(block.sections) ? block.sections : [];
    if (!sections.length) {
      const text = escapeHtml(block.text || '').replaceAll('\n', '<br>');
      return `<div class="reading-copy-wrap"><p class="reading-copy">${text}</p></div>`;
    }
    return `<div class="reading-sections">${sections.map((section) => `<section class="reading-section">
      <div class="reading-section-heading"><span class="reading-number">${escapeHtml(section.number || '')}</span><h4>${escapeHtml(section.heading || '')}</h4></div>
      <p class="reading-section-copy">${escapeHtml(section.text || '')}</p>
    </section>`).join('')}</div>`;
  }

  function renderExerciseItem(item, blockId, index) {
    const itemId = safeText(item.id, `${index + 1}`);
    const number = item.number === undefined ? index + 1 : item.number;
    const prompt = escapeHtml(item.prompt || '').replaceAll('\n', '<br>');
    const inputId = `exercise-${blockId}-${itemId}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    const numberMarkup = number === '' || number === null ? '' : `<span class="exercise-number">${escapeHtml(number)}</span>`;

    if (item.example) {
      return `<div class="exercise-item exercise-example" data-exercise-item="${escapeHtml(itemId)}">
        <div class="exercise-item-header">${numberMarkup}<div class="exercise-prompt">${prompt}</div></div>
        <div class="example-answer"><span>Example</span><strong>${escapeHtml(item.exampleAnswer || '')}</strong></div>
      </div>`;
    }

    let control = '';
    if (item.input === 'stress-chart') {
      const columns = Array.isArray(item.columns) ? item.columns : [];
      control = `<div class="stress-chart">${columns.map((column, columnIndex) => `<label class="stress-chart-column">
        <span class="stress-chart-heading">${escapeHtml(column.label || '')}</span>
        ${column.example ? `<span class="stress-chart-example"><small>Example</small><strong>${escapeHtml(column.example)}</strong></span>` : ''}
        <textarea class="stress-chart-input" data-stress-column="${columnIndex}" autocomplete="off" spellcheck="false" aria-label="${escapeHtml(column.label || `Column ${columnIndex + 1}`)}"></textarea>
      </label>`).join('')}</div>`;
    } else if (item.input === 'multiple' || item.input === 'single') {
      const inputType = item.input === 'multiple' ? 'checkbox' : 'radio';
      control = `<div class="option-list compact-options">${(item.options || []).map((option, optionIndex) => `<label class="option"><input type="${inputType}" name="${escapeHtml(inputId)}" value="${optionIndex}"><span>${escapeHtml(option)}</span></label>`).join('')}</div>`;
    } else if (item.input === 'select') {
      control = `<select id="${escapeHtml(inputId)}"><option value="">Choose an answer</option>${(item.options || []).map((option, optionIndex) => `<option value="${optionIndex}">${escapeHtml(option)}</option>`).join('')}</select>`;
    } else if (item.input === 'textarea') {
      control = `<textarea id="${escapeHtml(inputId)}" placeholder="${escapeHtml(item.placeholder || '')}"></textarea>`;
    } else if (item.input === 'gaps') {
      const answers = Array.isArray(item.answers) ? item.answers : [];
      const segments = Array.isArray(item.segments) ? item.segments : [];
      const renderGapSegment = (segment) => escapeHtml(segment || '').replaceAll('\n', '<br>');
      control = `<div class="sentence-gaps" aria-label="${prompt}">${answers.map((answer, gapIndex) => `${gapIndex < segments.length ? `<span>${renderGapSegment(segments[gapIndex])}</span>` : ''}<input class="gap-input" data-gap-index="${gapIndex}" aria-label="Gap ${gapIndex + 1}" autocomplete="off">`).join('')}${segments.length > answers.length ? `<span>${renderGapSegment(segments[segments.length - 1])}</span>` : ''}</div>`;
    } else {
      control = `<input class="text-field" id="${escapeHtml(inputId)}" autocomplete="off" placeholder="${escapeHtml(item.placeholder || '')}">`;
    }

    return `<div class="exercise-item" data-exercise-item="${escapeHtml(itemId)}" data-input-type="${escapeHtml(item.input || 'text')}">
      <div class="exercise-item-header">${numberMarkup}<label class="exercise-prompt" for="${escapeHtml(inputId)}">${prompt}</label></div>
      <div class="exercise-control">${control}</div>
      <div class="feedback" aria-live="polite"></div>
    </div>`;
  }

  function renderLessonBlock(block, index) {
    const id = safeText(block.id, `task-${index}`);
    const title = escapeHtml(block.title || block.prompt || `Задание ${index + 1}`);
    const text = escapeHtml(block.text || '').replaceAll('\n', '<br>');

    if (block.type === 'section') {
      return `<header id="lesson-section-${index}" class="lesson-section-title lesson-block" data-lesson-section><span class="lesson-section-step">${escapeHtml(block.__sectionNumber || index + 1)}</span><div><span class="eyebrow">${escapeHtml(block.eyebrow || 'Материал')}</span><h2>${title}</h2>${text ? `<p class="muted">${text}</p>` : ''}</div></header>`;
    }
    if (block.type === 'info') return `<article class="card info-card lesson-block"><h3>${title}</h3><p>${text}</p></article>`;
    if (block.type === 'grammar-link') {
      const href = escapeHtml(block.href || 'grammar.html');
      return `<a class="card lesson-block grammar-link-card interactive" href="${href}">
        <span class="grammar-link-icon" aria-hidden="true">📐</span>
        <span class="grammar-link-copy"><span class="eyebrow">Grammar</span><strong>${title}</strong>${text ? `<span>${text}</span>` : ''}</span>
        <span class="grammar-link-action">${escapeHtml(block.label || 'Открыть тему')} →</span>
      </a>`;
    }
    if (block.type === 'tip') return `<article class="card tip-card lesson-block"><h3>${title}</h3><p>${text}</p></article>`;
    if (block.type === 'reading') {
      const sectionCount = Array.isArray(block.sections) ? block.sections.length : 0;
      return `<article class="card lesson-block reading-card"><div class="reading-title"><div><span class="eyebrow">Reading</span><h3>${title}</h3></div>${sectionCount ? `<span class="reading-count">${sectionCount} sections</span>` : ''}</div>${renderReadingSections(block)}</article>`;
    }
    if (block.type === 'exercise') {
      const items = Array.isArray(block.items) ? block.items : [];
      const wordBank = Array.isArray(block.wordBank) && block.wordBank.length
        ? `<div class="word-bank" aria-label="Word bank"><strong class="word-bank-label">Word bank</strong>${block.wordBank.map((word) => `<span>${escapeHtml(word)}</span>`).join('')}</div>`
        : '';
      const player = block.audio ? `<audio class="audio-player" controls preload="none" src="${escapeHtml(block.audio)}"></audio>` : '';
      const exerciseImage = block.image ? `<figure class="exercise-source-image"><img src="${escapeHtml(block.image)}" alt="${escapeHtml(block.imageAlt || '')}" loading="lazy" decoding="async"></figure>` : '';
      const exerciseItems = `<div class="exercise-items">${items.map((item, itemIndex) => renderExerciseItem(item, id, itemIndex)).join('')}</div>`;
      const exerciseBody = block.stickyImage && exerciseImage
        ? `<div class="exercise-with-sticky-media">${exerciseImage}${exerciseItems}</div>`
        : `${exerciseImage}${exerciseItems}`;
      return `<article class="card lesson-block exercise-card${block.stickyImage ? ' exercise-card-sticky' : ''}" data-task="${escapeHtml(id)}" data-type="exercise">
        <div class="exercise-heading"><span class="eyebrow">Exercise</span><h3>${title}</h3>${block.instructions ? `<p class="muted exercise-instructions">${escapeHtml(block.instructions)}</p>` : ''}${player}${wordBank}</div>
        ${exerciseBody}
      </article>`;
    }
    if (block.type === 'text' || block.type === 'translate') return `<article class="card lesson-block" data-task="${escapeHtml(id)}" data-type="${escapeHtml(block.type)}"><label class="field-label" for="${escapeHtml(id)}">${title}</label>${block.source ? `<p class="muted">${escapeHtml(block.source)}</p>` : ''}<input class="text-field" id="${escapeHtml(id)}" name="${escapeHtml(id)}" autocomplete="off"><div class="feedback"></div></article>`;
    if (block.type === 'textarea') return `<article class="card lesson-block" data-task="${escapeHtml(id)}" data-type="textarea"><label class="field-label" for="${escapeHtml(id)}">${title}</label><textarea id="${escapeHtml(id)}" name="${escapeHtml(id)}"></textarea><div class="feedback"></div></article>`;
    if (block.type === 'single' || block.type === 'multiple') {
      const inputType = block.type === 'single' ? 'radio' : 'checkbox';
      const options = (block.options || []).map((option, optionIndex) => `<label class="option"><input type="${inputType}" name="${escapeHtml(id)}" value="${optionIndex}"><span>${escapeHtml(option)}</span></label>`).join('');
      return `<article class="card lesson-block" data-task="${escapeHtml(id)}" data-type="${escapeHtml(block.type)}"><h3>${title}</h3><div class="option-list">${options}</div><div class="feedback"></div></article>`;
    }
    if (block.type === 'select') {
      const options = (block.options || []).map((option, optionIndex) => `<option value="${optionIndex}">${escapeHtml(option)}</option>`).join('');
      return `<article class="card lesson-block" data-task="${escapeHtml(id)}" data-type="select"><label class="field-label" for="${escapeHtml(id)}">${title}</label><select id="${escapeHtml(id)}"><option value="">Выберите ответ</option>${options}</select><div class="feedback"></div></article>`;
    }
    if (block.type === 'match') {
      const rights = (block.pairs || []).map((pair) => pair.right);
      const rows = (block.pairs || []).map((pair, pairIndex) => `<div>${escapeHtml(pair.left)}</div><select data-match-index="${pairIndex}"><option value="">Выберите пару</option>${rights.map((right, rightIndex) => `<option value="${rightIndex}">${escapeHtml(right)}</option>`).join('')}</select>`).join('');
      return `<article class="card lesson-block" data-task="${escapeHtml(id)}" data-type="match"><h3>${title}</h3><div class="match-grid">${rows}</div><div class="feedback"></div></article>`;
    }
    if (block.type === 'reorder') {
      const chips = shuffled(block.words || []).map((word) => `<button class="word-chip" type="button" data-word="${escapeHtml(word)}">${escapeHtml(word)}</button>`).join('');
      return `<article class="card lesson-block" data-task="${escapeHtml(id)}" data-type="reorder"><h3>${title}</h3><div class="word-chips" data-reorder-source>${chips}</div><label class="field-label" for="${escapeHtml(id)}">Собранный ответ</label><input class="text-field" id="${escapeHtml(id)}" readonly><div class="feedback"></div></article>`;
    }
    if (block.type === 'audio') {
      const player = block.audio ? `<audio class="audio-player" controls preload="none" src="${escapeHtml(block.audio)}"></audio>` : '<p class="muted">Аудиофайл ещё не прикреплён.</p>';
      const response = block.response === false ? '' : `<input class="text-field" id="${escapeHtml(id)}" aria-label="Ответ на аудиозадание"><div class="feedback"></div>`;
      const taskAttrs = block.response === false ? '' : ` data-task="${escapeHtml(id)}" data-type="audio"`;
      return `<article class="card lesson-block audio-card"${taskAttrs}><div class="audio-icon" aria-hidden="true">🎧</div><div class="audio-content"><h3>${title}</h3>${text ? `<p class="muted">${text}</p>` : ''}${player}${response}</div></article>`;
    }
    return '';
  }

  function normalizeAnswer(value) {
    return safeText(value)
      .normalize('NFKC')
      .replace(/[’‘`]/g, "'")
      .trim()
      .toLocaleLowerCase('en')
      .replace(/[.!?,;:]+$/g, '')
      .replace(/\s+/g, ' ');
  }

  function textAnswerMatches(item, actual) {
    const accepted = Array.isArray(item.acceptedAnswers) && item.acceptedAnswers.length
      ? item.acceptedAnswers
      : Array.isArray(item.answer) ? item.answer : [item.answer];
    return accepted.some((answer) => normalizeAnswer(answer) !== '' && normalizeAnswer(answer) === normalizeAnswer(actual));
  }

  function checkExerciseItem(item, itemNode) {
    const inputType = item.input || 'text';
    let actual;
    let correct = false;

    if (inputType === 'stress-chart') {
      const columns = Array.isArray(item.columns) ? item.columns : [];
      const normalizedColumns = columns.map((column) => ({
        expected: new Set((Array.isArray(column.answers) ? column.answers : []).map(normalizeAnswer).filter(Boolean)),
        example: normalizeAnswer(column.example || '')
      }));
      const actualColumns = [...itemNode.querySelectorAll('[data-stress-column]')].map((input) => {
        const words = safeText(input.value).split(/[\s,;]+/).map(normalizeAnswer).filter(Boolean);
        return new Set(words);
      });
      actual = {};
      itemNode.querySelectorAll('[data-stress-column]').forEach((input, columnIndex) => {
        actual[columnIndex] = input.value;
      });

      let correctCount = 0;
      let total = 0;
      normalizedColumns.forEach((column, columnIndex) => {
        total += column.expected.size;
        column.expected.forEach((word) => {
          const inCorrectColumn = actualColumns[columnIndex]?.has(word);
          const inWrongColumn = actualColumns.some((set, otherIndex) => otherIndex !== columnIndex && set.has(word));
          if (inCorrectColumn && !inWrongColumn) correctCount += 1;
        });
      });
      const targetWords = new Set(normalizedColumns.flatMap((column) => [...column.expected]));
      const exampleWords = new Set(normalizedColumns.map((column) => column.example).filter(Boolean));
      const enteredWords = actualColumns.flatMap((set) => [...set]).filter((word) => !exampleWords.has(word));
      const hasUnexpected = enteredWords.some((word) => !targetWords.has(word));
      const hasDuplicate = enteredWords.some((word, index) => enteredWords.indexOf(word) !== index);
      correct = total > 0 && correctCount === total && !hasUnexpected && !hasDuplicate;
      if (!correct && correctCount === total) correctCount = Math.max(0, total - 1);
      return { actual, correct, correctCount, total };
    }

    if (inputType === 'multiple') {
      actual = [...itemNode.querySelectorAll('input:checked')].map((input) => Number(input.value)).sort((a, b) => a - b);
      const expected = [...(item.answer || [])].map(Number).sort((a, b) => a - b);
      correct = JSON.stringify(actual) === JSON.stringify(expected);
    } else if (inputType === 'single') {
      actual = itemNode.querySelector('input:checked')?.value ?? '';
      correct = Number(actual) === Number(item.answer);
    } else if (inputType === 'select') {
      actual = itemNode.querySelector('select')?.value ?? '';
      correct = actual !== '' && Number(actual) === Number(item.answer);
    } else if (inputType === 'gaps') {
      const inputs = [...itemNode.querySelectorAll('[data-gap-index]')];
      actual = inputs.map((input) => input.value);
      const expected = Array.isArray(item.answers) ? item.answers : [];
      const gapResults = expected.map((answer, index) => {
        const accepted = Array.isArray(answer) ? answer : [answer];
        return accepted.some((variant) => normalizeAnswer(variant) !== '' && normalizeAnswer(variant) === normalizeAnswer(actual[index]));
      });
      correct = expected.length > 0 && gapResults.length === expected.length && gapResults.every(Boolean);
      if (item.scoreByGap === true) {
        inputs.forEach((input, index) => {
          input.classList.toggle('is-valid', Boolean(gapResults[index]));
          input.classList.toggle('is-invalid', !gapResults[index]);
        });
        return {
          actual,
          correct,
          correctCount: gapResults.filter(Boolean).length,
          total: expected.length
        };
      }
    } else {
      actual = itemNode.querySelector('input, textarea')?.value || '';
      correct = textAnswerMatches(item, actual);
    }

    return { actual, correct };
  }

  function checkExerciseBlock(block, node) {
    const actual = {};
    let correctCount = 0;
    let total = 0;

    (Array.isArray(block.items) ? block.items : []).forEach((item, index) => {
      if (item.example) return;
      const itemId = safeText(item.id, `${index + 1}`);
      const itemNode = node.querySelector(`[data-exercise-item="${CSS.escape(itemId)}"]`);
      if (!itemNode) return;
      const result = checkExerciseItem(item, itemNode);
      actual[itemId] = result.actual;
      const feedback = itemNode.querySelector('.feedback');

      if (item.scored === false) {
        itemNode.classList.remove('is-correct', 'is-wrong');
        itemNode.classList.add('is-saved');
        if (feedback) {
          feedback.className = 'feedback show neutral';
          feedback.textContent = 'Ответ сохранён для преподавателя.';
        }
        return;
      }

      const itemTotal = Number.isFinite(Number(result.total)) && Number(result.total) > 0 ? Number(result.total) : 1;
      const itemCorrectCount = Number.isFinite(Number(result.correctCount)) ? Number(result.correctCount) : (result.correct ? 1 : 0);
      total += itemTotal;
      correctCount += itemCorrectCount;
      itemNode.classList.toggle('is-correct', result.correct);
      itemNode.classList.toggle('is-wrong', !result.correct);
      itemNode.classList.remove('is-saved');
      if (feedback) {
        feedback.className = `feedback show ${result.correct ? 'good' : 'bad'}`;
        feedback.textContent = result.correct ? 'Верно!' : safeText(item.explanation, 'Проверь ответ и попробуй ещё раз.');
      }
    });

    return { actual, correctCount, total };
  }

  function checkLessonTask(block, node) {
    if (block.type === 'exercise') return checkExerciseBlock(block, node);
    let actual;
    let correct = false;
    if (block.type === 'single') {
      actual = node.querySelector('input:checked')?.value;
      correct = Number(actual) === Number(block.answer);
    } else if (block.type === 'multiple') {
      actual = [...node.querySelectorAll('input:checked')].map((input) => Number(input.value)).sort((a,b) => a-b);
      const expected = [...(block.answer || [])].map(Number).sort((a,b) => a-b);
      correct = JSON.stringify(actual) === JSON.stringify(expected);
    } else if (block.type === 'select') {
      actual = node.querySelector('select')?.value;
      correct = Number(actual) === Number(block.answer);
    } else if (block.type === 'match') {
      actual = [...node.querySelectorAll('[data-match-index]')].map((select) => Number(select.value));
      correct = actual.length > 0 && actual.every((value, index) => value === index);
    } else {
      actual = node.querySelector('input, textarea')?.value || '';
      if (Array.isArray(block.answer)) correct = block.answer.some((answer) => normalizeAnswer(answer) === normalizeAnswer(actual));
      else correct = normalizeAnswer(block.answer) !== '' && normalizeAnswer(block.answer) === normalizeAnswer(actual);
    }
    return { correctCount: correct ? 1 : 0, total: 1, actual };
  }

  function restoreExerciseAnswers(block, node, saved) {
    if (!saved || typeof saved !== 'object') return;
    (Array.isArray(block.items) ? block.items : []).forEach((item, index) => {
      if (item.example) return;
      const itemId = safeText(item.id, `${index + 1}`);
      const value = saved[itemId];
      if (value === undefined) return;
      const itemNode = node.querySelector(`[data-exercise-item="${CSS.escape(itemId)}"]`);
      if (!itemNode) return;
      const inputType = item.input || 'text';
      if (inputType === 'stress-chart') {
        const values = value && typeof value === 'object' ? value : {};
        itemNode.querySelectorAll('[data-stress-column]').forEach((input, columnIndex) => {
          input.value = safeText(values[columnIndex]);
        });
      } else if (inputType === 'multiple') {
        const selected = new Set(Array.isArray(value) ? value.map(Number) : []);
        itemNode.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = selected.has(Number(input.value)); });
      } else if (inputType === 'single') {
        const input = itemNode.querySelector(`input[value="${CSS.escape(safeText(value))}"]`);
        if (input) input.checked = true;
      } else if (inputType === 'select') {
        const select = itemNode.querySelector('select');
        if (select) select.value = safeText(value);
      } else if (inputType === 'gaps') {
        const values = Array.isArray(value) ? value : [];
        itemNode.querySelectorAll('[data-gap-index]').forEach((input, gapIndex) => { input.value = safeText(values[gapIndex]); });
      } else {
        const input = itemNode.querySelector('input, textarea');
        if (input) input.value = safeText(value);
      }
    });
  }

  function restoreLessonAnswers(root, blocks, savedAnswers) {
    if (!savedAnswers || typeof savedAnswers !== 'object') return;
    blocks.forEach((block, index) => {
      const taskId = safeText(block.id, `task-${index}`);
      const value = savedAnswers[taskId];
      if (value === undefined) return;
      const node = root.querySelector(`[data-task="${CSS.escape(taskId)}"]`);
      if (!node) return;
      if (block.type === 'exercise') {
        restoreExerciseAnswers(block, node, value);
      } else if (block.type === 'single') {
        const input = node.querySelector(`input[value="${CSS.escape(safeText(value))}"]`);
        if (input) input.checked = true;
      } else if (block.type === 'multiple') {
        const selected = new Set(Array.isArray(value) ? value.map(Number) : []);
        node.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = selected.has(Number(input.value)); });
      } else if (block.type === 'select') {
        const select = node.querySelector('select');
        if (select) select.value = safeText(value);
      } else if (block.type === 'match') {
        const values = Array.isArray(value) ? value : [];
        node.querySelectorAll('[data-match-index]').forEach((select, matchIndex) => { select.value = safeText(values[matchIndex]); });
      } else {
        const input = node.querySelector('input, textarea');
        if (input) input.value = safeText(value);
      }
    });
  }

  function showLessonTaskResult(block, node, result) {
    if (block.type === 'exercise') return;
    const total = Number(result.total || 0);
    const correctCount = Number(result.correctCount || 0);
    const isCorrect = total > 0 && correctCount === total;
    node.classList.toggle('is-correct', isCorrect);
    node.classList.toggle('is-wrong', !isCorrect);
    const feedback = node.querySelector('.feedback');
    if (feedback) {
      feedback.className = `feedback show ${isCorrect ? 'good' : 'bad'}`;
      feedback.textContent = isCorrect ? 'Верно!' : safeText(block.explanation, 'В ответе есть ошибка.');
    }
  }

  function reviewRestoredLesson(root, blocks) {
    const checkableTypes = ['text','textarea','single','multiple','select','match','reorder','translate','audio','exercise'];
    blocks
      .filter((block) => checkableTypes.includes(block.type) && !(block.type === 'audio' && block.response === false))
      .forEach((block, index) => {
        const taskId = safeText(block.id, `task-${index}`);
        const node = root.querySelector(`[data-task="${CSS.escape(taskId)}"]`);
        if (!node) return;
        const result = checkLessonTask(block, node);
        showLessonTaskResult(block, node, result);
      });
  }

  function lockCompletedLesson(root) {
    root.classList.add('lesson-is-locked');
    root.querySelectorAll('input, textarea').forEach((control) => {
      if (control.type === 'radio' || control.type === 'checkbox') {
        control.disabled = true;
      } else {
        control.readOnly = true;
        control.setAttribute('aria-readonly', 'true');
      }
    });
    root.querySelectorAll('select, button[data-word]').forEach((control) => {
      control.disabled = true;
    });
  }

  async function renderLesson() {
    const id = queryParam('id');
    const lessonRecord = HOMEWORK_DATA.find((item) => item.id === id && item.status !== 'draft');
    const root = byId('lesson-root');
    if (!lessonRecord || lessonRecord.status === 'locked') {
      root.innerHTML = emptyState('📝', 'Задание ещё не опубликовано', 'Преподаватель добавит материал после урока.');
      return;
    }

    byId('lesson-hero-title').textContent = safeText(lessonRecord.title, 'Задание');
    byId('lesson-hero-subtitle').textContent = safeText(lessonRecord.subtitle, 'Интерактивная практика');
    root.innerHTML = '<div class="card empty-state compact-empty"><div class="empty-state-icon">⏳</div><h3>Загружаем задание…</h3></div>';

    let lesson;
    try {
      lesson = await resolveLessonContent(lessonRecord);
    } catch (error) {
      console.error('Ошибка загрузки содержимого урока:', error);
      root.innerHTML = emptyState('⚠️', 'Не удалось загрузить задание', 'Проверьте наличие JSON-файла урока в папке data/lessons и корректность его структуры.');
      return;
    }

    const blocks = Array.isArray(lesson?.blocks) ? lesson.blocks : [];
    if (!blocks.length) {
      root.innerHTML = emptyState('📝', 'Задание ещё не опубликовано', 'Содержание появится после подготовки преподавателем.');
      return;
    }

    const progress = window.ProgressService.loadHomeworkProgress();
    const savedResult = progress.results[lesson.id];
    const isCompleted = progress.completedIds.includes(lesson.id)
      || Boolean(progress.submissions[lesson.id])
      || lessonRecord.status === 'completed';
    const pointsLabel = Number(lesson.totalPoints || 0) > 0 ? `${escapeHtml(lesson.totalPoints)} проверяемых ответов` : 'Без автоматической оценки';
    const hasManualResponses = blocks.some((block) => block.type === 'exercise' && (block.items || []).some((item) => item.scored === false));
    const lessonSections = blocks
      .map((block, blockIndex) => block.type === 'section' ? { block, blockIndex } : null)
      .filter(Boolean);
    const roadmap = lessonSections.length
      ? `<nav class="card lesson-roadmap" aria-label="План домашнего задания"><div class="lesson-roadmap-heading"><span class="eyebrow">План задания</span><p>Проходи блоки по порядку — ответы сохранятся после проверки.</p></div><ol>${lessonSections.map(({ block, blockIndex }, sectionIndex) => `<li><a href="#lesson-section-${blockIndex}"><span>${sectionIndex + 1}</span><strong>${escapeHtml(block.title || `Часть ${sectionIndex + 1}`)}</strong></a></li>`).join('')}</ol></nav>`
      : '';
    let sectionNumber = 0;
    const renderedBlocks = blocks.map((block, blockIndex) => {
      if (block.type === 'section') sectionNumber += 1;
      return renderLessonBlock(block.type === 'section' ? { ...block, __sectionNumber: sectionNumber } : block, blockIndex);
    }).join('');
    const actionsMarkup = isCompleted
      ? `<div class="card section lesson-actions lesson-completed-panel"><div id="lesson-result" aria-live="polite"></div><div class="completed-lock-message"><span class="completed-lock-icon" aria-hidden="true">🔒</span><div><h3>Работа выполнена</h3><p class="muted">Ответы проверены и заблокированы. Изменить или стереть их уже нельзя.</p></div></div></div>`
      : `<div class="card section lesson-actions"><div id="lesson-result" aria-live="polite"></div><div class="button-row"><button class="btn btn-primary" id="check-lesson" type="button">Проверить ответы</button><button class="btn btn-secondary" id="submit-lesson" type="button" ${savedResult ? '' : 'disabled'}>Отправить преподавателю</button></div><p class="muted save-note">После проверки ответы сохраняются на устройстве и сразу синхронизируются с Supabase.</p></div>`;
    root.innerHTML = `<div class="card lesson-intro"><div><span class="eyebrow">Домашнее задание</span><p>${escapeHtml(lesson.subtitle || '')}</p></div><span class="lesson-points">${pointsLabel}</span></div>
      ${roadmap}
      <div id="lesson-blocks">${renderedBlocks}</div>
      ${actionsMarkup}`;

    const restoredAnswers = mergeLessonAnswers(
      convertLegacyHomeworkAnswers(lesson.id, savedResult?.legacyAnswers, lesson),
      savedResult?.answers
    );
    restoreLessonAnswers(root, blocks, restoredAnswers);
    if (savedResult && Number(savedResult.total) > 0) {
      byId('lesson-result').innerHTML = `<h3>Сохранённый результат: ${Number(savedResult.correct || 0)} из ${Number(savedResult.total || 0)}</h3><p class="muted">${Number(savedResult.percent || 0)}% правильных ответов</p>`;
    }
    if (savedResult) reviewRestoredLesson(root, blocks);
    if (isCompleted) lockCompletedLesson(root);

    root.querySelectorAll('[data-reorder-source]').forEach((source) => {
      source.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-word]');
        if (!chip) return;
        chip.classList.toggle('selected');
        const parent = source.closest('[data-task]');
        const input = parent.querySelector('input');
        const selected = [...source.querySelectorAll('.selected')].map((item) => item.dataset.word);
        input.value = selected.join(' ');
      });
    });

    const checkLessonButton = byId('check-lesson');
    if (checkLessonButton) checkLessonButton.addEventListener('click', () => {
      const checkableTypes = ['text','textarea','single','multiple','select','match','reorder','translate','audio','exercise'];
      const checkable = blocks.filter((block) => checkableTypes.includes(block.type) && !(block.type === 'audio' && block.response === false));
      let correct = 0;
      let total = 0;
      const answers = {};
      checkable.forEach((block, index) => {
        const taskId = safeText(block.id, `task-${index}`);
        const node = root.querySelector(`[data-task="${CSS.escape(taskId)}"]`);
        if (!node) return;
        const result = checkLessonTask(block, node);
        answers[taskId] = result.actual;
        correct += Number(result.correctCount || 0);
        total += Number(result.total || 0);
        if (block.type !== 'exercise') {
          showLessonTaskResult(block, node, result);
        }
      });
      const percent = safePercent(correct, total);
      const manualNote = hasManualResponses ? ' · развёрнутый ответ сохранён отдельно и не входит в балл' : '';
      byId('lesson-result').innerHTML = `<h3>Результат: ${correct} из ${total}</h3><p class="muted">${percent}% правильных ответов${manualNote}</p>`;
      const updatedProgress = window.ProgressService.loadHomeworkProgress();
      updatedProgress.results[lesson.id] = {
        correct,
        total,
        percent,
        answers,
        legacyAnswers: savedResult?.legacyAnswers || null,
        migratedAt: savedResult?.migratedAt || null,
        checkedAt: new Date().toISOString()
      };
      window.ProgressService.saveHomeworkProgress(updatedProgress);
      byId('submit-lesson').disabled = false;
    });
    const submitLessonButton = byId('submit-lesson');
    if (submitLessonButton) submitLessonButton.addEventListener('click', () => {
      const updatedProgress = window.ProgressService.loadHomeworkProgress();
      updatedProgress.submissions[lesson.id] = { savedAt: new Date().toISOString(), status: CloudService.isConfigured() ? 'pending-cloud' : 'local' };
      if (!updatedProgress.completedIds.includes(lesson.id)) updatedProgress.completedIds.push(lesson.id);
      window.ProgressService.saveHomeworkProgress(updatedProgress);
      showToast(CloudService.isConfigured() ? 'Ответы сохранены и отправляются в Supabase.' : 'Ответы сохранены на устройстве.');
      lockCompletedLesson(root);
      const actions = root.querySelector('.lesson-actions');
      if (actions) {
        actions.classList.add('lesson-completed-panel');
        actions.innerHTML = `<div id="lesson-result" aria-live="polite"><h3>Работа отправлена</h3><p class="muted">Ответы сохранены и больше не редактируются.</p></div><div class="completed-lock-message"><span class="completed-lock-icon" aria-hidden="true">🔒</span><div><h3>Работа выполнена</h3><p class="muted">Ответы проверены и заблокированы. Изменить или стереть их уже нельзя.</p></div></div>`;
      }
    });
  }

  function grammarTable(table) {
    if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows)) return '';
    return `<div class="table-wrap"><table><thead><tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function grammarProgressState(topic) {
    const progress = window.ProgressService.loadGrammarProgress();
    return {
      progress,
      state: progress.topics[topic.id] || {}
    };
  }

  function grammarStatusMarkup(topic, state, questionCount = 4) {
    const passed = Boolean(state.passed || topic.passed);
    const attempts = Math.max(0, Number(state.attempts || 0));
    const bestScore = Math.max(0, Number(state.bestScore || 0));
    const total = Math.max(1, Number(questionCount || 4));

    return `<div class="grammar-status-card ${passed ? 'is-passed' : ''}" id="grammar-topic-status">
      <div class="grammar-status-icon" aria-hidden="true">${passed ? '✓' : '◎'}</div>
      <div class="grammar-status-copy">
        <strong>${passed ? 'Тема пройдена' : 'Тема ещё не пройдена'}</strong>
        <span>${passed
          ? `Лучший результат: ${bestScore}% · попыток: ${attempts}`
          : attempts
            ? `Лучший результат: ${bestScore}% · попыток: ${attempts}`
            : `Изучи объяснение и выполни мини-тест из ${total} заданий.`}</span>
      </div>
      <span class="grammar-status-badge">${passed ? 'Засчитано' : `Нужно ${total} / ${total}`}</span>
    </div>`;
  }

  function grammarQuestionType(question) {
    return safeText(question.type || 'single').toLowerCase();
  }

  function renderGrammarQuestionInput(question, index) {
    const type = grammarQuestionType(question);
    const options = Array.isArray(question.options) ? question.options : [];

    if (type === 'select') {
      return `<label class="grammar-select-wrap">
        <span class="field-label">Выбери один вариант</span>
        <select class="grammar-select" data-grammar-control>
          <option value="">Выберите ответ</option>
          ${options.map((option, optionIndex) => `<option value="${optionIndex}">${escapeHtml(option)}</option>`).join('')}
        </select>
      </label>`;
    }

    if (type === 'multiple') {
      return `<p class="grammar-multiple-note">Можно выбрать несколько вариантов.</p>
        <div class="option-list">${options.map((option, optionIndex) => `<label class="option grammar-option">
          <input type="checkbox" name="grammar-${index}" value="${optionIndex}" data-grammar-control>
          <span>${escapeHtml(option)}</span>
        </label>`).join('')}</div>`;
    }

    if (type === 'text') {
      return `<label class="grammar-text-wrap">
        <span class="field-label">Write your sentence</span>
        <input class="grammar-text-input" type="text" autocomplete="off" spellcheck="false" data-grammar-control placeholder="${escapeHtml(question.placeholder || '')}">
      </label>`;
    }

    if (type === 'gaps') {
      const segments = Array.isArray(question.segments) ? question.segments : [];
      const answerCount = Array.isArray(question.answers) ? question.answers.length : Math.max(0, segments.length - 1);
      if (!segments.length || !answerCount) return '';
      let sentence = '';
      for (let gapIndex = 0; gapIndex < answerCount; gapIndex += 1) {
        sentence += `${escapeHtml(segments[gapIndex] || '')}<input class="grammar-gap-input" type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="8" data-grammar-gap="${gapIndex}" data-grammar-control aria-label="Пропуск ${gapIndex + 1}">`;
      }
      sentence += escapeHtml(segments[answerCount] || '');
      return `<div class="grammar-gap-sentence">${sentence}</div>`;
    }

    return `<div class="option-list">${options.map((option, optionIndex) => `<label class="option grammar-option">
      <input type="radio" name="grammar-${index}" value="${optionIndex}" data-grammar-control>
      <span>${escapeHtml(option)}</span>
    </label>`).join('')}</div>`;
  }

  function grammarQuestionAnswered(question, node) {
    const type = grammarQuestionType(question);
    if (type === 'select') return (node.querySelector('select')?.value || '') !== '';
    if (type === 'multiple') return Boolean(node.querySelector('input:checked'));
    if (type === 'text') return normalizeAnswer(node.querySelector('input[type="text"]')?.value || '') !== '';
    if (type === 'gaps') {
      const inputs = [...node.querySelectorAll('[data-grammar-gap]')];
      return inputs.length > 0 && inputs.every((input) => normalizeAnswer(input.value) !== '');
    }
    return Boolean(node.querySelector('input:checked'));
  }

  function normalizeGrammarText(value) {
    return normalizeAnswer(value)
      .replace(/[,.!?;:]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function readGrammarQuestionAnswer(question, node, markGaps = false) {
    const type = grammarQuestionType(question);

    if (type === 'select') {
      const actual = node.querySelector('select')?.value ?? '';
      return { actual, correct: actual !== '' && Number(actual) === Number(question.answer) };
    }

    if (type === 'multiple') {
      const actual = [...node.querySelectorAll('input:checked')].map((input) => Number(input.value)).sort((a, b) => a - b);
      const expected = [...(Array.isArray(question.answer) ? question.answer : [])].map(Number).sort((a, b) => a - b);
      return { actual, correct: expected.length > 0 && JSON.stringify(actual) === JSON.stringify(expected) };
    }

    if (type === 'text') {
      const actual = node.querySelector('input[type="text"]')?.value || '';
      const accepted = Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length
        ? question.acceptedAnswers
        : [question.answer];
      const normalizedActual = normalizeGrammarText(actual);
      const correct = normalizedActual !== '' && accepted.some((answer) => normalizeGrammarText(answer) === normalizedActual);
      return { actual, correct };
    }

    if (type === 'gaps') {
      const inputs = [...node.querySelectorAll('[data-grammar-gap]')];
      const actual = inputs.map((input) => input.value);
      const expected = Array.isArray(question.answers) ? question.answers : [];
      const gapResults = inputs.map((input, gapIndex) => {
        const accepted = Array.isArray(expected[gapIndex]) ? expected[gapIndex] : [expected[gapIndex]];
        return accepted.some((variant) => normalizeAnswer(variant) !== '' && normalizeAnswer(variant) === normalizeAnswer(input.value));
      });
      if (markGaps) {
        inputs.forEach((input, gapIndex) => {
          input.classList.toggle('is-valid', Boolean(gapResults[gapIndex]));
          input.classList.toggle('is-invalid', !gapResults[gapIndex]);
        });
      }
      return { actual, correct: expected.length > 0 && gapResults.length === expected.length && gapResults.every(Boolean) };
    }

    const actual = node.querySelector('input:checked')?.value ?? '';
    return { actual, correct: actual !== '' && Number(actual) === Number(question.answer) };
  }

  function restoreGrammarAnswers(quizRoot, quiz, savedAnswers) {
    if (!Array.isArray(savedAnswers)) return;
    quiz.forEach((question, index) => {
      const node = quizRoot.querySelector(`[data-grammar-question="${index}"]`);
      if (!node || savedAnswers[index] === undefined) return;
      const type = grammarQuestionType(question);
      const value = savedAnswers[index];

      if (type === 'select') {
        const select = node.querySelector('select');
        if (select) select.value = safeText(value);
      } else if (type === 'text') {
        const input = node.querySelector('input[type="text"]');
        if (input) input.value = safeText(value);
      } else if (type === 'multiple') {
        const selected = new Set(Array.isArray(value) ? value.map(Number) : []);
        node.querySelectorAll('input[type="checkbox"]').forEach((input) => {
          input.checked = selected.has(Number(input.value));
        });
      } else if (type === 'gaps') {
        const values = Array.isArray(value) ? value : [];
        node.querySelectorAll('[data-grammar-gap]').forEach((input, gapIndex) => {
          input.value = safeText(values[gapIndex]);
        });
      } else {
        const input = node.querySelector(`input[value="${CSS.escape(safeText(value))}"]`);
        if (input) input.checked = true;
      }
    });
  }

  function lockGrammarQuiz(quizRoot) {
    quizRoot.classList.add('grammar-quiz-locked');
    quizRoot.querySelectorAll('input, select, textarea').forEach((control) => {
      control.disabled = true;
    });
  }

  function renderGrammarTopic() {
    const id = queryParam('id');
    const topic = GRAMMAR_DATA.find((item) => item.id === id && item.status !== 'draft');
    const root = byId('grammar-topic-root');

    if (!topic || topic.status === 'locked') {
      root.innerHTML = emptyState('📐', 'Грамматическая тема ещё не опубликована', 'Материал появится после публикации преподавателем.');
      return;
    }

    byId('grammar-hero-title').textContent = safeText(topic.title, 'Грамматика');
    byId('grammar-hero-subtitle').textContent = `${safeText(topic.level, student.level)} Level · понятная схема и мини-тест`;

    const overview = topic.overview || {};
    const uses = Array.isArray(topic.uses) ? topic.uses : [];
    const forms = Array.isArray(topic.forms) ? topic.forms : [];
    const mistakes = Array.isArray(topic.commonMistakes) ? topic.commonMistakes : [];
    const quiz = Array.isArray(topic.quiz) ? topic.quiz : [];
    const contrast = topic.contrast || {};
    const builder = topic.questionBuilder || {};
    const memoryRule = topic.memoryRule || {};
    const { state } = grammarProgressState(topic);

    const subjects = Array.isArray(overview.subjects) ? overview.subjects : [];
    const pattern = Array.isArray(builder.pattern) ? builder.pattern : [];
    const memorySteps = Array.isArray(memoryRule.steps) ? memoryRule.steps : [];
    const quizCount = Math.max(1, quiz.length);

    root.innerHTML = `<div class="grammar-topic-shell">
      ${grammarStatusMarkup(topic, state, quizCount)}

      <article class="card grammar-lead-card">
        <div class="grammar-lead-head">
          <div>
            <span class="eyebrow">Главная идея</span>
            <h2>${escapeHtml(topic.title)}</h2>
          </div>
          <span class="grammar-level-badge">${escapeHtml(topic.level || student.level)}</span>
        </div>
        <p class="grammar-lead-text">${escapeHtml(overview.lead || '')}</p>
        <div class="grammar-core-rule">
          <div class="grammar-core-rule-icon" aria-hidden="true">!</div>
          <div>
            <strong>${escapeHtml(overview.keyRule || '')}</strong>
            ${overview.example ? `<span>${escapeHtml(overview.example)}</span>` : ''}
          </div>
        </div>
        ${subjects.length ? `<div class="grammar-subject-row" aria-label="Ключевые ориентиры">${subjects.map((subject) => `<span>${escapeHtml(subject)}</span>`).join('')}</div>` : ''}
      </article>

      ${uses.length ? `<section class="grammar-content-section" aria-labelledby="grammar-use-title">
        <div class="grammar-section-heading">
          <span class="grammar-section-number">1</span>
          <div><h2 id="grammar-use-title">${escapeHtml(topic.usesTitle || 'Когда используем')}</h2><p>${escapeHtml(topic.usesSubtitle || 'Основные случаи для этого правила')}</p></div>
        </div>
        <div class="grammar-use-grid">${uses.map((item) => `<article class="grammar-use-card">
          <span class="grammar-use-icon" aria-hidden="true">${escapeHtml(item.icon || '•')}</span>
          <h3>${escapeHtml(item.title || '')}</h3>
          <p>${escapeHtml(item.text || '')}</p>
          <code>${escapeHtml(item.example || '')}</code>
        </article>`).join('')}</div>
      </section>` : ''}

      ${forms.length ? `<section class="grammar-content-section" aria-labelledby="grammar-forms-title">
        <div class="grammar-section-heading">
          <span class="grammar-section-number">2</span>
          <div><h2 id="grammar-forms-title">${escapeHtml(topic.formsTitle || 'Формы и схемы')}</h2><p>${escapeHtml(topic.formsSubtitle || 'Сначала запомни структуру, затем смотри на пример')}</p></div>
        </div>
        <div class="grammar-form-grid">${forms.map((form) => `<article class="grammar-form-card grammar-form-${escapeHtml(form.id || 'default')}">
          <div class="grammar-form-head">
            <span class="grammar-form-icon" aria-hidden="true">${escapeHtml(form.icon || '•')}</span>
            <h3>${escapeHtml(form.title || '')}</h3>
          </div>
          <div class="grammar-formula">${escapeHtml(form.formula || '')}</div>
          <div class="grammar-example">
            <strong>${escapeHtml(form.example || '')}</strong>
            <span>${escapeHtml(form.translation || '')}</span>
          </div>
          <p>${escapeHtml(form.note || '')}</p>
        </article>`).join('')}</div>
      </section>` : ''}

      ${contrast.ordinary && contrast.be ? `<section class="grammar-content-section" aria-labelledby="grammar-contrast-title">
        <div class="grammar-section-heading">
          <span class="grammar-section-number">3</span>
          <div><h2 id="grammar-contrast-title">${escapeHtml(contrast.title || 'Сравнение')}</h2><p>${escapeHtml(contrast.intro || '')}</p></div>
        </div>
        <div class="grammar-contrast-grid">
          <article class="grammar-contrast-card ordinary">
            <span class="grammar-contrast-label">A</span>
            <h3>${escapeHtml(contrast.ordinary.label || '')}</h3>
            <p class="grammar-verb-list">${escapeHtml(contrast.ordinary.verbs || '')}</p>
            <div class="grammar-pattern-list">
              <span><b>+</b> ${escapeHtml(contrast.ordinary.affirmative || '')}</span>
              <span><b>−</b> ${escapeHtml(contrast.ordinary.negative || '')}</span>
              <span><b>?</b> ${escapeHtml(contrast.ordinary.question || '')}</span>
            </div>
            <p class="grammar-contrast-rule">${escapeHtml(contrast.ordinary.rule || '')}</p>
          </article>
          <article class="grammar-contrast-card be">
            <span class="grammar-contrast-label">B</span>
            <h3>${escapeHtml(contrast.be.label || '')}</h3>
            <p class="grammar-verb-list">${escapeHtml(contrast.be.verbs || '')}</p>
            <div class="grammar-pattern-list">
              <span><b>+</b> ${escapeHtml(contrast.be.affirmative || '')}</span>
              <span><b>−</b> ${escapeHtml(contrast.be.negative || '')}</span>
              <span><b>?</b> ${escapeHtml(contrast.be.question || '')}</span>
            </div>
            <p class="grammar-contrast-rule">${escapeHtml(contrast.be.rule || '')}</p>
          </article>
        </div>
      </section>` : ''}

      ${pattern.length ? `<section class="grammar-content-section" aria-labelledby="grammar-question-title">
        <div class="grammar-section-heading">
          <span class="grammar-section-number">4</span>
          <div><h2 id="grammar-question-title">${escapeHtml(builder.title || 'Порядок слов')}</h2><p>${escapeHtml(builder.note || '')}</p></div>
        </div>
        <article class="card grammar-builder-card">
          <div class="grammar-token-row">${pattern.map((token, index) => `<span class="grammar-token grammar-token-${index + 1}">${escapeHtml(token)}</span>${index < pattern.length - 1 ? '<span class="grammar-token-arrow" aria-hidden="true">→</span>' : ''}`).join('')}</div>
          <div class="grammar-builder-example">
            <strong>${escapeHtml(builder.example || '')}</strong>
            <span>${escapeHtml(builder.translation || '')}</span>
          </div>
        </article>
      </section>` : ''}

      ${memorySteps.length ? `<article class="card grammar-memory-card">
        <div class="grammar-memory-icon" aria-hidden="true">⚡</div>
        <div>
          <span class="eyebrow">Алгоритм</span>
          <h2>${escapeHtml(memoryRule.title || 'Быстрая проверка')}</h2>
          <ol>${memorySteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
        </div>
      </article>` : ''}

      ${mistakes.length ? `<section class="grammar-content-section" aria-labelledby="grammar-mistakes-title">
        <div class="grammar-section-heading">
          <span class="grammar-section-number">5</span>
          <div><h2 id="grammar-mistakes-title">Частые ошибки</h2><p>Сравни неправильный и правильный вариант</p></div>
        </div>
        <div class="grammar-mistake-list">${mistakes.map((mistake) => `<article class="grammar-mistake-row">
          <div class="grammar-mistake-wrong"><span>✕</span><s>${escapeHtml(mistake.wrong || '')}</s></div>
          <div class="grammar-mistake-right"><span>✓</span><strong>${escapeHtml(mistake.right || '')}</strong></div>
          <p>${escapeHtml(mistake.reason || '')}</p>
        </article>`).join('')}</div>
      </section>` : ''}

      <section class="grammar-content-section grammar-test-section" aria-labelledby="mini-test-title">
        <div class="grammar-test-intro">
          <div>
            <span class="eyebrow">Мини-тест</span>
            <h2 id="mini-test-title">${Array.isArray(topic.quizGroups) && topic.quizGroups.length ? `${topic.quizGroups.length} упражнения × ${Math.floor(quizCount / topic.quizGroups.length)} задания` : `${quizCount} задания: от лёгкого к сложному`}</h2>
            <p>Ответь на все задания. Для зачёта нужно ${quizCount} из ${quizCount}. ${topic.revealAnswerOnError === false ? 'При ошибке правильный ответ не показывается.' : 'Тест можно переделывать.'}</p>
          </div>
          <span class="grammar-test-goal">${quizCount} / ${quizCount}</span>
        </div>
        <div id="grammar-quiz"></div>
      </section>
    </div>`;

    const quizRoot = byId('grammar-quiz');

    if (!quiz.length) {
      quizRoot.innerHTML = emptyState('🧩', 'Мини-тест ещё не добавлен', 'Вопросы появятся вместе с материалом преподавателя.');
      return;
    }

    const renderQuiz = () => {
      const { state: currentState } = grammarProgressState(topic);
      const alreadyPassed = Boolean(currentState.passed || topic.passed);
      const lockedPassed = alreadyPassed && topic.lockOnPass === true;

      const renderQuestion = (question, index, displayNumber = index + 1) => `<article class="card grammar-question-card" data-grammar-question="${index}">
        <div class="grammar-question-meta">
          <span class="grammar-difficulty">${escapeHtml(question.difficulty || `${displayNumber}`)}</span>
          <span>${escapeHtml(question.skill || '')}</span>
        </div>
        <h3>${displayNumber}. ${escapeHtml(question.prompt)}</h3>
        ${renderGrammarQuestionInput(question, index)}
        <div class="feedback"></div>
      </article>`;
      const quizGroups = Array.isArray(topic.quizGroups) ? topic.quizGroups : [];
      const groupedQuestionIndexes = new Set();
      const groupedMarkup = quizGroups.length ? quizGroups.map((group) => {
        const indexes = quiz.map((question, index) => question.group === group.id ? index : -1).filter((index) => index >= 0);
        indexes.forEach((index) => groupedQuestionIndexes.add(index));
        if (!indexes.length) return '';
        return `<section class="grammar-exercise-group" data-grammar-group="${escapeHtml(group.id || '')}">
          <header class="grammar-exercise-group-heading">
            <div><span class="eyebrow">${escapeHtml(group.difficulty || 'Exercise')}</span><h3>${escapeHtml(group.title || `Exercise ${group.id || ''}`)}</h3>${group.instructions ? `<p>${escapeHtml(group.instructions)}</p>` : ''}</div>
            <span class="grammar-exercise-count">${indexes.length} / ${indexes.length}</span>
          </header>
          <div class="grammar-exercise-group-items">${indexes.map((index, localIndex) => renderQuestion(quiz[index], index, localIndex + 1)).join('')}</div>
        </section>`;
      }).join('') : '';
      const ungroupedMarkup = quiz.map((question, index) => groupedQuestionIndexes.has(index) ? '' : renderQuestion(question, index)).join('');

      quizRoot.innerHTML = `${groupedMarkup}${ungroupedMarkup}
      <article class="card grammar-test-actions">
        <div id="grammar-result" aria-live="polite">
          <strong>${lockedPassed ? 'Тема уже засчитана.' : alreadyPassed ? 'Тема засчитана, но тест можно пройти ещё раз.' : `Заполни все ${quiz.length} задания.`}</strong>
          <span>${lockedPassed ? 'Ответы сохранены, поля заблокированы.' : 'Кнопка проверки станет активной после заполнения теста.'}</span>
        </div>
        <div class="button-row">
          <button class="btn btn-primary" type="button" id="check-grammar" disabled>${lockedPassed ? 'Тема изучена' : 'Проверить задания'}</button>
          <button class="btn btn-secondary" type="button" id="retry-grammar" ${lockedPassed ? 'hidden' : ''}>Очистить ответы</button>
        </div>
      </article>`;

      const checkButton = byId('check-grammar');
      const retryButton = byId('retry-grammar');
      restoreGrammarAnswers(quizRoot, quiz, alreadyPassed ? currentState.answers : (currentState.draftAnswers || currentState.answers));

      const collectGrammarAnswers = () => quiz.map((question, index) => {
        const node = quizRoot.querySelector(`[data-grammar-question="${index}"]`);
        return node ? readGrammarQuestionAnswer(question, node, false).actual : '';
      });

      const saveGrammarDraft = () => {
        if (lockedPassed) return;
        const progress = window.ProgressService.loadGrammarProgress();
        const previous = progress.topics[topic.id] || {};
        progress.topics[topic.id] = {
          ...previous,
          draftAnswers: collectGrammarAnswers(),
          updatedAt: new Date().toISOString()
        };
        window.ProgressService.saveGrammarProgress(progress);
      };

      const updateCheckState = () => {
        if (lockedPassed) {
          checkButton.disabled = true;
          checkButton.textContent = 'Тема изучена';
          return;
        }
        const answered = quiz.filter((question, index) => {
          const node = quizRoot.querySelector(`[data-grammar-question="${index}"]`);
          return node && grammarQuestionAnswered(question, node);
        }).length;
        checkButton.disabled = answered !== quiz.length;
        checkButton.textContent = answered === quiz.length
          ? 'Проверить задания'
          : `Ответы: ${answered} / ${quiz.length}`;
      };

      quizRoot.querySelectorAll('[data-grammar-control]').forEach((control) => {
        const eventName = control.tagName === 'INPUT' && control.type === 'text' ? 'input' : 'change';
        control.addEventListener(eventName, () => {
          const questionNode = control.closest('[data-grammar-question]');
          questionNode?.classList.remove('is-correct', 'is-wrong');
          control.classList.remove('is-valid', 'is-invalid');
          const feedback = questionNode?.querySelector('.feedback');
          if (feedback) {
            feedback.className = 'feedback';
            feedback.textContent = '';
          }
          saveGrammarDraft();
          updateCheckState();
        });
      });

      if (lockedPassed) {
        quiz.forEach((question, index) => {
          const node = quizRoot.querySelector(`[data-grammar-question="${index}"]`);
          if (!node || !grammarQuestionAnswered(question, node)) return;
          const result = readGrammarQuestionAnswer(question, node, true);
          node.classList.toggle('is-correct', result.correct);
          const feedback = node.querySelector('.feedback');
          if (feedback && result.correct) {
            feedback.className = 'feedback show good';
            feedback.textContent = 'Верно.';
          }
        });
        lockGrammarQuiz(quizRoot);
        updateCheckState();
        return;
      }

      updateCheckState();

      checkButton.addEventListener('click', () => {
        let correct = 0;
        const answers = [];

        quiz.forEach((question, index) => {
          const node = quizRoot.querySelector(`[data-grammar-question="${index}"]`);
          const result = readGrammarQuestionAnswer(question, node, true);
          answers[index] = result.actual;
          if (result.correct) correct += 1;

          node.classList.toggle('is-correct', result.correct);
          node.classList.toggle('is-wrong', !result.correct);

          const feedback = node.querySelector('.feedback');
          feedback.className = `feedback show ${result.correct ? 'good' : 'bad'}`;
          feedback.textContent = result.correct
            ? 'Верно.'
            : topic.revealAnswerOnError === false
              ? safeText(question.errorFeedback, 'Есть ошибка. Вернись к правилу и исправь ответ.')
              : safeText(question.explanation, 'Проверь правило и попробуй ещё раз.');
        });

        const percent = safePercent(correct, quiz.length);
        const passScore = Number(topic.passScore || 100);
        const passedNow = percent >= passScore;
        const progress = window.ProgressService.loadGrammarProgress();
        const previous = progress.topics[topic.id] || {};

        if (passedNow || topic.saveOnlyOnPass !== true) {
          progress.topics[topic.id] = {
            ...previous,
            passed: Boolean(previous.passed || passedNow),
            passedAt: previous.passedAt || (passedNow ? new Date().toISOString() : null),
            attempts: Number(previous.attempts || 0) + 1,
            bestScore: Math.max(Number(previous.bestScore || 0), percent),
            answers: passedNow ? answers : previous.answers,
            draftAnswers: passedNow ? [] : answers,
            updatedAt: new Date().toISOString()
          };
          window.ProgressService.saveGrammarProgress(progress);
        }

        const result = byId('grammar-result');
        result.className = `grammar-result-box ${passedNow ? 'is-passed' : 'is-retry'}`;
        result.innerHTML = passedNow
          ? `<strong>Тема засчитана ✓</strong><span>${correct} из ${quiz.length} · ${percent}%. ${topic.lockOnPass ? 'Прогресс сохранён, ответы заблокированы.' : 'Отличная работа!'}</span>`
          : `<strong>Есть ошибки: ${correct} из ${quiz.length}</strong><span>Исправь отмеченные задания и проверь ещё раз. Правильные ответы не раскрываются${topic.saveOnlyOnPass === true ? '; прогресс сохранится после результата 100%.' : '.'}</span>`;

        if (passedNow) {
          checkButton.disabled = true;
          checkButton.textContent = 'Тема изучена';
          if (topic.lockOnPass) {
            lockGrammarQuiz(quizRoot);
            retryButton.hidden = true;
          } else {
            retryButton.textContent = 'Пройти ещё раз';
          }
        } else {
          checkButton.disabled = false;
          checkButton.textContent = 'Проверить ещё раз';
          retryButton.textContent = 'Очистить ответы';
        }

        const savedState = passedNow
          ? window.ProgressService.loadGrammarProgress().topics[topic.id]
          : previous;
        const statusNode = byId('grammar-topic-status');
        if (statusNode) statusNode.outerHTML = grammarStatusMarkup(topic, savedState || {}, quiz.length);

        showToast(passedNow ? 'Тема засчитана, ответы заблокированы.' : 'Есть ошибки — исправь отмеченные задания.');
      });

      retryButton.addEventListener('click', () => {
        const progress = window.ProgressService.loadGrammarProgress();
        const previous = progress.topics[topic.id] || {};
        if (!previous.passed) {
          progress.topics[topic.id] = { ...previous, draftAnswers: [], updatedAt: new Date().toISOString() };
          window.ProgressService.saveGrammarProgress(progress);
        }
        renderQuiz();
        byId('mini-test-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    renderQuiz();
  }


  function getTopicProgress(progress, topicId) {
    if (!progress.topics[topicId]) progress.topics[topicId] = { tests: [] };
    if (!Array.isArray(progress.topics[topicId].tests)) progress.topics[topicId].tests = [];
    return progress.topics[topicId];
  }

  function setWordStatus(progress, word, topicId, status) {
    const now = new Date().toISOString();
    const previous = progress.words[word.__wordKey] || {};
    progress.words[word.__wordKey] = {
      status,
      topicId: previous.topicId || topicId,
      learnedAt: status === 'known' ? (previous.learnedAt || now) : null,
      updatedAt: now
    };
  }

  function renderVocabulary() {
    const id = queryParam('id');
    const topic = VOCABULARY_CATALOG.allTopics.find((item) => item.id === id);
    const root = byId('vocabulary-root');
    if (!topic || !Array.isArray(topic.words) || !topic.words.length) {
      root.innerHTML = emptyState('💥', 'Слова для этой темы ещё не добавлены', 'Преподаватель добавит список слов после урока. Повторы из предыдущих тем здесь не показываются.');
      return;
    }
    byId('vocab-hero-title').textContent = safeText(topic.title, 'Vocabulary');
    byId('vocab-hero-subtitle').textContent = `${safeText(topic.label, 'Словарная тема')} · ${topic.words.length} уникальных слов`;
    const progress = window.ProgressService.loadVocabularyProgress();
    const topicProgress = getTopicProgress(progress, topic.id);
    let mode = 'cards';
    let cardQueue = [];
    let testState = null;
    let activeWordGroupIndex = 0;
    const exactKnown = exactKnownCountForTopic(progress, topic);
    const legacyKnown = Math.min(topic.words.length, Math.max(0, Number(topicProgress.legacyLearnedCount || 0)));
    const legacyNotice = legacyKnown > exactKnown
      ? `<div class="card info-card legacy-progress-note"><strong>Старый прогресс сохранён: ${legacyKnown} из ${topic.words.length}.</strong><p class="muted">В старой базе хранилось только количество выученных слов, без списка конкретных карточек. Поэтому общий результат сохранён, а отдельные слова будут уточняться по мере повторения.</p></div>`
      : '';

    root.innerHTML = `${legacyNotice}<div class="card info-card vocab-test-rule"><strong>Как слово становится выученным</strong><p class="muted">Карточки помогают познакомиться со словами. Статус «выучено» слово получает только после завершённого теста и правильного ответа.</p></div><div class="mode-tabs" id="vocab-modes" aria-label="Режим тренировки">
      <button class="mode-btn active" type="button" data-mode="cards">Новые слова</button>
      <button class="mode-btn" type="button" data-mode="test">Тест</button>
      <button class="mode-btn" type="button" data-mode="all">Все слова</button>
      <button class="mode-btn" type="button" data-mode="difficult">Сложные слова</button>
    </div><div id="vocab-mode-root" class="section"></div>`;
    const modeRoot = byId('vocab-mode-root');

    const save = () => window.ProgressService.saveVocabularyProgress(progress);
    const resetCardQueue = () => {
      cardQueue = shuffled(topic.words.filter((word) => {
        const status = progress.words[word.__wordKey]?.status;
        return mode === 'difficult' ? status === 'difficult' : status !== 'known';
      }));
    };

    const drawCard = () => {
      if (!cardQueue.length) {
        const isDifficult = mode === 'difficult';
        modeRoot.innerHTML = emptyState(
          isDifficult ? '🌟' : '🎉',
          isDifficult ? 'Сложных слов пока нет' : 'Новые слова в этой теме закончились',
          isDifficult ? 'Отметьте слово кнопкой «Трудно», и оно появится здесь.' : 'Карточки просмотрены. Теперь пройди тест: только после завершённого теста правильные слова получат статус «выучено».'
        );
        return;
      }
      const word = cardQueue[0];
      const remaining = cardQueue.length;
      modeRoot.innerHTML = `<div class="flash-counter">Осталось: ${remaining}</div><div class="flashcard-stage"><div class="flashcard" id="flashcard" tabindex="0" role="button" aria-label="Перевернуть карточку">
        <div class="flash-face flash-front"><div class="flash-word">${escapeHtml(word.en)}</div>${word.transcription ? `<div class="flash-transcription">${escapeHtml(word.transcription)}</div>` : ''}<p class="muted">Нажми, чтобы увидеть перевод</p></div>
        <div class="flash-face flash-back"><div class="flash-word">${escapeHtml(word.ru)}</div>${word.exampleEn ? `<p class="flash-example">${escapeHtml(word.exampleEn)}${word.exampleRu ? `<br>${escapeHtml(word.exampleRu)}` : ''}</p>` : ''}${word.audio ? `<audio class="audio-player" controls preload="none" src="${escapeHtml(word.audio)}"></audio>` : ''}</div>
      </div></div><div class="trainer-actions"><button class="btn btn-danger" id="word-difficult" type="button">Трудно</button><button class="btn btn-success" id="word-known" type="button">Понятно — к тесту</button></div>`;
      const flashcard = byId('flashcard');
      const flip = () => flashcard.classList.toggle('flipped');
      flashcard.addEventListener('click', flip);
      flashcard.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); flip(); } });
      byId('word-known').addEventListener('click', () => {
        cardQueue.shift();
        drawCard();
      });
      byId('word-difficult').addEventListener('click', () => {
        setWordStatus(progress, word, topic.id, 'difficult');
        cardQueue.shift();
        save();
        drawCard();
      });
    };

    const startTest = () => {
      if (topic.words.length < 4) {
        modeRoot.innerHTML = emptyState('🧩', 'Для теста нужно минимум 4 слова', 'Добавьте ещё уникальные слова в тему, чтобы сформировать четыре варианта ответа без выдуманных данных.');
        return;
      }
      testState = { words: shuffled(topic.words), index: 0, firstTryCorrect: 0, answered: false, firstAnswers: {} };
      drawQuestion();
    };

    const finishTest = () => {
      const completedAt = new Date().toISOString();
      testState.words.forEach((word) => {
        const answer = testState.firstAnswers[word.__wordKey];
        setWordStatus(progress, word, topic.id, answer?.correct ? 'known' : 'difficult');
      });
      const result = {
        score: testState.firstTryCorrect,
        total: testState.words.length,
        percent: safePercent(testState.firstTryCorrect, testState.words.length),
        answers: testState.firstAnswers,
        completedAt
      };
      topicProgress.tests.push(result);
      save();
      modeRoot.innerHTML = `<div class="card empty-state"><div class="empty-state-icon">🏁</div><h3>Тест завершён</h3><p>Выучено после теста: ${result.score} из ${result.total}. Слова с ошибками добавлены в сложные.</p><div class="button-row" style="justify-content:center"><button class="btn btn-primary" id="restart-vocab-test" type="button">Пройти ещё раз</button></div></div>`;
      byId('restart-vocab-test').addEventListener('click', startTest);
    };

    const drawQuestion = () => {
      if (testState.index >= testState.words.length) { finishTest(); return; }
      const word = testState.words[testState.index];
      const distractors = shuffled(topic.words.filter((item) => item.__wordKey !== word.__wordKey)).slice(0, 3);
      const options = shuffled([word, ...distractors]);
      testState.answered = false;
      modeRoot.innerHTML = `<div class="flash-counter">Вопрос ${testState.index + 1} из ${testState.words.length}</div><article class="card"><span class="eyebrow">Выбери перевод</span><h2 class="flash-word">${escapeHtml(word.en)}</h2>${word.transcription ? `<p class="muted">${escapeHtml(word.transcription)}</p>` : ''}<div class="option-list section">${options.map((option) => `<button class="quiz-option" type="button" data-answer-key="${escapeHtml(option.__wordKey)}">${escapeHtml(option.ru)}</button>`).join('')}</div><div id="vocab-test-feedback" class="feedback"></div><div class="button-row"><button class="btn btn-primary" id="next-vocab-question" type="button" disabled>Следующее слово</button></div></article>`;
      modeRoot.querySelectorAll('[data-answer-key]').forEach((button) => {
        button.addEventListener('click', () => {
          if (testState.answered) return;
          testState.answered = true;
          const correct = button.dataset.answerKey === word.__wordKey;
          testState.firstAnswers[word.__wordKey] = { correct, selected: button.dataset.answerKey };
          if (correct) testState.firstTryCorrect += 1;
          save();
          modeRoot.querySelectorAll('[data-answer-key]').forEach((optionButton) => {
            optionButton.disabled = true;
            if (optionButton.dataset.answerKey === word.__wordKey) optionButton.classList.add('correct');
          });
          if (!correct) button.classList.add('wrong');
          const feedback = byId('vocab-test-feedback');
          feedback.className = `feedback show ${correct ? 'good' : 'bad'}`;
          feedback.textContent = correct ? 'Верно с первого раза!' : `Правильный ответ: ${word.ru}`;
          byId('next-vocab-question').disabled = false;
        });
      });
      byId('next-vocab-question').addEventListener('click', () => { testState.index += 1; drawQuestion(); });
    };

    const renderWordCard = (word) => {
      const status = progress.words[word.__wordKey]?.status;
      return `<article class="card word-card ${status === 'known' ? 'known' : ''} ${status === 'difficult' ? 'difficult' : ''}">
        <strong>${escapeHtml(word.en)}</strong>
        <span>${escapeHtml(word.ru)}</span>
        ${word.transcription ? `<span>${escapeHtml(word.transcription)}</span>` : ''}
      </article>`;
    };

    const drawAllWords = () => {
      const configuredGroups = (Array.isArray(topic.groups) ? topic.groups : [])
        .map((group) => ({
          ...group,
          words: topic.words.filter((word) => word.group === group.id)
        }))
        .filter((group) => group.words.length);

      const groupedKeys = new Set(
        configuredGroups.flatMap((group) =>
          group.words.map((word) => word.__wordKey)
        )
      );

      const ungroupedWords = topic.words.filter(
        (word) => !groupedKeys.has(word.__wordKey)
      );

      const sections = [
        ...configuredGroups,
        ...(ungroupedWords.length
          ? [{
              id: 'other',
              title: 'Other words',
              subtitle: 'Другие слова',
              icon: '📚',
              words: ungroupedWords
            }]
          : [])
      ];

      if (!sections.length) {
        modeRoot.innerHTML = emptyState(
          '📚',
          'Слова ещё не распределены по разделам',
          'Преподаватель добавит категории к этой теме.'
        );
        return;
      }

      activeWordGroupIndex = Math.min(
        Math.max(0, activeWordGroupIndex),
        sections.length - 1
      );
      const activeGroup = sections[activeWordGroupIndex];
      const knownInGroup = activeGroup.words.filter(
        (word) => progress.words[word.__wordKey]?.status === 'known'
      ).length;

      modeRoot.innerHTML = `<div class="vocab-section-browser">
        <div class="vocab-section-tabs" role="tablist" aria-label="Разделы словаря">
          ${sections.map((group, index) => `
            <button
              class="vocab-section-tab ${index === activeWordGroupIndex ? 'active' : ''}"
              type="button"
              role="tab"
              aria-selected="${index === activeWordGroupIndex ? 'true' : 'false'}"
              aria-controls="vocab-section-panel"
              tabindex="${index === activeWordGroupIndex ? '0' : '-1'}"
              data-vocab-group-index="${index}"
            >
              <span class="vocab-section-tab-icon" aria-hidden="true">${escapeHtml(group.icon || '📚')}</span>
              <span class="vocab-section-tab-copy">
                <strong>${escapeHtml(group.title || group.id)}</strong>
                <small>${escapeHtml(group.subtitle || '')}</small>
              </span>
              <span class="vocab-section-tab-count">${group.words.length}</span>
            </button>
          `).join('')}
        </div>

        <section
          class="vocab-section-panel"
          id="vocab-section-panel"
          role="tabpanel"
          tabindex="0"
          aria-label="${escapeHtml(activeGroup.title || activeGroup.id)}"
        >
          <header class="vocab-section-panel-heading">
            <div class="vocab-section-panel-title">
              <span class="vocab-section-panel-icon" aria-hidden="true">${escapeHtml(activeGroup.icon || '📚')}</span>
              <div>
                <span class="eyebrow">Раздел ${activeWordGroupIndex + 1} из ${sections.length}</span>
                <h3>${escapeHtml(activeGroup.title || activeGroup.id)}</h3>
                ${activeGroup.subtitle ? `<p>${escapeHtml(activeGroup.subtitle)}</p>` : ''}
              </div>
            </div>
            <div class="vocab-section-progress" aria-label="Прогресс раздела">
              <strong>${knownInGroup} / ${activeGroup.words.length}</strong>
              <span>изучено</span>
            </div>
          </header>

          <div class="words-grid">${activeGroup.words.map(renderWordCard).join('')}</div>

          <footer class="vocab-section-navigation" aria-label="Переход между разделами">
            <button
              class="btn btn-secondary"
              type="button"
              data-vocab-group-prev
              ${activeWordGroupIndex === 0 ? 'disabled' : ''}
            >
              ← Предыдущий
            </button>
            <span>${activeWordGroupIndex + 1} / ${sections.length}</span>
            <button
              class="btn btn-primary"
              type="button"
              data-vocab-group-next
              ${activeWordGroupIndex === sections.length - 1 ? 'disabled' : ''}
            >
              Следующий →
            </button>
          </footer>
        </section>
      </div>`;

      const selectGroup = (index, focusPanel = true) => {
        activeWordGroupIndex = Math.min(
          Math.max(0, Number(index) || 0),
          sections.length - 1
        );
        drawAllWords();
        if (focusPanel) {
          byId('vocab-section-panel')?.focus({ preventScroll: true });
        }
      };

      const tabs = [...modeRoot.querySelectorAll('[data-vocab-group-index]')];

      tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => selectGroup(index));

        tab.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            return;
          }

          event.preventDefault();

          let nextIndex = index;
          if (event.key === 'ArrowRight') {
            nextIndex = (index + 1) % sections.length;
          } else if (event.key === 'ArrowLeft') {
            nextIndex = (index - 1 + sections.length) % sections.length;
          } else if (event.key === 'Home') {
            nextIndex = 0;
          } else if (event.key === 'End') {
            nextIndex = sections.length - 1;
          }

          activeWordGroupIndex = nextIndex;
          drawAllWords();
          modeRoot
            .querySelector(`[data-vocab-group-index="${nextIndex}"]`)
            ?.focus();
        });
      });

      modeRoot.querySelector('[data-vocab-group-prev]')?.addEventListener(
        'click',
        () => selectGroup(activeWordGroupIndex - 1)
      );

      modeRoot.querySelector('[data-vocab-group-next]')?.addEventListener(
        'click',
        () => selectGroup(activeWordGroupIndex + 1)
      );
    };

    const drawMode = () => {
      if (mode === 'cards' || mode === 'difficult') {
        resetCardQueue();
        drawCard();
      } else if (mode === 'test') startTest();
      else drawAllWords();
    };
    byId('vocab-modes').addEventListener('click', (event) => {
      const button = event.target.closest('[data-mode]');
      if (!button) return;
      mode = button.dataset.mode;
      byId('vocab-modes').querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('active', item === button));
      drawMode();
    });
    drawMode();
  }

  async function refreshCurrentView() {
    const view = document.body.dataset.view;
    const renderers = {
      home: renderHome,
      homework: renderHomework,
      grammar: renderGrammar,
      'vocabulary-hub': renderVocabularyHub,
      lesson: renderLesson,
      'grammar-topic': renderGrammarTopic,
      vocabulary: renderVocabulary
    };
    try {
      await renderers[view]?.();
    } catch (error) {
      console.error('Ошибка отображения страницы:', error);
      const main = document.querySelector('main');
      if (main) main.innerHTML = emptyState('⚠️', 'Не удалось открыть страницу', 'Проверьте структуру данных и попробуйте обновить страницу.');
    }
  }

  function homeworkCatalogSignature(items = HOMEWORK_DATA) {
    return JSON.stringify((Array.isArray(items) ? items : []).map((item) => ({
      id: item.id,
      number: item.number,
      title: item.title,
      subtitle: item.subtitle,
      status: item.status,
      publishedAt: item.publishedAt,
      notificationVersion: item.notification?.version || 0
    })));
  }

  async function refreshHomeworkCatalogIfChanged() {
    const view = document.body?.dataset?.view || '';
    if (!['home', 'homework'].includes(view)) return;

    const before = homeworkCatalogSignature();
    lessonCache.clear();

    try {
      await loadHomeworkData();
      const after = homeworkCatalogSignature();
      if (after !== before) {
        await refreshCurrentView();
        showToast('Список домашних заданий обновлён.');
      }
    } catch (error) {
      console.warn('Не удалось автоматически обновить список домашних заданий:', error);
    }
  }

  function startHomeworkAutoRefresh() {
    const view = document.body?.dataset?.view || '';
    if (!['home', 'homework'].includes(view)) return;

    window.setInterval(refreshHomeworkCatalogIfChanged, 60_000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshHomeworkCatalogIfChanged();
    });
  }

  async function init() {
    migrateLegacyOlyaProgress();
    fillConfig();
    markNavigation();
    try {
      await loadHomeworkData();
    } catch (error) {
      console.error('Ошибка загрузки каталога уроков:', error);
      HOMEWORK_DATA = [];
      window.HOMEWORK_DATA = HOMEWORK_DATA;
    }
    await refreshCurrentView();
    startHomeworkAutoRefresh();
    if (!CloudService.isConfigured()) return;
    try {
      await CloudService.init();
      await window.ProgressService.syncFromCloud();
      await refreshCurrentView();
    } catch (error) {
      console.error('Ошибка подключения к Supabase:', error);
      const detail = safeText(error?.message || error?.details || error?.hint);
      showToast(detail ? `Ошибка Supabase: ${detail}` : 'Supabase временно недоступен.');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
