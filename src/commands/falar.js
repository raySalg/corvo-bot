const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { requireAdmin } = require('../utils/permissions');
const { randomEmbedColor } = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('falar')
    .setDescription('Faz o Sete proclamar uma mensagem em nome do reino (teste).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('mensagem')
        .setDescription('Texto que o Sete irá proclamar')
        .setRequired(true)
        .setMaxLength(2000),
    ),

  async execute(interaction) {
    if (!requireAdmin(interaction)) return;

    const message = interaction.options.getString('mensagem');

    const embed = new EmbedBuilder()
      .setColor(randomEmbedColor())
      .setTitle('Proclamação do Sete')
      .setDescription(`### Decreto real\n${message}`)
      .setFooter({ text: `Proclamado por ${interaction.user.username}` })
      .setTimestamp();

    await interaction.reply({
      content: '### Proclamação enviada\nA mensagem foi publicada no canal.',
      ephemeral: true,
    });

    await interaction.channel.send({ embeds: [embed] });
  },
};
