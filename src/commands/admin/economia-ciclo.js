const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const House = require('../../models/House');
const EconomyLog = require('../../models/EconomyLog');
const { requireAdmin } = require('../../utils/permissions');
const {
  runEconomyCycle,
  getPendingDecrees,
  clearDecrees,
} = require('../../services/economyService');
const { getWorldState } = require('../../services/worldService');
const { generateDecreeNarration } = require('../../services/aiService');
const { getRegionLabel } = require('../../constants/regions');
const { randomEmbedColor } = require('../../utils/embed');

const CONFIRMATION_TEXT = 'CONFIRMAR';
const LAW_EMOJI = '<:law:1481763732559237241>';
const BORDER = '━──────━──────━──────━──────≪<>≫──────━━──────━──────━──────';

function formatGold(value) {
  return `${value.toLocaleString('pt-BR')} D.O.`;
}

function buildDecreeMessage({ decree, house, narration }) {
  const lines = [
    BORDER,
    `> ${LAW_EMOJI} **—** Por ordem e autoridade do Senhor(a) <@${decree.authorId}>, ` +
      `a *Membro da casa ${house.name}*, fica formalizado o seguinte conjunto de diretrizes:`,
    '',
    decree.content,
    '',
    '### 🪙 BALANÇO FINANCEIRO',
    '',
    ` * 📊 **Total Gasto no Decreto:** **${decree.totalSpent.toLocaleString('pt-BR')}** DO`,
  ];

  if (narration) {
    lines.push('', '### 📜 Crônica do Meistre', '', narration);
  }

  lines.push(BORDER);

  return lines.join('\n');
}

async function sendInChunks(channel, text) {
  const limit = 2000;
  if (text.length <= limit) {
    await channel.send({ content: text });
    return;
  }

  const paragraphs = text.split('\n');
  let buffer = '';
  for (const line of paragraphs) {
    const candidate = buffer ? `${buffer}\n${line}` : line;
    if (candidate.length > limit) {
      if (buffer) await channel.send({ content: buffer });
      buffer = line.length > limit ? line.slice(0, limit) : line;
    } else {
      buffer = candidate;
    }
  }
  if (buffer) await channel.send({ content: buffer });
}

async function publishDecrees(interaction) {
  const world = await getWorldState();
  const decrees = await getPendingDecrees();

  if (decrees.length === 0) {
    return { posted: 0, spentTotal: 0, channelMissing: false };
  }

  if (!world.decreeChannelId) {
    return { posted: 0, spentTotal: 0, channelMissing: true, pending: decrees.length };
  }

  let channel;
  try {
    channel = await interaction.client.channels.fetch(world.decreeChannelId);
  } catch {
    channel = null;
  }

  if (!channel || typeof channel.send !== 'function') {
    return { posted: 0, spentTotal: 0, channelMissing: true, pending: decrees.length };
  }

  let posted = 0;
  let spentTotal = 0;

  for (const decree of decrees) {
    const house = await House.findOne({ slug: decree.houseSlug });
    if (!house) continue;

    const spent = Math.min(decree.totalSpent, house.goldDragons);
    if (spent > 0) {
      house.goldDragons -= spent;
      await house.save();
      spentTotal += spent;
    }

    await EconomyLog.create({
      type: 'admin',
      houseSlug: house.slug,
      amount: -spent,
      actorId: decree.authorId,
      detail: `Decreto econômico aplicado: -${spent} D.O.`,
    });

    let narration = null;
    try {
      narration = await generateDecreeNarration({
        houseName: house.name,
        regionLabel: getRegionLabel(house.region),
        authorName: `Senhor de ${house.name}`,
        content: decree.content,
        totalSpent: decree.totalSpent,
      });
    } catch {
      narration = null;
    }

    const message = buildDecreeMessage({ decree, house, narration });
    await sendInChunks(channel, message);
    posted += 1;
  }

  await clearDecrees();

  return { posted, spentTotal, channelMissing: false };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economia-ciclo')
    .setDescription('Processa o ciclo: rendimentos, tributação e publicação dos decretos (admin).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('confirmacao')
        .setDescription(`Digite ${CONFIRMATION_TEXT} para executar`)
        .setRequired(true),
    ),

  async execute(interaction) {
    if (!requireAdmin(interaction)) return;

    const confirmation = interaction.options.getString('confirmacao').trim().toUpperCase();

    if (confirmation !== CONFIRMATION_TEXT) {
      await interaction.reply({
        content:
          '### Confirmação necessária\n' +
          'Este comando credita o **rendimento anual**, coleta os **tributos** ' +
          '(vassala → suserano → Coroa) e publica os **decretos** dos jogadores no canal definido.\n\n' +
          `Para confirmar, use \`confirmacao: ${CONFIRMATION_TEXT}\` (sem aspas).`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const report = await runEconomyCycle(interaction.user.id);
      const decreeResult = await publishDecrees(interaction);

      const embed = new EmbedBuilder()
        .setColor(randomEmbedColor())
        .setTitle('Ciclo econômico')
        .setDescription('Os cofres do reino foram atualizados.')
        .addFields(
          { name: 'Rendimento creditado', value: formatGold(report.incomeTotal), inline: true },
          { name: 'Tributos regionais', value: formatGold(report.taxToSuzerains), inline: true },
          { name: 'Arrecadação da Coroa', value: formatGold(report.taxToCrown), inline: true },
          { name: 'Decretos publicados', value: `${decreeResult.posted}`, inline: true },
          { name: 'Gasto em decretos', value: formatGold(decreeResult.spentTotal), inline: true },
          { name: 'Casas processadas', value: `${report.houseCount}`, inline: true },
        )
        .setTimestamp();

      const extra = decreeResult.channelMissing
        ? `\nDefina o canal de decretos com \`/economia-canais\` — havia **${decreeResult.pending}** decreto(s) aguardando.`
        : '';

      await interaction.editReply({ content: extra || undefined, embeds: [embed] });
    } catch (error) {
      console.error('[Sete] Erro no ciclo econômico:', error);

      await interaction.editReply({
        content:
          '### Erro no ciclo\n' +
          'Não foi possível processar o ciclo econômico. Verifique os logs e tente novamente.',
      });
    }
  },
};
