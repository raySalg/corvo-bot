const { getDiscordGuildId } = require('../constants/discord');
const { TIME_ZONE, getSaoPauloParts } = require('./exportSchedule');
const MessageSchedule = require('../models/MessageSchedule');

const DEFAULT_MESSAGE_SCHEDULE = {
  enabled: false,
  channelId: null,
  content: '',
  date: null,
  hour: 0,
  minute: 0,
  lastRunKey: null,
  lastSentAt: null,
  lastError: null,
};

let cachedConfig = null;
let tickTimer = null;

function toPublicConfig(doc) {
  if (!doc) return { ...DEFAULT_MESSAGE_SCHEDULE };

  return {
    enabled: Boolean(doc.enabled),
    channelId: doc.channelId ? String(doc.channelId) : null,
    content: doc.content != null ? String(doc.content) : '',
    date: doc.date ? String(doc.date) : null,
    hour: Number.isFinite(Number(doc.hour)) ? Number(doc.hour) : 0,
    minute: Number.isFinite(Number(doc.minute)) ? Number(doc.minute) : 0,
    lastRunKey: doc.lastRunKey ?? null,
    lastSentAt: doc.lastSentAt ? new Date(doc.lastSentAt).toISOString() : null,
    lastError: doc.lastError ?? null,
  };
}

function normalizeConfig(next = {}, base = cachedConfig || DEFAULT_MESSAGE_SCHEDULE) {
  return {
    ...DEFAULT_MESSAGE_SCHEDULE,
    ...base,
    ...next,
    enabled: Boolean(next.enabled ?? base.enabled),
    channelId: (next.channelId ?? base.channelId) ? String(next.channelId ?? base.channelId) : null,
    content: String(next.content ?? base.content ?? ''),
    date: (next.date ?? base.date) ? String(next.date ?? base.date) : null,
    hour: Math.min(23, Math.max(0, Number(next.hour ?? base.hour ?? 0))),
    minute: Math.min(59, Math.max(0, Number(next.minute ?? base.minute ?? 0))),
    lastRunKey: next.lastRunKey !== undefined ? next.lastRunKey : base.lastRunKey ?? null,
    lastSentAt: next.lastSentAt !== undefined ? next.lastSentAt : base.lastSentAt ?? null,
    lastError: next.lastError !== undefined ? next.lastError : base.lastError ?? null,
  };
}

async function loadMessageSchedule() {
  const guildId = getDiscordGuildId();
  try {
    const doc = await MessageSchedule.findOne({ guildId }).lean();
    cachedConfig = toPublicConfig(doc);
    return cachedConfig;
  } catch (error) {
    console.error('[Corvo] Falha ao ler mensagem agendada no MongoDB:', error.message ?? error);
    cachedConfig = { ...DEFAULT_MESSAGE_SCHEDULE };
    return cachedConfig;
  }
}

async function saveMessageSchedule(next) {
  const guildId = getDiscordGuildId();
  const config = normalizeConfig(next);

  const doc = await MessageSchedule.findOneAndUpdate(
    { guildId },
    {
      $set: {
        guildId,
        enabled: config.enabled,
        channelId: config.channelId,
        content: config.content,
        date: config.date,
        hour: config.hour,
        minute: config.minute,
        lastRunKey: config.lastRunKey,
        lastSentAt: config.lastSentAt ? new Date(config.lastSentAt) : null,
        lastError: config.lastError,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  cachedConfig = toPublicConfig(doc);
  return cachedConfig;
}

function validateMessageScheduleInput(body) {
  if (!body || typeof body !== 'object') {
    throw Object.assign(new Error('Payload inválido.'), { status: 400 });
  }

  const enabled = Boolean(body.enabled);
  const channelId = body.channelId ? String(body.channelId) : null;
  const content = body.content != null ? String(body.content) : '';
  const date = body.date ? String(body.date).trim() : null;
  const hour = Number(body.hour);
  const minute = Number(body.minute);

  if (!channelId) {
    throw Object.assign(new Error('Selecione o canal de destino.'), { status: 400 });
  }
  if (!content.trim()) {
    throw Object.assign(new Error('Escreva a mensagem a ser enviada.'), { status: 400 });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw Object.assign(new Error('Informe a data no formato AAAA-MM-DD.'), { status: 400 });
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw Object.assign(new Error('Hora inválida (0–23).'), { status: 400 });
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw Object.assign(new Error('Minuto inválido (0–59).'), { status: 400 });
  }
  if (content.length > 2000) {
    throw Object.assign(new Error('A mensagem pode ter no máximo 2000 caracteres.'), { status: 400 });
  }

  return {
    enabled,
    channelId,
    content,
    date,
    hour,
    minute,
  };
}

async function sendScheduledMessage(client, { manual = false } = {}) {
  const config = await loadMessageSchedule();
  if (!manual && !config.enabled) return null;

  const content = String(config.content || '').trim();
  if (!config.channelId || !content) {
    throw Object.assign(new Error('Canal e mensagem são obrigatórios.'), { status: 400 });
  }

  const guildId = getDiscordGuildId();
  const channel = await client.channels.fetch(config.channelId).catch(() => null);
  if (!channel || channel.guildId !== guildId || !channel.isTextBased?.()) {
    throw Object.assign(new Error('Canal de destino inválido ou inacessível.'), { status: 400 });
  }

  try {
    await channel.send({ content: content.slice(0, 2000) });

    const nowParts = getSaoPauloParts();
    await saveMessageSchedule({
      ...config,
      enabled: manual ? config.enabled : false,
      lastRunKey: nowParts.runKey,
      lastSentAt: new Date().toISOString(),
      lastError: null,
    });

    console.log(
      `[Corvo] Mensagem ${manual ? 'manual' : 'agendada'} enviada para #${channel.name}.`,
    );

    return {
      ok: true,
      channelId: channel.id,
      channelName: channel.name,
      manual: Boolean(manual),
    };
  } catch (error) {
    await saveMessageSchedule({
      ...(await loadMessageSchedule()),
      lastError: error.message ?? String(error),
    });
    throw error;
  }
}

function matchesScheduleSlot(config, now) {
  if (!config.date) return false;
  const [year, month, day] = config.date.split('-');
  return (
    now.year === year &&
    now.month === month &&
    now.day === day &&
    now.hour === config.hour &&
    now.minute === config.minute
  );
}

async function tickMessageSchedule(client) {
  if (!client?.isReady?.()) return;

  const config = await loadMessageSchedule();
  if (!config.enabled) return;

  const now = getSaoPauloParts();
  if (!matchesScheduleSlot(config, now)) return;
  if (config.lastRunKey === now.runKey) return;

  try {
    await sendScheduledMessage(client, { manual: false });
  } catch (error) {
    console.error('[Corvo] Falha no envio da mensagem agendada:', error.message ?? error);
  }
}

async function startMessageScheduler(client) {
  await loadMessageSchedule();
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    void tickMessageSchedule(client);
  }, 20_000);
  console.log('[Corvo] Agendador de mensagem pontual ativo (MongoDB + America/Sao_Paulo).');
}

module.exports = {
  TIME_ZONE,
  loadMessageSchedule,
  saveMessageSchedule,
  validateMessageScheduleInput,
  sendScheduledMessage,
  startMessageScheduler,
};
