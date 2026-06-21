const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const House = require('../../models/House');
const {
  HOUSE_LEVELS,
  DEFAULT_MAX_MEMBERS,
  getHouseLevelLabel,
  WESTEROS_GOVERNANTE_SLUG,
} = require('../../constants/houses');
const { getRegionLabel, getRegionChoices, REGIONS } = require('../../constants/regions');
const { requireAdmin, slugify } = require('../../utils/permissions');
const { getWorldState } = require('../../services/worldService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('criar-casa')
    .setDescription('Cria uma nova casa em Westeros (somente administradores).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('nome')
        .setDescription('Nome da casa (ex: Mormont)')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('regiao')
        .setDescription('Região da casa (ou Casa sem Terras)')
        .setRequired(true)
        .addChoices(...getRegionChoices()),
    )
    .addStringOption((option) =>
      option
        .setName('nivel')
        .setDescription('Classificação da casa')
        .setRequired(true)
        .addChoices(
          { name: 'Governante', value: HOUSE_LEVELS.GOVERNANTE },
          { name: 'Soberano', value: HOUSE_LEVELS.SOBERANO },
          { name: 'Vassala', value: HOUSE_LEVELS.MENOR },
        ),
    )
    .addStringOption((option) =>
      option
        .setName('independente')
        .setDescription('Casa independente do Governante de Westeros')
        .setRequired(false)
        .addChoices(
          { name: 'Sim', value: 'sim' },
          { name: 'Não', value: 'nao' },
        ),
    )
    .addIntegerOption((option) =>
      option
        .setName('limite')
        .setDescription('Limite de vagas (padrão: 3)')
        .setRequired(false)
        .setMinValue(2)
        .setMaxValue(100),
    ),

  async execute(interaction) {
    if (!requireAdmin(interaction)) return;

    const name = interaction.options.getString('nome').trim();
    const region = interaction.options.getString('regiao');
    const level = interaction.options.getString('nivel');
    const independente = interaction.options.getString('independente') === 'sim';
    const maxMembers = interaction.options.getInteger('limite') ?? DEFAULT_MAX_MEMBERS;
    const slug = slugify(name);

    if (!slug) {
      await interaction.reply({
        content: '### Nome inválido\nInforme um nome válido para a casa.',
        ephemeral: true,
      });
      return;
    }

    const existing = await House.findOne({
      $or: [{ name: new RegExp(`^${name}$`, 'i') }, { slug }],
    });

    if (existing) {
      await interaction.reply({
        content: `### Casa já existente\nA casa **${existing.name}** já está registrada em Westeros.`,
        ephemeral: true,
      });
      return;
    }

    if (level === HOUSE_LEVELS.GOVERNANTE && !independente) {
      const world = await getWorldState();
      const current = await House.findOne({ slug: world.governanteWesterosSlug });
      if (current && slug !== WESTEROS_GOVERNANTE_SLUG) {
        await interaction.reply({
          content:
            '### Governante de Westeros já definido\n' +
            `**${current.name}** já governa Westeros. Use **independente: Sim** ou **/regiao-independente**.`,
          ephemeral: true,
        });
        return;
      }
    }

    if (level !== HOUSE_LEVELS.GOVERNANTE && independente) {
      await interaction.reply({
        content: '### Opção inválida\nSomente casas **Governantes** podem ser independentes.',
        ephemeral: true,
      });
      return;
    }

    if (region === REGIONS.SEM_TERRAS && level === HOUSE_LEVELS.GOVERNANTE && independente) {
      await interaction.reply({
        content: '### Opção inválida\nCasas sem terras não podem ser Governantes independentes.',
        ephemeral: true,
      });
      return;
    }

    const house = await House.create({
      name,
      slug,
      region,
      level,
      independent: independente,
      maxMembers,
      goldDragons: 0,
      lordId: null,
      members: [],
    });

    await interaction.reply({
      content: [
        '### Casa fundada',
        `**${house.name}** entrou nos registros de Westeros.`,
        '',
        `**Região:** ${getRegionLabel(region)}`,
        `**Nível:** ${getHouseLevelLabel(house)}`,
        `**Independente:** ${house.independent ? 'Sim' : 'Não'}`,
        `**Limite de membros:** ${house.maxMembers} (inclui Senhor(a))`,
        '**Tesouro:** 0 moedas de ouro',
      ].join('\n'),
    });
  },
};
