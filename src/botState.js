let discordClient = null;

function attachDiscordClient(client) {
  discordClient = client;
}

function getDiscordStatus() {
  if (!discordClient) {
    return { discord: 'offline', discordUser: null, discordReady: false };
  }

  return {
    discord: discordClient.isReady() ? 'online' : 'connecting',
    discordUser: discordClient.user?.tag ?? null,
    discordReady: discordClient.isReady(),
  };
}

module.exports = { attachDiscordClient, getDiscordStatus };
