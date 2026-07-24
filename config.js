window.APP_CONFIG = {
  student: {
    id: "olya",
    nameRu: "Оля",
    nameEn: "Olya",
    level: "A2",
    textbook: "English File",
    textbookEdition: "Pre-Intermediate · A2–B1"
  },

  supabase: {
    url: "https://zqzgarvmpqqqaobeicpc.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxemdhcnZtcHFxcWFvYmVpY3BjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2ODQwNTIsImV4cCI6MjA5NzI2MDA1Mn0.gARetYwVZfInx3QKS0RvB2I5cOwegPMY5q3nJPX4ZP8",
    authMode: "none",
    tables: {
      homework: "homework_progress",
      vocabulary: "vocabulary_progress",
      vocabularyTopics: "vocabulary_topic_progress",
      grammar: "grammar_progress"
    }
  },

  features: {
    homework: true,
    vocabulary: true,
    grammar: true,
    cloudSync: true,
    telegramNotifications: true
  }
};
