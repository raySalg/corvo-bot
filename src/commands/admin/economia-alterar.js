const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const House = require('../../models/House');
const { requireAdmin } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economia-alterar')
    .setDescription('Altera o tesouro de uma casa em moedas de ouro (somente administradores).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('casa')
        .setDescription('Casa a ser alterada')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('valor')
        .setDescription('Valor a adicionar ou remover (ex: 200 ou -50)')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('motivo')
        .setDescription('Motivo da alteração (opcional)')
        .setRequired(false),
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const houses = await House.find({
      name: { $regex: focused, $options: 'i' },
    })
      .limit(25)
      .select('name slug goldDragons');

    await interaction.respond(
      houses.map((house) => ({
        name: `${house.name} — ${house.goldDragons ?? 0} moedas`,
        value: house.slug,
      })),
    );
  },

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const slug = interaction.options.getString('casa');
    const amount = interaction.options.getInteger('valor');
    const reason = interaction.options.getString('motivo');

    const house = await House.findOne({ slug });
    if (!house) {
      await interaction.reply({
        content: '### Casa não encontrada\nNenhuma casa corresponde a essa busca.',
        ephemeral: true,
      });
      return;
    }

    const previousBalance = house.goldDragons;
    house.goldDragons += amount;
    await house.save();

    const sign = amount >= 0 ? '+' : '';
    const lines = [
      '### Tesouro atualizado',
      `A economia da casa **${house.name}** foi alterada.`,
      '',
      `**Alteração:** ${sign}${amount} moedas de ouro`,
      `**Saldo anterior:** ${previousBalance}`,
      `**Saldo atual:** ${house.goldDragons}`,
    ];

    if (reason) {
      lines.push(`**Motivo:** ${reason}`);
    }

    await interaction.reply({ content: lines.join('\n') });
  },
};
