const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const House = require('../models/House');
const { HOUSE_LEVELS, HOUSE_LEVEL_LABELS } = require('../constants/houses');
const { randomEmbedColor } = require('../utils/embed');

const LEVEL_ORDER = [HOUSE_LEVELS.DOMINANTE, HOUSE_LEVELS.MAIOR, HOUSE_LEVELS.MENOR];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casas')
    .setDescription('Lista as casas de Westeros e seus tesouros.'),

  async execute(interaction) {
    const houses = await House.find().sort({ name: 1 });

    if (houses.length === 0) {
      await interaction.reply({
        content: '### Nenhuma casa registrada\nAinda não há casas em Westeros.',
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(randomEmbedColor())
      .setTitle('Casas de Westeros')
      .setDescription('### Registro das Casas\nVagas, liderança e tesouro de cada Casa do reino.')
      .setTimestamp();

    for (const level of LEVEL_ORDER) {
      const levelHouses = houses.filter((house) => house.level === level);
      if (levelHouses.length === 0) continue;

      const lines = levelHouses.map((house) => {
        const occupied = house.lordId ? 1 : 0;
        const total = occupied + house.members.length;
        const leadership = house.lordId ? 'Lorde/Lady ocupado' : 'Lorde/Lady disponível';
        return (
          `**${house.name}**\n` +
          `Membros: **${total}/${house.maxMembers}** · ${leadership}\n` +
          `Tesouro: **${house.goldDragons}** moedas de ouro`
        );
      });

      embed.addFields({
        name: HOUSE_LEVEL_LABELS[level],
        value: lines.join('\n\n'),
      });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
