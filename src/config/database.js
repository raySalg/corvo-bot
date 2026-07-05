const mongoose = require('mongoose');
const { DEFAULT_HOUSES } = require('../constants/houses');
const { validateMongoEnv } = require('../utils/mongoEnv');

const OBSOLETE_SLUGS = ['targaryen', 'waynwood', 'heyford'];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function removeHouseConflicts(House, house) {
  const result = await House.deleteMany({
    slug: { $ne: house.slug },
    name: new RegExp(`^${escapeRegExp(house.name)}$`, 'i'),
  });

  if (result.deletedCount > 0) {
    console.log(
      `[Corvo] Migração: removida(s) ${result.deletedCount} casa(s) conflitante(s) com o nome "${house.name}".`,
    );
  }
}

async function connectDatabase() {
  const { uri, errors, maskedUri } = validateMongoEnv();

  if (errors.length > 0) {
    console.error('[Corvo] MongoDB mal configurado:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    console.error('[Corvo] Exemplo válido no Render (Environment → MONGODB_URI):');
    console.error('  mongodb+srv://usuario:senha@cluster0.xxxxx.mongodb.net/sete?retryWrites=true&w=majority');
    throw new Error(errors.join(' '));
  }

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[Corvo] Conectado ao MongoDB (${maskedUri}).`);
  } catch (error) {
    console.error(`[Corvo] Falha na conexão com MongoDB (${maskedUri}).`);

    if (error.name === 'MongooseServerSelectionError') {
      console.error('[Corvo] O Render não consegue alcançar o Atlas. Causa mais comum: IP não liberado.');
      console.error('[Corvo] Corrija no MongoDB Atlas:');
      console.error('  1. Atlas → Network Access → Add IP Address');
      console.error('  2. Escolha "Allow Access from Anywhere" (0.0.0.0/0)');
      console.error('  3. Confirme e aguarde ~1 minuto');
      console.error('  4. Faça Manual Deploy no Render');
    } else {
      console.error('[Corvo] Verifique usuário, senha e Network Access no Atlas.');
    }

    throw error;
  }
}

async function migrateHouseLevels(House) {
  await House.updateMany({ level: 'dominante' }, { $set: { level: 'governante' } });
  await House.updateMany(
    { level: 'dominante-regional' },
    { $set: { level: 'governante', independent: true } },
  );
  await House.updateMany({ level: 'maior' }, { $set: { level: 'soberano' } });
  await House.updateOne(
    { slug: 'martell' },
    { $set: { level: 'governante', independent: true } },
  );
  await House.updateOne(
    { slug: 'targaryen-porto-real' },
    { $set: { level: 'governante', independent: false } },
  );
}

async function upsertDefaultHouse(House, house, resetMembers = false) {
  await removeHouseConflicts(House, house);

  const update = {
    name: house.name,
    level: house.level,
    region: house.region,
    maxMembers: house.maxMembers,
    independent: house.independent ?? false,
  };

  if (resetMembers) {
    update.goldDragons = 0;
    update.lordId = null;
    update.members = [];
  }

  try {
    await House.updateOne(
      { slug: house.slug },
      {
        $set: update,
        $setOnInsert: {
          goldDragons: 0,
          lordId: null,
          members: [],
        },
      },
      { upsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }

    await removeHouseConflicts(House, house);

    await House.updateOne(
      { slug: house.slug },
      {
        $set: update,
        $setOnInsert: {
          goldDragons: 0,
          lordId: null,
          members: [],
        },
      },
      { upsert: true },
    );
  }
}

async function seedDefaultHouses() {
  const House = require('../models/House');

  await migrateHouseLevels(House);

  const obsoleteResult = await House.deleteMany({ slug: { $in: OBSOLETE_SLUGS } });
  if (obsoleteResult.deletedCount > 0) {
    console.log(`[Corvo] Migração: removida(s) ${obsoleteResult.deletedCount} casa(s) obsoleta(s).`);
  }

  for (const house of DEFAULT_HOUSES) {
    await upsertDefaultHouse(House, house, false);
  }

  console.log('[Corvo] Casas padrão de Westeros verificadas.');
}

async function seedHouseEconomy() {
  const House = require('../models/House');
  const {
    HOUSE_ECONOMY_SEED,
    defaultTaxRateForLevel,
  } = require('../constants/economy');
  const { WESTEROS_GOVERNANTE_SLUG } = require('../constants/houses');
  const { getWorldState } = require('../services/worldService');

  const world = await getWorldState();
  const crownSlug = world.governanteWesterosSlug;

  const houses = await House.find({});
  for (const house of houses) {
    let changed = false;

    const seed = HOUSE_ECONOMY_SEED[house.slug];
    if (seed && !house.economySeeded) {
      house.goldDragons = seed.vault;
      house.annualIncome = seed.annualIncome;
      house.economySeeded = true;
      changed = true;
    }

    if (!house.taxRate) {
      const isCrown = house.slug === crownSlug || house.slug === WESTEROS_GOVERNANTE_SLUG;
      const rate = defaultTaxRateForLevel(house.level, { isCrown });
      if (rate > 0) {
        house.taxRate = rate;
        changed = true;
      }
    }

    if (changed) {
      await house.save();
    }
  }

  console.log('[Corvo] Economia das casas verificada.');
}

async function resetAllHouses() {
  const House = require('../models/House');
  const { resetWorldState } = require('../services/worldService');
  const Alliance = require('../models/Alliance');
  const Decree = require('../models/Decree');

  await House.deleteMany({});
  await Alliance.deleteMany({});
  await Decree.deleteMany({});

  await House.insertMany(
    DEFAULT_HOUSES.map((house) => ({
      name: house.name,
      slug: house.slug,
      level: house.level,
      region: house.region,
      maxMembers: house.maxMembers,
      independent: house.independent ?? false,
      goldDragons: 0,
      annualIncome: 0,
      taxRate: 0,
      incomeSource: '',
      economySeeded: false,
      structures: [],
      lordId: null,
      members: [],
    })),
  );

  await resetWorldState();
  await seedHouseEconomy();

  console.log('[Corvo] Todas as casas foram reiniciadas.');
}

async function seedWorldState() {
  const { getWorldState } = require('../services/worldService');
  await getWorldState();
  console.log('[Corvo] Status de Westeros verificado.');
}

module.exports = {
  connectDatabase,
  seedDefaultHouses,
  seedHouseEconomy,
  resetAllHouses,
  seedWorldState,
};
