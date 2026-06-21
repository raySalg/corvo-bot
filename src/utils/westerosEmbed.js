const { EmbedBuilder } = require('discord.js');
const { buildWesterosEmbedData } = require('../services/worldService');
const { WORLD_STATUS } = require('../constants/world');
const {
  getHouseLevelLabel,
  isRegionalGovernante,
  isIndependentVassal,
} = require('../constants/houses');
const { getRegionLabel } = require('../constants/regions');
const { randomEmbedColor } = require('./embed');

async function buildWesterosEmbed() {
  const { world, governante, independentHouses, conflictHouses, statusLabel } =
    await buildWesterosEmbedData();

  const regionalGovernantes = independentHouses.filter(isRegionalGovernante);
  const independentVassals = independentHouses.filter(isIndependentVassal);

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

  if (regionalGovernantes.length === 0 && independentVassals.length === 0) {
    lines.push('Nenhuma casa declarou independência do domínio central.');
  } else {
    if (regionalGovernantes.length > 0) {
      lines.push('', '**Governantes regionais**');
      lines.push(
        ...regionalGovernantes.map(
          (house) => `• **${house.name}** — ${getHouseLevelLabel(house)}`,
        ),
      );
    }

    if (independentVassals.length > 0) {
      lines.push('', '**Casas autônomas**');
      lines.push(
        ...independentVassals.map(
          (house) => `• **${house.name}** — ${getHouseLevelLabel(house)}`,
        ),
      );
    }
  }

  return new EmbedBuilder()
    .setColor(randomEmbedColor())
    .setTitle('Westeros — Status do Mundo')
    .setDescription(lines.join('\n'))
    .setTimestamp();
}

module.exports = { buildWesterosEmbed };
