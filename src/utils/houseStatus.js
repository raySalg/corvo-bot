function getVacancyIndicator(house) {
  const isFull = house.memberCount >= house.maxMembers;

  if (isFull) return '🔴';
  if (!house.lordId) return '🟢';
  return '🟡';
}

function getVacancyLabel(house) {
  const occupied = house.memberCount;
  return `${occupied}/${house.maxMembers} vagas`;
}

module.exports = { getVacancyIndicator, getVacancyLabel };
