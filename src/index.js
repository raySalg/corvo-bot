require('dotenv').config();

const { Client, Events, GatewayIntentBits } = require('discord.js');
const {
  connectDatabase,
  seedDefaultHouses,
  seedHouseEconomy,
  seedWorldState,
} = require('./config/database');
const { loadCommands } = require('./handlers/commandHandler');
const { startKeepAliveServer } = require('./server/keepAlive');

const { validateDiscordEnv } = require('./utils/discordEnv');
const { BOT_NAME } = require('./constants/bot');
const { CASAS_REGION_PREFIX, handleCasasRegionButton } = require('./utils/casasView');
const { token, errors } = validateDiscordEnv();

if (errors.length > 0) {
  console.error('[Corvo] Variáveis de ambiente inválidas:');
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
  console.log(`[Corvo] ${BOT_NAME} despertou como ${readyClient.user.tag}`);
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

  if (interaction.isModalSubmit()) {
    const modalCommandName = interaction.customId.split(':')[0];
    const command = commands.get(modalCommandName);

    if (!command?.handleModalSubmit) {
      console.error(`Modal sem handler registrado: ${interaction.customId}`);
      const reply = {
        content: '### Erro\nEste formulário não está mais disponível. Execute o comando novamente.',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
      return;
    }

    try {
      await command.handleModalSubmit(interaction);

      if (!interaction.replied && !interaction.deferred) {
        console.error(`Modal de /${modalCommandName} concluiu sem resposta: ${interaction.customId}`);
        await interaction.reply({
          content: '### Erro\nNão foi possível processar o formulário. Tente novamente.',
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error(`Erro ao processar modal de /${modalCommandName}:`, error);

      const reply = {
        content: '### Erro\nNão foi possível processar o formulário. Tente novamente.',
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
  await seedWorldState();
  await seedHouseEconomy();
  await client.login(token);
}

start().catch((error) => {
  console.error('[Corvo] Falha ao iniciar:', error);
  process.exit(1);
});
