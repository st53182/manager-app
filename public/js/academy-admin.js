const api = async (path, opts = {}) => {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(path, {
    ...opts,
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
      ...opts.headers
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
};

function show(id) {
  ['gate', 'denied', 'app'].forEach((x) => {
    document.getElementById(x).classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
}

async function init() {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    show('gate');
    return;
  }

  try {
    await api('/api/admin/users?limit=1');
  } catch (e) {
    if (e.status === 403) show('denied');
    else show('gate');
    return;
  }

  show('app');
  await loadUsers();
  await loadChats();
  await loadUsageSummary();

  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  document.getElementById('usageEnd').valueAsDate = today;
  document.getElementById('usageStart').valueAsDate = monthAgo;

  document.getElementById('reloadChats').addEventListener('click', loadChats);
  document.getElementById('exportCsv').addEventListener('click', async (e) => {
    e.preventDefault();
    const s = document.getElementById('usageStart').value;
    const en = document.getElementById('usageEnd').value;
    const qs = new URLSearchParams();
    if (s) qs.set('start', new Date(s).toISOString());
    if (en) qs.set('end', new Date(en).toISOString());
    const auth = localStorage.getItem('auth_token');
    const res = await fetch(`/api/admin/usage/export?${qs}`, {
      headers: { Authorization: `Bearer ${auth}` }
    });
    if (!res.ok) {
      alert('Export failed');
      return;
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'usage-export.csv';
    a.click();
  });
}

async function loadUsers() {
  const { users } = await api('/api/admin/users?limit=200');
  const tbody = document.getElementById('userRows');
  tbody.innerHTML = '';
  for (const u of users) {
    const tr = document.createElement('tr');
    tr.className = 'border-t border-slate-800';
    const modelsStr = Array.isArray(u.ai_allowed_models)
      ? u.ai_allowed_models.join(', ')
      : typeof u.ai_allowed_models === 'string'
        ? u.ai_allowed_models
        : JSON.stringify(u.ai_allowed_models || []);
    tr.innerHTML = `
      <td class="px-3 py-2">${escape(u.email)}</td>
      <td class="px-3 py-2">${escape(u.role)}</td>
      <td class="px-3 py-2">${u.is_active ? 'да' : 'нет'}</td>
      <td class="px-3 py-2"><input data-k="ai_daily_token_limit" data-id="${u.id}" type="number" value="${u.ai_daily_token_limit ?? ''}" class="bg-slate-900 border border-slate-700 rounded w-28 px-2 py-1" /></td>
      <td class="px-3 py-2"><input data-k="ai_monthly_token_limit" data-id="${u.id}" type="number" value="${u.ai_monthly_token_limit ?? ''}" class="bg-slate-900 border border-slate-700 rounded w-28 px-2 py-1" /></td>
      <td class="px-3 py-2"><input data-k="ai_allowed_models" data-id="${u.id}" type="text" value="${escape(modelsStr)}" class="bg-slate-900 border border-slate-700 rounded w-48 px-2 py-1 text-xs" title="JSON array" /></td>
      <td class="px-3 py-2 whitespace-nowrap">
        <button type="button" data-save="${u.id}" class="text-indigo-400 hover:text-indigo-300 text-xs mr-2">Сохранить</button>
        <button type="button" data-toggle="${u.id}" class="text-slate-400 hover:text-white text-xs">${u.is_active ? 'Выкл' : 'Вкл'}</button>
      </td>`;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('[data-save]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-save');
      const row = btn.closest('tr');
      const daily = row.querySelector('[data-k="ai_daily_token_limit"]').value;
      const monthly = row.querySelector('[data-k="ai_monthly_token_limit"]').value;
      const modelsRaw = row.querySelector('[data-k="ai_allowed_models"]').value.trim();
      let models = ['openai/gpt-4o-mini'];
      try {
        models = JSON.parse(modelsRaw);
      } catch {
        models = modelsRaw.split(',').map((s) => s.trim()).filter(Boolean);
      }
      await api(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ai_daily_token_limit: parseInt(daily, 10),
          ai_monthly_token_limit: parseInt(monthly, 10),
          ai_allowed_models: models
        })
      });
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = 'Сохранить'; }, 1200);
    });
  });

  tbody.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-toggle');
      const row = btn.closest('tr');
      const activeCell = row.children[2];
      const currentlyActive = activeCell.textContent.trim() === 'да';
      await api(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !currentlyActive })
      });
      await loadUsers();
    });
  });
}

function escape(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

async function loadChats() {
  const uid = document.getElementById('filterUserId').value.trim();
  const q = uid ? `?userId=${encodeURIComponent(uid)}&limit=50` : '?limit=50';
  const { conversations } = await api(`/api/admin/conversations${q}`);
  const ul = document.getElementById('chatList');
  ul.innerHTML = '';
  for (const c of conversations) {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" class="text-left w-full hover:bg-slate-900 rounded-lg px-3 py-2 border border-slate-800" data-id="${c.id}">
      <span class="text-indigo-400">${escape(c.user_email)}</span>
      <span class="text-slate-500 text-xs ml-2">${c.id}</span>
      <div class="text-slate-300">${escape(c.title || 'Чат')}</div>
    </button>`;
    li.querySelector('button').addEventListener('click', () => viewChat(c.id));
    ul.appendChild(li);
  }
}

async function viewChat(id) {
  const data = await api(`/api/admin/conversations/${id}`);
  const text = data.messages.map((m) => `${m.role}: ${m.content}`).join('\n---\n');
  alert(text.slice(0, 8000) + (text.length > 8000 ? '\n…' : ''));
}

async function loadUsageSummary() {
  const { by_user } = await api('/api/admin/usage/summary');
  document.getElementById('usageSummary').textContent = JSON.stringify(by_user, null, 2);
}

init();
