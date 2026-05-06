const apiBase = '';

function getToken() {
  return localStorage.getItem('auth_token');
}

function getAuthHeaders() {
  const token = getToken();
  return {
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json'
  };
}

async function api(path, opts = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    ...opts,
    headers: { ...getAuthHeaders(), ...opts.headers }
  });
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const err = new Error(body.error || body.message || res.statusText || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return body;
}

function configureMarked() {
  if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') return;
  marked.setOptions({
    gfm: true,
    breaks: true,
    highlight(code, lang) {
      if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value;
        } catch (_) {}
      }
      if (typeof hljs !== 'undefined') {
        try {
          return hljs.highlightAuto(code).value;
        } catch (_) {}
      }
      return code;
    }
  });
}

function renderMarkdown(text) {
  const raw = marked.parse(text || '');
  return DOMPurify.sanitize(raw, { ADD_ATTR: ['target'] });
}

const state = {
  catalog: null,
  conversations: [],
  currentConversationId: null,
  currentLessonId: null,
  usage: null,
  streaming: false,
  selectedModel: null,
  lastFailedPayload: null
};

function showGate() {
  document.getElementById('authGate').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp() {
  document.getElementById('authGate').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

function parseUser() {
  try {
    return JSON.parse(localStorage.getItem('user_info') || '{}');
  } catch {
    return {};
  }
}

async function init() {
  configureMarked();
  if (!getToken()) {
    showGate();
    return;
  }

  const user = parseUser();
  document.getElementById('userEmail').textContent = user.email || '';

  if (user.role === 'admin') {
    document.getElementById('adminLink').classList.remove('hidden');
  }

  try {
    state.catalog = await api('/api/academy/catalog');
    state.usage = await api('/api/academy/usage');
    state.conversations = (await api('/api/academy/conversations')).conversations;
    renderUsage();
    renderCourseTree();
    renderConversationList();
    populateModels();
    updateModelHint();
    showApp();
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_info');
      showGate();
      return;
    }
    alert(e.message || 'Ошибка загрузки');
  }

  wireUi();
}

function renderUsage() {
  const u = state.usage;
  if (!u) return;
  const d = u.daily;
  const dayPct = Math.min(100, Math.round((d.used_tokens / d.limit_tokens) * 100));
  document.getElementById('usageBadge').textContent = `День: ${dayPct}% · ${d.used_tokens}/${d.limit_tokens} tok`;
}

function renderCourseTree() {
  const root = document.getElementById('courseTree');
  root.innerHTML = '';
  const byCourse = {};
  for (const l of state.catalog.lessons) {
    if (!byCourse[l.course_id]) byCourse[l.course_id] = [];
    byCourse[l.course_id].push(l);
  }
  for (const c of state.catalog.courses) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="font-medium text-slate-300 mb-1">${escapeHtml(c.title)}</div>`;
    const ul = document.createElement('ul');
    ul.className = 'space-y-0.5 ml-1 border-l border-slate-800 pl-2';
    for (const l of byCourse[c.id] || []) {
      const li = document.createElement('li');
      const prog = state.catalog.progress[l.id];
      const check = prog?.status === 'completed' ? '✓ ' : '';
      li.innerHTML = `<button type="button" class="text-left w-full hover:text-indigo-400 py-0.5 truncate text-slate-400" data-lesson="${l.id}">${check}${escapeHtml(l.title)}</button>`;
      li.querySelector('button').addEventListener('click', () => selectLesson(l));
      ul.appendChild(li);
    }
    wrap.appendChild(ul);
    root.appendChild(wrap);
  }
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderConversationList() {
  const ul = document.getElementById('conversationList');
  ul.innerHTML = '';
  for (const c of state.conversations) {
    const li = document.createElement('li');
    li.className = 'flex items-center gap-0.5 rounded hover:bg-slate-800/40';

    const sel = document.createElement('button');
    sel.type = 'button';
    sel.className = `flex-1 min-w-0 text-left truncate py-1 px-2 rounded text-sm ${
      c.id === state.currentConversationId ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
    }`;
    sel.textContent = c.title || 'Чат';
    sel.addEventListener('click', () => loadConversation(c.id));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className =
      'shrink-0 w-8 py-1 text-center text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded text-xl leading-none';
    delBtn.title = 'Удалить диалог';
    delBtn.setAttribute('aria-label', 'Удалить диалог');
    delBtn.textContent = '×';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConversationById(c.id);
    });

    li.appendChild(sel);
    li.appendChild(delBtn);
    ul.appendChild(li);
  }
}

async function deleteConversationById(id) {
  if (!confirm('Удалить этот диалог? Восстановить будет нельзя.')) return;
  try {
    await api(`/api/academy/conversations/${id}`, { method: 'DELETE' });
    state.conversations = state.conversations.filter((x) => x.id !== id);
    if (state.currentConversationId === id) {
      state.currentConversationId = null;
      document.getElementById('messagesContainer').innerHTML = '';
      document.getElementById('conversationTitle').value = '';
      document.getElementById('lessonHint').textContent = '';
      const next = state.conversations[0];
      if (next) {
        await loadConversation(next.id);
      } else {
        updateModelHint();
      }
    }
    renderConversationList();
  } catch (e) {
    alert(e.message || 'Не удалось удалить диалог');
  }
}

function populateModels() {
  const sel = document.getElementById('modelSelect');
  sel.innerHTML = '';
  const models = state.usage?.allowed_models || ['openai/gpt-4o-mini'];
  const catalog = state.usage?.model_catalog || [];
  const def = state.usage?.default_model || models[0];
  for (const id of models) {
    const o = document.createElement('option');
    o.value = id;
    const hint = catalog.find((c) => c.id === id);
    o.textContent = hint ? hint.label : id.split('/').pop();
    o.title = hint ? `${id} — ${hint.hint || ''}` : id;
    if (id === def) o.selected = true;
    sel.appendChild(o);
  }
  state.selectedModel = sel.value;
}

function updateModelHint() {
  const sel = document.getElementById('modelSelect');
  const hintEl = document.getElementById('modelHint');
  if (!hintEl || !sel) return;
  const catalog = state.usage?.model_catalog || [];
  const item = catalog.find((c) => c.id === sel.value);
  hintEl.textContent = item ? `${item.label} — ${item.hint || ''}` : '';
}

function parseMsgMeta(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function selectLesson(lesson) {
  state.currentLessonId = lesson.id;
  document.getElementById('lessonEmpty').classList.add('hidden');
  document.getElementById('lessonContent').classList.remove('hidden');
  document.getElementById('lessonContent').innerHTML = renderMarkdown(lesson.content_md || '');
  document.getElementById('lessonHint').textContent = `${lesson.course_title || ''} · ${lesson.title}`;
  const asn = lesson.assignment;
  if (asn) {
    document.getElementById('assignmentBlock').classList.remove('hidden');
    document.getElementById('assignmentText').textContent = asn.instructions_md || '';
  } else {
    document.getElementById('assignmentBlock').classList.add('hidden');
  }

  const conv = await api('/api/academy/conversations', {
    method: 'POST',
    body: JSON.stringify({
      lessonId: lesson.id,
      courseId: lesson.course_id,
      title: lesson.title,
      model: document.getElementById('modelSelect').value
    })
  });
  state.conversations.unshift(conv);
  state.currentConversationId = conv.id;
  renderConversationList();
  await loadConversation(conv.id, { skipFetchList: true });
}

async function loadConversation(id, opts = {}) {
  state.currentConversationId = id;
  const data = await api(`/api/academy/conversations/${id}`);
  document.getElementById('conversationTitle').value = data.conversation.title || '';
  document.getElementById('modelSelect').value = data.conversation.model || state.selectedModel;
  state.selectedModel = document.getElementById('modelSelect').value;
  updateModelHint();
  if (data.conversation.lesson_id) {
    const lesson = state.catalog.lessons.find((l) => l.id === data.conversation.lesson_id);
    if (lesson) {
      document.getElementById('lessonHint').textContent = `${lesson.course_title} · ${lesson.title}`;
    }
  }
  renderMessages(data.messages || []);
  if (!opts.skipFetchList) {
    renderConversationList();
  }
}

function renderMessages(messages) {
  const box = document.getElementById('messagesContainer');
  box.innerHTML = '';
  for (const m of messages) {
    box.appendChild(renderMessageEl(m));
  }
  box.scrollTop = box.scrollHeight;
}

function renderMessageEl(m) {
  const wrap = document.createElement('div');
  wrap.className = `flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`;
  const bubble = document.createElement('div');
  bubble.className = `max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-100'}`;
  if (m.role === 'assistant') {
    bubble.innerHTML = renderMarkdown(m.content);
    bubble.querySelectorAll('pre code').forEach((block) => {
      if (typeof hljs !== 'undefined') hljs.highlightElement(block);
    });
  } else {
    bubble.textContent = '';
    const meta = parseMsgMeta(m.meta);
    if (meta.files?.length) {
      const att = document.createElement('div');
      att.className = 'text-xs opacity-90 mb-1';
      att.textContent = `📎 ${meta.files.map((f) => f.name || f.stored).join(', ')}`;
      bubble.appendChild(att);
    }
    const textDiv = document.createElement('div');
    textDiv.className = 'whitespace-pre-wrap';
    textDiv.textContent = m.content || '';
    bubble.appendChild(textDiv);
  }
  const actions = document.createElement('div');
  actions.className = 'flex gap-2 mt-1 text-xs text-slate-500';
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'hover:text-white';
  copyBtn.textContent = 'Копировать';
  copyBtn.addEventListener('click', () => navigator.clipboard.writeText(m.content));
  actions.appendChild(copyBtn);
  const inner = document.createElement('div');
  inner.appendChild(bubble);
  inner.appendChild(actions);
  wrap.appendChild(inner);
  return wrap;
}

function appendStreamingBubble() {
  const box = document.getElementById('messagesContainer');
  const wrap = document.createElement('div');
  wrap.className = 'flex justify-start';
  wrap.id = 'streamingBubble';
  const bubble = document.createElement('div');
  bubble.className = 'max-w-[85%] rounded-2xl px-4 py-2 text-sm bg-slate-800 text-slate-100';
  bubble.innerHTML = '';
  wrap.appendChild(bubble);
  box.appendChild(wrap);
  return bubble;
}

async function streamChat(payload) {
  state.lastFailedPayload = payload;
  document.getElementById('composerError').classList.add('hidden');
  document.getElementById('retryBtn').classList.add('hidden');
  document.getElementById('typingRow').classList.add('hidden');
  state.streaming = true;
  setComposerBusy(true);

  const fileInput = document.getElementById('fileInput');
  const fileCount = fileInput?.files?.length || 0;
  const useMultipart = fileCount > 0 && !payload.regenerate;

  let fetchOpts;
  if (useMultipart) {
    const fd = new FormData();
    fd.append('message', payload.message || '');
    fd.append('model', payload.model || '');
    if (payload.conversationId) fd.append('conversationId', payload.conversationId);
    if (payload.lessonId) fd.append('lessonId', payload.lessonId);
    if (payload.courseId) fd.append('courseId', payload.courseId);
    if (payload.regenerate) fd.append('regenerate', 'true');
    for (let i = 0; i < fileInput.files.length; i++) {
      fd.append('files', fileInput.files[i]);
    }
    const token = getToken();
    fetchOpts = {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd
    };
  } else {
    fetchOpts = {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    };
  }

  const res = await fetch(`${apiBase}/api/academy/chat`, fetchOpts);

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    state.streaming = false;
    setComposerBusy(false);
    document.getElementById('composerError').textContent = errBody.error || res.statusText;
    document.getElementById('composerError').classList.remove('hidden');
    document.getElementById('retryBtn').classList.remove('hidden');
    throw new Error(errBody.error);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let bubble = null;
  let assembled = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const chunks = buf.split('\n\n');
    buf = chunks.pop() || '';
    for (const block of chunks) {
      const line = block.trim();
      if (!line.startsWith('data:')) continue;
      const json = JSON.parse(line.slice(5).trim());
      if (json.type === 'start') {
        if (json.conversationId) {
          state.currentConversationId = json.conversationId;
        }
        bubble = appendStreamingBubble();
      }
      if (json.type === 'chunk' && bubble) {
        assembled += json.text || '';
        bubble.innerHTML = renderMarkdown(assembled);
        bubble.querySelectorAll('pre code').forEach((block) => {
          if (typeof hljs !== 'undefined') hljs.highlightElement(block);
        });
        const box = document.getElementById('messagesContainer');
        box.scrollTop = box.scrollHeight;
      }
      if (json.type === 'done') {
        state.usage = await api('/api/academy/usage').catch(() => state.usage);
        renderUsage();
      }
      if (json.type === 'error') {
        document.getElementById('composerError').textContent = json.error || 'Ошибка';
        document.getElementById('composerError').classList.remove('hidden');
        document.getElementById('retryBtn').classList.remove('hidden');
      }
    }
  }

  document.getElementById('streamingBubble')?.remove();
  state.streaming = false;
  setComposerBusy(false);
  if (fileInput) {
    fileInput.value = '';
    const hint = document.getElementById('fileListHint');
    if (hint) hint.textContent = '';
  }

  if (state.currentConversationId) {
    const data = await api(`/api/academy/conversations/${state.currentConversationId}`);
    renderMessages(data.messages || []);
    state.conversations = (await api('/api/academy/conversations')).conversations;
    renderConversationList();
  }
}

function setComposerBusy(busy) {
  document.getElementById('sendBtn').disabled = busy;
  document.getElementById('composer').disabled = busy;
  const fi = document.getElementById('fileInput');
  if (fi) fi.disabled = busy;
}

function wireUi() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    window.location.href = '/login';
  });

  document.getElementById('newChatBtn').addEventListener('click', async () => {
    state.currentLessonId = null;
    const conv = await api('/api/academy/conversations', {
      method: 'POST',
      body: JSON.stringify({
        title: 'New chat',
        model: document.getElementById('modelSelect').value
      })
    });
    state.conversations.unshift(conv);
    state.currentConversationId = conv.id;
    renderConversationList();
    document.getElementById('messagesContainer').innerHTML = '';
    document.getElementById('conversationTitle').value = '';
    document.getElementById('lessonHint').textContent = '';
    document.getElementById('lessonEmpty').classList.remove('hidden');
    document.getElementById('lessonContent').classList.add('hidden');
    document.getElementById('assignmentBlock').classList.add('hidden');
  });

  document.getElementById('sendBtn').addEventListener('click', sendHandler);

  document.getElementById('composer').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendHandler();
    }
  });

  document.getElementById('modelSelect').addEventListener('change', () => {
    state.selectedModel = document.getElementById('modelSelect').value;
    updateModelHint();
  });

  const fileInputEl = document.getElementById('fileInput');
  const fileHintEl = document.getElementById('fileListHint');
  if (fileInputEl && fileHintEl) {
    fileInputEl.addEventListener('change', () => {
      const files = fileInputEl.files;
      if (!files?.length) {
        fileHintEl.textContent = '';
        return;
      }
      fileHintEl.textContent = Array.from(files)
        .map((f) => `${f.name} (${Math.round(f.size / 1024)} KB)`)
        .join(', ');
    });
  }

  document.getElementById('conversationTitle').addEventListener('change', async () => {
    if (!state.currentConversationId) return;
    await api(`/api/academy/conversations/${state.currentConversationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: document.getElementById('conversationTitle').value })
    });
    state.conversations = (await api('/api/academy/conversations')).conversations;
    renderConversationList();
  });

  document.getElementById('regenerateBtn').addEventListener('click', async () => {
    if (!state.currentConversationId || state.streaming) return;
    document.getElementById('typingRow').classList.remove('hidden');
    await streamChat({
      conversationId: state.currentConversationId,
      regenerate: true,
      model: document.getElementById('modelSelect').value
    }).catch(() => {});
    document.getElementById('typingRow').classList.add('hidden');
  });

  document.getElementById('retryBtn').addEventListener('click', async () => {
    if (!state.lastFailedPayload || state.streaming) return;
    document.getElementById('typingRow').classList.remove('hidden');
    await streamChat(state.lastFailedPayload).catch(() => {});
    document.getElementById('typingRow').classList.add('hidden');
  });

  document.getElementById('markDoneBtn').addEventListener('click', async () => {
    if (!state.currentLessonId) return;
    await api('/api/academy/progress', {
      method: 'POST',
      body: JSON.stringify({ lessonId: state.currentLessonId, status: 'completed' })
    });
    state.catalog = await api('/api/academy/catalog');
    renderCourseTree();
  });
}

async function sendHandler() {
  if (state.streaming) return;
  const text = document.getElementById('composer').value.trim();
  const fileInput = document.getElementById('fileInput');
  const hasFiles = fileInput?.files?.length > 0;
  if (!text && !hasFiles) return;

  document.getElementById('typingRow').classList.remove('hidden');

  const payload = {
    conversationId: state.currentConversationId || undefined,
    lessonId: state.currentLessonId || undefined,
    message: text,
    model: document.getElementById('modelSelect').value
  };

  document.getElementById('composer').value = '';

  try {
    await streamChat(payload);
  } catch (_) {
    /* streamed errors handled */
  }

  document.getElementById('typingRow').classList.add('hidden');
}

init();
