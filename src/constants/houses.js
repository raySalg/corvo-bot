const mongoose = require('mongoose');

const HOUSE_LEVELS = {
  DOMINANTE: 'dominante',
  MAIOR: 'maior',
  MENOR: 'menor',
};

const HOUSE_LEVEL_LABELS = {
  [HOUSE_LEVELS.DOMINANTE]: 'Casa Dominante (Rei/Imperador)',
  [HOUSE_LEVELS.MAIOR]: 'Casa Maior (Soberana)',
  [HOUSE_LEVELS.MENOR]: 'Casa Menor (Vassala)',
};

const DEFAULT_HOUSES = [
  { name: 'Stark', slug: 'stark', level: HOUSE_LEVELS.MAIOR, maxMembers: 50 },
  { name: 'Lannister', slug: 'lannister', level: HOUSE_LEVELS.MAIOR, maxMembers: 50 },
  { name: 'Targaryen', slug: 'targaryen', level: HOUSE_LEVELS.MAIOR, maxMembers: 50 },
  { name: 'Bolton', slug: 'bolton', level: HOUSE_LEVELS.MENOR, maxMembers: 30 },
  { name: 'Baratheon', slug: 'baratheon', level: HOUSE_LEVELS.MAIOR, maxMembers: 50 },
  { name: 'Tyrell', slug: 'tyrell', level: HOUSE_LEVELS.MAIOR, maxMembers: 50 },
  { name: 'Martell', slug: 'martell', level: HOUSE_LEVELS.MAIOR, maxMembers: 50 },
  { name: 'Greyjoy', slug: 'greyjoy', level: HOUSE_LEVELS.MENOR, maxMembers: 30 },
  { name: 'Tully', slug: 'tully', level: HOUSE_LEVELS.MENOR, maxMembers: 30 },
  { name: 'Arryn', slug: 'arryn', level: HOUSE_LEVELS.MENOR, maxMembers: 30 },
];

module.exports = {
  HOUSE_LEVELS,
  HOUSE_LEVEL_LABELS,
  DEFAULT_HOUSES,
};
