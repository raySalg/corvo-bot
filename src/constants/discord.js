/** Credenciais do app Corvo (Developer Portal). */
const DISCORD_PUBLIC_KEY =
  'd55e326d0827adeb24bb17e87d63886d028a557991757e07b764a94b4e9a7c94';

const DISCORD_CLIENT_ID = '1517984369120378980';

const DISCORD_GUILD_ID = '1535764009515491458';

function getDiscordPublicKey() {
  return process.env.DISCORD_PUBLIC_KEY?.trim() || DISCORD_PUBLIC_KEY;
}

function getDiscordToken() {
  return process.env.DISCORD_TOKEN?.trim() || '';
}

function getDiscordClientId() {
  return process.env.DISCORD_CLIENT_ID?.trim() || DISCORD_CLIENT_ID;
}

function getDiscordGuildId() {
  return process.env.DISCORD_GUILD_ID?.trim() || DISCORD_GUILD_ID;
}

module.exports = {
  DISCORD_PUBLIC_KEY,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,
  getDiscordPublicKey,
  getDiscordToken,
  getDiscordClientId,
  getDiscordGuildId,
};
