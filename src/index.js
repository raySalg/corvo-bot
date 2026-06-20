require('dotenv').config();

const { Client, Events, GatewayIntentBits } = require('discord.js');
const { connectDatabase, seedDefaultHouses } = require('./config/database');
const { loadCommands } = require('./handlers/commandHandler');
const { startKeepAliveServer } = require('./server/keepAlive');

const { validateDiscordEnv } = require('./utils/discordEnv');
const { CASAS_REGION_PREFIX, handleCasasRegionButton } = require('./utils/casasView');
const { token, errors } = validateDiscordEnv();

if (errors.length > 0) {
  console.error('[Sete] Variáveis de ambiente inválidas:');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commands = loadCommands();

client.once(Events.ClientReady, (readyClient) => {
  console.log(`[Sete] O Sete despertou como ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId.startsWith(CASAS_REGION_PREFIX)) {
    try {
      await handleCasasRegionButton(interaction);
    } catch (error) {
      console.error('Erro ao processar botão de região:', error);

      const reply = {
        content: '### Erro\nNão foi possível carregar esta região. Tente novamente.',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
    return;
  }

  if (interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);
    if (!command?.autocomplete) return;

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(`Erro no autocomplete de /${interaction.commandName}:`, error);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Erro ao executar /${interaction.commandName}:`, error);

    const reply = {
      content: '### Erro\nOcorreu um erro ao executar este comando. Tente novamente.',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

async function start() {
  startKeepAliveServer();
  await connectDatabase();
  await seedDefaultHouses();
  await client.login(token);
}

start().catch((error) => {
  console.error('[Sete] Falha ao iniciar:', error);
  process.exit(1);
});
