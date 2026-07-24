const state = {
  guild: null,
  membersLoaded: false,
  activeChannelId: null,
  canSend: false,
  messages: [],
  hasMore: false,
  loadingMessages: false,
  oldestId: null,
  loadToken: 0,
  sending: false,
};

const els = {
  app: document.getElementById('app'),
  guildName: document.getElementById('guild-name'),
  guildIcon: document.getElementById('guild-icon'),
  channelList: document.getElementById('channel-list'),
  botAvatar: document.getElementById('bot-avatar'),
  botName: document.getElementById('bot-name'),
  activeChannelName: document.getElementById('active-channel-name'),
  channelHeading: document.querySelector('.channel-heading'),
  connectionHint: document.getElementById('connection-hint'),
  messages: document.getElementById('messages'),
  messageList: document.getElementById('message-list'),
  messagesEmpty: document.getElementById('messages-empty'),
  messagesLoading: document.getElementById('messages-loading'),
  loadOlder: document.getElementById('load-older'),
  loadOlderBtn: document.getElementById('load-older-btn'),
  composer: document.getElementById('composer'),
  messageInput: document.getElementById('message-input'),
  sendBtn: document.getElementById('send-btn'),
  memberList: document.getElementById('member-list'),
  toast: document.getElementById('toast'),
};

let scrollLoadTimer = null;
let toastTimer = null;
let abortController = null;

function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle('error', isError);
  els.toast.classList.remove('hidden');
  requestAnimationFrame(() => els.toast.classList.add('is-visible'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('is-visible');
    setTimeout(() => els.toast.classList.add('hidden'), 200);
  }, 3800);
}

function setBusyHint(text) {
  els.connectionHint.textContent = text || '';
  els.connectionHint.classList.toggle('is-busy', Boolean(text));
}

function setLoadingOverlay(visible) {
  els.messagesLoading.classList.toggle('hidden', !visible);
}

function setButtonLoading(button, loading) {
  button.classList.toggle('is-loading', loading);
  button.disabled = loading || button.dataset.locked === '1';
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    signal: options.signal,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Erro HTTP ${response.status}`);
  }
  return data;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function linkify(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );
}

function formatTime(iso) {
  const date = new Date(iso);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sameMinute(a, b) {
  if (!a || !b) return false;
  const da = new Date(a.createdAt);
  const db = new Date(b.createdAt);
  return a.author?.id === b.author?.id && Math.abs(da - db) < 5 * 60 * 1000;
}

function colorToCss(color) {
  if (color == null) return '#202225';
  return `#${Number(color).toString(16).padStart(6, '0')}`;
}

function renderEmbed(embed) {
  const fields = (embed.fields || [])
    .map(
      (field) => `
      <div class="embed-field">
        <div class="embed-field-name">${escapeHtml(field.name)}</div>
        <div class="embed-field-value">${linkify(field.value)}</div>
      </div>`,
    )
    .join('');

  return `
    <article class="embed">
      <div class="embed-bar" style="background:${colorToCss(embed.color)}"></div>
      <div class="embed-body">
        <div class="embed-layout">
          <div>
            ${embed.title ? `<h3 class="embed-title">${escapeHtml(embed.title)}</h3>` : ''}
            ${embed.description ? `<p class="embed-description">${linkify(embed.description)}</p>` : ''}
            ${fields ? `<div class="embed-fields">${fields}</div>` : ''}
            ${embed.footer?.text ? `<div class="embed-footer">${escapeHtml(embed.footer.text)}</div>` : ''}
          </div>
          ${embed.thumbnail ? `<img class="embed-thumb" src="${escapeHtml(embed.thumbnail)}" alt="" loading="lazy" />` : ''}
        </div>
        ${embed.image ? `<img class="embed-image" src="${escapeHtml(embed.image)}" alt="" loading="lazy" />` : ''}
      </div>
    </article>`;
}

function renderAttachments(attachments) {
  if (!attachments?.length) return '';
  return `<div class="attachments">${attachments
    .map((file) => {
      if (file.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name || '')) {
        return `<img src="${escapeHtml(file.url)}" alt="${escapeHtml(file.name || 'imagem')}" loading="lazy" />`;
      }
      return `<a href="${escapeHtml(file.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(file.name || 'arquivo')}</a>`;
    })
    .join('')}</div>`;
}

function messageHtml(message, previous, { isNew = false } = {}) {
  const compact = sameMinute(previous, message);
  const authorName = escapeHtml(message.author?.displayName || message.author?.username || 'Desconhecido');
  const botClass = message.author?.bot ? ' bot' : '';
  const content = message.content ? `<div class="message-content">${linkify(message.content)}</div>` : '';
  const embeds = message.embeds?.length
    ? `<div class="embeds">${message.embeds.map(renderEmbed).join('')}</div>`
    : '';

  return `
    <article class="message${compact ? ' compact' : ''}${isNew ? ' is-new' : ''}" data-id="${escapeHtml(message.id)}">
      <div class="avatar-slot">
        <img src="${escapeHtml(message.author?.avatarUrl || '')}" alt="" loading="lazy" />
      </div>
      <div class="message-body">
        <div class="message-meta">
          <span class="author${botClass}">${authorName}</span>
          <time class="timestamp">${escapeHtml(formatTime(message.createdAt))}</time>
        </div>
        ${content}
        ${embeds}
        ${renderAttachments(message.attachments)}
      </div>
    </article>`;
}

function updateEmptyState() {
  if (!state.messages.length) {
    els.messagesEmpty.classList.remove('hidden');
    els.messagesEmpty.textContent = state.activeChannelId
      ? 'Nenhuma mensagem neste canal.'
      : 'Escolha um canal à esquerda para ver as mensagens.';
  } else {
    els.messagesEmpty.classList.add('hidden');
  }
  els.loadOlder.classList.toggle('hidden', !state.hasMore);
}

function renderMessages({ stickToBottom = false, preserveScroll = false, animate = false } = {}) {
  const scroller = els.messages;
  const previousHeight = scroller.scrollHeight;
  const previousTop = scroller.scrollTop;

  if (!state.messages.length) {
    els.messageList.innerHTML = '';
  } else {
    let html = '';
    for (let i = 0; i < state.messages.length; i += 1) {
      html += messageHtml(state.messages[i], state.messages[i - 1] || null);
    }
    els.messageList.innerHTML = html;
  }

  updateEmptyState();

  if (animate) {
    els.messageList.classList.remove('is-fading');
    // force reflow for replay
    void els.messageList.offsetWidth;
    els.messageList.classList.add('is-fading');
  }

  requestAnimationFrame(() => {
    if (preserveScroll) {
      scroller.scrollTop = scroller.scrollHeight - previousHeight + previousTop;
    } else if (stickToBottom) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  });
}

function appendMessage(message) {
  const previous = state.messages[state.messages.length - 2] || null;
  const nearBottom = els.messages.scrollHeight - els.messages.scrollTop - els.messages.clientHeight < 120;
  els.messageList.insertAdjacentHTML('beforeend', messageHtml(message, previous, { isNew: true }));
  updateEmptyState();
  if (nearBottom) {
    els.messages.scrollTo({ top: els.messages.scrollHeight, behavior: 'smooth' });
  }
}

function setActiveChannelButton(channelId) {
  for (const button of els.channelList.querySelectorAll('.channel-btn')) {
    button.classList.toggle('active', button.dataset.channelId === channelId);
  }
}

function renderChannels(guild) {
  const parts = [];

  const pushChannels = (channels) => {
    for (const channel of channels) {
      const active = channel.id === state.activeChannelId ? ' active' : '';
      parts.push(`
        <button type="button" class="channel-btn${active}" data-channel-id="${escapeHtml(channel.id)}" data-channel-name="${escapeHtml(channel.name)}" data-can-send="${channel.canSend ? '1' : '0'}">
          <span class="hash">#</span>
          <span class="name">${escapeHtml(channel.name)}</span>
        </button>`);
    }
  };

  if (guild.uncategorized?.length) {
    parts.push(`<div class="category"><div class="category-name">Canais de texto</div>`);
    pushChannels(guild.uncategorized);
    parts.push('</div>');
  }

  for (const category of guild.categories || []) {
    parts.push(`<div class="category"><div class="category-name">${escapeHtml(category.name)}</div>`);
    pushChannels(category.channels || []);
    parts.push('</div>');
  }

  els.channelList.innerHTML = parts.join('') || '<p class="empty-state">Nenhum canal visível para o bot.</p>';
}

function renderMembers(groups) {
  if (!groups?.length) {
    els.memberList.innerHTML = '<p class="empty-state">Sem membros carregados.</p>';
    return;
  }

  els.memberList.innerHTML = groups
    .map(
      (group) => `
      <section class="member-group">
        <h3 class="member-group-title">${escapeHtml(group.name)} — ${group.count}</h3>
        ${group.members
          .map(
            (member) => `
          <div class="member-row">
            <img class="avatar" src="${escapeHtml(member.avatarUrl)}" alt="" loading="lazy" />
            <span class="member-name" style="color:${escapeHtml(member.color || '#f2f3f5')}">${escapeHtml(member.displayName)}</span>
          </div>`,
          )
          .join('')}
      </section>`,
    )
    .join('');
}

function updateComposer() {
  const enabled = Boolean(state.activeChannelId && state.canSend && !state.sending);
  els.messageInput.disabled = !state.activeChannelId || !state.canSend;
  els.sendBtn.dataset.locked = enabled ? '0' : '1';
  els.sendBtn.disabled = !enabled;
  els.messageInput.placeholder = !state.activeChannelId
    ? 'Selecione um canal para conversar'
    : state.canSend
      ? `Conversar em #${els.activeChannelName.textContent}`
      : 'Bot sem permissão para enviar neste canal';
}

async function selectChannel(channelId, channelName, canSend) {
  if (state.activeChannelId === channelId && state.messages.length) return;

  if (abortController) abortController.abort();
  abortController = new AbortController();

  state.activeChannelId = channelId;
  state.canSend = canSend;
  state.messages = [];
  state.hasMore = false;
  state.oldestId = null;
  state.loadToken += 1;

  els.activeChannelName.textContent = channelName;
  els.channelHeading.classList.add('is-switching');
  setActiveChannelButton(channelId);
  updateComposer();
  els.messageList.innerHTML = '';
  updateEmptyState();
  setLoadingOverlay(true);

  await loadMessages({ initial: true, signal: abortController.signal });
  els.channelHeading.classList.remove('is-switching');
}

async function loadMessages({ initial = false, older = false, signal } = {}) {
  if (!state.activeChannelId || (state.loadingMessages && !initial)) return;

  const token = state.loadToken;
  state.loadingMessages = true;

  if (older) {
    setButtonLoading(els.loadOlderBtn, true);
    setBusyHint('Carregando histórico…');
  } else if (initial) {
    setBusyHint('Carregando mensagens…');
    setLoadingOverlay(true);
  }

  try {
    const params = new URLSearchParams({ limit: '50' });
    if (older && state.oldestId) params.set('before', state.oldestId);

    const data = await api(`/api/channels/${state.activeChannelId}/messages?${params}`, { signal });
    if (token !== state.loadToken) return;

    state.canSend = Boolean(data.canSend);
    updateComposer();

    if (older) {
      state.messages = [...data.messages, ...state.messages];
    } else {
      state.messages = data.messages;
    }

    state.hasMore = Boolean(data.hasMore);
    state.oldestId = state.messages[0]?.id ?? null;
    renderMessages({
      stickToBottom: initial && !older,
      preserveScroll: older,
      animate: initial && !older,
    });
    setBusyHint('');
  } catch (error) {
    if (error.name === 'AbortError') return;
    setBusyHint(error.message);
    showToast(error.message, true);
  } finally {
    if (token === state.loadToken) {
      state.loadingMessages = false;
      setLoadingOverlay(false);
      setButtonLoading(els.loadOlderBtn, false);
    }
  }
}

async function sendMessage(event) {
  event.preventDefault();
  const content = els.messageInput.value.trim();
  if (!content || !state.activeChannelId || !state.canSend || state.sending) return;

  state.sending = true;
  setButtonLoading(els.sendBtn, true);
  updateComposer();

  try {
    const data = await api(`/api/channels/${state.activeChannelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    state.messages.push(data.message);
    els.messageInput.value = '';
    appendMessage(data.message);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    state.sending = false;
    setButtonLoading(els.sendBtn, false);
    updateComposer();
    els.messageInput.focus();
  }
}

async function bootstrap() {
  try {
    setBusyHint('Conectando ao Discord…');
    const guild = await api('/api/guild');
    state.guild = guild;
    els.guildName.textContent = guild.name;
    if (guild.iconUrl) {
      els.guildIcon.src = guild.iconUrl;
      els.guildIcon.hidden = false;
    }
    if (guild.bot) {
      els.botAvatar.src = guild.bot.avatarUrl;
      els.botName.textContent = guild.bot.displayName || guild.bot.username;
    }
    renderChannels(guild);
    els.app.classList.remove('is-booting');
    setBusyHint('');

    const first =
      guild.uncategorized?.[0] ||
      guild.categories?.flatMap((c) => c.channels || [])?.[0] ||
      null;
    if (first) {
      await selectChannel(first.id, first.name, first.canSend);
    }

    const members = await api('/api/members');
    state.membersLoaded = true;
    renderMembers(members.groups);
  } catch (error) {
    els.app.classList.remove('is-booting');
    els.guildName.textContent = 'Indisponível';
    setBusyHint(error.message);
    showToast(error.message, true);
  }
}

els.channelList.addEventListener('click', (event) => {
  const button = event.target.closest('.channel-btn');
  if (!button) return;
  selectChannel(button.dataset.channelId, button.dataset.channelName, button.dataset.canSend === '1');
});

els.loadOlderBtn.addEventListener('click', () => loadMessages({ older: true }));
els.composer.addEventListener('submit', sendMessage);

els.messages.addEventListener('scroll', () => {
  clearTimeout(scrollLoadTimer);
  scrollLoadTimer = setTimeout(() => {
    if (els.messages.scrollTop < 80 && state.hasMore && !state.loadingMessages) {
      loadMessages({ older: true });
    }
  }, 80);
});

bootstrap();
