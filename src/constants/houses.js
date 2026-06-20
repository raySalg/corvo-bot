const HOUSE_LEVELS = {
  DOMINANTE: 'dominante',
  MAIOR: 'maior',
  MENOR: 'menor',
};

const HOUSE_LEVEL_LABELS = {
  [HOUSE_LEVELS.DOMINANTE]: 'Casa Dominante (Imperador)',
  [HOUSE_LEVELS.MAIOR]: 'Casa Soberana (Rei)',
  [HOUSE_LEVELS.MENOR]: 'Casa Menor (Vassala)',
};

const DEFAULT_MAX_MEMBERS = 3;

const DEFAULT_HOUSES = [
  { name: 'Stark', slug: 'stark', level: HOUSE_LEVELS.MAIOR, maxMembers: DEFAULT_MAX_MEMBERS },
  { name: 'Lannister', slug: 'lannister', level: HOUSE_LEVELS.MAIOR, maxMembers: DEFAULT_MAX_MEMBERS },
  { name: 'Targaryen', slug: 'targaryen', level: HOUSE_LEVELS.MAIOR, maxMembers: DEFAULT_MAX_MEMBERS },
  { name: 'Bolton', slug: 'bolton', level: HOUSE_LEVELS.MENOR, maxMembers: DEFAULT_MAX_MEMBERS },
  { name: 'Baratheon', slug: 'baratheon', level: HOUSE_LEVELS.MAIOR, maxMembers: DEFAULT_MAX_MEMBERS },
  { name: 'Tyrell', slug: 'tyrell', level: HOUSE_LEVELS.MAIOR, maxMembers: DEFAULT_MAX_MEMBERS },
  { name: 'Martell', slug: 'martell', level: HOUSE_LEVELS.MAIOR, maxMembers: DEFAULT_MAX_MEMBERS },
  { name: 'Greyjoy', slug: 'greyjoy', level: HOUSE_LEVELS.MENOR, maxMembers: DEFAULT_MAX_MEMBERS },
  { name: 'Tully', slug: 'tully', level: HOUSE_LEVELS.MENOR, maxMembers: DEFAULT_MAX_MEMBERS },
  { name: 'Arryn', slug: 'arryn', level: HOUSE_LEVELS.MENOR, maxMembers: DEFAULT_MAX_MEMBERS },
];

module.exports = {
  HOUSE_LEVELS,
  HOUSE_LEVEL_LABELS,
  DEFAULT_MAX_MEMBERS,
  DEFAULT_HOUSES,
};
