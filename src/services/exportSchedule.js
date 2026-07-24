const { ChannelType, AttachmentBuilder } = require('discord.js');
const { getDiscordGuildId } = require('../constants/discord');
const { collectMessagesInRange, formatMultiChannelTxt } = require('../utils/messageExport');
const ExportSchedule = require('../models/ExportSchedule');

const TIME_ZONE = 'America/Sao_Paulo';
const PER_CHANNEL_MAX = 20_000;
const MAX_FILE_BYTES = 24 * 1024 * 1024;

const DEFAULT_SCHEDULE = {
  enabled: false,
  sourceChannelIds: [],
  destinationChannelId: null,
  hour: 0,
  minute: 0,
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  lastRunKey: null,
  lastRunAt: null,
  lastError: null,
};

let cachedConfig = null;
let tickTimer = null;
let running = false;

function toPublicConfig(doc) {
  if (!doc) return { ...DEFAULT_SCHEDULE };

  return {
    enabled: Boolean(doc.enabled),
    sourceChannelIds: Array.isArray(doc.sourceChannelIds) ? doc.sourceChannelIds.map(String) : [],
    destinationChannelId: doc.destinationChannelId ? String(doc.destinationChannelId) : null,
    hour: Number.isFinite(Number(doc.hour)) ? Number(doc.hour) : 0,
    minute: Number.isFinite(Number(doc.minute)) ? Number(doc.minute) : 0,
    daysOfWeek: Array.isArray(doc.daysOfWeek) ? doc.daysOfWeek.map(Number) : DEFAULT_SCHEDULE.daysOfWeek,
    lastRunKey: doc.lastRunKey ?? null,
    lastRunAt: doc.lastRunAt ? new Date(doc.lastRunAt).toISOString() : null,
    lastError: doc.lastError ?? null,
  };
}

function normalizeConfig(next = {}, base = cachedConfig || DEFAULT_SCHEDULE) {
  return {
    ...DEFAULT_SCHEDULE,
    ...base,
    ...next,
    sourceChannelIds: Array.isArray(next.sourceChannelIds ?? base.sourceChannelIds)
      ? [...new Set((next.sourceChannelIds ?? base.sourceChannelIds).map(String))]
      : [],
    daysOfWeek: Array.isArray(next.daysOfWeek ?? base.daysOfWeek)
      ? [...new Set((next.daysOfWeek ?? base.daysOfWeek).map(Number))].sort((a, b) => a - b)
      : DEFAULT_SCHEDULE.daysOfWeek,
    hour: Math.min(23, Math.max(0, Number(next.hour ?? base.hour ?? 0))),
    minute: Math.min(59, Math.max(0, Number(next.minute ?? base.minute ?? 0))),
    enabled: Boolean(next.enabled ?? base.enabled),
    destinationChannelId: (next.destinationChannelId ?? base.destinationChannelId)
      ? String(next.destinationChannelId ?? base.destinationChannelId)
      : null,
    lastRunKey: next.lastRunKey !== undefined ? next.lastRunKey : base.lastRunKey ?? null,
    lastRunAt: next.lastRunAt !== undefined ? next.lastRunAt : base.lastRunAt ?? null,
    lastError: next.lastError !== undefined ? next.lastError : base.lastError ?? null,
  };
}

async function loadScheduleConfig() {
  const guildId = getDiscordGuildId();
  try {
    const doc = await ExportSchedule.findOne({ guildId }).lean();
    cachedConfig = toPublicConfig(doc);
    return cachedConfig;
  } catch (error) {
    console.error('[Corvo] Falha ao ler agendamento no MongoDB:', error.message ?? error);
    cachedConfig = { ...DEFAULT_SCHEDULE };
    return cachedConfig;
  }
}

async function saveScheduleConfig(next) {
  const guildId = getDiscordGuildId();
  const config = normalizeConfig(next);

  const doc = await ExportSchedule.findOneAndUpdate(
    { guildId },
    {
      $set: {
        guildId,
        enabled: config.enabled,
        sourceChannelIds: config.sourceChannelIds,
        destinationChannelId: config.destinationChannelId,
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

function getScheduleConfig() {
  return cachedConfig ? { ...cachedConfig } : { ...DEFAULT_SCHEDULE };
}

function getSaoPauloParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    weekday: weekdayMap[map.weekday] ?? 0,
    year: map.year,
    month: map.month,
    day: map.day,
    hour: Number(map.hour),
    minute: Number(map.minute),
    runKey: `${map.year}-${map.month}-${map.day}-${map.hour}-${map.minute}`,
  };
}

function validateScheduleInput(body) {
  if (!body || typeof body !== 'object') {
    throw Object.assign(new Error('Payload inválido.'), { status: 400 });
  }

  const sourceChannelIds = Array.isArray(body.sourceChannelIds)
    ? [...new Set(body.sourceChannelIds.map(String).filter(Boolean))]
    : [];
  const destinationChannelId = body.destinationChannelId ? String(body.destinationChannelId) : null;
  const hour = Number(body.hour);
  const minute = Number(body.minute);
  const daysOfWeek = Array.isArray(body.daysOfWeek)
    ? [...new Set(body.daysOfWeek.map(Number).filter((day) => day >= 0 && day <= 6))]
    : DEFAULT_SCHEDULE.daysOfWeek;

  if (body.enabled && sourceChannelIds.length === 0) {
    throw Object.assign(new Error('Selecione ao menos um canal/tópico de origem.'), { status: 400 });
  }
  if (body.enabled && !destinationChannelId) {
    throw Object.assign(new Error('Selecione o canal de destino do TXT.'), { status: 400 });
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
    enabled: Boolean(body.enabled),
    sourceChannelIds,
    destinationChannelId,
    hour,
    minute,
    daysOfWeek,
  };
}

async function resolveGuild(client) {
  const guildId = getDiscordGuildId();
  let guild = client.guilds.cache.get(guildId);
  if (!guild) guild = await client.guilds.fetch(guildId);
  return guild;
}

async function buildScheduledExport(client, config) {
  const guild = await resolveGuild(client);
  const sections = [];
  const now = Date.now();

  for (const channelId of config.sourceChannelIds) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.guildId !== guild.id) continue;
    if (!channel.isTextBased?.()) continue;
    if (channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildMedia) continue;

    const messages = await collectMessagesInRange(channel, {
      fromMs: 0,
      toMs: now,
      maxMessages: PER_CHANNEL_MAX,
    });

    sections.push({
      channelName: channel.name,
      messages,
      truncated: messages.length >= PER_CHANNEL_MAX,
    });
  }

  if (sections.length === 0) {
    throw new Error('Nenhum canal válido para exportar.');
  }

  let txt = formatMultiChannelTxt({ guildName: guild.name, sections });
  if (Buffer.byteLength(txt, 'utf8') > MAX_FILE_BYTES) {
    txt = `${txt.slice(0, Math.floor(MAX_FILE_BYTES * 0.9))}\n\n# Arquivo truncado por limite de tamanho do Discord.\n`;
  }

  return { guild, txt, sections };
}

async function runScheduledExport(client, { manual = false } = {}) {
  if (running) {
    throw Object.assign(new Error('Já existe uma exportação em andamento.'), { status: 409 });
  }

  const config = await loadScheduleConfig();
  if (!manual && !config.enabled) return null;
  if (!config.destinationChannelId || config.sourceChannelIds.length === 0) {
    throw Object.assign(new Error('Agendamento incompleto: origem e destino são obrigatórios.'), { status: 400 });
  }

  running = true;
  try {
    const { guild, txt, sections } = await buildScheduledExport(client, config);
    const destination = await client.channels.fetch(config.destinationChannelId).catch(() => null);

    if (!destination || destination.guildId !== guild.id || !destination.isTextBased?.()) {
      throw new Error('Canal de destino inválido ou inacessível.');
    }

    const total = sections.reduce((sum, section) => sum + section.messages.length, 0);
    const stamp = new Date().toISOString().slice(0, 10);
    const file = new AttachmentBuilder(Buffer.from(txt, 'utf8'), {
      name: `export_agendado_${stamp}.txt`,
    });

    await destination.send({
      content:
        `### Exportação ${manual ? 'manual' : 'agendada'}\n` +
        `${sections.length} canal(is) · ${total} mensagem(ns) · fuso ${TIME_ZONE}`,
      files: [file],
    });

    const nowParts = getSaoPauloParts();
    await saveScheduleConfig({
      ...config,
      lastRunKey: nowParts.runKey,
      lastRunAt: new Date().toISOString(),
      lastError: null,
    });

    console.log(`[Corvo] Exportação ${manual ? 'manual' : 'agendada'} enviada para #${destination.name} (${total} msgs).`);
    return { ok: true, total, channels: sections.length, destinationId: destination.id };
  } catch (error) {
    await saveScheduleConfig({
      ...(await loadScheduleConfig()),
      lastError: error.message ?? String(error),
    });
    throw error;
  } finally {
    running = false;
  }
}

async function tickSchedule(client) {
  if (!client?.isReady?.()) return;

  const config = await loadScheduleConfig();
  if (!config.enabled) return;

  const now = getSaoPauloParts();
  if (now.hour !== config.hour || now.minute !== config.minute) return;
  if (!config.daysOfWeek.includes(now.weekday)) return;
  if (config.lastRunKey === now.runKey) return;

  try {
    await runScheduledExport(client, { manual: false });
  } catch (error) {
    console.error('[Corvo] Falha na exportação agendada:', error.message ?? error);
  }
}

async function startExportScheduler(client) {
  await loadScheduleConfig();
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    void tickSchedule(client);
  }, 20_000);
  console.log('[Corvo] Agendador de exportação TXT ativo (MongoDB + America/Sao_Paulo).');
}

module.exports = {
  TIME_ZONE,
  loadScheduleConfig,
  saveScheduleConfig,
  getScheduleConfig,
  validateScheduleInput,
  runScheduledExport,
  startExportScheduler,
  getSaoPauloParts,
};
