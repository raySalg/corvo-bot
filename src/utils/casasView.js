const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const House = require('../models/House');
const { DOMINANT_HOUSE_SLUG } = require('../constants/houses');
const { REGION_ORDER, REGION_LABELS, REGION_EMOJIS } = require('../constants/regions');
const { randomEmbedColor } = require('./embed');
const { formatHouseLine, buildRegionSection } = require('./houseDisplay');

const CASAS_REGION_PREFIX = 'casas-regiao';

function buildDominantSection(dominantHouse) {
  if (!dominantHouse) {
    return '## Casa Dominante\nNenhuma Casa Dominante definida.';
  }

  return `## Casa Dominante\n${formatHouseLine(dominantHouse)}\n\n*A Casa Dominante não pode ser escolhida diretamente. Use as regiões abaixo para ver e entrar nas demais casas.*`;
}

function buildOverviewEmbed(houses) {
  const dominantHouse = houses.find((house) => house.slug === DOMINANT_HOUSE_SLUG || house.level === 'dominante');

  const embed = new EmbedBuilder()
    .setColor(randomEmbedColor())
    .setTitle('Casas de Westeros')
    .setDescription(
      `${buildDominantSection(dominantHouse)}\n\n` +
        '## Regiões\n' +
        'Selecione uma região para ver suas casas.\n\n' +
        '**Legenda:** 🟢 Senhor(a) disponível · 🟡 vagas de membro · 🔴 lotada',
    )
    .setTimestamp();

  const rows = [];
  let currentRow = new ActionRowBuilder();

  for (const region of REGION_ORDER) {
    const button = new ButtonBuilder()
      .setCustomId(`${CASAS_REGION_PREFIX}:${region}`)
      .setLabel(REGION_LABELS[region])
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(REGION_EMOJIS[region]);

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
  const section = buildRegionSection(regionHouses, region);

  return new EmbedBuilder()
    .setColor(randomEmbedColor())
    .setTitle(`Casas — ${REGION_LABELS[region]}`)
    .setDescription(`## ${REGION_LABELS[region]}\n${section ?? 'Nenhuma casa registrada nesta região.'}`)
    .setFooter({ text: 'Use /escolher-casa para jurar lealdade.' })
    .setTimestamp();
}

async function handleCasasRegionButton(interaction) {
  const region = interaction.customId.replace(`${CASAS_REGION_PREFIX}:`, '');
  const houses = await House.find().sort({ name: 1 });
  const embed = buildRegionEmbed(houses, region);

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

module.exports = {
  CASAS_REGION_PREFIX,
  buildOverviewEmbed,
  buildRegionEmbed,
  handleCasasRegionButton,
};
