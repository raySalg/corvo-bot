const House = require('../models/House');
const { getRegionLabel } = require('../constants/regions');
const { getHouseLevelLabel } = require('../constants/houses');
const { getVacancyIndicator, getVacancyLabel } = require('./houseStatus');

async function autocompleteHouses(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const houses = await House.find({
    name: { $regex: focused, $options: 'i' },
  })
    .limit(25)
    .select('name slug region level independent');

  await interaction.respond(
    houses.map((house) => ({
      name: `${house.name} (${getRegionLabel(house.region)})`,
      value: house.slug,
    })),
  );
}

function formatHouseLine(house) {
  const indicator = getVacancyIndicator(house);
  const vacancies = getVacancyLabel(house);
  const level = getHouseLevelLabel(house);
  return `${indicator} **${house.name}** — ${vacancies} · ${level}`;
}

function formatEconomySummary(house) {
  const cofres = (house.goldDragons ?? 0).toLocaleString('pt-BR');
  const rendimento = (house.annualIncome ?? 0).toLocaleString('pt-BR');
  return `Cofres: ${cofres} D.O. · Rendimento: ${rendimento} D.O./ano`;
}

function buildRegionSection(houses) {
  if (houses.length === 0) return null;

  const ruler = houses.find((house) =>
    ['governante', 'soberano', 'dominante', 'maior', 'dominante-regional'].includes(house.level),
  );
  const vassals = houses.filter((house) => house.level === 'menor');

  const lines = [];

  if (ruler) {
    lines.push(formatHouseLine(ruler));
  }

  if (vassals.length > 0) {
    lines.push('', '**Vassalas**');
    lines.push(...vassals.map((house) => formatHouseLine(house)));
  }

  return lines.join('\n');
}

module.exports = {
  autocompleteHouses,
  formatHouseLine,
  formatEconomySummary,
  buildRegionSection,
};
