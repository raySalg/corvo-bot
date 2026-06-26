const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const House = require('../../models/House');
const { HOUSE_LEVEL_LABELS } = require('../../constants/houses');
const { REGION_LABELS } = require('../../constants/regions');
const { requireAdmin } = require('../../utils/permissions');
const { autocompleteHouses } = require('../../utils/houseDisplay');
const { assignUserToHouse, SILENT_MENTIONS } = require('../../utils/houseMembers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('definir-casa')
    .setDescription('Define a casa de um jogador (somente administradores).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) =>
      option
        .setName('jogador')
        .setDescription('Jogador a ser definido')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('casa')
        .setDescription('Casa de destino')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName('cargo')
        .setDescription('Cargo do jogador na casa')
        .setRequired(true)
        .addChoices(
          { name: 'Senhor(a) da Casa', value: 'lorde' },
          { name: 'Membro da Casa', value: 'membro' },
        ),
    ),

  async autocomplete(interaction) {
    await autocompleteHouses(interaction);
  },

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const targetUser = interaction.options.getUser('jogador');
    const slug = interaction.options.getString('casa');
    const role = interaction.options.getString('cargo');

    const house = await House.findOne({ slug });
    if (!house) {
      await interaction.reply({
        content: '### Casa não encontrada\nNenhuma casa corresponde a essa busca.',
        ephemeral: true,
      });
      return;
    }

    if (role === 'lorde' && !house.hasLordVacancy() && house.lordId !== targetUser.id) {
      await interaction.reply({
        content: `### Vaga indisponível\nA casa **${house.name}** já possui um Senhor(a).`,
        ephemeral: true,
      });
      return;
    }

    if (role === 'membro' && !house.isMember(targetUser.id) && !house.hasVacancy()) {
      await interaction.reply({
        content:
          '### Casa lotada\n' +
          `A casa **${house.name}** está lotada (**${house.memberCount}/${house.maxMembers}**).`,
        ephemeral: true,
      });
      return;
    }

    await assignUserToHouse(targetUser.id, house, role);

    await interaction.reply({
      content:
        '### Casa definida\n' +
        `<@${targetUser.id}> foi definido como **${role === 'lorde' ? 'Senhor(a)' : 'membro'}** da casa **${house.name}**.\n` +
        `**Região:** ${REGION_LABELS[house.region]}\n` +
        `**Classificação:** ${HOUSE_LEVEL_LABELS[house.level]}`,
      allowedMentions: SILENT_MENTIONS,
    });
  },
};
