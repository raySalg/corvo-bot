# Corvo de Três Olhos — Bot de Discord

Bot para publicar **embeds** e espelhar o servidor Discord numa UI web (estilo Discord) no Render.

## Comando

| Comando | Quem pode usar | Descrição |
|---------|----------------|-----------|
| `/embed` | Administrador | Abre formulário para publicar embed (título, corpo, rodapé, emblema e imagem). Opção `cor` em RGB ou hex. |

Exemplos:

```
/embed
/embed cor:#FF0000
/embed cor:255,0,0
```

## Espelho Discord (web)

A URL do serviço (`/`) abre uma tela com canais, histórico e membros. É possível **enviar mensagens** (elas saem como o bot Corvo).

**Aviso de segurança:** não há login. Qualquer pessoa com o link do Render pode ler e enviar mensagens nos canais que o bot alcança.

### Intents obrigatórios (Developer Portal → Bot)

Ative:

- **Message Content Intent** — ler conteúdo das mensagens
- **Server Members Intent** — listar membros à direita

Sem esses intents a UI sobe, mas texto e/ou membros podem ficar vazios.

O bot também precisa de permissões nos canais: **Ver Canal**, **Ler Histórico de Mensagens** e **Enviar Mensagens**.

## Configuração local

### 1. Pré-requisitos

- Node.js 18+
- Conta no [Discord Developer Portal](https://discord.com/developers/applications)

### 2. Variáveis de ambiente

Copie o exemplo e preencha:

```bash
cp .env.example .env
```

| Variável | Descrição |
|----------|-----------|
| `DISCORD_TOKEN` | Token do bot (opcional se já estiver embutido no código) |
| `DISCORD_CLIENT_ID` | Application ID |
| `DISCORD_GUILD_ID` | ID do servidor espelhado / comandos slash |
| `DISCORD_PUBLIC_KEY` | Public Key (Interactions Endpoint) |
| `PORT` | Porta HTTP (Render define automaticamente; localmente usa `3000`) |

> **Segurança:** nunca commite o arquivo `.env`. O espelho web é público — trate a URL como secreta ou adicione autenticação depois.

### 3. Instalar e rodar

```bash
npm install
npm run deploy-commands   # registra o slash command /embed
npm start                 # inicia o bot + UI em http://localhost:3000
```

Para desenvolvimento com reload automático:

```bash
npm run dev
```

### 4. Convidar o bot

```
https://discord.com/api/oauth2/authorize?client_id=1517984369120378980&permissions=2147485696&scope=bot%20applications.commands
```

## Deploy no Render

1. Faça push deste repositório para o GitHub.
2. No [Render](https://render.com), crie um **Web Service**.
3. Conecte o repositório GitHub.
4. Configure as variáveis se necessário.
5. **Build Command:** `npm install`
6. **Start Command:** `npm run deploy-commands && npm start`

Endpoints:

- `/` — espelho Discord (UI)
- `/health` — health check
- `/interactions` — Interactions Endpoint do Discord
- `/api/guild`, `/api/channels/:id/messages`, `/api/members` — API do espelho

### Manter o bot acordado 24h (UptimeRobot)

Monitore `/health` a cada 5 minutos no plano gratuito do Render.

## Estrutura do projeto

```
public/discord-mirror/  # UI estilo Discord
src/
├── commands/embed.js
├── constants/
├── handlers/
├── server/             # keep-alive, interactions, espelho
├── utils/
└── index.js
```
