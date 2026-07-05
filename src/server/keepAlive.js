const express = require('express');

const { BOT_NAME } = require('../constants/bot');

function startKeepAliveServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.get('/', (_req, res) => {
    res.status(200).send('Estou vivo!');
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      bot: BOT_NAME,
      message: 'Estou vivo!',
    });
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Corvo] Servidor HTTP ativo na porta ${port}.`);
  });
}

module.exports = { startKeepAliveServer };
