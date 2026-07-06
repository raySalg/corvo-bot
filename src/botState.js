let discordClient = null;
let startupPhase = 'boot';
let loginStartedAt = null;
let lastDiscordError = null;

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

function getDiscordStatus() {
  let mongodb = 'unknown';
  try {
    const mongoose = require('mongoose');
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    mongodb = states[mongoose.connection.readyState] ?? 'unknown';
  } catch {
    mongodb = 'unavailable';
  }

  const loginWaitSeconds = loginStartedAt ? Math.floor((Date.now() - loginStartedAt) / 1000) : 0;

  const base = {
    startupPhase,
    mongodb,
    loginWaitSeconds,
    lastDiscordError,
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
    discordUser: discordClient.user?.tag ?? null,
    discordReady: discordClient.isReady(),
    ...base,
  };
}

module.exports = {
  attachDiscordClient,
  setStartupPhase,
  markDiscordLoginStart,
  setDiscordError,
  getDiscordStatus,
};
