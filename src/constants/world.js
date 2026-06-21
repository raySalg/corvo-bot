const WORLD_STATUS = {
  ESTAVEL: 'estavel',
  CONFLITO: 'conflito',
};

const WORLD_STATUS_LABELS = {
  [WORLD_STATUS.ESTAVEL]: 'Estável',
  [WORLD_STATUS.CONFLITO]: 'Conflito entre as Casas',
};

const DEFAULT_WORLD_STATE = {
  key: 'westeros',
  governanteWesterosSlug: 'targaryen-porto-real',
  status: WORLD_STATUS.ESTAVEL,
  conflictHouseSlugs: [],
};

module.exports = {
  WORLD_STATUS,
  WORLD_STATUS_LABELS,
  DEFAULT_WORLD_STATE,
};
