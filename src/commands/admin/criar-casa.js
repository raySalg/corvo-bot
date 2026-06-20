const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const House = require('../../models/House');
const { HOUSE_LEVELS, HOUSE_LEVEL_LABELS, DEFAULT_MAX_MEMBERS } = require('../../constants/houses');
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
        .setName('nivel')
        .setDescription('Classificação da casa')
        .setRequired(true)
        .addChoices(
          { name: 'Casa Dominante (Imperador)', value: HOUSE_LEVELS.DOMINANTE },
          { name: 'Casa Soberana (Rei)', value: HOUSE_LEVELS.MAIOR },
          { name: 'Casa Menor (Vassala)', value: HOUSE_LEVELS.MENOR },
        ),
    ),

  async execute(interaction) {
    if (!requireAdmin(interaction)) return;

    const name = interaction.options.getString('nome').trim();
    const level = interaction.options.getString('nivel');
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
            `**${dominantHouse.name}** já ocupa o trono imperial. Altere o nível dela antes de criar outra.`,
          ephemeral: true,
        });
        return;
      }
    }

    const house = await House.create({
      name,
      slug,
      level,
      maxMembers: DEFAULT_MAX_MEMBERS,
      goldDragons: 0,
      lordId: null,
      members: [],
    });

    await interaction.reply({
      content: [
        '### Casa fundada',
        `**${house.name}** entrou nos registros de Westeros.`,
        '',
        `**Nível:** ${HOUSE_LEVEL_LABELS[house.level]}`,
        `**Limite de membros:** ${house.maxMembers} (inclui Lorde/Lady)`,
        '**Tesouro:** 0 moedas de ouro',
      ].join('\n'),
    });
  },
};
