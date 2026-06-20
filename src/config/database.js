const mongoose = require('mongoose');
const { DEFAULT_HOUSES } = require('../constants/houses');
const { validateMongoEnv } = require('../utils/mongoEnv');

const OBSOLETE_SLUGS = ['targaryen'];

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
      `[Sete] Migração: removida(s) ${result.deletedCount} casa(s) conflitante(s) com o nome "${house.name}".`,
    );
  }
}

async function connectDatabase() {
  const { uri, errors, maskedUri } = validateMongoEnv();

  if (errors.length > 0) {
    console.error('[Sete] MongoDB mal configurado:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    console.error('[Sete] Exemplo válido no Render (Environment → MONGODB_URI):');
    console.error('  mongodb+srv://usuario:senha@cluster0.xxxxx.mongodb.net/sete?retryWrites=true&w=majority');
    throw new Error(errors.join(' '));
  }

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[Sete] Conectado ao MongoDB (${maskedUri}).`);
  } catch (error) {
    console.error(`[Sete] Falha na conexão com MongoDB (${maskedUri}).`);

    if (error.name === 'MongooseServerSelectionError') {
      console.error('[Sete] O Render não consegue alcançar o Atlas. Causa mais comum: IP não liberado.');
      console.error('[Sete] Corrija no MongoDB Atlas:');
      console.error('  1. Atlas → Network Access → Add IP Address');
      console.error('  2. Escolha "Allow Access from Anywhere" (0.0.0.0/0)');
      console.error('  3. Confirme e aguarde ~1 minuto');
      console.error('  4. Faça Manual Deploy no Render');
    } else {
      console.error('[Sete] Verifique usuário, senha e Network Access no Atlas.');
    }

    throw error;
  }
}

async function upsertDefaultHouse(House, house, resetMembers = false) {
  await removeHouseConflicts(House, house);

  const update = {
    name: house.name,
    level: house.level,
    region: house.region,
    maxMembers: house.maxMembers,
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

  const obsoleteResult = await House.deleteMany({ slug: { $in: OBSOLETE_SLUGS } });
  if (obsoleteResult.deletedCount > 0) {
    console.log(`[Sete] Migração: removida(s) ${obsoleteResult.deletedCount} casa(s) obsoleta(s).`);
  }

  for (const house of DEFAULT_HOUSES) {
    await upsertDefaultHouse(House, house, false);
  }

  console.log('[Sete] Casas padrão de Westeros verificadas.');
}

async function resetAllHouses() {
  const House = require('../models/House');
  const defaultSlugs = DEFAULT_HOUSES.map((house) => house.slug);

  await House.deleteMany({ slug: { $in: OBSOLETE_SLUGS } });
  await House.deleteMany({ slug: { $nin: defaultSlugs } });

  for (const house of DEFAULT_HOUSES) {
    await upsertDefaultHouse(House, house, true);
  }

  console.log('[Sete] Todas as casas foram reiniciadas.');
}

module.exports = { connectDatabase, seedDefaultHouses, resetAllHouses };
