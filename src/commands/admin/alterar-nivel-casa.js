const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const House = require('../../models/House');
const { HOUSE_LEVELS, HOUSE_LEVEL_LABELS } = require('../../constants/houses');
const { requireAdmin } = require('../../utils/permissions');

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
          { name: 'Casa Dominante (Imperador)', value: HOUSE_LEVELS.DOMINANTE },
          { name: 'Casa Soberana (Rei)', value: HOUSE_LEVELS.MAIOR },
          { name: 'Casa Menor (Vassala)', value: HOUSE_LEVELS.MENOR },
        ),
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const houses = await House.find({
      name: { $regex: focused, $options: 'i' },
    })
      .limit(25)
      .select('name slug');

    await interaction.respond(
      houses.map((house) => ({
        name: house.name,
        value: house.slug,
      })),
    );
  },

  async execute(interaction) {
    if (!requireAdmin(interaction)) return;

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

    if (newLevel === HOUSE_LEVELS.DOMINANTE && house.level !== HOUSE_LEVELS.DOMINANTE) {
      const dominantHouse = await House.findOne({ level: HOUSE_LEVELS.DOMINANTE });
      if (dominantHouse) {
        await interaction.reply({
          content:
            '### Trono imperial ocupado\n' +
            `**${dominantHouse.name}** já é a Casa Dominante. Altere o nível dela primeiro.`,
          ephemeral: true,
        });
        return;
      }
    }

    const previousLevel = house.level;
    house.level = newLevel;
    await house.save();

    await interaction.reply({
      content: [
        '### Classificação alterada',
        `A casa **${house.name}** mudou de nível.`,
        '',
        `**Antes:** ${HOUSE_LEVEL_LABELS[previousLevel]}`,
        `**Agora:** ${HOUSE_LEVEL_LABELS[newLevel]}`,
      ].join('\n'),
    });
  },
};
