const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const House = require('../../models/House');
const {
  HOUSE_LEVELS,
  getHouseLevelLabel,
  isWesterosGovernante,
} = require('../../constants/houses');
const { getRegionLabel, getRegionChoices } = require('../../constants/regions');
const { requireAdmin, slugify } = require('../../utils/permissions');
const { autocompleteHouses } = require('../../utils/houseDisplay');
const { getWorldState } = require('../../services/worldService');

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
          { name: 'Governante', value: HOUSE_LEVELS.GOVERNANTE },
          { name: 'Soberano', value: HOUSE_LEVELS.SOBERANO },
          { name: 'Vassala', value: HOUSE_LEVELS.MENOR },
        ),
    )
    .addStringOption((option) =>
      option
        .setName('regiao')
        .setDescription('Nova região')
        .setRequired(false)
        .addChoices(...getRegionChoices()),
    )
    .addStringOption((option) =>
      option
        .setName('independente')
        .setDescription('Independência em relação ao Governante de Westeros')
        .setRequired(false)
        .addChoices(
          { name: 'Sim', value: 'sim' },
          { name: 'Não', value: 'nao' },
        ),
    ),

  async autocomplete(interaction) {
    await autocompleteHouses(interaction);
  },

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const slug = interaction.options.getString('casa');
    const newName = interaction.options.getString('nome');
    const newLimit = interaction.options.getInteger('limite');
    const newLevel = interaction.options.getString('nivel');
    const newRegion = interaction.options.getString('regiao');
    const newIndependent = interaction.options.getString('independente');

    if (!newName && !newLimit && !newLevel && !newRegion && !newIndependent) {
      await interaction.reply({
        content:
          '### Nada para editar\n' +
          'Informe ao menos um campo: **nome**, **limite**, **nivel**, **regiao** ou **independente**.',
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
    const previousLabel = getHouseLevelLabel(house);

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
      if (newLevel === HOUSE_LEVELS.GOVERNANTE && !house.independent && !isWesterosGovernante(house)) {
        const world = await getWorldState();
        const current = await House.findOne({ slug: world.governanteWesterosSlug });
        if (current && current._id.toString() !== house._id.toString()) {
          await interaction.reply({
            content:
              '### Governante de Westeros já definido\n' +
              `**${current.name}** já governa Westeros. Use **/regiao-independente** para independência regional.`,
            ephemeral: true,
          });
          return;
        }
      }

      changes.push(`**Nível:** ${previousLabel} → **${getHouseLevelLabel({ ...house.toObject(), level: newLevel })}**`);
      house.level = newLevel;
    }

    if (newRegion) {
      changes.push(`**Região:** ${getRegionLabel(house.region)} → **${getRegionLabel(newRegion)}**`);
      house.region = newRegion;
    }

    if (newIndependent) {
      const independent = newIndependent === 'sim';
      if (independent && house.level !== HOUSE_LEVELS.GOVERNANTE) {
        await interaction.reply({
          content: '### Opção inválida\nSomente casas **Governantes** podem ser independentes.',
          ephemeral: true,
        });
        return;
      }

      if (isWesterosGovernante(house) && independent) {
        await interaction.reply({
          content: '### Opção inválida\nO Governante de Westeros não pode ser independente.',
          ephemeral: true,
        });
        return;
      }

      changes.push(`**Independente:** ${house.independent ? 'Sim' : 'Não'} → **${independent ? 'Sim' : 'Não'}**`);
      house.independent = independent;
    }

    await house.save();

    await interaction.reply({
      content: ['### Casa atualizada', `Alterações em **${house.name}**:`, '', ...changes].join('\n'),
    });
  },
};
