/** Groq API — env GROQ_API_KEY tem prioridade. */
const GROQ_API_KEY = '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';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

function getGroqApiKey() {
  return process.env.GROQ_API_KEY?.trim() || GROQ_API_KEY;
}

function getGroqModel() {
  return process.env.GROQ_MODEL?.trim() || GROQ_MODEL;
}

module.exports = {
  GROQ_CHAT_URL,
  getGroqApiKey,
  getGroqModel,
};
