async function api(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

async function apiUpload(url, formData) {
  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function statusLabel(status) {
  return ({
    created: 'Not started',
    in_progress: 'In progress',
    queued_for_studio: 'With studio',
    approved: 'Approved'
  })[status] || status;
}

async function requireRole(role) {
  const { user } = await api('/api/auth/me');
  if (!user) { window.location.href = '/index.html'; return null; }
  if (user.role !== role) {
    window.location.href = user.role === 'admin' ? '/admin.html' : '/client.html';
    return null;
  }
  return user;
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/index.html';
}
