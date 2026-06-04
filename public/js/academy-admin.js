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

let catalog = null;
let selectedCourseId = null;
let selectedLessonId = null;

function show(id) {
  ['gate', 'denied', 'app'].forEach((x) => {
    document.getElementById(x).classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
}

function escape(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function showContentStatus(msg, isError = false) {
  const el = document.getElementById('contentStatus');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('text-emerald-700', !isError);
  el.classList.toggle('text-red-600', isError);
  el.classList.remove('hidden');
  clearTimeout(showContentStatus._t);
  showContentStatus._t = setTimeout(() => el.classList.add('hidden'), 4000);
}

function parseJsonInput(raw, fallback, label) {
  const t = (raw || '').trim();
  if (!t) return fallback;
  try {
    return JSON.parse(t);
  } catch {
    throw new Error(`Некорректный JSON: ${label}`);
  }
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
  wireContentUi();
  wireChatModal();
  await loadUsers();
  await loadCatalog();
  await loadChats();
  await loadUsageSummary();

  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  document.getElementById('usageEnd').valueAsDate = today;
  document.getElementById('usageStart').valueAsDate = monthAgo;

  document.getElementById('reloadChats').addEventListener('click', loadChats);
  document.getElementById('reloadCatalog')?.addEventListener('click', loadCatalog);
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

function wireChatModal() {
  document.getElementById('chatModalClose')?.addEventListener('click', closeChatModal);
  document.getElementById('chatModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'chatModal') closeChatModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeChatModal();
  });
}

function closeChatModal() {
  document.getElementById('chatModal')?.classList.add('hidden');
}

function wireContentUi() {
  document.getElementById('newCourseBtn')?.addEventListener('click', () => {
    selectedCourseId = null;
    selectedLessonId = null;
    document.getElementById('contentEditor')?.classList.remove('hidden');
    document.getElementById('contentEditorHint')?.classList.add('hidden');
    document.getElementById('courseSlug').value = '';
    document.getElementById('courseTitle').value = '';
    document.getElementById('courseDescription').value = '';
    document.getElementById('courseSort').value = '0';
    document.getElementById('lessonEditor')?.classList.add('hidden');
    renderLessonList();
  });

  document.getElementById('saveCourseBtn')?.addEventListener('click', saveCourse);
  document.getElementById('deleteCourseBtn')?.addEventListener('click', deleteCourse);
  document.getElementById('newLessonBtn')?.addEventListener('click', () => {
    if (!selectedCourseId) return alert('Сначала сохраните или выберите курс');
    selectedLessonId = null;
    fillLessonForm({ title: '', content_md: '', scenario_key: '', sort_order: 0, assignment: null });
    document.getElementById('lessonEditor')?.classList.remove('hidden');
  });
  document.getElementById('saveLessonBtn')?.addEventListener('click', saveLesson);
  document.getElementById('deleteLessonBtn')?.addEventListener('click', deleteLesson);
  document.getElementById('saveAssignmentBtn')?.addEventListener('click', saveAssignment);
  document.getElementById('deleteAssignmentBtn')?.addEventListener('click', deleteAssignment);
}

async function loadCatalog() {
  catalog = await api('/api/admin/catalog');
  renderCourseList();
}

function renderCourseList() {
  const ul = document.getElementById('courseList');
  const empty = document.getElementById('courseListEmpty');
  if (!ul) return;
  ul.innerHTML = '';
  const courses = catalog?.courses || [];
  if (!courses.length) {
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');
  for (const c of courses) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'w-full text-left px-3 py-2 rounded-lg border ' +
      (c.id === selectedCourseId
        ? 'border-indigo-400 bg-indigo-50'
        : 'border-slate-200/40 hover:bg-black/10');
    btn.innerHTML = `<span class="font-medium">${escape(c.title)}</span><span class="block text-xs text-slate-500">${escape(c.slug)}</span>`;
    btn.addEventListener('click', () => selectCourse(c.id));
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

function selectCourse(courseId) {
  selectedCourseId = courseId;
  selectedLessonId = null;
  const c = catalog.courses.find((x) => x.id === courseId);
  if (!c) return;
  document.getElementById('contentEditor')?.classList.remove('hidden');
  document.getElementById('contentEditorHint')?.classList.add('hidden');
  document.getElementById('courseSlug').value = c.slug || '';
  document.getElementById('courseTitle').value = c.title || '';
  document.getElementById('courseDescription').value = c.description || '';
  document.getElementById('courseSort').value = String(c.sort_order ?? 0);
  document.getElementById('lessonEditor')?.classList.add('hidden');
  renderCourseList();
  renderLessonList();
}

function renderLessonList() {
  const ul = document.getElementById('lessonList');
  if (!ul) return;
  ul.innerHTML = '';
  if (!selectedCourseId) return;
  const lessons = (catalog?.lessons || []).filter((l) => l.course_id === selectedCourseId);
  for (const l of lessons) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'w-full text-left px-2 py-1.5 rounded ' +
      (l.id === selectedLessonId ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-slate-100');
    btn.textContent = l.title;
    btn.addEventListener('click', () => selectLesson(l.id));
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

function selectLesson(lessonId) {
  selectedLessonId = lessonId;
  const l = catalog.lessons.find((x) => x.id === lessonId);
  if (!l) return;
  fillLessonForm(l);
  document.getElementById('lessonEditor')?.classList.remove('hidden');
  renderLessonList();
}

function fillLessonForm(lesson) {
  document.getElementById('lessonTitle').value = lesson.title || '';
  document.getElementById('lessonScenario').value = lesson.scenario_key || '';
  document.getElementById('lessonSort').value = String(lesson.sort_order ?? 0);
  document.getElementById('lessonContent').value = lesson.content_md || '';
  const a = lesson.assignment;
  document.getElementById('assignTitle').value = a?.title || '';
  document.getElementById('assignInstructions').value = a?.instructions_md || '';
  document.getElementById('assignRubric').value = a?.rubric_json
    ? JSON.stringify(a.rubric_json, null, 2)
    : '';
  document.getElementById('assignTaskOptions').value = a?.task_options
    ? JSON.stringify(a.task_options, null, 2)
    : '';
}

async function saveCourse() {
  try {
    const body = {
      slug: document.getElementById('courseSlug').value.trim(),
      title: document.getElementById('courseTitle').value.trim(),
      description: document.getElementById('courseDescription').value.trim(),
      sort_order: parseInt(document.getElementById('courseSort').value, 10) || 0
    };
    if (!body.slug || !body.title) return alert('Укажите slug и название курса');
    if (selectedCourseId) {
      await api(`/api/admin/courses/${selectedCourseId}`, { method: 'PATCH', body: JSON.stringify(body) });
      showContentStatus('Курс обновлён');
    } else {
      const { course } = await api('/api/admin/courses', { method: 'POST', body: JSON.stringify(body) });
      selectedCourseId = course.id;
      showContentStatus('Курс создан');
    }
    await loadCatalog();
    if (selectedCourseId) selectCourse(selectedCourseId);
  } catch (e) {
    showContentStatus(e.message, true);
  }
}

async function deleteCourse() {
  if (!selectedCourseId) return;
  if (!confirm('Удалить курс и все уроки? Это необратимо.')) return;
  try {
    await api(`/api/admin/courses/${selectedCourseId}`, { method: 'DELETE' });
    selectedCourseId = null;
    selectedLessonId = null;
    document.getElementById('contentEditor')?.classList.add('hidden');
    document.getElementById('contentEditorHint')?.classList.remove('hidden');
    await loadCatalog();
    showContentStatus('Курс удалён');
  } catch (e) {
    showContentStatus(e.message, true);
  }
}

async function saveLesson() {
  if (!selectedCourseId) return alert('Выберите курс');
  try {
    const body = {
      title: document.getElementById('lessonTitle').value.trim(),
      content_md: document.getElementById('lessonContent').value,
      scenario_key: document.getElementById('lessonScenario').value.trim() || null,
      sort_order: parseInt(document.getElementById('lessonSort').value, 10) || 0
    };
    if (!body.title) return alert('Укажите название урока');
    if (selectedLessonId) {
      await api(`/api/admin/lessons/${selectedLessonId}`, { method: 'PATCH', body: JSON.stringify(body) });
      showContentStatus('Урок обновлён');
    } else {
      const { lesson } = await api(`/api/admin/courses/${selectedCourseId}/lessons`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      selectedLessonId = lesson.id;
      showContentStatus('Урок создан');
    }
    await loadCatalog();
    selectCourse(selectedCourseId);
    if (selectedLessonId) selectLesson(selectedLessonId);
  } catch (e) {
    showContentStatus(e.message, true);
  }
}

async function deleteLesson() {
  if (!selectedLessonId) return;
  if (!confirm('Удалить урок и связанное задание?')) return;
  try {
    await api(`/api/admin/lessons/${selectedLessonId}`, { method: 'DELETE' });
    selectedLessonId = null;
    document.getElementById('lessonEditor')?.classList.add('hidden');
    await loadCatalog();
    selectCourse(selectedCourseId);
    showContentStatus('Урок удалён');
  } catch (e) {
    showContentStatus(e.message, true);
  }
}

async function saveAssignment() {
  if (!selectedLessonId) return alert('Выберите или сохраните урок');
  try {
    const rubric_json = parseJsonInput(document.getElementById('assignRubric').value, {}, 'rubric_json');
    const task_options = parseJsonInput(document.getElementById('assignTaskOptions').value, [], 'task_options');
    const body = {
      title: document.getElementById('assignTitle').value.trim(),
      instructions_md: document.getElementById('assignInstructions').value,
      rubric_json,
      task_options
    };
    if (!body.title) return alert('Укажите заголовок задания');
    await api(`/api/admin/lessons/${selectedLessonId}/assignment`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    showContentStatus('Задание сохранено');
    await loadCatalog();
    selectCourse(selectedCourseId);
    selectLesson(selectedLessonId);
  } catch (e) {
    showContentStatus(e.message, true);
  }
}

async function deleteAssignment() {
  if (!selectedLessonId) return;
  if (!confirm('Удалить задание у урока?')) return;
  try {
    await api(`/api/admin/lessons/${selectedLessonId}/assignment`, { method: 'DELETE' });
    showContentStatus('Задание удалено');
    await loadCatalog();
    selectLesson(selectedLessonId);
  } catch (e) {
    showContentStatus(e.message, true);
  }
}

async function loadUsers() {
  const { users } = await api('/api/admin/users?limit=200');
  const tbody = document.getElementById('userRows');
  tbody.innerHTML = '';
  for (const u of users) {
    const tr = document.createElement('tr');
    tr.className = 'border-t border-slate-200/30';
    const modelsStr = Array.isArray(u.ai_allowed_models)
      ? u.ai_allowed_models.join(', ')
      : typeof u.ai_allowed_models === 'string'
        ? u.ai_allowed_models
        : JSON.stringify(u.ai_allowed_models || []);
    tr.innerHTML = `
      <td class="px-3 py-2">${escape(u.email)}</td>
      <td class="px-3 py-2">${escape(u.role)}</td>
      <td class="px-3 py-2">${u.is_active ? 'да' : 'нет'}</td>
      <td class="px-3 py-2"><input data-k="ai_daily_token_limit" data-id="${u.id}" type="number" value="${u.ai_daily_token_limit ?? ''}" class="modern-input w-28 px-2 py-1" /></td>
      <td class="px-3 py-2"><input data-k="ai_monthly_token_limit" data-id="${u.id}" type="number" value="${u.ai_monthly_token_limit ?? ''}" class="modern-input w-28 px-2 py-1" /></td>
      <td class="px-3 py-2"><input data-k="ai_allowed_models" data-id="${u.id}" type="text" value="${escape(modelsStr)}" class="modern-input w-48 px-2 py-1 text-xs" title="JSON array" /></td>
      <td class="px-3 py-2 whitespace-nowrap">
        <button type="button" data-save="${u.id}" class="modern-btn modern-btn-secondary text-xs mr-2">Сохранить</button>
        <button type="button" data-toggle="${u.id}" class="modern-btn modern-btn-secondary text-xs">${u.is_active ? 'Выкл' : 'Вкл'}</button>
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
      setTimeout(() => {
        btn.textContent = 'Сохранить';
      }, 1200);
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

async function loadChats() {
  const uid = document.getElementById('filterUserId').value.trim();
  const q = uid ? `?userId=${encodeURIComponent(uid)}&limit=50` : '?limit=50';
  const { conversations } = await api(`/api/admin/conversations${q}`);
  const ul = document.getElementById('chatList');
  ul.innerHTML = '';
  if (!conversations.length) {
    ul.innerHTML = '<li class="text-xs text-slate-500 px-2">Диалогов не найдено.</li>';
    return;
  }
  for (const c of conversations) {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" class="text-left w-full rounded-lg px-3 py-2 border border-slate-200/40 bg-black/20 hover:bg-black/30" data-id="${c.id}">
      <span class="text-indigo-300">${escape(c.user_email)}</span>
      <span class="text-slate-400 text-xs ml-2">${escape(c.id)}</span>
      <div class="text-slate-200">${escape(c.title || 'Чат')}</div>
      <div class="text-xs text-slate-500">${c.updated_at ? new Date(c.updated_at).toLocaleString() : ''}</div>
    </button>`;
    li.querySelector('button').addEventListener('click', () => viewChat(c.id));
    ul.appendChild(li);
  }
}

async function viewChat(id) {
  const modal = document.getElementById('chatModal');
  const box = document.getElementById('chatModalMessages');
  const loading = document.getElementById('chatModalLoading');
  const errEl = document.getElementById('chatModalError');
  modal?.classList.remove('hidden');
  box.innerHTML = '';
  errEl?.classList.add('hidden');
  loading?.classList.remove('hidden');

  try {
    const data = await api(`/api/admin/conversations/${id}`);
    loading?.classList.add('hidden');
    const conv = data.conversation;
    document.getElementById('chatModalTitle').textContent = conv.title || 'Диалог';
    document.getElementById('chatModalMeta').textContent = `${conv.user_email || ''} · ${conv.id}${conv.lesson_id ? ' · урок ' + conv.lesson_id : ''}`;

    if (!data.messages?.length) {
      box.innerHTML = '<p class="text-slate-500">Сообщений нет.</p>';
      return;
    }

    for (const m of data.messages) {
      const wrap = document.createElement('div');
      wrap.className = m.role === 'user' ? 'text-right' : 'text-left';
      const bubble = document.createElement('div');
      bubble.className =
        'inline-block max-w-[95%] rounded-xl px-3 py-2 text-left whitespace-pre-wrap break-words ' +
        (m.role === 'user'
          ? 'bg-indigo-600 text-white'
          : m.role === 'assistant'
            ? 'bg-white border border-slate-200 text-slate-900'
            : 'bg-slate-100 text-slate-700');
      const head = document.createElement('div');
      head.className = 'text-xs font-semibold opacity-80 mb-1';
      head.textContent = m.role;
      bubble.appendChild(head);
      const body = document.createElement('div');
      body.textContent = m.content || '';
      bubble.appendChild(body);
      if (m.created_at) {
        const ts = document.createElement('div');
        ts.className = 'text-[10px] opacity-60 mt-1';
        ts.textContent = new Date(m.created_at).toLocaleString();
        bubble.appendChild(ts);
      }
      wrap.appendChild(bubble);
      box.appendChild(wrap);
    }
    box.scrollTop = box.scrollHeight;
  } catch (e) {
    loading?.classList.add('hidden');
    errEl.textContent = e.message || 'Не удалось загрузить диалог';
    errEl?.classList.remove('hidden');
  }
}

async function loadUsageSummary() {
  const { by_user } = await api('/api/admin/usage/summary');
  document.getElementById('usageSummary').textContent = JSON.stringify(by_user, null, 2);
}

init();
