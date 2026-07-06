const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  WESTEROS_GOVERNANTE_SLUG,
  HOUSE_LEVELS,
  getHouseLevelLabel,
  isRegionalGovernante,
  isIndependentVassal,
} = require('../constants/houses');
const { REGION_ORDER, REGION_LABELS, REGIONS } = require('../constants/regions');
const { randomEmbedColor } = require('./embed');
const { formatHouseLine, buildRegionSection } = require('./houseDisplay');

const CASAS_REGION_PREFIX = 'casas-regiao';

function buildWesterosGovernanteSection(houses) {
  const governante = houses.find(
    (house) =>
      house.slug === WESTEROS_GOVERNANTE_SLUG ||
      (house.level === HOUSE_LEVELS.GOVERNANTE && !house.independent),
  );

  if (!governante) {
    return '## Governante de Westeros\nNenhum Governante definido.';
  }

  return `## Governante de Westeros\n${formatHouseLine(governante)}`;
}

function buildIndependentSection(houses) {
  const regionalGovernantes = houses.filter(isRegionalGovernante);
  const independentVassals = houses.filter(isIndependentVassal);

  if (regionalGovernantes.length === 0 && independentVassals.length === 0) {
    return '## Casas Independentes\nNenhuma casa declarou independência do domínio central.';
  }

  const lines = ['## Casas Independentes'];

  if (regionalGovernantes.length > 0) {
    lines.push('', '**Governantes regionais**');
    lines.push(
      ...regionalGovernantes.map((house) => {
        const region = REGION_LABELS[house.region] ?? house.region;
        return `${formatHouseLine(house)} · Governante de **${region}**`;
      }),
    );
  }

  if (independentVassals.length > 0) {
    lines.push('', '**Casas autônomas**');
    lines.push(
      ...independentVassals.map((house) => {
        const region = REGION_LABELS[house.region] ?? house.region;
        return `${formatHouseLine(house)} · autônoma em **${region}**`;
      }),
    );
  }

  return lines.join('\n');
}

function buildOverviewEmbed(houses) {
  const embed = new EmbedBuilder()
    .setColor(randomEmbedColor())
    .setTitle('Casas de Westeros')
    .setDescription(
      `${buildWesterosGovernanteSection(houses)}\n\n` +
        `${buildIndependentSection(houses)}\n\n` +
        '## Regiões\n' +
        'Selecione uma região para ver suas casas.\n' +
        'Para jurar lealdade, use **/escolher-casa**.\n\n' +
        '**Legenda:** 🟢 Senhor(a) disponível · 🟡 vagas de membro · 🔴 lotada',
    )
    .setTimestamp();

  const rows = [];
  let currentRow = new ActionRowBuilder();
  const buttonRegions = [...REGION_ORDER, REGIONS.SEM_TERRAS];

  for (const region of buttonRegions) {
    const button = new ButtonBuilder()
      .setCustomId(`${CASAS_REGION_PREFIX}:${region}`)
      .setLabel(REGION_LABELS[region])
      .setStyle(ButtonStyle.Secondary);

    currentRow.addComponents(button);

    if (currentRow.components.length === 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
  }

  if (currentRow.components.length > 0) {
    rows.push(currentRow);
  }

  return { embed, rows };
}

function buildRegionEmbed(houses, region) {
  const regionHouses = houses.filter((house) => house.region === region);
  const section = buildRegionSection(regionHouses);

  return new EmbedBuilder()
    .setColor(randomEmbedColor())
    .setTitle(`Casas — ${REGION_LABELS[region]}`)
    .setDescription(
      `## ${REGION_LABELS[region]}\n${section ?? 'Nenhuma casa registrada nesta região.'}\n\n` +
        'Para jurar lealdade, use **/escolher-casa**.',
    )
    .setTimestamp();
}

async function handleCasasRegionButton(interaction) {
  const House = require('../models/House');
  const region = interaction.customId.replace(`${CASAS_REGION_PREFIX}:`, '');
  const houses = await House.find().sort({ name: 1 });
  const embed = buildRegionEmbed(houses, region);

  await interaction.editReply({
    embeds: [embed],
  });
}

module.exports = {
  CASAS_REGION_PREFIX,
  buildOverviewEmbed,
  buildRegionEmbed,
  handleCasasRegionButton,
};
