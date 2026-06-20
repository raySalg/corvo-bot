const REGIONS = {
  NORTE: 'norte',
  OCIDENTE: 'ocidente',
  ILHAS_FERRO: 'ilhas-de-ferro',
  TERRAS_FLUVIAIS: 'terras-fluviais',
  VALE: 'vale',
  TERRAS_COROA: 'terras-da-coroa',
  PEDRA_DRAGAO: 'pedra-do-dragao',
  TERRAS_TEMPESTADE: 'terras-da-tempestade',
  DORNE: 'dorne',
  CAMPINA: 'campina',
};

const REGION_LABELS = {
  [REGIONS.NORTE]: 'Norte',
  [REGIONS.OCIDENTE]: 'Ocidente',
  [REGIONS.ILHAS_FERRO]: 'Ilhas de Ferro',
  [REGIONS.TERRAS_FLUVIAIS]: 'Terras Fluviais',
  [REGIONS.VALE]: 'Vale',
  [REGIONS.TERRAS_COROA]: 'Terras da Coroa',
  [REGIONS.PEDRA_DRAGAO]: 'Pedra do Dragão',
  [REGIONS.TERRAS_TEMPESTADE]: 'Terras da Tempestade',
  [REGIONS.DORNE]: 'Dorne',
  [REGIONS.CAMPINA]: 'Campina',
};

const REGION_EMOJIS = {
  [REGIONS.NORTE]: '❄️',
  [REGIONS.OCIDENTE]: '🦁',
  [REGIONS.ILHAS_FERRO]: '⚓',
  [REGIONS.TERRAS_FLUVIAIS]: '🐟',
  [REGIONS.VALE]: '🦅',
  [REGIONS.TERRAS_COROA]: '👑',
  [REGIONS.PEDRA_DRAGAO]: '🐉',
  [REGIONS.TERRAS_TEMPESTADE]: '⚡',
  [REGIONS.DORNE]: '☀️',
  [REGIONS.CAMPINA]: '🌹',
};

const REGION_ORDER = [
  REGIONS.NORTE,
  REGIONS.OCIDENTE,
  REGIONS.ILHAS_FERRO,
  REGIONS.TERRAS_FLUVIAIS,
  REGIONS.VALE,
  REGIONS.TERRAS_COROA,
  REGIONS.PEDRA_DRAGAO,
  REGIONS.TERRAS_TEMPESTADE,
  REGIONS.DORNE,
  REGIONS.CAMPINA,
];

function getRegionChoices() {
  return REGION_ORDER.map((region) => ({
    name: REGION_LABELS[region],
    value: region,
  }));
}

module.exports = {
  REGIONS,
  REGION_LABELS,
  REGION_EMOJIS,
  REGION_ORDER,
  getRegionChoices,
};
