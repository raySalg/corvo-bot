const express = require('express');
const { BOT_NAME } = require('../constants/bot');
const { getDiscordStatus } = require('../botState');

function startKeepAliveServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.get('/', (_req, res) => {
    const { discordReady } = getDiscordStatus();
    res.status(200).send(discordReady ? 'Estou vivo!' : 'HTTP ok — conectando ao Discord...');
  });

  app.get('/health', (_req, res) => {
    const discordStatus = getDiscordStatus();

    res.status(200).json({
      status: discordStatus.discordReady ? 'ok' : 'starting',
      bot: BOT_NAME,
      message: discordStatus.discordReady ? 'Estou vivo!' : 'HTTP ok — aguardando Discord...',
      ...discordStatus,
    });
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Corvo] Servidor HTTP ativo na porta ${port}.`);
  });
}

module.exports = { startKeepAliveServer };
