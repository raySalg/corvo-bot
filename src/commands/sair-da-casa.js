const { SlashCommandBuilder } = require('discord.js');
const { findUserHouse, removeUserFromAllHouses } = require('../utils/houseMembers');
const { REGION_LABELS } = require('../constants/regions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sair-da-casa')
    .setDescription('Abandona a casa à qual você pertence atualmente.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const house = await findUserHouse(userId);

    if (!house) {
      await interaction.reply({
        content: '### Sem casa\nVocê não pertence a nenhuma casa de Westeros.',
        ephemeral: true,
      });
      return;
    }

    const houseName = house.name;
    const region = REGION_LABELS[house.region];
    await removeUserFromAllHouses(userId);

    await interaction.reply({
      content:
        '### Lealdade encerrada\n' +
        `Você deixou a casa **${houseName}** (${region}).\n` +
        'Suas alianças foram registradas nos anais do reino.',
    });
  },
};
