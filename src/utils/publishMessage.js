async function publishEmbed(channel, { title, embed }) {
  if (!channel) {
    throw new Error('CHANNEL_UNAVAILABLE');
  }

  if (channel.isThread?.() || (channel.isSendable?.() && typeof channel.send === 'function')) {
    await channel.send({ embeds: [embed] });
    return 'message';
  }

  if (channel.isThreadOnly?.() && channel.threads?.create) {
    const threadName = (title || 'Anúncio').trim().slice(0, 100) || 'Anúncio';
    await channel.threads.create({
      name: threadName,
      message: { embeds: [embed] },
    });
    return 'forum_post';
  }

  throw new Error('CHANNEL_UNSUPPORTED');
}

module.exports = { publishEmbed };
