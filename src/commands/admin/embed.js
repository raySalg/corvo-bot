const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const { randomEmbedColor, parseEmbedColor } = require('../../utils/embed');

const EMBED_MODAL_ID = 'embed:submit';

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

function normalizeEmbedText(input) {
  return input.replace(/\\n/g, '\n');
}

function getModalTextInput(interaction, customId) {
  return interaction.fields.fields.get(customId)?.value ?? '';
}

async function buildAndSendEmbed(interaction, fields) {
  const titulo = fields.titulo.trim();
  const corpo = normalizeEmbedText(fields.corpo);
  const rodapeRaw = fields.rodape?.trim() || '';
  const rodape = rodapeRaw ? normalizeEmbedText(rodapeRaw) : null;
  const imagemInput = fields.imagem?.trim() || null;
  const corInput = fields.cor?.trim() || null;

  if (!titulo) {
    await interaction.editReply({
      content: '### Título obrigatório\nInforme um título para o embed.',
    });
    return;
  }

  if (!corpo.trim()) {
    await interaction.editReply({
      content: '### Corpo obrigatório\nInforme o conteúdo da mensagem.',
    });
    return;
  }

  let color;
  if (corInput) {
    try {
      color = parseEmbedColor(corInput);
    } catch (error) {
      await interaction.editReply({
        content: `### Cor inválida\n${error.message}`,
      });
      return;
    }
  } else {
    color = randomEmbedColor();
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

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(titulo)
    .setDescription(corpo);

  if (rodape) embed.setFooter({ text: rodape });
  if (imagem) embed.setImage(imagem);

  if (!interaction.channel?.isTextBased?.()) {
    await interaction.editReply({
      content: '### Canal indisponível\nNão foi possível publicar o embed neste canal.',
    });
    return;
  }

  try {
    await interaction.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Erro ao publicar embed no canal:', error);
    await interaction.editReply({
      content:
        '### Publicação recusada\n' +
        'Não foi possível enviar a mensagem no canal. Verifique se o bot tem permissão para **Enviar Mensagens** e **Incorporar Links**.',
    });
    return;
  }

  await interaction.editReply({
    content: '### Embed enviado\nA mensagem foi publicada no canal.',
  });
}

function buildEmbedModal() {
  const tituloInput = new TextInputBuilder()
    .setCustomId('titulo')
    .setLabel('Título')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(256);

  const corpoInput = new TextInputBuilder()
    .setCustomId('corpo')
    .setLabel('Corpo da mensagem')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(4000);

  const rodapeInput = new TextInputBuilder()
    .setCustomId('rodape')
    .setLabel('Rodapé (opcional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(2048);

  const imagemInput = new TextInputBuilder()
    .setCustomId('imagem')
    .setLabel('URL da imagem (opcional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const corInput = new TextInputBuilder()
    .setCustomId('cor')
    .setLabel('Cor RGB ou hex (opcional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('255,0,0 ou #FF0000');

  return new ModalBuilder()
    .setCustomId(EMBED_MODAL_ID)
    .setTitle('Criar embed')
    .addComponents(
      new ActionRowBuilder().addComponents(tituloInput),
      new ActionRowBuilder().addComponents(corpoInput),
      new ActionRowBuilder().addComponents(rodapeInput),
      new ActionRowBuilder().addComponents(imagemInput),
      new ActionRowBuilder().addComponents(corInput),
    );
}

module.exports = {
  EMBED_MODAL_ID,

  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Publica mensagem customizada em embed no canal.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    await interaction.showModal(buildEmbedModal());
  },

  async handleModalSubmit(interaction) {
    if (interaction.customId !== EMBED_MODAL_ID) return;

    if (!(await requireAdmin(interaction))) return;

    await interaction.deferReply({ ephemeral: true });

    await buildAndSendEmbed(interaction, {
      titulo: getModalTextInput(interaction, 'titulo'),
      corpo: getModalTextInput(interaction, 'corpo'),
      rodape: getModalTextInput(interaction, 'rodape'),
      imagem: getModalTextInput(interaction, 'imagem'),
      cor: getModalTextInput(interaction, 'cor'),
    });
  },
};
