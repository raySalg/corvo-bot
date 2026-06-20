const mongoose = require('mongoose');
const { DEFAULT_HOUSES } = require('../constants/houses');

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI não definida. Configure no arquivo .env ou no Render.');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('[Sete] Conectado ao MongoDB.');
}

async function seedDefaultHouses() {
  const House = require('../models/House');

  for (const house of DEFAULT_HOUSES) {
    await House.updateOne(
      { slug: house.slug },
      {
        $setOnInsert: {
          name: house.name,
          slug: house.slug,
          level: house.level,
          maxMembers: house.maxMembers,
          goldDragons: 0,
          lordId: null,
          members: [],
        },
      },
      { upsert: true },
    );
  }

  console.log('[Sete] Casas padrão de Westeros verificadas.');
}

module.exports = { connectDatabase, seedDefaultHouses };
