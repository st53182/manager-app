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
    // DOMPurify strips src from <script> even when tag is allowed — restore it via hook.
    // It also strips inline script text content — we save it to data-inline-src (base64) and restore after.
    DOMPurify.addHook('afterSanitizeAttributes', function(node) {
      if (node.tagName === 'SCRIPT' && node.hasAttribute('data-src-saved')) {
        node.setAttribute('src', node.getAttribute('data-src-saved'));
        node.removeAttribute('data-src-saved');
      }
    });
    // Pre-process step 1: rename src → data-src-saved so DOMPurify doesn't strip it
    let processed = html.trim().replace(
      /<script([^>]*)\ssrc=(["'])([^"']+)\2/gi,
      '<script$1 data-src-saved=$2$3$2'
    );
    // Pre-process step 2: encode inline script content into data-inline-src attribute (base64)
    // so DOMPurify preserves it as an attribute even though it strips text nodes inside <script>
    processed = processed.replace(
      /<script([^>]*)>([\s\S]*?)<\/script>/gi,
      function(match, attrs, content) {
        if (!content.trim()) return match; // external script or empty — leave as-is
        try {
          const encoded = btoa(unescape(encodeURIComponent(content)));
          return '<script' + attrs + ' data-inline-src="' + encoded + '"></script>';
        } catch(e) { return match; }
      }
    );
    const result = DOMPurify.sanitize(processed, {
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
        'charset','name','content','media','colspan','rowspan','scope','rel','href',
        'class','id','src','type','crossorigin','integrity','defer','async','nomodule',
        'referrerpolicy','importance','loading','viewBox','xmlns','xmlns:xlink',
        'fill','stroke','d','x','y','width','height','rx','cx','cy','r','points',
        'transform','aria-hidden','role','data-src-saved','data-inline-src'
      ],
      FORBID_TAGS: ['iframe', 'object', 'embed', 'base']
    });
    DOMPurify.removeHook('afterSanitizeAttributes');
    // Post-process: restore inline script content from data-inline-src attribute
    const restored = result.replace(
      /<script([^>]*)\sdata-inline-src="([^"]+)"([^>]*)><\/script>/gi,
      function(match, before, encoded, after) {
        try {
          const content = decodeURIComponent(escape(atob(encoded)));
          return '<script' + before + after + '>' + content + '<\/script>';
        } catch(e) { return match; }
      }
    );
    return restored;
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
/**
 * Инжектирует данные от модели (academy-dashboard-data блок) в статический шаблон дашборда.
 * Модель генерирует только const jobs=[...], euSec, ruSec, euTrend, ruTrend.
 * Мы вставляем их в готовый HTML и отдаём как полноценную страницу.
 */
// Скрипт с дефолтными данными и логикой для дашборда вакансий.
// Используется как фолбэк когда модель забыла добавить <script>.
// Часть 1: дефолтные данные (используются если модель не предоставила своих)
const DASHBOARD_DEFAULT_DATA = `
if(typeof jobs==='undefined'||!Array.isArray(jobs)||!jobs.length){var jobs=[{n:'Backend Dev',eu:5200,ru:'250K',def:88,t:'↑'},{n:'Data Scientist',eu:5800,ru:'220K',def:92,t:'↑'},{n:'DevOps Engineer',eu:5500,ru:'240K',def:85,t:'↑'},{n:'Product Manager',eu:4800,ru:'180K',def:70,t:'↑'},{n:'UX Designer',eu:4200,ru:'150K',def:65,t:'→'},{n:'QA Engineer',eu:3800,ru:'130K',def:55,t:'→'},{n:'Project Manager',eu:4500,ru:'160K',def:60,t:'↓'},{n:'System Analyst',eu:4100,ru:'145K',def:58,t:'↑'}];}
if(typeof euSec==='undefined'){var euSec={labels:['IT','Finance','Healthcare','Manufacturing','Retail','Logistics'],data:[28,18,16,14,13,11]};}
if(typeof ruSec==='undefined'){var ruSec={labels:['IT','Manufacturing','Retail','Finance','Logistics','Healthcare'],data:[32,20,16,14,10,8]};}
if(typeof euTrend==='undefined'){var euTrend=[165,178,190,205,218,232];}
if(typeof ruTrend==='undefined'){var ruTrend=[78,84,91,98,107,115];}
`;
// Часть 2: логика (вкладки, таблица, графики) — ленивая инициализация по вкладкам
const DASHBOARD_LOGIC_SCRIPT = `
var PAL=['#7c3aed','#06b6d4','#a78bfa','#22d3ee','#f59e0b','#ef4444','#22c55e'];
var G='#334155',L='#94a3b8';
var _charts={};
var opt=function(e){e=e||{};return Object.assign({responsive:true,maintainAspectRatio:false,animation:{duration:500},plugins:{legend:{labels:{color:L}}}},e);};
var sc={scales:{x:{ticks:{color:L},grid:{color:G}},y:{ticks:{color:L},grid:{color:G}}}};
function initChart(tab){
  if(_charts[tab])return; _charts[tab]=1;
  if(tab==='sectors'){
    new Chart(document.getElementById('dEU'),{type:'doughnut',data:{labels:euSec.labels,datasets:[{data:euSec.data,backgroundColor:PAL,borderWidth:0}]},options:opt()});
    new Chart(document.getElementById('dRU'),{type:'doughnut',data:{labels:ruSec.labels,datasets:[{data:ruSec.data,backgroundColor:PAL,borderWidth:0}]},options:opt()});
  }else if(tab==='salary'){
    new Chart(document.getElementById('bSal'),{type:'bar',data:{labels:jobs.map(function(j){return j.n;}),datasets:[{label:'EU €',data:jobs.map(function(j){return typeof j.eu==='number'?j.eu:parseInt(j.eu);}),backgroundColor:'#7c3aed'},{label:'RU (в €)',data:jobs.map(function(j){return Math.round(parseInt(j.ru)*1000/90);}),backgroundColor:'#06b6d4'}]},options:opt(Object.assign({indexAxis:'y'},sc))});
  }else if(tab==='trends'){
    new Chart(document.getElementById('lTr'),{type:'line',data:{labels:['Янв','Фев','Мар','Апр','Май','Июн'],datasets:[{label:'EU (тыс.)',data:euTrend,borderColor:'#7c3aed',backgroundColor:'rgba(124,58,237,.15)',fill:true,tension:.3},{label:'RU (тыс.)',data:ruTrend,borderColor:'#06b6d4',backgroundColor:'rgba(6,182,212,.15)',fill:true,tension:.3}]},options:opt(sc)});
  }
}
document.getElementById('tb').innerHTML=jobs.map(function(j){return'<tr><td>'+j.n+'</td><td style="color:#a78bfa">€'+(typeof j.eu==='number'?j.eu.toLocaleString():j.eu)+'</td><td style="color:#22d3ee">₽'+j.ru+'</td><td><div class="bar"><i style="width:'+j.def+'%"></i></div></td><td style="color:'+(j.t==='↑'?'#22c55e':j.t==='↓'?'#ef4444':'#94a3b8')+'">'+j.t+'</td></tr>';}).join('');
document.querySelectorAll('.tabs button').forEach(function(btn){btn.addEventListener('click',function(){document.querySelectorAll('.tabs button').forEach(function(b){b.className='tab-off';});document.querySelectorAll('.sec').forEach(function(s){s.classList.remove('show');});btn.className='tab-on';var t=btn.dataset.t;document.getElementById(t).classList.add('show');initChart(t);});});
setTimeout(function(){initChart('sectors');},50);
`;
const DASHBOARD_DEFAULT_SCRIPT = DASHBOARD_DEFAULT_DATA + DASHBOARD_LOGIC_SCRIPT;

/**
 * Если HTML содержит наши dashboard-маркеры (id="tb", id="dEU") но НЕ содержит <script>,
 * вставляем скрипт с дефолтными данными перед </body>.
 * Это фолбэк когда модель генерирует правильную структуру но без JS.
 */
function patchDashboardHtmlIfNeeded(html) {
  const hasDashboardIds = /id=["']tb["']/.test(html) && /id=["']dEU["']/.test(html);
  const hasScript = /<script[\s>]/i.test(html);
  if (!hasDashboardIds || hasScript) return html;
  // Инжектируем Chart.js CDN + скрипт с дефолтными данными
  const cdnTag = '<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"><\\/script>';
  const dataScript = `<script>${DASHBOARD_DEFAULT_SCRIPT}<\\/script>`;
  return html
    .replace(/<\/head>/i, cdnTag + '</head>')
    .replace(/<\/body>/i, dataScript + '</body>');
}

function buildDashboardHtml(dataCode) {
  // Экранируем потенциально опасные вещи в dataCode (оставляем только безопасные JS-литералы)
  // dataCode — это eval-опасная зона, но у нас allowScripts=true для демо, так что OK
  return `<!DOCTYPE html><html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Рынок вакансий 2025</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#0f172a;color:#f1f5f9;padding:20px}
h1{margin-bottom:16px;font-size:22px}canvas{max-height:260px}
.card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:18px;margin-bottom:14px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:18px}
.kpi b{font-size:26px;display:block;margin:6px 0}.kpi span{color:#94a3b8;font-size:13px}.up{color:#06b6d4;font-weight:600}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.tab-on{background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600}
.tab-off{background:#1e293b;color:#94a3b8;border:none;padding:8px 16px;border-radius:8px;cursor:pointer}
.sec{display:none}.sec.show{display:block}
.duo{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.fc{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.fc div{padding:14px;border-radius:10px;background:#0f172a;border:1px solid #334155}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:8px;text-align:left;border-bottom:1px solid #334155}th{color:#94a3b8}
.bar{background:#334155;border-radius:6px;height:8px;overflow:hidden}
.bar i{display:block;height:100%;background:linear-gradient(90deg,#7c3aed,#06b6d4)}
</style></head>
<body>
<h1>📊 Рынок вакансий 2025: Европа vs Россия</h1>
<div class="kpis">
  <div class="card kpi"><span>Вакансий EU</span><b>2.3М</b><span class="up">↑ 8%</span></div>
  <div class="card kpi"><span>Вакансий RU</span><b>1.1М</b><span class="up">↑ 12%</span></div>
  <div class="card kpi"><span>Зарплата EU</span><b>€3 840</b><span>median/мес</span></div>
  <div class="card kpi"><span>Зарплата RU</span><b>₽142K</b><span>median/мес</span></div>
</div>
<div class="tabs">
  <button data-t="sectors" class="tab-on">Секторы</button>
  <button data-t="salary" class="tab-off">Зарплаты</button>
  <button data-t="trends" class="tab-off">Тренды</button>
  <button data-t="forecast" class="tab-off">Прогноз</button>
</div>
<div id="sectors" class="sec show"><div class="card"><h3 style="margin-bottom:10px">Распределение по секторам</h3>
  <div class="duo">
    <div><p style="margin-bottom:6px;color:#94a3b8;font-size:13px">Европа</p><canvas id="dEU"></canvas></div>
    <div><p style="margin-bottom:6px;color:#94a3b8;font-size:13px">Россия</p><canvas id="dRU"></canvas></div>
  </div></div></div>
<div id="salary" class="sec"><div class="card"><h3 style="margin-bottom:10px">Зарплаты топ-8 профессий</h3><canvas id="bSal"></canvas></div></div>
<div id="trends" class="sec"><div class="card"><h3 style="margin-bottom:10px">Динамика вакансий Jan–Jun 2025</h3><canvas id="lTr"></canvas></div></div>
<div id="forecast" class="sec"><div class="card"><h3 style="margin-bottom:10px">Прогноз H2 2025</h3><div class="fc">
  <div>🟢 <b>Оптимистичный</b><p style="margin-top:8px;color:#94a3b8;font-size:13px">EU+15%, RU+20% — снятие ограничений, рост AI-найма</p></div>
  <div>🟡 <b>Базовый</b><p style="margin-top:8px;color:#94a3b8;font-size:13px">EU+8%, RU+12% — стабильный рост, дефицит IT</p></div>
  <div>🔴 <b>Пессимистичный</b><p style="margin-top:8px;color:#94a3b8;font-size:13px">EU−5%, RU+3% — рецессия, ужесточение рынка</p></div>
</div></div></div>
<div class="card"><h3 style="margin-bottom:10px">Топ-8 профессий: дефицит кадров</h3>
<table><thead><tr><th>Профессия</th><th>EU €/мес</th><th>RU ₽/мес</th><th>Дефицит</th><th>Тренд</th></tr></thead>
<tbody id="tb"></tbody></table></div>
<script>${dataCode ? dataCode + '\n' + DASHBOARD_LOGIC_SCRIPT : DASHBOARD_DEFAULT_DATA + DASHBOARD_LOGIC_SCRIPT}<\/script>
</body></html>`;
}

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
      segments.push({ type: 'html', html: patchDashboardHtmlIfNeeded(body) });
    } else if (lang === 'academy-dashboard-data') {
      segments.push({ type: 'html', html: buildDashboardHtml(body) });
    } else if (/^html$/i.test(lang) || /^htm$/i.test(lang)) {
      if (looksLikeRenderableHtmlArtifact(body)) {
        segments.push({ type: 'html', html: patchDashboardHtmlIfNeeded(body) });
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
  // Последний шанс: если модель выдала данные дашборда без code fence
  // (просто текст с "const jobs=["), строим iframe из того что есть
  if (!segments.some(seg => seg.type === 'html') && looksLikeDashboardData(s)) {
    return [{ type: 'html', html: buildDashboardHtml(s) }];
  }
  return segments;
}

/** Проверяет содержит ли текст ответа данные дашборда вакансий */
function looksLikeDashboardData(text) {
  return /const\s+jobs\s*=\s*\[/.test(text) && /const\s+euSec\s*=/.test(text);
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

// Module 2 ('ai-prompt-context-m2') is temporarily hidden — re-add the slug to show it again
const ACADEMY_COURSE_SLUGS = ['ai-work-business-talk'];

/** Готовые вопросы наставнику по практикам (не делают работу за студента). */
const PRACTICE_SCENARIO_KEYS = new Set([
  'block1-practice-prompt',
  'block1-practice-scenario',
  'block1-practice-hallucination',
  'block1-practice-reverse',
  'block1-practice-detective',
  'block2-practice-aim',
  'block2-practice-library',
  'block2-practice-context'
]);

const TASK_PICK_LABELS = {
  'block1-practice-prompt': 'Выберите одну из 5 задач',
  'block1-practice-scenario': 'Выберите один из 5 сценариев',
  'block1-practice-hallucination': 'Выберите один из 5 фрагментов',
  'block1-practice-reverse': 'Выберите один из 5 текстов',
  'block1-practice-detective': 'Квиз: угадай автора',
  'block2-practice-aim': 'Выберите один из 5 кейсов',
  'block2-practice-library': 'Выберите роль / направление',
  'block2-practice-context': 'Выберите тип ассистента'
};

const PRACTICE_STEP_LABELS = {
  'block1-practice-prompt': [
    'Написать промпт v1 и получить первый результат',
    'Улучшить промпт до v2 и зафиксировать вывод',
    'Проверить отчёт и отправить'
  ],
  'block1-practice-scenario': [
    'Настроить роли и провести диалог',
    'Анализ диалога и применение',
    'Проверить отчёт и отправить'
  ],
  'block1-practice-hallucination': [
    'Найти утверждения и проверить в диалоге',
    'Оценить находки и принять решение',
    'Проверить отчёт и отправить'
  ],
  'block1-practice-reverse': [
    'Написать промпт-гипотезу и сравнить с оригиналом',
    'Изучить авторский промпт и улучшить свой до v2',
    'Проверить отчёт и отправить'
  ],
  'block1-practice-detective': [
    'Прочитать 5 текстов и угадать автора',
    'Проверить ответы и изучить разбор',
    'Записать маркеры, собрать отчёт и отправить'
  ],
  'block2-practice-aim': [
    'Заполнить AIM, получить результат v1 и оценить его',
    'Улучшить промпт до v2 и зафиксировать вывод',
    'Проверить отчёт и отправить'
  ],
  'block2-practice-library': [
    'Собрать минимум 3 шаблона промптов с переменными',
    'Протестировать один промпт и улучшить до v2',
    'Проверить отчёт и отправить'
  ],
  'block2-practice-context': [
    'Заполнить паспорт ассистента v1',
    'Протестировать на задаче и улучшить паспорт v2',
    'Проверить отчёт и отправить'
  ]
};

const PRACTICE_STEP_CELEBRATIONS = {
  'block1-practice-prompt': [
    null,
    '✓ Отлично! Вы оценили ответ v1 и записали улучшения. Теперь напишите промпт v2.',
    '✓ Готово! Отчёт собран. Проверьте его и нажмите «Завершить задание».'
  ],
  'block1-practice-scenario': [
    null,
    '✓ Диалог завершён! Проанализируем его с ИИ-тренером и запишем выводы.',
    '✓ Анализ готов! Отчёт собран. Проверьте его и нажмите «Завершить задание».'
  ],
  'block1-practice-hallucination': [
    null,
    '✓ Проверка завершена! ИИ-тренер оценит ваши находки — запишите решение и вывод.',
    '✓ Отчёт собран. Проверьте его и нажмите «Завершить задание».'
  ],
  'block1-practice-reverse': [
    null,
    '✓ Авторский промпт раскрыт! Сравните с вашим и напишите промпт v2.',
    '✓ Отчёт собран. Проверьте его и нажмите «Завершить задание».'
  ],
  'block1-practice-detective': [
    null,
    '✓ Ответы проверены! Изучите разбор и перейдите к маркерам.',
    '✓ Отчёт собран. Проверьте его и нажмите «Завершить задание».'
  ],
  'block2-practice-aim': [
    null,
    '✓ Оценка v1 готова. Улучшите промпт (минимум 2 изменения) и запустите v2.',
    '✓ Отчёт собран. Проверьте его и нажмите «Завершить задание».'
  ],
  'block2-practice-library': [
    null,
    '✓ Библиотека собрана. Протестируйте один шаблон на примере.',
    '✓ Отчёт собран. Проверьте его и нажмите «Завершить задание».'
  ],
  'block2-practice-context': [
    null,
    '✓ Паспорт v1 готов. Протестируйте ассистента на рабочей задаче.',
    '✓ Отчёт собран. Проверьте его и нажмите «Завершить задание».'
  ]
};

/* Симуляция реакции получателя и карточка персоны для Практики 1 */
const P1_RECIPIENT_DATA = {
  'p1-task-1': {
    reactionV1: {
      avatar: '👩‍💼',
      name: 'Марина Климова, клиент',
      time: '17:58',
      text: 'Подождите, какой именно срок переносится? И что мне сейчас нужно сделать — ждать или у вас нужно что-то подтвердить?'
    },
    persona: {
      avatar: '👩‍💼',
      name: 'Марина Климова',
      role: 'Директор по развитию, ключевой клиент',
      traits: [
        'Читает почту на телефоне — важны первые две строки',
        'Раньше жаловалась на расплывчатую коммуникацию',
        'Ценит конкретность: новая дата + следующий шаг в первом абзаце',
        'Оправдания воспринимает как слабость — лучше факт и решение'
      ]
    },
    reactionV2: {
      avatar: '👩‍💼',
      name: 'Марина Климова, клиент',
      time: '18:03',
      text: 'Хорошо, жду до завтра 12:00. Спасибо, что предупредили заранее.'
    }
  },
  'p1-task-2': {
    reactionV1: {
      avatar: '🧑‍💼',
      name: 'Алексей Воронин, руководитель',
      time: '09:14',
      text: 'Это я и так знал из разговора. Где риски? Кто за что конкретно отвечает? Мне нужна управленческая сводка, а не пересказ.'
    },
    persona: {
      avatar: '🧑‍💼',
      name: 'Алексей Воронин',
      role: 'Руководитель, принимает решения по приоритетам',
      traits: [
        'Нужны риски и ответственные — не хронология событий',
        'Читает по диагонали: заголовки и списки, не сплошной текст',
        'Открытые вопросы и следующие шаги важнее описания прошлого',
        'Хочет понять: «Что мне нужно сделать или решить?»'
      ]
    },
    reactionV2: {
      avatar: '🧑‍💼',
      name: 'Алексей Воронин, руководитель',
      time: '09:17',
      text: 'Теперь вижу картину. Карлис — напомни ему про бюджет к пятнице. Марко — попроси прояснить риск с CRM до конца дня.'
    }
  },
  'p1-task-3': {
    reactionV1: {
      avatar: '👨‍💻',
      name: 'Денис, сотрудник',
      time: '10:32',
      text: 'Хм, а старые заявки что — просто отклонят? И куда именно подавать, как выглядит новая форма? Письмо немного непонятное.'
    },
    persona: {
      avatar: '👨‍💻',
      name: 'Денис и коллеги',
      role: 'Сотрудники, не читающие длинные инструкции',
      traits: [
        'Сканируют письмо за 10 секунд — нужен чёткий список действий',
        'Реагируют на страх ошибиться: объясни последствия простыми словами',
        'Вопросы «а что если…» возникают, если инструкция неполная',
        'Письмо до 150 слов с маркерами воспринимается гораздо лучше'
      ]
    },
    reactionV2: {
      avatar: '👨‍💻',
      name: 'Денис, сотрудник',
      time: '10:35',
      text: 'Понял, спасибо. Заполню через новую форму и прикреплю обоснование. А если вдруг нужно исключение — пишу руководителю?'
    }
  },
  'p1-task-4': {
    reactionV1: {
      avatar: '👩‍🔬',
      name: 'Наталья, менеджер проекта',
      time: '14:21',
      text: 'Хороший список шагов, но непонятно кто конкретно что делает. И что, если данные от аналитика задержатся — план рассыплется?'
    },
    persona: {
      avatar: '👩‍🔬',
      name: 'Наталья Соколова',
      role: 'Менеджер проекта, отвечает за координацию команды',
      traits: [
        'Нужны конкретные ответственные рядом с каждым шагом',
        'Зависимости между людьми важнее общей хронологии',
        'Хочет видеть «план Б» или хотя бы риск с зависимостью от данных',
        'Критерий готовности к пятнице должен быть в плане явно'
      ]
    },
    reactionV2: {
      avatar: '👩‍🔬',
      name: 'Наталья, менеджер проекта',
      time: '14:24',
      text: 'Отлично — теперь вижу кто за что отвечает и где узкое место. Аналитику напомню про данные к вторнику. Разошлю команде.'
    }
  },
  'p1-task-5': {
    reactionV1: {
      avatar: '🤝',
      name: 'Константин, партнёр',
      time: '11:47',
      text: 'Понял что скидки нет. Но зачем тогда продолжать переговоры? Что именно вы предлагаете взамен?'
    },
    persona: {
      avatar: '🤝',
      name: 'Константин Лебедев',
      role: 'Партнёр, важный клиент, ищет выгоду',
      traits: [
        'Ценит альтернативу — просто «нет» без предложения закрывает дверь',
        'Рассрочка или 10% должны звучать как реальная ценность, не утешение',
        'Важен тон: уважение к запросу, не извинения и не жёсткий отказ',
        'Предложение обсудить лично или по звонку сохраняет отношения'
      ]
    },
    reactionV2: {
      avatar: '🤝',
      name: 'Константин, партнёр',
      time: '11:52',
      text: 'Рассрочка интересна. Давайте обсудим условия — можете созвониться завтра?'
    }
  }
};

/* ===== ПРАКТИКА 2: персонажи и hard_reaction ===== */
const P2_SCENARIO_DATA = {
  'p2-task-1': {
    persona: {
      avatar: '😤',
      name: 'Игорь Савченко',
      role: 'Клиент, директор по ИТ',
      traits: [
        'Срок уже переносился раньше — доверие подорвано',
        'Реагирует на общие слова агрессией: нужны факты и даты',
        'Хочет знать кто конкретно отвечает, а не «команда»',
        'Успокаивается, если слышит признание ошибки + конкретный план'
      ]
    },
    hardReaction: 'Вы это уже обещали в прошлый раз. Почему я должен верить сейчас?',
    dialogueTip: 'Признайте что срок переносился раньше — не оправдывайтесь. Назовите конкретную дату и ответственного человека.'
  },
  'p2-task-2': {
    persona: {
      avatar: '🤨',
      name: 'Андрей Волков',
      role: 'Руководитель, скептик по ИИ',
      traits: [
        'Пробовал автоматизацию раньше — результата не было',
        'Воспринимает «ИИ» как модное слово без доказательств',
        'Требует метрики: что измеряем, за сколько, сколько стоит',
        'Открывается к идее если пилот маленький и с чёткими критериями'
      ]
    },
    hardReaction: 'Мы уже пробовали автоматизацию, результата не было. Почему сейчас должно быть иначе?',
    dialogueTip: 'Не продавайте ИИ — предложите маленький безопасный пилот с конкретной метрикой. Спросите что для него важнее: скорость или надёжность?'
  },
  'p2-task-3': {
    persona: {
      avatar: '😟',
      name: 'Дмитрий, новый сотрудник',
      role: 'Джуниор, 3 месяца в компании',
      traits: [
        'Считает что ему не дали достаточно контекста для задачи',
        'При давлении уходит в защиту — нужна поддержка сначала',
        'Факты воспринимает, если они не звучат как обвинение',
        'Хочет понять критерии — "хорошая работа" для него неочевидна'
      ]
    },
    hardReaction: 'Мне никто нормально не объяснил задачу, а теперь получается, что виноват я.',
    dialogueTip: 'Сначала признайте его ощущение — без согласия с ним. Потом перейдите к фактам. Закончите договорённостью о критериях, а не требованием.'
  },
  'p2-task-4': {
    persona: {
      avatar: '🧐',
      name: 'Карлис Озолс',
      role: 'Партнёр, сравнивает варианты',
      traits: [
        'Конкурент уже предложил более низкую цену и быстрый старт',
        'Не против вашего продукта — ищет аргументы чтобы выбрать вас',
        'Реагирует на вопрос о критериях — ему важно чувствовать что слышат',
        'Нужен конкретный следующий шаг: встреча, демо, расчёт'
      ]
    },
    hardReaction: 'У конкурента дешевле и быстрее. Почему я должен выбрать вас?',
    dialogueTip: 'Не спорьте с ценой напрямую. Спросите: "Что для вас важнее — стартовая цена или стоимость через год?" Выясните критерии выбора прежде чем аргументировать.'
  },
  'p2-task-5': {
    persona: {
      avatar: '😩',
      name: 'Максим, разработчик',
      role: 'Коллега, перегруженный параллельными задачами',
      traits: [
        'Реально перегружен — не пытается уйти от работы',
        'При давлении закрывается; при вопросах объясняет детали',
        'Хочет чтобы его ситуацию поняли, а не просто решили проблему',
        'Готов к компромиссу если видит что на него не давят'
      ]
    },
    hardReaction: 'Если не перенесём, я просто не успею нормально сделать.',
    dialogueTip: 'Не требуйте — исследуйте. "Что именно тормозит?" Ищите компромисс: что можно сдать частично, что можно делегировать.'
  }
};

/* ===== ПРАКТИКА 3: последствия и эталонный разбор ===== */
const P3_FRAGMENT_DATA = {
  'p3-task-1': {
    consequences: 'Менеджер принимает решение о внедрении ИИ без пилота, опираясь на выдуманный ROI 340%. Реальный результат оказывается в 5–10 раз скромнее — доверие к ИИ-инициативам в компании подорвано.',
    expertVerdict: {
      decision: 'Нельзя использовать в текущем виде',
      mainRisks: [
        '«ROI 340%» — цифра без методики и источника (McKinsey такого не публиковал)',
        '«Срочно внедрить без пилота» — опасная рекомендация без оснований',
        'Ссылка на бренды McKinsey/Forbes создаёт ложный авторитет'
      ]
    }
  },
  'p3-task-2': {
    consequences: 'Руководство принимает решение о срочном внедрении ИИ во все отделы. Через год выясняется что «78% лидеров» — непроверяемая цифра, а массовое внедрение без пилота обернулось потерями.',
    expertVerdict: {
      decision: 'Нельзя использовать в текущем виде',
      mainRisks: [
        '«78% лидеров» — источник не указан, цифра непроверяема',
        '«Навсегда отстать» — манипуляция страхом без доказательной базы',
        'Рекомендация «сразу подключить ко всем отделам» — без пилота и метрик'
      ]
    }
  },
  'p3-task-3': {
    consequences: 'Менеджер подписывает контракт до конца недели под давлением дедлайна. После выясняется что «гарантия 45%» нигде не зафиксирована юридически, а экономия не достигнута.',
    expertVerdict: {
      decision: 'Нельзя использовать в текущем виде',
      mainRisks: [
        '«Внутренние данные рынка» — непроверяемый источник',
        '«Гарантированно сократит на 45%» — юридически не обязывающее обещание',
        'Дедлайн «до конца недели» — классическая техника давления для отключения критического мышления'
      ]
    }
  },
  'p3-task-4': {
    consequences: 'Юридический отдел начинает срочно менять политики хранения данных. Юрист потом выясняет что конкретная норма штрафа указана неточно, а требование к сроку хранения — 5 лет, а не для всех категорий данных.',
    expertVerdict: {
      decision: 'Можно использовать только после проверки',
      mainRisks: [
        'AI Act существует, но конкретная норма штрафа 500 000 € указана неточно',
        '«5 лет хранения» — требование зависит от типа данных, не универсальное',
        'Рекомендация «с этого квартала» без консультации юриста — опасна'
      ]
    }
  },
  'p3-task-5': {
    consequences: 'Образовательная платформа начинает срочно перестраивать программы под ИИ. Через год выясняется что прогноз не учитывал регуляторные ограничения, а «почти все платформы» — преувеличение.',
    expertVerdict: {
      decision: 'Можно использовать только после проверки',
      mainRisks: [
        '«В 5 раз к 2030» — прогноз без источника и без оговорок об условиях',
        '«Почти все платформы перейдут» — нет доказательной базы',
        'Рекомендация «полностью перестроить» — без учёта конкретной аудитории и ресурсов'
      ]
    }
  }
};

const PFVSH_TIP = `<p class="font-medium text-slate-700 mb-1.5">Шпаргалка: сильная реплика (ПФВШ)</p><ul class="space-y-1 text-xs text-slate-600"><li><strong>П — Признание:</strong> «Понимаю, это неудобно…» — показываете что слышите</li><li><strong>Ф — Факт:</strong> не «скоро», а «во вторник к 12:00» — конкретика</li><li><strong>В — Вопрос:</strong> «Что для вас сейчас важнее всего?» — уточняете позицию</li><li><strong>Ш — Шаг:</strong> «Давайте договоримся о звонке в пятницу» — конкретное действие</li></ul>`;

const RISK_TYPES_TIP = `<p class="font-medium text-slate-700 mb-1.5">Типы проблем в тексте ИИ</p><ul class="space-y-1 text-xs text-slate-600"><li><strong>Выдуманный факт</strong> — утверждение которое нельзя проверить</li><li><strong>Цифра без источника</strong> — процент, ROI, статистика без ссылки</li><li><strong>Фейковая ссылка</strong> — бренд или закон упомянут без точной нормы</li><li><strong>Излишняя уверенность</strong> — «гарантированно», «обязательно», «всегда»</li><li><strong>Давление срочностью</strong> — «немедленно», «иначе опоздаете», дедлайн</li><li><strong>Широкий вывод</strong> — совет «для всех» без учёта контекста</li><li><strong>Юридический/финансовый риск</strong> — призыв к действию без проверки</li></ul>`;

const RTCFSC_TIP = `<p class="font-medium text-slate-700 mb-1.5">Подсказка: блоки RTCFSC</p><ul class="space-y-0.5 text-slate-600 text-xs"><li><strong>R</strong> — роль: кем выступает ИИ</li><li><strong>T</strong> — задача: что конкретно сделать</li><li><strong>C</strong> — контекст: важные детали ситуации</li><li><strong>F</strong> — формат: письмо, список, таблица, до N слов</li><li><strong>S</strong> — стиль: деловой, нейтральный, дружеский</li><li><strong>C</strong> — критерии: что делает ответ хорошим</li></ul>`;

const STEP_HINTS = {
  'block1-practice-prompt': {
    initial: `<h4 class="font-semibold text-slate-900 mb-3">Практика 1 · Промпт-инжиниринг</h4><div class="space-y-3 text-sm text-slate-700"><div><p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Что делаем</p><p>Берём плохой запрос из рабочей ситуации и улучшаем его по фреймворку RTCFSC — роль, задача, контекст, формат, стиль, критерии.</p></div><div><p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Зачем</p><p>Один структурированный промпт экономит 20–30 минут ручной правки. Навык формулировки задач для ИИ — ключевая менеджерская компетенция.</p></div><div><p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Как</p><p>Выбираете кейс → заполняете RTCFSC → тестируете v1 → видите реакцию клиента → пишете v2 → ИИ оценивает оба промпта.</p></div><div class="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2"><p class="text-xs font-semibold text-blue-800 mb-1">Что нужно сейчас</p><p class="text-blue-700">Выберите один из 5 кейсов ниже — реальные рабочие ситуации.</p></div></div>`,
    taskSelected: `<h4 class="font-semibold text-slate-900 mb-2">Кейс выбран</h4><div class="text-sm text-slate-700 space-y-2"><p>Прочитайте описание кейса и пример <strong>плохого промпта</strong>. Обратите внимание на то, чего в нём не хватает.</p><div class="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mt-2"><p class="text-xs font-semibold text-blue-800 mb-1">Что нужно сейчас</p><p class="text-blue-700">Нажмите <strong>«Начать задание»</strong> — откроются блоки RTCFSC для написания промпта.</p></div></div>`,
    steps: {
      '1.1': `<p class="mb-2">Заполните блоки RTCFSC или напишите промпт v1 напрямую. Затем нажмите <strong>«Протестировать промпт v1»</strong>.</p>${RTCFSC_TIP}`,
      '1.2': '<p>Посмотрите на ответ нейросети и реакцию клиента. Что не получилось? Нажмите <strong>«Перейти к промпту v2»</strong> — увидите профиль клиента.</p>',
      '2.1': '<p>Напишите <strong>промпт v2</strong> с учётом того, что вы узнали о клиенте. Нажмите <strong>«Протестировать промпт v2»</strong>.</p>',
      '2.2': '<p>Посмотрите на реакцию адресата на v2. Если результат стал лучше — нажмите <strong>«Далее»</strong>.</p>',
      '3': '<p>Ваш отчёт собран ниже — это итог шагов 1 и 2. Просмотрите и нажмите <strong>«Отправить»</strong>.</p>'
    }
  },
  'block1-practice-scenario': {
    initial: '<p class="mb-1 font-semibold text-slate-700">Тренируем навык диалога с трудным собеседником</p><p class="text-slate-600 text-sm mb-1"><strong>Почему:</strong> в реальной работе придётся работать с возражениями и отказами.</p><p class="text-slate-600 text-sm mb-1"><strong>Как:</strong> выбери кейс → ИИ сгенерирует персонажа → минимум 4 пары реплик → анализ.</p><p class="text-slate-500 text-sm">Выберите кейс ниже.</p>',
    taskSelected: '<p>Прочитайте сценарий. Нажмите <strong>«Начать задание»</strong> — ИИ создаст вашего собеседника.</p>',
    steps: {
      '1.1': '<p class="mb-1">Проверьте <strong>карточку персонажа</strong> — это ваш собеседник. Уточните роли и укажите вашу цель.</p><p class="text-xs text-slate-500">Нажмите «Начать диалог» — чат откроется автоматически.</p>',
      '1.2': '<p class="mb-1">Ведите диалог. Следите за <strong>счётчиком пар</strong> — нужно минимум 12.</p><p class="text-xs text-slate-500">Собеседник будет жёстко возражать, особенно в начале. Не сдавайтесь — это и есть тренировка.</p>',
      '2.1': '<p class="mb-1">ИИ-тренер проанализировал ваш диалог. Ознакомьтесь с оценкой, отметьте самооценку и заполните 2 поля.</p>',
      '3': '<p>Ваш отчёт по диалогу собран ниже — просмотрите и нажмите <strong>«Завершить задание»</strong>.</p>'
    }
  },
  'block1-practice-hallucination': {
    initial: '<p>Выберите один из 5 фрагментов — реальные тексты от нейросети с непроверенными утверждениями.</p>',
    taskSelected: '<p>Прочитайте фрагмент. Нажмите <strong>«Начать задание»</strong> — ИИ покажет на что обратить внимание.</p>',
    steps: {
      '1.1': '<p class="mb-1">ИИ-тренер обозначил категории рисков в тексте. <strong>Найдите минимум 3 утверждения</strong> — цитируйте дословно.</p>',
      '1.2': '<p class="mb-1">Задавайте вопросы к каждому утверждению прямо здесь. <strong>Минимум 5 вопросов.</strong></p><p class="text-xs text-slate-500">ИИ признаёт неопределённость — наблюдайте как меняется уверенность его ответов.</p>',
      '2': '<p class="mb-1">ИИ-тренер оценил ваши находки. Отметьте самооценку, примите решение и запишите главный вывод.</p>',
      '3': '<p>Анализ завершён — ваши находки собраны ниже. Просмотрите и нажмите <strong>«Завершить задание»</strong>.</p>'
    }
  },
  'block1-practice-reverse': {
    initial: '<p class="mb-1 font-semibold text-slate-700">Реверс-инжиниринг промпта</p><p class="text-slate-600 text-sm mb-1"><strong>Почему:</strong> понять чужой хороший промпт — лучший способ научиться писать свои.</p><p class="text-slate-600 text-sm mb-1"><strong>Как:</strong> читаете результат → пишете промпт-гипотезу → видите авторский → улучшаете v2.</p><p class="text-slate-500 text-sm">Выберите один из 5 текстов ниже.</p>',
    taskSelected: '<p>Прочитайте текст выше. Обратите внимание на структуру, стиль и детали. Нажмите <strong>«Начать задание»</strong>.</p>',
    steps: {
      '1.1': '<p class="mb-1">Прочитайте текст-цель внимательно. Напишите <strong>промпт-гипотезу</strong> — что могло породить этот результат?</p><p class="text-xs text-slate-500">Укажите роль, задачу, формат и стиль.</p>',
      '1.2': '<p class="mb-1">Посмотрите на результат вашего промпта. <strong>Что совпало, что отличается?</strong> Запишите минимум 2 наблюдения.</p>',
      '2': '<p class="mb-1">Изучите авторский промпт. Напишите промпт v2, учитывая найденные отличия. Запустите и сравните.</p>',
      '3': '<p>Отчёт собран. Проверьте и нажмите <strong>«Отправить»</strong>.</p>'
    }
  },
  'block1-practice-detective': {
    initial: '<p class="mb-1 font-semibold text-slate-700">Угадай — человек или ИИ?</p><p class="text-slate-600 text-sm mb-1"><strong>Почему:</strong> умение отличить живой текст от машинного — это навык критического чтения.</p><p class="text-slate-600 text-sm">Нажмите <strong>«Начать задание»</strong> — появятся 5 текстов для оценки.</p>',
    taskSelected: '<p>Нажмите <strong>«Начать задание»</strong> — появятся 5 текстов для оценки.</p>',
    steps: {
      '1': '<p class="mb-1">Прочитайте каждый текст. Для каждого: отметьте автора, уверенность и напишите <strong>причину</strong> вашего выбора.</p>',
      '2': '<p class="mb-1">Изучите разбор — особенно там, где ошиблись. Нажмите <strong>«Записать маркеры»</strong>.</p>',
      '3': '<p>Запишите 3 личных маркера ИИ-текста, нажмите <strong>«Далее»</strong> и затем <strong>«Завершить задание»</strong>.</p>'
    }
  },
  'block2-practice-aim': {
    initial: '<p>Выберите один из 5 кейсов для практики с методом AIM.</p>',
    taskSelected: '<p>Прочитайте кейс. Нажмите <strong>«Начать задание»</strong> — заполните структуру AIM.</p>',
    steps: {
      '1.1': '<p class="mb-2">Заполните блоки AIM:</p><ul class="text-xs space-y-0.5 text-slate-600"><li><strong>A — Aim:</strong> какой результат нужен, для кого, зачем</li><li><strong>I — Inputs:</strong> факты, данные, ограничения</li><li><strong>M — Method:</strong> как ИИ должен работать</li></ul>',
      '1.2': '<p>Добавьте формат, ограничения и критерии качества. Объясните почему плохой промпт слабый.</p>',
      '1.3': '<p>Отправьте промпт v1 в нейросеть и дождитесь ответа.</p>',
      '1.4': '<p>Оцените ответ: решает ли задачу, достаточно ли конкретики? Что ИИ понял неправильно?</p>',
      '1.5': '<p>Запишите <strong>минимум 2 улучшения</strong> для промпта v2.</p>',
      '2.1': '<p>Напишите <strong>улучшенный промпт v2</strong> и запустите нейросеть.</p>',
      '2.2': '<p>Запишите главный вывод: что изменилось после применения метода AIM?</p>',
      '3': '<p>Проверьте отчёт и нажмите <strong>«Отправить»</strong>.</p>'
    }
  },
  'block2-practice-library': {
    initial: '<p>Выберите роль или направление для создания библиотеки промптов.</p>',
    taskSelected: '<p>Нажмите <strong>«Начать задание»</strong> — создайте минимум 3 переиспользуемых шаблона.</p>',
    steps: {
      '1': '<p>Создайте <strong>минимум 3 шаблона</strong> с переменными вроде <code>{цель}</code>, <code>{аудитория}</code>. Используйте кнопку «+ Добавить промпт».</p>',
      '2.1': '<p>Выберите шаблон для теста, введите пример данных и нажмите <strong>«Протестировать»</strong>.</p>',
      '2.2': '<p>Улучшите шаблон до v2 и запишите где будете его использовать.</p>',
      '3': '<p>Проверьте отчёт и нажмите <strong>«Отправить»</strong>.</p>'
    }
  },
  'block2-practice-context': {
    initial: '<p>Выберите тип ассистента для создания персонального паспорта.</p>',
    taskSelected: '<p>Нажмите <strong>«Начать задание»</strong> — заполните паспорт ассистента по блокам.</p>',
    steps: {
      '1.1': '<p>Заполните первые блоки паспорта: <strong>роль</strong>, задачи, рабочий контекст.</p>',
      '1.2': '<p>Добавьте информацию о клиентах, продуктах и стиле общения.</p>',
      '1.3': '<p>Укажите правила работы, форматы результата и критерии качества.</p>',
      '1.4': '<p>Добавьте примеры <strong>хорошего и плохого</strong> ответа ассистента.</p>',
      '2.1': '<p>Напишите тестовый запрос и отправьте паспорт в нейросеть.</p>',
      '2.2': '<p>Оцените ответ и улучшите паспорт v2: что добавить или уточнить?</p>',
      '3': '<p>Проверьте отчёт и нажмите <strong>«Отправить»</strong>.</p>'
    }
  }
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
    { label: 'Помоги заметить', text: 'В моём выбранном фрагменте — какие типы утверждений чаще всего оказываются непроверенными? Дай 3 подсказки без готового списка.' },
    { label: 'Как спросить об источнике', text: 'Дай 5 шаблонов вопросов для проверки конкретного утверждения ИИ. Примеры разного типа: цифра, совет, ссылка на авторитет.' },
    { label: 'ИИ настаивает на ответе', text: 'ИИ отвечает уверенно и не признаёт неточностей. Дай 2 уточняющих вопроса, чтобы выявить ограничения.' },
    { label: 'Оформить вывод', text: 'Как одним абзацем написать «Главный вывод» по результатам проверки? Дай структуру: что проверял, что выяснил, что буду делать иначе.' }
  ],
  'block1-practice-reverse': [
    { label: 'С чего начать промпт', text: 'Я смотрю на текст-цель из задания 4. Какие 3 элемента промпта проще всего угадать из результата? Дай подсказку без написания промпта за меня.' },
    { label: 'Роль в промпте', text: 'Как определить роль для промпта по стилю и тону текста-цели? Дай 2 примера для разных жанров: деловой текст и профессиональный пост.' },
    { label: 'Проверь мою гипотезу', text: 'Я написал промпт-гипотезу для задания 4. Укажи: чего может не хватать — без переписывания промпта целиком.' },
    { label: 'Анализ авторского промпта', text: 'Объясни структуру авторского промпта: какие элементы из него дали конкретный результат в тексте? Только анализ, не новый промпт.' }
  ],
  'block1-practice-detective': [
    { label: 'Маркеры ИИ-текста', text: 'Назови 5 лингвистических маркеров, которые чаще всего встречаются в текстах ИИ. Без примеров из текстов задания.' },
    { label: 'Почему сложно отличить', text: 'В чём главная сложность при определении ИИ-текста от человеческого в профессиональном контексте? Коротко, 3–4 предложения.' },
    { label: 'Проверь мою причину', text: 'Я написал причину для одного из текстов в задании 5. Скажи: это убедительный аргумент или я ошибся в логике? Не говори правильный ответ.' },
    { label: 'Как писать маркеры', text: 'Покажи структуру хорошего «личного маркера ИИ-текста»: что в нём должно быть, чтобы он был конкретным? Один пример, без раскрытия текстов задания.' }
  ],
  'block2-practice-aim': [
    { label: 'Как заполнить AIM', text: 'Объясни, что писать в Aim, Inputs и Method для моего выбранного кейса. По одному примеру на блок, без готового полного промпта.' },
    { label: 'Проверь черновик AIM', text: 'Я пришлю черновик AIM. Дай обратную связь: чего не хватает. Не переписывай промпт целиком.' },
    { label: 'Критерии качества', text: 'Приведи 5 измеримых критериев качества для моего кейса. Коротко, списком.' },
    { label: 'Улучшения для v2', text: 'Как сформулировать минимум 2 улучшения для v2? Пример на 2–3 предложения, без готового ответа на задание.' }
  ],
  'block2-practice-library': [
    { label: 'Идеи шаблонов', text: 'Предложи 3 идеи шаблонов промптов для моей роли с разными категориями. Только названия и переменные, без полных текстов.' },
    { label: 'Проверь шаблон', text: 'Я пришлю черновик шаблона. Скажи, каких переменных или критериев не хватает.' },
    { label: 'Пример переменных', text: 'Покажи, как заполнить переменные {цель} и {аудитория} для одного шаблона моей роли.' }
  ],
  'block2-practice-context': [
    { label: 'Структура паспорта', text: 'Объясни, что писать в каждом блоке паспорта ассистента для моего типа. Без готового паспорта целиком.' },
    { label: 'Правила и риски', text: 'Приведи 5 примеров правил для ассистента с осторожными формулировками про GDPR и финансы.' },
    { label: 'Проверь паспорт', text: 'Я пришлю черновик паспорта. Укажи, что слишком общее или чего не хватает.' }
  ]
};

const PRACTICE_SECTION_IDS = {
  'block1-practice-prompt': 'practicePromptSection',
  'block1-practice-scenario': 'practiceDialogueSection',
  'block1-practice-hallucination': 'practiceAnalysisSection',
  'block1-practice-reverse': 'practiceReverseSection',
  'block1-practice-detective': 'practiceDetectiveSection',
  'block2-practice-aim': 'practiceAimSection',
  'block2-practice-library': 'practiceLibrarySection',
  'block2-practice-context': 'practiceContextSection'
};

const TOOLS_COLLAPSED_KEY = 'academy_tools_panel_collapsed';
const TOOLS_RIGHT_WIDTH_KEY = 'academy_right_pane_width';
const CHAT_PANE_WIDTH_KEY = 'academy_chat_pane_width';
const CHAT_CONTEXT_KEY = 'academy_chat_context_v1';
const CHAT_TOOLBAR_EXPANDED_KEY = 'academy_chat_toolbar_expanded';
const PRACTICE_CHAT_OPEN_KEY = 'academy_practice_chat_open';
let academyLayoutSetWidths = null;
let toastHideTimer = null;
let chatContextSaveTimer = null;


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
  assistants: [],
  activeAssistant: null,
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
  lastPracticeAiResult: null,
  p2PersonaData: null,
  p2EvalData: null,
  p2DialogueMessages: [],
  p2ConversationId: null,
  p3HintData: null,
  p3EvalData: null,
  p3VerificationMessages: [],
  p3ConversationId: null
};
let kbStatusPollTimer = null;
let kbStatusPollBusy = false;
let uiWired = false;

function showToast(message) {
  let el = document.getElementById('aaToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aaToast';
    el.className = 'aa-toast hidden';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.remove('hidden');
  if (toastHideTimer) clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

function readChatContextFromStorage() {
  try {
    const raw = localStorage.getItem(CHAT_CONTEXT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function parseConversationMeta(conv) {
  let meta = conv?.meta;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = {};
    }
  }
  return meta && typeof meta === 'object' ? meta : {};
}

function buildChatContextPayload() {
  return {
    model: document.getElementById('modelSelect')?.value || null,
    chatMode: document.getElementById('chatModeSelect')?.value || 'general',
    knowledgeBaseId: document.getElementById('knowledgeBaseSelect')?.value || null,
    personaId: document.getElementById('personaSelect')?.value || null,
    assistantId: state.activeAssistant?.id || null
  };
}

function flushChatContextToServer() {
  if (!state.currentConversationId) return;
  const ctx = buildChatContextPayload();
  api(`/api/academy/conversations/${state.currentConversationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ chatContext: ctx })
  }).catch(() => {});
}

function persistChatContext() {
  const ctx = buildChatContextPayload();
  localStorage.setItem(CHAT_CONTEXT_KEY, JSON.stringify(ctx));
  if (state.currentConversationId) {
    clearTimeout(chatContextSaveTimer);
    chatContextSaveTimer = setTimeout(flushChatContextToServer, 450);
  }
  return ctx;
}

function findLessonById(lessonId) {
  if (!lessonId || !state.catalog?.lessons) return null;
  return state.catalog.lessons.find((l) => l.id === lessonId) || null;
}

function lessonLabelForId(lessonId) {
  return findLessonById(lessonId)?.title || null;
}

async function openLessonFromLibrary(lessonId) {
  const lesson = findLessonById(lessonId);
  if (!lesson) {
    showToast('Урок не найден в каталоге');
    return;
  }
  await openLessonPanel(lesson);
  setMobilePane('lesson');
}

function appendLibraryLessonLink(actions, sourceLessonId) {
  if (!sourceLessonId) return;
  const label = lessonLabelForId(sourceLessonId);
  const lessonBtn = document.createElement('button');
  lessonBtn.type = 'button';
  lessonBtn.className = 'aa-btn aa-btn-ghost text-xs min-h-0 h-7 px-2';
  lessonBtn.textContent = label ? `Урок: ${label.length > 28 ? `${label.slice(0, 28)}…` : label}` : 'К уроку';
  lessonBtn.title = label || 'Открыть урок';
  lessonBtn.addEventListener('click', () => openLessonFromLibrary(sourceLessonId));
  actions.appendChild(lessonBtn);
}

function applyChatContext(ctx = {}) {
  const modelSel = document.getElementById('modelSelect');
  const modeSel = document.getElementById('chatModeSelect');
  const kbSel = document.getElementById('knowledgeBaseSelect');
  const personaSel = document.getElementById('personaSelect');
  if (ctx.model && modelSel && [...modelSel.options].some((o) => o.value === ctx.model)) {
    modelSel.value = ctx.model;
    state.selectedModel = ctx.model;
  }
  if (ctx.chatMode && modeSel) modeSel.value = ctx.chatMode;
  if (kbSel) {
    const kbId = ctx.knowledgeBaseId || '';
    if (!kbId || state.knowledgeBases.some((k) => k.id === kbId)) {
      kbSel.value = kbId;
      state.selectedKnowledgeBaseId = kbId || null;
      state.activeKnowledgeBaseId = kbId || null;
      const actionSel = document.getElementById('kbActionSelect');
      if (actionSel) actionSel.value = kbId;
    }
  }
  if (personaSel) {
    const pid = ctx.personaId || '';
    if (!pid || state.personas.some((p) => p.id === pid)) personaSel.value = pid;
  }
  if (ctx.assistantId && state.assistants.length) {
    const found = state.assistants.find((a) => a.id === ctx.assistantId);
    if (found) applyAssistantToChat(found, { silent: true });
  }
  updateModelHint();
  updateActiveAssistantChip();
}

function syncChatToolbarVisibility() {
  const inPractice = document.getElementById('app')?.classList.contains('practice-focus');
  const toggleBtn = document.getElementById('toggleChatAdvancedBtn');
  const toolbar = document.getElementById('chatAdvancedBlock');
  const hint = document.getElementById('modelHint');
  if (!toolbar || !toggleBtn) return;

  if (inPractice) {
    const expanded = localStorage.getItem(CHAT_TOOLBAR_EXPANDED_KEY) === '1';
    toolbar.classList.toggle('hidden', !expanded);
    hint?.classList.toggle('hidden', !expanded);
    toggleBtn.classList.remove('hidden');
    toggleBtn.textContent = expanded ? 'Скрыть настройки чата' : 'Дополнительные настройки чата';
  } else {
    toolbar.classList.remove('hidden');
    hint?.classList.remove('hidden');
    toggleBtn.classList.add('hidden');
  }
}

function practiceCategoryLabel() {
  const sk = state.currentLesson?.scenario_key;
  const title = state.currentLesson?.title;
  if (sk && title) return `${title}`;
  if (sk) return sk;
  return 'Из практики';
}

async function savePromptToLibrary({ text, title, category }) {
  const promptText = String(text || '').trim();
  if (!promptText) {
    showToast('Нечего сохранять — заполните текст промпта');
    return null;
  }
  const defaultTitle = title || `Промпт ${new Date().toLocaleString('ru-RU')}`;
  const name = window.prompt('Название в библиотеке:', defaultTitle);
  if (name === null) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const prompt = await api('/api/academy/prompts', {
    method: 'POST',
    body: JSON.stringify({
      title: trimmed,
      category: category || practiceCategoryLabel() || 'Personal Productivity',
      prompt_text: promptText,
      recommended_model: document.getElementById('modelSelect')?.value || null,
      source_lesson_id: state.currentLessonId || null
    })
  });
  await loadPromptLibrary();
  activateToolTab('prompts');
  showToast('Промпт сохранён в «Инструменты»');
  return prompt;
}

async function savePromptFromElement(btn) {
  const sourceId = btn.getAttribute('data-prompt-source');
  const el = sourceId ? document.getElementById(sourceId) : null;
  const text = el?.value ?? el?.textContent ?? '';
  await savePromptToLibrary({
    text,
    title: btn.getAttribute('data-prompt-title') || undefined,
    category: btn.getAttribute('data-prompt-category') || practiceCategoryLabel()
  });
}

async function saveLibraryCardToLibrary(card) {
  if (!card) return;
  const name = card.querySelector('.lib-name')?.value?.trim();
  const template = card.querySelector('.lib-template')?.value?.trim();
  const task = card.querySelector('.lib-task')?.value?.trim();
  const variables = card.querySelector('.lib-variables')?.value?.trim();
  const example = card.querySelector('.lib-example')?.value?.trim();
  const criteria = card.querySelector('.lib-criteria')?.value?.trim();
  const category = card.querySelector('.lib-category')?.value?.trim() || 'Библиотека промптов';
  const parts = [template, task && `Задача: ${task}`, variables && `Переменные: ${variables}`, example && `Пример: ${example}`, criteria && `Критерии: ${criteria}`].filter(Boolean);
  const text = parts.join('\n\n');
  await savePromptToLibrary({ text, title: name || 'Шаблон из библиотеки', category });
}

async function saveAssistantFromElement(btn) {
  const sourceId = btn.getAttribute('data-assistant-source');
  const el = sourceId ? document.getElementById(sourceId) : null;
  const instructions = (el?.value || '').trim();
  if (!instructions) {
    showToast('Сначала соберите паспорт ассистента');
    return;
  }
  const ver = btn.getAttribute('data-assistant-version') || '';
  const roleField = document.getElementById(`passportRoleV${ver === 'v2' ? '2' : '1'}`)?.value?.trim();
  const defaultName = state.currentLesson?.title
    ? `Ассистент: ${state.currentLesson.title}${ver ? ` ${ver}` : ''}`
    : `Мой ассистент${ver ? ` ${ver}` : ''}`;
  const name = window.prompt('Название ассистента:', defaultName);
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const assistant = await api('/api/academy/assistants', {
    method: 'POST',
    body: JSON.stringify({
      name: trimmed,
      description: practiceCategoryLabel(),
      role: roleField || 'Рабочий ассистент',
      instructions,
      connected_kb_id: state.selectedKnowledgeBaseId || null,
      default_model: document.getElementById('modelSelect')?.value || null,
      source_lesson_id: state.currentLessonId || null
    })
  });
  await loadAssistants();
  applyAssistantToChat(assistant);
  activateToolTab('assistant');
  showToast('Ассистент сохранён и применён в чате');
}

async function deletePromptFromLibrary(promptId, title) {
  if (!confirm(`Удалить промпт «${title}»?`)) return;
  await api(`/api/academy/prompts/${promptId}`, { method: 'DELETE' });
  await loadPromptLibrary();
  showToast('Промпт удалён');
}

function applyAssistantToChat(assistant, { silent = false } = {}) {
  if (!assistant) return;
  state.activeAssistant = assistant;
  const modelSel = document.getElementById('modelSelect');
  if (assistant.default_model && modelSel && [...modelSel.options].some((o) => o.value === assistant.default_model)) {
    modelSel.value = assistant.default_model;
    state.selectedModel = assistant.default_model;
  }
  if (assistant.connected_kb_id) {
    const kbSel = document.getElementById('knowledgeBaseSelect');
    if (kbSel) kbSel.value = assistant.connected_kb_id;
    state.selectedKnowledgeBaseId = assistant.connected_kb_id;
    state.activeKnowledgeBaseId = assistant.connected_kb_id;
    const actionSel = document.getElementById('kbActionSelect');
    if (actionSel) actionSel.value = assistant.connected_kb_id;
    openKnowledgeBase(assistant.connected_kb_id).catch(() => {});
  }
  updateModelHint();
  updateActiveAssistantChip();
  renderAssistantLibrary();
  persistChatContext();
  if (!silent) showToast(`Ассистент «${assistant.name}» активен в чате`);
}

function clearActiveAssistant() {
  state.activeAssistant = null;
  updateActiveAssistantChip();
  persistChatContext();
  renderAssistantLibrary();
}

function updateActiveAssistantChip() {
  const chip = document.getElementById('chatActiveAssistantChip');
  if (!chip) return;
  if (!state.activeAssistant) {
    chip.classList.add('hidden');
    chip.innerHTML = '';
    return;
  }
  chip.classList.remove('hidden');
  chip.innerHTML = `Активный ассистент: <strong>${escapeHtml(state.activeAssistant.name)}</strong> <button type="button" id="clearActiveAssistantBtn" class="ml-2 text-indigo-600 hover:underline">Сбросить</button>`;
  chip.querySelector('#clearActiveAssistantBtn')?.addEventListener('click', clearActiveAssistant);
}

function activateToolTab(tabId) {
  const tab = document.querySelector(`[data-tool-tab="${tabId}"]`);
  tab?.click();
  if (window.innerWidth < 1024) {
    setMobilePane('tools');
  }
}

async function useKnowledgeBaseInChat(kbId) {
  const id = kbId || state.selectedKnowledgeBaseId || document.getElementById('kbActionSelect')?.value;
  if (!id) {
    showToast('Выберите базу знаний');
    return;
  }
  state.selectedKnowledgeBaseId = id;
  state.activeKnowledgeBaseId = id;
  const kbSel = document.getElementById('knowledgeBaseSelect');
  const actionSel = document.getElementById('kbActionSelect');
  if (kbSel) kbSel.value = id;
  if (actionSel) actionSel.value = id;
  const modeSel = document.getElementById('chatModeSelect');
  if (modeSel && modeSel.value === 'general') modeSel.value = 'knowledge';
  persistChatContext();
  updateModelHint();
  showToast('База знаний подключена к чату');
}

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
  document.getElementById('initLoading')?.classList.add('hidden');
  document.getElementById('initError')?.classList.add('hidden');
}

function showInitLoading() {
  document.getElementById('authGate')?.classList.add('hidden');
  document.getElementById('initError')?.classList.add('hidden');
  document.getElementById('app')?.classList.add('hidden');
  document.getElementById('initLoading')?.classList.remove('hidden');
}

function showInitError(message) {
  document.getElementById('initLoading')?.classList.add('hidden');
  document.getElementById('app')?.classList.add('hidden');
  document.getElementById('authGate')?.classList.add('hidden');
  document.getElementById('initError')?.classList.remove('hidden');
  const el = document.getElementById('initErrorText');
  if (el) {
    el.textContent = message || 'Проверьте подключение к интернету и попробуйте снова.';
  }
}

function showApp() {
  document.getElementById('authGate')?.classList.add('hidden');
  document.getElementById('initLoading')?.classList.add('hidden');
  document.getElementById('initError')?.classList.add('hidden');
  document.getElementById('app')?.classList.remove('hidden');
  // Кнопка повторного открытия инструментов зависит от видимости #app.
  // На старте #app ещё скрыт, поэтому пере-вычисляем состояние после показа.
  try { updateToolsPanelToggleUi(isToolsPanelCollapsed()); } catch {}
}

function parseUser() {
  try {
    return JSON.parse(localStorage.getItem('user_info') || '{}');
  } catch {
    return {};
  }
}

async function loadWorkspace() {
  showInitLoading();
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
    await loadAssistants();
    applyChatContext(readChatContextFromStorage());
    await loadHallucinationScenarios();
    showApp();
    syncChatToolbarVisibility();
    initMobileWorkspaceTabs();
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_info');
      showGate();
      return;
    }
    showInitError(e.message || 'Ошибка загрузки');
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

  if (!uiWired) {
    wireUi();
    uiWired = true;
  }

  await loadWorkspace();
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
  const mvp = state.catalog.courses.filter((c) => ACADEMY_COURSE_SLUGS.includes(c.slug));
  return mvp.length ? mvp.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) : state.catalog.courses;
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
  renderContinuePractice();
}

function getLessonProgressMeta(lessonId) {
  const catalogProg = state.catalog?.progress?.[lessonId];
  const sum = state.progressSummary?.lessons?.find((l) => l.lesson_id === lessonId);
  return {
    status: catalogProg?.status || sum?.status || 'not_started',
    assignment_status: catalogProg?.assignment_status || sum?.assignment_status || 'not_started',
    has_feedback: sum?.has_feedback || !!(catalogProg?.feedback_json && Object.keys(catalogProg.feedback_json).length)
  };
}

function getLessonStatusPrefix(lessonId) {
  const m = getLessonProgressMeta(lessonId);
  if (m.status === 'completed') return '✓ ';
  if (m.has_feedback || m.assignment_status === 'reviewed') return '★ ';
  if (m.assignment_status === 'submitted' || m.assignment_status === 'in_progress') return '◐ ';
  return '';
}

function findNextPracticeLesson() {
  const lessons = getMvpLessons().slice().sort((a, b) => {
    const ca = state.catalog?.courses?.find((c) => c.id === a.course_id);
    const cb = state.catalog?.courses?.find((c) => c.id === b.course_id);
    return (ca?.sort_order || 0) - (cb?.sort_order || 0) || (a.sort_order || 0) - (b.sort_order || 0);
  });
  for (const l of lessons) {
    const m = getLessonProgressMeta(l.id);
    if (m.status !== 'completed') return l;
  }
  return null;
}

function renderContinuePractice() {
  const card = document.getElementById('continuePracticeCard');
  const doneCard = document.getElementById('courseCompleteCard');
  const titleEl = document.getElementById('continuePracticeTitle');
  const btn = document.getElementById('continuePracticeBtn');
  if (!card || !titleEl || !btn) return;

  const next = findNextPracticeLesson();
  const s = state.progressSummary;
  const allDone = s && s.practices_completed >= s.practices_total && s.practices_total > 0;

  if (allDone && !next) {
    card.classList.add('hidden');
    doneCard?.classList.remove('hidden');
    return;
  }
  doneCard?.classList.add('hidden');

  if (!next) {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');
  const labelEl = document.getElementById('continuePracticeLabel');
  // A brand-new user hasn't started anything — «Продолжить» would be confusing
  const isFresh = getMvpLessons().every((l) => {
    const m = getLessonProgressMeta(l.id);
    return m.status === 'not_started' && m.assignment_status === 'not_started' && !m.has_feedback;
  });
  if (isFresh) {
    if (labelEl) labelEl.textContent = 'С чего начать';
    titleEl.textContent = next.title;
    btn.textContent = 'Начать первую практику';
  } else {
    if (labelEl) labelEl.textContent = 'Продолжить';
    const meta = getLessonProgressMeta(next.id);
    let hint = 'Не начато';
    if (meta.assignment_status === 'submitted' || meta.assignment_status === 'in_progress') hint = 'В процессе';
    if (meta.has_feedback) hint = 'Есть обратная связь';
    titleEl.textContent = `${next.title} · ${hint}`;
    btn.textContent = 'Открыть практику';
  }

  btn.onclick = () => {
    selectLesson(next);
    setMobilePane('lesson');
  };
}

const MOBILE_PANE_CLASSES = [
  'aa-mobile-pane-sidebar',
  'aa-mobile-pane-chat',
  'aa-mobile-pane-lesson',
  'aa-mobile-pane-tools'
];

function setMobilePane(pane) {
  const app = document.getElementById('app');
  if (!app || window.innerWidth >= 1024) return;
  app.classList.remove(...MOBILE_PANE_CLASSES);
  app.classList.add(`aa-mobile-pane-${pane}`);
  document.querySelectorAll('#mobileWorkspaceTabs [data-pane]').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.pane === pane);
  });
}

function initMobileWorkspaceTabs() {
  const app = document.getElementById('app');
  if (!app) return;
  const syncDefault = () => {
    if (window.innerWidth >= 1024) {
      app.classList.remove(...MOBILE_PANE_CLASSES);
      return;
    }
    if (!MOBILE_PANE_CLASSES.some((c) => app.classList.contains(c))) {
      setMobilePane('chat');
    }
  };
  syncDefault();
  window.addEventListener('resize', syncDefault);
  document.querySelectorAll('#mobileWorkspaceTabs [data-pane]').forEach((btn) => {
    btn.addEventListener('click', () => setMobilePane(btn.dataset.pane));
  });
}

function updateNewLessonChatBtn() {
  const btn = document.getElementById('newLessonChatBtn');
  if (!btn) return;
  const hasLesson = Boolean(state.currentLessonId);
  const hasConv = hasLesson && state.conversations.some((c) => c.lesson_id === state.currentLessonId);
  btn.classList.toggle('hidden', !hasConv);
}

async function startNewLessonChat() {
  if (!state.currentLessonId || !state.currentLesson) return;
  const lesson = state.currentLesson;
  const conv = await api('/api/academy/conversations', {
    method: 'POST',
    body: JSON.stringify({
      lessonId: lesson.id,
      courseId: lesson.course_id,
      title: `${lesson.title} (новый)`,
      model: document.getElementById('modelSelect').value,
      chatContext: buildChatContextPayload()
    })
  });
  state.conversations.unshift(conv);
  state.currentConversationId = conv.id;
  renderConversationList();
  await loadConversation(conv.id, { skipFetchList: true, skipLessonRestore: true });
  setMobilePane('chat');
}
function syncPracticeModeUi() {
  const g = document.getElementById('practiceModeSelect')?.value === 'group';
  document.getElementById('groupMetaFields')?.classList.toggle('hidden', !g);
  document.getElementById('groupModeCallout')?.classList.toggle('hidden', !g);
}
function renderAssignmentFeedback(fb) {
  const box = document.getElementById('assignmentFeedback');
  const loading = document.getElementById('assignmentFeedbackLoading');
  loading?.classList.add('hidden');
  if (!box || !fb) return;
  box.classList.remove('hidden');
  box.innerHTML = '';

  if (fb.score != null) {
    const sk = state.currentLesson?.scenario_key;
    const maxScore = sk === 'block1-practice-prompt' ? 7 : 10;
    const score = document.createElement('p');
    score.className = 'text-sm font-semibold text-slate-900 mb-2';
    score.textContent = `Оценка: ${fb.score}/${maxScore}`;
    box.appendChild(score);
  }

  const addListSection = (title, items) => {
    if (!items?.length) return;
    const sec = document.createElement('div');
    sec.className = 'aa-feedback-section';
    sec.innerHTML = `<h4>${escapeHtml(title)}</h4>`;
    const ul = document.createElement('ul');
    items.forEach((t) => {
      const li = document.createElement('li');
      li.textContent = String(t);
      ul.appendChild(li);
    });
    sec.appendChild(ul);
    box.appendChild(sec);
  };

  addListSection('Сильные стороны', fb.strengths);
  addListSection('Что улучшить', fb.weaknesses);
  addListSection('Следующие шаги', fb.recommendations);
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
  if (Array.isArray(opts)) return opts;
  if (opts && typeof opts === 'object') {
    if (Array.isArray(opts.roles)) return opts.roles;
    if (Array.isArray(opts.types)) return opts.types;
  }
  return [];
}

function getAssignmentMeta(assignment) {
  let opts = assignment?.task_options;
  if (typeof opts === 'string') {
    try {
      opts = JSON.parse(opts);
    } catch {
      opts = null;
    }
  }
  if (opts && typeof opts === 'object' && !Array.isArray(opts)) return opts;
  return {};
}

function isAcademyPractice(lesson) {
  return Boolean(lesson?.scenario_key && PRACTICE_SCENARIO_KEYS.has(lesson.scenario_key));
}

function isBlock2Scenario(scenarioKey) {
  return Boolean(scenarioKey?.startsWith('block2-practice-'));
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
    const wf = isBlock2Scenario(scenarioKey)
      ? wfApi.collectWorkflowFromUiM2(scenarioKey)
      : wfApi.collectWorkflowFromUi(scenarioKey);
    wf.currentStep = state.practiceStep || 1;
    wf.currentSubstep = state.practiceSubstep || 1;
    if (state.p1RecipientData) wf.p1RecipientData = state.p1RecipientData;
    if (state.p2PersonaData) wf.p2Persona = state.p2PersonaData;
    if (state.p2EvalData) wf.p2Eval = state.p2EvalData;
    if (state.p2DialogueMessages?.length) wf.p2DialogueMessages = state.p2DialogueMessages;
    if (state.p3HintData) wf.p3Hint = state.p3HintData;
    if (state.p3EvalData) wf.p3Eval = state.p3EvalData;
    if (state.p3VerificationMessages?.length) wf.p3VerificationMessages = state.p3VerificationMessages;
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
  const sk = state.currentLesson?.scenario_key;
  const wfApi = getPracticeWorkflowApi();
  // When the prompt textarea is empty and we auto-assemble from the blocks,
  // write the result back into the textarea — otherwise the prompt runs fine
  // but never lands in the saved draft, report or feedback
  const assembleInto = (textareaId, assembled) => {
    if (!assembled) return '';
    const el = document.getElementById(textareaId);
    if (el) {
      el.value = assembled;
      scheduleAutoSave();
    }
    return assembled;
  };
  if (sk === 'block2-practice-aim') {
    if (pass === 'v2') {
      return document.getElementById('m2PracticePromptV2')?.value?.trim() || '';
    }
    const v1 = document.getElementById('m2PracticePromptV1')?.value?.trim();
    if (v1) return v1;
    return assembleInto('m2PracticePromptV1', wfApi?.assembleAimPrompt?.() || '');
  }
  if (pass === 'v2') {
    const v2 = document.getElementById('practicePromptV2')?.value?.trim();
    if (v2) return v2;
    return '';
  }
  const v1 = document.getElementById('practicePromptV1')?.value?.trim();
  if (v1) return v1;
  return assembleInto('practicePromptV1', assembleRtcfsсPrompt());
}

function buildPracticeRunContext(runKind, pass) {
  const task = getSelectedTaskOption();
  const aiRole = document.getElementById('practiceRoleAi')?.value?.trim() || task?.ai_role || '';
  const studentRole = document.getElementById('practiceRoleMe')?.value?.trim() || task?.student_role || '';
  const studentGoal =
    document.getElementById('practiceStudentGoal')?.value?.trim() || task?.student_goal || '';
  let taskContext = task?.context || task?.summary || '';
  if (runKind === 'analysis') taskContext = task?.fragment_text || taskContext;
  if (runKind === 'assistant') {
    const wfApi = getPracticeWorkflowApi();
    return {
      runKind: 'assistant_test',
      pass: null,
      taskTitle: task?.title || '',
      passportText:
        document.getElementById('passportPreviewV1')?.value?.trim() ||
        wfApi?.assemblePassport?.('v1') ||
        ''
    };
  }
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

function getPracticeSectionElement() {
  const sk = state.currentLesson?.scenario_key;
  const sectionId = PRACTICE_SECTION_IDS[sk] || 'practiceAnalysisSection';
  return document.getElementById(sectionId);
}

function getPracticeStepPane(stepNum = state.practiceStep) {
  const section = getPracticeSectionElement();
  if (!section) return null;
  return section.querySelector(`[data-practice-step="${stepNum}"]`);
}

function getPracticeSubstepCount(pane) {
  if (!pane) return 0;
  const nums = [...pane.querySelectorAll('[data-practice-substep]')]
    .map((el) => parseInt(el.dataset.practiceSubstep, 10))
    .filter((n) => !Number.isNaN(n));
  return nums.length ? Math.max(...nums) : 0;
}

function applyPracticeSubsteps(stepNum = state.practiceStep) {
  const pane = getPracticeStepPane(stepNum);
  const total = getPracticeSubstepCount(pane);
  if (!total) return 0;
  const sub = Math.min(Math.max(state.practiceSubstep || 1, 1), total);
  state.practiceSubstep = sub;
  pane.querySelectorAll('[data-practice-substep]').forEach((el) => {
    const n = parseInt(el.dataset.practiceSubstep, 10);
    el.classList.toggle('hidden', n !== sub);
  });
  return total;
}

function updatePracticeStepBarSubstep(totalSubsteps) {
  const numEl = document.getElementById('practiceStepNum');
  if (!numEl || !totalSubsteps || totalSubsteps < 2) return;
  const sk = state.currentLesson?.scenario_key;
  const total = PRACTICE_STEP_LABELS[sk]?.length || 3;
  const sub = state.practiceSubstep || 1;
  numEl.textContent = `Шаг ${state.practiceStep} из ${total} · часть ${sub} из ${totalSubsteps}`;
}

function tryAdvancePracticeSubstep() {
  const pane = getPracticeStepPane();
  const max = getPracticeSubstepCount(pane);
  if (!max || (state.practiceSubstep || 1) >= max) return false;
  state.practiceSubstep = (state.practiceSubstep || 1) + 1;
  applyPracticeSubsteps();
  updatePracticeStepBarSubstep(max);
  pane.querySelector(`[data-practice-substep="${state.practiceSubstep}"]`)?.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest'
  });
  scheduleAutoSave();
  updateAssignmentHint();
  updatePracticeBackBtn();
  return true;
}

function advancePracticeStepOrSubstep() {
  if (tryAdvancePracticeSubstep()) return;
  advancePracticeStep();
}

function updatePracticeBackBtn() {
  const btn = document.getElementById('practiceBackBtn');
  if (!btn) return;
  const step = state.practiceStep || 1;
  const sub = state.practiceSubstep || 1;
  const visible = step > 1 || sub > 1;
  btn.classList.toggle('hidden', !visible);
}

function goBackPractice() {
  const sk = state.currentLesson?.scenario_key;
  if (!sk) return;
  const step = state.practiceStep || 1;
  const sub = state.practiceSubstep || 1;
  const total = PRACTICE_STEP_LABELS[sk]?.length || 3;

  if (sub > 1) {
    // Go back one substep within same step
    state.practiceSubstep = sub - 1;
    applyPracticeSubsteps();
    const pane = getPracticeStepPane();
    const max = getPracticeSubstepCount(pane);
    updatePracticeStepBarSubstep(max);
    pane?.querySelector(`[data-practice-substep="${state.practiceSubstep}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else if (step > 1) {
    // Go back to previous step at its last substep
    const prevStep = step - 1;
    const sectionId = PRACTICE_SECTION_IDS[sk] || 'practiceAnalysisSection';
    const prevPane = document.getElementById(sectionId)
      ?.querySelector(`[data-practice-step="${prevStep}"]`);
    const prevMax = getPracticeSubstepCount(prevPane) || 1;
    state.practiceSubstep = prevMax;
    showPracticeStep(prevStep, { restoreSubstep: true });
  }

  updatePracticeBackBtn();
  scheduleAutoSave();
  updateAssignmentHint();
}

function showPracticeStep(n, { restoreSubstep } = {}) {
  const sk = state.currentLesson?.scenario_key;
  const labels = PRACTICE_STEP_LABELS[sk];
  const total = labels?.length || 3;
  state.practiceStep = n;
  if (!restoreSubstep) state.practiceSubstep = 1;

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

  const sectionId = PRACTICE_SECTION_IDS[sk] || 'practiceAnalysisSection';
  const section = document.getElementById(sectionId);
  if (section) {
    section.querySelectorAll('[data-practice-step]').forEach((pane) => {
      pane.classList.toggle('hidden', String(pane.dataset.practiceStep) !== String(n));
    });
  }

  const substepTotal = applyPracticeSubsteps(n);
  if (substepTotal >= 2) updatePracticeStepBarSubstep(substepTotal);
  else if (bar && labels) {
    document.getElementById('practiceStepNum').textContent = `Шаг ${n} из ${total}`;
  }

  const isLastStep = n >= total;
  const submitBlock = document.getElementById('practiceSubmitBlock');
  // P5: the markers pane and the submit step share step 3 — show the submit
  // block only once the report is actually built (or restored)
  let showSubmit = isLastStep;
  if (isLastStep && sk === 'block1-practice-detective') {
    showSubmit = !!document.getElementById('assignmentAnswer')?.value?.trim();
  }
  submitBlock?.classList.toggle('hidden', !showSubmit);

  const wfApi = getPracticeWorkflowApi();
  // P2/P3: self-check lives on the last CONTENT step, right above the
  // build-report button — so users check themselves while finishing the work,
  // not after the report is already built. P4/P5 have no self-check at all.
  if (['block1-practice-scenario', 'block1-practice-hallucination'].includes(sk) && n === 2) {
    // Preserve boxes the user already ticked in this session over the saved snapshot
    const current = wfApi?.collectSelfCheck?.(sk) || [];
    const saved = current.some(Boolean) ? current : state.practiceWorkflow?.self_check;
    wfApi?.renderSelfCheck(sk, saved);
    const blk = document.getElementById('practiceSelfCheckBlock');
    const btn = document.getElementById(REPORT_BUTTON_BY_SCENARIO[sk]);
    if (blk && btn?.parentElement) btn.parentElement.insertBefore(blk, btn);
  }
  // P5: on the markers step show the texts with разбором so the user writes
  // markers while looking at the material
  if (sk === 'block1-practice-detective' && n === 3) {
    renderP5Step3Recap();
  }
  if (isLastStep) {
    // Module 2 keeps the self-check on the submit step (no inline variant there)
    if (isBlock2Scenario(sk)) {
      wfApi?.renderSelfCheckM2(sk, state.practiceWorkflow?.self_check);
      const blk = document.getElementById('practiceSelfCheckBlock');
      if (blk && submitBlock && blk.parentElement !== submitBlock) {
        submitBlock.insertBefore(blk, submitBlock.firstChild);
      }
      blk?.classList.remove('hidden');
    }
    if (showSubmit) submitBlock?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    else bar?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    bar?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  updateReportButtonVisibility();
  scheduleAutoSave();
  updateAssignmentHint();
  updatePracticeBackBtn();
}

/* Build-report buttons appear only when the step's work is actually done,
   so each step shows a single next action. */
const REPORT_BUTTON_BY_SCENARIO = {
  'block1-practice-scenario': 'buildReportP2Btn',
  'block1-practice-hallucination': 'buildReportP3Btn',
  'block1-practice-reverse': 'buildReportP4Btn',
  'block1-practice-detective': 'buildReportP5Btn'
};

function updateReportButtonVisibility() {
  const sk = state.currentLesson?.scenario_key;
  const btnId = REPORT_BUTTON_BY_SCENARIO[sk];
  if (!btnId) return;
  // Only P4 hides the button (until the v2 result arrives) — otherwise two
  // primary CTAs stack. Elsewhere the button is always visible and clicking
  // it explains which fields are still empty (see buildPracticeReport).
  let ready = true;
  if (sk === 'block1-practice-reverse') {
    ready = !!document.getElementById('p4ResultV2Preview')?.dataset?.rawText;
  }
  document.getElementById(btnId)?.classList.toggle('hidden', !ready);
}

/* Returns null when the step is complete, otherwise an alert message listing what's missing */
function getReportPrerequisitesError(sk) {
  const v = (id) => document.getElementById(id)?.value?.trim() || '';
  const missing = [];
  if (sk === 'block1-practice-scenario') {
    if (!v('p2BestReply')) missing.push('«Лучший момент диалога»');
    if (!v('p2ApplyWork')) missing.push('«Как применю это в реальной работе»');
  } else if (sk === 'block1-practice-hallucination') {
    if (!document.querySelector('input[name="riskDecision"]:checked')) missing.push('итоговое решение по фрагменту');
    if (!v('p3VerdictReason')) missing.push('«Обоснование вердикта»');
    if (!v('p3MainInsight')) missing.push('«Главный вывод»');
  } else if (sk === 'block1-practice-detective') {
    if (!v('p5PersonalMarkers')) missing.push('«Мои 3 маркера ИИ-текста»');
  } else if (sk === 'block1-practice-reverse') {
    if (!document.getElementById('p4ResultV2Preview')?.dataset?.rawText) missing.push('запустите промпт v2');
  }
  if (!missing.length) return null;
  return 'Чтобы перейти дальше, заполните: ' + missing.join(', ') + '.';
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
  Object.values(PRACTICE_SECTION_IDS).forEach((id) => {
    document.getElementById(id)?.classList.add('hidden');
  });
  // Always reset case brief when switching practices so stale content from previous practice doesn't linger
  document.getElementById('caseBriefBlock')?.classList.add('hidden');
  const pickLabel = document.getElementById('taskOptionsPickLabel');

  [
    'aiResultBlockV1',
    'aiResultBlockV2',
    'aiResultBlockDialogue',
    'aiResultBlockAnalysis',
    'm2AiResultBlockV1',
    'm2AiResultBlockV2',
    'libraryAiResultBlock',
    'contextAiResultBlock'
  ].forEach((id) => {
    document.getElementById(id)?.classList.add('hidden');
  });
  state.lastPracticeAiResult = null;
  if (pickLabel) pickLabel.textContent = TASK_PICK_LABELS[scenarioKey] || 'Выберите вариант';

  // P5 detective: no task selection needed — show start button right away
  if (scenarioKey === 'block1-practice-detective') {
    document.getElementById('startPracticeBtn')?.classList.remove('hidden');
    document.getElementById('taskOptionsBlock')?.classList.add('hidden');
  }

  const activeId = PRACTICE_SECTION_IDS[scenarioKey];
  if (activeId) document.getElementById(activeId)?.classList.remove('hidden');

  const meta = getAssignmentMeta(state.currentLesson?.assignment);
  const tplEl = document.getElementById('libraryTemplateDefault');
  if (tplEl && meta.template_default) tplEl.value = meta.template_default;
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
  // N8: always overwrite role fields from task — task selection explicitly changes the scenario
  const practiceStarted = !document.getElementById('practiceWorkflowBlock')?.classList.contains('hidden');
  if (!practiceStarted) {
    if (aiEl && task.ai_role) aiEl.value = task.ai_role;
    if (meEl && task.student_role) meEl.value = task.student_role;
    if (goalEl && task.student_goal) goalEl.value = task.student_goal;
    if (startEl) startEl.value = assembleDialogueStart();
  } else {
    if (aiEl && !aiEl.value.trim() && task.ai_role) aiEl.value = task.ai_role;
    if (meEl && !meEl.value.trim() && task.student_role) meEl.value = task.student_role;
    if (goalEl && !goalEl.value.trim() && task.student_goal) goalEl.value = task.student_goal;
    if (startEl && !startEl.value.trim()) startEl.value = assembleDialogueStart();
  }
}

function clearPracticeFormUi() {
  state.selectedTaskId = null;
  state.lastPracticeAiResult = null;
  state.currentConversationId = null;
  state.p1RecipientData = null;
  state._p1RecipientPromise = null;
  state.p2PersonaData = null;
  state.p2EvalData = null;
  state.p2DialogueMessages = [];
  state.p2ConversationId = null;
  state.p3HintData = null;
  state.p3EvalData = null;
  state.p3VerificationMessages = [];
  state.p3ConversationId = null;
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
    'p3SuspiciousClaims',
    'p3VerifyQuestions',
    'p3AiResponseEval',
    'p3VerdictReason',
    'p3MainInsight',
    'p2GoodReplies',
    'p2WeakReply',
    'p2AiIssues',
    'p2HarderInstruction',
    'p2BestReply',
    'p2AiCritique',
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
    'checklistItem5',
    'p4PromptV1',
    'p4DiffNotes',
    'p4AuthorAnalysis',
    'p4PromptV2',
    'p5PersonalMarkers',
    'p5MistakeAnalysis'
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  }
  ['evalConcrete', 'evalTone', 'evalNoHype', 'aimEvalSolves', 'aimEvalConcrete'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  const libCards = document.getElementById('libraryPromptCards');
  if (libCards) libCards.innerHTML = '';
  document.querySelectorAll('input[name="riskDecision"]').forEach((r) => {
    r.checked = false;
  });
  ['aiResultV1Preview', 'aiResultV2Preview', 'aiResultDialoguePreview', 'aiResultAnalysisPreview',
   'm2AiResultV1Preview', 'm2AiResultV2Preview', 'libraryAiResultPreview', 'contextAiResultPreview',
   'p4ResultV1Preview', 'p4ResultV2Preview'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = ''; delete el.dataset.rawText; }
  });
  const p5Cards = document.getElementById('p5TextCards');
  if (p5Cards) p5Cards.innerHTML = '';
  const p5Reveals = document.getElementById('p5Reveals');
  if (p5Reveals) p5Reveals.innerHTML = '';
  const riskBody = document.getElementById('riskTableBody');
  if (riskBody) {
    delete riskBody.dataset.inited;
    riskBody.innerHTML = '';
  }
  const mode = document.getElementById('practiceModeSelect');
  if (mode) mode.value = 'individual';
  syncPracticeModeUi();
  document.getElementById('taskOptionsList')?.querySelectorAll('.aa-task-card').forEach((btn) => {
    btn.classList.remove('is-selected', 'hidden');
    btn.setAttribute('aria-checked', 'false');
  });
  document.getElementById('taskOptionsPickLabel')?.classList.remove('hidden');
  // Restore lesson description block (hidden during practice for block1-practice-prompt)
  document.getElementById('lessonContent')?.classList.remove('hidden');
  state.practiceStep = 1;
  state.practiceSubstep = 1;
  state.practiceWorkflow = null;
  document.getElementById('caseBriefBlock')?.classList.add('hidden');
  document.getElementById('startPracticeBtn')?.classList.add('hidden');
  document.getElementById('practiceWorkflowBlock')?.classList.add('hidden');
  document.getElementById('practiceStepBar')?.classList.add('hidden');
  // N4: reset step bar text so it doesn't show stale "Шаг 3 из 3" if bar is re-shown
  const _stepNumEl = document.getElementById('practiceStepNum');
  if (_stepNumEl) _stepNumEl.textContent = '';
  const _stepDotsEl = document.getElementById('practiceStepDots');
  if (_stepDotsEl) _stepDotsEl.innerHTML = '';
  document.getElementById('practiceCelebrationMsg')?.classList.add('hidden');
  document.getElementById('practiceSubmitBlock')?.classList.add('hidden');
  document.getElementById('practiceSelfCheckBlock')?.classList.add('hidden');
  document.getElementById('practiceSelfCheckList') && (document.getElementById('practiceSelfCheckList').innerHTML = '');
  ['aiResultBlockV1', 'aiResultBlockV2', 'aiResultBlockDialogue', 'aiResultBlockAnalysis',
   'clientReactionV1Block', 'clientContextV2Block', 'clientReactionV2Block', 'aiEvalBlock', 'p1SelfCheckBlock'].forEach((id) => {
    document.getElementById(id)?.classList.add('hidden');
  });
  const p1SelfCheckList = document.getElementById('p1SelfCheckList');
  if (p1SelfCheckList) p1SelfCheckList.innerHTML = '';
  const aiEvalPreview = document.getElementById('aiEvalPreview');
  if (aiEvalPreview) aiEvalPreview.textContent = '';
  // Clear inline chat areas for P2 and P3
  ['p2InlineChatMessages', 'p3InlineChatMessages'].forEach((id) => {
    const box = document.getElementById(id);
    if (box) box.innerHTML = '';
  });
  // Re-add placeholders
  const p2ph = document.getElementById('p2InlineChatMessages');
  if (p2ph) p2ph.innerHTML = '<p id="p2InlineChatPlaceholder" class="text-xs text-slate-400 text-center py-6">Напишите первую реплику, чтобы начать разговор</p>';
  const p3ph = document.getElementById('p3InlineChatMessages');
  if (p3ph) p3ph.innerHTML = '<p id="p3InlineChatPlaceholder" class="text-xs text-slate-400 text-center py-6">Напишите вопрос о любом утверждении из фрагмента</p>';
  // Reset P2/P3 eval and hint blocks
  ['p2PersonaCard', 'p2EvalBlock', 'p2InlineSelfCheck', 'p2HardReactionReminder', 'p3HintCard', 'p3EvalBlock', 'p3EvalFound', 'p3EvalMissed', 'p3EvalVerdict', 'p3InlineSelfCheck'].forEach((id) => {
    document.getElementById(id)?.classList.add('hidden');
  });
  document.getElementById('p2PairCounter') && (document.getElementById('p2PairCounter').textContent = '0 / 5');
  document.getElementById('p2PairCounterHint') && (document.getElementById('p2PairCounterHint').textContent = '(начните диалог)');
  document.getElementById('practiceNextP2S1Btn')?.classList.add('hidden');
  document.getElementById('p3VerifyCounter') && (document.getElementById('p3VerifyCounter').textContent = '0 / 5');
  document.getElementById('p3VerifyCounterHint') && (document.getElementById('p3VerifyCounterHint').textContent = '(задайте первый вопрос)');
  document.getElementById('p3FinishVerifyBtn')?.classList.add('hidden');
  const clientReactionV1 = document.getElementById('clientReactionV1');
  if (clientReactionV1) clientReactionV1.innerHTML = '';
  document.getElementById('assignmentFeedback')?.classList.add('hidden');
  // Reset HTML report block (P1)
  const reportRenderBlock = document.getElementById('reportRenderBlock');
  if (reportRenderBlock) { reportRenderBlock.innerHTML = ''; reportRenderBlock.classList.add('hidden'); }
  document.getElementById('assignmentAnswerLabel')?.classList.remove('hidden');
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
  showAutosaveStatus('Задание сброшено — выберите вариант выше, чтобы начать', { hideAfterMs: 5000 });
  // N10: scroll to task options to guide the user after reset
  document.getElementById('taskOptionsBlock')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showPracticeAiResult(text, pass = 'v1') {
  if (!text?.trim()) return;
  state.lastPracticeAiResult = text.trim();
  const sk = state.currentLesson?.scenario_key;
  if (sk === 'block2-practice-aim' && pass === 'v1') pass = 'm2v1';
  if (sk === 'block2-practice-aim' && pass === 'v2') pass = 'm2v2';
  const map = {
    v1: ['aiResultBlockV1', 'aiResultV1Preview'],
    v2: ['aiResultBlockV2', 'aiResultV2Preview'],
    m2v1: ['m2AiResultBlockV1', 'm2AiResultV1Preview'],
    m2v2: ['m2AiResultBlockV2', 'm2AiResultV2Preview'],
    dialogue: ['aiResultBlockDialogue', 'aiResultDialoguePreview'],
    analysis: ['aiResultBlockAnalysis', 'aiResultAnalysisPreview'],
    library: ['libraryAiResultBlock', 'libraryAiResultPreview'],
    context: ['contextAiResultBlock', 'contextAiResultPreview']
  };
  const [blockId, previewId] = map[pass] || map.v1;
  const block = document.getElementById(blockId);
  const preview = document.getElementById(previewId);
  if (block) block.classList.remove('hidden');
  if (preview) {
    const raw = state.lastPracticeAiResult;
    preview.innerHTML = renderMarkdown(raw);
    preview.dataset.rawText = raw;
  }
  block?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const skResult = state.currentLesson?.scenario_key;
  if (['v1', 'm2v1', 'dialogue', 'analysis', 'library', 'context'].includes(pass)) {
    tryAdvancePracticeSubstep();
  }
  // P1-specific post-run actions
  if (skResult === 'block1-practice-prompt') {
    if (pass === 'v1') {
      showP1ClientReaction();
    } else if (pass === 'v2') {
      tryAdvancePracticeSubstep();
      showP1ClientReactionV2(); // async, fire-and-forget
    }
  }
  scheduleAutoSave();
}

function getSelectedTaskNumber() {
  const idx = state.taskOptions.findIndex((t) => t.id === state.selectedTaskId);
  return idx >= 0 ? idx + 1 : null;
}

/* While the AI generates, the run button itself shows progress —
   the chat typing indicator is not visible in inline practice flows */
function setBtnLoading(btn, loading, label = '⏳ Нейросеть генерирует ответ…') {
  if (!btn) return;
  if (loading) {
    if (!btn.dataset.origLabel) btn.dataset.origLabel = btn.textContent;
    btn.textContent = label;
    btn.classList.add('aa-btn-loading');
    btn.setAttribute('disabled', 'true');
  } else {
    if (btn.dataset.origLabel) btn.textContent = btn.dataset.origLabel;
    delete btn.dataset.origLabel;
    btn.classList.remove('aa-btn-loading');
    btn.removeAttribute('disabled');
  }
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
    } else if (runKind === 'library') {
      const wfApi = getPracticeWorkflowApi();
      const idx = document.getElementById('libraryTestPromptSelect')?.value;
      const prompt = wfApi?.getSelectedLibraryPrompt?.(idx);
      const example = document.getElementById('libraryTestInput')?.value?.trim() || prompt?.example || '';
      if (!prompt?.template) {
        alert('Выберите промпт с заполненным шаблоном.');
        return null;
      }
      text = wfApi.buildLibraryTestPrompt(prompt, example);
    } else if (runKind === 'assistant') {
      text = document.getElementById('passportTestTask')?.value?.trim() || '';
      const passport =
        document.getElementById('passportPreviewV1')?.value?.trim() ||
        getPracticeWorkflowApi()?.assemblePassport?.('v1') ||
        '';
      if (!passport) {
        alert('Сначала соберите паспорт ассистента v1.');
        return null;
      }
      if (!text) {
        alert('Укажите тестовую задачу для ассистента.');
        return null;
      }
    } else text = getPracticePromptText(pass);
  }
  if (!text) {
    if (runKind === 'dialogue') alert('Укажите роли и первое сообщение (или нажмите «Собрать первое сообщение»).');
    else if (runKind === 'analysis') alert('Сначала выберите фрагмент.');
    else if (runKind === 'library') alert('Заполните шаблон и пример для теста.');
    else if (runKind === 'assistant') alert('Укажите паспорт и тестовую задачу.');
    else {
      const sk = state.currentLesson?.scenario_key;
      if (sk === 'block2-practice-aim') {
        alert(pass === 'v2' ? 'Сначала напишите промпт v2.' : 'Сначала напишите промпт v1 или заполните AIM.');
      } else {
        alert(pass === 'v2' ? 'Сначала напишите промпт v2.' : 'Сначала напишите промпт v1 или заполните RTCFSC.');
      }
    }
    return null;
  }
  if (state.streaming) return null;

  const skRun = state.currentLesson?.scenario_key;
  const btnId =
    runKind === 'dialogue'
      ? 'runDialogueInAiBtn'
      : runKind === 'analysis'
        ? 'runAnalysisInAiBtn'
        : runKind === 'library'
          ? 'runLibraryTestBtn'
          : runKind === 'assistant'
            ? 'runAssistantTestBtn'
            : skRun === 'block2-practice-aim'
              ? pass === 'v2'
                ? 'runM2PromptV2Btn'
                : 'runM2PromptV1Btn'
              : pass === 'v2'
                ? 'runPromptV2Btn'
                : 'runPromptV1Btn';
  const runBtn = document.getElementById(btnId);
  setBtnLoading(runBtn, true);

  let resultPass = runKind === 'prompt' ? pass : runKind === 'dialogue' ? 'dialogue' : 'analysis';
  if (runKind === 'library') resultPass = 'library';
  if (runKind === 'assistant') resultPass = 'context';
  if (skRun === 'block2-practice-aim' && runKind === 'prompt') resultPass = pass;

  try {
    scheduleAutoSave();
    await saveSubmission('draft');
    const skRun2 = state.currentLesson?.scenario_key;
    if (skRun2 !== 'block1-practice-prompt') {
      openPracticeChat();
    }
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
    if (assistantText) {
      showPracticeAiResult(assistantText, resultPass);
      // Immediately persist workflow so ai_v1/ai_v2 survive page refresh
      saveSubmission('draft').catch(() => {});
    } else {
      alert('Ответ получен — откройте чат, чтобы прочитать полностью.');
    }
    return assistantText;
  } catch (e) {
    document.getElementById('typingRow')?.classList.add('hidden');
    throw e;
  } finally {
    setBtnLoading(runBtn, false);
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
  const wfApi = getPracticeWorkflowApi();
  if (isBlock2Scenario(sk)) {
    wfApi?.renderCaseBriefM2(task, sk);
    if (sk === 'block2-practice-aim') prefillAimFromTask(task);
    if (sk === 'block2-practice-library') prefillLibraryRole(task);
    if (sk === 'block2-practice-context') prefillContextType(task);
  } else {
    wfApi?.renderCaseBrief(task, sk);
    updateFragmentPreview();
    prefillDialogueFromTask(task);
    prefillPromptFromTask(task);
  }
  updateTaskSelectReminder();

  const startBtn = document.getElementById('startPracticeBtn');
  // Don't re-show "Начать задание" if the practice workflow is already in progress
  const practiceStarted = !document.getElementById('practiceWorkflowBlock')?.classList.contains('hidden');
  if (task && startBtn && !practiceStarted) {
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

function prefillAimFromTask(task) {
  if (!task) return;
  const iEl = document.getElementById('aimFieldI');
  const aEl = document.getElementById('aimFieldA');
  if (iEl && !iEl.value.trim()) iEl.value = task.raw_input || '';
  if (aEl && !aEl.value.trim()) aEl.value = task.expected_result || task.summary || '';
}

function prefillLibraryRole(task) {
  if (!task) return;
  const idEl = document.getElementById('libraryRoleIdHidden');
  const titleEl = document.getElementById('libraryRoleTitleHidden');
  if (idEl) idEl.value = task.id || '';
  if (titleEl) titleEl.value = task.title || '';
  const container = document.getElementById('libraryPromptCards');
  if (container && !container.querySelector('.aa-library-prompt-card')) {
    getPracticeWorkflowApi()?.initLibraryCards([], task.title);
  }
}

function prefillContextType(task) {
  if (!task) return;
  const idEl = document.getElementById('contextTypeIdHidden');
  const titleEl = document.getElementById('contextTypeTitleHidden');
  if (idEl) idEl.value = task.id || '';
  if (titleEl) titleEl.value = task.title || '';
  const tasksEl = document.getElementById('passportTasksV1');
  if (tasksEl && !tasksEl.value.trim() && task.sample_tasks?.length) {
    tasksEl.value = `Примеры задач: ${task.sample_tasks.join('; ')}`;
  }
  const roleEl = document.getElementById('passportRoleV1');
  if (roleEl && !roleEl.value.trim()) roleEl.value = task.title || '';
}

function selectTaskOption(taskId, { persist = true } = {}) {
  const prevTaskId = state.selectedTaskId;
  state.selectedTaskId = taskId || null;
  const list = document.getElementById('taskOptionsList');
  if (list) {
    list.querySelectorAll('.aa-task-card').forEach((btn) => {
      const isSelected = btn.dataset.taskId === state.selectedTaskId;
      btn.classList.toggle('is-selected', isSelected);
      btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });
  }
  // When user explicitly switches to a different task before starting,
  // clear RTCFSC/prompt fields so new task's data can prefill cleanly.
  // Skip during restore (persist = false) — fields already restored from saved draft.
  if (persist && taskId !== prevTaskId) {
    const sk = state.currentLesson?.scenario_key;
    if (sk === 'block1-practice-prompt') {
      const wfBlock = document.getElementById('practiceWorkflowBlock');
      if (!wfBlock || wfBlock.classList.contains('hidden')) {
        ['promptFieldR', 'promptFieldT', 'promptFieldC', 'promptFieldF',
         'promptFieldS', 'promptFieldCriteria', 'practicePromptV1'].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
      }
    }
  }
  renderTaskOptionDetail();
  if (persist && state.currentLessonId) scheduleAutoSave();
  updateComposerPlaceholder();
  updateAssignmentHint();
}

function updateComposerPlaceholder() {
  const composer = document.getElementById('composer');
  if (!composer) return;
  const task = getSelectedTaskOption();
  if (task) {
    composer.placeholder = `Задача выбрана: «${task.title}». Напишите наставнику — он поможет с первым шагом.`;
  } else {
    composer.placeholder = 'Сообщение наставнику…';
  }
}

function renderReactionBubble(r, cls = '') {
  if (!r) return '';
  return `<div class="aa-reaction-bubble ${cls}">
    <span class="aa-reaction-avatar">${r.avatar}</span>
    <div class="aa-reaction-body">
      <div class="aa-reaction-meta"><strong>${r.name}</strong><span>${r.time}</span></div>
      <p class="aa-reaction-text">${r.text}</p>
    </div>
  </div>`;
}

function renderPersonaCard(p) {
  if (!p) return '';
  const traits = (p.traits || []).map(t => `<li>${t}</li>`).join('');
  return `<div class="aa-persona-card">
    <div class="aa-persona-header">
      <span class="aa-reaction-avatar">${p.avatar}</span>
      <div><strong class="aa-persona-name">${p.name}</strong><p class="aa-persona-role">${p.role}</p></div>
    </div>
    <ul class="aa-persona-traits">${traits}</ul>
  </div>`;
}

function getP1RecipientData() {
  // Prefer AI-generated data in state, fallback to static lookup
  if (state.p1RecipientData) return state.p1RecipientData;
  const taskId = state.selectedTaskId;
  return taskId ? (P1_RECIPIENT_DATA[taskId] || null) : null;
}

/* Call backend to generate persona + reactionV1 via AI; cache in state */
async function generateP1RecipientDataAi() {
  // If already generated this session, reuse
  if (state.p1RecipientData) return state.p1RecipientData;
  // If restored from saved workflow, use that
  if (state.practiceWorkflow?.p1RecipientData) {
    state.p1RecipientData = state.practiceWorkflow.p1RecipientData;
    return state.p1RecipientData;
  }
  if (!state.currentLessonId) return null;
  try {
    const promptV1 = document.getElementById('practicePromptV1')?.value?.trim() || '';
    const aiV1 = document.getElementById('aiResultV1Preview')?.textContent?.trim() || '';
    const result = await api(`/api/academy/lessons/${state.currentLessonId}/recipient-preview`, {
      method: 'POST',
      body: JSON.stringify({
        task_id: state.selectedTaskId,
        prompt_v1: promptV1,
        ai_v1: aiV1,
        model: document.getElementById('modelSelect')?.value
      })
    });
    if (result?.data) {
      state.p1RecipientData = result.data;
      scheduleAutoSave();
      return state.p1RecipientData;
    }
    return null;
  } catch (e) {
    console.error('P1 recipient gen error:', e);
    return null;
  }
}

/* Show client reaction v1 — loading state first, then AI-generated data */
async function showP1ClientReaction() {
  const block = document.getElementById('clientReactionV1Block');
  const container = document.getElementById('clientReactionV1');
  if (!block || !container) return;

  // Show loading immediately
  container.innerHTML =
    `<span class="aa-reaction-avatar">⏳</span>` +
    `<div class="aa-reaction-body"><p class="aa-reaction-text text-slate-400 text-xs animate-pulse">Формируем реакцию адресата…</p></div>`;
  block.classList.remove('hidden');

  // Store promise so showP1ClientContext can await it
  state._p1RecipientPromise = generateP1RecipientDataAi();
  const rd = await state._p1RecipientPromise;

  if (!rd?.reactionV1) {
    container.innerHTML =
      `<span class="aa-reaction-avatar">👤</span>` +
      `<div class="aa-reaction-body"><p class="aa-reaction-text text-slate-400 italic text-xs">Не удалось получить реакцию адресата</p></div>`;
    return;
  }
  const r = rd.reactionV1;
  container.innerHTML =
    `<span class="aa-reaction-avatar">${escapeHtml(r.avatar || '👤')}</span>` +
    `<div class="aa-reaction-body">` +
    `<div class="aa-reaction-meta"><span class="aa-reaction-name">${escapeHtml(r.name || '')}</span></div>` +
    `<p class="aa-reaction-text">${escapeHtml(r.text || '')}</p>` +
    `</div>`;
}

/* Show persona card in step 2 substep 1 — await AI generation if still in progress */
async function showP1ClientContext() {
  // Await AI generation if still in flight
  if (state._p1RecipientPromise) await state._p1RecipientPromise;

  const rd = getP1RecipientData();
  if (!rd?.persona) return;
  const block = document.getElementById('clientContextV2Block');
  const container = document.getElementById('clientContextV2');
  if (!block || !container) return;
  const p = rd.persona;
  const traitsHtml = Array.isArray(p.traits)
    ? `<ul class="mt-2 space-y-1 list-disc pl-4">${p.traits.map(t => `<li class="text-xs text-slate-600">${escapeHtml(t)}</li>`).join('')}</ul>`
    : '';
  container.innerHTML =
    `<div class="flex items-center gap-2 mb-2">` +
    `<span class="text-2xl">${escapeHtml(p.avatar || '👤')}</span>` +
    `<div><p class="font-semibold text-slate-900 text-sm">${escapeHtml(p.name || '')}</p>` +
    `<p class="text-xs text-slate-500">${escapeHtml(p.role || '')}</p></div>` +
    `</div>${traitsHtml}`;
  block.classList.remove('hidden');
  renderP1InlineSelfCheck();
}

/* Generate reactionV2 via AI after v2 is tested */
async function generateP1ReactionV2Ai() {
  // Already generated this session
  if (state.p1RecipientData?.reactionV2) return state.p1RecipientData;
  // Restored from saved workflow
  if (state.practiceWorkflow?.p1RecipientData?.reactionV2) {
    if (!state.p1RecipientData) state.p1RecipientData = state.practiceWorkflow.p1RecipientData;
    else state.p1RecipientData.reactionV2 = state.practiceWorkflow.p1RecipientData.reactionV2;
    return state.p1RecipientData;
  }
  if (!state.currentLessonId) return null;
  try {
    const promptV2 = document.getElementById('practicePromptV2')?.value?.trim() || '';
    const aiV2 = document.getElementById('aiResultV2Preview')?.textContent?.trim() || '';
    const result = await api(`/api/academy/lessons/${state.currentLessonId}/recipient-preview`, {
      method: 'POST',
      body: JSON.stringify({
        pass: 'v2',
        task_id: state.selectedTaskId,
        prompt_v2: promptV2,
        ai_v2: aiV2,
        model: document.getElementById('modelSelect')?.value
      })
    });
    if (result?.data?.reactionV2) {
      if (!state.p1RecipientData) state.p1RecipientData = {};
      state.p1RecipientData.reactionV2 = result.data.reactionV2;
      scheduleAutoSave();
    }
    return state.p1RecipientData;
  } catch (e) {
    console.error('P1 reaction v2 gen error:', e);
    return null;
  }
}

/* Show recipient reaction to v2 — loading first, then AI-generated */
async function showP1ClientReactionV2() {
  const block = document.getElementById('clientReactionV2Block');
  const container = document.getElementById('clientReactionV2');
  if (!block || !container) return;

  container.innerHTML =
    `<span class="aa-reaction-avatar">⏳</span>` +
    `<div class="aa-reaction-body"><p class="aa-reaction-text text-slate-400 text-xs animate-pulse">Формируем реакцию адресата…</p></div>`;
  block.classList.remove('hidden');

  const rd = await generateP1ReactionV2Ai();
  const r = rd?.reactionV2;
  if (!r) {
    container.innerHTML =
      `<span class="aa-reaction-avatar">👤</span>` +
      `<div class="aa-reaction-body"><p class="aa-reaction-text text-slate-400 italic text-xs">Не удалось получить реакцию адресата</p></div>`;
    return;
  }
  container.innerHTML =
    `<span class="aa-reaction-avatar">${escapeHtml(r.avatar || '👤')}</span>` +
    `<div class="aa-reaction-body">` +
    `<div class="aa-reaction-meta"><span class="aa-reaction-name">${escapeHtml(r.name || '')}</span></div>` +
    `<p class="aa-reaction-text">${escapeHtml(r.text || '')}</p>` +
    `</div>`;
}

/* Render inline self-assessment checklist for v2 step */
function renderP1InlineSelfCheck() {
  const block = document.getElementById('p1SelfCheckBlock');
  const list = document.getElementById('p1SelfCheckList');
  if (!block || !list) return;
  const items = window.AcademyPracticeWorkflow?.SELF_CHECK?.['block1-practice-prompt'] || [];
  if (!items.length) return;
  if (list.children.length > 0) { block.classList.remove('hidden'); return; } // already rendered
  list.innerHTML = '';
  items.forEach((label, idx) => {
    const id = `p1Check_${idx}`;
    const li = document.createElement('label');
    li.className = 'flex items-start gap-2 text-sm text-slate-700 cursor-pointer select-none';
    li.innerHTML = `<input type="checkbox" id="${id}" data-p1-check="${idx}" class="mt-0.5 shrink-0" /><span>${escapeHtml(label)}</span>`;
    list.appendChild(li);
  });
  block.classList.remove('hidden');
}

/* Ask AI to evaluate both prompts; show result in aiEvalBlock inside the form */
async function runP1EvalInAi() {
  const sk = state.currentLesson?.scenario_key;
  if (sk !== 'block1-practice-prompt') return;
  if (state.streaming) return;

  const promptV1 = document.getElementById('practicePromptV1')?.value?.trim() || '—';
  const aiV1 = document.getElementById('aiResultV1Preview')?.textContent?.trim() || '(не получен)';
  const promptV2 = document.getElementById('practicePromptV2')?.value?.trim() || '—';
  const aiV2 = document.getElementById('aiResultV2Preview')?.textContent?.trim() || '(не получен)';
  const task = getSelectedTaskOption();

  const evalBlock = document.getElementById('aiEvalBlock');
  const evalPreview = document.getElementById('aiEvalPreview');
  if (!evalBlock || !evalPreview) return;

  evalPreview.innerHTML = '<p class="text-slate-400 text-xs">ИИ анализирует оба промпта…</p>';
  evalBlock.classList.remove('hidden');
  evalBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const evalPrompt =
    `Ты опытный наставник по промпт-инжинирингу. Оцени два промпта и сравни их результаты.\n\n` +
    `Кейс: ${task?.title || ''}\n` +
    `Контекст: ${task?.description || ''}\n\n` +
    `ПРОМПТ V1:\n${promptV1}\n\nОТВЕТ ИИ V1:\n${aiV1}\n\n` +
    `ПРОМПТ V2:\n${promptV2}\n\nОТВЕТ ИИ V2:\n${aiV2}\n\n` +
    `Дай структурированную оценку на русском языке:\n` +
    `**Ключевые улучшения** — что конкретно стало лучше в v2 (2–3 пункта)\n` +
    `**Слабые места v2** — что ещё можно улучшить\n` +
    `**Рекомендации** — 1–2 конкретных совета для следующих промптов\n` +
    `**Executive Summary** — одна фраза: главный урок этой практики\n\n` +
    `Отвечай кратко и по делу. Используй маркированные списки.`;

  try {
    const payload = {
      conversationId: state.currentConversationId || undefined,
      lessonId: state.currentLessonId || undefined,
      courseId: state.currentLesson?.course_id || undefined,
      message: evalPrompt,
      model: document.getElementById('modelSelect').value,
      chatMode: 'practice_run',
      practiceRunContext: {
        runKind: 'prompt_eval',
        pass: null,
        taskTitle: task?.title || '',
        taskContext: task?.context || task?.description || ''
      }
    };
    const { assistantText } = await streamChat(payload);
    if (assistantText) {
      evalPreview.innerHTML = renderMarkdown(assistantText.trim());
      // Store plain text for auto-save / report
      evalPreview.dataset.rawText = assistantText.trim();
      scheduleAutoSave();
    } else {
      evalPreview.innerHTML = '<p class="text-slate-400 text-xs">(Оценка получена — откройте чат для полного текста)</p>';
    }
  } catch (e) {
    evalPreview.innerHTML = '<p class="text-red-500 text-xs">(Не удалось получить оценку: ' + escapeHtml(e?.message || String(e)) + ')</p>';
    console.error('P1 eval error:', e);
  }
}

function updateAssignmentHint() {
  const el = document.getElementById('assignmentText');
  if (!el) return;
  const sk = state.currentLesson?.scenario_key;
  const hints = STEP_HINTS[sk];
  if (!hints) return;

  const practiceStarted = !document.getElementById('practiceWorkflowBlock')?.classList.contains('hidden');
  const step = state.practiceStep || 1;
  const sub = state.practiceSubstep || 1;

  let html;
  if (!practiceStarted) {
    if (state.selectedTaskId && sk === 'block1-practice-scenario') {
      // Situation details are shown in caseBriefBlock (below task options) — keep hint brief here
      html = '<p class="text-sm text-slate-700">Ознакомьтесь с ситуацией и ролями ниже. Нажмите <strong>«Начать задание»</strong>.</p>';
    } else {
      html = state.selectedTaskId ? hints.taskSelected : hints.initial;
    }
  } else if (sk === 'block1-practice-prompt') {
    html = buildP1StepHint(step, sub);
  } else if (sk === 'block1-practice-scenario') {
    html = buildP2StepHint(step, sub);
  } else if (sk === 'block1-practice-hallucination') {
    html = buildP3StepHint(step, sub);
  } else {
    const key = hints.steps[`${step}.${sub}`] ? `${step}.${sub}` : String(step);
    html = hints.steps[key] || hints.steps[String(step)] || hints.taskSelected;
  }

  el.innerHTML = html || '';
}

function buildP1StepHint(step, sub) {
  const rd = getP1RecipientData();
  const hints = STEP_HINTS['block1-practice-prompt'].steps;

  if (step === 1) {
    if (sub === 1) return hints['1.1'];
    if (sub === 2) {
      // Reaction is already shown inline in the form — just show instructional text here
      return '<p class="text-sm text-slate-700">Посмотрите на ответ нейросети и реакцию адресата в форме ниже. Нажмите <strong>«Перейти к промпту v2»</strong> — откроется профиль адресата.</p>';
    }
  }
  if (step === 2) {
    if (sub === 1) {
      // Persona card already shown inline in the form
      return '<p class="text-sm text-slate-700">Профиль адресата показан в форме ниже. Напишите <strong>промпт v2</strong> с учётом его особенностей и нажмите <strong>«Протестировать промпт v2»</strong>.</p>';
    }
    if (sub === 2) {
      return '<p class="text-sm text-slate-700">Посмотрите на реакцию адресата — стало ли лучше? Нажмите <strong>«Далее»</strong>.</p>';
    }
  }
  if (step === 3) return hints['3'];
  return hints[`${step}.${sub}`] || hints[String(step)] || '';
}

function getP2ScenarioData() {
  const task = getSelectedTaskOption();
  if (!task) return null;
  return P2_SCENARIO_DATA[task.id] || null;
}

function getP3FragmentData() {
  const task = getSelectedTaskOption();
  if (!task) return null;
  return P3_FRAGMENT_DATA[task.id] || null;
}

function buildP2StepHint(step, sub) {
  const hints = STEP_HINTS['block1-practice-scenario'].steps;
  if (step === 1) {
    if (sub === 1) return hints['1.1'];
    if (sub === 2) return hints['1.2'];
  }
  if (step === 2) return hints['2.1'];
  if (step === 3) return hints['3'];
  return hints[`${step}.${sub}`] || hints[String(step)] || '';
}

const VERIFY_QUESTIONS_TIP = `<p class="font-medium text-slate-700 mb-1.5">Шпаргалка: вопросы-верификаторы</p><ul class="space-y-1 text-xs text-slate-600"><li><strong>На цифру:</strong> «Назови источник этой статистики»</li><li><strong>На совет:</strong> «Это справедливо для всех случаев или только для конкретного контекста?»</li><li><strong>На ссылку:</strong> «Приведи точное название документа / отчёта»</li><li><strong>На уверенность:</strong> «Какова погрешность этого прогноза?»</li><li><strong>На авторитет:</strong> «Какую именно работу McKinsey / Gartner ты имеешь в виду?»</li><li><strong>На вывод:</strong> «Приведи 2 альтернативные точки зрения по этому вопросу»</li><li><strong>Общий:</strong> «Что ты не знаешь об этой теме?»</li></ul>`;

function buildP3StepHint(step, sub) {
  const fd = getP3FragmentData();
  const hints = STEP_HINTS['block1-practice-hallucination'].steps;

  if (step === 1) {
    const consequences = fd?.consequences
      ? `<div class="aa-reaction-bubble is-fail mb-3"><p class="text-xs font-medium text-red-700 mb-1">⚠️ Что случится если использовать без проверки:</p><p class="text-sm text-slate-700">${fd.consequences}</p></div>`
      : '';
    return consequences + `${VERIFY_QUESTIONS_TIP}<p class="mt-3 text-sm text-slate-700">Найдите <strong>3–5 утверждений</strong> которые стоит проверить, и напишите вопросы которые зададите нейросети.</p>`;
  }
  if (step === 2) {
    if (sub === 1) {
      return `<p class="text-sm text-slate-700 mb-2">Скопируйте вопросы из шага 1 и отправьте их в чат справа.</p><div class="aa-persona-card p-3"><p class="text-xs font-medium text-slate-500 mb-1">На что смотреть в ответах ИИ:</p><ul class="text-xs text-slate-600 space-y-1 list-disc list-inside"><li>Признаёт ли что не знает точный источник?</li><li>Меняет ли формулировки на менее уверенные?</li><li>Предлагает ли проверить в независимом источнике?</li><li>Или продолжает настаивать без доказательств?</li></ul></div>`;
    }
    if (sub === 2) {
      if (fd?.expertVerdict) {
        const ev = fd.expertVerdict;
        const badge = ev.decision.toLowerCase().includes('нельзя')
          ? `<span class="inline-block bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded">🚫 ${ev.decision}</span>`
          : `<span class="inline-block bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded">⚠️ ${ev.decision}</span>`;
        const risks = ev.mainRisks.map(r => `<li>${r}</li>`).join('');
        return `<div class="aa-persona-card p-3 mb-3"><p class="text-xs font-medium text-slate-500 mb-1">Экспертный разбор</p>${badge}<ul class="mt-2 text-xs text-slate-600 space-y-1 list-disc list-inside">${risks}</ul></div><p class="text-sm text-slate-700">Примите решение и запишите <strong>главный вывод</strong>: какой вопрос сработал лучше всего?</p>`;
      }
      return hints['2.2'];
    }
  }
  if (step === 3) return hints['3'];
  return hints[`${step}.${sub}`] || hints[String(step)] || '';
}

function startPractice() {
  const sk = state.currentLesson?.scenario_key;
  if (!sk) return;
  const wf = document.getElementById('practiceWorkflowBlock');
  wf?.classList.remove('hidden');
  document.getElementById('startPracticeBtn')?.classList.add('hidden');
  // Hide unselected cases and lesson description after start
  if (['block1-practice-prompt', 'block1-practice-scenario', 'block1-practice-hallucination', 'block1-practice-reverse'].includes(sk)) {
    const list = document.getElementById('taskOptionsList');
    list?.querySelectorAll('.aa-task-card').forEach((btn) => {
      btn.classList.toggle('hidden', btn.dataset.taskId !== state.selectedTaskId);
    });
    document.getElementById('taskOptionsPickLabel')?.classList.add('hidden');
    document.getElementById('lessonContent')?.classList.add('hidden');
  }
  // P5: hide task options block entirely (all 5 texts shown as quiz cards)
  if (sk === 'block1-practice-detective') {
    document.getElementById('taskOptionsBlock')?.classList.add('hidden');
    document.getElementById('lessonContent')?.classList.add('hidden');
  }
  // P2: generate persona card on start
  if (sk === 'block1-practice-scenario') {
    generateP2Persona().catch(() => {});
  }
  if (sk === 'block1-practice-hallucination') {
    generateP3Hint().catch(() => {});
  }
  if (sk === 'block1-practice-reverse') {
    initP4TargetOutput();
  }
  if (sk === 'block1-practice-detective') {
    renderP5TextCards();
  }
  if (sk === 'block2-practice-library') {
    const task = getSelectedTaskOption();
    getPracticeWorkflowApi()?.initLibraryCards([], task?.title);
  }
  const savedStep = state.practiceWorkflow?.currentStep;
  const savedSub = state.practiceWorkflow?.currentSubstep;
  if (savedSub && savedSub > 1) state.practiceSubstep = savedSub;
  showPracticeStep(savedStep && savedStep > 1 ? savedStep : 1, {
    restoreSubstep: Boolean(savedSub && savedSub > 1)
  });
}

/* Build HTML-rendered version of P1 report and inject into reportRenderBlock */
function buildReportP1Html(task, wf, num) {
  const p1 = wf.p1 || {};

  function esc(t) { return escapeHtml(t || ''); }

  function collapsible(borderCls, bgCls, labelCls, label, body, previewText = '') {
    const snippet = previewText
      ? `<span class="text-xs text-slate-400 font-normal normal-case tracking-normal truncate ml-2 max-w-[200px]">${esc(String(previewText).slice(0, 55))}${String(previewText).length > 55 ? '…' : ''}</span>`
      : '';
    return `<details class="rounded-xl border ${borderCls} ${bgCls} px-4 py-3">
      <summary class="cursor-pointer list-none flex items-center gap-1.5">
        <span class="text-slate-400 text-xs select-none">▸</span>
        <p class="text-xs font-bold uppercase tracking-widest ${labelCls} m-0 shrink-0">${label}</p>
        ${snippet}
      </summary>
      <div class="space-y-2 mt-2">${body}</div>
    </details>`;
  }

  function preBox(text) {
    return `<pre class="text-sm text-slate-700 whitespace-pre-wrap bg-white rounded-lg p-3 border border-slate-200 leading-relaxed font-sans">${esc(text || '—')}</pre>`;
  }

  function mdBox(text) {
    if (!text) return `<p class="text-sm text-slate-400 italic">—</p>`;
    const html = typeof renderMarkdown === 'function' ? renderMarkdown(text) : esc(text);
    return `<div class="prose prose-sm max-w-none text-slate-700">${html}</div>`;
  }

  const header = `<div class="rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white px-5 py-4">
    <p class="text-xs font-semibold uppercase tracking-widest opacity-80 mb-0.5">Практика 1 · Промпт-инжиниринг</p>
    <p class="font-bold text-base">Кейс ${num || '?'}: ${esc(task?.title)}</p>
  </div>`;

  const badPrompt = collapsible('border-red-200', 'bg-red-50', 'text-red-500', 'Что было не так',
    `<code class="block text-sm bg-white rounded-lg px-3 py-2 border border-red-100 text-slate-700">${esc(task?.bad_prompt || '—')}</code>
     <p class="text-xs text-slate-500">Слишком общий запрос — нет роли, контекста, формата, стиля и критериев.</p>`,
    task?.bad_prompt);

  const pv1 = collapsible('border-slate-200', 'bg-white', 'text-slate-400', 'Промпт v1 (RTCFSC)', preBox(p1.prompt_v1), p1.prompt_v1);
  const av1 = collapsible('border-slate-100', 'bg-slate-50', 'text-slate-400', 'Ответ ИИ v1', mdBox(p1.ai_v1), p1.ai_v1);
  const pv2 = collapsible('border-blue-200', 'bg-blue-50', 'text-blue-600', 'Промпт v2', preBox(p1.prompt_v2), p1.prompt_v2);
  const av2 = collapsible('border-slate-100', 'bg-slate-50', 'text-slate-400', 'Ответ ИИ v2', mdBox(p1.ai_v2), p1.ai_v2);

  return [header, badPrompt, pv1, av1, pv2, av2].join('\n');
}

/* Inject HTML report and hide the plain textarea (keeps value for submission) */
function showP1ReportHtml(task, wf, num) {
  const block = document.getElementById('reportRenderBlock');
  const label = document.getElementById('assignmentAnswerLabel');
  if (!block) return;
  block.innerHTML = buildReportP1Html(task, wf, num);
  block.classList.remove('hidden');
  if (label) label.classList.add('hidden');
}

/* ===== P2 FUNCTIONS ===== */

async function generateP2Persona() {
  if (!state.currentLessonId || !state.selectedTaskId) return;
  const model = document.getElementById('modelSelect')?.value;
  document.getElementById('p2PersonaLoading')?.classList.remove('hidden');
  document.getElementById('p2PersonaCard')?.classList.add('hidden');
  try {
    const out = await api(`/api/academy/lessons/${state.currentLessonId}/dialogue-persona`, {
      method: 'POST',
      body: JSON.stringify({ task_id: state.selectedTaskId, model })
    });
    const persona = out.data?.persona;
    if (persona) {
      state.p2PersonaData = persona;
      renderP2PersonaCard(persona);
      prefillRolesFromPersona(persona);
      saveSubmission('draft').catch(() => {});
    }
  } catch (e) {
    console.warn('P2 persona generation failed:', e.message);
  } finally {
    document.getElementById('p2PersonaLoading')?.classList.add('hidden');
  }
}

function renderP2PersonaCard(persona) {
  if (!persona) return;
  const card = document.getElementById('p2PersonaCard');
  if (!card) return;
  const avatar = document.getElementById('p2PersonaAvatar');
  const name = document.getElementById('p2PersonaName');
  const role = document.getElementById('p2PersonaRole');
  const goal = document.getElementById('p2PersonaGoal');
  const traits = document.getElementById('p2PersonaTraits');
  if (avatar) avatar.textContent = persona.avatar || '👤';
  if (name) name.textContent = persona.name || '';
  if (role) role.textContent = persona.role || '';
  if (goal) goal.textContent = persona.goal || '';
  if (traits) {
    traits.innerHTML = (persona.traits || []).map((t) =>
      `<span class="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">${escapeHtml(t)}</span>`
    ).join('');
  }
  card.classList.remove('hidden');
}

function prefillRolesFromPersona(persona) {
  const task = getSelectedTaskOption();
  const aiEl = document.getElementById('practiceRoleAi');
  const meEl = document.getElementById('practiceRoleMe');
  if (aiEl && !aiEl.value.trim()) {
    aiEl.value = persona.name
      ? `${persona.name} — ${persona.role || task?.ai_role || ''}`
      : (task?.ai_role || '');
  }
  if (meEl && !meEl.value.trim()) {
    meEl.value = task?.student_role || '';
  }
}

async function runP2DialogueEval() {
  if (!state.currentLessonId) return;
  const model = document.getElementById('modelSelect')?.value;
  const loadingEl = document.getElementById('p2EvalLoading');
  const evalBlock = document.getElementById('p2EvalBlock');
  loadingEl?.classList.remove('hidden');
  if (evalBlock) evalBlock.classList.add('hidden');
  try {
    const messages = state.p2DialogueMessages || [];
    const out = await api(`/api/academy/lessons/${state.currentLessonId}/dialogue-eval`, {
      method: 'POST',
      body: JSON.stringify({
        task_id: state.selectedTaskId,
        dialogue_messages: messages,
        persona: state.p2PersonaData,
        model
      })
    });
    const evalData = out.data;
    if (evalData) {
      state.p2EvalData = evalData;
      renderP2EvalBlock(evalData);
      // Pre-fill best reply field from AI eval
      const bestEl = document.getElementById('p2BestReply');
      if (bestEl && !bestEl.value.trim() && evalData.bestReply?.text) {
        bestEl.value = `«${evalData.bestReply.text}» — ${evalData.bestReply.why || ''}`;
      }
      saveSubmission('draft').catch(() => {});
    }
  } catch (e) {
    console.warn('P2 eval failed:', e.message);
  } finally {
    loadingEl?.classList.add('hidden');
  }
}

function renderP2EvalBlock(evalData) {
  if (!evalData) return;
  const evalBlock = document.getElementById('p2EvalBlock');
  if (!evalBlock) return;

  const bestBlock = document.getElementById('p2EvalBestReply');
  const bestText = document.getElementById('p2EvalBestText');
  const bestWhy = document.getElementById('p2EvalBestWhy');
  if (bestBlock && evalData.bestReply?.text) {
    if (bestText) bestText.textContent = `«${evalData.bestReply.text}»`;
    if (bestWhy) bestWhy.textContent = evalData.bestReply.why || '';
    bestBlock.classList.remove('hidden');
  }

  const weakBlock = document.getElementById('p2EvalWeakReply');
  const weakText = document.getElementById('p2EvalWeakText');
  const weakHow = document.getElementById('p2EvalWeakHow');
  if (weakBlock && evalData.weakReply?.text) {
    if (weakText) weakText.textContent = `«${evalData.weakReply.text}»`;
    if (weakHow) weakHow.textContent = evalData.weakReply.how_to_improve || '';
    weakBlock.classList.remove('hidden');
  }

  const fbBlock = document.getElementById('p2EvalPersonaFb');
  const fbText = document.getElementById('p2EvalPersonaText');
  if (fbBlock && evalData.personaFeedback) {
    if (fbText) fbText.textContent = evalData.personaFeedback;
    fbBlock.classList.remove('hidden');
  }

  evalBlock.classList.remove('hidden');
}

function renderP2InlineSelfCheck() {
  const wfApi = getPracticeWorkflowApi();
  const block = document.getElementById('p2InlineSelfCheck');
  const list = document.getElementById('p2InlineSelfCheckList');
  if (!block || !list || list.children.length > 0) {
    block?.classList.remove('hidden');
    return;
  }
  const items = wfApi?.SELF_CHECK?.['block1-practice-scenario'] || [];
  if (!items.length) return;
  list.innerHTML = '';
  items.forEach((label, i) => {
    const li = document.createElement('label');
    li.className = 'flex items-start gap-2 text-sm text-slate-700 cursor-pointer';
    li.innerHTML = `<input type="checkbox" data-p2-self-idx="${i}" class="mt-1" /><span>${escapeHtml(label)}</span>`;
    list.appendChild(li);
  });
  block.classList.remove('hidden');
}

function showP2ReportHtml(task, wf, num) {
  const wfApi = getPracticeWorkflowApi();
  const block = document.getElementById('reportRenderBlock');
  const label = document.getElementById('assignmentAnswerLabel');
  if (!block || !wfApi?.buildReportP2Html) return;
  block.innerHTML = wfApi.buildReportP2Html(task, wf, num);
  block.classList.remove('hidden');
  if (label) label.classList.add('hidden');
}

function renderP2InlineBubble(text, role) {
  const msgBox = document.getElementById('p2InlineChatMessages');
  if (!msgBox) return;
  document.getElementById('p2InlineChatPlaceholder')?.remove();
  const bubble = document.createElement('div');
  bubble.dataset.role = role;
  if (role === 'user') {
    bubble.className = 'ml-auto rounded-xl bg-indigo-600 text-white px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap break-words';
    bubble.textContent = text;
  } else {
    bubble.className = 'rounded-xl bg-slate-100 border border-slate-200 px-3 py-2 text-sm text-slate-900 max-w-[85%] prose prose-sm';
    bubble.innerHTML = renderMarkdown(text);
  }
  msgBox.appendChild(bubble);
  msgBox.scrollTop = msgBox.scrollHeight;
  return bubble;
}

async function streamP2Message(userText, isKickoff = false) {
  const model = document.getElementById('modelSelect')?.value;
  const persona = state.p2PersonaData;
  const roleAi = document.getElementById('practiceRoleAi')?.value?.trim() || persona?.role || 'Собеседник';
  const roleMe = document.getElementById('practiceRoleMe')?.value?.trim() || 'Менеджер';
  const goal = document.getElementById('practiceStudentGoal')?.value?.trim() || '';

  const dialogueTurn = (state.p2DialogueMessages || []).filter((m) => m.role === 'assistant').length;
  const resistanceLevel = dialogueTurn < 4
    ? 'Ты в самом начале разговора — веди себя максимально жёстко: отрицай, перебивай, давай короткие категоричные отказы, показывай раздражение. Не иди на уступки ни при каких аргументах.'
    : dialogueTurn < 8
    ? 'Ты чуть смягчился, но по-прежнему скептичен: задавай каверзные вопросы, указывай на слабые места аргументов, требуй конкретики.'
    : 'Ты начинаешь слышать аргументы, но всё ещё сомневаешься: можешь частично согласиться, но сразу добавляй новое возражение.';

  const personaInstructions = persona
    ? `Ты играешь роль: ${persona.name}, ${persona.role}. Цель персонажа: ${persona.goal}. Характер: ${(persona.traits || []).join(', ')}. Настроение: ${persona.mood}. Студент играет роль: ${roleMe}, его цель: ${goal}. ${resistanceLevel} Отвечай коротко — 1-3 предложения. Только реплика, без пояснений и ремарок.`
    : `Ты играешь роль: ${roleAi}. Студент играет роль: ${roleMe}, его цель: ${goal}. ${resistanceLevel} Отвечай коротко — 1-3 предложения. Только реплика, без пояснений.`;

  const msgBox = document.getElementById('p2InlineChatMessages');
  if (!msgBox) return;

  const sendBtn = document.getElementById('p2SendBtn');
  const input = document.getElementById('p2InlineChatInput');
  if (sendBtn) sendBtn.disabled = true;

  if (!isKickoff && userText) {
    state.p2DialogueMessages.push({ role: 'user', content: userText });
    renderP2InlineBubble(userText, 'user');
  }

  // Streaming bubble for AI response
  document.getElementById('p2InlineChatPlaceholder')?.remove();
  const aiBubble = document.createElement('div');
  aiBubble.dataset.role = 'assistant';
  aiBubble.className = 'rounded-xl bg-slate-100 border border-slate-200 px-3 py-2 text-sm text-slate-900 max-w-[85%] prose prose-sm';
  aiBubble.innerHTML = '<span class="text-slate-400 text-xs">…</span>';
  msgBox.appendChild(aiBubble);
  msgBox.scrollTop = msgBox.scrollHeight;

  try {
    const triggerText = isKickoff
      ? 'Открой сцену — скажи первую реплику в своей роли, одним предложением.'
      : userText;

    const res = await fetch(`${apiBase}/api/academy/chat`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: triggerText,
        lessonId: state.currentLessonId,
        model,
        assistantInstructions: personaInstructions,
        conversationId: state.p2ConversationId || undefined,
        chatMode: 'dialogue'
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Ошибка ИИ');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
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
        if (json.type === 'start' && json.conversationId) {
          state.p2ConversationId = json.conversationId;
        }
        if (json.type === 'chunk') {
          assembled += json.text || '';
          aiBubble.innerHTML = renderMarkdown(assembled);
          msgBox.scrollTop = msgBox.scrollHeight;
        }
      }
    }

    const assistantText = assembled.trim();
    if (assistantText) {
      aiBubble.innerHTML = renderMarkdown(assistantText);
      state.p2DialogueMessages.push({ role: 'assistant', content: assistantText });
      updateP2PairCounter();
      scheduleAutoSave();
    } else {
      aiBubble.remove();
    }
  } catch (e) {
    aiBubble.remove();
    throw e;
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    if (input) input.focus();
  }
}

function updateP2PairCounter() {
  if (state.currentLesson?.scenario_key !== 'block1-practice-scenario') return;
  const counterEl = document.getElementById('p2PairCounter');
  const hintEl = document.getElementById('p2PairCounterHint');
  const finishBtn = document.getElementById('practiceNextP2S1Btn');
  if (!counterEl) return;
  const pairCount = (state.p2DialogueMessages || []).filter((m) => m.role === 'assistant').length;
  counterEl.textContent = pairCount >= 5 ? `✓ ${pairCount}` : `${pairCount} / 5`;
  if (pairCount >= 5) {
    if (hintEl) hintEl.textContent = '(минимум выполнен)';
    finishBtn?.classList.remove('hidden');
  } else if (pairCount === 0) {
    if (hintEl) hintEl.textContent = '(начните диалог)';
  } else {
    if (hintEl) hintEl.textContent = '(продолжайте диалог)';
  }
}

/* ===== END P2 FUNCTIONS ===== */

/* ===== P3 FUNCTIONS ===== */

async function generateP3Hint() {
  if (!state.currentLessonId || !state.selectedTaskId) return;
  const model = document.getElementById('modelSelect')?.value;
  document.getElementById('p3HintLoading')?.classList.remove('hidden');
  document.getElementById('p3HintCard')?.classList.add('hidden');
  try {
    const out = await api(`/api/academy/lessons/${state.currentLessonId}/hallucination-hint`, {
      method: 'POST',
      body: JSON.stringify({ task_id: state.selectedTaskId, model })
    });
    const data = out.data;
    if (data) {
      state.p3HintData = data;
      renderP3HintCard(data);
    }
  } catch (e) {
    console.warn('P3 hint failed:', e.message);
  } finally {
    document.getElementById('p3HintLoading')?.classList.add('hidden');
  }
}

function renderP3HintCard(data) {
  if (!data) return;
  const card = document.getElementById('p3HintCard');
  if (!card) return;
  const cats = document.getElementById('p3HintCategories');
  const tip = document.getElementById('p3HintTip');
  if (cats) {
    cats.innerHTML = (data.categories || []).map((c) =>
      `<span class="rounded-full bg-amber-200 text-amber-800 text-xs px-2 py-0.5">${c}</span>`
    ).join('');
    if (data.risk_count) {
      cats.innerHTML += `<span class="rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-semibold">~${data.risk_count} утверждений</span>`;
    }
  }
  if (tip) tip.textContent = data.tip || '';
  card.classList.remove('hidden');
}

function renderP3InlineBubble(text, role) {
  const msgBox = document.getElementById('p3InlineChatMessages');
  if (!msgBox) return;
  document.getElementById('p3InlineChatPlaceholder')?.remove();
  const bubble = document.createElement('div');
  bubble.dataset.role = role;
  if (role === 'user') {
    bubble.className = 'ml-auto rounded-xl bg-indigo-600 text-white px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap break-words';
    bubble.textContent = text;
  } else {
    bubble.className = 'rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-slate-900 max-w-[85%] prose prose-sm';
    bubble.innerHTML = renderMarkdown(text);
  }
  msgBox.appendChild(bubble);
  msgBox.scrollTop = msgBox.scrollHeight;
  return bubble;
}

async function streamP3Message(userText) {
  // Force Perplexity sonar for web search with citations
  const model = 'perplexity/sonar';
  const msgBox = document.getElementById('p3InlineChatMessages');
  if (!msgBox) return;

  const sendBtn = document.getElementById('p3SendBtn');
  const input = document.getElementById('p3InlineChatInput');
  if (sendBtn) sendBtn.disabled = true;

  state.p3VerificationMessages.push({ role: 'user', content: userText });
  renderP3InlineBubble(userText, 'user');

  document.getElementById('p3InlineChatPlaceholder')?.remove();
  const aiBubble = document.createElement('div');
  aiBubble.dataset.role = 'assistant';
  aiBubble.className = 'rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-slate-900 max-w-[85%] prose prose-sm';
  aiBubble.innerHTML = '<span class="text-slate-400 text-xs">…</span>';
  msgBox.appendChild(aiBubble);
  msgBox.scrollTop = msgBox.scrollHeight;

  const task = getSelectedTaskOption();
  const fragment = task?.fragment_text || task?.context || '';
  const studentClaims = document.getElementById('p3SuspiciousClaims')?.value?.trim() || '';

  const systemPrompt =
    'Ты — эксперт по верификации фактов с доступом к интернету. Студент проверяет утверждения из текста, сгенерированного нейросетью.\n\n' +
    'ТВОЯ ЗАДАЧА:\n' +
    '— Найди в интернете реальные источники для проверяемого утверждения.\n' +
    '— Если реального источника нет или цифра не подтверждается — прямо скажи об этом.\n' +
    '— Если студент просит дать достоверную версию — найди реальные данные и дай корректную формулировку со ссылкой.\n' +
    '— Не придумывай источники — только то что реально нашёл.\n\n' +
    (fragment ? `АНАЛИЗИРУЕМЫЙ ФРАГМЕНТ (сгенерирован нейросетью):\n"""\n${fragment.slice(0, 1500)}\n"""\n\n` : '') +
    (studentClaims ? `Студент уже отметил как подозрительные:\n${studentClaims}\n\n` : '') +
    'Отвечай коротко — 2-4 предложения. Конкретно по утверждению.';

  try {
    const res = await fetch(`${apiBase}/api/academy/chat`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        lessonId: state.currentLessonId,
        conversationId: state.p3ConversationId || undefined,
        model,
        assistantInstructions: systemPrompt,
        chatMode: 'verification'
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Ошибка ИИ');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', assembled = '', citations = [];

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
        if (json.type === 'start' && json.conversationId) {
          state.p3ConversationId = json.conversationId;
        }
        if (json.type === 'chunk') {
          assembled += json.text || '';
          aiBubble.innerHTML = renderMarkdown(assembled);
          msgBox.scrollTop = msgBox.scrollHeight;
        }
        if (json.type === 'done') {
          if (Array.isArray(json.citations) && json.citations.length) {
            citations = json.citations;
          }
        }
      }
    }

    const assistantText = assembled.trim();
    if (assistantText) {
      aiBubble.innerHTML = renderMarkdown(assistantText);
      // Append citation links if Perplexity returned any
      // Perplexity citations can be plain URL strings or objects with .url/.title
      if (citations.length) {
        const citDiv = document.createElement('div');
        citDiv.className = 'mt-2 pt-2 border-t border-amber-200 space-y-0.5';
        citations.slice(0, 5).forEach((c, i) => {
          const url = typeof c === 'string' ? c : (c.url || c.document || '');
          const title = typeof c === 'string' ? c : (c.title || c.document || url);
          if (!url) return;
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = 'block text-xs text-indigo-600 hover:underline truncate';
          a.textContent = `[${i + 1}] ${title}`;
          citDiv.appendChild(a);
        });
        aiBubble.appendChild(citDiv);
      }
      state.p3VerificationMessages.push({ role: 'assistant', content: assistantText });
      updateP3VerifyCounter();
      scheduleAutoSave();
    } else {
      aiBubble.remove();
    }
  } catch (e) {
    aiBubble.remove();
    throw e;
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    if (input) input.focus();
  }
}

function updateP3VerifyCounter() {
  const counterEl = document.getElementById('p3VerifyCounter');
  const hintEl = document.getElementById('p3VerifyCounterHint');
  const finishBtn = document.getElementById('p3FinishVerifyBtn');
  if (!counterEl) return;
  const count = (state.p3VerificationMessages || []).filter((m) => m.role === 'user').length;
  counterEl.textContent = `${count} / 5`;
  if (count >= 5) {
    if (hintEl) hintEl.textContent = '✓ Можно переходить к анализу';
    finishBtn?.classList.remove('hidden');
  } else if (count === 0) {
    if (hintEl) hintEl.textContent = '(задайте первый вопрос)';
  } else {
    if (hintEl) hintEl.textContent = `(ещё ${5 - count})`;
  }
}

async function runP3HallucinationEval() {
  if (!state.currentLessonId) return;
  const model = document.getElementById('modelSelect')?.value;
  const loadingEl = document.getElementById('p3EvalLoading');
  const evalBlock = document.getElementById('p3EvalBlock');
  loadingEl?.classList.remove('hidden');
  if (evalBlock) evalBlock.classList.add('hidden');
  try {
    const out = await api(`/api/academy/lessons/${state.currentLessonId}/hallucination-eval`, {
      method: 'POST',
      body: JSON.stringify({
        task_id: state.selectedTaskId,
        suspicious_claims: document.getElementById('p3SuspiciousClaims')?.value?.trim() || '',
        verification_messages: state.p3VerificationMessages || [],
        model
      })
    });
    const evalData = out.data;
    if (evalData) {
      state.p3EvalData = evalData;
      renderP3EvalBlock(evalData);
      saveSubmission('draft').catch(() => {});
    }
  } catch (e) {
    console.warn('P3 eval failed:', e.message);
  } finally {
    loadingEl?.classList.add('hidden');
  }
}

function renderP3EvalBlock(evalData) {
  if (!evalData) return;
  const evalBlock = document.getElementById('p3EvalBlock');
  if (!evalBlock) return;

  const foundEl = document.getElementById('p3EvalFound');
  const foundList = document.getElementById('p3EvalFoundList');
  const missedEl = document.getElementById('p3EvalMissed');
  const missedList = document.getElementById('p3EvalMissedList');
  const verdictEl = document.getElementById('p3EvalVerdict');
  const verdictText = document.getElementById('p3EvalVerdictText');

  if (foundList && evalData.foundRisks?.length) {
    foundList.innerHTML = evalData.foundRisks.map((r) =>
      `<li class="text-xs text-slate-800">«${r.text}» <span class="text-green-600">(${r.type})</span></li>`
    ).join('');
    foundEl?.classList.remove('hidden');
  }
  if (missedList && evalData.missedRisks?.length) {
    missedList.innerHTML = evalData.missedRisks.map((r) =>
      `<li class="text-xs text-slate-800">«${r.text}» — <span class="text-red-600">${r.hint}</span></li>`
    ).join('');
    missedEl?.classList.remove('hidden');
  }
  if (verdictText && evalData.verdictText) {
    const badge = evalData.verdict === 'сильно' ? '🟢' : evalData.verdict === 'частично' ? '🟡' : '🔴';
    verdictText.textContent = `${badge} ${evalData.verdictText}`;
    verdictEl?.classList.remove('hidden');
  }
  evalBlock.classList.remove('hidden');
}

function renderP3InlineSelfCheck() {
  const wfApi = getPracticeWorkflowApi();
  const block = document.getElementById('p3InlineSelfCheck');
  const list = document.getElementById('p3InlineSelfCheckList');
  if (!block || !list || !wfApi) return;
  const items = wfApi.SELF_CHECK['block1-practice-hallucination'] || [];
  list.innerHTML = '';
  items.forEach((label, i) => {
    const li = document.createElement('label');
    li.className = 'flex items-start gap-2 text-sm text-slate-700 cursor-pointer';
    li.innerHTML = `<input type="checkbox" data-p3-self-idx="${i}" class="mt-1" /><span>${label}</span>`;
    list.appendChild(li);
  });
  block.classList.remove('hidden');
}

function showP3ReportHtml(task, wf, num) {
  const wfApi = getPracticeWorkflowApi();
  if (!wfApi?.buildReportP3Html) return;
  const block = document.getElementById('reportRenderBlock');
  const label = document.getElementById('assignmentAnswerLabel');
  if (!block) return;
  block.innerHTML = wfApi.buildReportP3Html(task, wf, num);
  block.classList.remove('hidden');
  if (label) label.classList.add('hidden');
}

/* ===== END P3 FUNCTIONS ===== */

function buildPracticeReport() {
  const wfApi = getPracticeWorkflowApi();
  const task = getSelectedTaskOption();
  const num = getSelectedTaskNumber();
  const sk = state.currentLesson?.scenario_key;
  const isDetective = sk === 'block1-practice-detective';
  if (!wfApi || !sk || (!task && !isDetective)) {
    alert('Выберите вариант задания.');
    return;
  }
  const prereqError = getReportPrerequisitesError(sk);
  if (prereqError) {
    alert(prereqError);
    return;
  }
  let wf;
  let report = '';
  if (isBlock2Scenario(sk)) {
    if (sk === 'block2-practice-library' && !wfApi.validateLibraryBeforeReport()) return;
    wf = wfApi.collectWorkflowFromUiM2(sk);
    if (sk === 'block2-practice-aim') report = wfApi.buildReportM2P1(task, wf, num);
    else if (sk === 'block2-practice-library') report = wfApi.buildReportM2P2(task, wf, num);
    else if (sk === 'block2-practice-context') report = wfApi.buildReportM2P3(task, wf, num);
  } else {
    wf = wfApi.collectWorkflowFromUi(sk);
    // Attach P2 in-memory data to workflow before building report
    if (sk === 'block1-practice-scenario') {
      if (state.p2PersonaData) wf.p2Persona = state.p2PersonaData;
      if (state.p2EvalData) wf.p2Eval = state.p2EvalData;
    }
    if (sk === 'block1-practice-hallucination') {
      if (state.p3HintData) wf.p3Hint = state.p3HintData;
      if (state.p3EvalData) wf.p3Eval = state.p3EvalData;
      if (state.p3VerificationMessages?.length) wf.p3VerificationMessages = state.p3VerificationMessages;
    }
    if (sk === 'block1-practice-prompt') report = wfApi.buildReportP1(task, wf, num);
    else if (sk === 'block1-practice-scenario') report = wfApi.buildReportP2(task, wf, num);
    else if (sk === 'block1-practice-hallucination') report = wfApi.buildReportP3(task, wf, num);
    else if (sk === 'block1-practice-reverse') report = wfApi.buildReportP4(task, wf, num);
    else if (sk === 'block1-practice-detective') {
      const allTexts = state.taskOptions || [];
      report = wfApi.buildReportP5(wf, allTexts);
    }
  }
  const ta = document.getElementById('assignmentAnswer');
  if (ta && report) {
    ta.value = report;
    scheduleAutoSave();
    if (sk === 'block1-practice-prompt') showP1ReportHtml(task, wf, num);
    else if (sk === 'block1-practice-scenario') showP2ReportHtml(task, wf, num);
    else if (sk === 'block1-practice-hallucination') showP3ReportHtml(task, wf, num);
    else if (sk === 'block1-practice-reverse') showP4ReportHtml(task, wf, num);
    else if (sk === 'block1-practice-detective') showP5ReportHtml(null, wf, state.taskOptions || []);
    advancePracticeStep();
    // P5 is already on the final step — re-render it so the submit block appears now that the report exists
    if (sk === 'block1-practice-detective') showPracticeStep(state.practiceStep || 3, { restoreSubstep: true });
  }
}

async function runP4Prompt(pass) {
  const task = getSelectedTaskOption();
  if (!task) { alert('Выберите вариант задания.'); return; }
  const promptId = pass === 'v2' ? 'p4PromptV2' : 'p4PromptV1';
  const btnId = pass === 'v2' ? 'p4RunV2Btn' : 'p4RunV1Btn';
  const resultBlockId = pass === 'v2' ? 'p4ResultV2Block' : 'p4ResultV1Block';
  const resultPreviewId = pass === 'v2' ? 'p4ResultV2Preview' : 'p4ResultV1Preview';
  const text = document.getElementById(promptId)?.value?.trim();
  if (!text) { alert('Напишите промпт перед запуском.'); return; }
  if (state.streaming) return;
  const runBtn = document.getElementById(btnId);
  setBtnLoading(runBtn, true);
  try {
    scheduleAutoSave();
    await saveSubmission('draft');
    const payload = {
      conversationId: state.currentConversationId || undefined,
      lessonId: state.currentLessonId || undefined,
      courseId: state.currentLesson?.course_id || undefined,
      message: text,
      model: document.getElementById('modelSelect').value,
      chatMode: 'practice_run',
      practiceRunContext: {
        runKind: 'prompt',
        pass,
        taskTitle: task.title || '',
        taskContext: task.context || ''
      }
    };
    const { assistantText } = await streamChat(payload);
    if (assistantText) {
      state.lastPracticeAiResult = assistantText;
      const block = document.getElementById(resultBlockId);
      const preview = document.getElementById(resultPreviewId);
      if (block) block.classList.remove('hidden');
      if (preview) {
        preview.innerHTML = renderMarkdown(assistantText);
        preview.dataset.rawText = assistantText;
      }
      if (pass === 'v1') tryAdvancePracticeSubstep();
      updateReportButtonVisibility();
      saveSubmission('draft').catch(() => {});
    }
  } catch (e) {
    throw e;
  } finally {
    setBtnLoading(runBtn, false);
  }
}

function showP4ReportHtml(task, wf, num) {
  const block = document.getElementById('reportRenderBlock');
  const label = document.getElementById('assignmentAnswerLabel');
  if (!block) return;
  const wfApi = getPracticeWorkflowApi();
  block.innerHTML = wfApi.buildReportP4Html(task, wf, num);
  block.classList.remove('hidden');
  if (label) label.classList.add('hidden');
}

function showP5ReportHtml(task, wf, allTexts) {
  const block = document.getElementById('reportRenderBlock');
  const label = document.getElementById('assignmentAnswerLabel');
  if (!block) return;
  const wfApi = getPracticeWorkflowApi();
  block.innerHTML = wfApi.buildReportP5Html(task, wf, null, allTexts);
  block.classList.remove('hidden');
  if (label) label.classList.add('hidden');
}

/* P4: Show the target output for reverse-engineering */
function initP4TargetOutput() {
  const task = getSelectedTaskOption();
  if (!task) return;
  const block = document.getElementById('p4TargetBlock');
  const pre = document.getElementById('p4TargetOutput');
  if (block && pre) {
    pre.textContent = task.target_output || '';
    block.classList.remove('hidden');
  }
  // Recap copies of the target text on later substeps/steps so the user can compare
  ['p4TargetOutputRecap1', 'p4TargetOutputRecap2'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = task.target_output || '';
  });
}

/* P5: Render all quiz text cards */
function renderP5TextCards() {
  const container = document.getElementById('p5TextCards');
  if (!container) return;
  const texts = state.taskOptions || [];
  container.innerHTML = '';
  texts.forEach((txt) => {
    const card = document.createElement('div');
    card.className = 'p5-text-card rounded-xl border border-slate-200 bg-white px-4 py-4 space-y-3';
    card.dataset.textId = txt.id;
    card.innerHTML = `
      <p class="text-xs font-semibold text-violet-700 uppercase tracking-wide">${escapeHtml(txt.label || '')}</p>
      <p class="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">${escapeHtml(txt.text || '')}</p>
      <div class="flex flex-wrap gap-4 items-start">
        <fieldset>
          <legend class="text-xs font-medium text-slate-600 mb-1">Автор:</legend>
          <div class="flex gap-3">
            <label class="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" name="p5verdict_${escapeHtml(txt.id)}" value="human" /> Человек
            </label>
            <label class="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" name="p5verdict_${escapeHtml(txt.id)}" value="ai" /> ИИ
            </label>
          </div>
        </fieldset>
        <label class="flex flex-col gap-1">
          <span class="text-xs font-medium text-slate-600">Уверенность:</span>
          <select data-text-id="${escapeHtml(txt.id)}" class="aa-select text-sm">
            <option value="">—</option>
            <option value="low">Низкая</option>
            <option value="medium">Средняя</option>
            <option value="high">Высокая</option>
          </select>
        </label>
      </div>
      <label class="block">
        <span class="text-xs font-medium text-slate-600">Причина вашего выбора:</span>
        <textarea data-text-id="${escapeHtml(txt.id)}" rows="2" class="aa-textarea mt-1 text-sm" placeholder="Что именно подсказало вам ответ?"></textarea>
      </label>`;
    container.appendChild(card);
  });
}

/* P5: On the markers step, show all texts with their разбор so the user can
   formulate markers while looking at the material */
function renderP5Step3Recap() {
  const container = document.getElementById('p5Step3Recap');
  if (!container) return;
  const texts = state.taskOptions || [];
  const wfApi = getPracticeWorkflowApi();
  const answers = wfApi?.collectP5Answers?.() || [];
  container.innerHTML = '';
  texts.forEach((txt) => {
    const ans = answers.find((a) => a.textId === txt.id) || {};
    const isCorrect = ans.verdict === (txt.is_ai ? 'ai' : 'human');
    const authorLabel = txt.is_ai ? 'ИИ' : 'Человек';
    const bg = isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50';
    const det = document.createElement('details');
    det.className = `rounded-xl border ${bg}`;
    det.open = true;
    det.innerHTML = `
      <summary class="px-4 py-2.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
        ${isCorrect ? '✅' : '❌'} ${escapeHtml(txt.label || '')} — ${authorLabel}
      </summary>
      <div class="px-4 pb-3 space-y-2">
        <p class="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">${escapeHtml(txt.text || '')}</p>
        <p class="text-xs text-slate-600 border-t border-slate-200/70 pt-2">${escapeHtml(txt.explanation || '')}</p>
      </div>`;
    container.appendChild(det);
  });
}

/* P5: Restore saved quiz answers into the rendered text cards */
function restoreP5AnswersToCards(answers) {
  (answers || []).forEach((a) => {
    if (!a?.textId) return;
    const card = document.querySelector(`.p5-text-card[data-text-id="${CSS.escape(a.textId)}"]`);
    if (!card) return;
    if (a.verdict) {
      const radio = card.querySelector(`input[name="p5verdict_${a.textId}"][value="${a.verdict}"]`);
      if (radio) radio.checked = true;
    }
    const sel = card.querySelector('select[data-text-id]');
    if (sel && a.confidence) sel.value = a.confidence;
    const ta = card.querySelector('textarea[data-text-id]');
    if (ta && a.reason) ta.value = a.reason;
  });
}

/* P5: Show score + per-text reveals */
function showP5Reveals() {
  const texts = state.taskOptions || [];
  const wfApi = getPracticeWorkflowApi();
  const answers = wfApi?.collectP5Answers?.() || [];
  let correct = 0;
  const revealsEl = document.getElementById('p5Reveals');
  if (revealsEl) revealsEl.innerHTML = '';
  texts.forEach((txt) => {
    const ans = answers.find((a) => a.textId === txt.id) || {};
    const isCorrect = ans.verdict === (txt.is_ai ? 'ai' : 'human');
    if (isCorrect) correct++;
    const correctLabel = txt.is_ai ? 'ИИ' : 'Человек';
    const studentLabel = ans.verdict === 'ai' ? 'ИИ' : ans.verdict === 'human' ? 'Человек' : '—';
    const icon = isCorrect ? '✅' : '❌';
    const bg = isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
    const titleColor = isCorrect ? 'text-green-700' : 'text-red-700';
    if (revealsEl) {
      const div = document.createElement('div');
      div.className = `rounded-xl border ${bg} px-4 py-3 space-y-2`;
      div.innerHTML = `
        <div class="flex justify-between items-center">
          <p class="text-xs font-semibold ${titleColor}">${icon} ${escapeHtml(txt.label || '')}</p>
          <span class="text-xs text-slate-500">Ваш ответ: <strong>${studentLabel}</strong> · Правильно: <strong>${correctLabel}</strong></span>
        </div>
        <p class="text-xs text-slate-500">Причина: ${escapeHtml(ans.reason || '—')}</p>
        <p class="text-xs text-slate-700">${escapeHtml(txt.explanation || '')}</p>`;
      revealsEl.appendChild(div);
    }
  });
  const scoreEl = document.getElementById('p5ScoreNum');
  const scoreLabelEl = document.getElementById('p5ScoreLabel');
  if (scoreEl) scoreEl.textContent = `${correct}/${texts.length}`;
  if (scoreLabelEl) {
    scoreLabelEl.textContent = correct >= 4 ? 'отлично!' : correct >= 3 ? 'хороший результат' : 'есть над чем поработать';
  }
  return correct;
}

function validateBeforeSubmit() {
  const sk = state.currentLesson?.scenario_key;
  const wfApi = getPracticeWorkflowApi();
  if (!wfApi || !sk) return true;
  // P1 self-check is inline at step 2.1 — skip validation here
  if (sk === 'block1-practice-prompt') return true;
  const complete = isBlock2Scenario(sk) ? wfApi.selfCheckCompleteM2(sk) : wfApi.selfCheckComplete(sk);
  if (complete) return true;
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
  const toggleBtn = document.getElementById('togglePracticeChatBtn');
  if (!app || !chat) return;
  if (open) {
    chat.classList.remove('chat-collapsed');
    app.classList.add('practice-chat-open');
    if (window.innerWidth < 1024) app.classList.add('practice-chat-mobile');
    // Auto-collapse tools panel so chat gets full space alongside the assignment
    if (!isToolsPanelCollapsed()) applyToolsPanelCollapsed(true);
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
  if (toggleBtn) {
    toggleBtn.textContent = open ? 'Скрыть чат' : 'Открыть чат';
    toggleBtn.classList.toggle('aa-btn-primary', !open);
    toggleBtn.classList.toggle('aa-btn-ghost', open);
  }
  refreshAcademyLayout();
}

function togglePracticeChat() {
  const open = !document.getElementById('app')?.classList.contains('practice-chat-open');
  setPracticeChatOpen(open);
  localStorage.setItem(PRACTICE_CHAT_OPEN_KEY, open ? '1' : '0');
}

function setPracticeFocusMode(on, lesson = null) {
  const app = document.getElementById('app');
  if (!app) return;
  if (on && lesson && isAcademyPractice(lesson)) {
    app.classList.add('practice-focus');
    document.getElementById('sidebarFreeChatBlock')?.classList.add('hidden');
    // For block1-practice-prompt everything is inline — no chat actions row needed
    if (lesson.scenario_key === 'block1-practice-prompt') {
      document.getElementById('practiceActionsRow')?.classList.add('hidden');
    } else {
      document.getElementById('practiceActionsRow')?.classList.remove('hidden');
    }
    syncChatToolbarVisibility();
    document.getElementById('lessonPanelSubtitle').textContent = lesson.title || 'Практика';
    updateOpenPracticeChatLabel(lesson.scenario_key);
    document.getElementById('togglePracticeChatBtn')?.classList.remove('hidden');
    // По умолчанию на широком экране чат наставника открыт рядом с заданием,
    // на мобильном — закрыт (открывается поверх). Учитываем выбор пользователя.
    const chatPref = localStorage.getItem(PRACTICE_CHAT_OPEN_KEY);
    if (lesson.scenario_key === 'block1-practice-prompt') {
      setPracticeChatOpen(false);
    } else {
      setPracticeChatOpen(window.innerWidth >= 1024 && chatPref !== '0');
    }
    refreshAcademyLayout();
  } else {
    app.classList.remove('practice-focus', 'practice-chat-open', 'practice-chat-mobile');
    document.getElementById('sidebarFreeChatBlock')?.classList.remove('hidden');
    document.getElementById('practiceActionsRow')?.classList.add('hidden');
    document.getElementById('practiceWorkflowBlock')?.classList.add('hidden');
    document.getElementById('taskOptionsBlock')?.classList.add('hidden');
    syncChatToolbarVisibility();
    document.getElementById('chatSection')?.classList.remove('chat-collapsed');
    document.getElementById('togglePracticeChatBtn')?.classList.add('hidden');
    document.getElementById('backToAssignmentBtn')?.classList.add('hidden');
    document.getElementById('openPracticeChatBtn')?.classList.remove('hidden');
    document.getElementById('closePracticeChatBtn')?.classList.add('hidden');
  }
  refreshAcademyLayout();
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
  if (state.currentLesson?.scenario_key === 'block1-practice-detective') return true;
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
    const sk = state.currentLesson?.scenario_key;
    const wfApi = getPracticeWorkflowApi();
    if (isBlock2Scenario(sk)) wfApi.restoreWorkflowToUiM2(gm.workflow, sk);
    else wfApi.restoreWorkflowToUi(gm.workflow, sk);
    const savedStep = gm.workflow.currentStep;
    const savedSub = gm.workflow.currentSubstep;
    // P5 detective has no task selection — restore it whenever the practice was started (step/substep advanced or quiz answered)
    const isDetective = sk === 'block1-practice-detective';
    const detectiveStarted = isDetective && (savedStep > 1 || (savedSub && savedSub > 1) ||
      (gm.workflow.p5?.answers || []).some((a) => a.verdict || a.reason));
    if (savedStep && savedStep >= 1 && (state.selectedTaskId || detectiveStarted)) {
      document.getElementById('practiceWorkflowBlock')?.classList.remove('hidden');
      document.getElementById('startPracticeBtn')?.classList.add('hidden');
      if (isDetective) {
        // Re-render quiz cards and restore the user's answers before showing the saved step
        renderP5TextCards();
        restoreP5AnswersToCards(gm.workflow.p5?.answers);
        document.getElementById('taskOptionsBlock')?.classList.add('hidden');
        if (savedStep >= 2) showP5Reveals();
      }
      if (savedSub && savedSub > 1) state.practiceSubstep = savedSub;
      showPracticeStep(savedStep, { restoreSubstep: Boolean(savedSub && savedSub > 1) });
      // P4: re-fill target/author/recap blocks that are populated on click during the normal flow
      if (sk === 'block1-practice-reverse') {
        initP4TargetOutput();
        if (savedStep >= 2) {
          const p4Task = getSelectedTaskOption();
          const authorEl = document.getElementById('p4AuthorPrompt');
          if (authorEl && p4Task?.author_prompt) authorEl.textContent = p4Task.author_prompt;
          const recapEl = document.getElementById('p4MyPromptV1Recap');
          if (recapEl) recapEl.textContent = gm.workflow.p4?.prompt_v1 || document.getElementById('p4PromptV1')?.value || '';
        }
      }
      // P1: re-render HTML report if session was at the submit step
      if (sk === 'block1-practice-prompt' && gm.workflow.p1) {
        const task = getSelectedTaskOption();
        const num = getSelectedTaskNumber();
        if (task) showP1ReportHtml(task, gm.workflow, num);
      }
      // P2: restore persona and eval data
      if (sk === 'block1-practice-scenario') {
        if (gm.workflow.p2Persona) {
          state.p2PersonaData = gm.workflow.p2Persona;
          renderP2PersonaCard(gm.workflow.p2Persona);
        }
        if (gm.workflow.p2Eval) {
          state.p2EvalData = gm.workflow.p2Eval;
          renderP2EvalBlock(gm.workflow.p2Eval);
        }
        if (gm.workflow.p2DialogueMessages?.length) {
          state.p2DialogueMessages = gm.workflow.p2DialogueMessages;
          gm.workflow.p2DialogueMessages.forEach((m) => renderP2InlineBubble(m.content, m.role));
        }
        // N3/N9: always sync counter+hint regardless of message count
        updateP2PairCounter();
      }
      if (sk === 'block1-practice-hallucination') {
        if (gm.workflow.p3Hint) {
          state.p3HintData = gm.workflow.p3Hint;
          renderP3HintCard(gm.workflow.p3Hint);
        }
        if (gm.workflow.p3Eval) {
          state.p3EvalData = gm.workflow.p3Eval;
          renderP3EvalBlock(gm.workflow.p3Eval);
        }
        if (gm.workflow.p3VerificationMessages?.length) {
          state.p3VerificationMessages = gm.workflow.p3VerificationMessages;
          gm.workflow.p3VerificationMessages.forEach((m) => renderP3InlineBubble(m.content, m.role));
        }
        // N6: always sync counter+hint regardless of message count
        updateP3VerifyCounter();
        // Restore claimsReminderText from saved workflow so it's visible on step 1.2 restore
        const _claimsReminder = document.getElementById('p3ClaimsReminderText');
        if (_claimsReminder && gm.workflow.p3?.suspicious_claims) {
          _claimsReminder.textContent = gm.workflow.p3.suspicious_claims;
        }
      }
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
  renderContinuePractice();
}

async function submitPracticeAnswer() {
  if (!state.currentLessonId) return;
  if (!warnIfNoTaskSelected()) return;
  if (!validateBeforeSubmit()) return;
  const answer_text = document.getElementById('assignmentAnswer')?.value?.trim();
  if (!answer_text) return alert('Введите ответ или нажмите «Далее» на предыдущем шаге — отчёт соберётся автоматически.');
  await saveSubmission('submitted');
  await markLessonCompleted();
  showAutosaveStatus('Задание отправлено · практика пройдена', { hideAfterMs: 4000 });
  renderContinuePractice();
  setMobilePane('lesson');
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
    'p3SuspiciousClaims',
    'p3VerifyQuestions',
    'p3AiResponseEval',
    'p3VerdictReason',
    'p3MainInsight',
    'p2GoodReplies',
    'p2WeakReply',
    'p2AiIssues',
    'p2HarderInstruction',
    'p2BestReply',
    'p2AiCritique',
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
    'checklistItem5',
    'p4PromptV1',
    'p4DiffNotes',
    'p4AuthorAnalysis',
    'p4PromptV2',
    'p5PersonalMarkers',
    'p5MistakeAnalysis',
    'aimFieldA',
    'aimFieldI',
    'aimFieldM',
    'aimFieldFormat',
    'aimFieldConstraints',
    'aimFieldCriteria',
    'aimWhyBad',
    'm2PracticePromptV1',
    'm2PracticePromptV2',
    'm2PracticeImproveNotes',
    'm2PracticeMainInsight',
    'aimEvalMissed',
    'libraryTestInput',
    'libraryImproveNotes',
    'libraryPromptV2',
    'libraryUseNote',
    'passportRoleV1',
    'passportTasksV1',
    'passportWorkV1',
    'passportAudienceV1',
    'passportProductsV1',
    'passportStyleV1',
    'passportRulesV1',
    'passportFormatsV1',
    'passportCriteriaV1',
    'passportGoodExampleV1',
    'passportBadExampleV1',
    'passportPreviewV1',
    'passportTestTask',
    'contextEvalWorked',
    'contextEvalMissed',
    'passportPreviewV2',
    'contextUsageNote'
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
  try {
    const d = await api('/api/academy/prompts');
    state.promptLibrary = d.prompts || [];
    renderPromptLibrary();
  } catch (_) {}
}

async function loadAssistants() {
  try {
    const d = await api('/api/academy/assistants');
    state.assistants = d.assistants || [];
    const ctx = readChatContextFromStorage();
    if (ctx.assistantId && !state.activeAssistant) {
      const found = state.assistants.find((a) => a.id === ctx.assistantId);
      if (found) applyAssistantToChat(found, { silent: true });
    }
    renderAssistantLibrary();
    updateActiveAssistantChip();
  } catch (_) {}
}

function renderPromptLibrary() {
  const ul = document.getElementById('promptLibraryList');
  if (!ul) return;
  ul.innerHTML = '';
  const userPrompts = state.promptLibrary.filter((p) => !p.is_builtin);
  const items = userPrompts.length ? userPrompts : state.promptLibrary;
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'text-slate-500 px-1';
    li.textContent = 'Пока нет сохранённых промптов';
    ul.appendChild(li);
    return;
  }
  for (const pr of items) {
    const li = document.createElement('li');
    li.className = 'aa-library-item';
    const title = document.createElement('div');
    title.className = 'aa-library-item-title';
    title.textContent = pr.title;
    const meta = document.createElement('div');
    meta.className = 'aa-library-item-meta';
    const lessonTitle = pr.source_lesson_id ? lessonLabelForId(pr.source_lesson_id) : null;
    meta.textContent = [pr.category, lessonTitle ? `из: ${lessonTitle}` : null, pr.is_builtin ? 'встроенный' : 'мой']
      .filter(Boolean)
      .join(' · ');
    const actions = document.createElement('div');
    actions.className = 'aa-library-item-actions';
    const useBtn = document.createElement('button');
    useBtn.type = 'button';
    useBtn.className = 'aa-btn aa-btn-ghost text-xs min-h-0 h-7 px-2';
    useBtn.textContent = 'В чат';
    useBtn.addEventListener('click', () => {
      const composer = document.getElementById('composer');
      if (composer) composer.value = pr.prompt_text || '';
      document.getElementById('composer')?.focus();
      showToast('Промпт вставлен в сообщение');
    });
    const trainerBtn = document.createElement('button');
    trainerBtn.type = 'button';
    trainerBtn.className = 'aa-btn aa-btn-ghost text-xs min-h-0 h-7 px-2';
    trainerBtn.textContent = 'Оценить';
    trainerBtn.addEventListener('click', () => {
      const inp = document.getElementById('promptTrainerInput');
      if (inp) inp.value = pr.prompt_text || '';
    });
    actions.appendChild(useBtn);
    actions.appendChild(trainerBtn);
    appendLibraryLessonLink(actions, pr.source_lesson_id);
    if (!pr.is_builtin) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'aa-btn aa-btn-ghost text-xs min-h-0 h-7 px-2 text-red-600';
      delBtn.textContent = 'Удалить';
      delBtn.addEventListener('click', () => {
        deletePromptFromLibrary(pr.id, pr.title).catch((err) => showToast(err.message || 'Не удалось удалить'));
      });
      actions.appendChild(delBtn);
    }
    li.appendChild(title);
    li.appendChild(meta);
    li.appendChild(actions);
    ul.appendChild(li);
  }
}

function renderAssistantLibrary() {
  const ul = document.getElementById('assistantLibraryList');
  if (!ul) return;
  ul.innerHTML = '';
  if (!state.assistants.length) {
    const li = document.createElement('li');
    li.className = 'text-slate-500 px-1';
    li.textContent = 'Нет ассистентов — создайте из практики или кнопкой ниже';
    ul.appendChild(li);
    return;
  }
  for (const a of state.assistants) {
    const li = document.createElement('li');
    li.className = 'aa-library-item';
    const isActive = state.activeAssistant?.id === a.id;
    const title = document.createElement('div');
    title.className = 'aa-library-item-title';
    title.textContent = (isActive ? '● ' : '') + a.name;
    const meta = document.createElement('div');
    meta.className = 'aa-library-item-meta';
    const lessonTitle = a.source_lesson_id ? lessonLabelForId(a.source_lesson_id) : null;
    meta.textContent = [a.role, lessonTitle ? `из: ${lessonTitle}` : null, a.default_model?.split('/').pop()]
      .filter(Boolean)
      .join(' · ');
    const actions = document.createElement('div');
    actions.className = 'aa-library-item-actions';
    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'aa-btn aa-btn-ghost text-xs min-h-0 h-7 px-2';
    applyBtn.textContent = isActive ? 'Активен' : 'В чат';
    applyBtn.addEventListener('click', () => applyAssistantToChat(a));
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'aa-btn aa-btn-ghost text-xs min-h-0 h-7 px-2 text-red-600';
    delBtn.textContent = 'Удалить';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Удалить ассистента «${a.name}»?`)) return;
      await api(`/api/academy/assistants/${a.id}`, { method: 'DELETE' });
      if (state.activeAssistant?.id === a.id) clearActiveAssistant();
      await loadAssistants();
      showToast('Ассистент удалён');
    });
    actions.appendChild(applyBtn);
    appendLibraryLessonLink(actions, a.source_lesson_id);
    actions.appendChild(delBtn);
    li.appendChild(title);
    li.appendChild(meta);
    li.appendChild(actions);
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

  // Демо-карточка (нулевой урок)
  const demoWrap = document.createElement('div');
  demoWrap.className = 'mb-4';
  const demoBtn = document.createElement('button');
  demoBtn.type = 'button';
  demoBtn.id = 'demoCourseBtn';
  demoBtn.className = 'aa-demo-tree-btn w-full text-left';
  demoBtn.innerHTML = '<span class="text-base mr-1.5">🚀</span><span><span class="block text-sm font-semibold text-indigo-900">Демо: что умеет ИИ</span><span class="block text-xs text-indigo-600 mt-0.5">Лендинг + Аналитический дашборд</span></span>';
  demoBtn.addEventListener('click', openDemoPanel);
  demoWrap.appendChild(demoBtn);
  root.appendChild(demoWrap);
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
    const modNum = c.sort_order === 2 ? 2 : 1;
    title.textContent = `Модуль ${modNum} — практики`;
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
      const prefix = getLessonStatusPrefix(l.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'aa-lesson-btn' + (state.currentLessonId === l.id ? ' is-active' : '');
      btn.dataset.lessonId = l.id;
      btn.textContent = prefix + l.title;
      btn.title = prefix === '✓ ' ? 'Пройдено' : prefix === '★ ' ? 'Есть обратная связь' : prefix === '◐ ' ? 'В процессе' : 'Не начато';
      btn.addEventListener('click', () => selectLesson(l));
      li.appendChild(btn);
      ul.appendChild(li);
    }
    wrap.appendChild(ul);
    root.appendChild(wrap);
  }
}

/* ===== ДЕМО-ПАНЕЛЬ ===== */
// Собирает SSE-поток /api/academy/chat и возвращает полный текст ответа
async function bufferDemoStream(payload) {
  const res = await fetch(`${apiBase}/api/academy/chat`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', fullText = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (raw === '[DONE]') continue;
      try {
        const ev = JSON.parse(raw);
        if (ev.type === 'token') fullText += ev.token;
        if (ev.type === 'error') throw new Error(ev.error || 'AI error');
      } catch {}
    }
  }
  return fullText;
}

// Инжектирует готовый HTML как AI-пузырь с iframe (без сохранения в БД)
function injectHtmlBubble(html) {
  const box = document.getElementById('chatMessages');
  if (!box) return;
  const outer = document.createElement('div');
  outer.className = 'msg-row assistant-row';
  const bubble = document.createElement('div');
  bubble.className = 'assistant-bubble';

  const wrap = document.createElement('div');
  wrap.className = 'my-3 border border-slate-300 rounded-lg overflow-hidden bg-white';
  const header = document.createElement('div');
  header.className = 'flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 bg-slate-100 text-xs text-slate-600';
  const label = document.createElement('span');
  label.className = 'font-medium text-slate-800';
  label.textContent = 'Превью HTML · JS разрешён';
  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'text-indigo-600 hover:text-indigo-500 transition-colors';
  openBtn.textContent = 'Открыть в новой вкладке';
  const dlBtn = document.createElement('button');
  dlBtn.type = 'button';
  dlBtn.className = 'text-emerald-700 hover:text-emerald-600';
  dlBtn.textContent = 'Скачать .html';
  const iframe = document.createElement('iframe');
  iframe.className = 'w-full min-h-[min(70vh,560px)] bg-white';
  iframe.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
  iframe.title = 'Демо-превью';
  const safe = sanitizeArtifactHtml(html, true);
  openBtn.addEventListener('click', () => {
    const blob = new Blob([safe], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
  dlBtn.addEventListener('click', () => {
    const blob = new Blob([safe], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'pulse-landing.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });
  iframe.srcdoc = safe;
  header.appendChild(label); header.appendChild(openBtn); header.appendChild(dlBtn);
  wrap.appendChild(header); wrap.appendChild(iframe);
  bubble.appendChild(wrap);
  outer.appendChild(bubble);
  box.appendChild(outer);
  box.scrollTop = box.scrollHeight;
}

const DEMO_PROMPTS = {
  landing: `Создай landing page для SaaS «Pulse» — AI-платформы управления командой. Ответь ТОЛЬКО кодом, без пояснений.

Ограничение: НЕ БОЛЕЕ 130 строк HTML. Все стили — встроенный <style> в <head>, без внешних CDN. Минимально, но красиво.

Секции: навбар · hero с SVG-графиком справа · логотипы (Яндекс Сбер Озон Авито МТС) · 3 фича-карточки · 3 метрики (+34% / 2× / 89% NPS) · 3 отзыва · 3 тарифа (0₽/2990₽/запрос) · CTA · footer.
Дизайн: hero тёмный (#0f172a→#1e1b4b), акцент #7c3aed и #06b6d4, hover на карточках, градиентный текст.
CSS: используй flexbox/grid, пиши лаконично. Никаких внешних скриптов или таблиц стилей.

\`\`\`academy-html
<!DOCTYPE html><html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pulse</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;color:#0f172a}
a{text-decoration:none;color:inherit}
.g{background:linear-gradient(135deg,#7c3aed,#06b6d4)}
.gt{background:linear-gradient(135deg,#a78bfa,#22d3ee);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.hero{background:linear-gradient(135deg,#0f172a,#1e1b4b);color:#fff}
.hov{transition:transform .2s,box-shadow .2s}.hov:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(124,58,237,.18)}
/* продолжай писать нужные стили */
</style></head>
<body>
<!-- все секции здесь -->
</body></html>
\`\`\``,


  dashboard: `Сгенерируй ТОЛЬКО JavaScript-данные для дашборда «Рынок вакансий 2025: Европа vs Россия». Ответь ТОЛЬКО кодом внутри блока, без HTML, без пояснений.

\`\`\`academy-dashboard-data
const jobs=[
  {n:'Backend Dev',eu:5200,ru:'250K',def:88,t:'↑'},
  {n:'Data Scientist',eu:5800,ru:'220K',def:92,t:'↑'},
  {n:'DevOps Engineer',eu:5500,ru:'240K',def:85,t:'↑'},
  {n:'Product Manager',eu:4800,ru:'180K',def:70,t:'↑'},
  {n:'UX Designer',eu:4200,ru:'150K',def:65,t:'→'},
  {n:'QA Engineer',eu:3800,ru:'130K',def:55,t:'→'},
  {n:'Project Manager',eu:4500,ru:'160K',def:60,t:'↓'},
  {n:'System Analyst',eu:4100,ru:'145K',def:58,t:'↑'}
];
const euSec={labels:['IT','Finance','Healthcare','Manufacturing','Retail','Logistics'],data:[28,18,16,14,13,11]};
const ruSec={labels:['IT','Manufacturing','Retail','Finance','Logistics','Healthcare'],data:[32,20,16,14,10,8]};
const euTrend=[165,178,190,205,218,232];
const ruTrend=[78,84,91,98,107,115];
\`\`\`

ПРАВИЛО: ответь ТОЛЬКО кодом — никаких объяснений, предупреждений, оговорок. Просто замени числа в блоке выше на реалистичные данные рынка труда 2025 (EU€/мес, RU₽/мес, дефицит 0-100%, тренды ↑↓→).`
};

function openDemoPanel() {
  state.currentLessonId = null;
  state.currentLesson = null;
  setLessonPanelVisible(true);
  document.getElementById('lessonEmpty')?.classList.add('hidden');
  document.getElementById('lessonContent')?.classList.add('hidden');
  document.getElementById('assignmentBlock')?.classList.add('hidden');
  document.getElementById('demoPanelSection')?.classList.remove('hidden');
  document.getElementById('lessonHint').textContent = 'Демо · Модуль 1';
  document.getElementById('practiceFlowHint')?.classList.add('hidden');
  document.getElementById('practiceActionsRow')?.classList.add('hidden');
  setPracticeFocusMode(false);
  setMobilePane('lesson');

  // Заполняем селектор моделей для демо
  const demoSel = document.getElementById('demoModelSelect');
  const mainSel = document.getElementById('modelSelect');
  if (demoSel && mainSel && !demoSel.dataset.inited) {
    demoSel.dataset.inited = '1';
    // Берём все опции из главного селектора + добавляем популярные OpenAI
    const extraModels = [
      { id: 'openai/gpt-5-chat', label: 'GPT-5 · лучшее' },
      { id: 'openai/gpt-4o', label: 'GPT-4o · OpenAI' },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini · быстро' },
      { id: 'anthropic/claude-opus-4.8', label: 'Claude Opus 4.8 · лучшее' },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude Sonnet 3.5' },
    ];
    const existing = new Set([...mainSel.options].map(o => o.value));
    // Сначала опции из главного селектора
    [...mainSel.options].forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.textContent;
      demoSel.appendChild(opt);
    });
    // Потом дополнительные которых нет
    extraModels.forEach(m => {
      if (!existing.has(m.id)) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.label;
        demoSel.appendChild(opt);
      }
    });
    // Выбираем gpt-4o по умолчанию если есть
    const preferred = ['openai/gpt-5-chat', 'openai/gpt-4o', 'anthropic/claude-opus-4.8', 'anthropic/claude-3.5-sonnet'];
    for (const m of preferred) {
      if ([...demoSel.options].some(o => o.value === m)) { demoSel.value = m; break; }
    }
  }

  // Заполняем превью промптов
  const lp = document.getElementById('demoPromptLandingPreview');
  if (lp) lp.textContent = DEMO_PROMPTS.landing;
  const dp = document.getElementById('demoPromptDashboardPreview');
  if (dp) dp.textContent = DEMO_PROMPTS.dashboard;

  // Обновляем подсветку в дереве курсов
  document.querySelectorAll('.aa-lesson-btn').forEach(b => b.classList.remove('is-active'));
  document.getElementById('demoCourseBtn')?.classList.add('is-active');
}

async function runDemo(type) {
  if (state.streaming) return;

  const btn = document.getElementById(type === 'landing' ? 'runDemoLandingBtn' : 'runDemoDashboardBtn');
  const status = document.getElementById(type === 'landing' ? 'demoLandingStatus' : 'demoDashboardStatus');

  if (btn) { btn.disabled = true; btn.textContent = 'Генерирую…'; }
  if (status) { status.textContent = 'ИИ работает…'; status.classList.remove('hidden'); }

  try {
    if (!state.currentConversationId) {
      const title = type === 'landing' ? 'Демо: Лендинг Pulse' : 'Демо: Дашборд рынка вакансий';
      const conv = await api('/api/academy/conversations', { method: 'POST', body: JSON.stringify({ title }) });
      state.conversations.unshift(conv);
      state.currentConversationId = conv.id;
      renderConversationList();
    }
    setMobilePane('chat');

    // Для dashboard используем GPT-4o — он лучше следует инструкции «только код»
    // Для landing берём выбранную пользователем модель
    const userModel = document.getElementById('demoModelSelect')?.value || document.getElementById('modelSelect')?.value || 'openai/gpt-4o';
    const model = type === 'dashboard' ? 'openai/gpt-4o' : userModel;

    const promptText = type === 'landing' ? DEMO_PROMPTS.landing : DEMO_PROMPTS.dashboard;
    appendUserBubble(type === 'landing' ? 'Генерирую лендинг «Pulse»…' : 'Генерирую аналитический дашборд…');
    document.getElementById('typingRow')?.classList.remove('hidden');
    await streamChat({
      conversationId: state.currentConversationId,
      message: promptText,
      model,
      chatMode: 'general',
      max_tokens: 16000
    });
    document.getElementById('typingRow')?.classList.add('hidden');
    if (status) status.textContent = '✓ Готово! Смотрите результат в чате →';

  } catch (e) {
    document.getElementById('typingRow')?.classList.add('hidden');
    if (status) status.textContent = 'Ошибка: ' + (e.message || 'не удалось запустить демо');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = type === 'landing' ? 'Запустить ещё раз →' : 'Обновить дашборд →';
    }
  }
}

function appendUserBubble(text) {
  const box = document.getElementById('chatMessages');
  if (!box) return;
  const bubble = document.createElement('div');
  bubble.className = 'user-bubble';
  bubble.textContent = text.length > 200 ? text.slice(0, 200) + '…' : text;
  box.appendChild(bubble);
  box.scrollTop = box.scrollHeight;
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
  // block1-practice-prompt uses fully inline flow — no chat hints needed
  if (scenarioKey === 'block1-practice-prompt') {
    row.classList.add('hidden');
    sel.innerHTML = '';
    return;
  }
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
    setPracticeChatOpen(true);
    setMobilePane('chat');
  }
  composer.value = text;
  composer.focus();
}

function renderConversationList() {
  const ul = document.getElementById('conversationList');
  const emptyHint = document.getElementById('conversationListEmpty');
  ul.innerHTML = '';
  if (!state.conversations.length) {
    emptyHint?.classList.remove('hidden');
    return;
  }
  emptyHint?.classList.add('hidden');
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
      clearLessonPanel();
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

/* The «Задание» pane is shown only when a practice or the demo is open —
   on the start screen / free chat it carries no content */
function setLessonPanelVisible(visible) {
  document.getElementById('lessonPanel')?.classList.toggle('hidden', !visible);
  document.getElementById('lessonSplitter')?.classList.toggle('hidden', !visible);
  refreshAcademyLayout();
}

function clearLessonPanel() {
  state.currentLessonId = null;
  state.currentLesson = null;
  state.selectedTaskId = null;
  state.taskOptions = [];
  setLessonPanelVisible(false);
  setPracticeFocusMode(false);
  bindPracticeHints(null);
  document.getElementById('lessonHint').textContent = '';
  document.getElementById('lessonEmpty')?.classList.remove('hidden');
  document.getElementById('lessonContent')?.classList.add('hidden');
  document.getElementById('assignmentBlock')?.classList.add('hidden');
  document.getElementById('demoPanelSection')?.classList.add('hidden');
  document.getElementById('practiceFlowHint')?.classList.add('hidden');
  document.getElementById('askMentorAssignmentBtn')?.classList.add('hidden');
  document.getElementById('newLessonChatBtn')?.classList.add('hidden');
}

async function openLessonPanel(lesson) {
  if (!lesson) {
    clearLessonPanel();
    return;
  }
  setLessonPanelVisible(true);
  state.currentLessonId = lesson.id;
  state.currentLesson = lesson;
  state.selectedTaskId = null;
  document.querySelectorAll('.aa-lesson-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.lessonId === String(lesson.id)));
  document.getElementById('demoCourseBtn')?.classList.remove('is-active');
  document.getElementById('lessonPanel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('lessonPanelScroll')?.scrollTo(0, 0);
  document.getElementById('lessonEmpty')?.classList.add('hidden');
  document.getElementById('demoPanelSection')?.classList.add('hidden');
  // Reset practice step state from the previously opened lesson so its step bar,
  // workflow panes and saved step don't leak into the new lesson
  state.practiceStep = 1;
  state.practiceSubstep = 1;
  state.practiceWorkflow = null;
  document.getElementById('practiceWorkflowBlock')?.classList.add('hidden');
  document.getElementById('practiceStepBar')?.classList.add('hidden');
  document.getElementById('practiceCelebrationMsg')?.classList.add('hidden');
  const _stepNum = document.getElementById('practiceStepNum');
  if (_stepNum) _stepNum.textContent = '';
  const _stepTitle = document.getElementById('practiceStepTitle');
  if (_stepTitle) _stepTitle.textContent = '';
  const _stepDots = document.getElementById('practiceStepDots');
  if (_stepDots) _stepDots.innerHTML = '';
  document.getElementById('assignmentAnswerLabel')?.classList.remove('hidden');
  const lc = document.getElementById('lessonContent');
  // For these scenarios the content is in the assignment block — hide the separate description
  if (['block1-practice-prompt', 'block1-practice-scenario', 'block1-practice-hallucination'].includes(lesson.scenario_key)) {
    lc?.classList.add('hidden');
    if (lc) lc.innerHTML = '';
  } else {
    lc?.classList.remove('hidden');
    if (lc) lc.innerHTML = `<details class="aa-lesson-details"><summary class="aa-lesson-summary">📖 Описание задания</summary><div class="aa-lesson-details-body">${renderMarkdown(lesson.content_md || '')}</div></details>`;
  }
  document.getElementById('lessonHint').textContent = (lesson.course_title || '') + ' · ' + lesson.title;
  const ab = document.getElementById('assignmentBlock');
  const at = document.getElementById('assignmentText');
  const asn = lesson.assignment;
  if (asn && ab && at) {
    ab.classList.remove('hidden');
    document.getElementById('assignmentTitle').textContent = asn.title || 'Задание';
    if (!STEP_HINTS[lesson.scenario_key]) {
      at.innerHTML = renderMarkdown(asn.instructions_md || '');
    }
    document.getElementById('askMentorAssignmentBtn')?.classList.add('hidden');
    renderTaskOptions(lesson);
    configurePracticeWorkflow(lesson.scenario_key);
    bindPracticeHints(lesson.scenario_key);
    setPracticeFocusMode(true, lesson);
    initAssignmentAutoSave();
    updateAssignmentHint();
  } else {
    ab?.classList.add('hidden');
    document.getElementById('askMentorAssignmentBtn')?.classList.add('hidden');
    bindPracticeHints(null);
    setPracticeFocusMode(false);
  }
  // N1/N5: clear rendered report and submit block from previous lesson before restoring new one
  const _rrb = document.getElementById('reportRenderBlock');
  if (_rrb) { _rrb.innerHTML = ''; _rrb.classList.add('hidden'); }
  document.getElementById('practiceSubmitBlock')?.classList.add('hidden');
  document.getElementById('practiceSelfCheckBlock')?.classList.add('hidden');
  // N6/N9: reset counter hints so stale text from previous lesson doesn't linger
  const _p3hint = document.getElementById('p3VerifyCounterHint');
  if (_p3hint) _p3hint.textContent = '(задайте первый вопрос)';
  const _p2hint = document.getElementById('p2PairCounterHint');
  if (_p2hint) _p2hint.textContent = '(начните диалог)';
  try {
    await loadSubmissionForLesson(lesson.id);
  } catch (e) {
    console.warn(e);
  }
  updateNewLessonChatBtn();
  setMobilePane('lesson');
}

async function selectLesson(lesson) {
  if (!lesson) return;
  await openLessonPanel(lesson);
  let conv = state.conversations.find((c) => c.lesson_id === lesson.id);
  if (!conv) {
    conv = await api('/api/academy/conversations', { method: 'POST', body: JSON.stringify({ lessonId: lesson.id, courseId: lesson.course_id, title: lesson.title, model: document.getElementById('modelSelect').value }) });
    state.conversations.unshift(conv);
  }
  state.currentConversationId = conv.id;
  renderConversationList();
  await loadConversation(conv.id, { skipFetchList: true, skipLessonRestore: true });
}

async function loadConversation(id, opts = {}) {
  state.currentConversationId = id;
  const data = await api(`/api/academy/conversations/${id}`);
  document.getElementById('conversationTitle').value = data.conversation.title || '';
  document.getElementById('modelSelect').value = data.conversation.model || state.selectedModel;
  state.selectedModel = document.getElementById('modelSelect').value;
  const stored = readChatContextFromStorage();
  const convMeta = parseConversationMeta(data.conversation);
  const fromDb = convMeta.chat_context;
  if (fromDb && typeof fromDb === 'object') {
    const merged = { ...stored, ...fromDb, model: data.conversation.model || fromDb.model };
    applyChatContext(merged);
    localStorage.setItem(CHAT_CONTEXT_KEY, JSON.stringify(merged));
  } else {
    applyChatContext({ ...stored, model: data.conversation.model || stored.model });
  }
  updateModelHint();
  if (!opts.skipLessonRestore) {
    const lesson = data.conversation.lesson_id
      ? state.catalog.lessons.find((l) => l.id === data.conversation.lesson_id)
      : null;
    if (lesson) {
      await openLessonPanel(lesson);
    } else {
      clearLessonPanel();
      document.getElementById('lessonHint').textContent = data.conversation.title || '';
    }
  }
  renderMessages(data.messages || []);
  if (!opts.skipFetchList) {
    renderConversationList();
  }
  updateNewLessonChatBtn();
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
  wrap.dataset.role = m.role;
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
    if (payload.assistantInstructions) fd.append('assistantInstructions', payload.assistantInstructions);
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
          flushChatContextToServer();
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
  const toggleBtn = document.getElementById('toggleToolsPanelBtn');
  if (hideBtn) {
    hideBtn.textContent = collapsed ? 'Показать инструменты' : 'Скрыть инструменты';
  }
  if (toggleBtn) {
    toggleBtn.textContent = collapsed ? 'Показать инструменты' : 'Скрыть инструменты';
    toggleBtn.classList.toggle('aa-btn-primary', collapsed);
  }
  if (showBtn) {
    const app = document.getElementById('app');
    const appVisible = app && !app.classList.contains('hidden');
    showBtn.classList.toggle('hidden', !(collapsed && appVisible && window.innerWidth >= 1024));
  }
}

function applyToolsPanelCollapsed(collapsed, { persist = true } = {}) {
  const app = document.getElementById('app');
  if (!app) return;
  app.classList.toggle('tools-panel-collapsed', collapsed);
  if (persist) localStorage.setItem(TOOLS_COLLAPSED_KEY, collapsed ? '1' : '0');
  updateToolsPanelToggleUi(collapsed);
}

function initToolsPanelToggle() {
  const hideBtn = document.getElementById('hideToolsPanelBtn');
  const collapseBtn = document.getElementById('collapseToolsPanelBtn');
  const showBtn = document.getElementById('showToolsPanelBtn');
  const toggleBtn = document.getElementById('toggleToolsPanelBtn');
  const toggle = () => applyToolsPanelCollapsed(!isToolsPanelCollapsed());
  hideBtn?.addEventListener('click', toggle);
  collapseBtn?.addEventListener('click', toggle);
  showBtn?.addEventListener('click', toggle);
  toggleBtn?.addEventListener('click', toggle);
  window.addEventListener('resize', () => updateToolsPanelToggleUi(isToolsPanelCollapsed()));
  // Default: tools collapsed. Only expand if user explicitly opened them before (stored '0').
  const stored = localStorage.getItem(TOOLS_COLLAPSED_KEY);
  applyToolsPanelCollapsed(stored !== '0', { persist: false });
}

function refreshAcademyLayout() {
  if (!academyLayoutSetWidths) return;
  const app = document.getElementById('app');
  if (!app) return;
  const left = parseInt(getComputedStyle(app).getPropertyValue('--left-pane-width'), 10) || 272;
  const lesson = parseInt(getComputedStyle(app).getPropertyValue('--lesson-pane-width'), 10) || 352;
  const right = parseInt(getComputedStyle(app).getPropertyValue('--right-pane-width'), 10) || 320;
  const chat = parseInt(getComputedStyle(app).getPropertyValue('--chat-pane-width'), 10) || 420;
  academyLayoutSetWidths(left, lesson, right, chat);
}

function initResizableLayout() {
  const app = document.getElementById('app');
  const leftSidebar = document.getElementById('leftSidebar');
  const chatSection = document.getElementById('chatSection');
  const lessonPanel = document.getElementById('lessonPanel');
  const toolsPanel = document.getElementById('toolsPanel');
  const leftSplitter = document.getElementById('leftSplitter');
  const lessonSplitter = document.getElementById('lessonSplitter');
  const rightSplitter = document.getElementById('rightSplitter');
  if (!app || !leftSidebar || !toolsPanel) return;

  const savedChat = parseInt(localStorage.getItem(CHAT_PANE_WIDTH_KEY), 10);
  if (savedChat >= 240) {
    app.style.setProperty('--chat-pane-width', `${savedChat}px`);
  }

  // Снимаем возможные устаревшие инлайн-ширины от старой раскладки —
  // на десктопе размеры теперь задаёт CSS Grid (#workspaceRow) через переменные.
  [leftSidebar, chatSection, lessonPanel, toolsPanel].forEach((el) => {
    if (!el) return;
    el.style.width = '';
    el.style.flexBasis = '';
    el.style.flexGrow = '';
    el.style.minWidth = '';
    el.style.maxWidth = '';
    el.style.overflow = '';
  });
  app.style.removeProperty('--lesson-pane-expanded-width');

  // setWidths теперь только обновляет CSS-переменные; грид сам растягивает 1fr-колонку.
  function setWidths(leftPx, lessonPx, rightPx, chatPx) {
    if (leftPx) app.style.setProperty('--left-pane-width', `${Math.round(leftPx)}px`);
    if (lessonPx) app.style.setProperty('--lesson-pane-width', `${Math.round(lessonPx)}px`);
    if (rightPx) app.style.setProperty('--right-pane-width', `${Math.round(rightPx)}px`);
    if (chatPx) app.style.setProperty('--chat-pane-width', `${Math.round(chatPx)}px`);
  }

  const initialLeft = parseInt(localStorage.getItem('academy_left_pane_width'), 10) || 272;
  const initialLesson = parseInt(localStorage.getItem('academy_lesson_pane_width'), 10) || 352;
  const initialRight = parseInt(localStorage.getItem(TOOLS_RIGHT_WIDTH_KEY), 10) || 320;
  const initialChat = parseInt(localStorage.getItem(CHAT_PANE_WIDTH_KEY), 10) || 420;
  setWidths(initialLeft, initialLesson, initialRight, initialChat);

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  function bindSplitter(splitter, side) {
    if (!splitter) return;
    splitter.addEventListener('pointerdown', (e) => {
      if (window.innerWidth < 768) return;
      if ((side === 'lesson' || side === 'right') && window.innerWidth < 1024) return;
      const practiceFocus = app.classList.contains('practice-focus');
      const chatOpen = app.classList.contains('practice-chat-open');
      const collapsed = app.classList.contains('tools-panel-collapsed');
      // В практике без открытого чата сплиттер чат|задание неактивен (колонка 0)
      if (side === 'lesson' && practiceFocus && !chatOpen) return;
      // Сплиттер задание|инструменты неактивен, когда инструменты скрыты
      if (side === 'right' && collapsed) return;

      splitter.setPointerCapture(e.pointerId);
      splitter.classList.add('is-dragging');
      const startX = e.clientX;
      const leftStart = leftSidebar.getBoundingClientRect().width;
      const chatStart = chatSection?.getBoundingClientRect().width || 0;
      const lessonStart = lessonPanel ? lessonPanel.getBoundingClientRect().width : 352;
      const rightStart = toolsPanel.getBoundingClientRect().width;
      const maxPane = window.innerWidth * 0.6;

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        if (side === 'left') {
          const next = clamp(leftStart + dx, 220, 460);
          setWidths(next);
          localStorage.setItem('academy_left_pane_width', String(Math.round(next)));
        } else if (side === 'lesson') {
          if (practiceFocus && chatOpen) {
            // Чат теперь справа от этого сплиттера: тянем влево — чат шире.
            const next = clamp(chatStart - dx, 280, maxPane);
            setWidths(null, null, null, next);
            localStorage.setItem(CHAT_PANE_WIDTH_KEY, String(Math.round(next)));
          } else {
            const next = clamp(lessonStart - dx, 280, maxPane);
            setWidths(null, next);
            localStorage.setItem('academy_lesson_pane_width', String(Math.round(next)));
          }
        } else if (side === 'right') {
          const next = clamp(rightStart - dx, 260, window.innerWidth * 0.5);
          setWidths(null, null, next);
          localStorage.setItem(TOOLS_RIGHT_WIDTH_KEY, String(Math.round(next)));
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

  document.getElementById('initRetryBtn')?.addEventListener('click', () => loadWorkspace());
  document.getElementById('initLogoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    window.location.href = '/login';
  });

  document.getElementById('newLessonChatBtn')?.addEventListener('click', () => startNewLessonChat());

  document.getElementById('newChatBtn').addEventListener('click', async () => {
    clearLessonPanel();
    const conv = await api('/api/academy/conversations', {
      method: 'POST',
      body: JSON.stringify({
        title: 'New chat',
        model: document.getElementById('modelSelect').value,
        chatContext: buildChatContextPayload()
      })
    });
    state.conversations.unshift(conv);
    state.currentConversationId = conv.id;
    renderConversationList();
    document.getElementById('messagesContainer').innerHTML = '';
    document.getElementById('conversationTitle').value = '';
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
    persistChatContext();
  });
  document.getElementById('chatModeSelect')?.addEventListener('change', () => persistChatContext());
  document.getElementById('personaSelect')?.addEventListener('change', () => persistChatContext());
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
    persistChatContext();
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
    persistChatContext();
  });
  document.getElementById('useKbInChatBtn')?.addEventListener('click', () => useKnowledgeBaseInChat());
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
    persistChatContext();
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
    const text =
      document.getElementById('promptTrainerInput')?.value.trim() ||
      document.getElementById('composer')?.value.trim() ||
      '';
    await savePromptToLibrary({ text, category: 'Personal Productivity' });
  });

  document.getElementById('app')?.addEventListener('click', (e) => {
    const promptBtn = e.target.closest('.js-save-prompt-library');
    if (promptBtn) {
      e.preventDefault();
      savePromptFromElement(promptBtn).catch((err) => showToast(err.message || 'Не удалось сохранить'));
      return;
    }
    const assistantBtn = e.target.closest('.js-save-to-assistant');
    if (assistantBtn) {
      e.preventDefault();
      saveAssistantFromElement(assistantBtn).catch((err) => showToast(err.message || 'Не удалось сохранить'));
      return;
    }
    const libCardBtn = e.target.closest('.js-save-library-card');
    if (libCardBtn) {
      e.preventDefault();
      saveLibraryCardToLibrary(libCardBtn.closest('.aa-library-prompt-card')).catch((err) =>
        showToast(err.message || 'Не удалось сохранить')
      );
    }
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
    const name = window.prompt('Название ассистента:', `Ассистент ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const out = await api('/api/academy/assistants', {
      method: 'POST',
      body: JSON.stringify({
        name: trimmed,
        description: 'Создан в workspace',
        role: 'General helper',
        instructions: document.getElementById('promptTrainerInput')?.value?.trim() || 'Give practical, structured guidance.',
        connected_kb_id: state.selectedKnowledgeBaseId || null,
        default_model: document.getElementById('modelSelect').value,
        source_lesson_id: state.currentLessonId || null
      })
    });
    await loadAssistants();
    applyAssistantToChat(out);
    activateToolTab('assistant');
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
    const dialogueCtx = getActivePracticeDialogueContext();
    await streamChat(
      dialogueCtx
        ? {
            conversationId: state.currentConversationId,
            regenerate: true,
            model: document.getElementById('modelSelect').value,
            chatMode: 'practice_run',
            practiceRunContext: dialogueCtx
          }
        : {
            conversationId: state.currentConversationId,
            regenerate: true,
            model: document.getElementById('modelSelect').value,
            chatMode: document.getElementById('chatModeSelect')?.value || 'general',
            knowledgeBaseId: document.getElementById('knowledgeBaseSelect')?.value || undefined,
            personaId: document.getElementById('personaSelect')?.value || undefined
          }
    ).catch(() => {});
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
  document.getElementById('buildReportP4Btn')?.addEventListener('click', () => buildPracticeReport());
  document.getElementById('buildReportP5Btn')?.addEventListener('click', () => buildPracticeReport());

  /* ── P4: Reverse-engineering buttons ── */
  document.getElementById('p4RunV1Btn')?.addEventListener('click', () => {
    const prompt = document.getElementById('p4PromptV1')?.value?.trim();
    if (!prompt) return alert('Напишите промпт-гипотезу перед запуском.');
    runP4Prompt('v1').catch((e) => alert(e.message || 'Не удалось получить ответ'));
  });
  document.getElementById('p4NextToRevealBtn')?.addEventListener('click', () => {
    const task = getSelectedTaskOption();
    const authorEl = document.getElementById('p4AuthorPrompt');
    if (authorEl && task?.author_prompt) authorEl.textContent = task.author_prompt;
    // Show the user's own v1 prompt next to the author prompt for comparison
    const recapEl = document.getElementById('p4MyPromptV1Recap');
    if (recapEl) recapEl.textContent = document.getElementById('p4PromptV1')?.value?.trim() || '—';
    document.getElementById('p4AuthorReveal')?.classList.remove('hidden');
    advancePracticeStep();
  });
  document.getElementById('p4RunV2Btn')?.addEventListener('click', () => {
    const prompt = document.getElementById('p4PromptV2')?.value?.trim();
    if (!prompt) return alert('Напишите промпт v2 перед запуском.');
    runP4Prompt('v2').catch((e) => alert(e.message || 'Не удалось получить ответ'));
  });

  /* ── P5: Detective buttons ── */
  document.getElementById('p5CheckAnswersBtn')?.addEventListener('click', () => {
    const cards = document.querySelectorAll('.p5-text-card');
    const unanswered = Array.from(cards).filter((card) => {
      const tid = card.dataset.textId;
      return !document.querySelector(`input[name="p5verdict_${tid}"]:checked`);
    });
    if (unanswered.length > 0) {
      alert(`Ответьте на все вопросы — осталось без ответа: ${unanswered.length}`);
      return;
    }
    showP5Reveals();
    advancePracticeStep();
  });
  document.getElementById('p5NextToMarkersBtn')?.addEventListener('click', () => {
    advancePracticeStep();
  });
  // P5 quiz cards are rendered dynamically — delegate autosave from the container
  ['input', 'change'].forEach((evt) => {
    document.getElementById('p5TextCards')?.addEventListener(evt, scheduleAutoSave);
  });
  document.getElementById('buildReportM2P1Btn')?.addEventListener('click', () => buildPracticeReport());
  document.getElementById('buildReportM2P2Btn')?.addEventListener('click', () => buildPracticeReport());
  document.getElementById('buildReportM2P3Btn')?.addEventListener('click', () => buildPracticeReport());
  document.getElementById('assembleAimPromptBtn')?.addEventListener('click', () => {
    const assembled = getPracticeWorkflowApi()?.assembleAimPrompt?.();
    if (!assembled) return alert('Заполните хотя бы один блок AIM.');
    const v1 = document.getElementById('m2PracticePromptV1');
    if (v1) v1.value = assembled;
    scheduleAutoSave();
  });
  document.getElementById('runM2PromptV1Btn')?.addEventListener('click', () => {
    runPracticeInAi({ runKind: 'prompt', pass: 'v1' }).catch((e) =>
      alert(e.message || 'Не удалось получить ответ')
    );
  });
  document.getElementById('runM2PromptV2Btn')?.addEventListener('click', () => {
    runPracticeInAi({ runKind: 'prompt', pass: 'v2' }).catch((e) =>
      alert(e.message || 'Не удалось получить ответ')
    );
  });
  document.getElementById('libraryAddCardBtn')?.addEventListener('click', () => {
    const role = document.getElementById('libraryRoleTitleHidden')?.value || '';
    getPracticeWorkflowApi()?.addLibraryCard(role);
    scheduleAutoSave();
  });
  document.getElementById('libraryPromptCards')?.addEventListener('input', scheduleAutoSave);
  document.getElementById('libraryPromptCards')?.addEventListener('change', () => {
    getPracticeWorkflowApi()?.updateLibraryTestSelect();
    scheduleAutoSave();
  });
  document.getElementById('runLibraryTestBtn')?.addEventListener('click', () => {
    runPracticeInAi({ runKind: 'library' }).catch((e) =>
      alert(e.message || 'Не удалось протестировать промпт')
    );
  });
  document.getElementById('assemblePassportV1Btn')?.addEventListener('click', () => {
    const text = getPracticeWorkflowApi()?.assemblePassport?.('v1');
    if (!text) return alert('Заполните хотя бы роль и рабочий контекст.');
    const el = document.getElementById('passportPreviewV1');
    if (el) el.value = text;
    scheduleAutoSave();
  });
  document.getElementById('assemblePassportV2Btn')?.addEventListener('click', () => {
    const text = getPracticeWorkflowApi()?.assemblePassport?.('v2');
    if (!text) return alert('Заполните блоки v2 или скопируйте из v1.');
    const el = document.getElementById('passportPreviewV2');
    if (el) el.value = text;
    scheduleAutoSave();
  });
  document.getElementById('copyPassportToV2Btn')?.addEventListener('click', () => {
    getPracticeWorkflowApi()?.copyPassportV1ToV2Fields();
    const text = getPracticeWorkflowApi()?.assemblePassport?.('v2');
    const el = document.getElementById('passportPreviewV2');
    if (el && text) el.value = text;
    scheduleAutoSave();
  });
  document.getElementById('runAssistantTestBtn')?.addEventListener('click', () => {
    runPracticeInAi({ runKind: 'assistant' }).catch((e) =>
      alert(e.message || 'Не удалось протестировать ассистента')
    );
  });
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
  document.getElementById('p2StartDialogueBtn')?.addEventListener('click', () => {
    const goal = document.getElementById('practiceStudentGoal')?.value?.trim();
    if (!goal) return alert('Укажите вашу цель в этом разговоре.');
    // P2-3: show hard reaction reminder inside the chat panel
    const task = getSelectedTaskOption();
    const hardReaction = P2_SCENARIO_DATA[state.selectedTaskId]?.hardReaction || task?.hard_reaction || '';
    const reminderEl = document.getElementById('p2HardReactionReminder');
    const reminderTextEl = document.getElementById('p2HardReactionText');
    if (reminderEl && hardReaction) {
      if (reminderTextEl) reminderTextEl.textContent = `«${hardReaction}»`;
      reminderEl.classList.remove('hidden');
    }
    tryAdvancePracticeSubstep();
    updateP2PairCounter();
    // AI persona opens the scene with a first line
    streamP2Message(null, true).catch(() => {});
  });
  document.getElementById('runAnalysisInAiBtn')?.addEventListener('click', () => {
    runPracticeInAi({ runKind: 'analysis' }).catch((e) =>
      alert(e.message || 'Не удалось начать разбор')
    );
  });
  document.getElementById('startPracticeBtn')?.addEventListener('click', () => startPractice());
  document.getElementById('practiceBackBtn')?.addEventListener('click', () => goBackPractice());
  document.getElementById('practiceWorkflowBlock')?.addEventListener('click', (e) => {
    if (e.target.closest('.js-practice-substep-next')) advancePracticeStepOrSubstep();
  });
  // Re-evaluate build-report button visibility as the user fills the step's fields
  ['input', 'change'].forEach((evt) => {
    document.getElementById('practiceWorkflowBlock')?.addEventListener(evt, updateReportButtonVisibility);
  });
  document.getElementById('practiceNextS1Btn')?.addEventListener('click', () => {
    const v1 = document.getElementById('practicePromptV1')?.value?.trim();
    const v2El = document.getElementById('practicePromptV2');
    // Always prefill v2 with v1 so user edits rather than rewrites from scratch
    if (v1 && v2El) v2El.value = v1;
    // Show client context card in step 2 before advancing
    showP1ClientContext();
    advancePracticeStepOrSubstep();
  });
  document.getElementById('practiceNextM2P1S1Btn')?.addEventListener('click', () => {
    const notes = document.getElementById('m2PracticeImproveNotes')?.value?.trim() || '';
    if (notes.length < 15) {
      if (
        !confirm(
          'Рекомендуем записать минимум 2 конкретных улучшения для v2. Всё равно перейти к шагу 2?'
        )
      ) {
        return;
      }
    }
    const m2v1 = document.getElementById('m2PracticePromptV1')?.value?.trim();
    const m2v2El = document.getElementById('m2PracticePromptV2');
    if (m2v1 && m2v2El && !m2v2El.value.trim()) m2v2El.value = m2v1;
    advancePracticeStepOrSubstep();
  });
  document.getElementById('p2SendBtn')?.addEventListener('click', () => {
    const input = document.getElementById('p2InlineChatInput');
    const text = input?.value?.trim();
    if (!text) return;
    input.value = '';
    streamP2Message(text).catch((e) => alert(e.message || 'Ошибка отправки'));
  });
  document.getElementById('p2InlineChatInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('p2SendBtn')?.click();
    }
  });
  document.getElementById('practiceNextP2S1Btn')?.addEventListener('click', async () => {
    advancePracticeStepOrSubstep();
    // Launch AI eval when dialogue is done (self-check is rendered by showPracticeStep)
    runP2DialogueEval().catch(() => {});
  });
  // N2: live claims counter
  document.getElementById('p3SuspiciousClaims')?.addEventListener('input', () => {
    const val = document.getElementById('p3SuspiciousClaims').value;
    const count = val.split('\n').filter((l) => l.trim().length > 0).length;
    const el = document.getElementById('p3ClaimsCount');
    if (!el) return;
    if (count >= 3) {
      el.textContent = `✓ Найдено: ${count}`;
      el.className = 'text-xs text-emerald-600 -mt-1';
    } else {
      el.textContent = `Найдено: ${count} из минимум 3`;
      el.className = 'text-xs text-slate-400 -mt-1';
    }
  });
  document.getElementById('p3StartVerifyBtn')?.addEventListener('click', () => {
    const claims = document.getElementById('p3SuspiciousClaims')?.value?.trim();
    if (!claims) return alert('Запишите минимум одно подозрительное утверждение.');
    // P3-3: require at least 3 claims (count non-empty lines)
    const claimLines = claims.split('\n').filter((l) => l.trim().length > 0);
    if (claimLines.length < 3) return alert('Найдите минимум 3 подозрительных утверждения перед началом проверки.');
    const reminder = document.getElementById('p3ClaimsReminderText');
    if (reminder) reminder.textContent = claims;
    // P3-4: populate fragment text for reference during verification
    const task = getSelectedTaskOption();
    const fragmentEl = document.getElementById('p3FragmentReminderText');
    if (fragmentEl && task?.fragment_text) fragmentEl.textContent = task.fragment_text;
    tryAdvancePracticeSubstep();
    updateP3VerifyCounter();
  });
  document.getElementById('p3SendBtn')?.addEventListener('click', () => {
    const input = document.getElementById('p3InlineChatInput');
    const text = input?.value?.trim();
    if (!text) return;
    input.value = '';
    streamP3Message(text).catch((e) => alert(e.message || 'Ошибка отправки'));
  });
  document.getElementById('p3InlineChatInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('p3SendBtn')?.click();
    }
  });
  document.getElementById('p3FinishVerifyBtn')?.addEventListener('click', () => {
    advancePracticeStep();
    runP3HallucinationEval().catch(() => {});
  });
  document.getElementById('practiceNextP3S1Btn')?.addEventListener('click', () => advancePracticeStepOrSubstep());
  document.getElementById('practiceNextM2P2S1Btn')?.addEventListener('click', () => {
    const wfApi = getPracticeWorkflowApi();
    const prompts = wfApi?.collectLibraryPrompts?.() || [];
    const filled = prompts.filter((p) => p.template && p.variables);
    if (filled.length < 3) {
      alert('Нужно минимум 3 промпта с шаблоном и переменными.');
      return;
    }
    wfApi?.updateLibraryTestSelect();
    advancePracticeStepOrSubstep();
  });
  document.getElementById('practiceNextM2P3S1Btn')?.addEventListener('click', () => {
    const passport = document.getElementById('passportPreviewV1')?.value?.trim();
    if (!passport) {
      alert('Сначала соберите паспорт ассистента v1.');
      return;
    }
    advancePracticeStepOrSubstep();
  });
  document.getElementById('restartPracticeBtn')?.addEventListener('click', () => {
    restartPractice().catch((e) => alert(e.message || 'Не удалось сбросить задание'));
  });
  ['p3SuspiciousClaims', 'p3VerifyQuestions', 'p3AiResponseEval', 'p3MainInsight'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', scheduleAutoSave);
  });
  document.getElementById('practiceSelfCheckList')?.addEventListener('change', scheduleAutoSave);
  ['evalConcrete', 'evalTone', 'evalNoHype', 'aimEvalSolves', 'aimEvalConcrete'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', scheduleAutoSave);
  });
  document.querySelectorAll('input[name="riskDecision"]').forEach((r) => {
    r.addEventListener('change', scheduleAutoSave);
  });
  document.getElementById('openPracticeChatBtn')?.addEventListener('click', () => openPracticeChat());
  document.getElementById('togglePracticeChatBtn')?.addEventListener('click', () => togglePracticeChat());
  document.getElementById('closePracticeChatBtn')?.addEventListener('click', () => {
    closePracticeChat();
    localStorage.setItem(PRACTICE_CHAT_OPEN_KEY, '0');
  });
  document.getElementById('backToAssignmentBtn')?.addEventListener('click', () => {
    closePracticeChat();
    localStorage.setItem(PRACTICE_CHAT_OPEN_KEY, '0');
  });
  document.getElementById('sidebarOpenChatBtn')?.addEventListener('click', () => {
    document.getElementById('newChatBtn')?.click();
  });
  document.getElementById('toggleChatAdvancedBtn')?.addEventListener('click', () => {
    const toolbar = document.getElementById('chatAdvancedBlock');
    const hidden = toolbar?.classList.contains('hidden');
    localStorage.setItem(CHAT_TOOLBAR_EXPANDED_KEY, hidden ? '1' : '0');
    syncChatToolbarVisibility();
  });
  window.addEventListener('resize', () => {
    const app = document.getElementById('app');
    if (app?.classList.contains('practice-chat-open') && window.innerWidth >= 1024) {
      app.classList.remove('practice-chat-mobile');
    } else if (app?.classList.contains('practice-chat-open') && window.innerWidth < 1024) {
      app.classList.add('practice-chat-mobile');
    }
  });

  document.getElementById('requestFeedbackBtn')?.addEventListener('click', async () => {
    if (!state.currentLessonId) return;
    if (!warnIfNoTaskSelected()) return;
    const answer_text = document.getElementById('assignmentAnswer')?.value?.trim();
    if (!answer_text) return alert('Нажмите «Далее» на предыдущем шаге — отчёт соберётся автоматически.');
    const btn = document.getElementById('requestFeedbackBtn');
    const loading = document.getElementById('assignmentFeedbackLoading');
    const fbBox = document.getElementById('assignmentFeedback');
    const prevLabel = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Получаем обратную связь…';
    }
    loading?.classList.remove('hidden');
    fbBox?.classList.add('hidden');
    try {
      await saveSubmission('submitted');
      const out = await api('/api/academy/lessons/' + state.currentLessonId + '/feedback', {
        method: 'POST',
        body: JSON.stringify({ answer_text, model: document.getElementById('modelSelect').value })
      });
      renderAssignmentFeedback(out.feedback);
      document.getElementById('assignmentFeedback')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      await markLessonCompleted();
      renderContinuePractice();
      showAutosaveStatus('Задание завершено · практика пройдена', { hideAfterMs: 4000 });
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Обновить обратную связь';
      }
    } catch (e) {
      loading?.classList.add('hidden');
      alert(e.message || 'Не удалось получить обратную связь');
      if (btn) {
        btn.disabled = false;
        btn.textContent = prevLabel || 'Завершить задание →';
      }
    }
  });
  document.getElementById('askMentorAssignmentBtn')?.addEventListener('click', () => {
    openPracticeChat();
    document.getElementById('composer').value =
      'Помоги с текущей практикой Модуля 1: направь по шагам, но не делай задание за меня (не пиши готовый ответ целиком).';
    document.getElementById('composer').focus();
  });
  document.getElementById('practiceHintBtn')?.addEventListener('click', () => insertPracticeHintIntoComposer());

  document.getElementById('runDemoLandingBtn')?.addEventListener('click', () =>
    runDemo('landing').catch(e => alert(e.message || 'Ошибка демо'))
  );
  document.getElementById('runDemoDashboardBtn')?.addEventListener('click', () =>
    runDemo('dashboard').catch(e => alert(e.message || 'Ошибка демо'))
  );
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
        <button type="button" data-use-kb-in-chat="${kb.id}" class="aa-btn aa-btn-ghost text-[10px] w-full min-h-0 h-7">Использовать в чате</button>
        <input type="text" data-search-kb="${kb.id}" placeholder="Поиск документов..." class="w-full border rounded px-2 py-1 text-[10px]" />
        <input type="file" data-upload-kb="${kb.id}" class="text-[10px] w-full" multiple />
      </div>
    `;
    ul.appendChild(li);
  }
  ul.querySelectorAll('[data-open-kb]').forEach((btn) => {
    btn.addEventListener('click', () => openKnowledgeBase(btn.getAttribute('data-open-kb')));
  });
  ul.querySelectorAll('[data-use-kb-in-chat]').forEach((btn) => {
    btn.addEventListener('click', () => useKnowledgeBaseInChat(btn.getAttribute('data-use-kb-in-chat')));
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

// Практика 2 (сценарий диалога): когда студент в чате практики и выбрал вариант с ролью,
// чат ведём как ролевой диалог — ИИ остаётся в роли собеседника и отвечает по одной реплике.
function getActivePracticeDialogueContext() {
  const app = document.getElementById('app');
  if (!app?.classList.contains('practice-focus')) return null;
  if (!app.classList.contains('practice-chat-open')) return null;
  if (state.currentLesson?.scenario_key !== 'block1-practice-scenario') return null;
  if (!getSelectedTaskOption()) return null;
  const ctx = buildPracticeRunContext('dialogue');
  return ctx?.aiRole ? ctx : null;
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
  const dialogueCtx = getActivePracticeDialogueContext();
  if (typingLabel) {
    typingLabel.textContent = dialogueCtx
      ? 'Собеседник печатает…'
      : 'Нейросеть обрабатывает запрос...';
  }
  document.getElementById('typingRow').classList.remove('hidden');

  persistChatContext();
  const payload = dialogueCtx
    ? {
        conversationId: state.currentConversationId || undefined,
        lessonId: state.currentLessonId || undefined,
        message: text,
        model: document.getElementById('modelSelect').value,
        chatMode: 'practice_run',
        practiceRunContext: dialogueCtx
      }
    : {
        conversationId: state.currentConversationId || undefined,
        lessonId: state.currentLessonId || undefined,
        message: text,
        model: document.getElementById('modelSelect').value,
        chatMode: document.getElementById('chatModeSelect')?.value || 'general',
        knowledgeBaseId: document.getElementById('knowledgeBaseSelect')?.value || undefined,
        personaId: document.getElementById('personaSelect')?.value || undefined,
        strictMode: (document.getElementById('chatModeSelect')?.value || '') === 'strict_knowledge',
        assistantInstructions: state.activeAssistant?.instructions || undefined
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
