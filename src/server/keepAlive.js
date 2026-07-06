const express = require('express');
const { BOT_NAME } = require('../constants/bot');
const { getDiscordStatus } = require('../botState');
const { createInteractionsHttpHandler } = require('./interactionsHttp');

function startKeepAliveServer({ client, commands } = {}) {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  if (client && commands) {
    const interactionsHandler = createInteractionsHttpHandler({ client, commands });
    const rawJson = express.raw({ type: 'application/json' });

    app.post('/interactions', rawJson, interactionsHandler);
    app.post('/', rawJson, (req, res, next) => {
      if (!req.get('X-Signature-Ed25519')) {
        next();
        return;
      }

      return interactionsHandler(req, res);
    });
  }

  app.get('/', (_req, res) => {
    const { discordReady } = getDiscordStatus();
    res.status(200).send(discordReady ? 'Estou vivo!' : 'HTTP ok — conectando ao Discord...');
  });

  app.get('/health', (_req, res) => {
    const discordStatus = getDiscordStatus();

    res.status(200).json({
      status: discordStatus.discordReady ? 'ok' : 'starting',
      bot: BOT_NAME,
      message: discordStatus.discordReady
        ? 'Estou vivo!'
        : `HTTP ok — fase: ${discordStatus.startupPhase}`,
      interactionsEndpoint: Boolean(process.env.DISCORD_PUBLIC_KEY?.trim()),
      ...discordStatus,
    });
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Corvo] Servidor HTTP ativo na porta ${port}.`);
    if (process.env.DISCORD_PUBLIC_KEY?.trim()) {
      console.log('[Corvo] Endpoint de interações: POST /interactions');
    } else {
      console.warn(
        '[Corvo] DISCORD_PUBLIC_KEY não definida — configure no Render se o Developer Portal tiver Interactions Endpoint URL.',
      );
    }
  });
}

module.exports = { startKeepAliveServer };
