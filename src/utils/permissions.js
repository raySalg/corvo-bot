const { PermissionFlagsBits } = require('discord.js');

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

async function requireAdmin(interaction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: '### Acesso negado\nApenas **administradores** do reino podem usar este comando.',
      ephemeral: true,
    });
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

module.exports = { isAdmin, requireAdmin, slugify };
