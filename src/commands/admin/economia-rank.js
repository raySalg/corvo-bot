const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const House = require('../../models/House');
const { requireAdmin } = require('../../utils/permissions');
const { totalIncomeForHouse } = require('../../services/economyService');
const { getRegionLabel } = require('../../constants/regions');
const { randomEmbedColor } = require('../../utils/embed');

const MEDALS = ['🥇', '🥈', '🥉'];

function rankLine(index, name, region, value) {
  const position = MEDALS[index] ?? `**${index + 1}.**`;
  return `${position} **${name}** (${region}) — ${value.toLocaleString('pt-BR')} D.O.`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economia-rank')
    .setDescription('Ranking econômico das casas: cofres e rendimentos (administradores).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('tipo')
        .setDescription('Critério do ranking (padrão: cofres)')
        .setRequired(false)
        .addChoices(
          { name: 'Cofres Totais', value: 'cofres' },
          { name: 'Rendimentos Anuais', value: 'rendimentos' },
        ),
    )
    .addIntegerOption((option) =>
      option
        .setName('limite')
        .setDescription('Quantas casas exibir (padrão: 15)')
        .setMinValue(1)
        .setMaxValue(40)
        .setRequired(false),
    ),

  async execute(interaction) {
    if (!requireAdmin(interaction)) return;

    const tipo = interaction.options.getString('tipo') ?? 'cofres';
    const limit = interaction.options.getInteger('limite') ?? 15;

    const houses = await House.find({});

    const entries = houses.map((house) => ({
      name: house.name,
      region: getRegionLabel(house.region),
      value: tipo === 'rendimentos' ? totalIncomeForHouse(house) : house.goldDragons || 0,
    }));

    entries.sort((a, b) => b.value - a.value);

    const top = entries.slice(0, limit);
    const totalAll = entries.reduce((sum, entry) => sum + entry.value, 0);

    const title = tipo === 'rendimentos' ? 'Ranking de Rendimentos Anuais' : 'Ranking de Cofres Totais';

    const lines = top.map((entry, index) => rankLine(index, entry.name, entry.region, entry.value));

    const embed = new EmbedBuilder()
      .setColor(randomEmbedColor())
      .setTitle(title)
      .setDescription(lines.join('\n') || 'Nenhuma casa registrada.')
      .setFooter({
        text: `Total do reino: ${totalAll.toLocaleString('pt-BR')} D.O. · ${entries.length} casas`,
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
