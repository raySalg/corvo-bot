/** Public Key do app Corvo (Developer Portal → General Information). */
const DISCORD_PUBLIC_KEY =
  'd55e326d0827adeb24bb17e87d63886d028a557991757e07b764a94b4e9a7c94';

function getDiscordPublicKey() {
  return process.env.DISCORD_PUBLIC_KEY?.trim() || DISCORD_PUBLIC_KEY;
}

module.exports = { DISCORD_PUBLIC_KEY, getDiscordPublicKey };
