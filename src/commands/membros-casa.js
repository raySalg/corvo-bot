const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const House = require('../models/House');
const { getRegionLabel } = require('../constants/regions');
const { getHouseLevelLabel } = require('../constants/houses');
const { autocompleteHouses } = require('../utils/houseDisplay');
const { formatMemberList, SILENT_MENTIONS } = require('../utils/houseMembers');
const { randomEmbedColor } = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('membros-casa')
    .setDescription('Lista os membros de uma casa sem notificar ninguém.')
    .addStringOption((option) =>
      option
        .setName('casa')
        .setDescription('Casa que deseja consultar')
        .setRequired(true)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction) {
    await autocompleteHouses(interaction);
  },

  async execute(interaction) {
    const slug = interaction.options.getString('casa');
    const house = await House.findOne({ slug });

    if (!house) {
      await interaction.reply({
        content: '### Casa não encontrada\nNenhuma casa corresponde a essa busca.',
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(randomEmbedColor())
      .setTitle(`Membros — ${house.name}`)
      .setDescription(
        '## Composição da Casa\n' +
          `**Região:** ${getRegionLabel(house.region)}\n` +
          `**Classificação:** ${getHouseLevelLabel(house)}\n` +
          `**Independente:** ${house.independent ? 'Sim' : 'Não'}\n` +
          `**Ocupação:** ${house.memberCount}/${house.maxMembers}\n\n` +
          formatMemberList(house),
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      allowedMentions: SILENT_MENTIONS,
    });
  },
};
