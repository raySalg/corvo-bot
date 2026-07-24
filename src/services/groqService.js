const { GROQ_CHAT_URL, getGroqApiKey, getGroqModel } = require('../constants/groq');

const MAX_CONTEXT_CHARS = 100_000;

function truncateMessagesCorpus(text) {
  if (text.length <= MAX_CONTEXT_CHARS) {
    return { text, truncated: false };
  }
  return {
    text: `${text.slice(0, MAX_CONTEXT_CHARS)}\n\n[... conteúdo truncado para caber no contexto da IA ...]`,
    truncated: true,
  };
}

async function analyzeMessagesWithGroq({ prompt, messagesCorpus, meta = {} }) {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw Object.assign(new Error('GROQ_API_KEY não configurada.'), { status: 500 });
  }

  const userPrompt = String(prompt || '').trim();
  if (!userPrompt) {
    throw Object.assign(new Error('Escreva um prompt para orientar a IA.'), { status: 400 });
  }

  const { text: corpus, truncated } = truncateMessagesCorpus(String(messagesCorpus || ''));
  if (!corpus.trim()) {
    throw Object.assign(new Error('Não há mensagens no período para analisar.'), { status: 400 });
  }

  const system = [
    'Você analisa mensagens de canais/fóruns de um servidor Discord.',
    'Siga rigorosamente as instruções do usuário sobre o que produzir (resumo, tópicos, decisões, riscos, etc.).',
    'Responda em português do Brasil, de forma clara e organizada.',
    'Não invente mensagens que não estejam no material fornecido.',
    truncated ? 'Atenção: o material de mensagens foi truncado por tamanho.' : null,
  ]
    .filter(Boolean)
    .join(' ');

  const userContent = [
    `Instruções do usuário:\n${userPrompt}`,
    '',
    meta.from && meta.to ? `Período das mensagens: ${meta.from} → ${meta.to}` : null,
    meta.channelCount != null ? `Canais/tópicos analisados: ${meta.channelCount}` : null,
    meta.messageCount != null ? `Total de mensagens no material: ${meta.messageCount}` : null,
    '',
    'Material (mensagens):',
    corpus,
  ]
    .filter((line) => line != null)
    .join('\n');

  const response = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getGroqModel(),
      temperature: 0.3,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || data?.message || `HTTP ${response.status}`;
    throw Object.assign(new Error(`Groq: ${detail}`), { status: 502 });
  }

  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw Object.assign(new Error('A Groq não retornou conteúdo útil.'), { status: 502 });
  }

  return {
    content,
    model: data.model || getGroqModel(),
    truncatedInput: truncated,
  };
}

function splitDiscordContent(text, maxLen = 1900) {
  const chunks = [];
  let remaining = String(text || '');
  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf('\n', maxLen);
    if (cut < maxLen * 0.5) cut = maxLen;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

module.exports = {
  analyzeMessagesWithGroq,
  splitDiscordContent,
  truncateMessagesCorpus,
};
