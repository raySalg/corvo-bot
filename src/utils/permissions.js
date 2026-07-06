const { PermissionFlagsBits } = require('discord.js');
const { sendEphemeral } = require('./interactionReply');

const ACCESS_DENIED_MESSAGE =
  '### Acesso negado\nApenas **administradores** do reino podem usar este comando.';

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

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = { isAdmin, memberIsAdmin, requireAdmin, slugify, ACCESS_DENIED_MESSAGE };
