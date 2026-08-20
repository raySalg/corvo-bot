const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { requireAdmin, isAdmin, ACCESS_DENIED_MESSAGE } = require('../utils/permissions');
const { sendEphemeral } = require('../utils/interactionReply');
const { randomEmbedColor, parseEmbedColor, parseImageUrl } = require('../utils/embed');
const { publishEmbed } = require('../utils/publishMessage');

const EMBED_MODAL_ID = 'embed:submit';
const EMBED_MODAL_COLOR_PREFIX = `${EMBED_MODAL_ID}:c:`;

function buildEmbedModalId(corInput) {
  const cor = corInput?.trim();
  if (!cor) return EMBED_MODAL_ID;
  return `${EMBED_MODAL_COLOR_PREFIX}${encodeURIComponent(cor)}`;
}

function parseEmbedModalId(customId) {
  if (customId === EMBED_MODAL_ID) return { cor: null };
  if (!customId.startsWith(EMBED_MODAL_COLOR_PREFIX)) return null;
  return { cor: decodeURIComponent(customId.slice(EMBED_MODAL_COLOR_PREFIX.length)) };
}

function resolveEmbedColor(corInput) {
  if (!corInput?.trim()) return randomEmbedColor();
  return parseEmbedColor(corInput);
}

function normalizeEmbedText(input) {
  return input.replace(/\\n/g, '\n');
}

function getModalTextInput(interaction, customId) {
  return interaction.fields.fields.get(customId)?.value ?? '';
}

async function resolveInteractionChannel(interaction) {
  if (!interaction.channelId) return null;

  const cached = interaction.client.channels.cache.get(interaction.channelId);
  if (cached) return cached;

  try {
    return await interaction.client.channels.fetch(interaction.channelId);
  } catch (error) {
    console.error(`Canal ${interaction.channelId} indisponível:`, error);
    return null;
  }
}

async function buildAndSendEmbed(interaction, fields) {
  const titulo = fields.titulo.trim();
  const corpo = normalizeEmbedText(fields.corpo);
  const corpoTrimmed = corpo.trim();
  const rodapeRaw = fields.rodape?.trim() || '';
  const rodape = rodapeRaw ? normalizeEmbedText(rodapeRaw) : null;
  const imagemInput = fields.imagem?.trim() || null;
  const emblemaInput = fields.emblema?.trim() || null;

  if (!titulo && !corpoTrimmed && !rodape && !imagemInput && !emblemaInput) {
    await interaction.editReply({
      content:
        '### Conteúdo insuficiente\n' +
        'Informe pelo menos título, corpo, rodapé, imagem ou emblema.',
    });
    return;
  }

  let color;
  try {
    color = resolveEmbedColor(fields.cor);
  } catch (error) {
    await interaction.editReply({
      content: `### Cor inválida\n${error.message}`,
    });
    return;
  }

  let imagem;
  if (imagemInput) {
    try {
      imagem = parseImageUrl(imagemInput);
    } catch (error) {
      await interaction.editReply({
        content: `### Imagem inválida\n${error.message}`,
      });
      return;
    }
  }

  let emblema;
  if (emblemaInput) {
    try {
      emblema = parseImageUrl(emblemaInput);
    } catch (error) {
      await interaction.editReply({
        content: `### Emblema inválido\n${error.message}`,
      });
      return;
    }
  }

  const embed = new EmbedBuilder().setColor(color);

  if (titulo) embed.setTitle(titulo);
  if (corpoTrimmed) embed.setDescription(corpo);
  if (rodape) embed.setFooter({ text: rodape });
  if (emblema) embed.setThumbnail(emblema);
  if (imagem) embed.setImage(imagem);

  const channel = await resolveInteractionChannel(interaction);

  let publishMode;
  try {
    publishMode = await publishEmbed(channel, { title: titulo, embed });
  } catch (error) {
    if (error.message === 'CHANNEL_UNAVAILABLE') {
      await interaction.editReply({
        content: '### Canal indisponível\nNão foi possível publicar o embed neste canal.',
      });
      return;
    }

    if (error.message === 'CHANNEL_UNSUPPORTED') {
      await interaction.editReply({
        content:
          '### Canal não suportado\n' +
          'Este tipo de canal não permite publicar embeds. Use um canal de texto ou um fórum.',
      });
      return;
    }

    console.error('Erro ao publicar embed no canal:', error);
    await interaction.editReply({
      content:
        '### Publicação recusada\n' +
        'Não foi possível enviar a mensagem. Verifique se o bot tem permissão para **Enviar Mensagens**, **Criar Posts Públicos** (fórum) e **Incorporar Links**.',
    });
    return;
  }

  const successMessage =
    publishMode === 'forum_post'
      ? '### Embed enviado\nNovo post criado no fórum.'
      : '### Embed enviado\nA mensagem foi publicada no canal.';

  await interaction.editReply({ content: successMessage });
}

function buildEmbedModal(corInput) {
  const tituloInput = new TextInputBuilder()
    .setCustomId('titulo')
    .setLabel('Título (opcional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(256);

  const corpoInput = new TextInputBuilder()
    .setCustomId('corpo')
    .setLabel('Corpo da mensagem (opcional)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(4000);

  const rodapeInput = new TextInputBuilder()
    .setCustomId('rodape')
    .setLabel('Rodapé (opcional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(2048);

  const emblemaInput = new TextInputBuilder()
    .setCustomId('emblema')
    .setLabel('URL do emblema (opcional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('Imagem pequena ao lado do texto');

  const imagemInput = new TextInputBuilder()
    .setCustomId('imagem')
    .setLabel('URL da imagem grande (opcional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('Imagem exibida abaixo do texto');

  return new ModalBuilder()
    .setCustomId(buildEmbedModalId(corInput))
    .setTitle('Criar embed')
    .addComponents(
      new ActionRowBuilder().addComponents(tituloInput),
      new ActionRowBuilder().addComponents(corpoInput),
      new ActionRowBuilder().addComponents(rodapeInput),
      new ActionRowBuilder().addComponents(emblemaInput),
      new ActionRowBuilder().addComponents(imagemInput),
    );
}

module.exports = {
  EMBED_MODAL_ID,
  buildEmbedModal,
  buildEmbedModalId,
  parseEmbedModalId,
  resolveEmbedColor,

  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Publica mensagem customizada em embed no canal.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('cor')
        .setDescription('Cor do embed em RGB (255,0,0) ou hexadecimal (#FF0000)')
        .setRequired(false),
    ),

  async execute(interaction) {
    if (!isAdmin(interaction)) {
      await sendEphemeral(interaction, ACCESS_DENIED_MESSAGE);
      return;
    }

    const corInput = interaction.options.getString('cor');
    if (corInput) {
      try {
        parseEmbedColor(corInput);
      } catch (error) {
        await sendEphemeral(interaction, `### Cor inválida\n${error.message}`);
        return;
      }
    }

    await interaction.showModal(buildEmbedModal(corInput));
  },

  async handleModalSubmit(interaction) {
    const modalMeta = parseEmbedModalId(interaction.customId);
    if (!modalMeta) return;

    if (!(await requireAdmin(interaction))) return;

    await buildAndSendEmbed(interaction, {
      titulo: getModalTextInput(interaction, 'titulo'),
      corpo: getModalTextInput(interaction, 'corpo'),
      rodape: getModalTextInput(interaction, 'rodape'),
      emblema: getModalTextInput(interaction, 'emblema'),
      imagem: getModalTextInput(interaction, 'imagem'),
      cor: modalMeta.cor,
    });
  },
};
