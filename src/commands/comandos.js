const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COMMAND_CATALOG, formatCommandList } = require('../constants/commands');
const { randomEmbedColor } = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('comandos')
    .setDescription('Lista todos os comandos do Sete com descrições.'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(randomEmbedColor())
      .setTitle('Sete — Comandos do Reino')
      .setDescription(
        '### Guia de comandos\nUse os slash commands abaixo para navegar por Westeros.\n\n' +
          '**Dica:** comandos de administração exigem permissão de **Administrador** no servidor.',
      )
      .addFields(
        {
          name: 'Comandos gerais',
          value: formatCommandList(COMMAND_CATALOG.public),
        },
        {
          name: 'Comandos de administração',
          value: formatCommandList(COMMAND_CATALOG.admin),
        },
      )
      .setFooter({ text: 'O Sete observa o reino.' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
