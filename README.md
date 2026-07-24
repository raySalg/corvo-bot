# Corvo de Três Olhos — Bot de Discord

Bot enxuto para publicar mensagens customizadas em **embed**.

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
| `DISCORD_TOKEN` | Token do bot (Developer Portal → Bot → Reset Token) |
| `DISCORD_CLIENT_ID` | Application ID |
| `DISCORD_GUILD_ID` | ID do servidor — comandos aparecem na hora |
| `DISCORD_PUBLIC_KEY` | Public Key (Interactions Endpoint) |
| `PORT` | Porta HTTP (Render define automaticamente; localmente usa `3000`) |

> **Segurança:** nunca commite o arquivo `.env`.

### 3. Instalar e rodar

```bash
npm install
npm run deploy-commands   # registra o slash command /embed
npm start                 # inicia o bot
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
4. Configure as variáveis de ambiente (`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`).
5. **Build Command:** `npm install`
6. **Start Command:** `npm run deploy-commands && npm start`

O bot sobe um servidor HTTP mínimo (Express) em `/` e `/health`. O arquivo `render.yaml` descreve o deploy via Blueprint.

### Manter o bot acordado 24h (UptimeRobot)

No plano gratuito, o Render pode suspender serviços web após ~15 minutos sem tráfego HTTP. Para evitar isso, monitore `/health` a cada 5 minutos.

## Estrutura do projeto

```
src/
├── commands/embed.js      # Único slash command
├── constants/             # Bot e Discord
├── handlers/              # Loader e roteador de interações
├── server/                # Keep-alive + endpoint /interactions
├── utils/                 # Embed, permissões, publicação
└── index.js
```
