const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

/**
 * Modelos de fallback gratuitos no OpenRouter caso o modelo principal atinja limite ou falhe.
 * Override via env: OPENROUTER_MODEL_FALLBACKS=modelo1,modelo2,...
 */
const OPENROUTER_MODEL_FALLBACKS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'deepseek/deepseek-chat:free',
  'nvidia/llama-3.1-nemotron-70b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
];

function getOpenRouterApiKey() {
  return process.env.OPENROUTER_API_KEY?.trim() || '';
}

function getOpenRouterModel() {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
}

function getOpenRouterFallbackModels() {
  const fromEnv = process.env.OPENROUTER_MODEL_FALLBACKS?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return fromEnv?.length ? fromEnv : [...OPENROUTER_MODEL_FALLBACKS];
}

function getOpenRouterModelChain(preferred = getOpenRouterModel()) {
  return [...new Set([preferred, ...getOpenRouterFallbackModels()].filter(Boolean))];
}

function getAiProvider() {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === 'openrouter' || explicit === 'gemini') return explicit;
  if (getOpenRouterApiKey()) return 'openrouter';
  return 'gemini';
}

module.exports = {
  OPENROUTER_API_BASE,
  OPENROUTER_CHAT_URL,
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_MODEL_FALLBACKS,
  getOpenRouterApiKey,
  getOpenRouterModel,
  getOpenRouterFallbackModels,
  getOpenRouterModelChain,
  getAiProvider,
};
