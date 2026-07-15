let state = { user: null, events: [], eventTypes: [], layouts: [], currentEvent: null, selectedMode: null, selectedLayout: null };

async function init() {
  state.user = await requireRole('client');
  if (!state.user) return;
  document.getElementById('who').textContent = state.user.name;

  const [eventsRes, typesRes, layoutsRes] = await Promise.all([
    api('/api/events'),
    api('/api/event-types'),
    api('/api/layouts')
  ]);
  state.events = eventsRes;
  state.eventTypes = typesRes;
  state.layouts = layoutsRes;

  renderEventTypeOptions();
  renderEvents();
  bindGlobalEvents();
}

function renderEventTypeOptions() {
  const sel = document.getElementById('new-event-type');
  sel.innerHTML = state.eventTypes.map(t => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`).join('');
}

function renderEvents() {
  const container = document.getElementById('events-container');
  if (state.events.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>No albums yet</h3><p>Create your first album to start uploading photos.</p></div>`;
    return;
  }
  container.innerHTML = `<div class="event-grid">` + state.events.map(ev => `
    <div class="card event-card" data-id="${ev.id}">
      <div class="corner"></div>
      <h3>${escapeHtml(ev.eventType)}</h3>
      <div class="meta">${ev.photoCount} photo${ev.photoCount === 1 ? '' : 's'} · created ${new Date(ev.createdAt).toLocaleDateString()}</div>
      <div class="row">
        <span class="status-tag status-${ev.album ? ev.album.status : 'created'}">${statusLabel(ev.album ? ev.album.status : 'created')}</span>
        <button class="btn btn-secondary btn-sm open-event">Manage →</button>
      </div>
    </div>
  `).join('') + `</div>`;

  container.querySelectorAll('.event-card').forEach(card => {
    card.querySelector('.open-event').onclick = () => openEvent(card.dataset.id);
  });
}

function bindGlobalEvents() {
  document.getElementById('new-event-btn').onclick = () => {
    document.getElementById('new-event-overlay').style.display = 'flex';
  };
  document.getElementById('new-event-cancel').onclick = () => {
    document.getElementById('new-event-overlay').style.display = 'none';
  };
  document.getElementById('new-event-create').onclick = async () => {
    const eventType = document.getElementById('new-event-type').value;
    const ev = await api('/api/events', { method: 'POST', body: { eventType } });
    document.getElementById('new-event-overlay').style.display = 'none';
    state.events.unshift({ ...ev, photoCount: 0 });
    renderEvents();
    toast('Album created');
    openEvent(ev.id);
  };

  document.getElementById('back-btn').onclick = () => {
    document.getElementById('event-detail-view').style.display = 'none';
    document.getElementById('events-view').style.display = 'block';
    refreshEvents();
  };

  document.getElementById('photo-input').onchange = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    const fd = new FormData();
    for (const f of files) fd.append('photos', f);
    try {
      await apiUpload(`/api/events/${state.currentEvent.id}/photos`, fd);
      toast(`${files.length} photo(s) added`);
      await loadPhotos();
    } catch (err) { toast(err.message); }
    e.target.value = '';
  };

  document.getElementById('drive-link-btn').onclick = async () => {
    const input = document.getElementById('drive-link-input');
    if (!input.value.trim()) return;
    try {
      await api(`/api/events/${state.currentEvent.id}/drive-link`, { method: 'POST', body: { driveUrl: input.value.trim() } });
      input.value = '';
      toast('Drive link added');
      await loadPhotos();
    } catch (err) { toast(err.message); }
  };

  document.getElementById('mode-self').onclick = () => selectMode('self');
  document.getElementById('mode-company').onclick = () => selectMode('assigned_to_company');

  document.getElementById('save-album-btn').onclick = async () => {
    if (!state.selectedMode) return toast('Choose who designs the album first');
    try {
      await api(`/api/events/${state.currentEvent.id}/album`, {
        method: 'POST',
        body: { designMode: state.selectedMode, layoutId: state.selectedLayout }
      });
      toast('Album setup saved');
    } catch (err) { toast(err.message); }
  };
}

async function refreshEvents() {
  state.events = await api('/api/events');
  renderEvents();
}

function selectMode(mode) {
  state.selectedMode = mode;
  document.getElementById('mode-self').classList.toggle('selected', mode === 'self');
  document.getElementById('mode-company').classList.toggle('selected', mode === 'assigned_to_company');
}

function renderLayouts() {
  const grid = document.getElementById('layout-grid');
  grid.innerHTML = state.layouts.map(l => `
    <div class="layout-card" data-id="${l.id}">
      <div class="layout-preview" style="grid-template-columns:repeat(${Math.min(l.cols,3)},1fr); background:${l.accent}22;">
        ${Array.from({ length: Math.min(l.cols * 2, 6) }).map(() => `<div class="swatch" style="background:${l.accent}55;"></div>`).join('')}
      </div>
      <h4>${escapeHtml(l.name)}</h4>
      <div class="tag-mini">${l.type === 'preset' ? 'Studio preset' : 'Custom template'}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.layout-card').forEach(card => {
    card.onclick = () => {
      state.selectedLayout = card.dataset.id;
      grid.querySelectorAll('.layout-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    };
  });
}

async function loadPhotos() {
  const photos = await api(`/api/events/${state.currentEvent.id}/photos`);
  const grid = document.getElementById('photo-grid');
  grid.innerHTML = photos.map(p => p.source === 'upload'
    ? `<div class="photo-thumb"><img src="${p.url}" /></div>`
    : `<div class="photo-thumb drive">📁 Drive link</div>`
  ).join('');
  const ev = state.events.find(e => e.id === state.currentEvent.id);
  if (ev) ev.photoCount = photos.length;
}

async function openEvent(id) {
  const ev = state.events.find(e => e.id === id);
  state.currentEvent = ev;
  state.selectedMode = ev.album ? ev.album.designMode : null;
  state.selectedLayout = ev.album ? ev.album.layoutId : null;

  document.getElementById('events-view').style.display = 'none';
  document.getElementById('event-detail-view').style.display = 'block';
  document.getElementById('detail-title').textContent = ev.eventType + ' album';
  document.getElementById('detail-sub').textContent = 'Created ' + new Date(ev.createdAt).toLocaleDateString();
  const statusEl = document.getElementById('detail-status');
  statusEl.textContent = statusLabel(ev.album ? ev.album.status : 'created');
  statusEl.className = 'status-tag status-' + (ev.album ? ev.album.status : 'created');

  renderLayouts();
  if (state.selectedMode) selectMode(state.selectedMode);
  if (state.selectedLayout) {
    const card = document.querySelector(`.layout-card[data-id="${state.selectedLayout}"]`);
    if (card) card.classList.add('selected');
  }
  await loadPhotos();
}

init();
