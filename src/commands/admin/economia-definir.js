const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const House = require('../../models/House');
const EconomyLog = require('../../models/EconomyLog');
const { requireAdmin } = require('../../utils/permissions');
const { autocompleteHouses } = require('../../utils/houseDisplay');
const { getRegionLabel } = require('../../constants/regions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economia-definir')
    .setDescription('Define rendimento, cofres, taxa e fonte econômica de uma casa (administradores).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('casa')
        .setDescription('Casa a configurar')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('rendimento')
        .setDescription('Rendimento anual em D.O.')
        .setMinValue(0)
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName('cofres')
        .setDescription('Define os Cofres Totais (D.O.) diretamente')
        .setMinValue(0)
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName('taxa')
        .setDescription('Taxa de imposto cobrada dos subordinados, em % (ex: 15)')
        .setMinValue(0)
        .setMaxValue(100)
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName('fonte')
        .setDescription('Fonte econômica predominante (ex: Agricultura, Minas, Portos)')
        .setRequired(false),
    ),

  autocomplete: autocompleteHouses,

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const slug = interaction.options.getString('casa');
    const rendimento = interaction.options.getInteger('rendimento');
    const cofres = interaction.options.getInteger('cofres');
    const taxa = interaction.options.getInteger('taxa');
    const fonte = interaction.options.getString('fonte');

    const house = await House.findOne({ slug });
    if (!house) {
      await interaction.reply({
        content: '### Casa não encontrada\nNenhuma casa corresponde a essa busca.',
        ephemeral: true,
      });
      return;
    }

    const changes = [];

    if (rendimento != null) {
      house.annualIncome = rendimento;
      changes.push(`**Rendimento anual:** ${rendimento} D.O.`);
    }

    if (cofres != null) {
      house.goldDragons = cofres;
      changes.push(`**Cofres Totais:** ${cofres} D.O.`);
    }

    if (taxa != null) {
      house.taxRate = taxa / 100;
      changes.push(`**Taxa de imposto:** ${taxa}%`);
    }

    if (fonte != null) {
      house.incomeSource = fonte.trim();
      changes.push(`**Fonte econômica:** ${fonte.trim() || '—'}`);
    }

    if (changes.length === 0) {
      await interaction.reply({
        content: '### Nada alterado\nInforme ao menos um campo para configurar.',
        ephemeral: true,
      });
      return;
    }

    await house.save();

    await EconomyLog.create({
      type: 'admin',
      houseSlug: house.slug,
      actorId: interaction.user.id,
      detail: `Configuração econômica: ${changes.join(' · ')}`,
    });

    const lines = [
      '### Economia configurada',
      `Casa **${house.name}** (${getRegionLabel(house.region)})`,
      '',
      ...changes,
    ];

    await interaction.reply({ content: lines.join('\n'), ephemeral: true });
  },
};
