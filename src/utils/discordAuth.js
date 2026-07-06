const { REST, Routes } = require('discord.js');

const REST_TIMEOUT_MS = 20_000;

async function validateBotToken(token) {
  const rest = new REST({ version: '10', timeout: REST_TIMEOUT_MS }).setToken(token);

  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`API Discord não respondeu em ${REST_TIMEOUT_MS / 1000}s`)), REST_TIMEOUT_MS);
  });

  return Promise.race([rest.get(Routes.user('@me')), timeout]);
}

module.exports = { validateBotToken };
