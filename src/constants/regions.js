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
  SEM_TERRAS: 'sem-terras',
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
  [REGIONS.SEM_TERRAS]: 'Casa sem Terras',
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

function getRegionLabel(region) {
  return REGION_LABELS[region] ?? region;
}

function getRegionChoices({ includeSemTerras = true } = {}) {
  const choices = REGION_ORDER.map((region) => ({
    name: REGION_LABELS[region],
    value: region,
  }));

  if (includeSemTerras) {
    choices.push({
      name: REGION_LABELS[REGIONS.SEM_TERRAS],
      value: REGIONS.SEM_TERRAS,
    });
  }

  return choices;
}

function getPlayableRegionChoices() {
  return getRegionChoices({ includeSemTerras: false });
}

module.exports = {
  REGIONS,
  REGION_LABELS,
  REGION_ORDER,
  getRegionLabel,
  getRegionChoices,
  getPlayableRegionChoices,
};
