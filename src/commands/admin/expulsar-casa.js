const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const House = require('../../models/House');
const { requireAdmin } = require('../../utils/permissions');
const { autocompleteHouses } = require('../../utils/houseDisplay');
const { findUserHouse, removeUserFromAllHouses, SILENT_MENTIONS } = require('../../utils/houseMembers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('expulsar-casa')
    .setDescription('Remove um jogador de uma casa (somente administradores).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) =>
      option
        .setName('jogador')
        .setDescription('Jogador a ser expulso')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('casa')
        .setDescription('Casa da qual expulsar (opcional se o jogador já pertencer a uma)')
        .setRequired(false)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction) {
    await autocompleteHouses(interaction);
  },

  async execute(interaction) {
    if (!requireAdmin(interaction)) return;

    const targetUser = interaction.options.getUser('jogador');
    const slug = interaction.options.getString('casa');

    let house;

    if (slug) {
      house = await House.findOne({ slug });
      if (!house) {
        await interaction.reply({
          content: '### Casa não encontrada\nNenhuma casa corresponde a essa busca.',
          ephemeral: true,
        });
        return;
      }

      if (!house.isMember(targetUser.id)) {
        await interaction.reply({
          content: `### Jogador não pertence à casa\n<@${targetUser.id}> não faz parte de **${house.name}**.`,
          allowedMentions: SILENT_MENTIONS,
          ephemeral: true,
        });
        return;
      }
    } else {
      house = await findUserHouse(targetUser.id);
      if (!house) {
        await interaction.reply({
          content: `### Sem casa\n<@${targetUser.id}> não pertence a nenhuma casa.`,
          allowedMentions: SILENT_MENTIONS,
          ephemeral: true,
        });
        return;
      }
    }

    const wasLord = house.lordId === targetUser.id;
    await removeUserFromAllHouses(targetUser.id);

    await interaction.reply({
      content:
        '### Expulsão registrada\n' +
        `<@${targetUser.id}> foi removido da casa **${house.name}**` +
        (wasLord ? ' (era **Senhor(a)**).' : '.'),
      allowedMentions: SILENT_MENTIONS,
    });
  },
};
