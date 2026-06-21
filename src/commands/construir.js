const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const House = require('../models/House');
const { buildStructure, totalIncomeForHouse } = require('../services/economyService');
const { getStructureChoices } = require('../constants/economy');
const { randomEmbedColor } = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('construir')
    .setDescription('Ergue estruturas para a sua casa (apenas o Senhor da casa).')
    .addStringOption((option) =>
      option
        .setName('estrutura')
        .setDescription('Estrutura a construir')
        .setRequired(true)
        .addChoices(...getStructureChoices()),
    )
    .addIntegerOption((option) =>
      option
        .setName('quantidade')
        .setDescription('Quantas unidades construir (padrão: 1)')
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false),
    ),

  async execute(interaction) {
    const house = await House.findOne({ lordId: interaction.user.id });

    if (!house) {
      await interaction.reply({
        content:
          '### Apenas o Senhor da casa\nSomente o **Senhor(a)** da casa pode erguer estruturas.',
        ephemeral: true,
      });
      return;
    }

    const type = interaction.options.getString('estrutura');
    const quantity = interaction.options.getInteger('quantidade') ?? 1;

    let result;
    try {
      result = await buildStructure(house, type, quantity);
    } catch (error) {
      await interaction.reply({
        content: `### Construção não realizada\n${error.message}`,
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(randomEmbedColor())
      .setTitle('Estrutura erguida')
      .setDescription(`A casa **${house.name}** investiu em novas construções.`)
      .addFields(
        { name: 'Estrutura', value: `${result.data.label} x${result.quantity}`, inline: true },
        { name: 'Custo total', value: `${result.totalCost.toLocaleString('pt-BR')} D.O.`, inline: true },
        { name: 'Rendimento adicional', value: `+${result.addedIncome.toLocaleString('pt-BR')} D.O./ano`, inline: true },
        { name: 'Cofres atuais', value: `${house.goldDragons.toLocaleString('pt-BR')} D.O.`, inline: true },
        { name: 'Rendimento total/ano', value: `${totalIncomeForHouse(house).toLocaleString('pt-BR')} D.O.`, inline: true },
      )
      .setFooter({ text: 'Manutenção de 50% do custo é devida a cada 2 anos.' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
