const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const House = require('../models/House');
const {
  getSuzerain,
  getAlliancesForHouse,
  allianceOther,
  structureIncomeForHouse,
  totalIncomeForHouse,
} = require('../services/economyService');
const { autocompleteHouses } = require('../utils/houseDisplay');
const { getRegionLabel } = require('../constants/regions');
const { getHouseLevelLabel } = require('../constants/houses');
const { getStructure } = require('../constants/economy');
const { randomEmbedColor } = require('../utils/embed');

function summarizeStructures(house) {
  if (!house.structures || house.structures.length === 0) return 'Nenhuma';

  const counts = new Map();
  let impaired = 0;
  for (const built of house.structures) {
    const data = getStructure(built.type);
    const label = data ? data.label : built.type;
    counts.set(label, (counts.get(label) ?? 0) + 1);
    if (built.impaired) impaired += 1;
  }

  const parts = [...counts.entries()].map(([label, qty]) => `${label} x${qty}`);
  const text = parts.join(', ');
  return impaired > 0 ? `${text}\n_(${impaired} sucateada(s) por falta de manutenção)_` : text;
}

function formatGold(value) {
  return `${(value ?? 0).toLocaleString('pt-BR')} D.O.`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economia')
    .setDescription('Exibe a ficha econômica de uma casa.')
    .addStringOption((option) =>
      option
        .setName('casa')
        .setDescription('Casa a consultar (padrão: a sua, se for membro)')
        .setRequired(false)
        .setAutocomplete(true),
    ),

  autocomplete: autocompleteHouses,

  async execute(interaction) {
    const slug = interaction.options.getString('casa');

    let house;
    if (slug) {
      house = await House.findOne({ slug });
    } else {
      const userId = interaction.user.id;
      house = await House.findOne({ $or: [{ lordId: userId }, { members: userId }] });
    }

    if (!house) {
      await interaction.reply({
        content: slug
          ? '### Casa não encontrada\nNenhuma casa corresponde a essa busca.'
          : '### Casa não encontrada\nInforme uma casa ou junte-se a uma para ver sua economia.',
        ephemeral: true,
      });
      return;
    }

    const suzerain = await getSuzerain(house);
    const alliances = await getAlliancesForHouse(house.slug, { status: 'active' });

    let alliesText = 'Nenhuma';
    if (alliances.length > 0) {
      const slugs = alliances.map((alliance) => allianceOther(alliance, house.slug));
      const allies = await House.find({ slug: { $in: slugs } }).select('name');
      alliesText = allies.map((ally) => ally.name).join(', ') || 'Nenhuma';
    }

    const taxPercent = Math.round((house.taxRate ?? 0) * 100);
    const structureIncome = structureIncomeForHouse(house);
    const totalIncome = totalIncomeForHouse(house);

    const embed = new EmbedBuilder()
      .setColor(randomEmbedColor())
      .setTitle(`Economia — Casa ${house.name}`)
      .setDescription(`${getHouseLevelLabel(house)} · ${getRegionLabel(house.region)}`)
      .addFields(
        { name: 'Cofres Totais', value: formatGold(house.goldDragons), inline: true },
        { name: 'Rendimento total/ano', value: formatGold(totalIncome), inline: true },
        { name: 'Taxa de imposto', value: `${taxPercent}%`, inline: true },
        { name: 'Rendimento base', value: formatGold(house.annualIncome), inline: true },
        { name: 'Rendimento de estruturas', value: formatGold(structureIncome), inline: true },
        { name: 'Suserano', value: suzerain ? suzerain.name : 'Independente / Coroa', inline: true },
        { name: 'Estruturas', value: summarizeStructures(house), inline: false },
        { name: 'Aliadas', value: alliesText, inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
