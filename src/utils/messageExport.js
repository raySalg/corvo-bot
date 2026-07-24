function snowflakeFromTimestamp(ms) {
  const discordEpoch = 1420070400000n;
  return ((BigInt(ms) - discordEpoch) << 22n).toString();
}

function formatMessageLine(message) {
  const when = new Date(message.createdTimestamp).toLocaleString('pt-BR');
  const author = message.author?.tag || message.author?.username || 'Desconhecido';
  const lines = [`[${when}] ${author}: ${message.content || ''}`];

  for (const embed of message.embeds) {
    const data = embed.data ?? embed;
    if (data.title) lines.push(`  [embed título] ${data.title}`);
    if (data.description) lines.push(`  [embed] ${data.description}`);
    if (data.url) lines.push(`  [embed url] ${data.url}`);
    if (data.image?.url) lines.push(`  [embed imagem] ${data.image.url}`);
  }

  for (const attachment of message.attachments.values()) {
    lines.push(`  [anexo] ${attachment.name || 'arquivo'} — ${attachment.url}`);
  }

  return lines.join('\n');
}

function formatMessagesAsTxt({ guildName, channelName, from, to, messages, truncated, maxMessages }) {
  const header = [
    `# Exportação Corvo`,
    `# Servidor: ${guildName}`,
    `# Canal: #${channelName}`,
    `# Período: ${from} → ${to}`,
    `# Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `# Total: ${messages.length} mensagem(ns)`,
    truncated ? `# Aviso: limite de ${maxMessages} mensagens atingido; o arquivo pode estar incompleto.` : null,
    '',
  ]
    .filter((line) => line != null)
    .join('\n');

  const body = messages.map(formatMessageLine).join('\n\n');
  return `${header}${body}\n`;
}

function formatMultiChannelTxt({ guildName, sections, generatedAt = new Date() }) {
  const total = sections.reduce((sum, section) => sum + section.messages.length, 0);
  const header = [
    `# Exportação agendada — Corvo`,
    `# Servidor: ${guildName}`,
    `# Canais: ${sections.length}`,
    `# Gerado em: ${generatedAt.toLocaleString('pt-BR')}`,
    `# Total geral: ${total} mensagem(ns)`,
    '',
  ].join('\n');

  const body = sections
    .map((section) => {
      const blockHeader = [
        `${'='.repeat(60)}`,
        `# Canal: #${section.channelName}`,
        `# Mensagens: ${section.messages.length}`,
        section.truncated ? `# Aviso: histórico truncado neste canal.` : null,
        `${'='.repeat(60)}`,
        '',
      ]
        .filter((line) => line != null)
        .join('\n');

      return `${blockHeader}${section.messages.map(formatMessageLine).join('\n\n')}`;
    })
    .join('\n\n\n');

  return `${header}${body}\n`;
}

async function collectMessagesInRange(channel, { fromMs, toMs, maxMessages }) {
  const collected = [];
  let before = snowflakeFromTimestamp(toMs + 1);
  let done = false;

  while (!done && collected.length < maxMessages) {
    const batchSize = Math.min(100, maxMessages - collected.length);
    const fetched = await channel.messages.fetch({ limit: batchSize, before });
    if (fetched.size === 0) break;

    const batch = [...fetched.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp);
    for (const message of batch) {
      if (message.createdTimestamp > toMs) continue;
      if (message.createdTimestamp < fromMs) {
        done = true;
        break;
      }
      collected.push(message);
      if (collected.length >= maxMessages) {
        done = true;
        break;
      }
    }

    const oldest = batch[batch.length - 1];
    before = oldest.id;
    if (fetched.size < batchSize) break;
  }

  return collected.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

module.exports = {
  snowflakeFromTimestamp,
  formatMessageLine,
  formatMessagesAsTxt,
  formatMultiChannelTxt,
  collectMessagesInRange,
};
