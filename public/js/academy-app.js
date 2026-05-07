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

/** Allowed stylesheet for Material-like reports (same-origin only). */
const ALLOWED_REPORT_STYLESHEET = '/css/academy-report-material.css';

/**
 * Full HTML from the model before iframe srcdoc.
 * @param {boolean} allowScripts — from ACADEMY_ARTIFACT_ALLOW_SCRIPTS (trusted deploys only).
 */
function sanitizeArtifactHtml(html, allowScripts) {
  if (!html || typeof DOMPurify === 'undefined') return '';

  if (allowScripts) {
    return DOMPurify.sanitize(html.trim(), {
      WHOLE_DOCUMENT: true,
      ADD_TAGS: [
        'script',
        'link',
        'style',
        'meta',
        'title',
        'thead',
        'tbody',
        'tfoot',
        'colgroup',
        'col',
        'template',
        'svg',
        'path',
        'circle',
        'rect',
        'line',
        'polyline',
        'polygon',
        'g',
        'defs',
        'clipPath',
        'mask',
        'use',
        'text',
        'tspan'
      ],
      ADD_ATTR: [
        'charset',
        'name',
        'content',
        'media',
        'colspan',
        'rowspan',
        'scope',
        'rel',
        'href',
        'class',
        'id',
        'src',
        'type',
        'crossorigin',
        'integrity',
        'defer',
        'async',
        'nomodule',
        'referrerpolicy',
        'importance',
        'loading',
        'viewBox',
        'xmlns',
        'xmlns:xlink',
        'fill',
        'stroke',
        'd',
        'x',
        'y',
        'width',
        'height',
        'rx',
        'cx',
        'cy',
        'r',
        'points',
        'transform',
        'aria-hidden',
        'role'
      ],
      FORBID_TAGS: ['iframe', 'object', 'embed', 'base']
    });
  }

  function stripUnsafeLink(node) {
    if (!node || node.tagName !== 'LINK') return;
    const rel = (node.getAttribute('rel') || '').toLowerCase();
    const href = node.getAttribute('href') || '';
    if (rel !== 'stylesheet' || href !== ALLOWED_REPORT_STYLESHEET) {
      node.remove();
    }
  }

  if (typeof DOMPurify.addHook === 'function') {
    DOMPurify.addHook('uponSanitizeElement', stripUnsafeLink);
  }
  try {
    return DOMPurify.sanitize(html.trim(), {
      WHOLE_DOCUMENT: true,
      ADD_TAGS: ['style', 'meta', 'title', 'thead', 'tbody', 'tfoot', 'colgroup', 'col', 'link'],
      ADD_ATTR: ['charset', 'name', 'content', 'media', 'colspan', 'rowspan', 'scope', 'rel', 'href', 'class', 'id'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'base', 'form', 'input', 'button']
    });
  } finally {
    if (typeof DOMPurify.removeHook === 'function') {
      DOMPurify.removeHook('uponSanitizeElement', stripUnsafeLink);
    }
  }
}

function artifactAllowScripts() {
  return Boolean(state.usage?.artifact_allow_scripts);
}

/** Models often use ```html instead of ```academy-html — detect report-like HTML for live preview. */
function looksLikeRenderableHtmlArtifact(raw) {
  const t = (raw || '').trim();
  if (t.length < 24) return false;
  if (/<!DOCTYPE\s+html\b/i.test(t)) return true;
  if (/<html[\s>]/i.test(t)) return true;
  if (/<body[\s>]/i.test(t)) return true;
  if (t.length > 120 && /<(?:style|table|main|article|section)\b/i.test(t)) return true;
  return false;
}

function suggestedHtmlDownloadName() {
  const t = document.getElementById('conversationTitle')?.value?.trim();
  if (!t) return `report-${Date.now()}.html`;
  const slug = t
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 72);
  const safe = slug || 'report';
  return `${safe}.html`;
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
    } else if (/^html$/i.test(lang) || /^htm$/i.test(lang)) {
      if (looksLikeRenderableHtmlArtifact(body)) {
        segments.push({ type: 'html', html: body });
      } else {
        segments.push({ type: 'markdown', text: s.slice(fenceStart, afterFence) });
      }
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
      wrap.className = 'my-3 border border-slate-300 rounded-lg overflow-hidden bg-white';
      const header = document.createElement('div');
      header.className =
        'flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 bg-slate-100 text-xs text-slate-600';
      const label = document.createElement('span');
      label.className = 'font-medium text-slate-800';
      label.textContent = artifactAllowScripts() ? 'Превью HTML · JS разрешён' : 'Превью HTML';
      header.appendChild(label);
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'text-indigo-600 hover:text-indigo-500';
      openBtn.textContent = 'Открыть в новой вкладке';
      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'text-emerald-700 hover:text-emerald-600';
      dlBtn.textContent = 'Скачать .html';
      const iframe = document.createElement('iframe');
      iframe.className = 'w-full min-h-[min(70vh,560px)] bg-white';
      const allowJs = artifactAllowScripts();
      iframe.setAttribute(
        'sandbox',
        allowJs
          ? 'allow-scripts allow-popups allow-popups-to-escape-sandbox'
          : 'allow-popups allow-popups-to-escape-sandbox'
      );
      iframe.title = 'Превью отчёта';
      const safe = sanitizeArtifactHtml(seg.html, allowJs);
      openBtn.addEventListener('click', () => {
        const blob = new Blob([safe], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, '_blank', 'noopener,noreferrer');
        if (w) setTimeout(() => URL.revokeObjectURL(url), 60000);
      });
      dlBtn.addEventListener('click', () => {
        const blob = new Blob([safe], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = suggestedHtmlDownloadName();
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      });
      iframe.srcdoc = safe;
      header.appendChild(openBtn);
      header.appendChild(dlBtn);
      wrap.appendChild(header);
      wrap.appendChild(iframe);
      const details = document.createElement('details');
      details.className = 'border-t border-slate-200 bg-slate-50';
      const summ = document.createElement('summary');
      summ.className = 'cursor-pointer px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700';
      summ.textContent = allowJs
        ? 'Исходный код (скрипты разрешены — см. env)'
        : 'Исходный код (после санитизации)';
      const pre = document.createElement('pre');
      pre.className =
        'max-h-48 overflow-auto px-2 pb-2 text-[11px] leading-snug text-slate-700 whitespace-pre-wrap break-all';
      pre.textContent = safe;
      details.appendChild(summ);
      details.appendChild(pre);
      wrap.appendChild(details);
      root.appendChild(wrap);
    } else if (seg.type === 'mermaid') {
      const container = document.createElement('div');
      container.className = 'my-3 p-3 bg-white rounded-lg border border-slate-300 overflow-x-auto';
      const graphEl = document.createElement('pre');
      graphEl.className = 'mermaid';
      graphEl.textContent = seg.code.trim();
      container.appendChild(graphEl);
      root.appendChild(container);
    } else if (seg.type === 'imageSpec') {
      const wrap = document.createElement('div');
      wrap.className = 'my-3 p-3 rounded-lg border border-violet-300 bg-violet-50 text-sm space-y-2';
      const title = document.createElement('div');
      title.className = 'text-xs font-medium text-violet-700';
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
      preview.className = 'text-xs text-slate-600 whitespace-pre-wrap max-h-32 overflow-y-auto';
      preview.textContent = seg.jsonText;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'text-xs bg-violet-600 hover:bg-violet-500 rounded px-3 py-1.5 text-white border border-violet-500';
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
    theme: 'default',
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
  personas: [],
  selectedKnowledgeBaseId: null
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
    state.personas = (await api('/api/academy/personas')).personas || [];
    renderUsage();
    renderCourseTree();
    renderConversationList();
    populateModels();
    populateKnowledgeBases();
    populatePersonas();
    await refreshKbStatus();
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
    wrap.innerHTML = `<div class="font-medium text-slate-800 mb-1">${escapeHtml(c.title)}</div>`;
    const ul = document.createElement('ul');
    ul.className = 'space-y-0.5 ml-1 border-l border-slate-300 pl-2';
    for (const l of byCourse[c.id] || []) {
      const li = document.createElement('li');
      const prog = state.catalog.progress[l.id];
      const check = prog?.status === 'completed' ? '✓ ' : '';
      li.innerHTML = `<button type="button" class="text-left w-full hover:text-indigo-600 py-0.5 truncate text-slate-600" data-lesson="${l.id}">${check}${escapeHtml(l.title)}</button>`;
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
    li.className = 'flex items-center gap-0.5 rounded hover:bg-slate-100';

    const sel = document.createElement('button');
    sel.type = 'button';
    sel.className = `flex-1 min-w-0 text-left truncate py-1 px-2 rounded text-sm ${
      c.id === state.currentConversationId ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:text-slate-900'
    }`;
    sel.textContent = c.title || 'Чат';
    sel.addEventListener('click', () => loadConversation(c.id));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className =
      'shrink-0 w-8 py-1 text-center text-slate-500 hover:text-red-500 hover:bg-slate-100 rounded text-xl leading-none';
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

function populateKnowledgeBases() {
  const sel = document.getElementById('knowledgeBaseSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">No KB</option>';
  for (const kb of state.knowledgeBases) {
    const o = document.createElement('option');
    o.value = kb.id;
    o.textContent = kb.name;
    sel.appendChild(o);
  }
  if (state.selectedKnowledgeBaseId) sel.value = state.selectedKnowledgeBaseId;
}

function populatePersonas() {
  const sel = document.getElementById('personaSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">No persona</option>';
  for (const p of state.personas) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name;
    sel.appendChild(o);
  }
}

async function refreshKbStatus() {
  const box = document.getElementById('kbStatusList');
  if (!box) return;
  box.innerHTML = '';
  if (!state.selectedKnowledgeBaseId) {
    box.textContent = 'Выберите базу знаний для просмотра статусов.';
    return;
  }
  const rows = (await api(`/api/academy/knowledge-bases/${state.selectedKnowledgeBaseId}/documents`)).documents || [];
  if (!rows.length) {
    box.textContent = 'Документов пока нет.';
    return;
  }
  rows.slice(0, 8).forEach((d) => {
    const div = document.createElement('div');
    div.textContent = `${d.name} — ${d.status}${d.error_message ? ` (${d.error_message})` : ''}`;
    box.appendChild(div);
  });
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
  bubble.className = `max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-900'}`;
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
  actions.className = 'flex gap-2 mt-1 text-xs text-slate-600';
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'hover:text-slate-900';
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
  bubble.className = 'max-w-[85%] rounded-2xl px-4 py-2 text-sm bg-white border border-slate-200 text-slate-900';
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
        const rm = document.getElementById('responseMeta');
        if (rm) {
          const cits = Array.isArray(json.citations) ? json.citations : [];
          if (cits.length || json.confidence) {
            rm.classList.remove('hidden');
            rm.textContent = `Confidence: ${json.confidence || 'n/a'} · Sources: ${cits.map((c) => c.document).join(', ')}`;
          } else {
            rm.classList.add('hidden');
            rm.textContent = '';
          }
        }
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
  document.getElementById('knowledgeBaseSelect')?.addEventListener('change', async () => {
    state.selectedKnowledgeBaseId = document.getElementById('knowledgeBaseSelect').value || null;
    await refreshKbStatus();
  });

  document.getElementById('createKbBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('kbNameInput').value.trim();
    if (!name) return;
    const kb = await api('/api/academy/knowledge-bases', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    state.knowledgeBases.unshift(kb);
    state.selectedKnowledgeBaseId = kb.id;
    populateKnowledgeBases();
    await refreshKbStatus();
    document.getElementById('kbNameInput').value = '';
  });

  document.getElementById('uploadKbBtn')?.addEventListener('click', async () => {
    if (!state.selectedKnowledgeBaseId) {
      alert('Сначала выберите KB');
      return;
    }
    const input = document.getElementById('kbUploadInput');
    if (!input?.files?.length) return;
    const fd = new FormData();
    for (let i = 0; i < input.files.length; i++) fd.append('files', input.files[i]);
    const token = getToken();
    await fetch(`${apiBase}/api/academy/knowledge-bases/${state.selectedKnowledgeBaseId}/documents/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd
    });
    input.value = '';
    await refreshKbStatus();
  });

  document.getElementById('savePromptBtn')?.addEventListener('click', async () => {
    const text = document.getElementById('composer').value.trim();
    if (!text) return;
    await api('/api/academy/prompts', {
      method: 'POST',
      body: JSON.stringify({
        title: `Prompt ${new Date().toISOString()}`,
        category: 'Personal Productivity',
        prompt_text: text
      })
    });
    alert('Prompt сохранен');
  });

  document.getElementById('evaluatePromptBtn')?.addEventListener('click', async () => {
    const text = document.getElementById('composer').value.trim();
    if (!text) return;
    const out = await api('/api/academy/prompt-evaluate', {
      method: 'POST',
      body: JSON.stringify({ prompt: text, model: document.getElementById('modelSelect').value })
    });
    document.getElementById('promptEvalOutput').textContent = JSON.stringify(out, null, 2);
  });

  document.getElementById('runCompareBtn')?.addEventListener('click', async () => {
    const text = document.getElementById('composer').value.trim();
    const models = document
      .getElementById('compareModelsInput')
      .value.split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!text || !models.length) return;
    const out = await api('/api/academy/model-compare', {
      method: 'POST',
      body: JSON.stringify({ prompt: text, models })
    });
    document.getElementById('compareOutput').textContent = JSON.stringify(out, null, 2);
  });

  document.getElementById('runPlaygroundBtn')?.addEventListener('click', async () => {
    const text = document.getElementById('composer').value.trim();
    if (!text) return;
    const out = await api('/api/academy/playground', {
      method: 'POST',
      body: JSON.stringify({
        prompt: text,
        model: document.getElementById('modelSelect').value,
        temperature: 0.7,
        top_p: 1,
        max_tokens: 900,
        system_prompt: 'You are an AI playground assistant.',
        output_format: 'markdown'
      })
    });
    document.getElementById('compareOutput').textContent = out.response || '';
  });

  document.getElementById('createAssistantBtn')?.addEventListener('click', async () => {
    const out = await api('/api/academy/assistants', {
      method: 'POST',
      body: JSON.stringify({
        name: `Assistant ${new Date().toISOString().slice(11, 19)}`,
        description: 'Auto-created from workspace UI',
        role: 'General helper',
        instructions: 'Give practical, structured guidance.',
        connected_kb_id: state.selectedKnowledgeBaseId || null,
        default_model: document.getElementById('modelSelect').value
      })
    });
    document.getElementById('builderOutput').textContent = JSON.stringify(out, null, 2);
  });

  document.getElementById('runWorkflowBtn')?.addEventListener('click', async () => {
    const create = await api('/api/academy/workflows', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Quick workflow',
        description: 'Auto sample',
        steps: [
          { step_order: 1, title: 'Analyze input', prompt_text: 'Analyze:\n{{previous_output}}' },
          { step_order: 2, title: 'Extract key points', prompt_text: 'Extract bullet points:\n{{previous_output}}' },
          { step_order: 3, title: 'Generate email', prompt_text: 'Create email draft from:\n{{previous_output}}' }
        ]
      })
    });
    const run = await api(`/api/academy/workflows/${create.id}/run`, {
      method: 'POST',
      body: JSON.stringify({
        input: document.getElementById('composer').value.trim() || 'No input',
        model: document.getElementById('modelSelect').value
      })
    });
    document.getElementById('builderOutput').textContent = JSON.stringify(run, null, 2);
  });

  document.getElementById('hallucinationAttemptBtn')?.addEventListener('click', async () => {
    const scenarios = await api('/api/academy/hallucination/scenarios');
    if (!scenarios.scenarios?.length) {
      document.getElementById('trainingOutput').textContent = 'No scenarios yet.';
      return;
    }
    const first = scenarios.scenarios[0];
    const out = await api('/api/academy/hallucination/attempt', {
      method: 'POST',
      body: JSON.stringify({
        scenario_id: first.id,
        selected_issue: 'unsupported claim',
        explanation: 'The answer states facts without evidence and shows overconfidence.'
      })
    });
    document.getElementById('trainingOutput').textContent = JSON.stringify(out, null, 2);
  });

  document.getElementById('generateCertBtn')?.addEventListener('click', async () => {
    const out = await api('/api/academy/certificate', {
      method: 'POST',
      body: JSON.stringify({
        course_name: 'AI Practicum',
        completed_modules: [1, 2, 3, 4, 5, 6, 7]
      })
    });
    document.getElementById('trainingOutput').textContent = JSON.stringify(out, null, 2);
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
      model: document.getElementById('modelSelect').value,
      chatMode: document.getElementById('chatModeSelect')?.value || 'general',
      knowledgeBaseId: document.getElementById('knowledgeBaseSelect')?.value || undefined,
      personaId: document.getElementById('personaSelect')?.value || undefined
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
    model: document.getElementById('modelSelect').value,
    chatMode: document.getElementById('chatModeSelect')?.value || 'general',
    knowledgeBaseId: document.getElementById('knowledgeBaseSelect')?.value || undefined,
    personaId: document.getElementById('personaSelect')?.value || undefined,
    strictMode: (document.getElementById('chatModeSelect')?.value || '') === 'strict_knowledge'
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
