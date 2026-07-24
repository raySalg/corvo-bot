const { ChannelType } = require('discord.js');

async function fetchArchivedPages(forum, type) {
  const threads = new Map();
  let before;
  let guard = 0;

  while (guard < 100) {
    guard += 1;
    const options = { type, limit: 100 };
    if (type === 'private') options.fetchAll = true;
    if (before) options.before = before;

    const archived = await forum.threads.fetchArchived(options);
    if (!archived.threads?.size) break;

    let oldest = null;
    for (const thread of archived.threads.values()) {
      threads.set(thread.id, thread);
      const archivedAt = thread.archivedTimestamp ?? thread.archiveTimestamp ?? 0;
      if (!oldest || archivedAt < (oldest.archivedTimestamp ?? oldest.archiveTimestamp ?? 0)) {
        oldest = thread;
      }
    }

    if (!archived.hasMore) break;
    // Para públicos, `before` aceita data de arquivamento; para privados com fetchAll também.
    before = oldest?.archivedAt ?? oldest;
    if (!before) break;
  }

  return threads;
}

/**
 * Busca todos os tópicos ativos e arquivados de um fórum/mídia.
 */
async function fetchAllForumThreads(forum) {
  const threads = new Map();

  try {
    const active = await forum.threads.fetchActive();
    for (const thread of active.threads.values()) {
      threads.set(thread.id, thread);
    }
  } catch (error) {
    console.warn(`[Corvo] Falha ao listar tópicos ativos de #${forum.name}:`, error.message ?? error);
  }

  for (const type of ['public', 'private']) {
    try {
      const archived = await fetchArchivedPages(forum, type);
      for (const [id, thread] of archived) {
        threads.set(id, thread);
      }
    } catch (error) {
      if (type === 'public') {
        console.warn(
          `[Corvo] Falha ao listar tópicos arquivados (${type}) de #${forum.name}:`,
          error.message ?? error,
        );
      }
    }
  }

  if (forum.threads?.cache) {
    for (const thread of forum.threads.cache.values()) {
      threads.set(thread.id, thread);
    }
  }

  return [...threads.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function isForumLike(channel) {
  return channel?.type === ChannelType.GuildForum || channel?.type === ChannelType.GuildMedia;
}

module.exports = {
  fetchAllForumThreads,
  isForumLike,
};
