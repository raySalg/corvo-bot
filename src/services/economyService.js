const House = require('../models/House');
const Alliance = require('../models/Alliance');
const EconomyLog = require('../models/EconomyLog');
const Decree = require('../models/Decree');
const { getWesterosGovernante, getWorldState } = require('./worldService');
const {
  HOUSE_LEVELS,
  isWesterosGovernante,
} = require('../constants/houses');
const { REGIONS } = require('../constants/regions');
const {
  getStructure,
  MAINTENANCE_INTERVAL_YEARS,
  MAINTENANCE_COST_RATE,
  IMPAIRMENT_FACTOR,
} = require('../constants/economy');

function isRulerLevel(level) {
  return level === HOUSE_LEVELS.SOBERANO || level === HOUSE_LEVELS.GOVERNANTE;
}

async function getSuzerain(house) {
  if (!house) return null;
  if (isWesterosGovernante(house)) return null;
  if (house.independent) return null;
  if (house.region === REGIONS.SEM_TERRAS) return null;

  if (house.level === HOUSE_LEVELS.MENOR) {
    const ruler = await House.findOne({
      region: house.region,
      level: { $in: [HOUSE_LEVELS.SOBERANO, HOUSE_LEVELS.GOVERNANTE] },
      slug: { $ne: house.slug },
    });
    return ruler ?? null;
  }

  if (isRulerLevel(house.level)) {
    const crown = await getWesterosGovernante();
    if (crown && crown.slug !== house.slug) {
      return crown;
    }
  }

  return null;
}

function pairKey(slugA, slugB) {
  return [slugA, slugB].sort();
}

async function findAlliance(slugA, slugB) {
  const [a, b] = pairKey(slugA, slugB);
  return Alliance.findOne({ houseA: a, houseB: b });
}

async function getAlliancesForHouse(slug, { status } = {}) {
  const query = { $or: [{ houseA: slug }, { houseB: slug }] };
  if (status) query.status = status;
  return Alliance.find(query).sort({ updatedAt: -1 });
}

function allianceOther(alliance, slug) {
  return alliance.houseA === slug ? alliance.houseB : alliance.houseA;
}

async function hasActiveAlliance(slug) {
  const count = await Alliance.countDocuments({
    status: 'active',
    $or: [{ houseA: slug }, { houseB: slug }],
  });
  return count > 0;
}

async function proposeAlliance(fromHouse, toHouse, actorId) {
  if (fromHouse.slug === toHouse.slug) {
    throw new Error('Uma casa não pode se aliar a si mesma.');
  }

  const existing = await findAlliance(fromHouse.slug, toHouse.slug);
  if (existing) {
    if (existing.status === 'active') {
      throw new Error(`**${fromHouse.name}** e **${toHouse.name}** já são aliadas.`);
    }
    throw new Error('Já existe uma proposta de aliança pendente entre essas casas.');
  }

  const [a, b] = pairKey(fromHouse.slug, toHouse.slug);
  return Alliance.create({ houseA: a, houseB: b, status: 'pending', proposedBy: actorId });
}

async function acceptAlliance(acceptingHouse, otherHouse) {
  const alliance = await findAlliance(acceptingHouse.slug, otherHouse.slug);
  if (!alliance || alliance.status !== 'pending') {
    throw new Error('Não há proposta de aliança pendente com essa casa.');
  }

  const proposerIsAccepting = alliance.proposedBy === acceptingHouse.lordId;
  if (proposerIsAccepting) {
    throw new Error('A casa que propôs não pode aceitar a própria proposta.');
  }

  alliance.status = 'active';
  await alliance.save();
  return alliance;
}

async function dissolveAlliance(houseA, houseB) {
  const alliance = await findAlliance(houseA.slug, houseB.slug);
  if (!alliance) {
    throw new Error('Não existe aliança ou proposta entre essas casas.');
  }
  await alliance.deleteOne();
  return alliance;
}

async function transferGold(fromHouse, toHouse, amount, actorId) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('O valor da transferência deve ser um número inteiro positivo.');
  }

  const alliance = await findAlliance(fromHouse.slug, toHouse.slug);
  if (!alliance || alliance.status !== 'active') {
    throw new Error('Só é possível transferir D.O. para casas aliadas.');
  }

  if (fromHouse.goldDragons < amount) {
    throw new Error('Cofres insuficientes para essa transferência.');
  }

  fromHouse.goldDragons -= amount;
  toHouse.goldDragons += amount;
  await fromHouse.save();
  await toHouse.save();

  await EconomyLog.create({
    type: 'transfer',
    houseSlug: fromHouse.slug,
    targetSlug: toHouse.slug,
    amount,
    actorId,
    detail: `Transferência de ${amount} D.O. de ${fromHouse.name} para ${toHouse.name}.`,
  });

  return { fromHouse, toHouse };
}

async function submitDecree(house, { authorId, content, totalSpent }) {
  if (!content || !content.trim()) {
    throw new Error('O conteúdo do decreto não pode ficar em branco.');
  }

  if (!Number.isInteger(totalSpent) || totalSpent < 0) {
    throw new Error('O total gasto deve ser um número inteiro maior ou igual a zero.');
  }

  const existing = await Decree.findOne({ houseSlug: house.slug });
  const replaced = Boolean(existing);

  await Decree.findOneAndUpdate(
    { houseSlug: house.slug },
    {
      houseSlug: house.slug,
      authorId,
      content: content.trim(),
      totalSpent,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return { replaced };
}

async function getPendingDecrees() {
  return Decree.find({}).sort({ createdAt: 1 });
}

async function clearDecrees() {
  await Decree.deleteMany({});
}

function structureIncomeForHouse(house) {
  if (!house.structures || house.structures.length === 0) return 0;
  let total = 0;
  for (const built of house.structures) {
    const data = getStructure(built.type);
    if (!data) continue;
    total += built.impaired
      ? Math.round(data.annualIncome * IMPAIRMENT_FACTOR)
      : data.annualIncome;
  }
  return total;
}

function totalIncomeForHouse(house) {
  return (house.annualIncome || 0) + structureIncomeForHouse(house);
}

async function buildStructure(house, type, quantity) {
  const data = getStructure(type);
  if (!data) {
    throw new Error('Estrutura desconhecida.');
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('A quantidade deve ser um número inteiro positivo.');
  }

  const totalCost = data.cost * quantity;
  if (house.goldDragons < totalCost) {
    throw new Error(
      `Cofres insuficientes: ${data.label} x${quantity} custa ${totalCost.toLocaleString('pt-BR')} D.O. ` +
        `(disponível: ${house.goldDragons.toLocaleString('pt-BR')} D.O.).`,
    );
  }

  const world = await getWorldState();
  const year = world.currentYear || 1;

  house.goldDragons -= totalCost;
  for (let i = 0; i < quantity; i += 1) {
    house.structures.push({ type, lastMaintainedYear: year, impaired: false });
  }
  await house.save();

  await EconomyLog.create({
    type: 'admin',
    houseSlug: house.slug,
    amount: -totalCost,
    detail: `Construção: ${data.label} x${quantity} (-${totalCost} D.O.).`,
  });

  return { data, quantity, totalCost, addedIncome: data.annualIncome * quantity };
}

function applyMaintenance(house, year) {
  let maintenancePaid = 0;
  let impairedCount = 0;

  for (const built of house.structures || []) {
    const data = getStructure(built.type);
    if (!data) continue;

    const due = year - built.lastMaintainedYear >= MAINTENANCE_INTERVAL_YEARS;
    if (!due) continue;

    const maintCost = Math.round(data.cost * MAINTENANCE_COST_RATE);
    if (house.goldDragons >= maintCost) {
      house.goldDragons -= maintCost;
      built.lastMaintainedYear = year;
      built.impaired = false;
      maintenancePaid += maintCost;
    } else {
      built.impaired = true;
      impairedCount += 1;
    }
  }

  return { maintenancePaid, impairedCount };
}

async function runEconomyCycle(actorId) {
  const houses = await House.find({});
  const bySlug = new Map(houses.map((house) => [house.slug, house]));
  const crown = await getWesterosGovernante();

  const world = await getWorldState();
  world.currentYear = (world.currentYear || 1) + 1;
  const year = world.currentYear;
  await world.save();

  const report = {
    year,
    baseIncomeTotal: 0,
    structureIncomeTotal: 0,
    maintenanceTotal: 0,
    impairedTotal: 0,
    taxToSuzerains: 0,
    taxToCrown: 0,
    houseCount: houses.length,
    crownSlug: crown?.slug ?? null,
  };

  for (const house of houses) {
    if (house.annualIncome > 0) {
      house.goldDragons += house.annualIncome;
      report.baseIncomeTotal += house.annualIncome;
    }

    const maintenance = applyMaintenance(house, year);
    report.maintenanceTotal += maintenance.maintenancePaid;
    report.impairedTotal += maintenance.impairedCount;

    const structureIncome = structureIncomeForHouse(house);
    if (structureIncome > 0) {
      house.goldDragons += structureIncome;
      report.structureIncomeTotal += structureIncome;
    }
  }

  for (const house of houses) {
    if (house.annualIncome <= 0) continue;
    if (house.independent || isWesterosGovernante(house)) continue;

    const suzerain = await getSuzerain(house);
    if (!suzerain) continue;

    const suzerainLive = bySlug.get(suzerain.slug);
    if (!suzerainLive) continue;

    const rate = suzerainLive.taxRate ?? 0;
    if (rate <= 0) continue;

    const tax = Math.round(house.annualIncome * rate);
    if (tax <= 0) continue;

    const payable = Math.min(tax, house.goldDragons);
    house.goldDragons -= payable;
    suzerainLive.goldDragons += payable;

    if (isWesterosGovernante(suzerainLive)) {
      report.taxToCrown += payable;
    } else {
      report.taxToSuzerains += payable;
    }
  }

  for (const house of houses) {
    await house.save();
  }

  await EconomyLog.create({
    type: 'cycle',
    actorId,
    amount: report.baseIncomeTotal + report.structureIncomeTotal,
    detail:
      `Ciclo (ano ${year}): +${report.baseIncomeTotal} base, +${report.structureIncomeTotal} estruturas, ` +
      `-${report.maintenanceTotal} manutenção, tributos ${report.taxToSuzerains}/${report.taxToCrown}.`,
  });

  return report;
}

module.exports = {
  getSuzerain,
  findAlliance,
  getAlliancesForHouse,
  allianceOther,
  hasActiveAlliance,
  proposeAlliance,
  acceptAlliance,
  dissolveAlliance,
  transferGold,
  submitDecree,
  getPendingDecrees,
  clearDecrees,
  buildStructure,
  structureIncomeForHouse,
  totalIncomeForHouse,
  runEconomyCycle,
};
