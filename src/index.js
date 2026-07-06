require('dotenv').config();

const { Client, Events, GatewayIntentBits } = require('discord.js');
const { connectDatabase, seedDefaultHouses, seedHouseEconomy, seedWorldState } = require('./config/database');
const { loadCommands } = require('./handlers/commandHandler');
const { routeInteraction } = require('./handlers/interactionRouter');
const { startKeepAliveServer } = require('./server/keepAlive');
const { validateDiscordEnv } = require('./utils/discordEnv');
const { BOT_NAME } = require('./constants/bot');
const { attachDiscordClient, setStartupPhase, markDiscordLoginStart, setDiscordError, setTokenRestResult, getDiscordStatus } = require('./botState');
const { validateBotToken } = require('./utils/discordAuth');

const GATEWAY_WARN_MS = 90_000;

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

attachDiscordClient(client);

const commands = loadCommands();

let databaseBootstrapStarted = false;

async function ensureDatabaseAndSeeds() {
  if (databaseBootstrapStarted) return;
  databaseBootstrapStarted = true;

  setStartupPhase('mongodb');
  console.log('[Corvo] Conectando ao MongoDB...');

  try {
    await connectDatabase();
    await runStartupSeeds();
    setStartupPhase('ready');
  } catch (error) {
    setStartupPhase('mongodb_failed');
    console.error('[Corvo] MongoDB indisponível (bot continua no Discord):', error);
  }
}

async function runStartupSeeds() {
  await seedDefaultHouses();
  await seedWorldState();
  await seedHouseEconomy();
  console.log('[Corvo] Dados iniciais verificados.');
}

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

  setStartupPhase('discord_online');
  void ensureDatabaseAndSeeds();
});

client.on(Events.Error, (error) => {
  setDiscordError(error);
  console.error('[Corvo] Erro no cliente Discord:', error);
});

client.on(Events.ShardError, (error, shardId) => {
  setDiscordError(error);
  console.error(`[Corvo] Erro no shard ${shardId}:`, error);
});

client.on(Events.ShardDisconnect, (_event, shardId) => {
  console.warn(`[Corvo] Shard ${shardId} desconectado. Reconectando...`);
});

client.on(Events.ShardReconnecting, (shardId) => {
  console.log(`[Corvo] Shard ${shardId} reconectando...`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  console.log(
    `[Corvo] Interação via Gateway: type=${interaction.type} command=${interaction.commandName ?? interaction.customId ?? '-'}`,
  );
  await routeInteraction(interaction, commands);
});

async function connectDiscordGateway() {
  setStartupPhase('discord_gateway');
  console.log('[Corvo] Abrindo conexão Gateway (WebSocket)...');

  try {
    await client.login(token);
    console.log('[Corvo] Gateway conectado — aguardando READY...');
  } catch (error) {
    setStartupPhase('discord_login_failed');
    setDiscordError(error);
    console.error('[Corvo] Falha no Gateway:', error);
  }
}

async function start() {
  startKeepAliveServer({ client, commands });

  markDiscordLoginStart();
  setStartupPhase('discord_token_check');
  console.log('[Corvo] Validando DISCORD_TOKEN via API REST...');

  try {
    const botUser = await validateBotToken(token);
    setTokenRestResult(botUser);
    console.log(`[Corvo] Token REST ok — bot ${botUser.username} (${botUser.id}).`);
  } catch (error) {
    setStartupPhase('discord_login_failed');
    setDiscordError(error);
    throw new Error(
      `DISCORD_TOKEN rejeitado pela API do Discord (${error.status ?? error.code ?? 'erro'}). ` +
        'Gere um novo token em Developer Portal → Bot → Reset Token.',
    );
  }

  void connectDiscordGateway();

  setTimeout(() => {
    if (client.isReady()) return;

    const { startupPhase } = getDiscordStatus();
    if (startupPhase === 'discord_gateway' || startupPhase === 'discord_login') {
      setDiscordError(new Error('Gateway WebSocket não conectou em 90s'));
      console.error(
        '[Corvo] Gateway timeout — comandos podem funcionar via POST /interactions se DISCORD_PUBLIC_KEY estiver configurada.',
      );
    }
  }, GATEWAY_WARN_MS);
}

process.on('unhandledRejection', (reason) => {
  console.error('[Corvo] Promessa rejeitada sem tratamento:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Corvo] Exceção não tratada:', error);
});

start().catch((error) => {
  console.error('[Corvo] Falha ao iniciar:', error);
  process.exit(1);
});
