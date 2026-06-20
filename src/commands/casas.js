const { SlashCommandBuilder } = require('discord.js');
const House = require('../models/House');
const { HOUSE_LEVELS, HOUSE_LEVEL_LABELS } = require('../constants/houses');

const LEVEL_ORDER = [HOUSE_LEVELS.DOMINANTE, HOUSE_LEVELS.MAIOR, HOUSE_LEVELS.MENOR];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casas')
    .setDescription('Lista as casas de Westeros e seus tesouros.'),

  async execute(interaction) {
    const houses = await House.find().sort({ name: 1 });

    if (houses.length === 0) {
      await interaction.reply({
        content: 'Nenhuma casa foi registrada em Westeros ainda.',
        ephemeral: true,
      });
      return;
    }

    const grouped = LEVEL_ORDER.map((level) => {
      const levelHouses = houses.filter((h) => h.level === level);
      if (levelHouses.length === 0) return null;

      const lines = levelHouses.map((house) => {
        const occupied = house.lordId ? 1 : 0;
        const total = occupied + house.members.length;
        const lordStatus = house.lordId ? 'Lorde ocupado' : 'Lorde disponível';
        return `• **${house.name}** — ${total}/${house.maxMembers} membros (${lordStatus}) — ${house.goldDragons} 🐉`;
      });

      return `**${HOUSE_LEVEL_LABELS[level]}**\n${lines.join('\n')}`;
    }).filter(Boolean);

    await interaction.reply({
      content: ['🏰 **Casas de Westeros**\n', ...grouped].join('\n\n'),
    });
  },
};
