/**
 * Extrai o Client ID (Application ID) a partir do primeiro segmento base64 do Bot Token do Discord.
 * Em tokens de bot do Discord, a primeira parte antes do primeiro ponto é sempre o Snowflake ID em base64.
 */
function extractClientIdFromToken(token) {
  if (!token || !token.includes('.')) return null;
  try {
    const raw = Buffer.from(token.split('.')[0], 'base64').toString('utf8');
    return /^\d{17,20}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

function getDiscordPublicKey() {
  return process.env.DISCORD_PUBLIC_KEY?.trim() || '';
}

function getDiscordToken() {
  return process.env.DISCORD_TOKEN?.trim() || '';
}

function getDiscordClientId() {
  const fromEnv = process.env.DISCORD_CLIENT_ID?.trim();
  if (fromEnv) return fromEnv;
  return extractClientIdFromToken(getDiscordToken()) || '';
}

function getDiscordGuildId() {
  return process.env.DISCORD_GUILD_ID?.trim() || '';
}

module.exports = {
  getDiscordPublicKey,
  getDiscordToken,
  getDiscordClientId,
  getDiscordGuildId,
};

