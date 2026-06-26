const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const House = require('../../models/House');
const { requireAdmin } = require('../../utils/permissions');
const { autocompleteHouses } = require('../../utils/houseDisplay');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deletar-casa')
    .setDescription('Remove uma casa de Westeros (somente administradores).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('casa')
        .setDescription('Casa a ser removida')
        .setRequired(true)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction) {
    await autocompleteHouses(interaction);
  },

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const slug = interaction.options.getString('casa');
    const house = await House.findOne({ slug });

    if (!house) {
      await interaction.reply({
        content: '### Casa não encontrada\nNenhuma casa corresponde a essa busca.',
        ephemeral: true,
      });
      return;
    }

    const houseName = house.name;
    const memberCount = house.memberCount;
    await House.deleteOne({ slug });

    await interaction.reply({
      content:
        '### Casa removida\n' +
        `**${houseName}** foi excluída dos registros de Westeros.\n` +
        (memberCount > 0
          ? `**${memberCount}** jogador(es) ficaram sem casa.`
          : 'Nenhum jogador estava vinculado a esta casa.'),
    });
  },
};
