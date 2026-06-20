const House = require('../models/House');

async function findUserHouse(userId) {
  return House.findOne({
    $or: [{ lordId: userId }, { members: userId }],
  });
}

async function removeUserFromAllHouses(userId) {
  await House.updateMany({ lordId: userId }, { $set: { lordId: null } });
  await House.updateMany({ members: userId }, { $pull: { members: userId } });
}

async function assignUserToHouse(userId, house, role) {
  await removeUserFromAllHouses(userId);

  const freshHouse = await House.findById(house._id);
  if (!freshHouse) return;

  if (role === 'lorde') {
    freshHouse.lordId = userId;
    freshHouse.members = freshHouse.members.filter((memberId) => memberId !== userId);
  } else {
    if (!freshHouse.members.includes(userId)) {
      freshHouse.members.push(userId);
    }
    if (freshHouse.lordId === userId) {
      freshHouse.lordId = null;
    }
  }

  await freshHouse.save();
}

function formatSilentMention(userId) {
  return `<@${userId}>`;
}

function formatMemberList(house) {
  const lines = [];

  if (house.lordId) {
    lines.push(`**Senhor(a):** ${formatSilentMention(house.lordId)}`);
  } else {
    lines.push('**Senhor(a):** vaga disponível');
  }

  if (house.members.length > 0) {
    const members = house.members.map((memberId) => formatSilentMention(memberId)).join(', ');
    lines.push(`**Membros:** ${members}`);
  } else {
    lines.push('**Membros:** nenhum');
  }

  return lines.join('\n');
}

const SILENT_MENTIONS = { parse: [], users: [], roles: [] };

module.exports = {
  findUserHouse,
  removeUserFromAllHouses,
  assignUserToHouse,
  formatMemberList,
  SILENT_MENTIONS,
};
