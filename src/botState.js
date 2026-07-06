let discordClient = null;
let startupPhase = 'boot';

function attachDiscordClient(client) {
  discordClient = client;
}

function setStartupPhase(phase) {
  startupPhase = phase;
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

  if (!discordClient) {
    return {
      discord: 'offline',
      discordUser: null,
      discordReady: false,
      startupPhase,
      mongodb,
    };
  }

  return {
    discord: discordClient.isReady() ? 'online' : 'connecting',
    discordUser: discordClient.user?.tag ?? null,
    discordReady: discordClient.isReady(),
    startupPhase,
    mongodb,
  };
}

module.exports = { attachDiscordClient, setStartupPhase, getDiscordStatus };
