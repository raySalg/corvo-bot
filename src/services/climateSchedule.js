const { getDiscordGuildId } = require('../constants/discord');
const { getSaoPauloParts, TIME_ZONE } = require('./exportSchedule');
const { generateClimateWithGemini, normalizeClimateSeason, sendAsDiscordMessages, SEASON_LABELS } =
  require('./geminiService');
const { acquireJobLock, releaseJobLock } = require('./jobLock');
const ClimateSchedule = require('../models/ClimateSchedule');

const DEFAULT_CLIMATE = {
  enabled: false,
  destinationChannelId: null,
  season: 'autumn',
  promptExtra: '',
  hour: 8,
  minute: 0,
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  lastClimateContent: null,
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
  if (!doc) return { ...DEFAULT_CLIMATE };

  return {
    enabled: Boolean(doc.enabled),
    destinationChannelId: doc.destinationChannelId ? String(doc.destinationChannelId) : null,
    season: normalizeClimateSeason(doc.season),
    promptExtra: doc.promptExtra != null ? String(doc.promptExtra) : '',
    hour: Number.isFinite(Number(doc.hour)) ? Number(doc.hour) : 8,
    minute: Number.isFinite(Number(doc.minute)) ? Number(doc.minute) : 0,
    daysOfWeek: Array.isArray(doc.daysOfWeek) ? doc.daysOfWeek.map(Number) : DEFAULT_CLIMATE.daysOfWeek,
    lastClimateContent: doc.lastClimateContent != null ? String(doc.lastClimateContent) : null,
    lastRunKey: doc.lastRunKey ?? null,
    lastRunAt: doc.lastRunAt ? new Date(doc.lastRunAt).toISOString() : null,
    lastError: doc.lastError ?? null,
  };
}

function normalizeConfig(next = {}, base = cachedConfig || DEFAULT_CLIMATE) {
  return {
    ...DEFAULT_CLIMATE,
    ...base,
    ...next,
    season: normalizeClimateSeason(next.season ?? base.season),
    destinationChannelId: (next.destinationChannelId ?? base.destinationChannelId)
      ? String(next.destinationChannelId ?? base.destinationChannelId)
      : null,
    promptExtra: String(next.promptExtra ?? base.promptExtra ?? ''),
    daysOfWeek: normalizeDays(next.daysOfWeek ?? base.daysOfWeek, DEFAULT_CLIMATE.daysOfWeek),
    hour: Math.min(23, Math.max(0, Number(next.hour ?? base.hour ?? 8))),
    minute: Math.min(59, Math.max(0, Number(next.minute ?? base.minute ?? 0))),
    enabled: Boolean(next.enabled ?? base.enabled),
    lastClimateContent:
      next.lastClimateContent !== undefined
        ? next.lastClimateContent
        : base.lastClimateContent ?? null,
    lastRunKey: next.lastRunKey !== undefined ? next.lastRunKey : base.lastRunKey ?? null,
    lastRunAt: next.lastRunAt !== undefined ? next.lastRunAt : base.lastRunAt ?? null,
    lastError: next.lastError !== undefined ? next.lastError : base.lastError ?? null,
  };
}

async function loadClimateConfig() {
  const guildId = getDiscordGuildId();
  try {
    const doc = await ClimateSchedule.findOne({ guildId }).lean();
    cachedConfig = toPublicConfig(doc);
    return cachedConfig;
  } catch (error) {
    console.error('[Corvo] Falha ao ler clima automatizado no MongoDB:', error.message ?? error);
    cachedConfig = { ...DEFAULT_CLIMATE };
    return cachedConfig;
  }
}

async function saveClimateConfig(next) {
  const guildId = getDiscordGuildId();
  const config = normalizeConfig(next);

  const doc = await ClimateSchedule.findOneAndUpdate(
    { guildId },
    {
      $set: {
        guildId,
        enabled: config.enabled,
        destinationChannelId: config.destinationChannelId,
        season: config.season,
        promptExtra: config.promptExtra,
        hour: config.hour,
        minute: config.minute,
        daysOfWeek: config.daysOfWeek,
        lastClimateContent: config.lastClimateContent,
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

function getClimateConfig() {
  return cachedConfig ? { ...cachedConfig } : { ...DEFAULT_CLIMATE };
}

function validateClimateInput(body) {
  if (!body || typeof body !== 'object') {
    throw Object.assign(new Error('Payload inválido.'), { status: 400 });
  }

  const enabled = Boolean(body.enabled);
  const destinationChannelId = body.destinationChannelId ? String(body.destinationChannelId) : null;
  const season = normalizeClimateSeason(body.season);
  const promptExtra = body.promptExtra != null ? String(body.promptExtra) : '';
  const hour = Number(body.hour);
  const minute = Number(body.minute);
  const daysOfWeek = normalizeDays(body.daysOfWeek, DEFAULT_CLIMATE.daysOfWeek);

  if (enabled && !destinationChannelId) {
    throw Object.assign(new Error('Selecione o canal de clima.'), { status: 400 });
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
    destinationChannelId,
    season,
    promptExtra,
    hour,
    minute,
    daysOfWeek,
  };
}

function formatClimateTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date);
}

async function runClimateReport(client, { manual = false } = {}) {
  const config = await loadClimateConfig();
  if (!manual && !config.enabled) return null;

  if (!config.destinationChannelId) {
    throw Object.assign(new Error('Canal de clima não configurado.'), { status: 400 });
  }

  acquireJobLock();

  try {
    const guildId = getDiscordGuildId();
    let guild = client.guilds.cache.get(guildId);
    if (!guild) guild = await client.guilds.fetch(guildId);

    const destination = await client.channels.fetch(config.destinationChannelId).catch(() => null);
    if (!destination || destination.guildId !== guild.id || !destination.isTextBased?.()) {
      throw new Error('Canal de clima inválido ou inacessível.');
    }

    const generatedAtLabel = formatClimateTimestamp();
    const analysis = await generateClimateWithGemini({
      season: config.season,
      promptExtra: config.promptExtra,
      previousClimate: config.lastClimateContent,
      generatedAtLabel,
    });

    const sent = await sendAsDiscordMessages(destination, {
      content: analysis.content,
    });

    const nowParts = getSaoPauloParts();
    await saveClimateConfig({
      ...config,
      lastClimateContent: analysis.content,
      lastRunKey: nowParts.runKey,
      lastRunAt: new Date().toISOString(),
      lastError: null,
    });

    console.log(
      `[Corvo] Clima ${manual ? 'manual' : 'agendado'} enviado para #${destination.name} (${sent.messageCount} mensagem(ns)).`,
    );

    return {
      ok: true,
      destinationId: destination.id,
      destinationName: destination.name,
      messageCount: sent.messageCount,
      season: config.season,
      seasonLabel: SEASON_LABELS[normalizeClimateSeason(config.season)],
      model: analysis.model,
    };
  } catch (error) {
    await saveClimateConfig({
      ...(await loadClimateConfig()),
      lastError: error.message ?? String(error),
    });
    throw error;
  } finally {
    releaseJobLock();
  }
}

async function tickClimate(client) {
  if (!client?.isReady?.()) return;

  const config = await loadClimateConfig();
  if (!config.enabled) return;

  const now = getSaoPauloParts();
  if (now.hour !== config.hour || now.minute !== config.minute) return;
  if (!config.daysOfWeek.includes(now.weekday)) return;
  if (config.lastRunKey === now.runKey) return;

  try {
    await runClimateReport(client, { manual: false });
  } catch (error) {
    console.error('[Corvo] Falha no clima agendado:', error.message ?? error);
  }
}

async function startClimateScheduler(client) {
  await loadClimateConfig();
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    void tickClimate(client);
  }, 20_000);
  console.log('[Corvo] Agendador de clima ativo (MongoDB + America/Sao_Paulo + Gemini).');
}

module.exports = {
  TIME_ZONE,
  loadClimateConfig,
  saveClimateConfig,
  getClimateConfig,
  validateClimateInput,
  runClimateReport,
  startClimateScheduler,
};
