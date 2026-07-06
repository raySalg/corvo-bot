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
    if (!(await requireAdmin(interaction))) return;

    const confirmation = interaction.options.getString('confirmacao').trim().toUpperCase();

    if (confirmation !== CONFIRMATION_TEXT) {
      await interaction.reply({
        content:
          '### Confirmação necessária\n' +
          `Este comando apaga todas as casas personalizadas, restaura as **${DEFAULT_HOUSES.length}** casas padrão, zera tesouros e remove **todos** os jogadores.\n\n` +
          `Para confirmar, use \`confirmacao: ${CONFIRMATION_TEXT}\` (sem aspas).`,
        ephemeral: true,
      });
      return;
    }

    try {
      await resetAllHouses();

      await interaction.editReply({
        content:
          '### Casas reiniciadas\n' +
          `**${DEFAULT_HOUSES.length}** casas restauradas ao estado inicial.\n` +
          'Tesouros zerados e todos os jogadores removidos das casas.',
      });
    } catch (error) {
      console.error('[Corvo] Erro ao reiniciar casas:', error);

      await interaction.editReply({
        content:
          '### Erro ao reiniciar\n' +
          'Não foi possível reiniciar as casas. Verifique os logs do bot e tente novamente.',
      });
    }
  },
};
