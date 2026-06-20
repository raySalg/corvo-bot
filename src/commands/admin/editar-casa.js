const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const House = require('../../models/House');
const { HOUSE_LEVELS, HOUSE_LEVEL_LABELS } = require('../../constants/houses');
const { REGION_LABELS, getRegionChoices } = require('../../constants/regions');
const { requireAdmin, slugify } = require('../../utils/permissions');
const { autocompleteHouses } = require('../../utils/houseDisplay');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editar-casa')
    .setDescription('Edita uma casa existente (somente administradores).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('casa')
        .setDescription('Casa a ser editada')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName('nome')
        .setDescription('Novo nome da casa')
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName('limite')
        .setDescription('Novo limite de vagas')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addStringOption((option) =>
      option
        .setName('nivel')
        .setDescription('Nova classificação')
        .setRequired(false)
        .addChoices(
          { name: 'Casa Dominante (Imperador)', value: HOUSE_LEVELS.DOMINANTE },
          { name: 'Casa Soberana (Rei)', value: HOUSE_LEVELS.MAIOR },
          { name: 'Casa Vassala', value: HOUSE_LEVELS.MENOR },
        ),
    )
    .addStringOption((option) =>
      option
        .setName('regiao')
        .setDescription('Nova região')
        .setRequired(false)
        .addChoices(...getRegionChoices()),
    ),

  async autocomplete(interaction) {
    await autocompleteHouses(interaction);
  },

  async execute(interaction) {
    if (!requireAdmin(interaction)) return;

    const slug = interaction.options.getString('casa');
    const newName = interaction.options.getString('nome');
    const newLimit = interaction.options.getInteger('limite');
    const newLevel = interaction.options.getString('nivel');
    const newRegion = interaction.options.getString('regiao');

    if (!newName && !newLimit && !newLevel && !newRegion) {
      await interaction.reply({
        content: '### Nada para editar\nInforme ao menos um campo: **nome**, **limite**, **nivel** ou **regiao**.',
        ephemeral: true,
      });
      return;
    }

    const house = await House.findOne({ slug });
    if (!house) {
      await interaction.reply({
        content: '### Casa não encontrada\nNenhuma casa corresponde a essa busca.',
        ephemeral: true,
      });
      return;
    }

    const changes = [];

    if (newName) {
      const trimmedName = newName.trim();
      const newSlug = slugify(trimmedName);

      if (!newSlug) {
        await interaction.reply({
          content: '### Nome inválido\nInforme um nome válido para a casa.',
          ephemeral: true,
        });
        return;
      }

      const duplicate = await House.findOne({
        slug: newSlug,
        _id: { $ne: house._id },
      });

      if (duplicate) {
        await interaction.reply({
          content: `### Nome em uso\nJá existe uma casa chamada **${duplicate.name}**.`,
          ephemeral: true,
        });
        return;
      }

      changes.push(`**Nome:** ${house.name} → **${trimmedName}**`);
      house.name = trimmedName;
      house.slug = newSlug;
    }

    if (newLimit !== null) {
      if (newLimit < house.memberCount) {
        await interaction.reply({
          content:
            '### Limite inválido\n' +
            `A casa possui **${house.memberCount}** ocupantes. O limite não pode ser menor que isso.`,
          ephemeral: true,
        });
        return;
      }

      changes.push(`**Limite:** ${house.maxMembers} → **${newLimit}**`);
      house.maxMembers = newLimit;
    }

    if (newLevel) {
      if (newLevel === HOUSE_LEVELS.DOMINANTE && house.level !== HOUSE_LEVELS.DOMINANTE) {
        const dominantHouse = await House.findOne({
          level: HOUSE_LEVELS.DOMINANTE,
          _id: { $ne: house._id },
        });

        if (dominantHouse) {
          await interaction.reply({
            content:
              '### Trono imperial ocupado\n' +
              `**${dominantHouse.name}** já é a Casa Dominante.`,
            ephemeral: true,
          });
          return;
        }
      }

      changes.push(`**Nível:** ${HOUSE_LEVEL_LABELS[house.level]} → **${HOUSE_LEVEL_LABELS[newLevel]}**`);
      house.level = newLevel;
    }

    if (newRegion) {
      changes.push(`**Região:** ${REGION_LABELS[house.region]} → **${REGION_LABELS[newRegion]}**`);
      house.region = newRegion;
    }

    await house.save();

    await interaction.reply({
      content: ['### Casa atualizada', `Alterações em **${house.name}**:`, '', ...changes].join('\n'),
    });
  },
};
