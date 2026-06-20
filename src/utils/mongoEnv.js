function normalizeEnv(value) {
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function normalizeMongoUri(value) {
  let uri = normalizeEnv(value);

  if (uri.startsWith('MONGODB_URI=')) {
    uri = uri.slice('MONGODB_URI='.length).trim().replace(/^['"]|['"]$/g, '');
  }

  return uri;
}

function maskMongoUri(uri) {
  return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:****@');
}

function validateMongoEnv() {
  const uri = normalizeMongoUri(process.env.MONGODB_URI);
  const errors = [];

  if (!uri) {
    errors.push('MONGODB_URI está vazia. Configure no Render → Environment.');
  } else if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    errors.push(
      'MONGODB_URI inválida. Ela deve começar com mongodb:// ou mongodb+srv:// (sem aspas e sem o prefixo "MONGODB_URI=").',
    );
  }

  return { uri, errors, maskedUri: uri ? maskMongoUri(uri) : '' };
}

module.exports = {
  normalizeEnv,
  normalizeMongoUri,
  maskMongoUri,
  validateMongoEnv,
};
