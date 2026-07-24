/** Google AI Studio (Gemini) — env GEMINI_API_KEY tem prioridade. */
const GEMINI_API_KEY = 'AQ.Ab8RN6KzGe46jUp6VIsqbU2v0WxZK2CJ43rkikk3pnywjeptPg';
const GEMINI_PROJECT_ID = '20468477723';
const GEMINI_PROJECT_NAME = 'projects/20468477723';
/** Alias estável do AI Studio; override com GEMINI_MODEL. */
const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || GEMINI_API_KEY;
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || GEMINI_MODEL;
}

function getGeminiProjectId() {
  return process.env.GEMINI_PROJECT_ID?.trim() || GEMINI_PROJECT_ID;
}

function getGeminiGenerateUrl(model = getGeminiModel()) {
  return `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`;
}

module.exports = {
  GEMINI_API_BASE,
  GEMINI_PROJECT_NAME,
  getGeminiApiKey,
  getGeminiModel,
  getGeminiProjectId,
  getGeminiGenerateUrl,
};
