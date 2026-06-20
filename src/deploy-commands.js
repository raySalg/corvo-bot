require('dotenv').config();

const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { validateDiscordEnv } = require('./utils/discordEnv');

const { token, clientId, guildId, errors } = validateDiscordEnv();

if (errors.length > 0) {
  console.error('[Sete] Variáveis de ambiente inválidas:');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

const commands = loadCommands();
const body = [...commands.values()].map((command) => command.data.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

async function deploy() {
  try {
    const botUser = await rest.get(Routes.user('@me'));
    console.log(`[Sete] Token válido. Bot autenticado como ${botUser.username}#${botUser.discriminator} (${botUser.id}).`);

    if (botUser.id !== clientId) {
      console.warn(
        `[Sete] Aviso: DISCORD_CLIENT_ID (${clientId}) difere do ID do bot (${botUser.id}). Use o Application ID correto.`,
      );
    }

    if (guildId) {
      const guilds = await rest.get(Routes.userGuilds());
      const isInGuild = guilds.some((guild) => guild.id === guildId);

      if (!isInGuild) {
        console.error(`[Sete] 50001 Missing Access — o bot não está no servidor ${guildId}.`);
        console.error('[Sete] Como corrigir:');
        console.error('  1. Convide o bot para o servidor usando este link:');
        console.error(
          `     https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=2147485696&scope=bot%20applications.commands`,
        );
        console.error('  2. Confirme que DISCORD_GUILD_ID é o ID do MESMO servidor');
        console.error('  3. Salve no Render e faça Manual Deploy');
        process.exit(1);
      }

      console.log(`[Sete] Registrando ${body.length} comandos no servidor ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
      console.log('[Sete] Comandos registrados no servidor (instantâneo).');
    } else {
      console.log(`[Sete] Registrando ${body.length} comandos globalmente...`);
      await rest.put(Routes.applicationCommands(clientId), { body });
      console.log('[Sete] Comandos globais registrados (podem levar até 1 hora para aparecer).');
    }
  } catch (error) {
    if (error.status === 401) {
      console.error('[Sete] 401 Unauthorized — o DISCORD_TOKEN está incorreto ou expirou.');
      console.error('[Sete] Como corrigir no Render:');
      console.error('  1. Discord Developer Portal → sua aplicação → Bot → Reset Token');
      console.error('  2. Copie o **Bot Token** (formato XXXX.XXXX.XXXX — NÃO use o OAuth Client Secret)');
      console.error('  3. Render → Environment → DISCORD_TOKEN → cole o token sem aspas');
      console.error('  4. Salve e faça Manual Deploy');
    } else if (error.code === 50001 || error.status === 403) {
      console.error('[Sete] 50001 Missing Access — o bot não tem acesso ao servidor informado.');
      console.error('[Sete] Como corrigir:');
      console.error('  1. Convide o bot para o servidor:');
      console.error(
        `     https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=2147485696&scope=bot%20applications.commands`,
      );
      console.error(`  2. Verifique se DISCORD_GUILD_ID (${guildId || 'não definido'}) é o servidor correto`);
      console.error('  3. No Discord: clique direito no servidor → Copiar ID (modo desenvolvedor ativo)');
    } else {
      console.error('[Sete] Erro ao registrar comandos:', error);
    }
    process.exit(1);
  }
}

deploy();
