const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const House = require('../../models/House');
const { HOUSE_LEVELS, HOUSE_LEVEL_LABELS } = require('../../constants/houses');
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
    .addIntegerOption((option) =>
      option
        .setName('limite')
        .setDescription('Número máximo de membros (inclui o Lorde)')
        .setRequired(true)
        .setMinValue(2)
        .setMaxValue(500),
    )
    .addStringOption((option) =>
      option
        .setName('nivel')
        .setDescription('Classificação da casa')
        .setRequired(true)
        .addChoices(
          { name: 'Casa Dominante', value: HOUSE_LEVELS.DOMINANTE },
          { name: 'Casa Maior (Soberana)', value: HOUSE_LEVELS.MAIOR },
          { name: 'Casa Menor (Vassala)', value: HOUSE_LEVELS.MENOR },
        ),
    ),

  async execute(interaction) {
    if (!requireAdmin(interaction)) return;

    const name = interaction.options.getString('nome').trim();
    const maxMembers = interaction.options.getInteger('limite');
    const level = interaction.options.getString('nivel');
    const slug = slugify(name);

    if (!slug) {
      await interaction.reply({
        content: '❌ Nome de casa inválido.',
        ephemeral: true,
      });
      return;
    }

    const existing = await House.findOne({
      $or: [{ name: new RegExp(`^${name}$`, 'i') }, { slug }],
    });

    if (existing) {
      await interaction.reply({
        content: `❌ A casa **${existing.name}** já existe em Westeros.`,
        ephemeral: true,
      });
      return;
    }

    if (level === HOUSE_LEVELS.DOMINANTE) {
      const dominantHouse = await House.findOne({ level: HOUSE_LEVELS.DOMINANTE });
      if (dominantHouse) {
        await interaction.reply({
          content: `❌ Já existe uma Casa Dominante: **${dominantHouse.name}**. Altere o nível dela antes de criar outra.`,
          ephemeral: true,
        });
        return;
      }
    }

    const house = await House.create({
      name,
      slug,
      level,
      maxMembers,
      goldDragons: 0,
      lordId: null,
      members: [],
    });

    await interaction.reply({
      content: [
        `🏰 **${house.name}** foi fundada em Westeros!`,
        `• Nível: ${HOUSE_LEVEL_LABELS[house.level]}`,
        `• Limite de membros: ${house.maxMembers}`,
        `• Tesouro: 0 🐉 moedas de ouro`,
      ].join('\n'),
    });
  },
};
