const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const House = require('../models/House');
const { submitDecree } = require('../services/economyService');

const DECREE_MODAL_ID = 'decreto:submit';

function buildDecreeModal(house) {
  const contentInput = new TextInputBuilder()
    .setCustomId('conteudo')
    .setLabel('Conteúdo do decreto')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(4000)
    .setPlaceholder('Descreva as diretrizes, investimentos e medidas da sua casa...');

  const spentInput = new TextInputBuilder()
    .setCustomId('total')
    .setLabel('Total gasto no decreto (D.O.)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(12)
    .setPlaceholder('Ex: 1460');

  return new ModalBuilder()
    .setCustomId(DECREE_MODAL_ID)
    .setTitle(`Decreto — Casa ${house.name}`.slice(0, 45))
    .addComponents(
      new ActionRowBuilder().addComponents(contentInput),
      new ActionRowBuilder().addComponents(spentInput),
    );
}

module.exports = {
  DECREE_MODAL_ID,

  data: new SlashCommandBuilder()
    .setName('decreto')
    .setDescription('Envia o Decreto Econômico da sua casa (apenas o Senhor da casa).'),

  async execute(interaction) {
    const house = await House.findOne({ lordId: interaction.user.id });

    if (!house) {
      await interaction.reply({
        content:
          '### Apenas o Senhor da casa\n' +
          'Somente **um jogador por casa** pode enviar o Decreto Econômico: o **Senhor(a)** da casa.\n' +
          'Você não consta como Senhor de nenhuma casa.',
        ephemeral: true,
      });
      return;
    }

    await interaction.showModal(buildDecreeModal(house));
  },

  async handleModalSubmit(interaction) {
    if (interaction.customId !== DECREE_MODAL_ID) return;

    await interaction.deferReply({ ephemeral: true });

    const house = await House.findOne({ lordId: interaction.user.id });
    if (!house) {
      await interaction.editReply({
        content: '### Decreto não registrado\nVocê não é mais o Senhor de nenhuma casa.',
      });
      return;
    }

    const content = interaction.fields.getTextInputValue('conteudo');
    const rawTotal = interaction.fields.getTextInputValue('total').replace(/[.\s,]/g, '');
    const totalSpent = Number.parseInt(rawTotal, 10);

    if (Number.isNaN(totalSpent)) {
      await interaction.editReply({
        content: '### Valor inválido\nO total gasto deve ser um número (ex: 1460).',
      });
      return;
    }

    let result;
    try {
      result = await submitDecree(house, {
        authorId: interaction.user.id,
        content,
        totalSpent,
      });
    } catch (error) {
      await interaction.editReply({
        content: `### Decreto recusado\n${error.message}`,
      });
      return;
    }

    const note = result.replaced
      ? 'O decreto anterior da casa foi substituído por este.'
      : 'Seu decreto foi registrado.';

    await interaction.editReply({
      content:
        '### Decreto registrado\n' +
        `${note}\n` +
        `**Total gasto:** ${totalSpent.toLocaleString('pt-BR')} D.O.\n\n` +
        'Ele será proclamado no canal de decretos quando um administrador executar o ciclo econômico.',
    });
  },
};
