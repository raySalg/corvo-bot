const House = require('../models/House');
const { REGION_LABELS } = require('../constants/regions');
const { HOUSE_LEVEL_LABELS } = require('../constants/houses');
const { getVacancyIndicator, getVacancyLabel } = require('./houseStatus');

async function autocompleteHouses(interaction, { excludeDominant = false } = {}) {
  const focused = interaction.options.getFocused().toLowerCase();
  const query = {
    name: { $regex: focused, $options: 'i' },
  };

  if (excludeDominant) {
    query.level = { $ne: 'dominante' };
  }

  const houses = await House.find(query).limit(25).select('name slug region level goldDragons');

  await interaction.respond(
    houses.map((house) => ({
      name: `${house.name} (${REGION_LABELS[house.region]})`,
      value: house.slug,
    })),
  );
}

function formatHouseLine(house) {
  const indicator = getVacancyIndicator(house);
  const vacancies = getVacancyLabel(house);
  const level = HOUSE_LEVEL_LABELS[house.level] ?? house.level;
  return `${indicator} **${house.name}** — ${vacancies} · ${level}`;
}

function buildRegionSection(houses, region) {
  if (houses.length === 0) return null;

  const sovereign = houses.find((house) => house.level === 'maior' || house.level === 'dominante');
  const vassals = houses.filter((house) => house.level === 'menor');

  const lines = [];

  if (sovereign) {
    lines.push(formatHouseLine(sovereign));
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
  buildRegionSection,
};
