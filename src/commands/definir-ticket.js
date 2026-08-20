const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require('discord.js');
const { requireAdmin } = require('../utils/permissions');
const { sendEphemeral } = require('../utils/interactionReply');
const { randomEmbedColor } = require('../utils/embed');

const COMMAND_PREFIX = 'definir-ticket';
const OPEN_PREFIX = `${COMMAND_PREFIX}:open:`;
const CLOSE_PREFIX = `${COMMAND_PREFIX}:close:`;
const ARCHIVE_PREFIX = `${COMMAND_PREFIX}:archive:`;
const TICKET_OPEN_PREFIX = '🎫·';
const TICKET_CLOSED_PREFIX = '📦·';

function buildCommandData() {
  return new SlashCommandBuilder()
    .setName('definir-ticket')
    .setDescription('Publica um painel de tickets de suporte com botão para abrir tópico.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('titulo')
        .setDescription('Título do painel')
        .setRequired(true)
        .setMaxLength(256),
    )
    .addStringOption((option) =>
      option
        .setName('descricao')
        .setDescription('Descrição / texto do painel')
        .setRequired(true)
        .setMaxLength(4000),
    )
    .addRoleOption((option) =>
      option
        .setName('cargo')
        .setDescription('Cargo mencionado quando um ticket for aberto')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('imagem')
        .setDescription('URL da imagem do painel (opcional)')
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName('botao')
        .setDescription('Texto do botão (padrão: Abrir ticket)')
        .setRequired(false)
        .setMaxLength(80),
    );
}

function parseImageUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Informe uma URL válida para a imagem.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('A imagem deve usar URL http ou https.');
  }

  return url.toString();
}

function sanitizeThreadSlug(username) {
  return (
    String(username || 'user')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
      .slice(0, 32) || 'user'
  );
}

function buildTicketThreadName(prefix, userId, username) {
  const slug = sanitizeThreadSlug(username);
  const suffix = `·${userId}`;
  const maxSlugLen = Math.max(1, 100 - prefix.length - suffix.length);
  return `${prefix}${slug.slice(0, maxSlugLen)}${suffix}`.slice(0, 100);
}

function openTicketThreadName(userId, username) {
  return buildTicketThreadName(TICKET_OPEN_PREFIX, userId, username);
}

function closedTicketThreadName(userId, username) {
  return buildTicketThreadName(TICKET_CLOSED_PREFIX, userId, username);
}

function isTicketForUser(thread, userId) {
  const isTicket =
    thread.name.startsWith(TICKET_OPEN_PREFIX) || thread.name.startsWith(TICKET_CLOSED_PREFIX);
  if (!isTicket) return false;
  return thread.name.endsWith(userId) || thread.name === `${TICKET_OPEN_PREFIX}${userId}`;
}

function parseTicketOwnerIdFromName(name) {
  const match = name.match(/·(\d{17,20})$/);
  return match?.[1] ?? null;
}

function parseTicketSlugFromName(name) {
  const openMatch = name.match(/^🎫·(.+)·(\d{17,20})$/);
  if (openMatch) return openMatch[1];
  const closedMatch = name.match(/^📦·(.+)·(\d{17,20})$/);
  if (closedMatch) return closedMatch[1];
  return null;
}

function parseOpenRoleId(customId) {
  if (!customId.startsWith(OPEN_PREFIX)) return null;
  const roleId = customId.slice(OPEN_PREFIX.length);
  return /^\d{17,20}$/.test(roleId) ? roleId : null;
}

function parseThreadAction(customId, prefix) {
  if (!customId.startsWith(prefix)) return null;
  const rest = customId.slice(prefix.length);
  const [threadId, roleId] = rest.split(':');
  if (!/^\d{17,20}$/.test(threadId) || !/^\d{17,20}$/.test(roleId)) return null;
  return { threadId, roleId };
}

function channelSupportsTickets(channel) {
  if (!channel?.isTextBased?.()) return false;
  if (channel.isThread?.()) return false;

  return (
    channel.type === ChannelType.GuildText ||
    channel.type === ChannelType.GuildAnnouncement
  );
}

function assertBotCanCreateThreads(guild, channel) {
  const me = guild.members.me;
  if (!me) {
    throw new Error('Não consegui verificar minhas permissões neste servidor.');
  }

  const perms = channel.permissionsFor(me);
  if (!perms?.has(PermissionFlagsBits.CreatePrivateThreads)) {
    throw new Error('Preciso da permissão **Criar tópicos privados** neste canal.');
  }

  if (!perms.has(PermissionFlagsBits.SendMessagesInThreads)) {
    throw new Error('Preciso da permissão **Enviar mensagens em tópicos** neste canal.');
  }

  if (!perms.has(PermissionFlagsBits.ManageThreads)) {
    throw new Error('Preciso da permissão **Gerenciar tópicos** neste canal.');
  }
}

function canManageTicket(interaction, staffRoleId) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) return true;
  if (interaction.member?.roles?.cache?.has(staffRoleId)) return true;
  return false;
}

async function findExistingTicketForUser(channel, userId) {
  const active = await channel.threads.fetchActive();
  for (const thread of active.threads.values()) {
    if (isTicketForUser(thread, userId)) {
      return thread;
    }
  }

  let before;
  do {
    const archived = await channel.threads.fetchArchived({ before, limit: 100 });
    for (const thread of archived.threads.values()) {
      if (isTicketForUser(thread, userId)) {
        return thread;
      }
    }

    before = archived.threads.size > 0 ? archived.threads.last()?.id : undefined;
    if (!archived.hasMore) break;
  } while (before);

  return null;
}

function buildPanelEmbed({ title, description, imageUrl, color }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title.slice(0, 256))
    .setDescription(`${description.trim()}\n\n_Clique no botão abaixo para abrir um ticket de suporte._`.slice(0, 4096));

  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  return embed;
}

function buildOpenButton(roleId, label) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${OPEN_PREFIX}${roleId}`)
      .setLabel(label)
      .setStyle(ButtonStyle.Primary),
  );
}

function buildTicketControls(threadId, roleId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CLOSE_PREFIX}${threadId}:${roleId}`)
      .setLabel('Fechar ticket')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${ARCHIVE_PREFIX}${threadId}:${roleId}`)
      .setLabel('Arquivar')
      .setStyle(ButtonStyle.Secondary),
  );
}

function resolveThreadType(channel) {
  if (channel.type === ChannelType.GuildAnnouncement) {
    return ChannelType.PublicThread;
  }

  return ChannelType.PrivateThread;
}

async function handleOpenTicket(interaction, roleId) {
  if (!interaction.guild || !interaction.member) {
    await sendEphemeral(interaction, '### Erro\nSó é possível abrir tickets dentro do servidor.');
    return;
  }

  const parentChannel = interaction.channel;
  if (!channelSupportsTickets(parentChannel)) {
    await sendEphemeral(
      interaction,
      '### Canal inválido\nAbra tickets em um canal de texto ou anúncios com tópicos habilitados.',
    );
    return;
  }

  try {
    assertBotCanCreateThreads(interaction.guild, parentChannel);
  } catch (error) {
    await sendEphemeral(interaction, `### Sem permissão\n${error.message}`);
    return;
  }

  const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    await sendEphemeral(interaction, '### Cargo indisponível\nO cargo configurado para este painel não existe mais.');
    return;
  }

  const existing = await findExistingTicketForUser(parentChannel, interaction.user.id);
  if (existing) {
    await sendEphemeral(
      interaction,
      `### Ticket já existente\nVocê já tem um ticket: ${existing}. Peça para a equipe **fechar** (excluir) o ticket antes de abrir outro.`,
    );
    return;
  }

  let thread;
  const displayName = interaction.user.globalName || interaction.user.username;
  try {
    thread = await parentChannel.threads.create({
      name: openTicketThreadName(interaction.user.id, displayName),
      type: resolveThreadType(parentChannel),
      invitable: false,
      reason: `Ticket aberto por ${interaction.user.tag}`,
    });

    if (thread.type === ChannelType.PrivateThread) {
      await thread.members.add(interaction.user.id);
    }
  } catch (error) {
    console.error('[Corvo] Falha ao criar tópico de ticket:', error);
    await sendEphemeral(
      interaction,
      '### Erro\nNão consegui criar o ticket. Verifique se o canal permite tópicos e minhas permissões.',
    );
    return;
  }

  const ticketEmbed = new EmbedBuilder()
    .setColor(randomEmbedColor())
    .setTitle('Ticket de suporte')
    .setDescription(
      [
        `Aberto por ${interaction.user}`,
        '',
        'Descreva seu problema com o máximo de detalhes possível.',
        'A equipe responderá em breve.',
      ].join('\n'),
    )
    .setFooter({ text: `owner:${interaction.user.id}` });

  try {
    await thread.send({
      content: `${interaction.user} <@&${role.id}>`,
      embeds: [ticketEmbed],
      components: [buildTicketControls(thread.id, role.id)],
    });
  } catch (error) {
    console.error('[Corvo] Falha ao publicar mensagem inicial do ticket:', error);
    await thread.delete('Falha ao inicializar ticket').catch(() => {});
    await sendEphemeral(interaction, '### Erro\nO ticket foi criado, mas não consegui publicar a mensagem inicial.');
    return;
  }

  await sendEphemeral(interaction, `### Ticket aberto\nSeu ticket foi criado: ${thread}`);
}

async function handleCloseTicket(interaction, threadId, roleId) {
  if (!canManageTicket(interaction, roleId)) {
    await sendEphemeral(
      interaction,
      '### Acesso negado\nApenas administradores ou membros do cargo de suporte podem fechar tickets.',
    );
    return;
  }

  const thread = await interaction.client.channels.fetch(threadId).catch(() => null);
  if (!thread?.isThread?.()) {
    await sendEphemeral(interaction, '### Ticket indisponível\nEste tópico não existe mais.');
    return;
  }

  try {
    await thread.delete(`Ticket fechado por ${interaction.user.tag}`);
    await sendEphemeral(interaction, '### Ticket fechado\nO tópico foi removido.');
  } catch (error) {
    console.error('[Corvo] Falha ao fechar ticket:', error);
    await sendEphemeral(interaction, '### Erro\nNão consegui fechar este ticket. Verifique minhas permissões.');
  }
}

async function handleArchiveTicket(interaction, threadId, roleId) {
  if (!canManageTicket(interaction, roleId)) {
    await sendEphemeral(
      interaction,
      '### Acesso negado\nApenas administradores ou membros do cargo de suporte podem arquivar tickets.',
    );
    return;
  }

  const thread = await interaction.client.channels.fetch(threadId).catch(() => null);
  if (!thread?.isThread?.()) {
    await sendEphemeral(interaction, '### Ticket indisponível\nEste tópico não existe mais.');
    return;
  }

  const ownerId = parseTicketOwnerIdFromName(thread.name);
  const ownerSlug = parseTicketSlugFromName(thread.name);

  try {
    const members = await thread.members.fetch();

    for (const memberId of members.keys()) {
      if (memberId === interaction.client.user.id) continue;
      await thread.members.remove(memberId).catch(() => {});
    }

    if (ownerId) {
      await thread.setName(
        closedTicketThreadName(ownerId, ownerSlug || 'user'),
        'Ticket arquivado',
      );
    }

    await sendEphemeral(
      interaction,
      '### Ticket arquivado\nTodos os membros foram removidos do tópico. Para abrir outro ticket, este tópico precisa ser **fechado** (excluído).',
    );
  } catch (error) {
    console.error('[Corvo] Falha ao arquivar ticket:', error);
    await sendEphemeral(interaction, '### Erro\nNão consegui arquivar este ticket.');
  }
}

module.exports = {
  data: buildCommandData(),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    if (!interaction.guild) {
      await sendEphemeral(interaction, '### Erro\nEste comando só funciona em um servidor.');
      return;
    }

    const channel = interaction.channel;
    if (!channelSupportsTickets(channel)) {
      await sendEphemeral(
        interaction,
        '### Canal inválido\nUse este comando em um canal de texto ou anúncios com tópicos habilitados.',
      );
      return;
    }

    try {
      assertBotCanCreateThreads(interaction.guild, channel);
    } catch (error) {
      await sendEphemeral(interaction, `### Configuração inválida\n${error.message}`);
      return;
    }

    const title = interaction.options.getString('titulo', true).trim();
    const description = interaction.options.getString('descricao', true).replace(/\\n/g, '\n').trim();
    const role = interaction.options.getRole('cargo', true);
    const buttonLabel = (interaction.options.getString('botao') || 'Abrir ticket').trim().slice(0, 80) || 'Abrir ticket';
    const imageRaw = interaction.options.getString('imagem');

    if (!title || !description) {
      await sendEphemeral(interaction, '### Configuração inválida\nInforme título e descrição do painel.');
      return;
    }

    let imageUrl = null;
    if (imageRaw?.trim()) {
      try {
        imageUrl = parseImageUrl(imageRaw.trim());
      } catch (error) {
        await sendEphemeral(interaction, `### Configuração inválida\n${error.message}`);
        return;
      }
    }

    const embed = buildPanelEmbed({
      title,
      description,
      imageUrl,
      color: randomEmbedColor(),
    });

    try {
      await channel.send({
        embeds: [embed],
        components: [buildOpenButton(role.id, buttonLabel)],
      });
    } catch (error) {
      console.error('[Corvo] Falha ao publicar painel de ticket:', error);
      await sendEphemeral(
        interaction,
        '### Erro\nNão foi possível publicar o painel. Verifique minhas permissões de enviar mensagens e embeds.',
      );
      return;
    }

    await sendEphemeral(
      interaction,
      `### Painel criado\nTicket de suporte publicado em <#${channel.id}>.\nCargo mencionado ao abrir: **${role.name}**.`,
    );
  },

  async handleButton(interaction) {
    const openRoleId = parseOpenRoleId(interaction.customId);
    if (openRoleId) {
      await handleOpenTicket(interaction, openRoleId);
      return;
    }

    const close = parseThreadAction(interaction.customId, CLOSE_PREFIX);
    if (close) {
      await handleCloseTicket(interaction, close.threadId, close.roleId);
      return;
    }

    const archive = parseThreadAction(interaction.customId, ARCHIVE_PREFIX);
    if (archive) {
      await handleArchiveTicket(interaction, archive.threadId, archive.roleId);
    }
  },
};
