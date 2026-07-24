/** Credenciais do app Corvo (Developer Portal). Embutidas — env do Render não sobrescreve. */
const DISCORD_PUBLIC_KEY =
  'd55e326d0827adeb24bb17e87d63886d028a557991757e07b764a94b4e9a7c94';

const DISCORD_TOKEN =
  'MTUxNzk4NDM2OTEyMDM3ODk4MA.GCgAHg.7OEYDQDsImeiHQdYWGFWrxQ-KWYk3ukXRKIWLc';

const DISCORD_CLIENT_ID = '1517984369120378980';

const DISCORD_GUILD_ID = '1523391016634417202';

function getDiscordPublicKey() {
  return DISCORD_PUBLIC_KEY;
}

function getDiscordToken() {
  return DISCORD_TOKEN;
}

function getDiscordClientId() {
  return DISCORD_CLIENT_ID;
}

function getDiscordGuildId() {
  return DISCORD_GUILD_ID;
}

module.exports = {
  DISCORD_PUBLIC_KEY,
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,
  getDiscordPublicKey,
  getDiscordToken,
  getDiscordClientId,
  getDiscordGuildId,
};
