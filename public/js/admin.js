let state = { user: null, albums: [], clients: [], types: [], layouts: [] };

async function init() {
  state.user = await requireRole('admin');
  if (!state.user) return;
  document.getElementById('who').textContent = state.user.name;

  bindTabs();
  bindModals();
  await Promise.all([loadAlbums(), loadClients(), loadTypes(), loadLayouts()]);
}

function bindTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
      document.getElementById('panel-' + tab.dataset.tab).style.display = 'block';
    };
  });
}

// ---------------- ALBUMS ----------------
async function loadAlbums() {
  state.albums = await api('/api/admin/albums');
  const container = document.getElementById('albums-container');
  if (state.albums.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>No albums yet</h3><p>Albums appear here once a client creates one.</p></div>`;
    return;
  }
  container.innerHTML = `<div class="card"><table>
    <thead><tr><th>Client</th><th>Event type</th><th>Layout</th><th>Design mode</th><th>Status</th><th></th></tr></thead>
    <tbody>
      ${state.albums.map(a => `
        <tr>
          <td>${escapeHtml(a.clientName)}</td>
          <td>${escapeHtml(a.eventType)}</td>
          <td>${escapeHtml(a.layoutName)}</td>
          <td>
            <select class="mode-select" data-id="${a.id}" style="font-size:12.5px; padding:5px 8px; border-radius:6px; border:1px solid var(--line);">
              <option value="self" ${a.designMode === 'self' ? 'selected' : ''}>Client self-design</option>
              <option value="assigned_to_company" ${a.designMode === 'assigned_to_company' ? 'selected' : ''}>Studio design</option>
            </select>
          </td>
          <td><span class="status-tag status-${a.status}">${statusLabel(a.status)}</span></td>
          <td>${a.status !== 'approved' ? `<button class="btn btn-sm btn-secondary approve-btn" data-id="${a.id}">Approve</button>` : ''}</td>
        </tr>
      `).join('')}
    </tbody>
  </table></div>`;

  container.querySelectorAll('.mode-select').forEach(sel => {
    sel.onchange = async () => {
      await api(`/api/admin/albums/${sel.dataset.id}/assign`, { method: 'POST', body: { designMode: sel.value } });
      toast('Design mode updated');
      loadAlbums();
    };
  });
  container.querySelectorAll('.approve-btn').forEach(btn => {
    btn.onclick = async () => {
      await api(`/api/admin/albums/${btn.dataset.id}/approve`, { method: 'POST' });
      toast('Album approved');
      loadAlbums();
    };
  });
}

// ---------------- CLIENTS ----------------
async function loadClients() {
  state.clients = await api('/api/admin/clients');
  const el = document.getElementById('clients-table');
  if (state.clients.length === 0) {
    el.innerHTML = `<div class="empty-state"><h3>No clients yet</h3><p>Create a login, or wait for a client to sign in with Google.</p></div>`;
    return;
  }
  el.innerHTML = `<table>
    <thead><tr><th>Name</th><th>Email</th><th>Login method</th><th></th></tr></thead>
    <tbody>
      ${state.clients.map(c => `
        <tr>
          <td>${escapeHtml(c.name)}</td>
          <td>${escapeHtml(c.email)}</td>
          <td><span class="tag-mini" style="font-family:var(--font-mono); font-size:10px; text-transform:uppercase; color:var(--muted);">${c.authProvider === 'google' ? 'Google' : 'Admin-created'}</span></td>
          <td><button class="btn btn-sm btn-danger del-client" data-id="${c.id}">Remove</button></td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
  el.querySelectorAll('.del-client').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Remove this client account?')) return;
      await api(`/api/admin/clients/${btn.dataset.id}`, { method: 'DELETE' });
      toast('Client removed');
      loadClients();
    };
  });
}

// ---------------- EVENT TYPES ----------------
async function loadTypes() {
  state.types = await api('/api/event-types');
  const el = document.getElementById('types-list');
  el.innerHTML = state.types.map(t => `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:9px 0; border-bottom:1px solid var(--line);">
      <span>${escapeHtml(t.name)}</span>
      <button class="btn btn-sm btn-danger del-type" data-id="${t.id}">Remove</button>
    </div>
  `).join('');
  el.querySelectorAll('.del-type').forEach(btn => {
    btn.onclick = async () => {
      await api(`/api/admin/event-types/${btn.dataset.id}`, { method: 'DELETE' });
      toast('Event type removed');
      loadTypes();
    };
  });
}

// ---------------- LAYOUTS ----------------
async function loadLayouts() {
  state.layouts = await api('/api/layouts');
  const el = document.getElementById('layouts-container');
  el.innerHTML = state.layouts.map(l => `
    <div class="layout-card">
      <div class="layout-preview" style="grid-template-columns:repeat(${Math.min(l.cols,3)},1fr); background:${l.accent}22;">
        ${l.thumbnailUrl
          ? `<img src="${l.thumbnailUrl}" style="grid-column:1/-1; width:100%; height:100%; object-fit:cover; border-radius:4px;" />`
          : Array.from({ length: Math.min(l.cols * 2, 6) }).map(() => `<div class="swatch" style="background:${l.accent}55;"></div>`).join('')}
      </div>
      <h4>${escapeHtml(l.name)}</h4>
      <div class="tag-mini">${l.type === 'preset' ? 'Studio preset' : 'Custom · ' + escapeHtml(l.createdBy)}</div>
      ${l.type !== 'preset' ? `<button class="btn btn-sm btn-danger del-layout" data-id="${l.id}" style="margin-top:8px; width:100%;">Remove</button>` : ''}
    </div>
  `).join('');
  el.querySelectorAll('.del-layout').forEach(btn => {
    btn.onclick = async () => {
      await api(`/api/admin/layouts/${btn.dataset.id}`, { method: 'DELETE' });
      toast('Layout removed');
      loadLayouts();
    };
  });
}

// ---------------- MODALS ----------------
function bindModals() {
  const clientOverlay = document.getElementById('new-client-overlay');
  document.getElementById('new-client-btn').onclick = () => clientOverlay.style.display = 'flex';
  document.getElementById('nc-cancel').onclick = () => clientOverlay.style.display = 'none';
  document.getElementById('nc-create').onclick = async () => {
    const name = document.getElementById('nc-name').value;
    const email = document.getElementById('nc-email').value;
    const password = document.getElementById('nc-password').value;
    try {
      await api('/api/admin/clients', { method: 'POST', body: { name, email, password } });
      clientOverlay.style.display = 'none';
      document.getElementById('nc-name').value = '';
      document.getElementById('nc-email').value = '';
      document.getElementById('nc-password').value = '';
      toast('Client login created');
      loadClients();
    } catch (err) {
      document.getElementById('client-error').innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  };

  document.getElementById('add-type-btn').onclick = async () => {
    const input = document.getElementById('new-type-input');
    if (!input.value.trim()) return;
    await api('/api/admin/event-types', { method: 'POST', body: { name: input.value.trim() } });
    input.value = '';
    toast('Event type added');
    loadTypes();
  };

  const layoutOverlay = document.getElementById('new-layout-overlay');
  document.getElementById('new-layout-btn').onclick = () => layoutOverlay.style.display = 'flex';
  document.getElementById('nl-cancel').onclick = () => layoutOverlay.style.display = 'none';
  document.getElementById('nl-create').onclick = async () => {
    const name = document.getElementById('nl-name').value;
    if (!name.trim()) return toast('Give the template a name');
    const fd = new FormData();
    fd.append('name', name);
    fd.append('cols', document.getElementById('nl-cols').value);
    fd.append('accent', document.getElementById('nl-accent').value);
    const file = document.getElementById('nl-thumb').files[0];
    if (file) fd.append('thumbnail', file);
    await apiUpload('/api/admin/layouts', fd);
    layoutOverlay.style.display = 'none';
    document.getElementById('nl-name').value = '';
    toast('Layout uploaded');
    loadLayouts();
  };
}

init();
