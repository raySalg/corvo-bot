const WorldState = require('../models/WorldState');
const House = require('../models/House');
const { DEFAULT_WORLD_STATE, WORLD_STATUS_LABELS } = require('../constants/world');
const {
  WESTEROS_GOVERNANTE_SLUG,
  HOUSE_LEVELS,
  isWesterosGovernante,
  isRegionalGovernante,
  isIndependentVassal,
} = require('../constants/houses');
const { getRegionLabel, REGIONS } = require('../constants/regions');

async function getWorldState() {
  let world = await WorldState.findOne({ key: 'westeros' });
  if (!world) {
    world = await WorldState.create(DEFAULT_WORLD_STATE);
  }
  return world;
}

async function resetWorldState() {
  await WorldState.deleteMany({});
  await WorldState.create(DEFAULT_WORLD_STATE);
}

async function getWesterosGovernante() {
  const world = await getWorldState();
  const house = await House.findOne({ slug: world.governanteWesterosSlug });
  return house ?? (await House.findOne({ slug: WESTEROS_GOVERNANTE_SLUG }));
}

async function getIndependentHouses() {
  return House.find({
    independent: true,
    slug: { $ne: WESTEROS_GOVERNANTE_SLUG },
  }).sort({ level: 1, name: 1 });
}

async function getIndependentGovernantes() {
  return House.find({
    independent: true,
    level: HOUSE_LEVELS.GOVERNANTE,
    slug: { $ne: WESTEROS_GOVERNANTE_SLUG },
  }).sort({ name: 1 });
}

async function setWesterosGovernante(houseSlug) {
  const house = await House.findOne({ slug: houseSlug });
  if (!house) throw new Error('Casa não encontrada.');

  const world = await getWorldState();
  const previous = await House.findOne({ slug: world.governanteWesterosSlug });

  if (previous && previous.slug !== house.slug) {
    if (previous.independent) {
      previous.level = HOUSE_LEVELS.GOVERNANTE;
    } else {
      previous.level = HOUSE_LEVELS.SOBERANO;
    }
    await previous.save();
  }

  house.level = HOUSE_LEVELS.GOVERNANTE;
  house.independent = false;
  await house.save();

  world.governanteWesterosSlug = house.slug;
  await world.save();

  return { world, house };
}

async function setWorldStatus(status, conflictHouseSlugs = []) {
  const world = await getWorldState();
  world.status = status;
  world.conflictHouseSlugs = conflictHouseSlugs;
  await world.save();
  return world;
}

async function setEconomyChannels({ decreeChannelId, allianceChannelId } = {}) {
  const world = await getWorldState();
  if (decreeChannelId !== undefined) world.decreeChannelId = decreeChannelId;
  if (allianceChannelId !== undefined) world.allianceChannelId = allianceChannelId;
  await world.save();
  return world;
}

async function declareRegionIndependent(region, houseSlug) {
  if (region === REGIONS.SEM_TERRAS) {
    throw new Error('Casas sem terras não podem ser declaradas independentes por este comando.');
  }

  const house = await House.findOne({ slug: houseSlug });
  if (!house) throw new Error('Casa não encontrada.');

  if (house.region !== region) {
    throw new Error('A casa selecionada não pertence a esta região.');
  }

  if (isWesterosGovernante(house)) {
    throw new Error('O Governante de Westeros não pode ser declarado independente.');
  }

  const isRegionalDeclaration = [HOUSE_LEVELS.SOBERANO, HOUSE_LEVELS.GOVERNANTE].includes(house.level);

  if (isRegionalDeclaration) {
    const previousRegionalGovernante = await House.findOne({
      region,
      independent: true,
      level: HOUSE_LEVELS.GOVERNANTE,
      slug: { $ne: houseSlug },
    });

    if (previousRegionalGovernante) {
      previousRegionalGovernante.level = HOUSE_LEVELS.SOBERANO;
      previousRegionalGovernante.independent = false;
      await previousRegionalGovernante.save();
    }

    house.level = HOUSE_LEVELS.GOVERNANTE;
    house.independent = true;
    await house.save();

    return { house, scope: 'regional' };
  }

  if (house.independent) {
    throw new Error(`A casa ${house.name} já é independente.`);
  }

  house.independent = true;
  await house.save();

  return { house, scope: 'casa' };
}

async function submitRegion(region) {
  const house = await House.findOne({
    region,
    independent: true,
    level: HOUSE_LEVELS.GOVERNANTE,
  });

  if (!house) {
    throw new Error('Esta região não possui um Governante regional independente.');
  }

  if (isWesterosGovernante(house)) {
    throw new Error('O Governante de Westeros não pode ser submetido como região.');
  }

  house.level = HOUSE_LEVELS.SOBERANO;
  house.independent = false;
  await house.save();

  return house;
}

async function submitIndependentHouse(houseSlug) {
  const house = await House.findOne({ slug: houseSlug });

  if (!house || !isIndependentVassal(house)) {
    throw new Error('Esta casa não está registrada como vassala independente.');
  }

  house.independent = false;
  await house.save();

  return house;
}

async function buildWesterosEmbedData() {
  const world = await getWorldState();
  const governante = await getWesterosGovernante();
  const independentHouses = await getIndependentHouses();

  const conflictHouses = world.conflictHouseSlugs.length
    ? await House.find({ slug: { $in: world.conflictHouseSlugs } })
    : [];

  return {
    world,
    governante,
    independentHouses,
    conflictHouses,
    statusLabel: WORLD_STATUS_LABELS[world.status] ?? world.status,
  };
}

module.exports = {
  getWorldState,
  resetWorldState,
  getWesterosGovernante,
  getIndependentHouses,
  getIndependentGovernantes,
  setWesterosGovernante,
  setWorldStatus,
  setEconomyChannels,
  declareRegionIndependent,
  submitRegion,
  submitIndependentHouse,
  buildWesterosEmbedData,
};
