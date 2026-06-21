const { EmbedBuilder } = require('discord.js');
const { buildWesterosEmbedData } = require('../services/worldService');
const { WORLD_STATUS } = require('../constants/world');
const { getHouseLevelLabel } = require('../constants/houses');
const { getRegionLabel } = require('../constants/regions');
const { randomEmbedColor } = require('./embed');

async function buildWesterosEmbed() {
  const { world, governante, independentGovernantes, conflictHouses, statusLabel } =
    await buildWesterosEmbedData();

  const lines = [
    '## Situação de Westeros',
    `**Governante de Westeros:** ${governante ? `**${governante.name}**` : 'Indefinido'}`,
    `**Status:** ${statusLabel}`,
  ];

  if (world.status === WORLD_STATUS.CONFLITO && conflictHouses.length > 0) {
    lines.push('', '**Casas em conflito:**');
    lines.push(...conflictHouses.map((house) => `• **${house.name}**`));
  }

  lines.push('', '## Casas Independentes');

  if (independentGovernantes.length === 0) {
    lines.push('Nenhuma casa governa região de forma independente.');
  } else {
    lines.push(
      ...independentGovernantes.map((house) => {
        const region = getRegionLabel(house.region);
        return `• **${house.name}** — Governante de **${region}** (${getHouseLevelLabel(house)})`;
      }),
    );
  }

  return new EmbedBuilder()
    .setColor(randomEmbedColor())
    .setTitle('Westeros — Status do Mundo')
    .setDescription(lines.join('\n'))
    .setTimestamp();
}

module.exports = { buildWesterosEmbed };
