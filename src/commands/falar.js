const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { BOT_NAME, BOT_NAME_SHORT } = require('../constants/bot');
const { requireAdmin } = require('../utils/permissions');
const { randomEmbedColor } = require('../utils/embed');
const { publishEmbed } = require('../utils/publishMessage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('falar')
    .setDescription(`Faz o ${BOT_NAME_SHORT} proclamar uma mensagem em nome do reino (teste).`)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('mensagem')
        .setDescription(`Texto que o ${BOT_NAME_SHORT} irá proclamar`)
        .setRequired(true)
        .setMaxLength(2000),
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const message = interaction.options.getString('mensagem');

    const embed = new EmbedBuilder()
      .setColor(randomEmbedColor())
      .setTitle(`Proclamação do ${BOT_NAME_SHORT}`)
      .setDescription(`### Decreto real\n${message}`)
      .setFooter({ text: `Proclamado por ${interaction.user.username}` })
      .setTimestamp();

    const channel =
      interaction.channel ??
      (interaction.channelId
        ? await interaction.client.channels.fetch(interaction.channelId).catch(() => null)
        : null);

    try {
      const publishMode = await publishEmbed(channel, {
        title: `Proclamação do ${BOT_NAME_SHORT}`,
        embed,
      });

      const successMessage =
        publishMode === 'forum_post'
          ? '### Proclamação enviada\nNovo post criado no fórum.'
          : '### Proclamação enviada\nA mensagem foi publicada no canal.';

      await interaction.reply({
        content: successMessage,
        ephemeral: true,
      });
    } catch (error) {
      const content =
        error.message === 'CHANNEL_UNAVAILABLE'
          ? '### Canal indisponível\nNão foi possível publicar a mensagem neste canal.'
          : '### Publicação recusada\nNão foi possível enviar a mensagem neste canal.';

      await interaction.reply({ content, ephemeral: true });
    }
  },
};
