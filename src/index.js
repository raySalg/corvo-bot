require('dotenv').config();

const { Client, Events, GatewayIntentBits } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { routeInteraction } = require('./handlers/interactionRouter');
const { startKeepAliveServer } = require('./server/keepAlive');
const { validateDiscordEnv } = require('./utils/discordEnv');
const { BOT_NAME, CROW_EMOJI } = require('./constants/bot');
const {
  attachDiscordClient,
  setStartupPhase,
  markDiscordLoginStart,
  setDiscordError,
  setTokenRestResult,
  getDiscordStatus,
} = require('./botState');
const { validateBotToken } = require('./utils/discordAuth');
const { startExportScheduler } = require('./services/exportSchedule');
const { startBoatosScheduler } = require('./services/boatosSchedule');
const { startMessageScheduler } = require('./services/messageSchedule');
const { connectDatabase } = require('./config/database');

const GATEWAY_WARN_MS = 90_000;

const { token, clientId, guildId, errors, tokenMid } = validateDiscordEnv();

if (errors.length > 0) {
  console.error('[Corvo] Variáveis de ambiente inválidas:');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(`[Corvo] Token mid=${tokenMid} (definido via DISCORD_TOKEN).`);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

attachDiscordClient(client);

const commands = loadCommands();

client.once(Events.ClientReady, (readyClient) => {
  console.log(`[Corvo] ${BOT_NAME} conectado como ${readyClient.user.tag}`);
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

  setStartupPhase('ready');

  void (async () => {
    try {
      setStartupPhase('mongodb');
      await connectDatabase();
      await startExportScheduler(readyClient);
      await startBoatosScheduler(readyClient);
      await startMessageScheduler(readyClient);
      setStartupPhase('ready');
    } catch (error) {
      setStartupPhase('mongodb_failed');
      console.error('[Corvo] MongoDB indisponível — agendamento TXT não persistirá:', error.message ?? error);
    }
  })();
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

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !client.user) return;
  if (!message.mentions.has(client.user, { ignoreEveryone: true, ignoreRoles: true })) return;

  try {
    await message.react(CROW_EMOJI);
  } catch (error) {
    console.error('[Corvo] Falha ao reagir à menção:', error.message ?? error);
  }
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
    if (String(error?.message ?? error).includes('disallowed intents')) {
      console.error(
        '[Corvo] Ative Message Content Intent e Server Members Intent em Developer Portal → Bot → Privileged Gateway Intents.',
      );
    }
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
    console.error('[Corvo] Token rejeitado ou timeout REST:', error.message ?? error);
    console.warn('[Corvo] Tentando Gateway mesmo assim...');
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
  console.error('[Corvo] Falha crítica ao iniciar:', error);
});
