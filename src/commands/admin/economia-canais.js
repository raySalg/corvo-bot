const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const { setEconomyChannels, getWorldState } = require('../../services/worldService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economia-canais')
    .setDescription('Define os canais de decretos e de alianças (administradores).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('decretos')
        .setDescription('Canal onde os decretos serão publicados no ciclo')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    )
    .addChannelOption((option) =>
      option
        .setName('aliancas')
        .setDescription('Canal exclusivo para comandos de aliança')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    ),

  async execute(interaction) {
    if (!requireAdmin(interaction)) return;

    const decretos = interaction.options.getChannel('decretos');
    const aliancas = interaction.options.getChannel('aliancas');

    if (!decretos && !aliancas) {
      const world = await getWorldState();
      const decreeText = world.decreeChannelId ? `<#${world.decreeChannelId}>` : 'não definido';
      const allianceText = world.allianceChannelId ? `<#${world.allianceChannelId}>` : 'não definido';
      await interaction.reply({
        content:
          '### Canais da economia\n' +
          `**Decretos:** ${decreeText}\n` +
          `**Alianças:** ${allianceText}\n\n` +
          'Informe `decretos` e/ou `aliancas` para alterar.',
        ephemeral: true,
      });
      return;
    }

    await setEconomyChannels({
      decreeChannelId: decretos ? decretos.id : undefined,
      allianceChannelId: aliancas ? aliancas.id : undefined,
    });

    const lines = ['### Canais atualizados'];
    if (decretos) lines.push(`**Decretos:** <#${decretos.id}>`);
    if (aliancas) lines.push(`**Alianças:** <#${aliancas.id}>`);

    await interaction.reply({ content: lines.join('\n'), ephemeral: true });
  },
};
