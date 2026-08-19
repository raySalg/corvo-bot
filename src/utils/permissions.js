const { PermissionFlagsBits } = require('discord.js');
const { sendEphemeral } = require('./interactionReply');

const ACCESS_DENIED_MESSAGE =
  '### Acesso negado\nApenas **administradores** do servidor podem usar este comando.';

function memberIsAdmin(member) {
  if (!member?.permissions) return false;
  return (BigInt(member.permissions) & BigInt(PermissionFlagsBits.Administrator)) !== 0n;
}

function isAdmin(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  return memberIsAdmin(interaction.member);
}

async function requireAdmin(interaction) {
  if (!isAdmin(interaction)) {
    await sendEphemeral(interaction, ACCESS_DENIED_MESSAGE);
    return false;
  }
  return true;
}

module.exports = { isAdmin, memberIsAdmin, requireAdmin, ACCESS_DENIED_MESSAGE };
