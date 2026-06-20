const { REGIONS } = require('./regions');

const HOUSE_LEVELS = {
  DOMINANTE: 'dominante',
  MAIOR: 'maior',
  MENOR: 'menor',
};

const HOUSE_LEVEL_LABELS = {
  [HOUSE_LEVELS.DOMINANTE]: 'Casa Dominante (Imperador)',
  [HOUSE_LEVELS.MAIOR]: 'Casa Soberana (Rei)',
  [HOUSE_LEVELS.MENOR]: 'Casa Vassala',
};

const DEFAULT_MAX_MEMBERS = 3;

const DOMINANT_HOUSE_SLUG = 'targaryen-porto-real';

function house(name, slug, level, region) {
  return { name, slug, level, region, maxMembers: DEFAULT_MAX_MEMBERS };
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
    sovereign: { name: 'Targaryen de Porto Real', slug: DOMINANT_HOUSE_SLUG },
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

const DEFAULT_HOUSES = REGION_SETUP.flatMap(({ region, sovereign, vassals }) => {
  const level = sovereign.slug === DOMINANT_HOUSE_SLUG ? HOUSE_LEVELS.DOMINANTE : HOUSE_LEVELS.MAIOR;

  return [
    house(sovereign.name, sovereign.slug, level, region),
    ...vassals.map((vassal) => house(vassal.name, vassal.slug, HOUSE_LEVELS.MENOR, region)),
  ];
});

module.exports = {
  HOUSE_LEVELS,
  HOUSE_LEVEL_LABELS,
  DEFAULT_MAX_MEMBERS,
  DOMINANT_HOUSE_SLUG,
  DEFAULT_HOUSES,
};
