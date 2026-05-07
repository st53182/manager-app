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
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ['target', 'src', 'alt', 'loading', 'decoding'],
    ADD_TAGS: ['img']
  });
}

/** Full HTML documents from the model: strip scripts / interactive vectors before iframe srcdoc. */
function sanitizeArtifactHtml(html) {
  if (!html || typeof DOMPurify === 'undefined') return '';
  return DOMPurify.sanitize(html.trim(), {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['style', 'meta', 'title', 'thead', 'tbody', 'tfoot', 'colgroup', 'col'],
    ADD_ATTR: ['charset', 'name', 'content', 'media', 'colspan', 'rowspan', 'scope'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'base', 'link', 'form', 'input', 'button']
  });
}

/**
 * Split assistant message into markdown + special fenced blocks (academy-html, mermaid, academy-image-spec).
 */
function parseAssistantContent(text) {
  const segments = [];
  const s = text || '';
  let i = 0;
  while (i < s.length) {
    const fenceStart = s.indexOf('```', i);
    if (fenceStart === -1) {
      if (i < s.length) segments.push({ type: 'markdown', text: s.slice(i) });
      break;
    }
    if (fenceStart > i) {
      segments.push({ type: 'markdown', text: s.slice(i, fenceStart) });
    }
    const nl = s.indexOf('\n', fenceStart + 3);
    if (nl === -1) {
      segments.push({ type: 'markdown', text: s.slice(fenceStart) });
      break;
    }
    const lang = s.slice(fenceStart + 3, nl).trim();
    const bodyStart = nl + 1;
    const close = s.indexOf('\n```', bodyStart);
    if (close === -1) {
      segments.push({ type: 'markdown', text: s.slice(fenceStart) });
      break;
    }
    const body = s.slice(bodyStart, close);
    const afterFence = close + 4;
    if (lang === 'academy-html') {
      segments.push({ type: 'html', html: body });
    } else if (lang === 'mermaid') {
      segments.push({ type: 'mermaid', code: body });
    } else if (lang === 'academy-image-spec') {
      segments.push({ type: 'imageSpec', jsonText: body.trim() });
    } else {
      segments.push({ type: 'markdown', text: s.slice(fenceStart, afterFence) });
    }
    i = afterFence;
  }
  return segments;
}

async function runMermaidIn(container) {
  if (typeof mermaid === 'undefined' || !container) return;
  const nodes = container.querySelectorAll('pre.mermaid');
  if (!nodes.length) return;
  try {
    await mermaid.run({ nodes: Array.from(nodes) });
  } catch (e) {
    console.warn('Mermaid:', e);
    nodes.forEach((n) => {
      const err = document.createElement('div');
      err.className = 'text-xs text-amber-400 mt-2';
      err.textContent = 'Не удалось отрисовать диаграмму (проверьте синтаксис Mermaid).';
      n.parentNode?.appendChild(err);
    });
  }
}

async function fillAssistantBubble(root, content) {
  root.innerHTML = '';
  const segments = parseAssistantContent(content);
  for (const seg of segments) {
    if (seg.type === 'markdown') {
      const el = document.createElement('div');
      el.className = 'assistant-md';
      el.innerHTML = renderMarkdown(seg.text);
      el.querySelectorAll('pre code').forEach((block) => {
        if (typeof hljs !== 'undefined') hljs.highlightElement(block);
      });
      root.appendChild(el);
    } else if (seg.type === 'html') {
      const wrap = document.createElement('div');
      wrap.className = 'my-3 border border-slate-600 rounded-lg overflow-hidden bg-slate-900/80';
      const header = document.createElement('div');
      header.className = 'flex flex-wrap items-center gap-2 px-2 py-1.5 bg-slate-800 text-xs text-slate-400';
      const label = document.createElement('span');
      label.textContent = 'HTML-отчёт';
      header.appendChild(label);
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'text-indigo-400 hover:text-indigo-300';
      openBtn.textContent = 'Открыть в новой вкладке';
      const iframe = document.createElement('iframe');
      iframe.className = 'w-full min-h-[min(70vh,560px)] bg-white';
      iframe.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
      iframe.title = 'HTML-отчёт';
      const safe = sanitizeArtifactHtml(seg.html);
      openBtn.addEventListener('click', () => {
        const blob = new Blob([safe], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, '_blank', 'noopener,noreferrer');
        if (w) setTimeout(() => URL.revokeObjectURL(url), 60000);
      });
      iframe.srcdoc = safe;
      header.appendChild(openBtn);
      wrap.appendChild(header);
      wrap.appendChild(iframe);
      root.appendChild(wrap);
    } else if (seg.type === 'mermaid') {
      const container = document.createElement('div');
      container.className = 'my-3 p-3 bg-slate-900 rounded-lg border border-slate-600 overflow-x-auto';
      const graphEl = document.createElement('pre');
      graphEl.className = 'mermaid';
      graphEl.textContent = seg.code.trim();
      container.appendChild(graphEl);
      root.appendChild(container);
    } else if (seg.type === 'imageSpec') {
      const wrap = document.createElement('div');
      wrap.className = 'my-3 p-3 rounded-lg border border-violet-700/40 bg-violet-950/30 text-sm space-y-2';
      const title = document.createElement('div');
      title.className = 'text-xs font-medium text-violet-300';
      title.textContent = 'Спецификация инфографики (academy-image-spec)';
      let spec = {};
      try {
        spec = JSON.parse(seg.jsonText);
      } catch {
        spec = {};
      }
      const prompt =
        typeof spec.prompt === 'string'
          ? spec.prompt
          : typeof spec.text === 'string'
            ? spec.text
            : '';
      const preview = document.createElement('pre');
      preview.className = 'text-xs text-slate-400 whitespace-pre-wrap max-h-32 overflow-y-auto';
      preview.textContent = seg.jsonText;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'text-xs bg-violet-800 hover:bg-violet-700 rounded px-3 py-1.5 text-violet-100 border border-violet-600';
      btn.textContent = 'Сгенерировать картинку';
      btn.addEventListener('click', () => {
        const combined = [prompt, typeof spec.style_notes === 'string' ? spec.style_notes : '']
          .filter(Boolean)
          .join('\n\n');
        runImageGeneration(combined || seg.jsonText);
      });
      wrap.appendChild(title);
      wrap.appendChild(preview);
      wrap.appendChild(btn);
      root.appendChild(wrap);
    }
  }
  await runMermaidIn(root);
}

function initMermaid() {
  if (typeof mermaid === 'undefined') return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'strict',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
  });
}

const state = {
  catalog: null,
  conversations: [],
  currentConversationId: null,
  currentLessonId: null,
  usage: null,
  streaming: false,
  selectedModel: null,
  lastFailedPayload: null,
  knowledgeBases: [],
  activeKnowledgeBaseId: null,
  knowledgeDocuments: []
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
  initMermaid();
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
    state.knowledgeBases = (await api('/api/academy/knowledge-bases')).knowledgeBases || [];
    renderUsage();
    renderCourseTree();
    renderConversationList();
    renderKnowledgeBases();
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
    bubble.innerHTML = '';
    fillAssistantBubble(bubble, m.content).catch(() => {
      bubble.innerHTML = renderMarkdown(m.content);
      bubble.querySelectorAll('pre code').forEach((block) => {
        if (typeof hljs !== 'undefined') hljs.highlightElement(block);
      });
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
  const ig = document.getElementById('imageGenBtn');
  if (ig) ig.disabled = busy;
}

/**
 * Image generation via OpenRouter (shared by composer button and academy-image-spec blocks).
 * @returns {Promise<boolean>} success
 */
async function runImageGeneration(prompt) {
  if (state.streaming) return false;
  const p = (prompt || '').trim();
  if (!p) {
    alert('Опишите изображение или заполните блок academy-image-spec.');
    return false;
  }

  document.getElementById('typingRow').classList.remove('hidden');
  setComposerBusy(true);
  try {
    const out = await api('/api/academy/image/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: p,
        conversationId: state.currentConversationId || undefined,
        lessonId: state.currentLessonId || undefined
      })
    });
    if (out.conversationId) {
      state.currentConversationId = out.conversationId;
    }
    state.usage = await api('/api/academy/usage');
    renderUsage();
    state.conversations = (await api('/api/academy/conversations')).conversations;
    renderConversationList();
    if (state.currentConversationId) {
      await loadConversation(state.currentConversationId);
    }
    return true;
  } catch (e) {
    alert(e.message || 'Не удалось сгенерировать изображение');
    return false;
  } finally {
    document.getElementById('typingRow').classList.add('hidden');
    setComposerBusy(false);
  }
}

async function imageGenHandler() {
  const text = document.getElementById('composer').value.trim();
  if (!text) {
    alert('Опишите, какое изображение нужно (промпт для генерации).');
    return;
  }
  const ok = await runImageGeneration(text);
  if (ok) document.getElementById('composer').value = '';
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

  document.getElementById('createKbBtn')?.addEventListener('click', createKnowledgeBaseHandler);

  document.getElementById('sendBtn').addEventListener('click', sendHandler);
  document.getElementById('imageGenBtn').addEventListener('click', imageGenHandler);

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

function formatBytes(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function renderKnowledgeBases() {
  const ul = document.getElementById('knowledgeBaseList');
  if (!ul) return;
  ul.innerHTML = '';
  if (!state.knowledgeBases.length) {
    const li = document.createElement('li');
    li.className = 'text-slate-500';
    li.textContent = 'Нет баз знаний';
    ul.appendChild(li);
    return;
  }
  for (const kb of state.knowledgeBases) {
    const li = document.createElement('li');
    li.className = 'border border-slate-800 rounded p-2 bg-slate-900/60';
    const isActive = state.activeKnowledgeBaseId === kb.id;
    li.innerHTML = `
      <div class="flex items-center gap-1">
        <button type="button" data-open-kb="${kb.id}" class="flex-1 text-left ${isActive ? 'text-indigo-300' : 'text-slate-200'} truncate">${escapeHtml(kb.name)}</button>
        <span class="text-[10px] text-slate-500">${kb.documents_count || 0}</span>
        <button type="button" data-del-kb="${kb.id}" class="text-red-400 hover:text-red-300 px-1">×</button>
      </div>
      <div id="kb-docs-${kb.id}" class="${isActive ? '' : 'hidden'} mt-2 space-y-1"></div>
      <div id="kb-actions-${kb.id}" class="${isActive ? '' : 'hidden'} mt-2 space-y-1">
        <input type="file" data-upload-kb="${kb.id}" class="text-[10px] text-slate-400 w-full" multiple />
      </div>
    `;
    ul.appendChild(li);
  }
  ul.querySelectorAll('[data-open-kb]').forEach((btn) => {
    btn.addEventListener('click', () => openKnowledgeBase(btn.getAttribute('data-open-kb')));
  });
  ul.querySelectorAll('[data-del-kb]').forEach((btn) => {
    btn.addEventListener('click', () => deleteKnowledgeBaseHandler(btn.getAttribute('data-del-kb')));
  });
  ul.querySelectorAll('[data-upload-kb]').forEach((input) => {
    input.addEventListener('change', () => uploadDocumentsHandler(input.getAttribute('data-upload-kb'), input));
  });
  if (state.activeKnowledgeBaseId) {
    renderKnowledgeDocuments(state.activeKnowledgeBaseId);
  }
}

function renderKnowledgeDocuments(kbId) {
  const box = document.getElementById(`kb-docs-${kbId}`);
  if (!box) return;
  box.innerHTML = '';
  if (!state.knowledgeDocuments.length) {
    box.innerHTML = '<div class="text-[10px] text-slate-500">Документов пока нет</div>';
    return;
  }
  for (const d of state.knowledgeDocuments) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-1 text-[10px] text-slate-400';
    row.innerHTML = `
      <span class="flex-1 truncate" title="${escapeHtml(d.original_name)}">${escapeHtml(d.original_name)}</span>
      <span class="text-slate-500">${formatBytes(d.size_bytes)}</span>
      <button type="button" data-del-doc="${d.id}" class="text-red-400 hover:text-red-300 px-1">×</button>
    `;
    box.appendChild(row);
  }
  box.querySelectorAll('[data-del-doc]').forEach((btn) => {
    btn.addEventListener('click', () => deleteDocumentHandler(btn.getAttribute('data-del-doc')));
  });
}

async function createKnowledgeBaseHandler() {
  const input = document.getElementById('kbNameInput');
  const name = input?.value?.trim();
  if (!name) return;
  try {
    await api('/api/academy/knowledge-bases', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    input.value = '';
    state.knowledgeBases = (await api('/api/academy/knowledge-bases')).knowledgeBases || [];
    renderKnowledgeBases();
  } catch (e) {
    alert(e.message || 'Не удалось создать базу знаний');
  }
}

async function openKnowledgeBase(kbId) {
  state.activeKnowledgeBaseId = kbId;
  try {
    const docs = await api(`/api/academy/knowledge-bases/${kbId}/documents`);
    state.knowledgeDocuments = docs.documents || [];
    renderKnowledgeBases();
  } catch (e) {
    alert(e.message || 'Не удалось загрузить документы');
  }
}

async function deleteKnowledgeBaseHandler(kbId) {
  if (!confirm('Удалить базу знаний и все документы?')) return;
  try {
    await api(`/api/academy/knowledge-bases/${kbId}`, { method: 'DELETE' });
    state.knowledgeBases = (await api('/api/academy/knowledge-bases')).knowledgeBases || [];
    if (state.activeKnowledgeBaseId === kbId) {
      state.activeKnowledgeBaseId = null;
      state.knowledgeDocuments = [];
    }
    renderKnowledgeBases();
  } catch (e) {
    alert(e.message || 'Не удалось удалить базу знаний');
  }
}

async function uploadDocumentsHandler(kbId, inputEl) {
  if (!inputEl?.files?.length) return;
  const fd = new FormData();
  for (let i = 0; i < inputEl.files.length; i += 1) {
    fd.append('files', inputEl.files[i]);
  }
  try {
    const token = getToken();
    const res = await fetch(`${apiBase}/api/academy/knowledge-bases/${kbId}/documents`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || res.statusText);
    inputEl.value = '';
    await openKnowledgeBase(kbId);
    state.knowledgeBases = (await api('/api/academy/knowledge-bases')).knowledgeBases || [];
    renderKnowledgeBases();
  } catch (e) {
    alert(e.message || 'Не удалось загрузить документы');
  }
}

async function deleteDocumentHandler(documentId) {
  if (!confirm('Удалить документ?')) return;
  try {
    await api(`/api/academy/knowledge-documents/${documentId}`, { method: 'DELETE' });
    if (state.activeKnowledgeBaseId) {
      await openKnowledgeBase(state.activeKnowledgeBaseId);
    }
    state.knowledgeBases = (await api('/api/academy/knowledge-bases')).knowledgeBases || [];
    renderKnowledgeBases();
  } catch (e) {
    alert(e.message || 'Не удалось удалить документ');
  }
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
