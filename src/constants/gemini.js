/** Alias preferido; se bater limite, o serviço troca automaticamente. */
const GEMINI_MODEL = 'gemini-flash-latest';
/**
 * Cadeia de fallback (modelos com cotas/limites separados no AI Studio).
 * Preferimos flash/lite antes de pro para economizar tokens/custo.
 * Override: GEMINI_MODEL_FALLBACKS=modelo1,modelo2,...
 */
const GEMINI_MODEL_FALLBACKS = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-pro-latest',
];
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || '';
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || GEMINI_MODEL;
}

function getGeminiFallbackModels() {
  const fromEnv = process.env.GEMINI_MODEL_FALLBACKS?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return fromEnv?.length ? fromEnv : [...GEMINI_MODEL_FALLBACKS];
}

/** Preferido primeiro, depois o restante da cadeia sem duplicar. */
function getGeminiModelChain(preferred = getGeminiModel()) {
  return [...new Set([preferred, ...getGeminiFallbackModels()].filter(Boolean))];
}

function getGeminiProjectId() {
  return process.env.GEMINI_PROJECT_ID?.trim() || '';
}

function getGeminiProjectName() {
  const projectId = getGeminiProjectId();
  return projectId ? `projects/${projectId}` : '';
}

function getGeminiGenerateUrl(model = getGeminiModel()) {
  return `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`;
}

module.exports = {
  GEMINI_API_BASE,
  GEMINI_MODEL_FALLBACKS,
  getGeminiApiKey,
  getGeminiModel,
  getGeminiFallbackModels,
  getGeminiModelChain,
  getGeminiProjectId,
  getGeminiProjectName,
  getGeminiGenerateUrl,
};
