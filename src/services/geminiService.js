const {
  getGeminiApiKey,
  getGeminiModel,
  getGeminiProjectId,
  getGeminiGenerateUrl,
} = require('../constants/gemini');

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

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
}

async function analyzeMessagesWithGemini({ prompt, messagesCorpus, meta = {} }) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw Object.assign(new Error('GEMINI_API_KEY não configurada.'), { status: 500 });
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

  const model = getGeminiModel();
  const response = await fetch(getGeminiGenerateUrl(model), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userContent }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || data?.message || `HTTP ${response.status}`;
    throw Object.assign(new Error(`Gemini: ${detail}`), { status: 502 });
  }

  const content = extractGeminiText(data);
  if (!content) {
    const block = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason;
    throw Object.assign(
      new Error(block ? `A Gemini não retornou conteúdo útil (${block}).` : 'A Gemini não retornou conteúdo útil.'),
      { status: 502 },
    );
  }

  return {
    content,
    model: data.modelVersion || model,
    projectId: getGeminiProjectId(),
    truncatedInput: truncated,
  };
}

function splitDiscordContent(text, maxLen = 1900) {
  const chunks = [];
  let remaining = String(text || '').trim();
  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf('\n', maxLen);
    if (cut < Math.floor(maxLen * 0.5)) cut = maxLen;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

/** Envia o texto só como mensagens Discord (sem anexo), particionando se passar de 2000 chars. */
async function sendAsDiscordMessages(channel, { header, content }) {
  const headerText = String(header || '').trim();
  const bodyChunks = splitDiscordContent(content, 1900);
  if (bodyChunks.length === 0) {
    if (headerText) await channel.send({ content: headerText.slice(0, 2000) });
    return { messageCount: headerText ? 1 : 0 };
  }

  let messageCount = 0;
  const firstCombined = headerText ? `${headerText}\n\n${bodyChunks[0]}` : bodyChunks[0];

  if (firstCombined.length <= 2000) {
    await channel.send({ content: firstCombined });
    messageCount += 1;
    for (const chunk of bodyChunks.slice(1)) {
      await channel.send({ content: chunk.slice(0, 2000) });
      messageCount += 1;
    }
  } else {
    if (headerText) {
      await channel.send({ content: headerText.slice(0, 2000) });
      messageCount += 1;
    }
    for (const chunk of bodyChunks) {
      await channel.send({ content: chunk.slice(0, 2000) });
      messageCount += 1;
    }
  }

  return { messageCount };
}

module.exports = {
  analyzeMessagesWithGemini,
  splitDiscordContent,
  sendAsDiscordMessages,
  truncateMessagesCorpus,
};
