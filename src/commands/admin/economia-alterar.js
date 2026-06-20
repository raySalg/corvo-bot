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
      .select('name slug');

    await interaction.respond(
      houses.map((house) => ({
        name: `${house.name} — ${house.goldDragons ?? 0} 🐉`,
        value: house.slug,
      })),
    );
  },

  async execute(interaction) {
    if (!requireAdmin(interaction)) return;

    const slug = interaction.options.getString('casa');
    const amount = interaction.options.getInteger('valor');
    const reason = interaction.options.getString('motivo');

    const house = await House.findOne({ slug });
    if (!house) {
      await interaction.reply({
        content: '❌ Casa não encontrada.',
        ephemeral: true,
      });
      return;
    }

    const previousBalance = house.goldDragons;
    house.goldDragons += amount;
    await house.save();

    const sign = amount >= 0 ? '+' : '';
    const lines = [
      `💰 Tesouro da casa **${house.name}** atualizado.`,
      `• Alteração: ${sign}${amount} 🐉 moedas de ouro`,
      `• Saldo anterior: ${previousBalance} 🐉`,
      `• Saldo atual: ${house.goldDragons} 🐉`,
    ];

    if (reason) {
      lines.push(`• Motivo: ${reason}`);
    }

    await interaction.reply({ content: lines.join('\n') });
  },
};
