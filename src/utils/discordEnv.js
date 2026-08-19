const { getDiscordToken, getDiscordClientId, getDiscordGuildId } = require('../constants/discord');

function validateDiscordEnv() {
  const token = getDiscordToken();
  const clientId = getDiscordClientId();
  const guildId = getDiscordGuildId();

  const errors = [];

  if (!token) {
    errors.push('DISCORD_TOKEN está vazio.');
  } else if (!token.includes('.')) {
    errors.push('DISCORD_TOKEN parece inválido (formato esperado: XXXXX.XXXXX.XXXXX).');
  }

  if (!clientId) {
    errors.push('DISCORD_CLIENT_ID está vazio.');
  } else if (!/^\d{17,20}$/.test(clientId)) {
    errors.push('DISCORD_CLIENT_ID deve ser numérico (Application ID).');
  }

  if (guildId && !/^\d{17,20}$/.test(guildId)) {
    errors.push('DISCORD_GUILD_ID deve ser numérico (ID do servidor Discord).');
  }

  return { token, clientId, guildId, errors, tokenSource: 'env', tokenMid: token.split('.')[1] || '?' };
}

module.exports = { validateDiscordEnv };
