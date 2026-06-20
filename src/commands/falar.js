const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { requireAdmin } = require('../utils/permissions');

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

    await interaction.reply({
      content: '📜 O Sete proclama...',
      ephemeral: true,
    });

    await interaction.channel.send({
      content: `📜 **Proclamação do Sete:**\n${message}`,
    });
  },
};
