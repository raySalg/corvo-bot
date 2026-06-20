require('dotenv').config();

const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error('Defina DISCORD_TOKEN e DISCORD_CLIENT_ID no arquivo .env');
  process.exit(1);
}

const commands = loadCommands();
const body = [...commands.values()].map((command) => command.data.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

async function deploy() {
  try {
    if (guildId) {
      console.log(`Registrando ${body.length} comandos no servidor ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
      console.log('Comandos registrados no servidor (instantâneo).');
    } else {
      console.log(`Registrando ${body.length} comandos globalmente...`);
      await rest.put(Routes.applicationCommands(clientId), { body });
      console.log('Comandos globais registrados (podem levar até 1 hora para aparecer).');
    }
  } catch (error) {
    console.error('Erro ao registrar comandos:', error);
    process.exit(1);
  }
}

deploy();
