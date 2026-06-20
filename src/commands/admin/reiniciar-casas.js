const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const { resetAllHouses } = require('../../config/database');
const { DEFAULT_HOUSES } = require('../../constants/houses');

const CONFIRMATION_TEXT = 'CONFIRMAR';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reiniciar-casas')
    .setDescription('Reinicia todas as casas e remove todos os jogadores (somente administradores).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('confirmacao')
        .setDescription(`Digite ${CONFIRMATION_TEXT} para executar`)
        .setRequired(true),
    ),

  async execute(interaction) {
    if (!requireAdmin(interaction)) return;

    const confirmation = interaction.options.getString('confirmacao');

    if (confirmation !== CONFIRMATION_TEXT) {
      await interaction.reply({
        content:
          '### Confirmação necessária\n' +
          `Este comando apaga todas as casas personalizadas, restaura as **${DEFAULT_HOUSES.length}** casas padrão, zera tesouros e remove **todos** os jogadores.\n\n` +
          `Para confirmar, execute novamente com \`confirmacao: ${CONFIRMATION_TEXT}\`.`,
        ephemeral: true,
      });
      return;
    }

    await resetAllHouses();

    await interaction.reply({
      content:
        '### Casas reiniciadas\n' +
        'Todas as casas foram restauradas ao estado inicial.\n' +
        'Tesouros zerados e todos os jogadores removidos das casas.',
    });
  },
};
