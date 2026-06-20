function normalizeEnv(value) {
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function validateDiscordEnv() {
  const token = normalizeEnv(process.env.DISCORD_TOKEN);
  const clientId = normalizeEnv(process.env.DISCORD_CLIENT_ID);
  const guildId = normalizeEnv(process.env.DISCORD_GUILD_ID);

  const errors = [];

  if (!token) {
    errors.push('DISCORD_TOKEN está vazio.');
  } else if (!token.includes('.')) {
    errors.push(
      'DISCORD_TOKEN parece inválido. Use o **Bot Token** (Developer Portal → Bot → Reset Token), não o OAuth Client Secret.',
    );
  }

  if (!clientId) {
    errors.push('DISCORD_CLIENT_ID está vazio.');
  } else if (!/^\d{17,20}$/.test(clientId)) {
    errors.push('DISCORD_CLIENT_ID deve ser numérico (Application ID).');
  }

  if (guildId && !/^\d{17,20}$/.test(guildId)) {
    errors.push('DISCORD_GUILD_ID deve ser numérico (ID do servidor Discord).');
  }

  return { token, clientId, guildId, errors };
}

module.exports = { normalizeEnv, validateDiscordEnv };
