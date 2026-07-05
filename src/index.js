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
const { ephemeralPayload, sendEphemeral } = require('./utils/interactionReply');

const { token, clientId, guildId, errors } = validateDiscordEnv();

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
  console.log(`[Corvo] Application ID: ${readyClient.application.id}`);
  console.log(`[Corvo] ${commands.size} comandos carregados em memória.`);
  console.log(
    `[Corvo] Comandos registrados no deploy para guild: ${guildId || '(global — pode levar até 1 h)'}`,
  );

  if (clientId && readyClient.application.id !== clientId) {
    console.error(
      `[Corvo] DISCORD_CLIENT_ID (${clientId}) difere do app conectado (${readyClient.application.id}).`,
    );
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId.startsWith(CASAS_REGION_PREFIX)) {
    try {
      await handleCasasRegionButton(interaction);
    } catch (error) {
      console.error('Erro ao processar botão de região:', error);
      await sendEphemeral(
        interaction,
        '### Erro\nNão foi possível carregar esta região. Tente novamente.',
      );
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    const modalCommandName = interaction.customId.split(':')[0];
    const command = commands.get(modalCommandName);

    if (!command?.handleModalSubmit) {
      console.error(`Modal sem handler registrado: ${interaction.customId}`);
      await sendEphemeral(
        interaction,
        '### Erro\nEste formulário não está mais disponível. Execute o comando novamente.',
      );
      return;
    }

    try {
      await command.handleModalSubmit(interaction);

      if (!interaction.replied && !interaction.deferred) {
        console.error(`Modal de /${modalCommandName} concluiu sem resposta: ${interaction.customId}`);
        await sendEphemeral(
          interaction,
          '### Erro\nNão foi possível processar o formulário. Tente novamente.',
        );
      }
    } catch (error) {
      console.error(`Erro ao processar modal de /${modalCommandName}:`, error);
      await sendEphemeral(
        interaction,
        '### Erro\nNão foi possível processar o formulário. Tente novamente.',
      );
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
  if (!command) {
    console.error(
      `[Corvo] Comando /${interaction.commandName} não encontrado (app ${interaction.applicationId}, guild ${interaction.guildId}).`,
    );
    await sendEphemeral(
      interaction,
      '### Comando indisponível\nEste comando não está registrado neste servidor. Peça a um admin para redeployar o bot.',
    );
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Erro ao executar /${interaction.commandName}:`, error);
    await sendEphemeral(
      interaction,
      '### Erro\nOcorreu um erro ao executar este comando. Tente novamente.',
    );
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
