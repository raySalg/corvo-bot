const { REGIONS } = require('./regions');

const HOUSE_LEVELS = {
  GOVERNANTE: 'governante',
  SOBERANO: 'soberano',
  MENOR: 'menor',
};

const LEGACY_LEVELS = {
  DOMINANTE: 'dominante',
  MAIOR: 'maior',
  DOMINANTE_REGIONAL: 'dominante-regional',
};

const HOUSE_LEVEL_LABELS = {
  [HOUSE_LEVELS.GOVERNANTE]: 'Governante',
  [HOUSE_LEVELS.SOBERANO]: 'Soberano',
  [HOUSE_LEVELS.MENOR]: 'Vassala',
};

const DEFAULT_MAX_MEMBERS = 3;
const WESTEROS_GOVERNANTE_SLUG = 'targaryen-porto-real';

function house(name, slug, level, region, { independent = false } = {}) {
  return {
    name,
    slug,
    level,
    region,
    maxMembers: DEFAULT_MAX_MEMBERS,
    independent,
  };
}

const REGION_SETUP = [
  {
    region: REGIONS.NORTE,
    sovereign: { name: 'Stark', slug: 'stark' },
    vassals: [
      { name: 'Bolton', slug: 'bolton' },
      { name: 'Manderly', slug: 'manderly' },
      { name: 'Umber', slug: 'umber' },
    ],
  },
  {
    region: REGIONS.OCIDENTE,
    sovereign: { name: 'Lannister', slug: 'lannister' },
    vassals: [
      { name: 'Reyne', slug: 'reyne' },
      { name: 'Lefford', slug: 'lefford' },
      { name: 'Westerling', slug: 'westerling' },
    ],
  },
  {
    region: REGIONS.ILHAS_FERRO,
    sovereign: { name: 'Greyjoy', slug: 'greyjoy' },
    vassals: [
      { name: 'Harlaw', slug: 'harlaw' },
      { name: 'Goodbrother', slug: 'goodbrother' },
      { name: 'Blacktyde', slug: 'blacktyde' },
    ],
  },
  {
    region: REGIONS.TERRAS_FLUVIAIS,
    sovereign: { name: 'Tully', slug: 'tully' },
    vassals: [
      { name: 'Blackwood', slug: 'blackwood' },
      { name: 'Bracken', slug: 'bracken' },
      { name: 'Frey', slug: 'frey' },
    ],
  },
  {
    region: REGIONS.VALE,
    sovereign: { name: 'Arryn', slug: 'arryn' },
    vassals: [
      { name: 'Royce', slug: 'royce' },
      { name: 'Waynwood', slug: 'waynwood' },
      { name: 'Corbray', slug: 'corbray' },
    ],
  },
  {
    region: REGIONS.TERRAS_COROA,
    sovereign: { name: 'Targaryen de Porto Real', slug: WESTEROS_GOVERNANTE_SLUG },
    vassals: [
      { name: 'Rosby', slug: 'rosby' },
      { name: 'Darklyn', slug: 'darklyn' },
      { name: 'Heyford', slug: 'heyford' },
    ],
  },
  {
    region: REGIONS.PEDRA_DRAGAO,
    sovereign: { name: 'Targaryen de Pedra do Dragão', slug: 'targaryen-pedra-do-dragao' },
    vassals: [
      { name: 'Velaryon', slug: 'velaryon' },
      { name: 'Celtigar', slug: 'celtigar' },
      { name: 'Bar Emmon', slug: 'bar-emmon' },
    ],
  },
  {
    region: REGIONS.TERRAS_TEMPESTADE,
    sovereign: { name: 'Baratheon', slug: 'baratheon' },
    vassals: [
      { name: 'Dondarrion', slug: 'dondarrion' },
      { name: 'Tarth', slug: 'tarth' },
      { name: 'Swann', slug: 'swann' },
    ],
  },
  {
    region: REGIONS.DORNE,
    sovereign: { name: 'Martell', slug: 'martell' },
    sovereignIndependent: true,
    vassals: [
      { name: 'Dayne', slug: 'dayne' },
      { name: 'Uller', slug: 'uller' },
      { name: 'Yronwood', slug: 'yronwood' },
    ],
  },
  {
    region: REGIONS.CAMPINA,
    sovereign: { name: 'Tyrell', slug: 'tyrell' },
    vassals: [
      { name: 'Hightower', slug: 'hightower' },
      { name: 'Redwyne', slug: 'redwyne' },
      { name: 'Florent', slug: 'florent' },
    ],
  },
];

const DEFAULT_HOUSES = REGION_SETUP.flatMap(({ region, sovereign, vassals, sovereignIndependent = false }) => {
  const isWesterosGovernante = sovereign.slug === WESTEROS_GOVERNANTE_SLUG;
  const sovereignLevel = isWesterosGovernante || sovereignIndependent
    ? HOUSE_LEVELS.GOVERNANTE
    : HOUSE_LEVELS.SOBERANO;

  return [
    house(sovereign.name, sovereign.slug, sovereignLevel, region, {
      independent: sovereignIndependent,
    }),
    ...vassals.map((vassal) => house(vassal.name, vassal.slug, HOUSE_LEVELS.MENOR, region)),
  ];
});

function getHouseLevelLabel(house) {
  if (house.slug === WESTEROS_GOVERNANTE_SLUG) {
    return 'Governante de Westeros';
  }

  if (house.level === HOUSE_LEVELS.GOVERNANTE && house.independent) {
    const { getRegionLabel } = require('./regions');
    return `Governante (${getRegionLabel(house.region)})`;
  }

  return HOUSE_LEVEL_LABELS[house.level] ?? house.level;
}

function isWesterosGovernante(house) {
  return house?.slug === WESTEROS_GOVERNANTE_SLUG;
}

module.exports = {
  HOUSE_LEVELS,
  LEGACY_LEVELS,
  HOUSE_LEVEL_LABELS,
  DEFAULT_MAX_MEMBERS,
  WESTEROS_GOVERNANTE_SLUG,
  DEFAULT_HOUSES,
  getHouseLevelLabel,
  isWesterosGovernante,
};
