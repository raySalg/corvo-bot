const {
  InteractionType,
  InteractionResponseType,
  verifyKey,
} = require('discord-interactions');
const {
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  ButtonInteraction,
  AutocompleteInteraction,
  MessageFlags,
} = require('discord.js');
const { MODAL_COMMANDS, wrapInteractionReply } = require('../utils/interactionReply');
const { getDiscordPublicKey } = require('../constants/discord');
const { routeInteraction } = require('../handlers/interactionRouter');
const { memberIsAdmin, ACCESS_DENIED_MESSAGE } = require('../utils/permissions');
const { CASAS_REGION_PREFIX } = require('../utils/casasView');
const { buildEmbedModal } = require('../commands/admin/embed');
const { buildDecreeModal } = require('../commands/decreto');

const EPHEMERAL_FLAG = MessageFlags.Ephemeral;

function markDeferred(interaction, { ephemeral = false } = {}) {
  interaction.deferred = true;
  interaction.ephemeral = ephemeral;
  interaction.replied = false;
  wrapInteractionReply(interaction);
}

function runInBackground(task) {
  void task().catch((error) => {
    console.error('[Corvo] Erro ao processar interação HTTP em background:', error);
  });
}

function createDeferredInteraction(client, body, { ephemeral = false } = {}) {
  let interaction;

  if (body.type === InteractionType.APPLICATION_COMMAND) {
    interaction = new ChatInputCommandInteraction(client, body);
  } else if (body.type === InteractionType.MODAL_SUBMIT) {
    interaction = new ModalSubmitInteraction(client, body);
  } else if (body.type === InteractionType.MESSAGE_COMPONENT) {
    interaction = new ButtonInteraction(client, body);
  } else {
    return null;
  }

  markDeferred(interaction, { ephemeral });
  return interaction;
}

function createInteractionsHttpHandler({ client, commands }) {
  return async function handleDiscordInteraction(req, res) {
    const publicKey = getDiscordPublicKey();
    if (!publicKey) {
      res.status(503).send('DISCORD_PUBLIC_KEY not configured');
      return;
    }

    const signature = req.get('X-Signature-Ed25519');
    const timestamp = req.get('X-Signature-Timestamp');
    const rawBody = req.body;

    if (!signature || !timestamp || !(await verifyKey(rawBody, signature, timestamp, publicKey))) {
      res.status(401).send('Invalid request signature');
      return;
    }

    const body = JSON.parse(rawBody.toString());
    console.log(`[Corvo] Interação HTTP recebida: type=${body.type} id=${body.id}`);

    if (body.type === InteractionType.PING) {
      res.json({ type: InteractionResponseType.PONG });
      return;
    }

    if (body.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) {
      const command = commands.get(body.data.name);
      if (!command?.autocomplete) {
        res.json({ type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT, data: { choices: [] } });
        return;
      }

      try {
        const interaction = new AutocompleteInteraction(client, body);
        let choices = [];

        interaction.respond = async (options) => {
          choices = options;
        };

        await command.autocomplete(interaction);
        res.json({
          type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
          data: { choices },
        });
      } catch (error) {
        console.error(`[Corvo] Erro no autocomplete HTTP de /${body.data.name}:`, error);
        res.json({ type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT, data: { choices: [] } });
      }
      return;
    }

    if (body.type === InteractionType.APPLICATION_COMMAND) {
      const commandName = body.data.name;

      if (MODAL_COMMANDS.has(commandName)) {
        if (commandName === 'embed' && !memberIsAdmin(body.member)) {
          res.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: ACCESS_DENIED_MESSAGE, flags: EPHEMERAL_FLAG },
          });
          return;
        }

        const modal = commandName === 'embed' ? buildEmbedModal() : buildDecreeModal();
        res.json({
          type: InteractionResponseType.MODAL,
          data: modal.toJSON(),
        });
        return;
      }

      res.json({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
      runInBackground(async () => {
        const interaction = createDeferredInteraction(client, body);
        if (!interaction) return;
        await routeInteraction(interaction, commands, { skipAcknowledge: true });
      });
      return;
    }

    if (body.type === InteractionType.MODAL_SUBMIT) {
      res.json({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: { flags: EPHEMERAL_FLAG },
      });
      runInBackground(async () => {
        const interaction = createDeferredInteraction(client, body, { ephemeral: true });
        if (!interaction) return;
        await routeInteraction(interaction, commands, { skipAcknowledge: true });
      });
      return;
    }

    if (body.type === InteractionType.MESSAGE_COMPONENT && body.data.custom_id?.startsWith(CASAS_REGION_PREFIX)) {
      res.json({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: { flags: EPHEMERAL_FLAG },
      });
      runInBackground(async () => {
        const interaction = createDeferredInteraction(client, body, { ephemeral: true });
        if (!interaction) return;
        await routeInteraction(interaction, commands, { skipAcknowledge: true });
      });
      return;
    }

    console.warn(`[Corvo] Interação HTTP não tratada: type=${body.type}`);
    res.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '### Erro\nEste tipo de interação ainda não é suportado pelo Corvo.',
        flags: EPHEMERAL_FLAG,
      },
    });
  };
}

module.exports = { createInteractionsHttpHandler };
