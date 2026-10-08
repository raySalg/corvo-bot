const {
  getGeminiApiKey,
  getGeminiModel,
  getGeminiModelChain,
  getGeminiProjectId,
  getGeminiGenerateUrl,
} = require('../constants/gemini');

const {
  OPENROUTER_CHAT_URL,
  getOpenRouterApiKey,
  getOpenRouterModel,
  getOpenRouterModelChain,
  getAiProvider,
} = require('../constants/openrouter');

const MAX_CONTEXT_CHARS = 100_000;

/** Modelo que funcionou por último no Gemini / OpenRouter */
let stickyGeminiModel = null;
let stickyOpenRouterModel = null;

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

function extractOpenRouterText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return '';
}

function isRetryableModelError(status, data) {
  const msg = String(data?.error?.message || data?.message || data?.error || '').toLowerCase();
  const statusName = String(data?.error?.status || '').toUpperCase();

  if (status === 429 || status === 503 || status === 502 || status === 504 || status === 408) return true;
  if (statusName === 'RESOURCE_EXHAUSTED' || statusName === 'UNAVAILABLE') return true;
  if (
    /unavailable for free|paid version is available|use this slug instead|no endpoints|no available providers|not found|no longer available|temporarily unavailable|rate limit|quota|resource.?exhausted|too many requests|limit:\s*0|overloaded|provider error|capacity|busy/i.test(
      msg,
    )
  ) {
    return true;
  }
  if (status === 404 || status === 400) {
    if (/endpoint|model|not found|unavailable|provider|free/i.test(msg)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// OpenRouter API
// ---------------------------------------------------------------------------

async function generateWithOpenRouterModel(apiKey, model, { system, userContent, temperature = 0.3 }) {
  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/raySalg/sete-bot',
      'X-Title': 'Corvo Discord Bot',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
      temperature,
    }),
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function callOpenRouterWithRetry({ system, userContent, temperature = 0.3 }) {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw Object.assign(new Error('OPENROUTER_API_KEY não configurada.'), { status: 500 });
  }

  const preferred = stickyOpenRouterModel || getOpenRouterModel();
  const chain = getOpenRouterModelChain(preferred);
  const attempts = [];
  let lastError = null;

  for (let i = 0; i < chain.length; i += 1) {
    const model = chain[i];
    let response;
    let data;

    try {
      ({ response, data } = await generateWithOpenRouterModel(apiKey, model, {
        system,
        userContent,
        temperature,
      }));
    } catch (error) {
      attempts.push({ model, ok: false, detail: error.message ?? String(error) });
      console.warn(`[Corvo] OpenRouter falha de rede em ${model}: ${error.message ?? error}`);
      lastError = Object.assign(new Error(`OpenRouter (${model}): ${error.message ?? error}`), {
        status: 502,
        model,
      });
      if (i < chain.length - 1) continue;
      throw lastError;
    }

    if (!response.ok) {
      const detail = data?.error?.message || data?.message || `HTTP ${response.status}`;
      const err = Object.assign(new Error(`OpenRouter (${model}): ${detail}`), {
        status: 502,
        httpStatus: response.status,
        model,
      });
      attempts.push({ model, ok: false, status: response.status, detail });

      if (isRetryableModelError(response.status, data) && i < chain.length - 1) {
        console.warn(
          `[Corvo] OpenRouter indisponível/limite em ${model} (${response.status}). Tentando próximo modelo…`,
        );
        if (stickyOpenRouterModel === model) stickyOpenRouterModel = null;
        lastError = err;
        continue;
      }
      throw err;
    }

    const content = extractOpenRouterText(data);
    if (!content) {
      const err = Object.assign(new Error(`OpenRouter (${model}) não retornou conteúdo útil.`), {
        status: 502,
        model,
      });
      attempts.push({ model, ok: false, detail: 'empty' });
      if (i < chain.length - 1) {
        console.warn(`[Corvo] OpenRouter sem conteúdo útil em ${model}. Tentando próximo modelo…`);
        lastError = err;
        continue;
      }
      throw err;
    }

    const usedFallback = model !== getOpenRouterModel() || attempts.some((a) => !a.ok);
    stickyOpenRouterModel = model;
    if (usedFallback) {
      console.log(
        `[Corvo] OpenRouter OK com modelo ${model}${attempts.length ? ` após ${attempts.length} falha(s)` : ''}.`,
      );
    } else {
      console.log(`[Corvo] OpenRouter OK com modelo ${model}.`);
    }

    return {
      content,
      model,
      provider: 'openrouter',
      fallbackUsed: usedFallback,
      attempts,
    };
  }

  throw (
    lastError ||
    Object.assign(new Error('Nenhum modelo OpenRouter disponível no momento.'), { status: 502 })
  );
}

// ---------------------------------------------------------------------------
// Google Gemini API
// ---------------------------------------------------------------------------

async function generateWithGeminiModel(apiKey, model, { system, userContent, temperature = 0.3 }) {
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
        temperature,
        maxOutputTokens: 8192,
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function callGeminiWithRetry({ system, userContent, temperature = 0.3 }) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw Object.assign(new Error('GEMINI_API_KEY não configurada.'), { status: 500 });
  }

  const preferred = stickyGeminiModel || getGeminiModel();
  const chain = getGeminiModelChain(preferred);
  const attempts = [];
  let lastError = null;

  for (let i = 0; i < chain.length; i += 1) {
    const model = chain[i];
    let response;
    let data;

    try {
      ({ response, data } = await generateWithGeminiModel(apiKey, model, { system, userContent, temperature }));
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
        if (stickyGeminiModel === model) stickyGeminiModel = null;
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
    stickyGeminiModel = model;
    if (usedFallback) {
      console.log(
        `[Corvo] Gemini OK com modelo ${model}${attempts.length ? ` após ${attempts.length} falha(s)` : ''}.`,
      );
    } else {
      console.log(`[Corvo] Gemini OK com modelo ${model}.`);
    }

    return {
      content,
      model: data.modelVersion || model,
      requestedModel: model,
      provider: 'gemini',
      projectId: getGeminiProjectId(),
      fallbackUsed: usedFallback,
      attempts,
    };
  }

  throw (
    lastError ||
    Object.assign(new Error('Nenhum modelo Gemini disponível (limites esgotados).'), { status: 502 })
  );
}

// ---------------------------------------------------------------------------
// Unified AI Dispatcher (OpenRouter / Gemini com Fallback Cruzado)
// ---------------------------------------------------------------------------

async function callAiWithRetry({ system, userContent, temperature = 0.3 }) {
  const provider = getAiProvider();
  const hasOpenRouterKey = Boolean(getOpenRouterApiKey());
  const hasGeminiKey = Boolean(getGeminiApiKey());

  if (!hasOpenRouterKey && !hasGeminiKey) {
    throw Object.assign(
      new Error('Nenhuma chave de IA configurada. Defina OPENROUTER_API_KEY ou GEMINI_API_KEY no .env.'),
      { status: 500 },
    );
  }

  if (provider === 'openrouter' && hasOpenRouterKey) {
    try {
      return await callOpenRouterWithRetry({ system, userContent, temperature });
    } catch (err) {
      if (hasGeminiKey) {
        console.warn(`[Corvo] OpenRouter falhou (${err.message}). Tentando fallback para Gemini…`);
        return await callGeminiWithRetry({ system, userContent, temperature });
      }
      throw err;
    }
  }

  if (hasGeminiKey) {
    try {
      return await callGeminiWithRetry({ system, userContent, temperature });
    } catch (err) {
      if (hasOpenRouterKey) {
        console.warn(`[Corvo] Gemini falhou (${err.message}). Tentando fallback para OpenRouter…`);
        return await callOpenRouterWithRetry({ system, userContent, temperature });
      }
      throw err;
    }
  }

  return await callOpenRouterWithRetry({ system, userContent, temperature });
}

// ---------------------------------------------------------------------------
// Business Operations
// ---------------------------------------------------------------------------

async function analyzeMessagesWithAi({ prompt, messagesCorpus, meta = {} }) {
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
    'Siga rigorosamente as instruções do usuário sobre o que produzir (resumo, tópicos, decisões, riscos, boatos, etc.).',
    'Responda em português do Brasil, de forma clara e organizada.',
    'Não invente mensagens que não estejam no material fornecido.',
    meta.sheetChannelCount != null && meta.sheetChannelCount > 0
      ? 'Atenção às fichas de personagens: use-as estritamente como base de conhecimento passiva para consulta de nomes, cargos, patentes e títulos (como cavaleiro, lorde, rei, plebeu, etc.), NUNCA as narre como acontecimentos recentes.'
      : null,
    truncated ? 'Atenção: o material de mensagens foi truncado por tamanho.' : null,
  ]
    .filter(Boolean)
    .join(' ');

  const userContent = [
    `Instruções do usuário:\n${userPrompt}`,
    '',
    meta.from && meta.to ? `Período das mensagens de origem: ${meta.from} → ${meta.to}` : null,
    meta.channelCount != null ? `Canais/tópicos de origem analisados: ${meta.channelCount}` : null,
    meta.messageCount != null ? `Total de mensagens recentes: ${meta.messageCount}` : null,
    meta.sheetChannelCount != null && meta.sheetChannelCount > 0
      ? `Canais de fichas de personagens (histórico completo): ${meta.sheetChannelCount} (${meta.sheetMessageCount || 0} msgs de fichas)`
      : null,
    '',
    'Material (fichas e mensagens):',
    corpus,
  ]
    .filter((line) => line != null)
    .join('\n');

  const result = await callAiWithRetry({ system, userContent });
  return { ...result, truncatedInput: truncated };
}

const CLIMATE_TEMPLATE = `## [Título Principal da Regra ou Sistema]

> [Texto descritivo com o objetivo geral do sistema, introdução ou conceito básico da regra. Serve para dar o tom e explicar o "porquê" daquilo existir.]

## [Nome do Primeiro Subtópico]

> [Explicação da primeira mecânica ou diretriz dentro dessa regra.]

**[Palavra-chave ou Subtítulo Importante]:** [Complemento opcional da frase]

* [Item ou critério 1]
* [Item ou critério 2]
* [Item ou critério 3]

-# [Observação, exceção, punição ou detalhe técnico referente a este subtópico específico.]

## [Temporada]

> [Explicação breve do clima, se está chuvoso, temperado, nublado, céu aberto, etc.]

**[Temperatura média]**`;

const SEASON_LABELS = {
  spring: 'Primavera',
  summer: 'Verão',
  autumn: 'Outono',
  winter: 'Inverno',
};

function normalizeClimateSeason(value) {
  const season = String(value || 'autumn').toLowerCase();
  if (season === 'primavera') return 'spring';
  if (season === 'verao' || season === 'verão') return 'summer';
  if (season === 'outono') return 'autumn';
  if (season === 'inverno') return 'winter';
  if (['spring', 'summer', 'autumn', 'winter'].includes(season)) return season;
  return 'autumn';
}

async function generateClimateWithAi({ season, promptExtra, previousClimate, generatedAtLabel }) {
  const normalizedSeason = normalizeClimateSeason(season);
  const seasonLabel = SEASON_LABELS[normalizedSeason];

  const system = [
    'Você escreve relatórios de clima imersivos para um servidor de roleplay no Discord.',
    'Baseie-se no clima temperado oceânico da Inglaterra: úmido, changeável, chuvas frequentes, invernos frios úmidos e verões raramente quentes.',
    'A temporada selecionada impacta diretamente temperatura, vento, nebulosidade e precipitação.',
    'Se houver clima anterior, faça transição GRADUAL e coerente — sem saltos bruscos de temperatura ou condição.',
    'Responda em português do Brasil.',
    'Use EXATAMENTE o molde Markdown abaixo, preenchendo os colchetes com conteúdo criativo e coerente.',
    'Replique a estrutura de subtópico (##, >, **, *, -#) quantas vezes forem necessárias para descrever o clima do dia.',
    'A seção ## [Temporada] deve usar o nome da temporada atual em português no título.',
    'Inclua temperatura média realista em °C na linha **Temperatura média**.',
    'Não inclua prefácio, explicação ou comentários fora do molde.',
    '',
    'Molde obrigatório:',
    CLIMATE_TEMPLATE,
  ].join('\n');

  const userContent = [
    `Temporada atual: ${seasonLabel} (${normalizedSeason}).`,
    generatedAtLabel ? `Momento do relatório: ${generatedAtLabel}.` : null,
    previousClimate?.trim()
      ? `Clima anterior (use como base para transição gradual):\n${previousClimate.trim()}`
      : 'Não há clima anterior registrado — inicie uma condição plausível para a estação.',
    promptExtra?.trim() ? `Instruções extras do administrador:\n${promptExtra.trim()}` : null,
    '',
    'Gere o relatório de clima de hoje seguindo o molde.',
  ]
    .filter((line) => line != null)
    .join('\n');

  return callAiWithRetry({ system, userContent, temperature: 0.65 });
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
  callAiWithRetry,
  callOpenRouterWithRetry,
  callGeminiWithRetry,
  analyzeMessagesWithAi,
  analyzeMessagesWithGemini: analyzeMessagesWithAi, // Alias retrocompatível
  generateClimateWithAi,
  generateClimateWithGemini: generateClimateWithAi, // Alias retrocompatível
  normalizeClimateSeason,
  SEASON_LABELS,
  splitDiscordContent,
  sendAsDiscordMessages,
  truncateMessagesCorpus,
};
