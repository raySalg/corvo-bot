const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_OPENROUTER_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

/**
 * Modelos de fallback gratuitos testados, ativos e validados em tempo real no OpenRouter.
 * Override via env: OPENROUTER_MODEL_FALLBACKS=modelo1,modelo2,...
 */
const OPENROUTER_MODEL_FALLBACKS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'openrouter/free',
  'liquid/lfm-2.5-2.6b:free',
];

function getOpenRouterApiKey() {
  return process.env.OPENROUTER_API_KEY?.trim() || '';
}

function getOpenRouterModel() {
  return process.env.OPENROUTER_MODEL?.trim() || OPENROUTER_MODEL_FALLBACKS[0];
}

function getOpenRouterFallbackModels() {
  const fromEnv = process.env.OPENROUTER_MODEL_FALLBACKS?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return fromEnv?.length ? fromEnv : [...OPENROUTER_MODEL_FALLBACKS];
}

function getOpenRouterModelChain(preferred = getOpenRouterModel()) {
  const custom = process.env.OPENROUTER_MODEL?.trim();
  const fallbacks = getOpenRouterFallbackModels();
  if (custom) {
    return [...new Set([custom, ...fallbacks])];
  }
  return [...new Set([preferred, ...fallbacks])];
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
