let locked = false;

function isJobLocked() {
  return locked;
}

function acquireJobLock(message = 'Já existe uma coleta/análise em andamento.') {
  if (locked) {
    throw Object.assign(new Error(message), { status: 409 });
  }
  locked = true;
}

function releaseJobLock() {
  locked = false;
}

module.exports = {
  isJobLocked,
  acquireJobLock,
  releaseJobLock,
};
