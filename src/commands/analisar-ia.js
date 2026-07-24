const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { requireAdmin } = require('../utils/permissions');
const { sendEphemeral } = require('../utils/interactionReply');
const { runScheduledAiAnalysis } = require('../services/exportSchedule');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('analisar-ia')
    .setDescription('Dispara agora a análise de IA salva no site (mesmo do botão Analisar com IA agora).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    try {
      const result = await runScheduledAiAnalysis(interaction.client, { manual: true });
      await sendEphemeral(
        interaction,
        `### Análise IA concluída\n` +
          `Enviado para <#${result.destinationId}> (#${result.destinationName})\n` +
          `Período **${result.from} → ${result.to}** · ${result.channels} canal(is)/tópico(s) · ${result.total} mensagem(ns)\n` +
          `Resposta em **${result.messageCount}** mensagem(ns) no Discord.`,
      );
    } catch (error) {
      const detail = error?.message ?? String(error);
      await sendEphemeral(
        interaction,
        `### Falha na análise IA\n${detail}\n\nConfira no site se canais, período, prompt e destino da IA estão salvos.`,
      );
    }
  },
};
