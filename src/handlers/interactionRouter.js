const { sendEphemeral, acknowledgeInteraction } = require('../utils/interactionReply');

async function routeInteraction(interaction, commands, { skipAcknowledge = false } = {}) {
  if (interaction.isButton()) {
    const commandName = interaction.customId.split(':')[0];
    const command = commands.get(commandName);

    if (!command?.handleButton) {
      console.error(`Botão sem handler registrado: ${interaction.customId}`);
      await sendEphemeral(
        interaction,
        '### Erro\nEste botão não está mais disponível.',
      );
      return;
    }

    try {
      if (!skipAcknowledge) await acknowledgeInteraction(interaction);
      await command.handleButton(interaction);

      if (!interaction.replied && !interaction.deferred) {
        console.error(`Botão de /${commandName} concluiu sem resposta: ${interaction.customId}`);
        await sendEphemeral(
          interaction,
          '### Erro\nNão foi possível processar este botão. Tente novamente.',
        );
      }
    } catch (error) {
      console.error(`Erro ao processar botão de /${commandName}:`, error);
      await sendEphemeral(
        interaction,
        '### Erro\nNão foi possível processar este botão. Tente novamente.',
      );
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    const modalCommandName = interaction.customId.split(':')[0];
    const command = commands.get(modalCommandName);

    if (!command?.handleModalSubmit) {
      console.error(`Modal sem handler registrado: ${interaction.customId}`);
      await sendEphemeral(
        interaction,
        '### Erro\nEste formulário não está mais disponível. Execute o comando novamente.',
      );
      return;
    }

    try {
      if (!skipAcknowledge) await acknowledgeInteraction(interaction);
      await command.handleModalSubmit(interaction);

      if (!interaction.replied && !interaction.deferred) {
        console.error(`Modal de /${modalCommandName} concluiu sem resposta: ${interaction.customId}`);
        await sendEphemeral(
          interaction,
          '### Erro\nNão foi possível processar o formulário. Tente novamente.',
        );
      }
    } catch (error) {
      console.error(`Erro ao processar modal de /${modalCommandName}:`, error);
      await sendEphemeral(
        interaction,
        '### Erro\nNão foi possível processar o formulário. Tente novamente.',
      );
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    console.error(
      `[Corvo] Comando /${interaction.commandName} não encontrado (app ${interaction.applicationId}, guild ${interaction.guildId}).`,
    );
    await sendEphemeral(
      interaction,
      '### Comando indisponível\nEste comando não está registrado neste servidor. Peça a um admin para redeployar o bot.',
    );
    return;
  }

  try {
    if (!skipAcknowledge) await acknowledgeInteraction(interaction);
    await command.execute(interaction);
  } catch (error) {
    console.error(`Erro ao executar /${interaction.commandName}:`, error);
    await sendEphemeral(
      interaction,
      '### Erro\nOcorreu um erro ao executar este comando. Tente novamente.',
    );
  }
}

module.exports = { routeInteraction };
