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

async function buildAndSendEmbed(interaction, fields) {
  const titulo = fields.titulo;
  const corpo = normalizeEmbedText(fields.corpo);
  const rodape = fields.rodape ? normalizeEmbedText(fields.rodape) : null;
  const imagemInput = fields.imagem?.trim() || null;
  const corInput = fields.cor?.trim() || null;

  let color;
  if (corInput) {
    try {
      color = parseEmbedColor(corInput);
    } catch (error) {
      await interaction.reply({
        content: `### Cor inválida\n${error.message}`,
        ephemeral: true,
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
      await interaction.reply({
        content: `### Imagem inválida\n${error.message}`,
        ephemeral: true,
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

  await interaction.reply({
    content: '### Embed enviado\nA mensagem foi publicada no canal.',
    ephemeral: true,
  });

  await interaction.channel.send({ embeds: [embed] });
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
    if (!requireAdmin(interaction)) return;

    await interaction.showModal(buildEmbedModal());
  },

  async handleModalSubmit(interaction) {
    if (interaction.customId !== EMBED_MODAL_ID) return;

    if (!requireAdmin(interaction)) return;

    await buildAndSendEmbed(interaction, {
      titulo: interaction.fields.getTextInputValue('titulo'),
      corpo: interaction.fields.getTextInputValue('corpo'),
      rodape: interaction.fields.getTextInputValue('rodape'),
      imagem: interaction.fields.getTextInputValue('imagem'),
      cor: interaction.fields.getTextInputValue('cor'),
    });
  },
};
