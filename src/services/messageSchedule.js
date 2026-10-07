const { getDiscordGuildId } = require('../constants/discord');
const { TIME_ZONE, getSaoPauloParts } = require('./exportSchedule');
const MessageSchedule = require('../models/MessageSchedule');

let tickTimer = null;

function toPublicItem(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    enabled: Boolean(doc.enabled),
    channelId: doc.channelId ? String(doc.channelId) : null,
    content: doc.content != null ? String(doc.content) : '',
    mentionRoleId: doc.mentionRoleId ? String(doc.mentionRoleId) : null,
    date: doc.date ? String(doc.date) : null,
    hour: Number.isFinite(Number(doc.hour)) ? Number(doc.hour) : 0,
    minute: Number.isFinite(Number(doc.minute)) ? Number(doc.minute) : 0,
    lastRunKey: doc.lastRunKey ?? null,
    lastSentAt: doc.lastSentAt ? new Date(doc.lastSentAt).toISOString() : null,
    lastError: doc.lastError ?? null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
  };
}

function validateMessageScheduleInput(body, { requireEnabled = false } = {}) {
  if (!body || typeof body !== 'object') {
    throw Object.assign(new Error('Payload inválido.'), { status: 400 });
  }

  const enabled = body.enabled === undefined ? true : Boolean(body.enabled);
  const channelId = body.channelId ? String(body.channelId) : null;
  const content = body.content != null ? String(body.content) : '';
  const mentionRoleId = body.mentionRoleId ? String(body.mentionRoleId) : null;
  const date = body.date ? String(body.date).trim() : null;
  const hour = Number(body.hour);
  const minute = Number(body.minute);

  if (requireEnabled && !enabled) {
    throw Object.assign(new Error('Ative o agendamento para salvar.'), { status: 400 });
  }
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
    mentionRoleId,
    date,
    hour,
    minute,
  };
}

async function listMessageSchedules(targetGuildId = null) {
  const guildId = targetGuildId || getDiscordGuildId() || null;
  const filter = guildId ? { guildId } : {};
  const docs = await MessageSchedule.find(filter).sort({ date: 1, hour: 1, minute: 1, createdAt: 1 }).lean();
  return docs.map(toPublicItem).filter(Boolean);
}

async function getMessageScheduleById(id, targetGuildId = null) {
  const guildId = targetGuildId || getDiscordGuildId();
  const filter = { _id: id };
  if (guildId) filter.guildId = guildId;
  const doc = await MessageSchedule.findOne(filter).lean();
  if (!doc) {
    throw Object.assign(new Error('Agendamento não encontrado.'), { status: 404 });
  }
  return toPublicItem(doc);
}

async function createMessageSchedule(body, targetGuildId = null) {
  const guildId = targetGuildId || getDiscordGuildId();
  if (!guildId) {
    throw Object.assign(new Error('ID do servidor (guildId) é obrigatório para agendar mensagens.'), { status: 400 });
  }
  const validated = validateMessageScheduleInput(body);

  const doc = await MessageSchedule.create({
    guildId,
    ...validated,
    lastRunKey: null,
    lastSentAt: null,
    lastError: null,
  });

  return toPublicItem(doc.toObject());
}

async function updateMessageSchedule(id, body, targetGuildId = null) {
  const guildId = targetGuildId || getDiscordGuildId();
  const filter = { _id: id };
  if (guildId) filter.guildId = guildId;
  const validated = validateMessageScheduleInput(body);

  const doc = await MessageSchedule.findOneAndUpdate(
    filter,
    {
      $set: {
        enabled: validated.enabled,
        channelId: validated.channelId,
        content: validated.content,
        mentionRoleId: validated.mentionRoleId,
        date: validated.date,
        hour: validated.hour,
        minute: validated.minute,
      },
    },
    { new: true },
  ).lean();

  if (!doc) {
    throw Object.assign(new Error('Agendamento não encontrado.'), { status: 404 });
  }

  return toPublicItem(doc);
}

async function deleteMessageSchedule(id, targetGuildId = null) {
  const guildId = targetGuildId || getDiscordGuildId();
  const filter = { _id: id };
  if (guildId) filter.guildId = guildId;
  const doc = await MessageSchedule.findOneAndDelete(filter).lean();
  if (!doc) {
    throw Object.assign(new Error('Agendamento não encontrado.'), { status: 404 });
  }
  return { ok: true, id: String(doc._id) };
}

async function sendMentionIfNeeded(channel, guild, mentionRoleId) {
  if (!mentionRoleId) return 0;

  const roleId = String(mentionRoleId);
  const isEveryone = roleId === guild.id;
  if (isEveryone) {
    await channel.send({
      content: '@everyone',
      allowedMentions: { parse: ['everyone'] },
    });
    return 1;
  }

  const role = await guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    throw new Error('Cargo de menção inválido ou inexistente.');
  }
  await channel.send({
    content: `<@&${role.id}>`,
    allowedMentions: { roles: [role.id] },
  });
  return 1;
}

async function sendScheduledMessageById(client, id, { manual = false } = {}) {
  const doc = await MessageSchedule.findById(id);
  if (!doc) {
    throw Object.assign(new Error('Agendamento não encontrado.'), { status: 404 });
  }

  if (!manual && !doc.enabled) return null;

  const content = String(doc.content || '').trim();
  if (!doc.channelId || !content) {
    throw Object.assign(new Error('Canal e mensagem são obrigatórios.'), { status: 400 });
  }

  const channel = await client.channels.fetch(doc.channelId).catch(() => null);
  if (!channel || channel.guildId !== doc.guildId || !channel.isTextBased?.()) {
    throw Object.assign(new Error('Canal de destino inválido ou inacessível.'), { status: 400 });
  }

  const guild = channel.guild;

  try {
    await sendMentionIfNeeded(channel, guild, doc.mentionRoleId);
    await channel.send({ content: content.slice(0, 2000) });

    const nowParts = getSaoPauloParts();
    doc.lastRunKey = nowParts.runKey;
    doc.lastSentAt = new Date();
    doc.lastError = null;
    if (!manual) doc.enabled = false;
    await doc.save();

    console.log(
      `[Corvo] Mensagem ${manual ? 'manual' : 'agendada'} (${doc._id}) enviada para #${channel.name}.`,
    );

    return {
      ok: true,
      id: String(doc._id),
      channelId: channel.id,
      channelName: channel.name,
      manual: Boolean(manual),
      item: toPublicItem(doc.toObject()),
    };
  } catch (error) {
    doc.lastError = error.message ?? String(error);
    await doc.save().catch(() => null);
    throw error;
  }
}

function matchesScheduleSlot(item, now) {
  if (!item.date) return false;
  const [year, month, day] = item.date.split('-');
  return (
    now.year === year &&
    now.month === month &&
    now.day === day &&
    now.hour === item.hour &&
    now.minute === item.minute
  );
}

async function tickMessageSchedule(client) {
  if (!client?.isReady?.()) return;

  const now = getSaoPauloParts();
  let docs = [];
  try {
    docs = await MessageSchedule.find({ enabled: true }).lean();
  } catch (error) {
    console.error('[Corvo] Falha ao verificar mensagens agendadas no MongoDB:', error.message ?? error);
    return;
  }

  for (const doc of docs) {
    if (!client.guilds.cache.has(doc.guildId)) continue;
    const item = toPublicItem(doc);
    if (!matchesScheduleSlot(item, now)) continue;
    if (item.lastRunKey === now.runKey) continue;

    try {
      await sendScheduledMessageById(client, item.id, { manual: false });
    } catch (error) {
      console.error(`[Corvo] Falha no envio da mensagem agendada ${item.id}:`, error.message ?? error);
    }
  }
}

async function startMessageScheduler(client) {
  try {
    await MessageSchedule.syncIndexes();
  } catch (error) {
    console.warn('[Corvo] syncIndexes MessageSchedule:', error.message ?? error);
  }

  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    void tickMessageSchedule(client);
  }, 20_000);
  console.log('[Corvo] Agendador de mensagens pontuais ativo (MongoDB + America/Sao_Paulo).');
}

module.exports = {
  TIME_ZONE,
  listMessageSchedules,
  getMessageScheduleById,
  createMessageSchedule,
  updateMessageSchedule,
  deleteMessageSchedule,
  validateMessageScheduleInput,
  sendScheduledMessageById,
  startMessageScheduler,
};
