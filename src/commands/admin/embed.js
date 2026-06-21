const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const { randomEmbedColor, parseEmbedColor } = require('../../utils/embed');

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Publica mensagem customizada em embed no canal.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('titulo')
        .setDescription('Título do embed')
        .setRequired(true)
        .setMaxLength(256),
    )
    .addStringOption((option) =>
      option
        .setName('corpo')
        .setDescription('Texto principal da mensagem')
        .setRequired(true)
        .setMaxLength(4096),
    )
    .addStringOption((option) =>
      option
        .setName('rodape')
        .setDescription('Rodapé opcional do embed')
        .setRequired(false)
        .setMaxLength(2048),
    )
    .addStringOption((option) =>
      option
        .setName('imagem')
        .setDescription('URL da imagem (http ou https)')
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName('cor')
        .setDescription('Cor da barra lateral: RGB (255,0,0) ou hex (#FF0000)')
        .setRequired(false),
    ),

  async execute(interaction) {
    if (!requireAdmin(interaction)) return;

    const titulo = interaction.options.getString('titulo');
    const corpo = interaction.options.getString('corpo');
    const rodape = interaction.options.getString('rodape');
    const imagemInput = interaction.options.getString('imagem');
    const corInput = interaction.options.getString('cor');

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
  },
};
