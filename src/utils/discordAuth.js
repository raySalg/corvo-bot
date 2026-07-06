const { REST, Routes } = require('discord.js');

async function validateBotToken(token) {
  const rest = new REST({ version: '10', timeout: 15_000 }).setToken(token);
  return rest.get(Routes.user('@me'));
}

module.exports = { validateBotToken };
