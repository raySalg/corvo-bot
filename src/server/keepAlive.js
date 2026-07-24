const express = require('express');
const { BOT_NAME } = require('../constants/bot');
const { getDiscordStatus } = require('../botState');
const { getDiscordPublicKey, DISCORD_TOKEN } = require('../constants/discord');
const { createInteractionsHttpHandler } = require('./interactionsHttp');
const { mountDiscordMirror } = require('./discordMirror');

const TOKEN_MID = DISCORD_TOKEN.split('.')[1] || '?';
const BUILD_MARK = 'token-mid-v2';

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

  app.get('/health', (_req, res) => {
    const discordStatus = getDiscordStatus();
    const hasPublicKey = Boolean(getDiscordPublicKey());

    let hint = null;
    if (!discordStatus.discordReady) {
      if (discordStatus.startupPhase === 'discord_login_failed' || discordStatus.lastDiscordError?.includes('rejeitado')) {
        hint =
          'Token inválido neste deploy. Faça Manual Deploy no Render, apague a env DISCORD_TOKEN se existir, e confira se /health mostra tokenMid=Gmc_Ya.';
      } else if (!discordStatus.tokenRestOk && discordStatus.startupPhase === 'discord_login_failed') {
        hint =
          'Token embutido rejeitado. Developer Portal → Bot → Reset Token → atualize src/constants/discord.js e redeploy.';
      } else if (discordStatus.tokenRestOk && discordStatus.loginWaitSeconds > 45) {
        hint =
          'Token REST ok, mas Gateway WebSocket travou. Tente Manual Deploy no Render.';
      } else if (discordStatus.loginWaitSeconds > 45) {
        hint = 'Login lento — aguarde ou force Manual Deploy.';
      }
    }

    res.status(200).json({
      status: discordStatus.discordReady ? 'ok' : 'starting',
      bot: BOT_NAME,
      message: discordStatus.discordReady
        ? 'Estou vivo!'
        : `HTTP ok — fase: ${discordStatus.startupPhase}`,
      interactionsEndpoint: hasPublicKey,
      tokenSource: 'embedded',
      tokenMid: TOKEN_MID,
      buildMark: BUILD_MARK,
      hint,
      ...discordStatus,
    });
  });

  if (client) {
    mountDiscordMirror(app, client);
  } else {
    app.get('/', (_req, res) => {
      const { discordReady } = getDiscordStatus();
      res.status(200).send(discordReady ? 'Estou vivo!' : 'HTTP ok — conectando ao Discord...');
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Corvo] Servidor HTTP ativo na porta ${port}.`);
    console.log('[Corvo] Espelho Discord: GET /');
    if (getDiscordPublicKey()) {
      console.log('[Corvo] Endpoint de interações: POST /interactions');
    }
  });
}

module.exports = { startKeepAliveServer };
