const { getDiscordGuildId } = require('../constants/discord');
const {
  TIME_ZONE,
  buildScheduledExport,
  normalizeDateMode,
  getSaoPauloParts,
} = require('./exportSchedule');
const { analyzeMessagesWithGemini, sendAsDiscordMessages } = require('./geminiService');
const { acquireJobLock, releaseJobLock } = require('./jobLock');
const BoatosSchedule = require('../models/BoatosSchedule');

const DEFAULT_BOATOS = {
  enabled: false,
  sourceChannelIds: [],
  destinationChannelId: null,
  dateMode: 'range',
  dateFrom: null,
  dateTo: null,
  prompt: '',
  hour: 0,
  minute: 0,
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  lastRunKey: null,
  lastRunAt: null,
  lastError: null,
};

let cachedConfig = null;
let tickTimer = null;

function normalizeDays(days, fallback) {
  const source = Array.isArray(days) ? days : fallback;
  return [...new Set(source.map(Number).filter((day) => day >= 0 && day <= 6))].sort((a, b) => a - b);
}

function toPublicConfig(doc) {
  if (!doc) return { ...DEFAULT_BOATOS };

  return {
    enabled: Boolean(doc.enabled),
    sourceChannelIds: Array.isArray(doc.sourceChannelIds) ? doc.sourceChannelIds.map(String) : [],
    destinationChannelId: doc.destinationChannelId ? String(doc.destinationChannelId) : null,
    dateMode: normalizeDateMode(doc.dateMode),
    dateFrom: doc.dateFrom ? String(doc.dateFrom) : null,
    dateTo: doc.dateTo ? String(doc.dateTo) : null,
    prompt: doc.prompt != null ? String(doc.prompt) : '',
    hour: Number.isFinite(Number(doc.hour)) ? Number(doc.hour) : 0,
    minute: Number.isFinite(Number(doc.minute)) ? Number(doc.minute) : 0,
    daysOfWeek: Array.isArray(doc.daysOfWeek) ? doc.daysOfWeek.map(Number) : DEFAULT_BOATOS.daysOfWeek,
    lastRunKey: doc.lastRunKey ?? null,
    lastRunAt: doc.lastRunAt ? new Date(doc.lastRunAt).toISOString() : null,
    lastError: doc.lastError ?? null,
  };
}

function normalizeConfig(next = {}, base = cachedConfig || DEFAULT_BOATOS) {
  return {
    ...DEFAULT_BOATOS,
    ...base,
    ...next,
    sourceChannelIds: Array.isArray(next.sourceChannelIds ?? base.sourceChannelIds)
      ? [...new Set((next.sourceChannelIds ?? base.sourceChannelIds).map(String))]
      : [],
    daysOfWeek: normalizeDays(next.daysOfWeek ?? base.daysOfWeek, DEFAULT_BOATOS.daysOfWeek),
    hour: Math.min(23, Math.max(0, Number(next.hour ?? base.hour ?? 0))),
    minute: Math.min(59, Math.max(0, Number(next.minute ?? base.minute ?? 0))),
    enabled: Boolean(next.enabled ?? base.enabled),
    destinationChannelId: (next.destinationChannelId ?? base.destinationChannelId)
      ? String(next.destinationChannelId ?? base.destinationChannelId)
      : null,
    dateMode: normalizeDateMode(next.dateMode ?? base.dateMode),
    dateFrom: (next.dateFrom ?? base.dateFrom) ? String(next.dateFrom ?? base.dateFrom) : null,
    dateTo: (next.dateTo ?? base.dateTo) ? String(next.dateTo ?? base.dateTo) : null,
    prompt: String(next.prompt ?? base.prompt ?? ''),
    lastRunKey: next.lastRunKey !== undefined ? next.lastRunKey : base.lastRunKey ?? null,
    lastRunAt: next.lastRunAt !== undefined ? next.lastRunAt : base.lastRunAt ?? null,
    lastError: next.lastError !== undefined ? next.lastError : base.lastError ?? null,
  };
}

async function loadBoatosConfig() {
  const guildId = getDiscordGuildId();
  try {
    const doc = await BoatosSchedule.findOne({ guildId }).lean();
    cachedConfig = toPublicConfig(doc);
    return cachedConfig;
  } catch (error) {
    console.error('[Corvo] Falha ao ler agendamento de boatos no MongoDB:', error.message ?? error);
    cachedConfig = { ...DEFAULT_BOATOS };
    return cachedConfig;
  }
}

async function saveBoatosConfig(next) {
  const guildId = getDiscordGuildId();
  const config = normalizeConfig(next);

  const doc = await BoatosSchedule.findOneAndUpdate(
    { guildId },
    {
      $set: {
        guildId,
        enabled: config.enabled,
        sourceChannelIds: config.sourceChannelIds,
        destinationChannelId: config.destinationChannelId,
        dateMode: config.dateMode,
        dateFrom: config.dateFrom,
        dateTo: config.dateTo,
        prompt: config.prompt,
        hour: config.hour,
        minute: config.minute,
        daysOfWeek: config.daysOfWeek,
        lastRunKey: config.lastRunKey,
        lastRunAt: config.lastRunAt ? new Date(config.lastRunAt) : null,
        lastError: config.lastError,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  cachedConfig = toPublicConfig(doc);
  return cachedConfig;
}

function getBoatosConfig() {
  return cachedConfig ? { ...cachedConfig } : { ...DEFAULT_BOATOS };
}

function validateBoatosInput(body) {
  if (!body || typeof body !== 'object') {
    throw Object.assign(new Error('Payload inválido.'), { status: 400 });
  }

  const enabled = Boolean(body.enabled);
  const sourceChannelIds = Array.isArray(body.sourceChannelIds)
    ? [...new Set(body.sourceChannelIds.map(String).filter(Boolean))]
    : [];
  const destinationChannelId = body.destinationChannelId ? String(body.destinationChannelId) : null;
  const dateMode = normalizeDateMode(body.dateMode);
  const dateFrom = body.dateFrom ? String(body.dateFrom).trim() : null;
  const dateTo = body.dateTo ? String(body.dateTo).trim() : null;
  const prompt = body.prompt != null ? String(body.prompt) : '';
  const hour = Number(body.hour);
  const minute = Number(body.minute);
  const daysOfWeek = normalizeDays(body.daysOfWeek, DEFAULT_BOATOS.daysOfWeek);

  if (enabled && sourceChannelIds.length === 0) {
    throw Object.assign(new Error('Selecione ao menos um canal/tópico de origem.'), { status: 400 });
  }
  if (enabled && !destinationChannelId) {
    throw Object.assign(new Error('Selecione o canal de destino dos boatos.'), { status: 400 });
  }
  if (enabled && !prompt.trim()) {
    throw Object.assign(new Error('Escreva um prompt para orientar a geração de boatos.'), { status: 400 });
  }
  if (dateMode === 'range' && (enabled || dateFrom || dateTo)) {
    if (!dateFrom || !dateTo || !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      throw Object.assign(new Error('Informe o período das mensagens (De/Até) no formato AAAA-MM-DD.'), {
        status: 400,
      });
    }
    const fromDate = new Date(`${dateFrom}T00:00:00`);
    const toDate = new Date(`${dateTo}T23:59:59.999`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
      throw Object.assign(new Error('Datas inválidas ou período invertido.'), { status: 400 });
    }
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw Object.assign(new Error('Hora inválida (0–23).'), { status: 400 });
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw Object.assign(new Error('Minuto inválido (0–59).'), { status: 400 });
  }
  if (daysOfWeek.length === 0) {
    throw Object.assign(new Error('Selecione ao menos um dia da semana.'), { status: 400 });
  }

  return {
    enabled,
    sourceChannelIds,
    destinationChannelId,
    dateMode,
    dateFrom,
    dateTo,
    prompt,
    hour,
    minute,
    daysOfWeek,
  };
}

async function runBoatosAnalysis(client, { manual = false } = {}) {
  const config = await loadBoatosConfig();
  if (!manual && !config.enabled) return null;

  if (!config.destinationChannelId || config.sourceChannelIds.length === 0) {
    throw Object.assign(new Error('Agendamento de boatos incompleto: origem e destino são obrigatórios.'), {
      status: 400,
    });
  }
  if (!String(config.prompt || '').trim()) {
    throw Object.assign(new Error('Defina o prompt dos boatos.'), { status: 400 });
  }
  if (normalizeDateMode(config.dateMode) !== 'today' && (!config.dateFrom || !config.dateTo)) {
    throw Object.assign(new Error('Agendamento incompleto: defina o período De/Até das mensagens.'), {
      status: 400,
    });
  }

  acquireJobLock();

  try {
    const { guild, txt, sections, fromRaw, toRaw } = await buildScheduledExport(client, config);
    const destination = await client.channels.fetch(config.destinationChannelId).catch(() => null);

    if (!destination || destination.guildId !== guild.id || !destination.isTextBased?.()) {
      throw new Error('Canal de destino dos boatos inválido ou inacessível.');
    }

    const total = sections.reduce((sum, section) => sum + section.messages.length, 0);
    const analysis = await analyzeMessagesWithGemini({
      prompt: config.prompt,
      messagesCorpus: txt,
      meta: {
        from: fromRaw,
        to: toRaw,
        channelCount: sections.length,
        messageCount: total,
      },
    });

    const periodLabel =
      normalizeDateMode(config.dateMode) === 'today'
        ? `hoje (**${fromRaw}**)`
        : `**${fromRaw} → ${toRaw}**`;

    const header =
      `### Boatos ${manual ? 'manual' : 'agendado'}\n` +
      `Período ${periodLabel} · ${sections.length} canal(is)/tópico(s) · ${total} mensagem(ns)` +
      (analysis.truncatedInput ? ' · material truncado' : '') +
      `\nModelo: \`${analysis.requestedModel || analysis.model}\`` +
      (analysis.fallbackUsed ? ' _(troca automática por limite)_' : '');

    const { messageCount } = await sendAsDiscordMessages(destination, {
      header,
      content: analysis.content,
    });

    const nowParts = getSaoPauloParts();
    await saveBoatosConfig({
      ...config,
      lastRunKey: nowParts.runKey,
      lastRunAt: new Date().toISOString(),
      lastError: null,
    });

    console.log(
      `[Corvo] Boatos ${manual ? 'manual' : 'agendado'} enviado para #${destination.name} (${total} msgs → ${messageCount} mensagem(ns)).`,
    );

    return {
      ok: true,
      total,
      channels: sections.length,
      destinationId: destination.id,
      destinationName: destination.name,
      messageCount,
      from: fromRaw,
      to: toRaw,
      model: analysis.model,
      truncatedInput: analysis.truncatedInput,
    };
  } catch (error) {
    await saveBoatosConfig({
      ...(await loadBoatosConfig()),
      lastError: error.message ?? String(error),
    });
    throw error;
  } finally {
    releaseJobLock();
  }
}

async function tickBoatos(client) {
  if (!client?.isReady?.()) return;

  const config = await loadBoatosConfig();
  if (!config.enabled) return;

  const now = getSaoPauloParts();
  if (now.hour !== config.hour || now.minute !== config.minute) return;
  if (!config.daysOfWeek.includes(now.weekday)) return;
  if (config.lastRunKey === now.runKey) return;

  try {
    await runBoatosAnalysis(client, { manual: false });
  } catch (error) {
    console.error('[Corvo] Falha nos boatos agendados:', error.message ?? error);
  }
}

async function startBoatosScheduler(client) {
  await loadBoatosConfig();
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    void tickBoatos(client);
  }, 20_000);
  console.log('[Corvo] Agendador de boatos ativo (MongoDB + America/Sao_Paulo + Gemini).');
}

module.exports = {
  TIME_ZONE,
  loadBoatosConfig,
  saveBoatosConfig,
  getBoatosConfig,
  validateBoatosInput,
  runBoatosAnalysis,
  startBoatosScheduler,
};
