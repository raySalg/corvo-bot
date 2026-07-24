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
  exportBtn: document.getElementById('export-btn'),
  exportModal: document.getElementById('export-modal'),
  exportForm: document.getElementById('export-form'),
  exportChannelLabel: document.getElementById('export-channel-label'),
  exportFrom: document.getElementById('export-from'),
  exportTo: document.getElementById('export-to'),
  exportSubmit: document.getElementById('export-submit'),
  scheduleBtn: document.getElementById('schedule-btn'),
  scheduleModal: document.getElementById('schedule-modal'),
  scheduleForm: document.getElementById('schedule-form'),
  scheduleEnabled: document.getElementById('schedule-enabled'),
  scheduleSources: document.getElementById('schedule-sources'),
  scheduleDestination: document.getElementById('schedule-destination'),
  scheduleDateFrom: document.getElementById('schedule-date-from'),
  scheduleDateTo: document.getElementById('schedule-date-to'),
  scheduleDateRange: document.getElementById('schedule-date-range'),
  scheduleDateMode: document.getElementById('schedule-date-mode'),
  scheduleDateTodayHint: document.getElementById('schedule-date-today-hint'),
  scheduleHour: document.getElementById('schedule-hour'),
  scheduleMinute: document.getElementById('schedule-minute'),
  scheduleDays: document.getElementById('schedule-days'),
  scheduleAiEnabled: document.getElementById('schedule-ai-enabled'),
  scheduleAiPrompt: document.getElementById('schedule-ai-prompt'),
  scheduleAiDestination: document.getElementById('schedule-ai-destination'),
  scheduleAiHour: document.getElementById('schedule-ai-hour'),
  scheduleAiMinute: document.getElementById('schedule-ai-minute'),
  scheduleAiDays: document.getElementById('schedule-ai-days'),
  scheduleStatus: document.getElementById('schedule-status'),
  scheduleSubmit: document.getElementById('schedule-submit'),
  scheduleRunNow: document.getElementById('schedule-run-now'),
  scheduleRunAiNow: document.getElementById('schedule-run-ai-now'),
  boatosBtn: document.getElementById('boatos-btn'),
  boatosModal: document.getElementById('boatos-modal'),
  boatosForm: document.getElementById('boatos-form'),
  boatosEnabled: document.getElementById('boatos-enabled'),
  boatosSources: document.getElementById('boatos-sources'),
  boatosDestination: document.getElementById('boatos-destination'),
  boatosDateFrom: document.getElementById('boatos-date-from'),
  boatosDateTo: document.getElementById('boatos-date-to'),
  boatosDateRange: document.getElementById('boatos-date-range'),
  boatosDateMode: document.getElementById('boatos-date-mode'),
  boatosDateTodayHint: document.getElementById('boatos-date-today-hint'),
  boatosPrompt: document.getElementById('boatos-prompt'),
  boatosHour: document.getElementById('boatos-hour'),
  boatosMinute: document.getElementById('boatos-minute'),
  boatosDays: document.getElementById('boatos-days'),
  boatosStatus: document.getElementById('boatos-status'),
  boatosSubmit: document.getElementById('boatos-submit'),
  boatosRunNow: document.getElementById('boatos-run-now'),
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
  els.exportBtn.disabled = !state.activeChannelId;
  els.messageInput.placeholder = !state.activeChannelId
    ? 'Selecione um canal para conversar'
    : state.canSend
      ? `Conversar em #${els.activeChannelName.textContent}`
      : 'Bot sem permissão para enviar neste canal';
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function openExportModal() {
  if (!state.activeChannelId) return;
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(today.getDate() - 30);

  els.exportChannelLabel.textContent = els.activeChannelName.textContent || 'canal';
  els.exportFrom.value = toInputDate(monthAgo);
  els.exportTo.value = toInputDate(today);
  els.exportModal.classList.remove('hidden');
}

function closeExportModal() {
  els.exportModal.classList.add('hidden');
  setButtonLoading(els.exportSubmit, false);
}

async function downloadExport(event) {
  event.preventDefault();
  if (!state.activeChannelId) return;

  const from = els.exportFrom.value;
  const to = els.exportTo.value;

  if (!from || !to) {
    showToast('Informe as duas datas.', true);
    return;
  }
  if (from > to) {
    showToast('A data inicial deve ser anterior ou igual à final.', true);
    return;
  }

  setButtonLoading(els.exportSubmit, true);
  setBusyHint('Preparando download…');

  try {
    const params = new URLSearchParams({ from, to });
    const response = await fetch(`/api/channels/${state.activeChannelId}/export?${params}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Erro HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || `chat_${from}_${to}.txt`;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    closeExportModal();
    setBusyHint('');
    showToast('Download iniciado.');
  } catch (error) {
    showToast(error.message, true);
    setBusyHint('');
  } finally {
    setButtonLoading(els.exportSubmit, false);
  }
}

function flattenGuildChannels(guild) {
  const groups = [];

  if (guild.uncategorized?.length) {
    groups.push({
      id: 'uncategorized',
      name: 'Canais de texto',
      channels: guild.uncategorized,
    });
  }

  for (const category of guild.categories || []) {
    groups.push({
      id: category.id,
      name: category.name,
      channels: category.channels || [],
    });
  }

  return groups;
}

function allFlatChannels(guild) {
  return flattenGuildChannels(guild).flatMap((group) => group.channels);
}

function syncGroupCheckbox(container, groupId) {
  const groupChecks = [...container.querySelectorAll(`.channel-check[data-group-id="${groupId}"]`)];
  const groupBox = container.querySelector(`.group-check[data-group-id="${groupId}"]`);
  if (!groupBox || groupChecks.length === 0) return;
  groupBox.checked = groupChecks.every((input) => input.checked);
  groupBox.indeterminate = !groupBox.checked && groupChecks.some((input) => input.checked);
}

function getSelectedSourceIdsFrom(container) {
  return [...container.querySelectorAll('.channel-check:checked')].map((input) => input.value);
}

function getSelectedSourceIds() {
  return getSelectedSourceIdsFrom(els.scheduleSources);
}

function fillSourcePicker(container, selectedIds = []) {
  if (!state.guild) return;
  const groups = flattenGuildChannels(state.guild);
  const selected = new Set(selectedIds);

  container.innerHTML = groups
    .map((group) => {
      const channelIds = group.channels.map((channel) => channel.id);
      const allChecked = channelIds.length > 0 && channelIds.every((id) => selected.has(id));
      return `
        <div class="source-group" data-group-id="${escapeHtml(group.id)}">
          <label class="source-group-title">
            <input type="checkbox" class="group-check" data-group-id="${escapeHtml(group.id)}" ${allChecked ? 'checked' : ''} />
            <span>${escapeHtml(group.name)}</span>
          </label>
          ${group.channels
            .map(
              (channel) => `
            <label class="source-item">
              <input type="checkbox" class="channel-check" value="${escapeHtml(channel.id)}" data-group-id="${escapeHtml(group.id)}" ${selected.has(channel.id) ? 'checked' : ''} />
              <span># ${escapeHtml(channel.name)}</span>
            </label>`,
            )
            .join('')}
        </div>`;
    })
    .join('') || '<p class="modal-note">Nenhum canal disponível.</p>';
}

function channelSelectOptions(selectedDestination) {
  return allFlatChannels(state.guild)
    .map(
      (channel) =>
        `<option value="${escapeHtml(channel.id)}" ${channel.id === selectedDestination ? 'selected' : ''}># ${escapeHtml(channel.name)}</option>`,
    )
    .join('');
}

function renderSchedulePickers(selectedIds = [], destinationId = null, aiDestinationId = null) {
  if (!state.guild) return;
  fillSourcePicker(els.scheduleSources, selectedIds);
  els.scheduleDestination.innerHTML = `<option value="">Selecione…</option>${channelSelectOptions(destinationId)}`;
  els.scheduleAiDestination.innerHTML = `<option value="">Selecione…</option>${channelSelectOptions(aiDestinationId || destinationId)}`;
}

function renderBoatosPickers(selectedIds = [], destinationId = null) {
  if (!state.guild) return;
  fillSourcePicker(els.boatosSources, selectedIds);
  els.boatosDestination.innerHTML = `<option value="">Selecione…</option>${channelSelectOptions(destinationId)}`;
}

function getSelectedDaysFrom(container) {
  return [...container.querySelectorAll('input[type="checkbox"]:checked')].map((input) => Number(input.value));
}

function setSelectedDaysOn(container, days) {
  const selected = new Set((days || []).map(Number));
  for (const input of container.querySelectorAll('input[type="checkbox"]')) {
    input.checked = selected.has(Number(input.value));
  }
}

function dayLabels(days) {
  return (days || [])
    .map((day) => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][day] || day)
    .join(', ');
}

function getSelectedDateMode() {
  const checked = els.scheduleDateMode?.querySelector('input[name="schedule-date-mode"]:checked');
  return checked?.value === 'today' ? 'today' : 'range';
}

function setSelectedDateMode(mode) {
  const value = mode === 'today' ? 'today' : 'range';
  for (const input of els.scheduleDateMode.querySelectorAll('input[name="schedule-date-mode"]')) {
    input.checked = input.value === value;
  }
  syncScheduleDateModeUi();
}

function syncScheduleDateModeUi() {
  const todayMode = getSelectedDateMode() === 'today';
  els.scheduleDateRange.hidden = todayMode;
  els.scheduleDateTodayHint.hidden = !todayMode;
  els.scheduleDateFrom.required = !todayMode;
  els.scheduleDateTo.required = !todayMode;
  els.scheduleDateFrom.disabled = todayMode;
  els.scheduleDateTo.disabled = todayMode;
}

function formatScheduleStatus(config, timezone) {
  if (!config) return `Fuso: ${timezone}`;
  const period =
    config.dateMode === 'today'
      ? 'somente hoje'
      : config.dateFrom && config.dateTo
        ? `${config.dateFrom} → ${config.dateTo}`
        : 'período não definido';
  const txtTime = `${String(config.hour).padStart(2, '0')}:${String(config.minute).padStart(2, '0')}`;
  const aiTime = `${String(config.aiHour ?? 0).padStart(2, '0')}:${String(config.aiMinute ?? 0).padStart(2, '0')}`;
  const lastTxt = config.lastRunAt ? new Date(config.lastRunAt).toLocaleString('pt-BR') : 'nunca';
  const lastAi = config.aiLastRunAt ? new Date(config.aiLastRunAt).toLocaleString('pt-BR') : 'nunca';
  const errTxt = config.lastError ? ` · erro TXT: ${config.lastError}` : '';
  const errAi = config.aiLastError ? ` · erro IA: ${config.aiLastError}` : '';
  return (
    `Fuso ${timezone} · Msgs ${period} · ` +
    `TXT ${config.enabled ? 'ativo' : 'off'} ${txtTime} (${dayLabels(config.daysOfWeek) || '—'}) última ${lastTxt}` +
    ` · IA ${config.aiEnabled ? 'ativa' : 'off'} ${aiTime} (${dayLabels(config.aiDaysOfWeek) || '—'}) última ${lastAi}` +
    `${errTxt}${errAi}`
  );
}

function buildSchedulePayload() {
  const dateMode = getSelectedDateMode();
  return {
    enabled: els.scheduleEnabled.checked,
    sourceChannelIds: getSelectedSourceIds(),
    destinationChannelId: els.scheduleDestination.value || null,
    dateMode,
    dateFrom: dateMode === 'range' ? els.scheduleDateFrom.value || null : null,
    dateTo: dateMode === 'range' ? els.scheduleDateTo.value || null : null,
    hour: Number(els.scheduleHour.value),
    minute: Number(els.scheduleMinute.value),
    daysOfWeek: getSelectedDaysFrom(els.scheduleDays),
    aiEnabled: els.scheduleAiEnabled.checked,
    aiPrompt: els.scheduleAiPrompt.value || '',
    aiDestinationChannelId: els.scheduleAiDestination.value || null,
    aiHour: Number(els.scheduleAiHour.value),
    aiMinute: Number(els.scheduleAiMinute.value),
    aiDaysOfWeek: getSelectedDaysFrom(els.scheduleAiDays),
  };
}

async function openScheduleModal() {
  if (!state.guild) return;
  try {
    const data = await api('/api/export-schedule');
    const config = data.config || {};
    const today = new Date();
    const monthAgo = new Date();
    monthAgo.setDate(today.getDate() - 30);

    els.scheduleEnabled.checked = Boolean(config.enabled);
    els.scheduleHour.value = Number.isFinite(config.hour) ? config.hour : 0;
    els.scheduleMinute.value = Number.isFinite(config.minute) ? config.minute : 0;
    els.scheduleDateFrom.value = config.dateFrom || toInputDate(monthAgo);
    els.scheduleDateTo.value = config.dateTo || toInputDate(today);
    setSelectedDateMode(config.dateMode || 'range');
    setSelectedDaysOn(els.scheduleDays, config.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]);

    els.scheduleAiEnabled.checked = Boolean(config.aiEnabled);
    els.scheduleAiPrompt.value = config.aiPrompt || '';
    els.scheduleAiHour.value = Number.isFinite(config.aiHour) ? config.aiHour : 0;
    els.scheduleAiMinute.value = Number.isFinite(config.aiMinute) ? config.aiMinute : 0;
    setSelectedDaysOn(els.scheduleAiDays, config.aiDaysOfWeek || [0, 1, 2, 3, 4, 5, 6]);

    renderSchedulePickers(
      config.sourceChannelIds || [],
      config.destinationChannelId,
      config.aiDestinationChannelId,
    );
    els.scheduleStatus.textContent = formatScheduleStatus(config, data.timezone || 'America/Sao_Paulo');
    els.scheduleModal.classList.remove('hidden');
  } catch (error) {
    showToast(error.message, true);
  }
}

function closeScheduleModal() {
  els.scheduleModal.classList.add('hidden');
  setButtonLoading(els.scheduleSubmit, false);
  setButtonLoading(els.scheduleRunNow, false);
  setButtonLoading(els.scheduleRunAiNow, false);
}

async function saveSchedule(event) {
  event.preventDefault();
  setButtonLoading(els.scheduleSubmit, true);
  try {
    const data = await api('/api/export-schedule', {
      method: 'PUT',
      body: JSON.stringify(buildSchedulePayload()),
    });
    els.scheduleStatus.textContent = formatScheduleStatus(data.config, data.timezone);
    showToast('Agendamento salvo.');
    closeScheduleModal();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonLoading(els.scheduleSubmit, false);
  }
}

async function runScheduleNow() {
  setButtonLoading(els.scheduleRunNow, true);
  try {
    await api('/api/export-schedule', {
      method: 'PUT',
      body: JSON.stringify(buildSchedulePayload()),
    });
    const result = await api('/api/export-schedule/run', { method: 'POST' });
    showToast(`TXT enviado (${result.total} mensagens · ${result.channels} canais).`);
    const data = await api('/api/export-schedule');
    els.scheduleStatus.textContent = formatScheduleStatus(data.config, data.timezone);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonLoading(els.scheduleRunNow, false);
  }
}

async function runAiScheduleNow() {
  setButtonLoading(els.scheduleRunAiNow, true);
  try {
    await api('/api/export-schedule', {
      method: 'PUT',
      body: JSON.stringify(buildSchedulePayload()),
    });
    const result = await api('/api/export-schedule/run-ai', { method: 'POST' });
    showToast(`Análise IA enviada (${result.total} mensagens · ${result.channels} canais).`);
    const data = await api('/api/export-schedule');
    els.scheduleStatus.textContent = formatScheduleStatus(data.config, data.timezone);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonLoading(els.scheduleRunAiNow, false);
  }
}

function getSelectedBoatosDateMode() {
  const checked = els.boatosDateMode?.querySelector('input[name="boatos-date-mode"]:checked');
  return checked?.value === 'today' ? 'today' : 'range';
}

function setSelectedBoatosDateMode(mode) {
  const value = mode === 'today' ? 'today' : 'range';
  for (const input of els.boatosDateMode.querySelectorAll('input[name="boatos-date-mode"]')) {
    input.checked = input.value === value;
  }
  syncBoatosDateModeUi();
}

function syncBoatosDateModeUi() {
  const todayMode = getSelectedBoatosDateMode() === 'today';
  els.boatosDateRange.hidden = todayMode;
  els.boatosDateTodayHint.hidden = !todayMode;
  els.boatosDateFrom.required = !todayMode;
  els.boatosDateTo.required = !todayMode;
  els.boatosDateFrom.disabled = todayMode;
  els.boatosDateTo.disabled = todayMode;
}

function formatBoatosStatus(config, timezone) {
  if (!config) return `Fuso: ${timezone}`;
  const period =
    config.dateMode === 'today'
      ? 'somente hoje'
      : config.dateFrom && config.dateTo
        ? `${config.dateFrom} → ${config.dateTo}`
        : 'período não definido';
  const time = `${String(config.hour).padStart(2, '0')}:${String(config.minute).padStart(2, '0')}`;
  const last = config.lastRunAt ? new Date(config.lastRunAt).toLocaleString('pt-BR') : 'nunca';
  const err = config.lastError ? ` · erro: ${config.lastError}` : '';
  return (
    `Fuso ${timezone} · ${config.enabled ? 'Ativo' : 'Desativado'} · Msgs ${period} · ` +
    `Envio ${time} (${dayLabels(config.daysOfWeek) || '—'}) · Última: ${last}${err}`
  );
}

function buildBoatosPayload() {
  const dateMode = getSelectedBoatosDateMode();
  return {
    enabled: els.boatosEnabled.checked,
    sourceChannelIds: getSelectedSourceIdsFrom(els.boatosSources),
    destinationChannelId: els.boatosDestination.value || null,
    dateMode,
    dateFrom: dateMode === 'range' ? els.boatosDateFrom.value || null : null,
    dateTo: dateMode === 'range' ? els.boatosDateTo.value || null : null,
    prompt: els.boatosPrompt.value || '',
    hour: Number(els.boatosHour.value),
    minute: Number(els.boatosMinute.value),
    daysOfWeek: getSelectedDaysFrom(els.boatosDays),
  };
}

async function openBoatosModal() {
  if (!state.guild) return;
  try {
    const data = await api('/api/boatos-schedule');
    const config = data.config || {};
    const today = new Date();
    const monthAgo = new Date();
    monthAgo.setDate(today.getDate() - 30);

    els.boatosEnabled.checked = Boolean(config.enabled);
    els.boatosHour.value = Number.isFinite(config.hour) ? config.hour : 0;
    els.boatosMinute.value = Number.isFinite(config.minute) ? config.minute : 0;
    els.boatosDateFrom.value = config.dateFrom || toInputDate(monthAgo);
    els.boatosDateTo.value = config.dateTo || toInputDate(today);
    setSelectedBoatosDateMode(config.dateMode || 'range');
    setSelectedDaysOn(els.boatosDays, config.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]);
    els.boatosPrompt.value = config.prompt || '';
    renderBoatosPickers(config.sourceChannelIds || [], config.destinationChannelId);
    els.boatosStatus.textContent = formatBoatosStatus(config, data.timezone || 'America/Sao_Paulo');
    els.boatosModal.classList.remove('hidden');
  } catch (error) {
    showToast(error.message, true);
  }
}

function closeBoatosModal() {
  els.boatosModal.classList.add('hidden');
  setButtonLoading(els.boatosSubmit, false);
  setButtonLoading(els.boatosRunNow, false);
}

async function saveBoatos(event) {
  event.preventDefault();
  setButtonLoading(els.boatosSubmit, true);
  try {
    const data = await api('/api/boatos-schedule', {
      method: 'PUT',
      body: JSON.stringify(buildBoatosPayload()),
    });
    els.boatosStatus.textContent = formatBoatosStatus(data.config, data.timezone);
    showToast('Agendamento de boatos salvo.');
    closeBoatosModal();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonLoading(els.boatosSubmit, false);
  }
}

async function runBoatosNow() {
  setButtonLoading(els.boatosRunNow, true);
  try {
    await api('/api/boatos-schedule', {
      method: 'PUT',
      body: JSON.stringify(buildBoatosPayload()),
    });
    const result = await api('/api/boatos-schedule/run', { method: 'POST' });
    showToast(`Boatos enviados (${result.total} mensagens · ${result.messageCount} msg Discord).`);
    const data = await api('/api/boatos-schedule');
    els.boatosStatus.textContent = formatBoatosStatus(data.config, data.timezone);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonLoading(els.boatosRunNow, false);
  }
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
    setBusyHint(guild.botIsAdmin ? '' : 'Bot sem Administrador — alguns canais podem faltar.');

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
els.exportBtn.addEventListener('click', openExportModal);
els.exportForm.addEventListener('submit', downloadExport);
els.exportModal.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-modal]')) closeExportModal();
});

els.scheduleBtn.addEventListener('click', openScheduleModal);
els.scheduleForm.addEventListener('submit', saveSchedule);
els.scheduleRunNow.addEventListener('click', runScheduleNow);
els.scheduleRunAiNow.addEventListener('click', runAiScheduleNow);
els.scheduleDateMode.addEventListener('change', syncScheduleDateModeUi);
els.scheduleModal.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-schedule]')) closeScheduleModal();
});
els.scheduleSources.addEventListener('change', (event) => {
  const groupCheck = event.target.closest('.group-check');
  if (groupCheck) {
    const groupId = groupCheck.dataset.groupId;
    for (const input of els.scheduleSources.querySelectorAll(`.channel-check[data-group-id="${groupId}"]`)) {
      input.checked = groupCheck.checked;
    }
    groupCheck.indeterminate = false;
    return;
  }

  const channelCheck = event.target.closest('.channel-check');
  if (channelCheck) syncGroupCheckbox(els.scheduleSources, channelCheck.dataset.groupId);
});

els.boatosBtn.addEventListener('click', openBoatosModal);
els.boatosForm.addEventListener('submit', saveBoatos);
els.boatosRunNow.addEventListener('click', runBoatosNow);
els.boatosDateMode.addEventListener('change', syncBoatosDateModeUi);
els.boatosModal.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-boatos]')) closeBoatosModal();
});
els.boatosSources.addEventListener('change', (event) => {
  const groupCheck = event.target.closest('.group-check');
  if (groupCheck) {
    const groupId = groupCheck.dataset.groupId;
    for (const input of els.boatosSources.querySelectorAll(`.channel-check[data-group-id="${groupId}"]`)) {
      input.checked = groupCheck.checked;
    }
    groupCheck.indeterminate = false;
    return;
  }

  const channelCheck = event.target.closest('.channel-check');
  if (channelCheck) syncGroupCheckbox(els.boatosSources, channelCheck.dataset.groupId);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!els.exportModal.classList.contains('hidden')) closeExportModal();
  if (!els.scheduleModal.classList.contains('hidden')) closeScheduleModal();
  if (!els.boatosModal.classList.contains('hidden')) closeBoatosModal();
});

els.messages.addEventListener('scroll', () => {
  clearTimeout(scrollLoadTimer);
  scrollLoadTimer = setTimeout(() => {
    if (els.messages.scrollTop < 80 && state.hasMore && !state.loadingMessages) {
      loadMessages({ older: true });
    }
  }, 80);
});

bootstrap();
