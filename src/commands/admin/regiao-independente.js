const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const House = require('../../models/House');
const { getPlayableRegionChoices, getRegionLabel } = require('../../constants/regions');
const { getHouseLevelLabel, formatIndependenceMessage } = require('../../constants/houses');
const { requireAdmin } = require('../../utils/permissions');
const { declareRegionIndependent } = require('../../services/worldService');
const { buildWesterosEmbed } = require('../../utils/westerosEmbed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('regiao-independente')
    .setDescription('Declara independência de uma região (Soberano) ou de uma casa (Vassala).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('regiao')
        .setDescription('Região envolvida')
        .setRequired(true)
        .addChoices(...getPlayableRegionChoices()),
    )
    .addStringOption((option) =>
      option
        .setName('casa')
        .setDescription('Soberano da região ou vassala que se tornará independente')
        .setRequired(true)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction) {
    const region = interaction.options.getString('regiao');
    const focused = interaction.options.getFocused().toLowerCase();

    const query = {
      name: { $regex: focused, $options: 'i' },
    };

    if (region) {
      query.region = region;
    }

    const houses = await House.find(query).limit(25).select('name slug region level');

    await interaction.respond(
      houses.map((house) => ({
        name: `${house.name} (${getHouseLevelLabel(house)} · ${getRegionLabel(house.region)})`,
        value: house.slug,
      })),
    );
  },

  async execute(interaction) {
    if (!requireAdmin(interaction)) return;

    const region = interaction.options.getString('regiao');
    const houseSlug = interaction.options.getString('casa');
    const regionLabel = getRegionLabel(region);

    try {
      const { house, scope } = await declareRegionIndependent(region, houseSlug);
      const embed = await buildWesterosEmbed();

      const title = scope === 'regional' ? 'Região independente' : 'Casa independente';

      await interaction.reply({
        content: `### ${title}\n${formatIndependenceMessage(house, regionLabel)}`,
        embeds: [embed],
      });
    } catch (error) {
      await interaction.reply({
        content: `### Erro\n${error.message}`,
        ephemeral: true,
      });
    }
  },
};
