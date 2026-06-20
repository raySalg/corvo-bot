const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COMMAND_CATALOG, formatCommandList } = require('../constants/commands');
const { randomEmbedColor } = require('../utils/embed');
const { isAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('comandos')
    .setDescription('Lista todos os comandos do Sete com descrições.'),

  async execute(interaction) {
    const userIsAdmin = isAdmin(interaction);

    let description =
      '## Comandos gerais\n' +
      'Use os slash commands abaixo para navegar por Westeros.\n\n' +
      formatCommandList(COMMAND_CATALOG.public);

    if (userIsAdmin) {
      description +=
        '\n\n## Comandos de administração\n' +
        'Disponíveis apenas para **administradores** do servidor.\n\n' +
        formatCommandList(COMMAND_CATALOG.admin);
    }

    const embed = new EmbedBuilder()
      .setColor(randomEmbedColor())
      .setTitle('Sete — Comandos do Reino')
      .setDescription(description)
      .setFooter({ text: 'O Sete observa o reino.' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
