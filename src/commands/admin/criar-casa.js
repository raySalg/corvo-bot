const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const House = require('../../models/House');
const { HOUSE_LEVELS, HOUSE_LEVEL_LABELS, DEFAULT_MAX_MEMBERS } = require('../../constants/houses');
const { getRegionChoices, REGION_LABELS } = require('../../constants/regions');
const { requireAdmin, slugify } = require('../../utils/permissions');

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
        .setDescription('Região da casa')
        .setRequired(true)
        .addChoices(...getRegionChoices()),
    )
    .addStringOption((option) =>
      option
        .setName('nivel')
        .setDescription('Classificação da casa')
        .setRequired(true)
        .addChoices(
          { name: 'Casa Dominante (Imperador)', value: HOUSE_LEVELS.DOMINANTE },
          { name: 'Casa Soberana (Rei)', value: HOUSE_LEVELS.MAIOR },
          { name: 'Casa Vassala', value: HOUSE_LEVELS.MENOR },
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

    if (level === HOUSE_LEVELS.DOMINANTE) {
      const dominantHouse = await House.findOne({ level: HOUSE_LEVELS.DOMINANTE });
      if (dominantHouse) {
        await interaction.reply({
          content:
            '### Casa Dominante já definida\n' +
            `**${dominantHouse.name}** já ocupa o trono imperial.`,
          ephemeral: true,
        });
        return;
      }
    }

    const house = await House.create({
      name,
      slug,
      region,
      level,
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
        `**Região:** ${REGION_LABELS[region]}`,
        `**Nível:** ${HOUSE_LEVEL_LABELS[house.level]}`,
        `**Limite de membros:** ${house.maxMembers} (inclui Senhor(a))`,
        '**Tesouro:** 0 moedas de ouro',
      ].join('\n'),
    });
  },
};
