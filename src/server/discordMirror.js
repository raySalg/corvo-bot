const path = require('node:path');
const express = require('express');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { getDiscordGuildId } = require('../constants/discord');
const { collectMessagesInRange, formatMessagesAsTxt } = require('../utils/messageExport');
const { fetchAllForumThreads } = require('../utils/forumThreads');
const {
  loadScheduleConfig,
  saveScheduleConfig,
  validateScheduleInput,
  runScheduledExport,
  runScheduledAiAnalysis,
  TIME_ZONE,
} = require('../services/exportSchedule');
const {
  loadBoatosConfig,
  saveBoatosConfig,
  validateBoatosInput,
  runBoatosAnalysis,
} = require('../services/boatosSchedule');
const {
  listMessageSchedules,
  createMessageSchedule,
  updateMessageSchedule,
  deleteMessageSchedule,
  sendScheduledMessageById,
} = require('../services/messageSchedule');
const {
  loadClimateConfig,
  saveClimateConfig,
  validateClimateInput,
  runClimateReport,
} = require('../services/climateSchedule');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public', 'discord-mirror');

function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    globalName: user.globalName ?? null,
    displayName: user.displayName ?? user.globalName ?? user.username,
    bot: Boolean(user.bot),
    avatarUrl: user.displayAvatarURL({ size: 64, extension: 'png' }),
  };
}

function serializeEmbed(embed) {
  const data = embed.data ?? embed;
  return {
    title: data.title ?? null,
    description: data.description ?? null,
    url: data.url ?? null,
    color: data.color ?? null,
    timestamp: data.timestamp ?? null,
    footer: data.footer
      ? { text: data.footer.text ?? null, iconUrl: data.footer.icon_url ?? data.footer.iconURL ?? null }
      : null,
    image: data.image?.url ?? null,
    thumbnail: data.thumbnail?.url ?? null,
    author: data.author
      ? {
          name: data.author.name ?? null,
          iconUrl: data.author.icon_url ?? data.author.iconURL ?? null,
          url: data.author.url ?? null,
        }
      : null,
    fields: Array.isArray(data.fields)
      ? data.fields.map((field) => ({
          name: field.name,
          value: field.value,
          inline: Boolean(field.inline),
        }))
      : [],
  };
}

function serializeAttachment(attachment) {
  return {
    id: attachment.id,
    name: attachment.name,
    url: attachment.url,
    contentType: attachment.contentType ?? null,
    width: attachment.width ?? null,
    height: attachment.height ?? null,
  };
}

function serializeMessage(message) {
  return {
    id: message.id,
    content: message.content ?? '',
    createdAt: message.createdAt?.toISOString?.() ?? new Date(message.createdTimestamp).toISOString(),
    editedAt: message.editedAt?.toISOString?.() ?? null,
    author: serializeUser(message.author),
    embeds: [...message.embeds].map(serializeEmbed),
    attachments: [...message.attachments.values()].map(serializeAttachment),
    pinned: Boolean(message.pinned),
  };
}

function botCanViewChannel(channel, me) {
  if (!channel || channel.isDMBased?.()) return false;

  const readableType =
    channel.type === ChannelType.GuildText ||
    channel.type === ChannelType.GuildAnnouncement ||
    channel.type === ChannelType.GuildForum ||
    channel.type === ChannelType.GuildMedia ||
    channel.type === ChannelType.PublicThread ||
    channel.type === ChannelType.PrivateThread ||
    channel.isTextBased?.();

  if (!readableType) return false;

  if (me?.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (channel.viewable === true) return true;

  const perms = channel.permissionsFor(me);
  if (!perms) return false;
  return perms.has(PermissionFlagsBits.ViewChannel);
}

function botCanReadHistory(channel, me) {
  if (!botCanViewChannel(channel, me)) return false;
  if (me?.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  const perms = channel.permissionsFor(me);
  if (!perms) return true;
  return perms.has(PermissionFlagsBits.ReadMessageHistory);
}

function botCanSendInChannel(channel, me) {
  if (!botCanViewChannel(channel, me)) return false;
  if (me?.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (!me) return false;
  if (channel.isThread?.() && channel.locked) return false;
  const perms = channel.permissionsFor(me);
  if (!perms) return false;
  if (channel.isThread?.()) {
    return perms.has(PermissionFlagsBits.SendMessagesInThreads);
  }
  if (channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildMedia) {
    return false;
  }
  return perms.has(PermissionFlagsBits.SendMessages);
}

function serializeChannelEntry(channel, me, { label } = {}) {
  return {
    id: channel.id,
    name: label || channel.name,
    type: channel.type,
    canSend: botCanSendInChannel(channel, me),
    canRead: botCanReadHistory(channel, me),
  };
}

async function collectForumThreads(forum, me) {
  const threads = await fetchAllForumThreads(forum);
  return threads
    .filter((thread) => botCanViewChannel(thread, me))
    .map((thread) => serializeChannelEntry(thread, me))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function buildChannelTree(guild, me) {
  const categories = [];
  const uncategorized = [];

  const allChannels = [...guild.channels.cache.values()];
  const categoryChannels = allChannels
    .filter((channel) => channel.type === ChannelType.GuildCategory)
    .sort((a, b) => a.rawPosition - b.rawPosition || a.name.localeCompare(b.name));

  const baseChannels = allChannels
    .filter(
      (channel) =>
        (channel.type === ChannelType.GuildText ||
          channel.type === ChannelType.GuildAnnouncement ||
          channel.type === ChannelType.GuildForum ||
          channel.type === ChannelType.GuildMedia) &&
        botCanViewChannel(channel, me),
    )
    .sort((a, b) => a.rawPosition - b.rawPosition || a.name.localeCompare(b.name));

  const byParent = new Map();

  for (const channel of baseChannels) {
    const parentId = channel.parentId ?? null;
    if (!byParent.has(parentId)) byParent.set(parentId, []);

    if (channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildMedia) {
      const threads = await collectForumThreads(channel, me);
      // Entrada do fórum = exporta todos os tópicos na hora do envio
      byParent.get(parentId).push({
        ...serializeChannelEntry(channel, me),
        name: `${channel.name} (todos os tópicos)`,
        canSend: false,
      });
      if (threads.length > 0) {
        byParent.get(parentId).push(
          ...threads.map((thread) => ({
            ...thread,
            name: `${channel.name} › ${thread.name}`,
          })),
        );
      }
      continue;
    }

    byParent.get(parentId).push(serializeChannelEntry(channel, me));
  }

  for (const channel of allChannels) {
    if (!channel.isThread?.()) continue;
    if (channel.parent?.type === ChannelType.GuildForum || channel.parent?.type === ChannelType.GuildMedia) {
      continue;
    }
    if (!botCanViewChannel(channel, me)) continue;

    const parentId = channel.parent?.parentId ?? null;
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    if (byParent.get(parentId).some((entry) => entry.id === channel.id)) continue;

    byParent.get(parentId).push(
      serializeChannelEntry(channel, me, {
        label: channel.parent ? `${channel.parent.name} › ${channel.name}` : channel.name,
      }),
    );
  }

  for (const category of categoryChannels) {
    const channels = byParent.get(category.id) ?? [];
    if (channels.length === 0) continue;
    categories.push({
      id: category.id,
      name: category.name,
      channels,
    });
    byParent.delete(category.id);
  }

  for (const [parentId, channels] of byParent) {
    if (parentId === null) {
      uncategorized.push(...channels);
    } else {
      categories.push({
        id: parentId,
        name: 'Outros',
        channels,
      });
    }
  }

  return { categories, uncategorized };
}

async function resolveGuild(client, requestedGuildId = null) {
  const guildId = requestedGuildId || getDiscordGuildId();
  if (guildId) {
    let guild = client.guilds.cache.get(guildId);
    if (!guild) {
      try {
        guild = await client.guilds.fetch(guildId);
      } catch {
        // guild não encontrado com o ID especificado
      }
    }
    if (guild) return guild;
  }

  // Fallback para o primeiro servidor disponível no cache ou via fetch
  const firstCached = client.guilds.cache.first();
  if (firstCached) return firstCached;

  try {
    const fetched = await client.guilds.fetch();
    const firstEntry = fetched.first();
    if (firstEntry) {
      return await client.guilds.fetch(firstEntry.id);
    }
  } catch {
    // ignore
  }

  throw Object.assign(new Error('O bot não está em nenhum servidor do Discord ou o servidor está inacessível.'), {
    status: 404,
  });
}

async function buildMemberGroups(guild) {
  try {
    await guild.members.fetch();
  } catch (error) {
    console.warn('[Corvo] Não foi possível carregar todos os membros:', error.message ?? error);
  }

  const groupsMap = new Map();

  for (const member of guild.members.cache.values()) {
    if (member.user.bot) continue;

    const role =
      member.roles.hoist ??
      [...member.roles.cache.values()]
        .filter((r) => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)[0] ??
      null;

    const groupKey = role?.id ?? 'online';
    const groupName = role?.name ?? 'Membros';
    const color = role?.hexColor && role.hexColor !== '#000000' ? role.hexColor : '#f2f3f5';

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        id: groupKey,
        name: groupName,
        position: role?.position ?? -1,
        color,
        members: [],
      });
    }

    groupsMap.get(groupKey).members.push({
      id: member.id,
      displayName: member.displayName,
      username: member.user.username,
      avatarUrl: member.displayAvatarURL({ size: 64, extension: 'png' }),
      status: member.presence?.status ?? 'offline',
      color,
    });
  }

  return [...groupsMap.values()]
    .map((group) => ({
      ...group,
      members: group.members.sort((a, b) => a.displayName.localeCompare(b.displayName)),
      count: group.members.length,
    }))
    .filter((group) => group.count > 0)
    .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));
}

function createDiscordMirrorRouter(client) {
  const router = express.Router();

  router.get('/api/guilds', async (_req, res) => {
    try {
      if (!client?.isReady?.()) {
        res.status(503).json({ error: 'Bot ainda conectando ao Discord.' });
        return;
      }

      const guilds = client.guilds.cache.map((guild) => ({
        id: guild.id,
        name: guild.name,
        iconUrl: guild.iconURL({ size: 64, extension: 'png' }),
        memberCount: guild.memberCount,
      }));

      res.json({ guilds });
    } catch (error) {
      console.error('[Corvo] GET /api/guilds:', error);
      res.status(500).json({ error: error.message ?? 'Erro ao listar servidores.' });
    }
  });

  router.get('/api/guild', async (req, res) => {
    try {
      if (!client?.isReady?.()) {
        res.status(503).json({ error: 'Bot ainda conectando ao Discord.' });
        return;
      }

      const guild = await resolveGuild(client, req.query.guildId);
      await guild.channels.fetch().catch(() => null);
      await guild.roles.fetch().catch(() => null);
      const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
      const tree = await buildChannelTree(guild, me);
      const roles = [...guild.roles.cache.values()]
        .filter((role) => role.id === guild.id || !role.managed)
        .sort((a, b) => b.position - a.position)
        .map((role) => ({
          id: role.id,
          name: role.id === guild.id ? '@everyone' : role.name,
          color: role.color || null,
          position: role.position,
        }));

      res.json({
        id: guild.id,
        name: guild.name,
        iconUrl: guild.iconURL({ size: 128, extension: 'png' }),
        categories: tree.categories,
        uncategorized: tree.uncategorized,
        roles,
        bot: serializeUser(client.user),
        botIsAdmin: Boolean(me?.permissions?.has(PermissionFlagsBits.Administrator)),
      });
    } catch (error) {
      console.error('[Corvo] GET /api/guild:', error);
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao carregar servidor.' });
    }
  });

  router.get('/api/channels/:channelId/messages', async (req, res) => {
    try {
      if (!client?.isReady?.()) {
        res.status(503).json({ error: 'Bot ainda conectando ao Discord.' });
        return;
      }

      const channel = await client.channels.fetch(req.params.channelId).catch(() => null);
      if (!channel) {
        res.status(404).json({ error: 'Canal não encontrado ou inacessível.' });
        return;
      }

      const guild = channel.guild || client.guilds.cache.get(channel.guildId);
      if (!guild) {
        res.status(404).json({ error: 'Servidor do canal não encontrado.' });
        return;
      }

      const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
      if (!botCanViewChannel(channel, me)) {
        res.status(403).json({ error: 'Bot sem permissão para ver este canal.' });
        return;
      }

      if (channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildMedia) {
        res.status(400).json({
          error: 'Este é um fórum. Abra um dos tópicos listados (nome › tópico).',
        });
        return;
      }

      if (!channel.isTextBased?.()) {
        res.status(400).json({ error: 'Este canal não possui histórico de mensagens de texto.' });
        return;
      }

      if (!botCanReadHistory(channel, me)) {
        res.status(403).json({ error: 'Bot sem permissão para ler o histórico deste canal.' });
        return;
      }

      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
      const options = { limit };
      if (req.query.before) options.before = String(req.query.before);

      const fetched = await channel.messages.fetch(options);
      const messages = [...fetched.values()]
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .map(serializeMessage);

      res.json({
        channelId: channel.id,
        channelName: channel.name,
        canSend: botCanSendInChannel(channel, me),
        messages,
        hasMore: fetched.size >= limit,
      });
    } catch (error) {
      console.error('[Corvo] GET /api/channels/:id/messages:', error);
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao carregar mensagens.' });
    }
  });

  router.get('/api/channels/:channelId/export', async (req, res) => {
    try {
      if (!client?.isReady?.()) {
        res.status(503).json({ error: 'Bot ainda conectando ao Discord.' });
        return;
      }

      const fromRaw = String(req.query.from || '').trim();
      const toRaw = String(req.query.to || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fromRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
        res.status(400).json({ error: 'Informe from e to no formato AAAA-MM-DD.' });
        return;
      }

      const fromDate = new Date(`${fromRaw}T00:00:00`);
      const toDate = new Date(`${toRaw}T23:59:59.999`);
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        res.status(400).json({ error: 'Datas inválidas.' });
        return;
      }
      if (fromDate > toDate) {
        res.status(400).json({ error: 'A data inicial deve ser anterior ou igual à data final.' });
        return;
      }

      const maxMessages = 50_000;

      const channel = await client.channels.fetch(req.params.channelId).catch(() => null);
      if (!channel) {
        res.status(404).json({ error: 'Canal não encontrado ou inacessível.' });
        return;
      }

      const guild = channel.guild || client.guilds.cache.get(channel.guildId);
      if (!guild) {
        res.status(404).json({ error: 'Servidor do canal não encontrado.' });
        return;
      }

      const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
      if (!botCanViewChannel(channel, me) || !botCanReadHistory(channel, me)) {
        res.status(403).json({ error: 'Bot sem permissão para exportar este canal.' });
        return;
      }

      if (!channel.isTextBased?.() || channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildMedia) {
        res.status(400).json({ error: 'Só é possível exportar canais/tópicos de texto.' });
        return;
      }

      const collected = await collectMessagesInRange(channel, {
        fromMs: fromDate.getTime(),
        toMs: toDate.getTime(),
        maxMessages,
      });

      const txt = formatMessagesAsTxt({
        guildName: guild.name,
        channelName: channel.name,
        from: fromRaw,
        to: toRaw,
        messages: collected,
        truncated: collected.length >= maxMessages,
        maxMessages,
      });

      const safeName = String(channel.name || 'canal')
        .replace(/[^\w\-À-ÿ]+/gi, '_')
        .slice(0, 40);
      const filename = `${safeName}_${fromRaw}_${toRaw}.txt`;

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(txt);
    } catch (error) {
      console.error('[Corvo] GET /api/channels/:id/export:', error);
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao exportar mensagens.' });
    }
  });

  router.post('/api/channels/:channelId/messages', async (req, res) => {
    try {
      if (!client?.isReady?.()) {
        res.status(503).json({ error: 'Bot ainda conectando ao Discord.' });
        return;
      }

      const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
      if (!content) {
        res.status(400).json({ error: 'Informe o conteúdo da mensagem.' });
        return;
      }
      if (content.length > 2000) {
        res.status(400).json({ error: 'Mensagem muito longa (máx. 2000 caracteres).' });
        return;
      }

      const channel = await client.channels.fetch(req.params.channelId).catch(() => null);
      if (!channel) {
        res.status(404).json({ error: 'Canal não encontrado ou inacessível.' });
        return;
      }

      const guild = channel.guild || client.guilds.cache.get(channel.guildId);
      if (!guild) {
        res.status(404).json({ error: 'Servidor do canal não encontrado.' });
        return;
      }

      const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
      if (!botCanSendInChannel(channel, me)) {
        res.status(403).json({ error: 'Bot sem permissão para enviar neste canal.' });
        return;
      }

      const sent = await channel.send({ content });
      res.status(201).json({ message: serializeMessage(sent) });
    } catch (error) {
      console.error('[Corvo] POST /api/channels/:id/messages:', error);
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao enviar mensagem.' });
    }
  });

  router.get('/api/members', async (req, res) => {
    try {
      if (!client?.isReady?.()) {
        res.status(503).json({ error: 'Bot ainda conectando ao Discord.' });
        return;
      }

      const guild = await resolveGuild(client, req.query.guildId);
      const groups = await buildMemberGroups(guild);
      res.json({ guildId: guild.id, groups });
    } catch (error) {
      console.error('[Corvo] GET /api/members:', error);
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao carregar membros.' });
    }
  });

  router.get('/api/export-schedule', async (req, res) => {
    try {
      const guild = await resolveGuild(client, req.query.guildId);
      const config = await loadScheduleConfig(guild.id);
      res.json({
        timezone: TIME_ZONE,
        config,
        storage: 'mongodb',
        guildId: guild.id,
      });
    } catch (error) {
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao carregar agendamento.' });
    }
  });

  router.put('/api/export-schedule', async (req, res) => {
    try {
      const guild = await resolveGuild(client, req.query.guildId || req.body?.guildId);
      const validated = validateScheduleInput(req.body || {});
      const config = await saveScheduleConfig(validated, guild.id);
      res.json({ timezone: TIME_ZONE, config, storage: 'mongodb', guildId: guild.id });
    } catch (error) {
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao salvar agendamento.' });
    }
  });

  router.post('/api/export-schedule/run', async (req, res) => {
    try {
      if (!client?.isReady?.()) {
        res.status(503).json({ error: 'Bot ainda conectando ao Discord.' });
        return;
      }
      const guild = await resolveGuild(client, req.query.guildId || req.body?.guildId);
      const result = await runScheduledExport(client, { manual: true, guildId: guild.id });
      res.json(result);
    } catch (error) {
      console.error('[Corvo] POST /api/export-schedule/run:', error);
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao executar exportação.' });
    }
  });

  router.post('/api/export-schedule/run-ai', async (req, res) => {
    try {
      if (!client?.isReady?.()) {
        res.status(503).json({ error: 'Bot ainda conectando ao Discord.' });
        return;
      }
      const guild = await resolveGuild(client, req.query.guildId || req.body?.guildId);
      const result = await runScheduledAiAnalysis(client, { manual: true, guildId: guild.id });
      res.json(result);
    } catch (error) {
      console.error('[Corvo] POST /api/export-schedule/run-ai:', error);
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao executar análise IA.' });
    }
  });

  router.get('/api/boatos-schedule', async (req, res) => {
    try {
      const guild = await resolveGuild(client, req.query.guildId);
      const config = await loadBoatosConfig(guild.id);
      res.json({
        timezone: TIME_ZONE,
        config,
        storage: 'mongodb',
        guildId: guild.id,
      });
    } catch (error) {
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao carregar agendamento de boatos.' });
    }
  });

  router.put('/api/boatos-schedule', async (req, res) => {
    try {
      const guild = await resolveGuild(client, req.query.guildId || req.body?.guildId);
      const validated = validateBoatosInput(req.body || {});
      const config = await saveBoatosConfig(validated, guild.id);
      res.json({ timezone: TIME_ZONE, config, storage: 'mongodb', guildId: guild.id });
    } catch (error) {
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao salvar agendamento de boatos.' });
    }
  });

  router.post('/api/boatos-schedule/run', async (req, res) => {
    try {
      if (!client?.isReady?.()) {
        res.status(503).json({ error: 'Bot ainda conectando ao Discord.' });
        return;
      }
      const guild = await resolveGuild(client, req.query.guildId || req.body?.guildId);
      const result = await runBoatosAnalysis(client, { manual: true, guildId: guild.id });
      res.json(result);
    } catch (error) {
      console.error('[Corvo] POST /api/boatos-schedule/run:', error);
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao gerar boatos.' });
    }
  });

  router.get('/api/message-schedule', async (req, res) => {
    try {
      const guild = await resolveGuild(client, req.query.guildId);
      const items = await listMessageSchedules(guild.id);
      res.json({
        timezone: TIME_ZONE,
        items,
        storage: 'mongodb',
        guildId: guild.id,
      });
    } catch (error) {
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao carregar mensagens agendadas.' });
    }
  });

  router.post('/api/message-schedule', async (req, res) => {
    try {
      const guild = await resolveGuild(client, req.query.guildId || req.body?.guildId);
      const item = await createMessageSchedule(req.body || {}, guild.id);
      const items = await listMessageSchedules(guild.id);
      res.status(201).json({ timezone: TIME_ZONE, item, items, storage: 'mongodb', guildId: guild.id });
    } catch (error) {
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao criar mensagem agendada.' });
    }
  });

  router.put('/api/message-schedule/:id', async (req, res) => {
    try {
      const guild = await resolveGuild(client, req.query.guildId || req.body?.guildId);
      const item = await updateMessageSchedule(req.params.id, req.body || {}, guild.id);
      const items = await listMessageSchedules(guild.id);
      res.json({ timezone: TIME_ZONE, item, items, storage: 'mongodb', guildId: guild.id });
    } catch (error) {
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao atualizar mensagem agendada.' });
    }
  });

  router.delete('/api/message-schedule/:id', async (req, res) => {
    try {
      const guild = await resolveGuild(client, req.query.guildId);
      await deleteMessageSchedule(req.params.id, guild.id);
      const items = await listMessageSchedules(guild.id);
      res.json({ timezone: TIME_ZONE, items, storage: 'mongodb', guildId: guild.id });
    } catch (error) {
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao remover mensagem agendada.' });
    }
  });

  router.post('/api/message-schedule/:id/run', async (req, res) => {
    try {
      if (!client?.isReady?.()) {
        res.status(503).json({ error: 'Bot ainda conectando ao Discord.' });
        return;
      }
      const guild = await resolveGuild(client, req.query.guildId || req.body?.guildId);
      const result = await sendScheduledMessageById(client, req.params.id, { manual: true });
      const items = await listMessageSchedules(guild.id);
      res.json({ ...result, items });
    } catch (error) {
      console.error('[Corvo] POST /api/message-schedule/:id/run:', error);
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao enviar mensagem.' });
    }
  });

  router.get('/api/climate-schedule', async (req, res) => {
    try {
      const guild = await resolveGuild(client, req.query.guildId);
      const config = await loadClimateConfig(guild.id);
      res.json({
        timezone: TIME_ZONE,
        config,
        storage: 'mongodb',
        guildId: guild.id,
      });
    } catch (error) {
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao carregar clima automatizado.' });
    }
  });

  router.put('/api/climate-schedule', async (req, res) => {
    try {
      const guild = await resolveGuild(client, req.query.guildId || req.body?.guildId);
      const validated = validateClimateInput(req.body || {});
      const current = await loadClimateConfig(guild.id);
      const config = await saveClimateConfig({ ...current, ...validated }, guild.id);
      res.json({ timezone: TIME_ZONE, config, storage: 'mongodb', guildId: guild.id });
    } catch (error) {
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao salvar clima automatizado.' });
    }
  });

  router.post('/api/climate-schedule/run', async (req, res) => {
    try {
      if (!client?.isReady?.()) {
        res.status(503).json({ error: 'Bot ainda conectando ao Discord.' });
        return;
      }
      const guild = await resolveGuild(client, req.query.guildId || req.body?.guildId);
      const result = await runClimateReport(client, { manual: true, guildId: guild.id });
      res.json(result);
    } catch (error) {
      console.error('[Corvo] POST /api/climate-schedule/run:', error);
      res.status(error.status ?? 500).json({ error: error.message ?? 'Erro ao gerar clima.' });
    }
  });

  return router;
}

function mountDiscordMirror(app, client) {
  app.use(express.json({ limit: '32kb' }));
  app.use(createDiscordMirrorRouter(client));
  app.use(express.static(PUBLIC_DIR));

  app.get('/', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
}

module.exports = {
  mountDiscordMirror,
  createDiscordMirrorRouter,
  PUBLIC_DIR,
};
