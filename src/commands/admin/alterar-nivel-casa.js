const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const House = require('../../models/House');
const { HOUSE_LEVELS, getHouseLevelLabel, isWesterosGovernante } = require('../../constants/houses');
const { requireAdmin } = require('../../utils/permissions');
const { autocompleteHouses } = require('../../utils/houseDisplay');
const { getWorldState } = require('../../services/worldService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('alterar-nivel-casa')
    .setDescription('Altera a classificação de uma casa (somente administradores).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('casa')
        .setDescription('Nome da casa')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName('nivel')
        .setDescription('Nova classificação')
        .setRequired(true)
        .addChoices(
          { name: 'Governante', value: HOUSE_LEVELS.GOVERNANTE },
          { name: 'Soberano', value: HOUSE_LEVELS.SOBERANO },
          { name: 'Vassala', value: HOUSE_LEVELS.MENOR },
        ),
    ),

  async autocomplete(interaction) {
    await autocompleteHouses(interaction);
  },

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const slug = interaction.options.getString('casa');
    const newLevel = interaction.options.getString('nivel');

    const house = await House.findOne({ slug });
    if (!house) {
      await interaction.reply({
        content: '### Casa não encontrada\nNenhuma casa corresponde a essa busca.',
        ephemeral: true,
      });
      return;
    }

    if (
      newLevel === HOUSE_LEVELS.GOVERNANTE &&
      !house.independent &&
      !isWesterosGovernante(house)
    ) {
      const world = await getWorldState();
      const current = await House.findOne({ slug: world.governanteWesterosSlug });
      if (current && current._id.toString() !== house._id.toString()) {
        await interaction.reply({
          content:
            '### Governante de Westeros já definido\n' +
            `**${current.name}** já governa Westeros. Use **/regiao-independente** para elevar uma casa regional independente.`,
          ephemeral: true,
        });
        return;
      }
    }

    const previousLabel = getHouseLevelLabel(house);
    house.level = newLevel;

    if (newLevel !== HOUSE_LEVELS.GOVERNANTE) {
      house.independent = false;
    }

    await house.save();

    await interaction.reply({
      content: [
        '### Classificação alterada',
        `A casa **${house.name}** mudou de nível.`,
        '',
        `**Antes:** ${previousLabel}`,
        `**Agora:** ${getHouseLevelLabel(house)}`,
      ].join('\n'),
    });
  },
};
