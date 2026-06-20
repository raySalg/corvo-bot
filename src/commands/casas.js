const { SlashCommandBuilder } = require('discord.js');
const House = require('../models/House');
const { buildOverviewEmbed } = require('../utils/casasView');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casas')
    .setDescription('Lista as casas de Westeros por região.'),

  async execute(interaction) {
    const houses = await House.find().sort({ name: 1 });

    if (houses.length === 0) {
      await interaction.reply({
        content: '### Nenhuma casa registrada\nAinda não há casas em Westeros.',
        ephemeral: true,
      });
      return;
    }

    const { embed, rows } = buildOverviewEmbed(houses);

    await interaction.reply({
      embeds: [embed],
      components: rows,
    });
  },
};
