const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { getPlayableRegionChoices } = require('../../constants/regions');
const { requireAdmin } = require('../../utils/permissions');
const { declareRegionIndependent } = require('../../services/worldService');
const { buildWesterosEmbed } = require('../../utils/westerosEmbed');
const { getRegionLabel } = require('../../constants/regions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('regiao-independente')
    .setDescription('Declara região independente e eleva uma casa a Governante regional.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('regiao')
        .setDescription('Região a tornar independente')
        .setRequired(true)
        .addChoices(...getPlayableRegionChoices()),
    )
    .addStringOption((option) =>
      option
        .setName('casa')
        .setDescription('Casa que governará a região de forma independente')
        .setRequired(true)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction) {
    const region = interaction.options.getString('regiao');
    const focused = interaction.options.getFocused().toLowerCase();
    const House = require('../../models/House');

    const query = {
      name: { $regex: focused, $options: 'i' },
    };

    if (region) {
      query.region = region;
    }

    const houses = await House.find(query).limit(25).select('name slug region');

    await interaction.respond(
      houses.map((house) => ({
        name: `${house.name} (${getRegionLabel(house.region)})`,
        value: house.slug,
      })),
    );
  },

  async execute(interaction) {
    if (!requireAdmin(interaction)) return;

    const region = interaction.options.getString('regiao');
    const houseSlug = interaction.options.getString('casa');

    try {
      const house = await declareRegionIndependent(region, houseSlug);
      const embed = await buildWesterosEmbed();

      await interaction.reply({
        content:
          '### Região independente\n' +
          `**${house.name}** foi elevada a **Governante** independente de **${getRegionLabel(region)}**.`,
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
