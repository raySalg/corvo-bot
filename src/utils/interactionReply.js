const { MessageFlags } = require('discord.js');

function ephemeralPayload(content) {
  return { content, flags: MessageFlags.Ephemeral };
}

async function sendEphemeral(interaction, content) {
  const payload = ephemeralPayload(content);

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}

module.exports = { ephemeralPayload, sendEphemeral };
