const { getDiscordGuildId } = require('../constants/discord');
const {
  TIME_ZONE,
  PER_CHANNEL_MAX,
  normalizeDateMode,
  getSaoPauloParts,
  resolveGuild,
  resolveChannelsForExport,
  resolveMessageDateBounds,
} = require('./exportSchedule');
const { collectMessagesInRange, formatMultiChannelTxt } = require('../utils/messageExport');
const { analyzeMessagesWithGemini, sendAsDiscordMessages } = require('./geminiService');
const { acquireJobLock, releaseJobLock } = require('./jobLock');
const BoatosSchedule = require('../models/BoatosSchedule');

const DEFAULT_BOATOS_PROMPT =
  'Com base nas conversas e acontecimentos dos canais selecionados e utilizando o contexto das fichas de personagens (títulos, status, cargos como cavaleiros, lordes, reis, plebeus, etc.), crie um jornal/boletim de boatos, intrigas, rumores e fofocas no tom do servidor, em estilo narrativo imersivo e bem-humorado.';

const DEFAULT_BOATOS = {
  enabled: false,
  sourceChannelIds: [],
  characterSheetChannelIds: [],
  destinationChannelId: null,
  dateMode: 'range',
  dateFrom: null,
  dateTo: null,
  prompt: DEFAULT_BOATOS_PROMPT,
  mentionRoleId: null,
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

  const rawSheets = doc.characterSheetChannelIds ?? doc.sheetChannelIds ?? [];
  return {
    enabled: Boolean(doc.enabled),
    sourceChannelIds: Array.isArray(doc.sourceChannelIds) ? doc.sourceChannelIds.map(String) : [],
    characterSheetChannelIds: Array.isArray(rawSheets) ? rawSheets.map(String) : [],
    destinationChannelId: doc.destinationChannelId ? String(doc.destinationChannelId) : null,
    dateMode: normalizeDateMode(doc.dateMode),
    dateFrom: doc.dateFrom ? String(doc.dateFrom) : null,
    dateTo: doc.dateTo ? String(doc.dateTo) : null,
    prompt: doc.prompt != null ? String(doc.prompt) : '',
    mentionRoleId: doc.mentionRoleId ? String(doc.mentionRoleId) : null,
    hour: Number.isFinite(Number(doc.hour)) ? Number(doc.hour) : 0,
    minute: Number.isFinite(Number(doc.minute)) ? Number(doc.minute) : 0,
    daysOfWeek: Array.isArray(doc.daysOfWeek) ? doc.daysOfWeek.map(Number) : DEFAULT_BOATOS.daysOfWeek,
    lastRunKey: doc.lastRunKey ?? null,
    lastRunAt: doc.lastRunAt ? new Date(doc.lastRunAt).toISOString() : null,
    lastError: doc.lastError ?? null,
  };
}

function normalizeConfig(next = {}, base = cachedConfig || DEFAULT_BOATOS) {
  const rawSheets = next.characterSheetChannelIds ?? next.sheetChannelIds ?? base.characterSheetChannelIds;
  return {
    ...DEFAULT_BOATOS,
    ...base,
    ...next,
    sourceChannelIds: Array.isArray(next.sourceChannelIds ?? base.sourceChannelIds)
      ? [...new Set((next.sourceChannelIds ?? base.sourceChannelIds).map(String))]
      : [],
    characterSheetChannelIds: Array.isArray(rawSheets)
      ? [...new Set(rawSheets.map(String))]
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
    mentionRoleId:
      next.mentionRoleId !== undefined
        ? next.mentionRoleId
          ? String(next.mentionRoleId)
          : null
        : base.mentionRoleId
          ? String(base.mentionRoleId)
          : null,
    lastRunKey: next.lastRunKey !== undefined ? next.lastRunKey : base.lastRunKey ?? null,
    lastRunAt: next.lastRunAt !== undefined ? next.lastRunAt : base.lastRunAt ?? null,
    lastError: next.lastError !== undefined ? next.lastError : base.lastError ?? null,
  };
}

async function loadBoatosConfig(targetGuildId = null) {
  const guildId = targetGuildId || getDiscordGuildId();
  if (!guildId) return { ...DEFAULT_BOATOS };
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

async function saveBoatosConfig(next, targetGuildId = null) {
  const guildId = targetGuildId || getDiscordGuildId();
  if (!guildId) {
    throw Object.assign(new Error('ID do servidor (guildId) é obrigatório para salvar boatos.'), { status: 400 });
  }
  const config = normalizeConfig(next);

  const doc = await BoatosSchedule.findOneAndUpdate(
    { guildId },
    {
      $set: {
        guildId,
        enabled: config.enabled,
        sourceChannelIds: config.sourceChannelIds,
        characterSheetChannelIds: config.characterSheetChannelIds,
        destinationChannelId: config.destinationChannelId,
        dateMode: config.dateMode,
        dateFrom: config.dateFrom,
        dateTo: config.dateTo,
        prompt: config.prompt,
        mentionRoleId: config.mentionRoleId,
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
  const characterSheetChannelIds = Array.isArray(body.characterSheetChannelIds ?? body.sheetChannelIds)
    ? [...new Set((body.characterSheetChannelIds ?? body.sheetChannelIds).map(String).filter(Boolean))]
    : [];
  const destinationChannelId = body.destinationChannelId ? String(body.destinationChannelId) : null;
  const dateMode = normalizeDateMode(body.dateMode);
  const dateFrom = body.dateFrom ? String(body.dateFrom).trim() : null;
  const dateTo = body.dateTo ? String(body.dateTo).trim() : null;
  const prompt = body.prompt != null && String(body.prompt).trim() ? String(body.prompt).trim() : DEFAULT_BOATOS_PROMPT;
  const mentionRoleId = body.mentionRoleId ? String(body.mentionRoleId) : null;
  const hour = Number(body.hour);
  const minute = Number(body.minute);
  const daysOfWeek = normalizeDays(body.daysOfWeek, DEFAULT_BOATOS.daysOfWeek);

  if (enabled && sourceChannelIds.length === 0) {
    throw Object.assign(new Error('Selecione ao menos um canal/tópico de origem.'), { status: 400 });
  }
  if (enabled && !destinationChannelId) {
    throw Object.assign(new Error('Selecione o canal de destino dos boatos.'), { status: 400 });
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
    characterSheetChannelIds,
    destinationChannelId,
    dateMode,
    dateFrom,
    dateTo,
    prompt,
    mentionRoleId,
    hour,
    minute,
    daysOfWeek,
  };
}

async function buildBoatosCorpus(client, config, targetGuildId = null) {
  const guild = await resolveGuild(client, targetGuildId);
  const { fromMs, toMs, fromRaw, toRaw } = resolveMessageDateBounds(config);

  // 1. Canais de Acontecimentos / Origem (filtrados por período de data)
  const sourceChannels = await resolveChannelsForExport(client, guild, config.sourceChannelIds || []);
  if (sourceChannels.length === 0) {
    throw new Error('Nenhum canal/tópico de origem válido para coletar acontecimentos.');
  }

  const sourceSections = [];
  for (const channel of sourceChannels) {
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
      sourceSections.push({
        channelName: label,
        messages,
        truncated: messages.length >= PER_CHANNEL_MAX,
      });
    } catch (error) {
      console.error(`[Corvo] Erro ao coletar #${label} para boatos:`, error.message ?? error);
      sourceSections.push({
        channelName: label,
        messages: [],
        truncated: false,
        error: error.message ?? String(error),
      });
    }
  }

  const totalSource = sourceSections.reduce((sum, s) => sum + s.messages.length, 0);
  if (totalSource === 0) {
    throw new Error(
      'Nenhuma mensagem encontrada nos canais de origem no período selecionado. Escolha canais com mensagens ou ajuste o período De/Até.',
    );
  }

  // 2. Canais de Fichas de Personagens (coleta TODO o histórico sem filtro de data)
  const sheetSections = [];
  const sheetChannelIds = config.characterSheetChannelIds || [];
  let totalSheets = 0;

  if (sheetChannelIds.length > 0) {
    const sheetChannels = await resolveChannelsForExport(client, guild, sheetChannelIds);
    for (const channel of sheetChannels) {
      const label =
        channel.isThread?.() && channel.parent?.name
          ? `${channel.parent.name} › ${channel.name}`
          : channel.name;

      try {
        const messages = await collectMessagesInRange(channel, {
          fromMs: 0,
          toMs: Date.now(),
          maxMessages: PER_CHANNEL_MAX,
        });
        sheetSections.push({
          channelName: label,
          messages,
          truncated: messages.length >= PER_CHANNEL_MAX,
        });
        totalSheets += messages.length;
      } catch (error) {
        console.error(`[Corvo] Erro ao coletar fichas em #${label}:`, error.message ?? error);
        sheetSections.push({
          channelName: label,
          messages: [],
          truncated: false,
          error: error.message ?? String(error),
        });
      }
    }
  }

  // 3. Montar corpus estruturado para a IA
  const corpusBlocks = [];

  if (sheetSections.length > 0 && totalSheets > 0) {
    const sheetTxt = formatMultiChannelTxt({
      guildName: guild.name,
      sections: sheetSections,
      from: 'Início dos tempos',
      to: 'Fichas Atuais',
    });
    corpusBlocks.push(
      `# ==========================================================================\n` +
      `# FICHAS DE PERSONAGENS / STATUS / TÍTULOS / CARGOS (HISTÓRICO COMPLETO)\n` +
      `# ATENÇÃO IA: Use este material como guia permanente de quem é cada personagem,\n` +
      `# seus títulos/patentes (ex: cavaleiro, lorde, rei, plebeu, mago, etc.), classe,\n` +
      `# histórico, linhagem e relacionamentos.\n` +
      `# ==========================================================================\n\n` +
      sheetTxt,
    );
  }

  const sourceTxt = formatMultiChannelTxt({
    guildName: guild.name,
    sections: sourceSections,
    from: fromRaw,
    to: toRaw,
  });

  corpusBlocks.push(
    `# ==========================================================================\n` +
    `# ACONTECIMENTOS E CONVERSAS RECENTES (PERÍODO: ${fromRaw} → ${toRaw})\n` +
    `# Fatos ocorridos, interações e diálogos recentes que servem de matéria-prima para os boatos.\n` +
    `# ==========================================================================\n\n` +
    sourceTxt,
  );

  const combinedTxt = corpusBlocks.join('\n\n\n');

  return {
    guild,
    txt: combinedTxt,
    sourceSections,
    sheetSections,
    totalSource,
    totalSheets,
    fromRaw,
    toRaw,
  };
}

async function runBoatosAnalysis(client, { manual = false, guildId: explicitGuildId } = {}) {
  const targetGuildId = explicitGuildId || getDiscordGuildId() || client.guilds.cache.first()?.id;
  if (!targetGuildId) {
    throw Object.assign(new Error('Nenhum servidor encontrado para executar boatos.'), { status: 400 });
  }

  const config = await loadBoatosConfig(targetGuildId);
  if (!manual && !config.enabled) return null;

  if (!config.destinationChannelId || config.sourceChannelIds.length === 0) {
    throw Object.assign(new Error('Agendamento de boatos incompleto: origem e destino são obrigatórios.'), {
      status: 400,
    });
  }
  const effectivePrompt = String(config.prompt || '').trim() || DEFAULT_BOATOS_PROMPT;
  if (normalizeDateMode(config.dateMode) !== 'today' && (!config.dateFrom || !config.dateTo)) {
    throw Object.assign(new Error('Agendamento incompleto: defina o período De/Até das mensagens.'), {
      status: 400,
    });
  }

  acquireJobLock();

  try {
    const {
      guild,
      txt,
      sourceSections,
      sheetSections,
      totalSource,
      totalSheets,
      fromRaw,
      toRaw,
    } = await buildBoatosCorpus(client, config, targetGuildId);

    const destination = await client.channels.fetch(config.destinationChannelId).catch(() => null);

    if (!destination || destination.guildId !== guild.id || !destination.isTextBased?.()) {
      throw new Error('Canal de destino dos boatos inválido ou inacessível.');
    }

    const analysis = await analyzeMessagesWithGemini({
      prompt: effectivePrompt,
      messagesCorpus: txt,
      meta: {
        from: fromRaw,
        to: toRaw,
        channelCount: sourceSections.length,
        messageCount: totalSource,
        sheetChannelCount: sheetSections.length,
        sheetMessageCount: totalSheets,
      },
    });

    let messageCount = 0;
    if (config.mentionRoleId) {
      const roleId = String(config.mentionRoleId);
      const isEveryone = roleId === guild.id;
      if (isEveryone) {
        await destination.send({
          content: '@everyone',
          allowedMentions: { parse: ['everyone'] },
        });
      } else {
        const role = await guild.roles.fetch(roleId).catch(() => null);
        if (!role) {
          throw new Error('Cargo de menção inválido ou inexistente.');
        }
        await destination.send({
          content: `<@&${role.id}>`,
          allowedMentions: { roles: [role.id] },
        });
      }
      messageCount += 1;
    }

    const sent = await sendAsDiscordMessages(destination, {
      content: analysis.content,
    });
    messageCount += sent.messageCount;

    const nowParts = getSaoPauloParts();
    await saveBoatosConfig({
      ...config,
      lastRunKey: nowParts.runKey,
      lastRunAt: new Date().toISOString(),
      lastError: null,
    }, targetGuildId);

    console.log(
      `[Corvo] Boatos ${manual ? 'manual' : 'agendado'} enviado para #${destination.name} (${totalSource} msgs origem + ${totalSheets} msgs fichas → ${messageCount} msg(s)).`,
    );

    return {
      ok: true,
      total: totalSource,
      sheetTotal: totalSheets,
      channels: sourceSections.length,
      sheetChannels: sheetSections.length,
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
      ...(await loadBoatosConfig(targetGuildId)),
      lastError: error.message ?? String(error),
    }, targetGuildId);
    throw error;
  } finally {
    releaseJobLock();
  }
}

async function tickBoatos(client) {
  if (!client?.isReady?.()) return;

  const now = getSaoPauloParts();

  let activeDocs = [];
  try {
    activeDocs = await BoatosSchedule.find({ enabled: true }).lean();
  } catch (error) {
    console.error('[Corvo] Falha ao buscar agendamentos de boatos no MongoDB:', error.message ?? error);
    return;
  }

  for (const doc of activeDocs) {
    const guildId = doc.guildId;
    if (!client.guilds.cache.has(guildId)) continue;

    const config = toPublicConfig(doc);
    if (now.hour !== config.hour || now.minute !== config.minute) continue;
    if (!config.daysOfWeek.includes(now.weekday)) continue;
    if (config.lastRunKey === now.runKey) continue;

    try {
      await runBoatosAnalysis(client, { manual: false, guildId });
    } catch (error) {
      console.error(`[Corvo] Falha nos boatos agendados (servidor ${guildId}):`, error.message ?? error);
    }
  }
}

async function startBoatosScheduler(client) {
  await loadBoatosConfig();
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    void tickBoatos(client);
  }, 20_000);
  console.log('[Corvo] Agendador de boatos ativo (MongoDB + America/Sao_Paulo + IA).');
}

module.exports = {
  TIME_ZONE,
  DEFAULT_BOATOS_PROMPT,
  loadBoatosConfig,
  saveBoatosConfig,
  getBoatosConfig,
  validateBoatosInput,
  buildBoatosCorpus,
  runBoatosAnalysis,
  startBoatosScheduler,
};
