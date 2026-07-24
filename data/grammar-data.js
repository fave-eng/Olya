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
  }
];
