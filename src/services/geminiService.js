const {
  getGeminiApiKey,
  getGeminiModel,
  getGeminiModelChain,
  getGeminiProjectId,
  getGeminiGenerateUrl,
} = require('../constants/gemini');

const MAX_CONTEXT_CHARS = 100_000;

/** Modelo que funcionou por último (evita insistir no que acabou de estourar cota). */
let stickyModel = null;

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

function isRetryableModelError(status, data) {
  const msg = String(data?.error?.message || data?.message || '').toLowerCase();
  const statusName = String(data?.error?.status || '').toUpperCase();

  if (status === 429 || status === 503) return true;
  if (statusName === 'RESOURCE_EXHAUSTED' || statusName === 'UNAVAILABLE') return true;
  if (status === 404 && /no longer available|not found|is not found/i.test(msg)) return true;
  if (
    /quota|rate limit|rate_limit|resource.?exhausted|too many requests|exceeded your current|limit:\s*0|exhausted/i.test(
      msg,
    )
  ) {
    return true;
  }
  return false;
}

async function generateWithModel(apiKey, model, { system, userContent }) {
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
  return { response, data };
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

  const preferred = stickyModel || getGeminiModel();
  const chain = getGeminiModelChain(preferred);
  const attempts = [];
  let lastError = null;

  for (let i = 0; i < chain.length; i += 1) {
    const model = chain[i];
    let response;
    let data;

    try {
      ({ response, data } = await generateWithModel(apiKey, model, { system, userContent }));
    } catch (error) {
      attempts.push({ model, ok: false, detail: error.message ?? String(error) });
      console.warn(`[Corvo] Gemini falha de rede em ${model}: ${error.message ?? error}`);
      lastError = Object.assign(new Error(`Gemini (${model}): ${error.message ?? error}`), {
        status: 502,
        model,
      });
      if (i < chain.length - 1) continue;
      throw lastError;
    }

    if (!response.ok) {
      const detail = data?.error?.message || data?.message || `HTTP ${response.status}`;
      const err = Object.assign(new Error(`Gemini (${model}): ${detail}`), {
        status: 502,
        httpStatus: response.status,
        model,
      });
      attempts.push({ model, ok: false, status: response.status, detail });

      if (isRetryableModelError(response.status, data) && i < chain.length - 1) {
        console.warn(
          `[Corvo] Gemini limite/indisponível em ${model} (${response.status}). Tentando próximo modelo…`,
        );
        if (stickyModel === model) stickyModel = null;
        lastError = err;
        continue;
      }
      throw err;
    }

    const content = extractGeminiText(data);
    if (!content) {
      const block = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason;
      const err = Object.assign(
        new Error(
          block
            ? `A Gemini (${model}) não retornou conteúdo útil (${block}).`
            : `A Gemini (${model}) não retornou conteúdo útil.`,
        ),
        { status: 502, model },
      );
      attempts.push({ model, ok: false, detail: block || 'empty' });
      if (i < chain.length - 1) {
        console.warn(`[Corvo] Gemini sem conteúdo útil em ${model}. Tentando próximo modelo…`);
        lastError = err;
        continue;
      }
      throw err;
    }

    const usedFallback = model !== getGeminiModel() || attempts.some((a) => !a.ok);
    stickyModel = model;
    if (usedFallback) {
      console.log(
        `[Corvo] Gemini OK com modelo ${model}${attempts.length ? ` após ${attempts.length} falha(s)` : ''}.`,
      );
    }

    return {
      content,
      model: data.modelVersion || model,
      requestedModel: model,
      projectId: getGeminiProjectId(),
      truncatedInput: truncated,
      fallbackUsed: usedFallback,
      attempts,
    };
  }

  throw (
    lastError ||
    Object.assign(new Error('Nenhum modelo Gemini disponível (limites esgotados).'), { status: 502 })
  );
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
