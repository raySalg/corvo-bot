const { MessageFlags } = require('discord.js');

/** Após deferReply, o Discord aguarda até 15 min pela resposta final (editReply). */
const INTERACTION_FOLLOWUP_MS = 15 * 60 * 1000;

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

/** Confirma a interação imediatamente (dentro dos 3 s do Discord) para ganhar até 15 min de processamento. */
async function acknowledgeInteraction(interaction) {
  if (interaction.deferred || interaction.replied) return;

  if (interaction.isChatInputCommand()) {
    if (MODAL_COMMANDS.has(interaction.commandName)) return;
    await deferCommandInteraction(interaction);
    return;
  }

  if (interaction.isModalSubmit() || interaction.isButton()) {
    await deferCommandInteraction(interaction, { ephemeral: true });
  }
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
  INTERACTION_FOLLOWUP_MS,
  MODAL_COMMANDS,
  ephemeralPayload,
  wrapInteractionReply,
  deferCommandInteraction,
  acknowledgeInteraction,
  sendEphemeral,
};
