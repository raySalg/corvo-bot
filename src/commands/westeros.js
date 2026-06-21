const { SlashCommandBuilder } = require('discord.js');
const { buildWesterosEmbed } = require('../utils/westerosEmbed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('westeros')
    .setDescription('Exibe o status político atual de Westeros.'),

  async execute(interaction) {
    const embed = await buildWesterosEmbed();
    await interaction.reply({ embeds: [embed] });
  },
};
