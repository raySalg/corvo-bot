require('dotenv').config();

const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { validateDiscordEnv } = require('./utils/discordEnv');

const { token, clientId, guildId, errors } = validateDiscordEnv();

if (errors.length > 0) {
  console.error('[Corvo] Variáveis de ambiente inválidas:');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

const commands = loadCommands();
const body = [...commands.values()].map((command) => command.data.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

const isGlobalDeploy = process.argv.includes('--global') || process.env.DEPLOY_GLOBAL === 'true' || !guildId;

async function deploy() {
  try {
    const botUser = await rest.get(Routes.user('@me'));
    console.log(`[Corvo] Token válido. Bot autenticado como ${botUser.username}#${botUser.discriminator} (${botUser.id}).`);

    const effectiveClientId = clientId || botUser.id;

    if (clientId && botUser.id !== clientId) {
      console.warn(
        `[Corvo] Aviso: DISCORD_CLIENT_ID (${clientId}) difere do ID do bot (${botUser.id}). Usando ${effectiveClientId}.`,
      );
    }

    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${effectiveClientId}&permissions=2147485696&scope=bot%20applications.commands`;
    console.log(`[Corvo] Link para convidar o bot em qualquer servidor:\n  ${inviteUrl}`);

    if (!isGlobalDeploy && guildId) {
      const guilds = await rest.get(Routes.userGuilds());
      const isInGuild = guilds.some((guild) => guild.id === guildId);

      if (!isInGuild) {
        console.error(`[Corvo] 50001 Missing Access — o bot não está no servidor ${guildId}.`);
        console.error('[Corvo] Como corrigir:');
        console.error('  1. Convide o bot para o servidor usando este link:');
        console.error(`     ${inviteUrl}&guild_id=${guildId}`);
        console.error('  2. Confirme que DISCORD_GUILD_ID é o ID do servidor correto.');
        console.error('  3. Ou remova DISCORD_GUILD_ID / use npm run deploy-commands:global para registrar globalmente.');
        console.warn('[Corvo] O bot será iniciado mesmo assim; os comandos podem não funcionar até o convite.');
        return;
      }

      console.log(`[Corvo] Registrando ${body.length} comandos no servidor ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(effectiveClientId, guildId), { body });
      console.log('[Corvo] Comandos registrados no servidor específico (instantâneo).');
    } else {
      console.log(`[Corvo] Registrando ${body.length} comandos globalmente para todos os servidores...`);
      await rest.put(Routes.applicationCommands(effectiveClientId), { body });
      console.log('[Corvo] Comandos globais registrados com sucesso! (Disponíveis em qualquer servidor onde o bot for adicionado).');
    }
  } catch (error) {
    if (error.status === 401) {
      console.error('[Corvo] 401 Unauthorized — o DISCORD_TOKEN está incorreto ou expirou.');
      console.error('[Corvo] Como corrigir:');
      console.error('  1. Discord Developer Portal → sua aplicação → Bot → Reset Token');
      console.error('  2. Copie o Bot Token e atualize DISCORD_TOKEN no seu arquivo .env ou no painel de hospedagem.');
    } else if (error.code === 50001 || error.status === 403) {
      console.error('[Corvo] 50001 Missing Access — o bot não tem acesso ao servidor informado.');
      console.error('[Corvo] Verifique se o bot foi convidado e se DISCORD_GUILD_ID está correto.');
    } else {
      console.error('[Corvo] Erro ao registrar comandos:', error);
    }

    console.warn('[Corvo] Deploy de comandos finalizado com aviso; o bot será iniciado.');
  }
}

deploy();
