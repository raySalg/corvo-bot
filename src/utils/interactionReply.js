const { MessageFlags } = require('discord.js');

/** Comandos que respondem com showModal — não podem usar deferReply antes do execute. */
const MODAL_COMMANDS = new Set(['embed', 'decreto']);

function ephemeralPayload(contentOrOptions) {
  if (typeof contentOrOptions === 'string') {
    return { content: contentOrOptions, flags: MessageFlags.Ephemeral };
  }

  return {
    ...contentOrOptions,
    flags: (contentOrOptions.flags ?? 0) | MessageFlags.Ephemeral,
  };
}

function wrapInteractionReply(interaction) {
  if (interaction._replyWrapped) return;

  const originalReply = interaction.reply.bind(interaction);
  interaction.reply = async (options) => {
    if (interaction.deferred && !interaction.replied) {
      return interaction.editReply(options);
    }

    if (interaction.replied) {
      return interaction.followUp(options);
    }

    return originalReply(options);
  };

  interaction._replyWrapped = true;
}

async function deferCommandInteraction(interaction, { ephemeral = false } = {}) {
  if (interaction.deferred || interaction.replied) return;

  await interaction.deferReply(
    ephemeral ? { flags: MessageFlags.Ephemeral } : {},
  );
  wrapInteractionReply(interaction);
}

async function sendEphemeral(interaction, content) {
  const payload = ephemeralPayload(content);

  if (interaction.deferred && !interaction.replied) {
    await interaction.editReply(payload);
    return;
  }

  if (interaction.replied) {
    await interaction.followUp(payload);
    return;
  }

  await interaction.reply(payload);
}

module.exports = {
  MODAL_COMMANDS,
  ephemeralPayload,
  wrapInteractionReply,
  deferCommandInteraction,
  sendEphemeral,
};
