/** Grammar path for Olya. */
window.GRAMMAR_DATA = [
  {
    "id": "grammar-verb-be",
    "order": 1,
    "title": "Verb be: am, is, are",
    "level": "A2",
    "status": "available",
    "page": "grammar-topic.html?id=grammar-verb-be",
    "passScore": 100,
    "overview": {
      "lead": "Глагол be связывает подлежащее с профессией, состоянием, местом и описанием.",
      "keyRule": "В настоящем времени be нельзя пропускать.",
      "subjects": [],
      "example": "I'm from Russia."
    },
    "uses": [
      {
        "icon": "👤",
        "title": "Кто или что",
        "text": "Профессия, национальность, описание.",
        "example": "I'm an artist."
      },
      {
        "icon": "📍",
        "title": "Где",
        "text": "Местонахождение.",
        "example": "They are at home."
      }
    ],
    "forms": [
      {
        "id": "affirmative",
        "icon": "✓",
        "title": "Утверждение",
        "formula": "I am / he is / they are",
        "example": "I'm from Russia.",
        "translation": "Я из России.",
        "note": "Используй форму по подлежащему."
      },
      {
        "id": "negative",
        "icon": "−",
        "title": "Отрицание",
        "formula": "am not / isn't / aren't",
        "example": "She isn't at home.",
        "translation": "Её нет дома.",
        "note": "Do / does с be не нужны."
      },
      {
        "id": "question",
        "icon": "?",
        "title": "Вопрос",
        "formula": "Am / Is / Are + subject?",
        "example": "Are you a student?",
        "translation": "Ты студент?",
        "note": "Перенеси be перед подлежащим."
      }
    ],
    "commonMistakes": [
      {
        "wrong": "I artist.",
        "right": "I'm an artist.",
        "reason": "В английском be обязателен."
      }
    ],
    "quiz": [
      {
        "difficulty": "1 · Easy",
        "skill": "Отрицание",
        "prompt": "She ___ from Indonesia; she’s from Russia.",
        "options": [
          "aren't",
          "isn't",
          "not"
        ],
        "answer": 1,
        "explanation": "She isn't."
      },
      {
        "difficulty": "2 · Basic",
        "skill": "Вопрос",
        "prompt": "___ you interested in travel?",
        "options": [
          "Is",
          "Am",
          "Are"
        ],
        "answer": 2,
        "explanation": "You → are."
      }
    ]
  },
  {
    "id": "grammar-past-simple",
    "order": 2,
    "title": "Past Simple",
    "level": "A2",
    "status": "available",
    "page": "grammar-topic.html?id=grammar-past-simple",
    "passScore": 100,
    "overview": {
      "lead": "Past Simple описывает завершённые действия и состояния в прошлом.",
      "keyRule": "В утверждении используй V2; после did / didn’t — только V1.",
      "subjects": [],
      "example": "We went to Portugal."
    },
    "uses": [
      {
        "icon": "✅",
        "title": "Завершённое действие",
        "text": "Событие закончилось в прошлом.",
        "example": "We arrived at two."
      },
      {
        "icon": "🗓️",
        "title": "Прошедшее время",
        "text": "Часто есть yesterday, last..., ago.",
        "example": "Last summer we went to Bali."
      }
    ],
    "forms": [
      {
        "id": "affirmative",
        "icon": "✓",
        "title": "Утверждение",
        "formula": "subject + V2",
        "example": "We went to Portugal.",
        "translation": "Мы поехали в Португалию.",
        "note": "Regular: -ed; irregular: особая форма."
      },
      {
        "id": "negative",
        "icon": "−",
        "title": "Отрицание",
        "formula": "subject + didn't + V1",
        "example": "She didn't find her passport.",
        "translation": "Она не нашла паспорт.",
        "note": "Не ставь V2 после didn’t."
      },
      {
        "id": "question",
        "icon": "?",
        "title": "Вопрос",
        "formula": "Did + subject + V1?",
        "example": "Did you book the apartment?",
        "translation": "Ты забронировала квартиру?",
        "note": "После did нужен V1."
      },
      {
        "id": "be",
        "icon": "●",
        "title": "Past of be",
        "formula": "was / were; wasn’t / weren’t",
        "example": "The hotel was noisy.",
        "translation": "Отель был шумным.",
        "note": "С was / were не используется did."
      }
    ],
    "commonMistakes": [
      {
        "wrong": "She didn't went.",
        "right": "She didn't go.",
        "reason": "После didn’t нужен V1."
      },
      {
        "wrong": "Did you went?",
        "right": "Did you go?",
        "reason": "После did нужен V1."
      }
    ],
    "quiz": [
      {
        "difficulty": "1 · Easy",
        "skill": "V2",
        "prompt": "We ___ to the airport by taxi.",
        "options": [
          "go",
          "went",
          "goed"
        ],
        "answer": 1,
        "explanation": "go → went."
      },
      {
        "difficulty": "2 · Basic",
        "skill": "Отрицание",
        "prompt": "They ___ find their passports.",
        "options": [
          "weren't",
          "not",
          "couldn't"
        ],
        "answer": 2,
        "explanation": "They couldn't find..."
      },
      {
        "difficulty": "3 · Medium",
        "skill": "Вопрос",
        "prompt": "___ she book the apartment?",
        "options": [
          "Did",
          "Was",
          "Do"
        ],
        "answer": 0,
        "explanation": "Did + she + book."
      }
    ],
    "linkedLessonId": "lesson-1"
  },
  {
    "id": "grammar-present-simple",
    "order": 3,
    "title": "Present Simple",
    "level": "A2",
    "status": "available",
    "page": "grammar-topic.html?id=grammar-present-simple",
    "passScore": 100,
    "overview": {
      "lead": "Present Simple нужен для привычек, фактов и регулярных действий.",
      "keyRule": "После he / she / it добавляй -s; в вопросах и отрицаниях используй do / does.",
      "subjects": [],
      "example": "She travels every winter."
    },
    "uses": [
      {
        "icon": "🔁",
        "title": "Привычки",
        "text": "Регулярные действия.",
        "example": "I travel a lot."
      },
      {
        "icon": "📌",
        "title": "Факты",
        "text": "Постоянные ситуации.",
        "example": "She lives in Moscow."
      }
    ],
    "forms": [
      {
        "id": "affirmative",
        "icon": "✓",
        "title": "Утверждение",
        "formula": "I work / she works",
        "example": "She travels every winter.",
        "translation": "Она путешествует каждую зиму.",
        "note": "He / she / it → -s."
      },
      {
        "id": "negative",
        "icon": "−",
        "title": "Отрицание",
        "formula": "don't / doesn't + V1",
        "example": "She doesn't speak English.",
        "translation": "Она не говорит по-английски.",
        "note": "После doesn’t окончание -s исчезает."
      },
      {
        "id": "question",
        "icon": "?",
        "title": "Вопрос",
        "formula": "Do / Does + subject + V1?",
        "example": "Do you like Bali?",
        "translation": "Тебе нравится Бали?",
        "note": "Does для he / she / it."
      }
    ],
    "commonMistakes": [
      {
        "wrong": "She work.",
        "right": "She works.",
        "reason": "После she добавь -s."
      },
      {
        "wrong": "He don't know.",
        "right": "He doesn't know.",
        "reason": "He → does / doesn’t."
      }
    ],
    "quiz": [
      {
        "difficulty": "1 · Easy",
        "skill": "he / she / it",
        "prompt": "She ___ in Bali every winter.",
        "options": [
          "travel",
          "travels",
          "is travel"
        ],
        "answer": 1,
        "explanation": "She travels."
      },
      {
        "difficulty": "2 · Basic",
        "skill": "Вопрос",
        "prompt": "___ she speak English well?",
        "options": [
          "Do",
          "Is",
          "Does"
        ],
        "answer": 2,
        "explanation": "Does + she + speak."
      }
    ]
  },
  {
    "id": "grammar-going-to",
    "order": 4,
    "title": "Be going to: plans",
    "level": "A2",
    "status": "available",
    "page": "grammar-topic.html?id=grammar-going-to",
    "passScore": 100,
    "overview": {
      "lead": "Be going to используется для планов и намерений.",
      "keyRule": "Сначала выбери форму be, затем going to + V1.",
      "subjects": [],
      "example": "I'm going to visit Japan."
    },
    "uses": [],
    "forms": [
      {
        "id": "affirmative",
        "icon": "✓",
        "title": "Утверждение",
        "formula": "am / is / are going to + V1",
        "example": "I'm going to visit Japan.",
        "translation": "Я собираюсь посетить Японию.",
        "note": "Форма be зависит от подлежащего."
      },
      {
        "id": "negative",
        "icon": "−",
        "title": "Отрицание",
        "formula": "am not / isn’t / aren’t going to + V1",
        "example": "I'm not going to travel alone.",
        "translation": "Я не собираюсь путешествовать одна.",
        "note": "Not ставится после be."
      },
      {
        "id": "question",
        "icon": "?",
        "title": "Вопрос",
        "formula": "Am / Is / Are + subject + going to + V1?",
        "example": "Are you going to travel?",
        "translation": "Ты собираешься путешествовать?",
        "note": "Be переносится перед подлежащим."
      }
    ],
    "commonMistakes": [],
    "quiz": [
      {
        "difficulty": "1 · Easy",
        "skill": "Форма be",
        "prompt": "I ___ going to book a hotel.",
        "options": [
          "is",
          "am",
          "are"
        ],
        "answer": 1,
        "explanation": "I am."
      },
      {
        "difficulty": "2 · Basic",
        "skill": "Вопрос",
        "prompt": "___ she going to travel alone?",
        "options": [
          "Is",
          "Are",
          "Does"
        ],
        "answer": 0,
        "explanation": "Is she going to...?"
      }
    ]
  },
  {
    "id": "grammar-word-order-questions",
    "order": 5,
    "title": "Word order: SVOMPT, ASI and PASI",
    "level": "A2",
    "status": "available",
    "page": "grammar-topic.html?id=grammar-word-order-questions",
    "passScore": 100,
    "overview": {
      "lead": "Английское предложение строится в фиксированном порядке; вопросы требуют вспомогательного глагола перед подлежащим.",
      "keyRule": "Утверждение: SVOMPT. Вопрос: (Question word) + auxiliary / be + subject + main verb.",
      "subjects": [],
      "example": "We had a lovely time at a campsite last weekend."
    },
    "uses": [],
    "forms": [
      {
        "id": "svompt",
        "icon": "→",
        "title": "Утверждение",
        "formula": "Subject + Verb + Object + Manner + Place + Time",
        "example": "We had a lovely time at a campsite last weekend.",
        "translation": "Мы прекрасно провели время в кемпинге в прошлые выходные.",
        "note": "Place обычно стоит перед Time."
      },
      {
        "id": "asi",
        "icon": "?",
        "title": "Общий вопрос",
        "formula": "Auxiliary + Subject + Infinitive?",
        "example": "Did you hire a bicycle yesterday?",
        "translation": "Вы брали велосипед напрокат вчера?",
        "note": "После did используется V1."
      },
      {
        "id": "pasi",
        "icon": "🔎",
        "title": "Специальный вопрос",
        "formula": "Question word + Auxiliary + Subject + Infinitive?",
        "example": "Where do they usually buy souvenirs?",
        "translation": "Где они обычно покупают сувениры?",
        "note": "Наречие usually стоит перед основным глаголом."
      },
      {
        "id": "be-question",
        "icon": "●",
        "title": "Вопрос с be",
        "formula": "Question word + was / were + subject?",
        "example": "Why was the hotel so noisy?",
        "translation": "Почему отель был таким шумным?",
        "note": "С be не добавляй did."
      }
    ],
    "commonMistakes": [
      {
        "wrong": "Why the hotel was noisy?",
        "right": "Why was the hotel noisy?",
        "reason": "С be меняются местами be и подлежащее."
      },
      {
        "wrong": "Did you hired a bike?",
        "right": "Did you hire a bike?",
        "reason": "После did нужен V1."
      }
    ],
    "quiz": [
      {
        "difficulty": "1 · Easy",
        "skill": "SVOMPT",
        "prompt": "Choose the best word order.",
        "options": [
          "We yesterday stayed in a hotel.",
          "We stayed in a hotel yesterday.",
          "Yesterday in a hotel stayed we."
        ],
        "answer": 1,
        "explanation": "Place before Time."
      },
      {
        "difficulty": "2 · Basic",
        "skill": "Past be question",
        "prompt": "Choose the correct question.",
        "options": [
          "Why the beach was dirty?",
          "Why did the beach be dirty?",
          "Why was the beach dirty?"
        ],
        "answer": 2,
        "explanation": "Question word + was + subject."
      },
      {
        "difficulty": "3 · Medium",
        "skill": "Frequency adverb",
        "prompt": "Choose the correct question.",
        "options": [
          "Does he always sunbathe in the morning?",
          "Does he sunbathe always in the morning?",
          "He always does sunbathe?"
        ],
        "answer": 0,
        "explanation": "Always comes before the main verb."
      }
    ],
    "linkedLessonId": "lesson-4",
    "questionBuilder": {
      "title": "Порядок слов в специальном вопросе",
      "pattern": [
        "Question word",
        "auxiliary / be",
        "subject",
        "main verb",
        "... ?"
      ],
      "example": "Where do they usually buy souvenirs?",
      "translation": "Где они обычно покупают сувениры?",
      "note": "Если основной глагол be, do / did не используются."
    }
  },
  {
    "id": "grammar-past-simple-continuous",
    "order": 6,
    "title": "Past Simple vs Past Continuous",
    "level": "A2",
    "status": "available",
    "page": "grammar-topic.html?id=grammar-past-simple-continuous",
    "passScore": 100,
    "overview": {
      "lead": "Past Simple показывает завершённое событие, а Past Continuous — действие, которое находилось в процессе в определённый момент прошлого.",
      "keyRule": "Past Continuous создаёт фон или длительный процесс; Past Simple сообщает, что произошло на этом фоне.",
      "subjects": [
        "Past Simple = событие",
        "Past Continuous = процесс"
      ],
      "example": "I was walking home when I saw an accident."
    },
    "uses": [
      {
        "icon": "✅",
        "title": "Завершённое событие",
        "text": "Одно действие закончилось в прошлом или события произошли последовательно.",
        "example": "He opened the door and went inside."
      },
      {
        "icon": "🕘",
        "title": "Действие в процессе",
        "text": "Действие происходило в конкретный момент прошлого.",
        "example": "At nine, we were watching a film."
      },
      {
        "icon": "⚡",
        "title": "Прерванный процесс",
        "text": "Длительное действие было фоном, когда произошло короткое событие.",
        "example": "I was cooking when the lights went out."
      },
      {
        "icon": "↔️",
        "title": "Два одновременных процесса",
        "text": "Два действия происходили одновременно; часто используется while.",
        "example": "While I was cooking, she was setting the table."
      }
    ],
    "forms": [
      {
        "id": "past-simple",
        "icon": "✓",
        "title": "Past Simple",
        "formula": "subject + V2",
        "example": "She bought new shoes yesterday.",
        "translation": "Она купила новые туфли вчера.",
        "note": "Для завершённого действия. После did / didn’t используй V1."
      },
      {
        "id": "past-continuous",
        "icon": "↻",
        "title": "Past Continuous",
        "formula": "subject + was / were + V-ing",
        "example": "She was buying shoes at five.",
        "translation": "В пять часов она покупала туфли.",
        "note": "Для действия, которое находилось в процессе."
      },
      {
        "id": "when",
        "icon": "⚡",
        "title": "When",
        "formula": "Past Continuous + when + Past Simple",
        "example": "We were driving home when the car stopped.",
        "translation": "Мы ехали домой, когда машина остановилась.",
        "note": "When часто вводит короткое событие в Past Simple."
      },
      {
        "id": "while",
        "icon": "↔️",
        "title": "While",
        "formula": "While + Past Continuous, Past Simple / Past Continuous",
        "example": "While I was studying, Anna called me.",
        "translation": "Пока я занималась, Анна позвонила мне.",
        "note": "После while обычно идёт длительное действие."
      }
    ],
    "contrast": {
      "title": "Как выбрать время",
      "intro": "Сначала реши, видишь ли ты завершённое событие или процесс в определённый момент.",
      "ordinary": {
        "label": "Past Simple",
        "verbs": "V2 · did / didn’t + V1 · was / were",
        "affirmative": "I called her.",
        "negative": "I didn’t call her.",
        "question": "Did you call her?",
        "rule": "Событие завершилось; важен факт или результат. Маркеры: yesterday, last..., ago, then, suddenly."
      },
      "be": {
        "label": "Past Continuous",
        "verbs": "was / were + V-ing",
        "affirmative": "I was calling her.",
        "negative": "I wasn’t calling her.",
        "question": "Were you calling her?",
        "rule": "Действие было в процессе. Маркеры: at 7 o’clock, at that moment, while, when another action happened."
      }
    },
    "questionBuilder": {
      "title": "Фон и событие в одном предложении",
      "pattern": [
        "Past Continuous: процесс",
        "when",
        "Past Simple: событие"
      ],
      "example": "I was walking home when I saw an accident.",
      "translation": "Я шла домой, когда увидела аварию.",
      "note": "Можно начать с when: When I saw the accident, I was walking home. Время не меняется — меняется только порядок частей."
    },
    "memoryRule": {
      "title": "Как быстро выбрать время",
      "steps": [
        "Найди конкретный момент или слово while: это часто Past Continuous.",
        "Найди короткое завершённое событие: это Past Simple.",
        "Если одно действие прерывает другое, фон ставь в Past Continuous, событие — в Past Simple.",
        "После did / didn’t всегда используй V1; в Past Continuous обязательно нужны was / were и -ing."
      ]
    },
    "commonMistakes": [
      {
        "wrong": "I was walk home.",
        "right": "I was walking home.",
        "reason": "После was / were нужен глагол с -ing."
      },
      {
        "wrong": "She didn’t went out.",
        "right": "She didn’t go out.",
        "reason": "После didn’t используется V1."
      },
      {
        "wrong": "While I cooked, the phone was ringing once.",
        "right": "While I was cooking, the phone rang.",
        "reason": "Фон — Past Continuous; короткое событие — Past Simple."
      },
      {
        "wrong": "What did you do when I called? (о процессе в момент звонка)",
        "right": "What were you doing when I called?",
        "reason": "Вопрос относится к действию, которое происходило в тот момент."
      }
    ],
    "quiz": [
      {
        "difficulty": "1 · Easy",
        "skill": "Past Continuous",
        "prompt": "At eight o’clock, I ___ dinner.",
        "options": [
          "cooked",
          "was cooking",
          "were cooking"
        ],
        "answer": 1,
        "explanation": "Действие происходило в конкретный момент: was cooking."
      },
      {
        "difficulty": "2 · Basic",
        "skill": "Past Simple",
        "prompt": "We ___ them during our holiday last summer.",
        "options": [
          "met",
          "were meeting",
          "was meeting"
        ],
        "answer": 0,
        "explanation": "Завершённое событие: met."
      },
      {
        "difficulty": "3 · Medium",
        "skill": "Процесс + событие",
        "prompt": "While she ___ home, she ___ her keys.",
        "options": [
          "walked / was losing",
          "was walking / lost",
          "was walking / was losing"
        ],
        "answer": 1,
        "explanation": "Фон: was walking. Событие: lost."
      },
      {
        "difficulty": "4 · Challenge",
        "skill": "Вопрос о процессе",
        "prompt": "What ___ when I called you?",
        "options": [
          "did you do",
          "were you doing",
          "was you doing"
        ],
        "answer": 1,
        "explanation": "Действие было в процессе в момент звонка: were you doing."
      }
    ],
    "linkedLessonId": "lesson-5"
  },
  {
    "id": "grammar-at-in-on",
    "order": 7,
    "title": "Предлоги at, in, on: время и место",
    "level": "A2",
    "status": "available",
    "page": "grammar-topic.html?id=grammar-at-in-on",
    "passScore": 100,
    "saveOnlyOnPass": true,
    "lockOnPass": true,
    "revealAnswerOnError": false,
    "usesTitle": "Один принцип для времени и места",
    "usesSubtitle": "Меняй масштаб: точка → линия или поверхность → пространство",
    "formsTitle": "Шпаргалка: AT, ON, IN",
    "formsSubtitle": "Не переводи предлог отдельно — сначала определи масштаб",
    "overview": {
      "lead": "Представь, что ты смотришь на карту или календарь и меняешь масштаб. AT — маленькая точка. ON — линия, день или поверхность. IN — пространство с границами или большой период. Эта картинка помогает выбрать предлог и для времени, и для места.",
      "keyRule": "AT = точка; ON = день или поверхность; IN = внутри пространства или большого периода.",
      "subjects": [
        "AT → точка",
        "ON → линия / поверхность",
        "IN → внутри"
      ],
      "example": "at 8:00 · on Monday · in July"
    },
    "uses": [
      {
        "icon": "🕐",
        "title": "Время",
        "text": "Точный момент — at; день или дата — on; месяц, год, сезон и часть дня — in.",
        "example": "at 7:30 · on Friday · in August"
      },
      {
        "icon": "📍",
        "title": "Место",
        "text": "Точка или событие — at; поверхность — on; пространство с границами — in.",
        "example": "at the station · on the wall · in the room"
      },
      {
        "icon": "🚌",
        "title": "Транспорт и устойчивые пары",
        "text": "На большом транспорте обычно on, в машине или такси — in. Некоторые сочетания запоминаем целиком.",
        "example": "on the bus · in a car · at home"
      }
    ],
    "forms": [
      {
        "id": "at",
        "icon": "•",
        "title": "AT — точка",
        "formula": "точное время · конкретная точка · событие",
        "example": "at 8:00 · at night · at the station · at a party",
        "translation": "в 8:00 · ночью · на станции · на вечеринке",
        "note": "Представь булавку на карте или одну точку на часах."
      },
      {
        "id": "on",
        "icon": "—",
        "title": "ON — линия или поверхность",
        "formula": "день / дата · поверхность · автобус / поезд / самолёт",
        "example": "on Monday · on 29 July · on the table · on the train",
        "translation": "в понедельник · 29 июля · на столе · в поезде",
        "note": "День — отдельная клетка календаря; предмет касается поверхности."
      },
      {
        "id": "in",
        "icon": "□",
        "title": "IN — внутри",
        "formula": "месяц / год / сезон · закрытое пространство · машина / такси",
        "example": "in July · in 2026 · in the kitchen · in a taxi",
        "translation": "в июле · в 2026 году · на кухне · в такси",
        "note": "Есть границы: комнаты, города, страны или большого периода времени."
      },
      {
        "id": "exceptions",
        "icon": "★",
        "title": "Полезные сочетания",
        "formula": "at home / work / school · in the morning · on Monday morning",
        "example": "I work at home in the morning, but on Monday morning I go to the office.",
        "translation": "Я работаю дома по утрам, но утром в понедельник еду в офис.",
        "note": "Когда появляется конкретный день, используем on: on Friday evening."
      }
    ],
    "memoryRule": {
      "title": "Пять шагов без зубрёжки",
      "steps": [
        "Это точное время? Выбирай AT: at 6:15, at noon, at night.",
        "Это день или дата? Выбирай ON: on Tuesday, on 1 May, on Tuesday morning.",
        "Это большой период? Выбирай IN: in March, in 2026, in winter, in the evening.",
        "Для места спроси: точка — AT, поверхность — ON, внутри границ — IN.",
        "Проверь транспорт: on a bus / train / plane, но in a car / taxi."
      ]
    },
    "commonMistakes": [
      {
        "wrong": "in Monday",
        "right": "on Monday",
        "reason": "День недели — отдельная клетка календаря, поэтому on."
      },
      {
        "wrong": "at the morning",
        "right": "in the morning",
        "reason": "Часть дня — период, поэтому in. Исключение: at night."
      },
      {
        "wrong": "in the bus",
        "right": "on the bus",
        "reason": "С автобусом, поездом и самолётом обычно используется on."
      },
      {
        "wrong": "on the airport",
        "right": "at the airport",
        "reason": "Аэропорт здесь воспринимается как точка назначения."
      }
    ],
    "quiz": [
      {
        "type": "single",
        "difficulty": "1 · Легко",
        "skill": "Точное время",
        "prompt": "The lesson starts ___ 18:30.",
        "options": [
          "in",
          "on",
          "at"
        ],
        "answer": 2,
        "errorFeedback": "Есть ошибка. Подумай, какой предлог нужен для точного времени."
      },
      {
        "type": "select",
        "difficulty": "2 · Базовый уровень",
        "skill": "День и часть дня",
        "prompt": "We have a meeting ___ Friday afternoon.",
        "options": [
          "at",
          "in",
          "on"
        ],
        "answer": 2,
        "errorFeedback": "Есть ошибка. Сначала найди конкретный день, а затем уточнение времени суток."
      },
      {
        "type": "multiple",
        "difficulty": "3 · Средне",
        "skill": "Время, место и транспорт",
        "prompt": "Выбери все грамматически правильные предложения.",
        "options": [
          "My keys are on the table.",
          "We arrived in the airport at 6:00.",
          "She was born in 1992.",
          "I usually read in the bus."
        ],
        "answer": [
          0,
          2
        ],
        "errorFeedback": "Есть ошибка. Проверь каждое предложение отдельно: точка, поверхность, транспорт или пространство с границами."
      },
      {
        "type": "gaps",
        "difficulty": "4 · Сложно",
        "skill": "Смешанный контекст",
        "prompt": "Впиши at, in или on в каждый пропуск.",
        "segments": [
          "",
          " Saturday morning, Anna arrived ",
          " the station ",
          " 8:15. Her ticket was ",
          " her bag, but her phone was ",
          " the car. She met Mark ",
          " the platform, and they had lunch ",
          " a small café ",
          " the city centre."
        ],
        "answers": [
          "on",
          "at",
          "at",
          "in",
          "in",
          "on",
          "at",
          "in"
        ],
        "errorFeedback": "Есть ошибка в одном или нескольких окошках. Красная рамка показывает место ошибки; правильный ответ не показывается."
      }
    ],
    "linkedLessonId": "lesson-6"
  }
];
