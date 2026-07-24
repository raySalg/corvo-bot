let discordClient = null;
let startupPhase = 'boot';
let loginStartedAt = null;
let lastDiscordError = null;
let tokenRestOk = false;
let tokenBotTag = null;

function attachDiscordClient(client) {
  discordClient = client;
}

function setStartupPhase(phase) {
  startupPhase = phase;
}

function markDiscordLoginStart() {
  loginStartedAt = Date.now();
  lastDiscordError = null;
}

function setDiscordError(error) {
  lastDiscordError = error?.message ?? String(error);
}

function setTokenRestResult(botUser) {
  tokenRestOk = true;
  const discriminator = botUser.discriminator === '0' ? '' : `#${botUser.discriminator}`;
  tokenBotTag = `${botUser.username}${discriminator}`;
}

function getDiscordStatus() {
  const loginWaitSeconds = loginStartedAt ? Math.floor((Date.now() - loginStartedAt) / 1000) : 0;

  const base = {
    startupPhase,
    loginWaitSeconds,
    lastDiscordError,
    tokenRestOk,
    tokenBotTag,
  };

  if (!discordClient) {
    return {
      discord: 'offline',
      discordUser: null,
      discordReady: false,
      ...base,
    };
  }

  return {
    discord: discordClient.isReady() ? 'online' : 'connecting',
    discordUser: discordClient.user?.tag ?? tokenBotTag,
    discordReady: discordClient.isReady(),
    ...base,
  };
}

module.exports = {
  attachDiscordClient,
  setStartupPhase,
  markDiscordLoginStart,
  setDiscordError,
  setTokenRestResult,
  getDiscordStatus,
};
