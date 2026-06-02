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
      openBtn.className = 'text-indigo-300 hover:text-indigo-200 transition-colors';
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
        'text-xs bg-violet-700 hover:bg-violet-600 rounded px-3 py-1.5 text-violet-100 border border-violet-500 transition-colors';
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

const MVP_COURSE_SLUG = 'ai-work-business-talk';

/** Готовые вопросы наставнику по практикам (не делают работу за студента). */
const PRACTICE_SCENARIO_KEYS = new Set([
  'block1-practice-prompt',
  'block1-practice-scenario',
  'block1-practice-hallucination'
]);

const TASK_PICK_LABELS = {
  'block1-practice-prompt': 'Выберите одну из 5 задач',
  'block1-practice-scenario': 'Выберите один из 5 сценариев',
  'block1-practice-hallucination': 'Выберите один из 5 фрагментов'
};

const PRACTICE_STEP_LABELS = {
  'block1-practice-prompt': [
    'Написать промпт v1 и получить первый результат',
    'Улучшить промпт до v2 и зафиксировать вывод',
    'Проверить отчёт и отправить'
  ],
  'block1-practice-scenario': [
    'Провести диалог (минимум 4 пары реплик)',
    'Разобрать свои реплики и поведение ИИ',
    'Проверить отчёт и отправить'
  ],
  'block1-practice-hallucination': [
    'Найти и классифицировать риски в тексте',
    'Написать безопасную версию и принять решение',
    'Проверить отчёт и отправить'
  ]
};

const PRACTICE_STEP_CELEBRATIONS = {
  'block1-practice-prompt': [
    null,
    '✓ Отлично! Вы оценили ответ v1 и записали улучшения. Теперь напишите промпт v2.',
    '✓ Готово! Отчёт собран. Проверьте его и нажмите «Отправить».'
  ],
  'block1-practice-scenario': [
    null,
    '✓ Диалог завершён! Теперь разберите свои реплики — это самая важная часть тренировки.',
    '✓ Анализ готов! Отчёт собран. Проверьте его и нажмите «Отправить».'
  ],
  'block1-practice-hallucination': [
    null,
    '✓ Риски найдены! Теперь напишите безопасную версию текста и примите решение.',
    '✓ Готово! Отчёт собран. Проверьте его и нажмите «Отправить».'
  ]
};

const PRACTICE_HINTS = {
  'block1-practice-prompt': [
    { label: 'Как заполнить RTCFSC', text: 'Объясни, что писать в каждом блоке RTCFSC (R, T, C, F, S, C) для моей выбранной задачи. Дай по одному примеру фразы на блок, без полного готового промпта.' },
    { label: 'Проверь черновик промпта', text: 'Я пришлю черновик промпта RTCFSC по выбранной задаче. Дай обратную связь: что неясно, чего не хватает. Не переписывай промпт целиком.' },
    { label: 'Критерии успеха', text: 'Приведи 5 примеров измеримых критериев успеха (блок C в RTCFSC) для моей выбранной задачи. Коротко, списком.' },
    { label: 'Слабое место и v2', text: 'После выполнения промпта в чате: как сформулировать «слабое место» и «улучшение v2»? Пример на 2–3 предложения, без готового ответа на задание.' }
  ],
  'block1-practice-scenario': [
    { label: 'Стартовое сообщение', text: 'Дай шаблон первого сообщения в чат для моего выбранного сценария: роли, правила, 3–5 реплик. Без готового диалога целиком.' },
    { label: 'ИИ вышел из роли', text: 'ИИ отвечает общими советами, а не как персонаж. Дай 2 фразы, чтобы вернуть в роль моего сценария.' },
    { label: 'Следующая реплика', text: 'Подскажи, что написать следующим сообщением в моём диалоге — одну реплику, без продолжения за меня.' },
    { label: 'Как оформить выводы', text: 'Покажи структуру блока «Выводы»: 4 пункта-заголовка и по одному примеру предложения. Без выдуманного диалога.' }
  ],
  'block1-practice-hallucination': [
    { label: 'Типы ошибок ИИ', text: 'Объясни простыми словами 5 типов рисков в ответах ИИ на моём выбранном фрагменте. Без готового «безопасного» текста.' },
    { label: 'Разбор по шагам', text: 'Веди меня по шагам разбору моего выбранного фрагмента. Задавай наводящие вопросы, не выдавай готовый список проблем сразу.' },
    { label: 'Проверь мой список', text: 'Я пришлю список проблем в выбранном фрагменте. Скажи, что упустил(а) и какие типы перепутал(а).' },
    { label: 'Безопасные формулировки', text: 'Дай 5 примеров фраз для рабочей переписки, когда данных нет или нужна проверка. Коротко.' }
  ]
};
const TOOLS_COLLAPSED_KEY = 'academy_tools_panel_collapsed';
const TOOLS_RIGHT_WIDTH_KEY = 'academy_right_pane_width';
let academyLayoutSetWidths = null;


const state = {
  catalog: null,
  conversations: [],
  currentConversationId: null,
  currentLessonId: null,
  currentLesson: null,
  progressSummary: null,
  compareSessionId: null,
  hallucinationScenarios: [],
  promptLibrary: [],
  usage: null,
  streaming: false,
  selectedModel: null,
  lastFailedPayload: null,
  knowledgeBases: [],
  personas: [],
  selectedKnowledgeBaseId: null,
  activeKnowledgeBaseId: null,
  knowledgeDocuments: [],
  selectedTaskId: null,
  taskOptions: [],
  lastPracticeAiResult: null
};
let kbStatusPollTimer = null;
let kbStatusPollBusy = false;

function currentLang() {
  return window.translationManager?.currentLanguage || localStorage.getItem('language') || 'ru';
}

function tr(key, fallback = '') {
  if (window.translationManager?.t) return window.translationManager.t(key);
  return fallback || key;
}

function getLocalizedPersonaName(persona) {
  if (!persona) return '';
  const lang = currentLang();
  if (persona.translations && typeof persona.translations === 'object') {
    const viaMap = persona.translations[lang] || persona.translations.ru || persona.translations.en;
    if (viaMap) return viaMap;
  }
  const byField = persona[`name_${lang}`] || persona.name_ru || persona.name_en || persona.name;
  return byField || persona.name || '';
}

function initLanguageEvents() {
  if (!window.translationManager || window.translationManager.__academyHooked) return;
  const original = window.translationManager.setLanguage?.bind(window.translationManager);
  if (typeof original !== 'function') return;
  window.translationManager.setLanguage = (language) => {
    original(language);
    window.dispatchEvent(new CustomEvent('academy-language-changed', { detail: { language } }));
  };
  window.translationManager.__academyHooked = true;
}

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
    window.location.replace('/');
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
    renderConversationList();
    renderKnowledgeBases();
    populateModels();
    populateKnowledgeBases();
    populatePersonas();
    await refreshKbStatus();
    updateModelHint();
    applyAcademyTranslations();
    renderCourseTree();
    await loadProgressSummary();
    await loadPromptLibrary();
    await loadHallucinationScenarios();
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
  const el = document.getElementById('usageBadge');
  if (!el || !u) return;
  const d = u.daily;
  const dayPct = Math.min(100, Math.round((d.used_tokens / d.limit_tokens) * 100));
  const line = `День: ${dayPct}% · ${d.used_tokens} / ${d.limit_tokens} токенов`;
  el.textContent = line;
  el.title = line;
}


function getMvpCourses() {
  if (!state.catalog?.courses) return [];
  const mvp = state.catalog.courses.filter((c) => c.slug === MVP_COURSE_SLUG);
  return mvp.length ? mvp : state.catalog.courses;
}
function getMvpLessons() {
  const ids = new Set(getMvpCourses().map((c) => c.id));
  return (state.catalog?.lessons || []).filter((l) => ids.has(l.course_id));
}
async function loadProgressSummary() {
  try { state.progressSummary = await api('/api/academy/progress/summary'); renderProgressSummary(); } catch (_) {}
}
function renderProgressSummary() {
  const el = document.getElementById('progressSummaryText');
  if (!el) return;
  const s = state.progressSummary;
  if (!s) { el.textContent = '—'; return; }
  el.textContent = `Практик: ${s.practices_completed}/${s.practices_total} (${s.percent}%)`;
}
function syncPracticeModeUi() {
  const g = document.getElementById('practiceModeSelect')?.value === 'group';
  document.getElementById('groupMetaFields')?.classList.toggle('hidden', !g);
  document.getElementById('groupModeCallout')?.classList.toggle('hidden', !g);
}
function renderAssignmentFeedback(fb) {
  const box = document.getElementById('assignmentFeedback');
  if (!box || !fb) return;
  box.classList.remove('hidden');
  const lines = [];
  if (fb.score != null) lines.push('Оценка: ' + fb.score + '/10');
  if (fb.recommendations?.length) lines.push('Рекомендации:\n• ' + fb.recommendations.join('\n• '));
  if (fb.strengths?.length) lines.push('Сильные:\n• ' + fb.strengths.join('\n• '));
  if (fb.weaknesses?.length) lines.push('Слабые:\n• ' + fb.weaknesses.join('\n• '));
  box.textContent = lines.join('\n\n');
}
function parseTaskOptions(assignment) {
  let opts = assignment?.task_options;
  if (typeof opts === 'string') {
    try {
      opts = JSON.parse(opts);
    } catch {
      opts = [];
    }
  }
  return Array.isArray(opts) ? opts : [];
}

function isModuleOnePractice(lesson) {
  return Boolean(lesson?.scenario_key && PRACTICE_SCENARIO_KEYS.has(lesson.scenario_key));
}

function getSubmissionGroupMeta(submission) {
  const raw = submission?.group_meta;
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getPracticeWorkflowApi() {
  return typeof window !== 'undefined' ? window.AcademyPracticeWorkflow : null;
}

function buildGroupMetaForSave() {
  const scenarioKey = state.currentLesson?.scenario_key;
  const wfApi = getPracticeWorkflowApi();
  const meta = {
    size: Number(document.getElementById('groupSizeInput')?.value) || null,
    input_by: document.getElementById('groupInputBy')?.value?.trim() || null,
    selected_task_id: state.selectedTaskId || null,
    prompt_draft: {
      dialogue_start: document.getElementById('practiceDialogueStart')?.value?.trim() || '',
      r: document.getElementById('promptFieldR')?.value?.trim() || '',
      t: document.getElementById('promptFieldT')?.value?.trim() || '',
      c: document.getElementById('promptFieldC')?.value?.trim() || '',
      f: document.getElementById('promptFieldF')?.value?.trim() || '',
      s: document.getElementById('promptFieldS')?.value?.trim() || '',
      criteria: document.getElementById('promptFieldCriteria')?.value?.trim() || '',
      role_ai: document.getElementById('practiceRoleAi')?.value?.trim() || '',
      role_me: document.getElementById('practiceRoleMe')?.value?.trim() || '',
      prompt_v1: document.getElementById('practicePromptV1')?.value?.trim() || '',
      prompt_v2: document.getElementById('practicePromptV2')?.value?.trim() || ''
    }
  };
  if (wfApi && scenarioKey) {
    const wf = wfApi.collectWorkflowFromUi(scenarioKey);
    wf.currentStep = state.practiceStep || 1;
    meta.workflow = wf;
  }
  return meta;
}

function restorePromptDraftFromMeta(gm) {
  const d = gm?.prompt_draft;
  if (!d || typeof d !== 'object') return;
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val != null) el.value = val;
  };
  set('practiceDialogueStart', d.dialogue_start);
  set('promptFieldR', d.r);
  set('promptFieldT', d.t);
  set('promptFieldC', d.c);
  set('promptFieldF', d.f);
  set('promptFieldS', d.s);
  set('promptFieldCriteria', d.criteria);
  set('practiceRoleAi', d.role_ai);
  set('practiceRoleMe', d.role_me);
  set('practicePromptV1', d.prompt_v1 || d.text);
  set('practicePromptV2', d.prompt_v2);
}

function assembleRtcfsсPrompt() {
  const parts = [
    ['R (роль)', document.getElementById('promptFieldR')?.value?.trim()],
    ['T (задача)', document.getElementById('promptFieldT')?.value?.trim()],
    ['C (контекст)', document.getElementById('promptFieldC')?.value?.trim()],
    ['F (формат)', document.getElementById('promptFieldF')?.value?.trim()],
    ['S (стиль)', document.getElementById('promptFieldS')?.value?.trim()],
    ['C (критерии успеха)', document.getElementById('promptFieldCriteria')?.value?.trim()]
  ].filter(([, v]) => v);
  if (!parts.length) return '';
  return parts.map(([k, v]) => `${k}:\n${v}`).join('\n\n');
}

function getPracticePromptText(pass = 'v1') {
  if (pass === 'v2') {
    const v2 = document.getElementById('practicePromptV2')?.value?.trim();
    if (v2) return v2;
    return '';
  }
  const v1 = document.getElementById('practicePromptV1')?.value?.trim();
  if (v1) return v1;
  return assembleRtcfsсPrompt();
}

function buildPracticeRunContext(runKind, pass) {
  const task = getSelectedTaskOption();
  const aiRole = document.getElementById('practiceRoleAi')?.value?.trim() || task?.ai_role || '';
  const studentRole = document.getElementById('practiceRoleMe')?.value?.trim() || task?.student_role || '';
  const studentGoal =
    document.getElementById('practiceStudentGoal')?.value?.trim() || task?.student_goal || '';
  let taskContext = task?.context || task?.summary || '';
  if (runKind === 'analysis') taskContext = task?.fragment_text || taskContext;
  return {
    runKind,
    pass: pass || null,
    taskTitle: task?.title || '',
    taskContext,
    taskDescription: task?.description || '',
    aiRole,
    studentRole,
    studentGoal,
    hardReaction: task?.hard_reaction || '',
    dialogueRules: Array.isArray(task?.dialogue_requirements) ? task.dialogue_requirements : [],
    fragmentText: task?.fragment_text || task?.context || ''
  };
}

function showPracticeStep(n) {
  const sk = state.currentLesson?.scenario_key;
  const labels = PRACTICE_STEP_LABELS[sk];
  const total = labels?.length || 3;
  state.practiceStep = n;

  const bar = document.getElementById('practiceStepBar');
  if (bar && labels) {
    bar.classList.remove('hidden');
    document.getElementById('practiceStepNum').textContent = `Шаг ${n} из ${total}`;
    document.getElementById('practiceStepTitle').textContent = labels[n - 1] || '';
    const dots = document.getElementById('practiceStepDots');
    if (dots) {
      dots.innerHTML = '';
      for (let i = 1; i <= total; i++) {
        const dot = document.createElement('span');
        dot.className = `aa-step-dot${i < n ? ' is-done' : i === n ? ' is-active' : ''}`;
        dots.appendChild(dot);
      }
    }
  }

  const sectionId =
    sk === 'block1-practice-prompt' ? 'practicePromptSection' :
    sk === 'block1-practice-scenario' ? 'practiceDialogueSection' :
    'practiceAnalysisSection';
  const section = document.getElementById(sectionId);
  if (section) {
    section.querySelectorAll('[data-practice-step]').forEach((pane) => {
      pane.classList.toggle('hidden', String(pane.dataset.practiceStep) !== String(n));
    });
  }

  const isLastStep = n >= total;
  const submitBlock = document.getElementById('practiceSubmitBlock');
  submitBlock?.classList.toggle('hidden', !isLastStep);

  if (isLastStep) {
    getPracticeWorkflowApi()?.renderSelfCheck(sk, state.practiceWorkflow?.self_check);
    document.getElementById('practiceSelfCheckBlock')?.classList.remove('hidden');
    submitBlock?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    bar?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  scheduleAutoSave();
}

function advancePracticeStep() {
  const sk = state.currentLesson?.scenario_key;
  const total = PRACTICE_STEP_LABELS[sk]?.length || 3;
  const next = (state.practiceStep || 1) + 1;
  if (next > total) return;

  const msg = PRACTICE_STEP_CELEBRATIONS[sk]?.[next - 1];
  if (msg) showPracticeCelebration(msg);

  showPracticeStep(next);
}

function showPracticeCelebration(msg) {
  const el = document.getElementById('practiceCelebrationMsg');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._celebTimer);
  el._celebTimer = setTimeout(() => el.classList.add('hidden'), 5000);
}

function configurePracticeWorkflow(scenarioKey) {
  const promptSec = document.getElementById('practicePromptSection');
  const dialSec = document.getElementById('practiceDialogueSection');
  const analysisSec = document.getElementById('practiceAnalysisSection');
  const pickLabel = document.getElementById('taskOptionsPickLabel');

  promptSec?.classList.add('hidden');
  dialSec?.classList.add('hidden');
  analysisSec?.classList.add('hidden');
  ['aiResultBlockV1', 'aiResultBlockV2', 'aiResultBlockDialogue', 'aiResultBlockAnalysis'].forEach((id) => {
    document.getElementById(id)?.classList.add('hidden');
  });
  state.lastPracticeAiResult = null;
  if (pickLabel) pickLabel.textContent = TASK_PICK_LABELS[scenarioKey] || 'Выберите один из 5 вариантов';

  if (scenarioKey === 'block1-practice-prompt') promptSec?.classList.remove('hidden');
  else if (scenarioKey === 'block1-practice-scenario') dialSec?.classList.remove('hidden');
  else if (scenarioKey === 'block1-practice-hallucination') analysisSec?.classList.remove('hidden');
}

function updateFragmentPreview() {
  const el = document.getElementById('practiceFragmentPreview');
  if (!el) return;
  const task = getSelectedTaskOption();
  const text = task?.fragment_text || task?.context;
  if (!text) {
    el.textContent = 'Выберите вариант 1–5 выше.';
    return;
  }
  el.textContent = text;
}

function assembleDialogueStart() {
  const ai = document.getElementById('practiceRoleAi')?.value?.trim();
  const me = document.getElementById('practiceRoleMe')?.value?.trim();
  const task = getSelectedTaskOption();
  const lines = [];
  if (ai) lines.push(`ИИ = ${ai}`);
  if (me) lines.push(`Я = ${me}`);
  lines.push('Правила: короткие реплики (2–4 предложения), оставайся в роли, минимум 3–5 обменов.');
  if (task?.summary) lines.push(`Ситуация: ${task.summary}`);
  return lines.join('\n');
}

function getDialogueStartText() {
  const direct = document.getElementById('practiceDialogueStart')?.value?.trim();
  if (direct) return direct;
  return assembleDialogueStart();
}

function prefillDialogueFromTask(task) {
  if (!task || state.currentLesson?.scenario_key !== 'block1-practice-scenario') return;
  const aiEl = document.getElementById('practiceRoleAi');
  const meEl = document.getElementById('practiceRoleMe');
  const goalEl = document.getElementById('practiceStudentGoal');
  const startEl = document.getElementById('practiceDialogueStart');
  if (aiEl && !aiEl.value.trim() && task.ai_role) aiEl.value = task.ai_role;
  if (meEl && !meEl.value.trim() && task.student_role) meEl.value = task.student_role;
  if (goalEl && !goalEl.value.trim() && task.student_goal) goalEl.value = task.student_goal;
  if (startEl && !startEl.value.trim()) startEl.value = assembleDialogueStart();
}

function clearPracticeFormUi() {
  state.selectedTaskId = null;
  state.lastPracticeAiResult = null;
  state.currentConversationId = null;
  const ids = [
    'assignmentAnswer',
    'practicePromptV1',
    'practicePromptV2',
    'practiceImproveNotes',
    'practiceMainInsight',
    'practiceDialogueStart',
    'practiceStudentGoal',
    'practiceRoleAi',
    'practiceRoleMe',
    'practiceSafeVersion',
    'p2GoodReplies',
    'p2WeakReply',
    'p2AiIssues',
    'p2HarderInstruction',
    'p2ApplyWork',
    'promptFieldR',
    'promptFieldT',
    'promptFieldC',
    'promptFieldF',
    'promptFieldS',
    'promptFieldCriteria',
    'groupSizeInput',
    'groupInputBy',
    'checklistItem1',
    'checklistItem2',
    'checklistItem3',
    'checklistItem4',
    'checklistItem5'
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  }
  ['evalConcrete', 'evalTone', 'evalNoHype'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  document.querySelectorAll('input[name="riskDecision"]').forEach((r) => {
    r.checked = false;
  });
  ['aiResultV1Preview', 'aiResultV2Preview', 'aiResultDialoguePreview', 'aiResultAnalysisPreview'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  const riskBody = document.getElementById('riskTableBody');
  if (riskBody) {
    delete riskBody.dataset.inited;
    riskBody.innerHTML = '';
  }
  const mode = document.getElementById('practiceModeSelect');
  if (mode) mode.value = 'individual';
  syncPracticeModeUi();
  document.getElementById('taskOptionsList')?.querySelectorAll('.aa-task-card').forEach((btn) => {
    btn.classList.remove('is-selected');
    btn.setAttribute('aria-checked', 'false');
  });
  state.practiceStep = 1;
  state.practiceWorkflow = null;
  document.getElementById('caseBriefBlock')?.classList.add('hidden');
  document.getElementById('startPracticeBtn')?.classList.add('hidden');
  document.getElementById('practiceWorkflowBlock')?.classList.add('hidden');
  document.getElementById('practiceStepBar')?.classList.add('hidden');
  document.getElementById('practiceCelebrationMsg')?.classList.add('hidden');
  document.getElementById('practiceSubmitBlock')?.classList.add('hidden');
  document.getElementById('practiceSelfCheckBlock')?.classList.add('hidden');
  document.getElementById('practiceSelfCheckList') && (document.getElementById('practiceSelfCheckList').innerHTML = '');
  ['aiResultBlockV1', 'aiResultBlockV2', 'aiResultBlockDialogue', 'aiResultBlockAnalysis'].forEach((id) => {
    document.getElementById(id)?.classList.add('hidden');
  });
  document.getElementById('assignmentFeedback')?.classList.add('hidden');
  document.getElementById('messagesContainer').innerHTML = '';
  updateFragmentPreview();
  updateTaskSelectReminder();
  closePracticeChat();
}

async function restartPractice() {
  if (!state.currentLessonId || !state.currentLesson) return;
  if (
    !confirm(
      'Начать задание сначала?\n\nБудут сброшены: выбор варианта, ответ, заметки и переписка с нейросетью по этой практике.'
    )
  ) {
    return;
  }
  await api(`/api/academy/lessons/${state.currentLessonId}/restart`, { method: 'POST' });
  clearPracticeFormUi();
  state.conversations = (await api('/api/academy/conversations')).conversations || [];
  renderConversationList();
  state.catalog = await api('/api/academy/catalog');
  renderCourseTree();
  await loadProgressSummary();
  const lesson = state.currentLesson;
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
  renderTaskOptions(lesson);
  configurePracticeWorkflow(lesson.scenario_key);
  showAutosaveStatus('Задание сброшено — можно пройти сначала', { hideAfterMs: 4000 });
}

function showPracticeAiResult(text, pass = 'v1') {
  if (!text?.trim()) return;
  state.lastPracticeAiResult = text.trim();
  const map = {
    v1: ['aiResultBlockV1', 'aiResultV1Preview'],
    v2: ['aiResultBlockV2', 'aiResultV2Preview'],
    dialogue: ['aiResultBlockDialogue', 'aiResultDialoguePreview'],
    analysis: ['aiResultBlockAnalysis', 'aiResultAnalysisPreview']
  };
  const [blockId, previewId] = map[pass] || map.v1;
  const block = document.getElementById(blockId);
  const preview = document.getElementById(previewId);
  if (block) block.classList.remove('hidden');
  if (preview) preview.textContent = state.lastPracticeAiResult;
  block?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  scheduleAutoSave();
}

function getSelectedTaskNumber() {
  const idx = state.taskOptions.findIndex((t) => t.id === state.selectedTaskId);
  return idx >= 0 ? idx + 1 : null;
}

async function runPracticeInAi({ message, runKind, pass = 'v1' }) {
  if (!warnIfNoTaskSelected()) return null;
  let text = String(message || '').trim();
  if (!text) {
    if (runKind === 'dialogue') text = getDialogueStartText();
    else if (runKind === 'analysis') {
      const task = getSelectedTaskOption();
      const frag = task?.fragment_text || task?.context;
      if (!frag) {
        alert('Сначала выберите фрагмент.');
        return null;
      }
      text = `Помоги разобрать фрагмент по шагам. Не пиши готовый отчёт целиком — подскажи, какие риски проверить и какие типы ошибок искать.\n\nФрагмент:\n${frag}`;
    } else text = getPracticePromptText(pass);
  }
  if (!text) {
    if (runKind === 'dialogue') alert('Укажите роли и первое сообщение (или нажмите «Собрать первое сообщение»).');
    else if (runKind === 'analysis') alert('Сначала выберите фрагмент.');
    else alert(pass === 'v2' ? 'Сначала напишите промпт v2.' : 'Сначала напишите промпт v1 или заполните RTCFSC.');
    return null;
  }
  if (state.streaming) return null;

  const btnId =
    runKind === 'dialogue'
      ? 'runDialogueInAiBtn'
      : runKind === 'analysis'
        ? 'runAnalysisInAiBtn'
        : pass === 'v2'
          ? 'runPromptV2Btn'
          : 'runPromptV1Btn';
  const runBtn = document.getElementById(btnId);
  runBtn?.setAttribute('disabled', 'true');

  const resultPass = runKind === 'prompt' ? pass : runKind === 'dialogue' ? 'dialogue' : 'analysis';

  try {
    scheduleAutoSave();
    await saveSubmission('draft');
    openPracticeChat();
    appendOptimisticUserMessage(text);
    const typingLabel = document.getElementById('typingLabel');
    if (typingLabel) {
      typingLabel.textContent =
        runKind === 'dialogue'
          ? 'Нейросеть отвечает в роли…'
          : runKind === 'analysis'
            ? 'Нейросеть готовит подсказку…'
            : pass === 'v2'
              ? 'Нейросеть выполняет промпт v2…'
              : 'Нейросеть выполняет промпт v1…';
    }
    document.getElementById('typingRow')?.classList.remove('hidden');

    const payload = {
      conversationId: state.currentConversationId || undefined,
      lessonId: state.currentLessonId || undefined,
      courseId: state.currentLesson?.course_id || undefined,
      message: text,
      model: document.getElementById('modelSelect').value,
      chatMode: 'practice_run',
      practiceRunContext: buildPracticeRunContext(runKind, pass)
    };

    const { assistantText } = await streamChat(payload);
    document.getElementById('typingRow')?.classList.add('hidden');
    if (assistantText) showPracticeAiResult(assistantText, resultPass);
    else alert('Ответ получен — откройте чат, чтобы прочитать полностью.');
    return assistantText;
  } catch (e) {
    document.getElementById('typingRow')?.classList.add('hidden');
    throw e;
  } finally {
    runBtn?.removeAttribute('disabled');
  }
}

function getSelectedTaskOption() {
  return state.taskOptions.find((t) => t.id === state.selectedTaskId) || null;
}

function updateTaskSelectReminder() {
  const el = document.getElementById('taskSelectReminder');
  if (!el) return;
  const show = state.taskOptions.length > 0 && !state.selectedTaskId;
  el.classList.toggle('hidden', !show);
}

function renderTaskOptionDetail() {
  const task = getSelectedTaskOption();
  const sk = state.currentLesson?.scenario_key;
  getPracticeWorkflowApi()?.renderCaseBrief(task, sk);
  updateFragmentPreview();
  prefillDialogueFromTask(task);
  prefillPromptFromTask(task);
  updateTaskSelectReminder();

  const startBtn = document.getElementById('startPracticeBtn');
  if (task && startBtn) {
    startBtn.classList.remove('hidden');
  } else if (startBtn) {
    startBtn.classList.add('hidden');
  }
}

function prefillPromptFromTask(task) {
  if (!task || state.currentLesson?.scenario_key !== 'block1-practice-prompt') return;
  const tEl = document.getElementById('promptFieldT');
  const cEl = document.getElementById('promptFieldC');
  if (tEl && !tEl.value.trim()) tEl.value = task.description || task.summary || '';
  if (cEl && !cEl.value.trim()) cEl.value = task.raw_input || task.context || '';
}

function selectTaskOption(taskId, { persist = true } = {}) {
  state.selectedTaskId = taskId || null;
  const list = document.getElementById('taskOptionsList');
  if (list) {
    list.querySelectorAll('.aa-task-card').forEach((btn) => {
      btn.classList.toggle('is-selected', btn.dataset.taskId === state.selectedTaskId);
      btn.setAttribute('aria-checked', btn.dataset.taskId === state.selectedTaskId ? 'true' : 'false');
    });
  }
  renderTaskOptionDetail();
  if (persist && state.currentLessonId) scheduleAutoSave();
}

function startPractice() {
  const sk = state.currentLesson?.scenario_key;
  if (!sk) return;
  const wf = document.getElementById('practiceWorkflowBlock');
  wf?.classList.remove('hidden');
  document.getElementById('startPracticeBtn')?.classList.add('hidden');
  if (sk === 'block1-practice-hallucination') {
    getPracticeWorkflowApi()?.initRiskTable();
  }
  const savedStep = state.practiceWorkflow?.currentStep;
  showPracticeStep(savedStep && savedStep > 1 ? savedStep : 1);
}

function buildPracticeReport() {
  const wfApi = getPracticeWorkflowApi();
  const task = getSelectedTaskOption();
  const num = getSelectedTaskNumber();
  const sk = state.currentLesson?.scenario_key;
  if (!wfApi || !sk || !task) {
    alert('Выберите вариант задания.');
    return;
  }
  const wf = wfApi.collectWorkflowFromUi(sk);
  let report = '';
  if (sk === 'block1-practice-prompt') report = wfApi.buildReportP1(task, wf, num);
  else if (sk === 'block1-practice-scenario') report = wfApi.buildReportP2(task, wf, num);
  else if (sk === 'block1-practice-hallucination') report = wfApi.buildReportP3(task, wf, num);
  const ta = document.getElementById('assignmentAnswer');
  if (ta && report) {
    ta.value = report;
    scheduleAutoSave();
    advancePracticeStep();
  }
}

function validateBeforeSubmit() {
  const sk = state.currentLesson?.scenario_key;
  const wfApi = getPracticeWorkflowApi();
  if (!wfApi || !sk) return true;
  if (wfApi.selfCheckComplete(sk)) return true;
  return confirm(
    'Рекомендуем отметить все пункты самооценки перед отправкой. Всё равно отправить ответ?'
  );
}

function renderTaskOptions(lesson) {
  const block = document.getElementById('taskOptionsBlock');
  const list = document.getElementById('taskOptionsList');
  if (!block || !list) return;
  state.taskOptions = parseTaskOptions(lesson?.assignment);
  if (!state.taskOptions.length) {
    block.classList.add('hidden');
    list.innerHTML = '';
    state.selectedTaskId = null;
    return;
  }
  block.classList.remove('hidden');
  list.innerHTML = '';
  state.taskOptions.forEach((task, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'aa-task-card';
    btn.dataset.taskId = task.id;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', 'false');
    btn.innerHTML = `<span class="aa-task-card-num">${idx + 1}</span><span><span class="aa-task-card-title">${escapeHtml(task.title)}</span><span class="aa-task-card-summary">${escapeHtml(task.summary || '')}</span></span>`;
    btn.addEventListener('click', () => selectTaskOption(task.id));
    list.appendChild(btn);
  });
  if (state.selectedTaskId && state.taskOptions.some((t) => t.id === state.selectedTaskId)) {
    selectTaskOption(state.selectedTaskId, { persist: false });
  } else {
    state.selectedTaskId = null;
    updateTaskSelectReminder();
  }
}

function updateOpenPracticeChatLabel(scenarioKey) {
  const btn = document.getElementById('openPracticeChatBtn');
  if (btn && scenarioKey === 'block1-practice-scenario') {
    btn.textContent = 'Продолжить диалог в чате (мин. 4 пары)';
  } else if (btn) btn.textContent = 'Продолжить в чате';
}

function setPracticeChatOpen(open) {
  const app = document.getElementById('app');
  const chat = document.getElementById('chatSection');
  const openBtn = document.getElementById('openPracticeChatBtn');
  const closeBtn = document.getElementById('closePracticeChatBtn');
  const backBtn = document.getElementById('backToAssignmentBtn');
  if (!app || !chat) return;
  if (open) {
    chat.classList.remove('chat-collapsed');
    app.classList.add('practice-chat-open');
    if (window.innerWidth < 1280) app.classList.add('practice-chat-mobile');
    openBtn?.classList.add('hidden');
    closeBtn?.classList.remove('hidden');
    backBtn?.classList.remove('hidden');
    document.getElementById('composer')?.focus();
  } else {
    chat.classList.add('chat-collapsed');
    app.classList.remove('practice-chat-open', 'practice-chat-mobile');
    openBtn?.classList.remove('hidden');
    closeBtn?.classList.add('hidden');
    backBtn?.classList.add('hidden');
    document.getElementById('lessonPanel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function setPracticeFocusMode(on, lesson = null) {
  const app = document.getElementById('app');
  if (!app) return;
  if (on && lesson && isModuleOnePractice(lesson)) {
    app.classList.add('practice-focus');
    document.getElementById('sidebarFreeChatBlock')?.classList.add('hidden');
    document.getElementById('practiceActionsRow')?.classList.remove('hidden');
    document.getElementById('toggleChatAdvancedBtn')?.classList.remove('hidden');
    document.getElementById('lessonPanelSubtitle').textContent = lesson.title || 'Практика';
    updateOpenPracticeChatLabel(lesson.scenario_key);
    setPracticeChatOpen(false);
    if (!isToolsPanelCollapsed()) applyToolsPanelCollapsed(true);
  } else {
    app.classList.remove('practice-focus', 'practice-chat-open', 'practice-chat-mobile');
    document.getElementById('sidebarFreeChatBlock')?.classList.remove('hidden');
    document.getElementById('practiceActionsRow')?.classList.add('hidden');
    document.getElementById('practiceWorkflowBlock')?.classList.add('hidden');
    document.getElementById('taskOptionsBlock')?.classList.add('hidden');
    document.getElementById('toggleChatAdvancedBtn')?.classList.add('hidden');
    document.getElementById('chatAdvancedBlock')?.classList.add('hidden');
    document.getElementById('chatSection')?.classList.remove('chat-collapsed');
    document.getElementById('backToAssignmentBtn')?.classList.add('hidden');
    document.getElementById('openPracticeChatBtn')?.classList.remove('hidden');
    document.getElementById('closePracticeChatBtn')?.classList.add('hidden');
  }
}

function openPracticeChat() {
  if (!state.selectedTaskId && state.taskOptions.length) {
    document.getElementById('taskSelectReminder')?.classList.remove('hidden');
    document.getElementById('taskOptionsBlock')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  setPracticeChatOpen(true);
}

function closePracticeChat() {
  setPracticeChatOpen(false);
}

function warnIfNoTaskSelected() {
  if (!state.taskOptions.length) return true;
  if (state.selectedTaskId) return true;
  document.getElementById('taskSelectReminder')?.classList.remove('hidden');
  document.getElementById('taskOptionsBlock')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  return false;
}

async function loadSubmissionForLesson(lessonId) {
  const data = await api('/api/academy/lessons/' + lessonId + '/submission');
  if (data.submission?.answer_text) document.getElementById('assignmentAnswer').value = data.submission.answer_text;
  else document.getElementById('assignmentAnswer').value = '';
  if (data.submission?.practice_mode) document.getElementById('practiceModeSelect').value = data.submission.practice_mode;
  syncPracticeModeUi();
  const gm = getSubmissionGroupMeta(data.submission);
  if (gm.size) document.getElementById('groupSizeInput').value = gm.size;
  if (gm.input_by) document.getElementById('groupInputBy').value = gm.input_by;
  restorePromptDraftFromMeta(gm);
  if (gm.selected_task_id && state.taskOptions.some((t) => t.id === gm.selected_task_id)) {
    selectTaskOption(gm.selected_task_id, { persist: false });
  }
  if (gm.workflow && getPracticeWorkflowApi()) {
    state.practiceWorkflow = gm.workflow;
    getPracticeWorkflowApi().restoreWorkflowToUi(gm.workflow, state.currentLesson?.scenario_key);
    const savedStep = gm.workflow.currentStep;
    if (savedStep && savedStep >= 1 && state.selectedTaskId) {
      document.getElementById('practiceWorkflowBlock')?.classList.remove('hidden');
      document.getElementById('startPracticeBtn')?.classList.add('hidden');
      showPracticeStep(savedStep);
    }
  }
  let fj = data.submission?.feedback_json;
  if (typeof fj === 'string') try { fj = JSON.parse(fj); } catch { fj = null; }
  if (fj && Object.keys(fj).length) renderAssignmentFeedback(fj);
  else document.getElementById('assignmentFeedback')?.classList.add('hidden');
}
let autosaveTimer = null;

function showAutosaveStatus(text, { hideAfterMs = 2500 } = {}) {
  const el = document.getElementById('autosaveStatus');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(el._hideTimer);
  if (hideAfterMs > 0) {
    el._hideTimer = setTimeout(() => el.classList.add('hidden'), hideAfterMs);
  }
}

function scheduleAutoSave() {
  if (!state.currentLessonId) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    saveSubmission('draft')
      .then(() => showAutosaveStatus('Сохранено автоматически'))
      .catch(() => showAutosaveStatus('Не удалось сохранить'));
  }, 800);
}

async function saveSubmission(status) {
  if (!state.currentLessonId) return;
  await api('/api/academy/lessons/' + state.currentLessonId + '/submission', {
    method: 'PUT',
    body: JSON.stringify({
      answer_text: document.getElementById('assignmentAnswer')?.value?.trim() || '',
      assignment_status: status,
      practice_mode: document.getElementById('practiceModeSelect')?.value || 'individual',
      group_meta: buildGroupMetaForSave()
    })
  });
}

async function markLessonCompleted() {
  if (!state.currentLessonId) return;
  await api('/api/academy/progress', {
    method: 'POST',
    body: JSON.stringify({ lessonId: state.currentLessonId, status: 'completed' })
  });
  state.catalog = await api('/api/academy/catalog');
  renderCourseTree();
  await loadProgressSummary();
}

async function submitPracticeAnswer() {
  if (!state.currentLessonId) return;
  if (!warnIfNoTaskSelected()) return;
  if (!validateBeforeSubmit()) return;
  const answer_text = document.getElementById('assignmentAnswer')?.value?.trim();
  if (!answer_text) return alert('Введите ответ или нажмите «Собрать отчёт».');
  await saveSubmission('submitted');
  await markLessonCompleted();
  showAutosaveStatus('Задание отправлено · практика пройдена', { hideAfterMs: 4000 });
}

function initAssignmentAutoSave() {
  const fields = [
    'assignmentAnswer',
    'practicePromptV1',
    'practicePromptV2',
    'practiceImproveNotes',
    'practiceMainInsight',
    'practiceDialogueStart',
    'practiceStudentGoal',
    'practiceRoleAi',
    'practiceRoleMe',
    'practiceSafeVersion',
    'p2GoodReplies',
    'p2WeakReply',
    'p2AiIssues',
    'p2HarderInstruction',
    'p2ApplyWork',
    'promptFieldR',
    'promptFieldT',
    'promptFieldC',
    'promptFieldF',
    'promptFieldS',
    'promptFieldCriteria',
    'groupSizeInput',
    'groupInputBy',
    'checklistItem1',
    'checklistItem2',
    'checklistItem3',
    'checklistItem4',
    'checklistItem5'
  ];
  for (const id of fields) {
    const el = document.getElementById(id);
    if (!el || el.dataset.autosaveBound) continue;
    el.dataset.autosaveBound = '1';
    el.addEventListener('input', scheduleAutoSave);
    el.addEventListener('change', scheduleAutoSave);
  }
  const mode = document.getElementById('practiceModeSelect');
  if (mode && !mode.dataset.autosaveBound) {
    mode.dataset.autosaveBound = '1';
    mode.addEventListener('change', () => {
      syncPracticeModeUi();
      scheduleAutoSave();
    });
  }
}
async function loadPromptLibrary() {
  try { const d = await api('/api/academy/prompts'); state.promptLibrary = d.prompts || []; renderPromptLibrary(); } catch (_) {}
}
function renderPromptLibrary() {
  const ul = document.getElementById('promptLibraryList');
  if (!ul) return;
  ul.innerHTML = '';
  for (const pr of state.promptLibrary) {
    const li = document.createElement('li');
    li.textContent = pr.title + ' (' + (pr.category || '') + ')';
    ul.appendChild(li);
  }
}
function renderCompareResults(data) {
  const box = document.getElementById('compareOutput');
  if (!box) return;
  box.innerHTML = '';
  state.compareSessionId = data.session_id;
  (data.results || []).forEach((r) => {
    const d = document.createElement('div');
    d.className = 'compare-col text-xs mb-2';
    d.innerHTML = '<b>' + escapeHtml(r.model) + '</b><pre class="whitespace-pre-wrap max-h-20 overflow-auto">' + escapeHtml((r.response||'').slice(0,800)) + '</pre><label><input type="radio" name="cc" value="' + escapeHtml(r.model) + '"> Лучший</label>';
    box.appendChild(d);
  });
  const b = document.createElement('button');
  b.textContent = 'Сохранить выбор';
  b.type = 'button';
  b.className = 'aa-btn aa-btn-ghost mt-2';
  b.onclick = async () => {
    const c = document.querySelector('input[name=cc]:checked');
    if (!c || !state.compareSessionId) return alert('Выберите модель');
    await api('/api/academy/model-compare/' + state.compareSessionId + '/choice', { method: 'POST', body: JSON.stringify({ chosen_model: c.value }) });
    document.getElementById('compareChoiceHint').textContent = 'Сохранено: ' + c.value;
  };
  box.appendChild(b);
}
async function loadHallucinationScenarios() {
  try {
    const d = await api('/api/academy/hallucination/scenarios');
    state.hallucinationScenarios = d.scenarios || [];
    const sel = document.getElementById('hallucinationScenarioSelect');
    if (!sel) return;
    sel.innerHTML = '';
    state.hallucinationScenarios.forEach((s) => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.title; sel.appendChild(o); });
    renderHallucinationScenarioUi();
  } catch (_) {}
}
function renderHallucinationScenarioUi() {
  const s = state.hallucinationScenarios.find((x) => x.id === document.getElementById('hallucinationScenarioSelect')?.value);
  if (!s) return;
  document.getElementById('hallucinationFlawed').textContent = s.flawed_answer || '';
  const is = document.getElementById('hallucinationIssueSelect');
  is.innerHTML = '';
  let types = s.issue_types;
  if (typeof types === 'string') try { types = JSON.parse(types); } catch { types = []; }
  (types || []).forEach((t) => { const o = document.createElement('option'); o.value = t; o.textContent = t; is.appendChild(o); });
}

function renderCourseTree() {
  const root = document.getElementById('courseTree');
  if (!root || !state.catalog) return;
  root.innerHTML = '';
  const byCourse = {};
  for (const l of getMvpLessons()) {
    if (!byCourse[l.course_id]) byCourse[l.course_id] = [];
    byCourse[l.course_id].push(l);
  }
  for (const c of getMvpCourses()) {
    const wrap = document.createElement('div');
    wrap.className = 'mb-3';
    const title = document.createElement('div');
    title.className = 'text-sm font-semibold text-slate-800 mb-1 leading-snug';
    title.textContent = 'Модуль 1 — практики';
    wrap.appendChild(title);
    if (c.description) {
      const desc = document.createElement('p');
      desc.className = 'text-xs text-slate-500 mb-2 leading-snug';
      desc.textContent = c.description;
      wrap.appendChild(desc);
    }
    const ul = document.createElement('ul');
    ul.className = 'space-y-0.5 ml-2 border-l-2 border-blue-200 pl-2';
    for (const l of byCourse[c.id] || []) {
      const li = document.createElement('li');
      const prog = state.catalog.progress[l.id];
      const check = prog?.status === 'completed' ? '✓ ' : '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'aa-lesson-btn' + (state.currentLessonId === l.id ? ' is-active' : '');
      btn.textContent = check + l.title;
      btn.addEventListener('click', () => selectLesson(l));
      li.appendChild(btn);
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

function bindPracticeHints(scenarioKey) {
  const row = document.getElementById('practiceHintsRow');
  const sel = document.getElementById('practiceHintSelect');
  if (!row || !sel) return;
  const hints = scenarioKey ? (PRACTICE_HINTS[scenarioKey] || []) : [];
  if (!hints.length) {
    row.classList.add('hidden');
    sel.innerHTML = '';
    return;
  }
  row.classList.remove('hidden');
  sel.innerHTML = '';
  for (const h of hints) {
    const o = document.createElement('option');
    o.value = h.text;
    o.textContent = h.label;
    sel.appendChild(o);
  }
}

function insertPracticeHintIntoComposer() {
  const sel = document.getElementById('practiceHintSelect');
  const composer = document.getElementById('composer');
  if (!sel?.value || !composer) return;
  const task = getSelectedTaskOption();
  let text = sel.value;
  if (task) text += `\n\nМой выбранный вариант: «${task.title}». Контекст: ${task.context}`;
  if (document.getElementById('app')?.classList.contains('practice-focus')) {
    if (!warnIfNoTaskSelected()) return;
    openPracticeChat();
  }
  composer.value = text;
  composer.focus();
}

function renderConversationList() {
  const ul = document.getElementById('conversationList');
  ul.innerHTML = '';
  for (const c of state.conversations) {
    const li = document.createElement('li');
    li.className = 'flex items-center gap-0.5 rounded hover:bg-slate-100';

    const sel = document.createElement('button');
    sel.type = 'button';
    sel.className = 'aa-conv-btn' + (c.id === state.currentConversationId ? ' is-active' : '');
    sel.textContent = c.title || 'Чат';
    sel.addEventListener('click', () => loadConversation(c.id));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className =
      'shrink-0 w-8 py-1 text-center text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded text-xl leading-none transition-colors';
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
  const actionSel = document.getElementById('kbActionSelect');
  if (!sel) return;
  sel.innerHTML = `<option value="">${tr('academy.controls.no_kb', 'Без базы знаний')}</option>`;
  if (actionSel) {
    actionSel.innerHTML = '<option value="">Выберите базу знаний</option>';
  }
  for (const kb of state.knowledgeBases) {
    const o = document.createElement('option');
    o.value = kb.id;
    o.textContent = kb.name;
    sel.appendChild(o);
    if (actionSel) {
      const actionOption = document.createElement('option');
      actionOption.value = kb.id;
      actionOption.textContent = kb.name;
      actionSel.appendChild(actionOption);
    }
  }
  if (state.selectedKnowledgeBaseId) sel.value = state.selectedKnowledgeBaseId;
  if (actionSel && state.selectedKnowledgeBaseId) actionSel.value = state.selectedKnowledgeBaseId;
}

function populatePersonas() {
  const sel = document.getElementById('personaSelect');
  if (!sel) return;
  sel.innerHTML = `<option value="">${tr('academy.controls.no_persona', 'Без персоны')}</option>`;
  for (const p of state.personas) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = getLocalizedPersonaName(p);
    sel.appendChild(o);
  }
}

function normalizeKbStatus(rawStatus) {
  const status = String(rawStatus || '').toLowerCase();
  if (/ready|indexed|completed|done|ok|available|success/.test(status)) {
    return { css: 'status-ready', label: 'готово' };
  }
  if (/error|failed|failure/.test(status)) {
    return { css: 'status-error', label: 'ошибка' };
  }
  return { css: 'status-pending', label: status || 'в обработке' };
}

function hasPendingKbStatus(rows) {
  return (rows || []).some((d) => {
    const status = String(d?.status || '').toLowerCase();
    return ['uploaded', 'queued', 'processing', 'indexing', 'pending'].includes(status);
  });
}

function isTerminalKbStatus(statusRaw) {
  const status = String(statusRaw || '').toLowerCase();
  return ['indexed', 'ready', 'failed', 'error'].includes(status);
}

function stopKbStatusPolling() {
  if (kbStatusPollTimer) {
    clearInterval(kbStatusPollTimer);
    kbStatusPollTimer = null;
  }
}

function ensureKbStatusPolling() {
  if (kbStatusPollTimer) return;
  kbStatusPollTimer = setInterval(async () => {
    if (kbStatusPollBusy || !state.selectedKnowledgeBaseId) return;
    kbStatusPollBusy = true;
    try {
      const result = await refreshKbStatus();
      if (!result.pending) {
        stopKbStatusPolling();
      }
    } catch (_) {
      /* keep timer; next tick can recover */
    } finally {
      kbStatusPollBusy = false;
    }
  }, 3500);
}

async function refreshKbStatus() {
  const box = document.getElementById('kbStatusList');
  if (!box) return { rows: [], pending: false };
  box.innerHTML = '';
  if (!state.selectedKnowledgeBaseId) {
    stopKbStatusPolling();
    const empty = document.createElement('div');
    empty.className = 'kb-empty';
    empty.textContent = tr('academy.kb.select_for_status', 'Выберите базу знаний для просмотра статусов.');
    box.appendChild(empty);
    return { rows: [], pending: false };
  }
  const rows = (await api(`/api/academy/knowledge-bases/${state.selectedKnowledgeBaseId}/documents`)).documents || [];
  if (state.activeKnowledgeBaseId === state.selectedKnowledgeBaseId) {
    state.knowledgeDocuments = rows;
    renderKnowledgeDocuments(state.selectedKnowledgeBaseId);
  }
  if (!rows.length) {
    stopKbStatusPolling();
    const empty = document.createElement('div');
    empty.className = 'kb-empty';
    empty.textContent = tr('academy.kb.no_docs', 'Документов пока нет.');
    box.appendChild(empty);
    return { rows, pending: false };
  }
  const nonTerminalRows = rows.filter((d) => !isTerminalKbStatus(d.status));
  if (!nonTerminalRows.length) {
    const info = document.createElement('div');
    info.className = 'kb-empty';
    info.textContent = 'Все документы обработаны. Текущие файлы смотрите в списке базы ниже.';
    box.appendChild(info);
  }
  nonTerminalRows.slice(0, 12).forEach((d) => {
    const row = document.createElement('div');
    row.className = 'kb-status-row';
    const displayName = d.original_name || d.name || 'document';
    const statusInfo = normalizeKbStatus(d.status);
    const statusPill = document.createElement('span');
    statusPill.className = `kb-status-pill ${statusInfo.css}`;
    statusPill.textContent = statusInfo.label;
    statusPill.title = `Статус: ${d.status || 'unknown'}`;
    const text = document.createElement('span');
    text.className = 'kb-status-text';
    text.title = d.error_message ? `${displayName} (${d.error_message})` : displayName;
    text.textContent = displayName;
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'icon-btn danger';
    delBtn.textContent = '×';
    delBtn.title = 'Удалить файл';
    delBtn.setAttribute('aria-label', `Удалить файл ${displayName}`);
    delBtn.addEventListener('click', () => deleteDocumentHandler(d.id));
    row.appendChild(statusPill);
    row.appendChild(text);
    row.appendChild(delBtn);
    box.appendChild(row);
  });
  const pending = hasPendingKbStatus(rows);
  if (pending) ensureKbStatusPolling();
  else stopKbStatusPolling();
  return { rows, pending };
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
  if (!lesson) return;
  state.currentLessonId = lesson.id;
  state.currentLesson = lesson;
  state.selectedTaskId = null;
  document.getElementById('lessonPanel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('lessonEmpty')?.classList.add('hidden');
  document.getElementById('lessonContent')?.classList.remove('hidden');
  const lc = document.getElementById('lessonContent');
  if (lc) lc.innerHTML = renderMarkdown(lesson.content_md || '');
  document.getElementById('lessonHint').textContent = (lesson.course_title || '') + ' · ' + lesson.title;
  const ab = document.getElementById('assignmentBlock');
  const at = document.getElementById('assignmentText');
  const asn = lesson.assignment;
  if (asn && ab && at) {
    ab.classList.remove('hidden');
    document.getElementById('assignmentTitle').textContent = asn.title || 'Задание';
    at.innerHTML = renderMarkdown(asn.instructions_md || '');
    document.getElementById('askMentorAssignmentBtn')?.classList.add('hidden');
    renderTaskOptions(lesson);
    configurePracticeWorkflow(lesson.scenario_key);
    bindPracticeHints(lesson.scenario_key);
    setPracticeFocusMode(true, lesson);
    initAssignmentAutoSave();
  } else {
    ab?.classList.add('hidden');
    document.getElementById('askMentorAssignmentBtn')?.classList.add('hidden');
    bindPracticeHints(null);
    setPracticeFocusMode(false);
  }
  try { await loadSubmissionForLesson(lesson.id); } catch (e) { console.warn(e); }
  let conv = state.conversations.find((c) => c.lesson_id === lesson.id);
  if (!conv) {
    conv = await api('/api/academy/conversations', { method: 'POST', body: JSON.stringify({ lessonId: lesson.id, courseId: lesson.course_id, title: lesson.title, model: document.getElementById('modelSelect').value }) });
    state.conversations.unshift(conv);
  }
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
  } else {
    document.getElementById('lessonHint').textContent = '';
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
  actions.className = 'flex gap-2 mt-1 text-xs text-slate-500';
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'hover:text-slate-900 transition-colors';
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

function appendOptimisticUserMessage(message, files = []) {
  const box = document.getElementById('messagesContainer');
  if (!box) return;
  const meta = files.length
    ? {
        files: files.map((file) => ({ name: file.name, size: file.size }))
      }
    : undefined;
  box.appendChild(
    renderMessageEl({
      role: 'user',
      content: message || '',
      meta
    })
  );
  box.scrollTop = box.scrollHeight;
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
    if (payload.chatMode) fd.append('chatMode', payload.chatMode);
    if (payload.practiceRunContext) {
      fd.append('practiceRunContext', JSON.stringify(payload.practiceRunContext));
    }
    if (payload.regenerate) fd.append('regenerate', 'true');
    if (payload.chatMode) fd.append('chatMode', payload.chatMode);
    if (payload.knowledgeBaseId) fd.append('knowledgeBaseId', payload.knowledgeBaseId);
    if (payload.strictMode) fd.append('strictMode', 'true');
    if (payload.personaId) fd.append('personaId', payload.personaId);
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

  let assistantText = assembled?.trim() || '';
  if (state.currentConversationId) {
    const data = await api(`/api/academy/conversations/${state.currentConversationId}`);
    renderMessages(data.messages || []);
    const assistants = (data.messages || []).filter((m) => m.role === 'assistant');
    const last = assistants[assistants.length - 1];
    if (last?.content) assistantText = String(last.content).trim();
    state.conversations = (await api('/api/academy/conversations')).conversations;
    renderConversationList();
  }
  return { assistantText };
}

function setComposerBusy(busy) {
  document.getElementById('sendBtn').disabled = busy;
  document.getElementById('composer').disabled = busy;
  const fi = document.getElementById('fileInput');
  if (fi) fi.disabled = busy;
  const ig = document.getElementById('imageGenBtn');
  if (ig) ig.disabled = busy;
}

function initToolTabs() {
  const tabs = Array.from(document.querySelectorAll('[data-tool-tab]'));
  const panels = Array.from(document.querySelectorAll('[data-tool-panel]'));
  if (!tabs.length || !panels.length) return;
  const activate = (id) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.toolTab === id;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.toolPanel === id));
  };
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activate(tab.dataset.toolTab));
  });
}


function isToolsPanelCollapsed() {
  return document.getElementById('app')?.classList.contains('tools-panel-collapsed');
}

function updateToolsPanelToggleUi(collapsed) {
  const hideBtn = document.getElementById('hideToolsPanelBtn');
  const showBtn = document.getElementById('showToolsPanelBtn');
  if (hideBtn) {
    hideBtn.textContent = collapsed ? 'Показать инструменты' : 'Скрыть инструменты';
  }
  if (showBtn) {
    const app = document.getElementById('app');
    const appVisible = app && !app.classList.contains('hidden');
    showBtn.classList.toggle('hidden', !(collapsed && appVisible && window.innerWidth >= 1280));
  }
}

function applyToolsPanelCollapsed(collapsed, { persist = true } = {}) {
  const app = document.getElementById('app');
  if (!app) return;
  app.classList.toggle('tools-panel-collapsed', collapsed);
  if (persist) localStorage.setItem(TOOLS_COLLAPSED_KEY, collapsed ? '1' : '0');

  const left = parseInt(getComputedStyle(app).getPropertyValue('--left-pane-width'), 10) || 272;
  const lesson = parseInt(getComputedStyle(app).getPropertyValue('--lesson-pane-width'), 10) || 352;
  let right = parseInt(getComputedStyle(app).getPropertyValue('--right-pane-width'), 10) || 320;

  if (collapsed) {
    if (persist) localStorage.setItem(TOOLS_RIGHT_WIDTH_KEY, String(right));
    const expanded = Math.min(672, Math.max(400, lesson + right));
    app.style.setProperty('--lesson-pane-expanded-width', `${expanded}px`);
  } else {
    const saved = parseInt(localStorage.getItem(TOOLS_RIGHT_WIDTH_KEY), 10);
    if (saved > 260) right = saved;
    app.style.removeProperty('--lesson-pane-expanded-width');
  }

  if (academyLayoutSetWidths) academyLayoutSetWidths(left, lesson, right);
  updateToolsPanelToggleUi(collapsed);
}

function initToolsPanelToggle() {
  const hideBtn = document.getElementById('hideToolsPanelBtn');
  const collapseBtn = document.getElementById('collapseToolsPanelBtn');
  const showBtn = document.getElementById('showToolsPanelBtn');
  const toggle = () => applyToolsPanelCollapsed(!isToolsPanelCollapsed());
  hideBtn?.addEventListener('click', toggle);
  collapseBtn?.addEventListener('click', toggle);
  showBtn?.addEventListener('click', toggle);
  window.addEventListener('resize', () => updateToolsPanelToggleUi(isToolsPanelCollapsed()));
  if (localStorage.getItem(TOOLS_COLLAPSED_KEY) === '1') {
    applyToolsPanelCollapsed(true, { persist: false });
  } else {
    updateToolsPanelToggleUi(false);
  }
}

function initResizableLayout() {
  const app = document.getElementById('app');
  const leftSidebar = document.getElementById('leftSidebar');
  const lessonPanel = document.getElementById('lessonPanel');
  const toolsPanel = document.getElementById('toolsPanel');
  const leftSplitter = document.getElementById('leftSplitter');
  const lessonSplitter = document.getElementById('lessonSplitter');
  const rightSplitter = document.getElementById('rightSplitter');
  if (!app || !leftSidebar || !toolsPanel) return;

  function setWidths(leftPx, lessonPx, rightPx) {
    const collapsed = app.classList.contains('tools-panel-collapsed');
    app.style.setProperty('--left-pane-width', `${leftPx}px`);
    app.style.setProperty('--lesson-pane-width', `${lessonPx}px`);
    app.style.setProperty('--right-pane-width', `${rightPx}px`);
    if (window.innerWidth >= 768) {
      leftSidebar.style.width = `${leftPx}px`;
      leftSidebar.style.flexBasis = `${leftPx}px`;
    } else {
      leftSidebar.style.width = '';
      leftSidebar.style.flexBasis = '';
    }
    if (lessonPanel && window.innerWidth >= 1280) {
      if (collapsed) {
        const savedRight = parseInt(localStorage.getItem(TOOLS_RIGHT_WIDTH_KEY), 10) || rightPx;
        let expanded = parseInt(getComputedStyle(app).getPropertyValue('--lesson-pane-expanded-width'), 10);
        if (!expanded || Number.isNaN(expanded)) {
          expanded = Math.min(672, Math.max(400, lessonPx + savedRight));
          app.style.setProperty('--lesson-pane-expanded-width', `${expanded}px`);
        }
        lessonPanel.style.width = `${expanded}px`;
        lessonPanel.style.flexBasis = `${expanded}px`;
      } else {
        lessonPanel.style.width = `${lessonPx}px`;
        lessonPanel.style.flexBasis = `${lessonPx}px`;
      }
    } else if (lessonPanel) {
      lessonPanel.style.width = '';
      lessonPanel.style.flexBasis = '';
    }
    if (window.innerWidth >= 1280 && !collapsed) {
      toolsPanel.style.width = `${rightPx}px`;
      toolsPanel.style.flexBasis = `${rightPx}px`;
    } else {
      toolsPanel.style.width = '';
      toolsPanel.style.flexBasis = '';
    }
  }

  setWidths(272, 352, 320);
  window.addEventListener('resize', () => {
    setWidths(
      parseInt(getComputedStyle(app).getPropertyValue('--left-pane-width'), 10) || 272,
      parseInt(getComputedStyle(app).getPropertyValue('--lesson-pane-width'), 10) || 352,
      parseInt(getComputedStyle(app).getPropertyValue('--right-pane-width'), 10) || 320
    );
  });

  function bindSplitter(splitter, side) {
    if (!splitter) return;
    splitter.addEventListener('pointerdown', (e) => {
      if (side === 'left' && window.innerWidth < 768) return;
      if (side === 'lesson' && window.innerWidth < 1280) return;
      if (side === 'right' && (window.innerWidth < 1280 || app.classList.contains('tools-panel-collapsed'))) return;
      splitter.setPointerCapture(e.pointerId);
      splitter.classList.add('is-dragging');
      const startX = e.clientX;
      const leftStart = leftSidebar.getBoundingClientRect().width;
      const lessonStart = lessonPanel ? lessonPanel.getBoundingClientRect().width : 352;
      const rightStart = toolsPanel.getBoundingClientRect().width;
      const onMove = (ev) => {
        if (side === 'left') {
          setWidths(Math.max(220, Math.min(400, leftStart + (ev.clientX - startX))), lessonStart, rightStart);
        } else if (side === 'lesson' && lessonPanel) {
          const nextLesson = Math.max(280, Math.min(672, lessonStart + (startX - ev.clientX)));
          if (app.classList.contains('tools-panel-collapsed')) {
            app.style.setProperty('--lesson-pane-expanded-width', `${nextLesson}px`);
            lessonPanel.style.width = `${nextLesson}px`;
            lessonPanel.style.flexBasis = `${nextLesson}px`;
          } else {
            setWidths(leftStart, nextLesson, rightStart);
          }
        } else {
          setWidths(leftStart, lessonStart, Math.max(260, Math.min(480, rightStart - (ev.clientX - startX))));
        }
      };
      const onUp = () => {
        splitter.classList.remove('is-dragging');
        splitter.removeEventListener('pointermove', onMove);
        splitter.removeEventListener('pointerup', onUp);
      };
      splitter.addEventListener('pointermove', onMove);
      splitter.addEventListener('pointerup', onUp);
    });
  }

  bindSplitter(leftSplitter, 'left');
  bindSplitter(lessonSplitter, 'lesson');
  bindSplitter(rightSplitter, 'right');
  academyLayoutSetWidths = setWidths;
}

function applyAcademyTranslations() {
  const map = {
    newChatBtn: 'academy.sidebar.new_chat',
    conversationTitle: 'academy.chat.title_placeholder',
    composer: 'academy.chat.composer_placeholder',
    sendBtn: 'academy.chat.send',
    regenerateBtn: 'academy.chat.regenerate',
    retryBtn: 'academy.chat.retry',
    kbNameInput: 'academy.kb.name_placeholder',
    createKbBtn: 'academy.kb.create',
    uploadKbBtn: 'academy.kb.upload_docs',
    savePromptBtn: 'academy.prompts.save',
    evaluatePromptBtn: 'academy.prompts.evaluate',
    compareModelsInput: 'academy.models.compare_placeholder',
    runCompareBtn: 'academy.models.compare',
    runPlaygroundBtn: 'academy.models.playground',
    createAssistantBtn: 'academy.assistant.create',
    runWorkflowBtn: 'academy.assistant.run_workflow',
    hallucinationAttemptBtn: 'academy.training.submit',
    generateCertBtn: 'academy.training.generate_cert',
    dialogsHeading: 'academy.sidebar.dialogs',
    kbHeading: 'academy.kb.heading',
    promptsHeading: 'academy.prompts.heading',
    modelsHeading: 'academy.models.heading',
    assistantHeading: 'academy.assistant.heading',
    trainingHeading: 'academy.training.heading'
  };
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = tr(key, el.placeholder);
    } else {
      el.textContent = tr(key, el.textContent);
    }
  });

  const title = document.querySelector('[data-i18n="academy.brand"]');
  if (title) title.textContent = tr('academy.brand', title.textContent);
  const toolsTitle = document.querySelector('[data-i18n="academy.tools.title"]');
  if (toolsTitle) toolsTitle.textContent = tr('academy.tools.title', toolsTitle.textContent);
  document.querySelectorAll('[data-tool-tab]').forEach((tab) => {
    const key = `academy.tabs.${tab.dataset.toolTab}`;
    tab.textContent = tr(key, tab.textContent);
  });

  populateKnowledgeBases();
  populatePersonas();
  refreshKbStatus().catch(() => {});
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
    state.currentLesson = null;
    state.selectedTaskId = null;
    state.taskOptions = [];
    setPracticeFocusMode(false);
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
    document.getElementById('lessonEmpty')?.classList.remove('hidden');
    document.getElementById('lessonContent')?.classList.add('hidden');
    document.getElementById('assignmentBlock')?.classList.add('hidden');
  });

  document.getElementById('sendBtn').addEventListener('click', sendHandler);
  document.getElementById('imageGenBtn')?.addEventListener('click', imageGenHandler);

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
    state.activeKnowledgeBaseId = state.selectedKnowledgeBaseId;
    if (state.selectedKnowledgeBaseId) {
      await openKnowledgeBase(state.selectedKnowledgeBaseId);
    } else {
      state.knowledgeDocuments = [];
      renderKnowledgeBases();
    }
    await refreshKbStatus();
  });
  document.getElementById('kbActionSelect')?.addEventListener('change', async () => {
    const selected = document.getElementById('kbActionSelect').value || null;
    state.selectedKnowledgeBaseId = selected;
    state.activeKnowledgeBaseId = selected;
    const kbControl = document.getElementById('knowledgeBaseSelect');
    if (kbControl) kbControl.value = selected || '';
    if (selected) {
      await openKnowledgeBase(selected);
    } else {
      state.knowledgeDocuments = [];
      renderKnowledgeBases();
    }
    await refreshKbStatus();
  });
  document.getElementById('openSelectedKbBtn')?.addEventListener('click', async () => {
    const selected = document.getElementById('kbActionSelect')?.value || state.selectedKnowledgeBaseId;
    if (!selected) {
      alert('Сначала выберите базу знаний.');
      return;
    }
    state.selectedKnowledgeBaseId = selected;
    state.activeKnowledgeBaseId = selected;
    const kbControl = document.getElementById('knowledgeBaseSelect');
    if (kbControl) kbControl.value = selected;
    await openKnowledgeBase(selected);
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
    const text =
      document.getElementById('promptTrainerInput')?.value.trim() ||
      document.getElementById('assignmentAnswer')?.value.trim() ||
      document.getElementById('composer').value.trim();
    if (!text) return;
    const out = await api('/api/academy/prompt-evaluate', {
      method: 'POST',
      body: JSON.stringify({ prompt: text, model: document.getElementById('modelSelect').value })
    });
    document.getElementById('promptEvalOutput').textContent = JSON.stringify(out, null, 2);
    const wrap = document.getElementById('promptCompareBeforeAfter');
    if (wrap && out.improved_prompt) {
      wrap.classList.remove('hidden');
      document.getElementById('promptBefore').textContent = text;
      document.getElementById('promptAfter').textContent = out.improved_prompt;
    }
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
    renderCompareResults(out);
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
    const scenarioId = document.getElementById('hallucinationScenarioSelect')?.value;
    const selected_issue = document.getElementById('hallucinationIssueSelect')?.value;
    const explanation = document.getElementById('hallucinationExplanation')?.value?.trim();
    if (!scenarioId || !selected_issue || !explanation) return alert('Заполните поля');
    const out = await api('/api/academy/hallucination/attempt', { method: 'POST', body: JSON.stringify({ scenario_id: scenarioId, selected_issue, explanation }) });
    document.getElementById('trainingOutput').textContent = 'Оценка: ' + out.attempt?.score + '/10\n' + (out.attempt?.feedback || '');
    if (state.currentLessonId) { document.getElementById('assignmentAnswer').value = selected_issue + ': ' + explanation; await saveSubmission('submitted'); }
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


  initAssignmentAutoSave();
  document.getElementById('submitAnswerBtn')?.addEventListener('click', async () => {
    try {
      await submitPracticeAnswer();
    } catch (e) {
      alert(e.message || 'Не удалось отправить');
    }
  });
  document.getElementById('assemblePromptV1Btn')?.addEventListener('click', () => {
    const assembled = assembleRtcfsсPrompt();
    if (!assembled) return alert('Заполните хотя бы один блок RTCFSC.');
    const v1 = document.getElementById('practicePromptV1');
    if (v1) v1.value = assembled;
    scheduleAutoSave();
  });
  document.getElementById('runPromptV1Btn')?.addEventListener('click', () => {
    runPracticeInAi({ runKind: 'prompt', pass: 'v1' }).catch((e) =>
      alert(e.message || 'Не удалось получить ответ')
    );
  });
  document.getElementById('runPromptV2Btn')?.addEventListener('click', () => {
    runPracticeInAi({ runKind: 'prompt', pass: 'v2' }).catch((e) =>
      alert(e.message || 'Не удалось получить ответ')
    );
  });
  document.getElementById('buildReportP1Btn')?.addEventListener('click', () => buildPracticeReport());
  document.getElementById('buildReportP2Btn')?.addEventListener('click', () => buildPracticeReport());
  document.getElementById('buildReportP3Btn')?.addEventListener('click', () => buildPracticeReport());
  document.getElementById('assembleDialogueBtn')?.addEventListener('click', () => {
    const msg = assembleDialogueStart();
    if (!msg) return alert('Заполните хотя бы одну роль.');
    document.getElementById('practiceDialogueStart').value = msg;
    scheduleAutoSave();
  });
  document.getElementById('runDialogueInAiBtn')?.addEventListener('click', () => {
    runPracticeInAi({ message: getDialogueStartText(), runKind: 'dialogue' }).catch((e) =>
      alert(e.message || 'Не удалось начать диалог')
    );
  });
  document.getElementById('runAnalysisInAiBtn')?.addEventListener('click', () => {
    runPracticeInAi({ runKind: 'analysis' }).catch((e) =>
      alert(e.message || 'Не удалось начать разбор')
    );
  });
  document.getElementById('startPracticeBtn')?.addEventListener('click', () => startPractice());
  document.getElementById('practiceNextS1Btn')?.addEventListener('click', () => advancePracticeStep());
  document.getElementById('practiceNextP2S1Btn')?.addEventListener('click', () => advancePracticeStep());
  document.getElementById('practiceNextP3S1Btn')?.addEventListener('click', () => advancePracticeStep());
  document.getElementById('restartPracticeBtn')?.addEventListener('click', () => {
    restartPractice().catch((e) => alert(e.message || 'Не удалось сбросить задание'));
  });
  document.getElementById('riskTableBody')?.addEventListener('input', scheduleAutoSave);
  document.getElementById('riskTableBody')?.addEventListener('change', scheduleAutoSave);
  document.getElementById('practiceSelfCheckList')?.addEventListener('change', scheduleAutoSave);
  ['evalConcrete', 'evalTone', 'evalNoHype'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', scheduleAutoSave);
  });
  document.querySelectorAll('input[name="riskDecision"]').forEach((r) => {
    r.addEventListener('change', scheduleAutoSave);
  });
  document.getElementById('openPracticeChatBtn')?.addEventListener('click', () => openPracticeChat());
  document.getElementById('closePracticeChatBtn')?.addEventListener('click', () => closePracticeChat());
  document.getElementById('backToAssignmentBtn')?.addEventListener('click', () => closePracticeChat());
  document.getElementById('sidebarOpenChatBtn')?.addEventListener('click', () => {
    document.getElementById('newChatBtn')?.click();
  });
  document.getElementById('toggleChatAdvancedBtn')?.addEventListener('click', () => {
    document.getElementById('chatAdvancedBlock')?.classList.toggle('hidden');
    document.getElementById('modelHint')?.classList.toggle('hidden');
  });
  window.addEventListener('resize', () => {
    const app = document.getElementById('app');
    if (app?.classList.contains('practice-chat-open') && window.innerWidth >= 1280) {
      app.classList.remove('practice-chat-mobile');
    } else if (app?.classList.contains('practice-chat-open') && window.innerWidth < 1280) {
      app.classList.add('practice-chat-mobile');
    }
  });

  document.getElementById('requestFeedbackBtn')?.addEventListener('click', async () => {
    if (!state.currentLessonId) return;
    if (!warnIfNoTaskSelected()) return;
    const answer_text = document.getElementById('assignmentAnswer')?.value?.trim();
    if (!answer_text) return alert('Введите ответ');
    await saveSubmission('submitted');
    const out = await api('/api/academy/lessons/' + state.currentLessonId + '/feedback', { method: 'POST', body: JSON.stringify({ answer_text, model: document.getElementById('modelSelect').value }) });
    renderAssignmentFeedback(out.feedback);
    state.catalog = await api('/api/academy/catalog');
    renderCourseTree();
    await loadProgressSummary();
  });
  document.getElementById('askMentorAssignmentBtn')?.addEventListener('click', () => {
    openPracticeChat();
    document.getElementById('composer').value =
      'Помоги с текущей практикой Модуля 1: направь по шагам, но не делай задание за меня (не пиши готовый ответ целиком).';
    document.getElementById('composer').focus();
  });
  document.getElementById('practiceHintBtn')?.addEventListener('click', () => insertPracticeHintIntoComposer());
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
    li.className = 'kb-empty';
    li.textContent = 'Нет баз знаний';
    ul.appendChild(li);
    return;
  }
  for (const kb of state.knowledgeBases) {
    const li = document.createElement('li');
    const isActive = state.activeKnowledgeBaseId === kb.id;
    li.className = `kb-card ${isActive ? 'is-active' : ''}`;
    li.innerHTML = `
      <div class="kb-header">
        <button type="button" data-open-kb="${kb.id}" class="kb-open-btn ${isActive ? 'font-semibold' : ''} truncate">${escapeHtml(kb.name)}</button>
        <span class="kb-meta">${kb.documents_count || 0} док.</span>
        <button type="button" data-del-kb="${kb.id}" class="icon-btn danger" title="Удалить базу">Удалить</button>
      </div>
      <div id="kb-docs-${kb.id}" class="${isActive ? 'kb-docs' : 'hidden kb-docs'}"></div>
      <div id="kb-actions-${kb.id}" class="${isActive ? 'kb-actions' : 'hidden kb-actions'}">
        <div class="kb-meta">Переименовать базу</div>
        <div class="flex gap-1">
          <input type="text" data-rename-kb="${kb.id}" value="${escapeHtml(kb.name)}" class="flex-1 border rounded px-1 py-1 text-[10px]" />
          <button type="button" data-save-kb="${kb.id}" class="icon-btn" title="Сохранить новое имя">Сохранить</button>
        </div>
        <input type="text" data-search-kb="${kb.id}" placeholder="Поиск документов..." class="w-full border rounded px-2 py-1 text-[10px]" />
        <input type="file" data-upload-kb="${kb.id}" class="text-[10px] w-full" multiple />
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
  ul.querySelectorAll('[data-save-kb]').forEach((btn) => {
    btn.addEventListener('click', () => renameKnowledgeBaseHandler(btn.getAttribute('data-save-kb')));
  });
  ul.querySelectorAll('[data-search-kb]').forEach((input) => {
    input.addEventListener('input', () => searchKnowledgeDocumentsHandler(input.getAttribute('data-search-kb'), input.value));
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
    box.innerHTML = '<div class="kb-empty">Документов пока нет</div>';
    return;
  }
  for (const d of state.knowledgeDocuments) {
    const displayName = d.original_name || d.name || 'document';
    const row = document.createElement('div');
    row.className = 'kb-doc-row';
    row.innerHTML = `
      <span class="name" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>
      <span class="kb-meta">${formatBytes(d.size_bytes)}</span>
      <button type="button" data-download-doc="${d.id}" class="icon-btn" title="Скачать файл">Скачать</button>
      <button type="button" data-del-doc="${d.id}" class="icon-btn danger" title="Удалить файл">Удалить</button>
    `;
    box.appendChild(row);
  }
  box.querySelectorAll('[data-download-doc]').forEach((btn) => {
    btn.addEventListener('click', () => downloadDocumentHandler(btn.getAttribute('data-download-doc')));
  });
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
    populateKnowledgeBases();
    renderKnowledgeBases();
  } catch (e) {
    alert(e.message || 'Не удалось создать базу знаний');
  }
}

async function openKnowledgeBase(kbId) {
  state.activeKnowledgeBaseId = kbId;
  state.selectedKnowledgeBaseId = kbId;
  try {
    const docs = await api(`/api/academy/knowledge-bases/${kbId}/documents`);
    state.knowledgeDocuments = docs.documents || [];
    populateKnowledgeBases();
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
      state.selectedKnowledgeBaseId = null;
      state.knowledgeDocuments = [];
    }
    populateKnowledgeBases();
    renderKnowledgeBases();
    await refreshKbStatus();
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
    const res = await fetch(`${apiBase}/api/academy/knowledge-bases/${kbId}/documents/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || res.statusText);
    inputEl.value = '';
    await openKnowledgeBase(kbId);
    state.knowledgeBases = (await api('/api/academy/knowledge-bases')).knowledgeBases || [];
    populateKnowledgeBases();
    renderKnowledgeBases();
    await refreshKbStatus();
  } catch (e) {
    alert(e.message || 'Не удалось загрузить документы');
  }
}

async function renameKnowledgeBaseHandler(kbId) {
  const input = document.querySelector(`[data-rename-kb="${kbId}"]`);
  const name = input?.value?.trim();
  if (!name) return;
  try {
    await api(`/api/academy/knowledge-bases/${kbId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name })
    });
    state.knowledgeBases = (await api('/api/academy/knowledge-bases')).knowledgeBases || [];
    populateKnowledgeBases();
    renderKnowledgeBases();
    await refreshKbStatus();
  } catch (e) {
    alert(e.message || 'Не удалось переименовать базу знаний');
  }
}

async function searchKnowledgeDocumentsHandler(kbId, query) {
  if (state.activeKnowledgeBaseId !== kbId) return;
  try {
    const params = new URLSearchParams();
    if (query?.trim()) params.set('q', query.trim());
    const url = `/api/academy/knowledge-bases/${kbId}/documents/search${params.toString() ? `?${params}` : ''}`;
    const docs = await api(url);
    state.knowledgeDocuments = docs.documents || [];
    renderKnowledgeDocuments(kbId);
  } catch (e) {
    alert(e.message || 'Не удалось выполнить поиск');
  }
}

async function downloadDocumentHandler(documentId) {
  try {
    const token = getToken();
    const res = await fetch(`${apiBase}/api/academy/knowledge-documents/${documentId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || res.statusText);
    }
    const blob = await res.blob();
    const cd = res.headers.get('content-disposition') || '';
    const match = cd.match(/filename="?([^"]+)"?/i);
    const filename = match?.[1] || 'document';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e) {
    alert(e.message || 'Не удалось скачать документ');
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
    populateKnowledgeBases();
    renderKnowledgeBases();
    await refreshKbStatus();
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

  const selectedFiles = fileInput?.files ? Array.from(fileInput.files) : [];
  appendOptimisticUserMessage(text, selectedFiles);
  const typingLabel = document.getElementById('typingLabel');
  if (typingLabel) typingLabel.textContent = 'Нейросеть обрабатывает запрос...';
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

window.addEventListener('academy-language-changed', () => applyAcademyTranslations());
initLanguageEvents();
initToolTabs();
initResizableLayout();
initToolsPanelToggle();
init();
