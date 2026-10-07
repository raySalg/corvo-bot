const { ChannelType, AttachmentBuilder } = require('discord.js');
const { getDiscordGuildId } = require('../constants/discord');
const { collectMessagesInRange, formatMultiChannelTxt } = require('../utils/messageExport');
const { fetchAllForumThreads } = require('../utils/forumThreads');
const { analyzeMessagesWithGemini, sendAsDiscordMessages } = require('./geminiService');
const { acquireJobLock, releaseJobLock } = require('./jobLock');
const ExportSchedule = require('../models/ExportSchedule');

const TIME_ZONE = 'America/Sao_Paulo';
const PER_CHANNEL_MAX = 50_000;
const MAX_FILE_BYTES = 24 * 1024 * 1024;

const DEFAULT_SCHEDULE = {
  enabled: false,
  sourceChannelIds: [],
  destinationChannelId: null,
  dateMode: 'range',
  dateFrom: null,
  dateTo: null,
  hour: 0,
  minute: 0,
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  lastRunKey: null,
  lastRunAt: null,
  lastError: null,
  aiEnabled: false,
  aiPrompt: '',
  aiDestinationChannelId: null,
  aiHour: 0,
  aiMinute: 0,
  aiDaysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  aiLastRunKey: null,
  aiLastRunAt: null,
  aiLastError: null,
};

let cachedConfig = null;
let tickTimer = null;

function parseDayBounds(fromRaw, toRaw) {
  const fromDate = new Date(`${fromRaw}T00:00:00`);
  const toDate = new Date(`${toRaw}T23:59:59.999`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw Object.assign(new Error('Datas inválidas.'), { status: 400 });
  }
  if (fromDate > toDate) {
    throw Object.assign(new Error('A data inicial deve ser anterior ou igual à final.'), { status: 400 });
  }
  return { fromMs: fromDate.getTime(), toMs: toDate.getTime(), fromRaw, toRaw };
}

function normalizeDateMode(value) {
  return value === 'today' ? 'today' : 'range';
}

function getSaoPauloDateString(date = new Date()) {
  const parts = getSaoPauloParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Resolve o período efetivo: intervalo fixo ou o dia corrente (America/Sao_Paulo). */
function resolveMessageDateBounds(config) {
  if (normalizeDateMode(config.dateMode) === 'today') {
    const today = getSaoPauloDateString();
    return parseDayBounds(today, today);
  }
  if (!config.dateFrom || !config.dateTo) {
    throw Object.assign(new Error('Defina o período (De/Até) das mensagens no agendamento.'), { status: 400 });
  }
  return parseDayBounds(config.dateFrom, config.dateTo);
}

function normalizeDays(days, fallback) {
  const source = Array.isArray(days) ? days : fallback;
  return [...new Set(source.map(Number).filter((day) => day >= 0 && day <= 6))].sort((a, b) => a - b);
}

function toPublicConfig(doc) {
  if (!doc) return { ...DEFAULT_SCHEDULE };

  return {
    enabled: Boolean(doc.enabled),
    sourceChannelIds: Array.isArray(doc.sourceChannelIds) ? doc.sourceChannelIds.map(String) : [],
    destinationChannelId: doc.destinationChannelId ? String(doc.destinationChannelId) : null,
    dateMode: normalizeDateMode(doc.dateMode),
    dateFrom: doc.dateFrom ? String(doc.dateFrom) : null,
    dateTo: doc.dateTo ? String(doc.dateTo) : null,
    hour: Number.isFinite(Number(doc.hour)) ? Number(doc.hour) : 0,
    minute: Number.isFinite(Number(doc.minute)) ? Number(doc.minute) : 0,
    daysOfWeek: Array.isArray(doc.daysOfWeek) ? doc.daysOfWeek.map(Number) : DEFAULT_SCHEDULE.daysOfWeek,
    lastRunKey: doc.lastRunKey ?? null,
    lastRunAt: doc.lastRunAt ? new Date(doc.lastRunAt).toISOString() : null,
    lastError: doc.lastError ?? null,
    aiEnabled: Boolean(doc.aiEnabled),
    aiPrompt: doc.aiPrompt != null ? String(doc.aiPrompt) : '',
    aiDestinationChannelId: doc.aiDestinationChannelId ? String(doc.aiDestinationChannelId) : null,
    aiHour: Number.isFinite(Number(doc.aiHour)) ? Number(doc.aiHour) : 0,
    aiMinute: Number.isFinite(Number(doc.aiMinute)) ? Number(doc.aiMinute) : 0,
    aiDaysOfWeek: Array.isArray(doc.aiDaysOfWeek)
      ? doc.aiDaysOfWeek.map(Number)
      : DEFAULT_SCHEDULE.aiDaysOfWeek,
    aiLastRunKey: doc.aiLastRunKey ?? null,
    aiLastRunAt: doc.aiLastRunAt ? new Date(doc.aiLastRunAt).toISOString() : null,
    aiLastError: doc.aiLastError ?? null,
  };
}

function normalizeConfig(next = {}, base = cachedConfig || DEFAULT_SCHEDULE) {
  const merged = { ...DEFAULT_SCHEDULE, ...base, ...next };

  return {
    ...DEFAULT_SCHEDULE,
    ...merged,
    sourceChannelIds: Array.isArray(next.sourceChannelIds ?? base.sourceChannelIds)
      ? [...new Set((next.sourceChannelIds ?? base.sourceChannelIds).map(String))]
      : [],
    daysOfWeek: normalizeDays(next.daysOfWeek ?? base.daysOfWeek, DEFAULT_SCHEDULE.daysOfWeek),
    hour: Math.min(23, Math.max(0, Number(next.hour ?? base.hour ?? 0))),
    minute: Math.min(59, Math.max(0, Number(next.minute ?? base.minute ?? 0))),
    enabled: Boolean(next.enabled ?? base.enabled),
    destinationChannelId: (next.destinationChannelId ?? base.destinationChannelId)
      ? String(next.destinationChannelId ?? base.destinationChannelId)
      : null,
    dateMode: normalizeDateMode(next.dateMode ?? base.dateMode),
    dateFrom: (next.dateFrom ?? base.dateFrom) ? String(next.dateFrom ?? base.dateFrom) : null,
    dateTo: (next.dateTo ?? base.dateTo) ? String(next.dateTo ?? base.dateTo) : null,
    lastRunKey: next.lastRunKey !== undefined ? next.lastRunKey : base.lastRunKey ?? null,
    lastRunAt: next.lastRunAt !== undefined ? next.lastRunAt : base.lastRunAt ?? null,
    lastError: next.lastError !== undefined ? next.lastError : base.lastError ?? null,
    aiEnabled: Boolean(next.aiEnabled ?? base.aiEnabled),
    aiPrompt: String(next.aiPrompt ?? base.aiPrompt ?? ''),
    aiDestinationChannelId: (next.aiDestinationChannelId ?? base.aiDestinationChannelId)
      ? String(next.aiDestinationChannelId ?? base.aiDestinationChannelId)
      : null,
    aiHour: Math.min(23, Math.max(0, Number(next.aiHour ?? base.aiHour ?? 0))),
    aiMinute: Math.min(59, Math.max(0, Number(next.aiMinute ?? base.aiMinute ?? 0))),
    aiDaysOfWeek: normalizeDays(next.aiDaysOfWeek ?? base.aiDaysOfWeek, DEFAULT_SCHEDULE.aiDaysOfWeek),
    aiLastRunKey: next.aiLastRunKey !== undefined ? next.aiLastRunKey : base.aiLastRunKey ?? null,
    aiLastRunAt: next.aiLastRunAt !== undefined ? next.aiLastRunAt : base.aiLastRunAt ?? null,
    aiLastError: next.aiLastError !== undefined ? next.aiLastError : base.aiLastError ?? null,
  };
}

async function loadScheduleConfig(targetGuildId = null) {
  const guildId = targetGuildId || getDiscordGuildId();
  if (!guildId) return { ...DEFAULT_SCHEDULE };
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

async function saveScheduleConfig(next, targetGuildId = null) {
  const guildId = targetGuildId || getDiscordGuildId();
  if (!guildId) {
    throw Object.assign(new Error('ID do servidor (guildId) é obrigatório para salvar o agendamento.'), { status: 400 });
  }
  const config = normalizeConfig(next);

  const doc = await ExportSchedule.findOneAndUpdate(
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
        hour: config.hour,
        minute: config.minute,
        daysOfWeek: config.daysOfWeek,
        lastRunKey: config.lastRunKey,
        lastRunAt: config.lastRunAt ? new Date(config.lastRunAt) : null,
        lastError: config.lastError,
        aiEnabled: config.aiEnabled,
        aiPrompt: config.aiPrompt,
        aiDestinationChannelId: config.aiDestinationChannelId,
        aiHour: config.aiHour,
        aiMinute: config.aiMinute,
        aiDaysOfWeek: config.aiDaysOfWeek,
        aiLastRunKey: config.aiLastRunKey,
        aiLastRunAt: config.aiLastRunAt ? new Date(config.aiLastRunAt) : null,
        aiLastError: config.aiLastError,
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
  const aiDestinationChannelId = body.aiDestinationChannelId ? String(body.aiDestinationChannelId) : null;
  const dateMode = normalizeDateMode(body.dateMode);
  const dateFrom = body.dateFrom ? String(body.dateFrom).trim() : null;
  const dateTo = body.dateTo ? String(body.dateTo).trim() : null;
  const hour = Number(body.hour);
  const minute = Number(body.minute);
  const aiHour = Number(body.aiHour);
  const aiMinute = Number(body.aiMinute);
  const daysOfWeek = normalizeDays(body.daysOfWeek, DEFAULT_SCHEDULE.daysOfWeek);
  const aiDaysOfWeek = normalizeDays(body.aiDaysOfWeek, DEFAULT_SCHEDULE.aiDaysOfWeek);
  const enabled = Boolean(body.enabled);
  const aiEnabled = Boolean(body.aiEnabled);
  const aiPrompt = body.aiPrompt != null ? String(body.aiPrompt) : '';

  if ((enabled || aiEnabled) && sourceChannelIds.length === 0) {
    throw Object.assign(new Error('Selecione ao menos um canal/tópico de origem.'), { status: 400 });
  }
  if (enabled && !destinationChannelId) {
    throw Object.assign(new Error('Selecione o canal de destino do TXT.'), { status: 400 });
  }
  if (aiEnabled && !aiPrompt.trim()) {
    throw Object.assign(new Error('Escreva um prompt para a análise com IA.'), { status: 400 });
  }
  if (aiEnabled && !aiDestinationChannelId && !destinationChannelId) {
    throw Object.assign(new Error('Selecione o canal de destino da resposta da IA.'), { status: 400 });
  }
  if (dateMode === 'range' && (enabled || aiEnabled || dateFrom || dateTo)) {
    if (!dateFrom || !dateTo || !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      throw Object.assign(new Error('Informe o período das mensagens (De/Até) no formato AAAA-MM-DD.'), {
        status: 400,
      });
    }
    parseDayBounds(dateFrom, dateTo);
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw Object.assign(new Error('Hora do TXT inválida (0–23).'), { status: 400 });
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw Object.assign(new Error('Minuto do TXT inválido (0–59).'), { status: 400 });
  }
  if (!Number.isInteger(aiHour) || aiHour < 0 || aiHour > 23) {
    throw Object.assign(new Error('Hora da IA inválida (0–23).'), { status: 400 });
  }
  if (!Number.isInteger(aiMinute) || aiMinute < 0 || aiMinute > 59) {
    throw Object.assign(new Error('Minuto da IA inválido (0–59).'), { status: 400 });
  }
  if (daysOfWeek.length === 0) {
    throw Object.assign(new Error('Selecione ao menos um dia da semana para o TXT.'), { status: 400 });
  }
  if (aiDaysOfWeek.length === 0) {
    throw Object.assign(new Error('Selecione ao menos um dia da semana para a IA.'), { status: 400 });
  }

  return {
    enabled,
    sourceChannelIds,
    destinationChannelId,
    dateMode,
    dateFrom,
    dateTo,
    hour,
    minute,
    daysOfWeek,
    aiEnabled,
    aiPrompt,
    aiDestinationChannelId: aiDestinationChannelId || destinationChannelId,
    aiHour,
    aiMinute,
    aiDaysOfWeek,
  };
}

async function resolveGuild(client, targetGuildId = null) {
  const guildId = targetGuildId || getDiscordGuildId() || client.guilds.cache.first()?.id;
  if (!guildId) {
    throw new Error('Nenhum servidor do Discord encontrado.');
  }
  let guild = client.guilds.cache.get(guildId);
  if (!guild) guild = await client.guilds.fetch(guildId);
  return guild;
}

async function resolveChannelsForExport(client, guild, sourceChannelIds) {
  const resolved = new Map();

  for (const channelId of sourceChannelIds) {
    const channel = await client.channels.fetch(channelId).catch((error) => {
      console.warn(`[Corvo] Canal ${channelId} inacessível:`, error.message ?? error);
      return null;
    });
    if (!channel || channel.guildId !== guild.id) continue;

    if (channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildMedia) {
      const threads = await fetchAllForumThreads(channel);
      console.log(`[Corvo] Fórum #${channel.name}: ${threads.length} tópico(s) para exportar.`);
      for (const thread of threads) {
        if (thread.isTextBased?.()) resolved.set(thread.id, thread);
      }
      continue;
    }

    if (channel.isTextBased?.()) {
      resolved.set(channel.id, channel);
    }
  }

  return [...resolved.values()];
}

async function buildScheduledExport(client, config, targetGuildId = null) {
  const guild = await resolveGuild(client, targetGuildId);
  const { fromMs, toMs, fromRaw, toRaw } = resolveMessageDateBounds(config);
  const channels = await resolveChannelsForExport(client, guild, config.sourceChannelIds);

  if (channels.length === 0) {
    throw new Error('Nenhum canal/tópico válido para exportar (verifique fóruns e permissões).');
  }

  const sections = [];

  for (const channel of channels) {
    const label =
      channel.isThread?.() && channel.parent?.name
        ? `${channel.parent.name} › ${channel.name}`
        : channel.name;

    try {
      const messages = await collectMessagesInRange(channel, {
        fromMs,
        toMs,
        maxMessages: PER_CHANNEL_MAX,
      });

      sections.push({
        channelName: label,
        messages,
        truncated: messages.length >= PER_CHANNEL_MAX,
      });
    } catch (error) {
      console.error(`[Corvo] Erro ao coletar #${label}:`, error.message ?? error);
      sections.push({
        channelName: label,
        messages: [],
        truncated: false,
        error: error.message ?? String(error),
      });
    }
  }

  const withContent = sections.filter((section) => section.messages.length > 0 || section.error);
  if (withContent.length === 0) {
    throw new Error('Nenhuma mensagem encontrada no período para os canais selecionados.');
  }

  let txt = formatMultiChannelTxt({
    guildName: guild.name,
    sections,
    from: fromRaw,
    to: toRaw,
  });
  if (Buffer.byteLength(txt, 'utf8') > MAX_FILE_BYTES) {
    txt = `${txt.slice(0, Math.floor(MAX_FILE_BYTES * 0.9))}\n\n# Arquivo truncado por limite de tamanho do Discord.\n`;
  }

  return { guild, txt, sections, fromRaw, toRaw };
}

async function runScheduledExport(client, { manual = false, guildId: explicitGuildId } = {}) {
  const targetGuildId = explicitGuildId || getDiscordGuildId() || client.guilds.cache.first()?.id;
  if (!targetGuildId) {
    throw Object.assign(new Error('Nenhum servidor encontrado para executar exportação.'), { status: 400 });
  }

  const config = await loadScheduleConfig(targetGuildId);
  if (!manual && !config.enabled) return null;
  if (!config.destinationChannelId || config.sourceChannelIds.length === 0) {
    throw Object.assign(new Error('Agendamento incompleto: origem e destino são obrigatórios.'), { status: 400 });
  }
  if (normalizeDateMode(config.dateMode) !== 'today' && (!config.dateFrom || !config.dateTo)) {
    throw Object.assign(new Error('Agendamento incompleto: defina o período De/Até das mensagens.'), {
      status: 400,
    });
  }

  acquireJobLock();
  try {
    const { guild, txt, sections, fromRaw, toRaw } = await buildScheduledExport(client, config, targetGuildId);
    const destination = await client.channels.fetch(config.destinationChannelId).catch(() => null);

    if (!destination || destination.guildId !== guild.id || !destination.isTextBased?.()) {
      throw new Error('Canal de destino inválido ou inacessível.');
    }

    const total = sections.reduce((sum, section) => sum + section.messages.length, 0);
    const stamp = `${fromRaw}_${toRaw}`;
    const file = new AttachmentBuilder(Buffer.from(txt, 'utf8'), {
      name: `export_${stamp}.txt`,
    });

    const periodLabel =
      normalizeDateMode(config.dateMode) === 'today'
        ? `hoje (**${fromRaw}**)`
        : `**${fromRaw} → ${toRaw}**`;

    await destination.send({
      content:
        `### Exportação ${manual ? 'manual' : 'agendada'}\n` +
        `Período ${periodLabel} · ${sections.length} canal(is)/tópico(s) · ${total} mensagem(ns)`,
      files: [file],
    });

    const nowParts = getSaoPauloParts();
    await saveScheduleConfig({
      ...config,
      lastRunKey: nowParts.runKey,
      lastRunAt: new Date().toISOString(),
      lastError: null,
    }, targetGuildId);

    console.log(
      `[Corvo] Exportação ${manual ? 'manual' : 'agendada'} enviada para #${destination.name} (${total} msgs, ${sections.length} canais).`,
    );
    return { ok: true, total, channels: sections.length, destinationId: destination.id, from: fromRaw, to: toRaw };
  } catch (error) {
    await saveScheduleConfig({
      ...(await loadScheduleConfig(targetGuildId)),
      lastError: error.message ?? String(error),
    }, targetGuildId);
    throw error;
  } finally {
    releaseJobLock();
  }
}

async function runScheduledAiAnalysis(client, { manual = false, guildId: explicitGuildId } = {}) {
  const targetGuildId = explicitGuildId || getDiscordGuildId() || client.guilds.cache.first()?.id;
  if (!targetGuildId) {
    throw Object.assign(new Error('Nenhum servidor encontrado para executar análise IA.'), { status: 400 });
  }

  const config = await loadScheduleConfig(targetGuildId);
  if (!manual && !config.aiEnabled) return null;

  const destinationId = config.aiDestinationChannelId || config.destinationChannelId;
  if (!destinationId || config.sourceChannelIds.length === 0) {
    throw Object.assign(new Error('Agendamento de IA incompleto: origem e destino são obrigatórios.'), {
      status: 400,
    });
  }
  if (!String(config.aiPrompt || '').trim()) {
    throw Object.assign(new Error('Defina o prompt da análise com IA.'), { status: 400 });
  }
  if (normalizeDateMode(config.dateMode) !== 'today' && (!config.dateFrom || !config.dateTo)) {
    throw Object.assign(new Error('Agendamento incompleto: defina o período De/Até das mensagens.'), {
      status: 400,
    });
  }

  acquireJobLock();
  try {
    const { guild, txt, sections, fromRaw, toRaw } = await buildScheduledExport(client, config, targetGuildId);
    const destination = await client.channels.fetch(destinationId).catch(() => null);

    if (!destination || destination.guildId !== guild.id || !destination.isTextBased?.()) {
      throw new Error('Canal de destino da IA inválido ou inacessível.');
    }

    const total = sections.reduce((sum, section) => sum + section.messages.length, 0);
    const analysis = await analyzeMessagesWithGemini({
      prompt: config.aiPrompt,
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
      `### Análise IA ${manual ? 'manual' : 'agendada'}\n` +
      `Período ${periodLabel} · ${sections.length} canal(is)/tópico(s) · ${total} mensagem(ns)` +
      (analysis.truncatedInput ? ' · material truncado' : '') +
      `\nModelo: \`${analysis.requestedModel || analysis.model}\`` +
      (analysis.fallbackUsed ? ' _(troca automática por limite)_' : '');

    const { messageCount } = await sendAsDiscordMessages(destination, {
      header,
      content: analysis.content,
    });

    const nowParts = getSaoPauloParts();
    await saveScheduleConfig({
      ...config,
      aiLastRunKey: nowParts.runKey,
      aiLastRunAt: new Date().toISOString(),
      aiLastError: null,
    }, targetGuildId);

    console.log(
      `[Corvo] Análise IA ${manual ? 'manual' : 'agendada'} enviada para #${destination.name} (${total} msgs → ${messageCount} mensagem(ns) Discord).`,
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
    await saveScheduleConfig({
      ...(await loadScheduleConfig(targetGuildId)),
      aiLastError: error.message ?? String(error),
    }, targetGuildId);
    throw error;
  } finally {
    releaseJobLock();
  }
}

async function tickSchedule(client) {
  if (!client?.isReady?.()) return;

  const now = getSaoPauloParts();

  let activeDocs = [];
  try {
    activeDocs = await ExportSchedule.find({
      $or: [{ enabled: true }, { aiEnabled: true }],
    }).lean();
  } catch (error) {
    console.error('[Corvo] Falha ao verificar agendamentos no MongoDB:', error.message ?? error);
    return;
  }

  for (const doc of activeDocs) {
    const guildId = doc.guildId;
    if (!client.guilds.cache.has(guildId)) continue;

    const config = toPublicConfig(doc);

    if (
      config.enabled &&
      now.hour === config.hour &&
      now.minute === config.minute &&
      config.daysOfWeek.includes(now.weekday) &&
      config.lastRunKey !== now.runKey
    ) {
      try {
        await runScheduledExport(client, { manual: false, guildId });
      } catch (error) {
        console.error(`[Corvo] Falha na exportação agendada (servidor ${guildId}):`, error.message ?? error);
      }
    }

    if (
      config.aiEnabled &&
      now.hour === config.aiHour &&
      now.minute === config.aiMinute &&
      config.aiDaysOfWeek.includes(now.weekday) &&
      config.aiLastRunKey !== now.runKey
    ) {
      try {
        await runScheduledAiAnalysis(client, { manual: false, guildId });
      } catch (error) {
        console.error(`[Corvo] Falha na análise IA agendada (servidor ${guildId}):`, error.message ?? error);
      }
    }
  }
}

async function startExportScheduler(client) {
  await loadScheduleConfig();
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    void tickSchedule(client);
  }, 20_000);
  console.log('[Corvo] Agendador TXT + IA ativo (MongoDB + America/Sao_Paulo + Gemini).');
}

module.exports = {
  TIME_ZONE,
  loadScheduleConfig,
  saveScheduleConfig,
  getScheduleConfig,
  validateScheduleInput,
  runScheduledExport,
  runScheduledAiAnalysis,
  startExportScheduler,
  getSaoPauloParts,
  buildScheduledExport,
  normalizeDateMode,
};
