# Sete — Bot de Discord (Game of Thrones)

Bot de Discord ambientado em **Westeros**. O Sete dá vida ao reino com sistema de **casas**, **lealdades** e **economia** persistidos em MongoDB.

## Comandos

| Comando | Quem pode usar | Descrição |
|---------|----------------|-----------|
| `/escolher-casa` | Todos | Entrar em uma casa como Lorde (se houver vaga) ou Membro |
| `/casas` | Todos | Listar casas, vagas e tesouros |
| `/criar-casa` | Administrador | Criar nova casa com limite de membros e nível |
| `/alterar-nivel-casa` | Administrador | Mudar entre Casa Dominante, Maior ou Menor |
| `/economia-alterar` | Administrador | Adicionar ou remover moedas de ouro de uma casa |
| `/falar` | Administrador | Faz o bot proclamar uma mensagem (teste) |

### Níveis de casa

- **Casa Dominante** — Rei/Imperador de Westeros (apenas uma por servidor)
- **Casa Maior** — Casas soberanas (Stark, Lannister, Targaryen...)
- **Casa Menor** — Casas vassalas (Bolton, Greyjoy, Tully...)

## Configuração local

### 1. Pré-requisitos

- Node.js 18+
- Conta no [Discord Developer Portal](https://discord.com/developers/applications)
- Cluster no [MongoDB Atlas](https://www.mongodb.com/atlas) (plano gratuito)

### 2. Variáveis de ambiente

Copie o exemplo e preencha:

```bash
cp .env.example .env
```

| Variável | Descrição |
|----------|-----------|
| `DISCORD_TOKEN` | Token do bot (Developer Portal → Bot → Reset Token) |
| `DISCORD_CLIENT_ID` | Application ID (`1517984369120378980`) |
| `DISCORD_GUILD_ID` | ID do servidor de testes (comandos aparecem na hora) |
| `MONGODB_URI` | Connection string do MongoDB Atlas |

> **Segurança:** nunca commite o arquivo `.env`. O OAuth Secret e a Public Key ficam no Developer Portal; este bot usa o token do bot via Gateway, não OAuth web.

### 3. MongoDB Atlas

1. Crie uma conta em [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Crie um cluster **M0 Free**.
3. Em **Database Access**, crie um usuário com senha.
4. Em **Network Access**, adicione `0.0.0.0/0` (necessário para o Render).
5. Em **Connect → Drivers**, copie a connection string e substitua `<password>` pela senha do usuário.
6. Cole em `MONGODB_URI` no `.env`.

### 4. Instalar e rodar

```bash
npm install
npm run deploy-commands   # registra os slash commands
npm start                 # inicia o bot
```

Para desenvolvimento com reload automático:

```bash
npm run dev
```

### 5. Convidar o bot

Use este link (substitua permissões se necessário):

```
https://discord.com/api/oauth2/authorize?client_id=1517984369120378980&permissions=2147485696&scope=bot%20applications.commands
```

## Deploy no Render

1. Faça push deste repositório para o GitHub (`ray.salg/sete-bot`).
2. No [Render](https://render.com), crie um **Background Worker**.
3. Conecte o repositório GitHub.
4. Configure as variáveis de ambiente:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `MONGODB_URI`
5. **Build Command:** `npm install && npm run deploy-commands`
6. **Start Command:** `npm start`

O arquivo `render.yaml` já descreve essa configuração para deploy via Blueprint.

## Estrutura do projeto

```
src/
├── commands/          # Slash commands
│   ├── admin/         # Comandos restritos a administradores
│   ├── casas.js
│   ├── escolher-casa.js
│   └── falar.js
├── config/database.js # Conexão e seed das casas padrão
├── constants/houses.js
├── handlers/
├── models/House.js    # Schema MongoDB
└── index.js
```

## Casas iniciais

Na primeira execução, o bot cria automaticamente (com tesouro zerado):

Stark, Lannister, Targaryen, Bolton, Baratheon, Tyrell, Martell, Greyjoy, Tully e Arryn.

## Próximos passos sugeridos

- Comando `/economia-ver` por casa
- Histórico de transações econômicas
- Comando para abandonar casa
- Roles do Discord vinculados à casa escolhida

---

*O Inverno Está Chegando.*
