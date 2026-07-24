function validateMongoEnv() {
  const uri = process.env.MONGODB_URI?.trim() || '';
  const errors = [];

  if (!uri) {
    errors.push('MONGODB_URI está vazio. Configure a connection string do MongoDB Atlas.');
  } else if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    errors.push('MONGODB_URI deve começar com mongodb:// ou mongodb+srv://');
  }

  return { uri, errors };
}

module.exports = { validateMongoEnv };
