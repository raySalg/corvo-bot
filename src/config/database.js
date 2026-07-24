const mongoose = require('mongoose');
const { validateMongoEnv } = require('../utils/mongoEnv');

async function connectDatabase() {
  const { uri, errors } = validateMongoEnv();
  if (errors.length > 0) {
    const error = new Error(errors.join(' '));
    error.code = 'MONGO_ENV';
    throw error;
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('[Corvo] MongoDB conectado.');
  return mongoose.connection;
}

function getMongoReadyState() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] ?? 'unknown';
}

module.exports = { connectDatabase, getMongoReadyState };
