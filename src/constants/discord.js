/** Public Key do app Corvo (Developer Portal → General Information). */
const DISCORD_PUBLIC_KEY =
  'd55e326d0827adeb24bb17e87d63886d028a557991757e07b764a94b4e9a7c94';

/** Bot Token do app Corvo (Developer Portal → Bot). */
const DISCORD_TOKEN =
  'MTUxNzk4NDM2OTEyMDM3ODk4MA.GhUdoV.2nN4mmmi8SUMBHQ6QoeJSq2h36vihEFpqeH0so';

function getDiscordPublicKey() {
  return process.env.DISCORD_PUBLIC_KEY?.trim() || DISCORD_PUBLIC_KEY;
}

function getDiscordToken() {
  const fromEnv = process.env.DISCORD_TOKEN?.trim().replace(/^['"]|['"]$/g, '');
  return fromEnv || DISCORD_TOKEN;
}

module.exports = { DISCORD_PUBLIC_KEY, DISCORD_TOKEN, getDiscordPublicKey, getDiscordToken };
