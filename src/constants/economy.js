const { HOUSE_LEVELS } = require('./houses');

const DEFAULT_REGIONAL_TAX_RATE = 0.15;
const DEFAULT_CROWN_TAX_RATE = 0.3;

function defaultTaxRateForLevel(level, { isCrown = false } = {}) {
  if (isCrown) return DEFAULT_CROWN_TAX_RATE;
  if (level === HOUSE_LEVELS.SOBERANO || level === HOUSE_LEVELS.GOVERNANTE) {
    return DEFAULT_REGIONAL_TAX_RATE;
  }
  return 0;
}

const MAINTENANCE_INTERVAL_YEARS = 2;
const MAINTENANCE_COST_RATE = 0.5;
const IMPAIRMENT_FACTOR = 0.4;

const STRUCTURE_CATALOG = {
  'fazenda-pecuaria': { label: 'Fazenda Pecuária', sector: 'primario', cost: 200, annualIncome: 70 },
  'fazenda-agricola': { label: 'Fazenda Agrícola', sector: 'primario', cost: 325, annualIncome: 115 },
  vinhedo: { label: 'Vinhedo', sector: 'primario', cost: 325, annualIncome: 115 },
  apicultura: { label: 'Apicultura', sector: 'primario', cost: 260, annualIncome: 90 },
  estabulo: { label: 'Estábulo', sector: 'primario', cost: 245, annualIncome: 85 },
  serraria: { label: 'Serraria', sector: 'primario', cost: 65, annualIncome: 25 },
  pedreira: { label: 'Pedreira', sector: 'primario', cost: 65, annualIncome: 25 },
  pomar: { label: 'Pomar', sector: 'primario', cost: 285, annualIncome: 100 },
  olival: { label: 'Olival', sector: 'primario', cost: 325, annualIncome: 115 },
  salinas: { label: 'Salinas', sector: 'primario', cost: 455, annualIncome: 160 },
  'mina-ferro': { label: 'Mina de Ferro', sector: 'primario', cost: 520, annualIncome: 180 },
  'mina-cobre': { label: 'Mina de Cobre', sector: 'primario', cost: 455, annualIncome: 160 },
  'mina-prata': { label: 'Mina de Prata', sector: 'primario', cost: 910, annualIncome: 320 },
  'mina-ouro': { label: 'Mina de Ouro', sector: 'primario', cost: 1300, annualIncome: 455 },

  tecelagem: { label: 'Tecelagem', sector: 'secundario', cost: 170, annualIncome: 60 },
  couraria: { label: 'Couraria', sector: 'secundario', cost: 65, annualIncome: 25 },
  cervejaria: { label: 'Cervejaria', sector: 'secundario', cost: 195, annualIncome: 70 },
  joalheria: { label: 'Joalheria', sector: 'secundario', cost: 520, annualIncome: 180 },
  ferraria: { label: 'Ferraria', sector: 'secundario', cost: 325, annualIncome: 115 },
  fundicao: { label: 'Fundição', sector: 'secundario', cost: 650, annualIncome: 230 },
  carpintaria: { label: 'Carpintaria', sector: 'secundario', cost: 235, annualIncome: 80 },
  marmoraria: { label: 'Marmoraria', sector: 'secundario', cost: 455, annualIncome: 160 },
};

function getStructure(type) {
  return STRUCTURE_CATALOG[type] ?? null;
}

function getStructureChoices() {
  return Object.entries(STRUCTURE_CATALOG).map(([value, data]) => ({
    name: `${data.label} — ${data.cost.toLocaleString('pt-BR')} D.O. (+${data.annualIncome}/ano)`.slice(0, 100),
    value,
  }));
}

const HOUSE_ECONOMY_SEED = {
  stark: { vault: 92000, annualIncome: 10500 },
  bolton: { vault: 52000, annualIncome: 5500 },
  manderly: { vault: 83000, annualIncome: 8040 },
  umber: { vault: 48000, annualIncome: 4320 },

  arryn: { vault: 98000, annualIncome: 11760 },
  royce: { vault: 72000, annualIncome: 7920 },
  grafton: { vault: 86000, annualIncome: 11180 },
  corbray: { vault: 58000, annualIncome: 5510 },

  greyjoy: { vault: 48000, annualIncome: 4320 },
  harlaw: { vault: 39000, annualIncome: 3760 },
  goodbrother: { vault: 32000, annualIncome: 2300 },
  blacktyde: { vault: 30000, annualIncome: 2500 },

  tully: { vault: 89000, annualIncome: 9000 },
  bracken: { vault: 68000, annualIncome: 5160 },
  frey: { vault: 82000, annualIncome: 10660 },
  blackwood: { vault: 61000, annualIncome: 6100 },

  lannister: { vault: 120000, annualIncome: 16200 },
  reyne: { vault: 90000, annualIncome: 12100 },
  lefford: { vault: 88000, annualIncome: 10560 },
  westerling: { vault: 72000, annualIncome: 8615 },

  tyrell: { vault: 115000, annualIncome: 15340 },
  hightower: { vault: 118000, annualIncome: 15525 },
  redwyne: { vault: 104000, annualIncome: 13520 },
  florent: { vault: 60000, annualIncome: 5810 },

  'targaryen-pedra-do-dragao': { vault: 95000, annualIncome: 7210 },
  velaryon: { vault: 51000, annualIncome: 8210 },
  'bar-emmon': { vault: 40000, annualIncome: 4210 },
  celtigar: { vault: 79000, annualIncome: 9480 },

  'targaryen-porto-real': { vault: 140000, annualIncome: 17410 },
  rosby: { vault: 56000, annualIncome: 5600 },
  darklyn: { vault: 58000, annualIncome: 6090 },
  stokeworth: { vault: 44000, annualIncome: 3960 },

  baratheon: { vault: 96000, annualIncome: 11520 },
  swann: { vault: 60000, annualIncome: 6160 },
  tarth: { vault: 42000, annualIncome: 5040 },
  dondarrion: { vault: 60000, annualIncome: 6160 },

  martell: { vault: 102000, annualIncome: 12240 },
  yronwood: { vault: 82000, annualIncome: 9840 },
  dayne: { vault: 76000, annualIncome: 8760 },
  uller: { vault: 51000, annualIncome: 4590 },
};

module.exports = {
  DEFAULT_REGIONAL_TAX_RATE,
  DEFAULT_CROWN_TAX_RATE,
  HOUSE_ECONOMY_SEED,
  defaultTaxRateForLevel,
  STRUCTURE_CATALOG,
  MAINTENANCE_INTERVAL_YEARS,
  MAINTENANCE_COST_RATE,
  IMPAIRMENT_FACTOR,
  getStructure,
  getStructureChoices,
};
