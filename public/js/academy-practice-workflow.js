/**
 * Модуль 1 — структурированный workflow практик (v1/v2, диалог, риски).
 * Подключается до academy-app.js; API: window.AcademyPracticeWorkflow
 */
(function (global) {
  /* Convert markdown to readable plain text for reports */
  function stripMd(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.+?)\*\*/g, '$1')          // **bold** → bold
      .replace(/\*(.+?)\*/g, '$1')               // *italic* → italic
      .replace(/^#{1,6}\s+(.+)$/gm, '$1')        // ### Header → Header
      .replace(/^[\-\*]\s+/gm, '• ')             // - item → • item
      .replace(/^\d+\.\s+/gm, (m) => m)          // 1. keep numbered lists
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')        // [link](url) → link
      .trim();
  }
  const RISK_TYPES = [
    { value: 'fabricated', label: 'Выдуманный факт' },
    { value: 'number', label: 'Неверная / непроверяемая цифра' },
    { value: 'citation', label: 'Сомнительная ссылка' },
    { value: 'overconfidence', label: 'Излишняя уверенность' },
    { value: 'generic', label: 'Общая рекомендация без оснований' },
    { value: 'pressure', label: 'Манипулятивное давление' },
    { value: 'legal_fin', label: 'Юридический / финансовый риск' },
    { value: 'no_caveats', label: 'Нет оговорок и условий' }
  ];

  const RISK_LEVELS = [
    { value: 'low', label: 'Низкий' },
    { value: 'medium', label: 'Средний' },
    { value: 'high', label: 'Высокий' }
  ];

  const SELF_CHECK = {
    'block1-practice-prompt': [
      'Промпт v1 содержит роль, задачу и контекст',
      'Я указал формат и ограничения',
      'Я получил результат v1 и оценил его',
      'В промпте v2 — минимум 2 конкретных изменения',
      'Я сравнил v1 и v2 и сформулировал вывод'
    ],
    'block1-practice-scenario': [
      'Провёл минимум 5 пар реплик',
      'Собеседник возражал — я не сдался',
      'Использовал признание позиции («Понимаю, что…»)',
      'Задал уточняющий вопрос',
      'Предложил конкретный следующий шаг'
    ],
    'block1-practice-hallucination': [
      'Нашёл минимум 3 подозрительных утверждения',
      'Задал минимум 5 проверочных вопросов',
      'Проверил хотя бы одну цифру или статистику',
      'Проверил хотя бы одну ссылку на авторитет или совет',
      'Принял обоснованное решение по фрагменту'
    ]
  };

  const DECISION_LABELS = {
    usable: 'Можно использовать',
    after_check: 'Можно использовать после проверки',
    not_usable: 'Нельзя использовать в текущем виде'
  };

  function el(id) {
    return document.getElementById(id);
  }

  function val(id) {
    return el(id)?.value?.trim() || '';
  }

  function yn(v) {
    return v ? 'да' : 'нет';
  }

  function riskTypeLabel(v) {
    return RISK_TYPES.find((t) => t.value === v)?.label || v;
  }

  function riskLevelLabel(v) {
    return RISK_LEVELS.find((l) => l.value === v)?.label || v;
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function renderCaseBrief(task, scenarioKey) {
    const box = el('caseBriefBlock');
    if (!box || !task) {
      box?.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    let html = `<h4 class="font-semibold text-slate-900 mb-2">${escapeHtml(task.title)}</h4>`;
    if (scenarioKey === 'block1-practice-prompt') {
      html += `<p class="text-sm text-slate-700 mb-2">${escapeHtml(task.description || '')}</p>`;
      html += `<p class="text-xs font-medium text-slate-600 mt-2">Сырой ввод</p><div class="aa-case-raw">${escapeHtml(task.raw_input || '')}</div>`;
      html += `<p class="text-xs font-medium text-red-800 mt-2">Пример плохого промпта</p><div class="aa-case-bad-prompt">${escapeHtml(task.bad_prompt || '')}</div>`;
      if (task.expected_result) {
        html += `<p class="text-xs text-slate-500 mt-2"><strong>Ожидаемый результат:</strong> ${escapeHtml(task.expected_result)}</p>`;
      }
    } else if (scenarioKey === 'block1-practice-scenario') {
      html += `<p class="text-sm text-slate-700 mb-2">${escapeHtml(task.description || '')}</p>`;
      html += `<ul class="text-sm text-slate-700 list-disc pl-5 space-y-1">`;
      html += `<li><strong>Роль ИИ:</strong> ${escapeHtml(task.ai_role || '')}</li>`;
      html += `<li><strong>Моя роль:</strong> ${escapeHtml(task.student_role || '')}</li>`;
      html += `<li><strong>Цель (из кейса):</strong> ${escapeHtml(task.student_goal || '')}</li>`;
      html += `</ul>`;
      if (task.dialogue_requirements?.length) {
        html += `<p class="text-xs font-medium mt-2">В диалоге нужно:</p><ul class="text-xs list-disc pl-5">`;
        for (const r of task.dialogue_requirements) html += `<li>${escapeHtml(r)}</li>`;
        html += `</ul>`;
      }
      if (task.hard_reaction) {
        html += `<p class="text-xs mt-2 text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1"><strong>Сложная реакция (ожидайте в чате):</strong> «${escapeHtml(task.hard_reaction)}»</p>`;
      }
      if (task.context) {
        html += `<p class="text-xs mt-2 text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1"><strong>Задание выполнено, когда:</strong> ${escapeHtml(task.context)}</p>`;
      }
    } else {
      html += `<p class="text-xs text-slate-600 mb-2">${escapeHtml(task.trains || '')}</p>`;
      html += `<div class="aa-task-detail text-sm">${escapeHtml(task.fragment_text || task.context || '')}</div>`;
    }
    box.innerHTML = html;
  }

  function initRiskTable() {
    const body = el('riskTableBody');
    if (!body || body.dataset.inited) return;
    body.dataset.inited = '1';
    body.innerHTML = '';
    for (let i = 0; i < 4; i++) addRiskRow(body, i);
  }

  function addRiskRow(body, index) {
    const tr = document.createElement('tr');
    tr.className = 'aa-risk-row';
    tr.dataset.index = String(index);
    const typeOpts = RISK_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('');
    const levelOpts = RISK_LEVELS.map((l) => `<option value="${l.value}">${l.label}</option>`).join('');
    tr.innerHTML = `
      <td class="p-1"><textarea class="aa-input text-xs w-full min-h-[3rem]" data-field="quote" rows="2" placeholder="Цитата"></textarea></td>
      <td class="p-1"><select class="aa-select text-xs w-full" data-field="type"><option value="">Тип</option>${typeOpts}</select></td>
      <td class="p-1"><select class="aa-select text-xs w-full" data-field="level"><option value="">Уровень</option>${levelOpts}</select></td>
      <td class="p-1"><textarea class="aa-input text-xs w-full" data-field="why" rows="2" placeholder="Почему риск"></textarea></td>
      <td class="p-1"><textarea class="aa-input text-xs w-full" data-field="verify" rows="2" placeholder="Что проверить"></textarea></td>`;
    body.appendChild(tr);
  }

  function collectRisks() {
    const rows = el('riskTableBody')?.querySelectorAll('.aa-risk-row') || [];
    const risks = [];
    rows.forEach((tr) => {
      const get = (f) => tr.querySelector(`[data-field="${f}"]`)?.value?.trim() || '';
      risks.push({
        quote: get('quote'),
        type: get('type'),
        level: get('level'),
        why: get('why'),
        verify: get('verify')
      });
    });
    return risks;
  }

  function restoreRisks(risks) {
    const body = el('riskTableBody');
    if (!body) return;
    initRiskTable();
    const rows = body.querySelectorAll('.aa-risk-row');
    (risks || []).forEach((r, i) => {
      const tr = rows[i];
      if (!tr) return;
      const set = (f, v) => {
        const node = tr.querySelector(`[data-field="${f}"]`);
        if (node && v != null) node.value = v;
      };
      set('quote', r.quote);
      set('type', r.type);
      set('level', r.level);
      set('why', r.why);
      set('verify', r.verify);
    });
  }

  function collectWorkflowFromUi(scenarioKey) {
    const wf = {
      p1: {
        prompt_v1: val('practicePromptV1'),
        ai_v1: el('aiResultV1Preview')?.dataset?.rawText || el('aiResultV1Preview')?.textContent?.trim() || '',
        prompt_v2: val('practicePromptV2'),
        ai_v2: el('aiResultV2Preview')?.dataset?.rawText || el('aiResultV2Preview')?.textContent?.trim() || '',
        ai_eval: '',
        main_insight: ''
      },
      p2: {
        student_goal: val('practiceStudentGoal'),
        best_reply: val('p2BestReply'),
        apply_work: val('p2ApplyWork'),
        ai_critique: val('p2AiCritique')
      },
      p3: {
        suspicious_claims: val('p3SuspiciousClaims'),
        decision: document.querySelector('input[name="riskDecision"]:checked')?.value || '',
        verdict_reason: val('p3VerdictReason'),
        main_insight: val('p3MainInsight')
      },
      self_check: collectSelfCheck(scenarioKey)
    };
    return wf;
  }

  function restoreWorkflowToUi(wf, scenarioKey) {
    if (!wf) return;
    const p1 = wf.p1 || {};
    const set = (id, v) => {
      const node = el(id);
      if (node && v != null) node.value = v;
    };
    const setMd = (id, v) => {
      const node = el(id);
      if (!node || v == null) return;
      node.dataset.rawText = v;
      node.innerHTML = typeof renderMarkdown === 'function'
        ? renderMarkdown(v)
        : v.replace(/</g, '&lt;');
    };
    set('practicePromptV1', p1.prompt_v1);
    setMd('aiResultV1Preview', p1.ai_v1);
    if (p1.ai_v1) el('aiResultBlockV1')?.classList.remove('hidden');
    set('practicePromptV2', p1.prompt_v2);
    setMd('aiResultV2Preview', p1.ai_v2);
    if (p1.ai_v2) el('aiResultBlockV2')?.classList.remove('hidden');
    // ai_eval and main_insight removed from flow — no restore needed

    const p2 = wf.p2 || {};
    set('practiceStudentGoal', p2.student_goal);
    set('p2BestReply', p2.best_reply);
    set('p2ApplyWork', p2.apply_work);
    set('p2AiCritique', p2.ai_critique);

    const p3 = wf.p3 || {};
    set('p3SuspiciousClaims', p3.suspicious_claims);
    set('p3VerdictReason', p3.verdict_reason);
    set('p3MainInsight', p3.main_insight);
    if (p3.decision) {
      const radio = document.querySelector(`input[name="riskDecision"][value="${p3.decision}"]`);
      if (radio) radio.checked = true;
    }

    renderSelfCheck(scenarioKey, wf.self_check);
  }

  function renderSelfCheck(scenarioKey, saved) {
    const block = el('practiceSelfCheckBlock');
    const list = el('practiceSelfCheckList');
    if (!block || !list) return;
    const items = SELF_CHECK[scenarioKey] || [];
    if (!items.length) {
      block.classList.add('hidden');
      return;
    }
    block.classList.remove('hidden');
    list.innerHTML = '';
    items.forEach((label, i) => {
      const id = `selfCheck_${scenarioKey}_${i}`;
      const li = document.createElement('label');
      li.className = 'flex items-start gap-2 text-sm text-slate-700 cursor-pointer';
      const checked = saved?.[i] ? ' checked' : '';
      li.innerHTML = `<input type="checkbox" id="${id}" data-self-idx="${i}" class="mt-1"${checked} /><span>${escapeHtml(label)}</span>`;
      list.appendChild(li);
    });
  }

  function collectSelfCheck(scenarioKey) {
    const items = SELF_CHECK[scenarioKey] || [];
    return items.map((_, i) => !!el(`selfCheck_${scenarioKey}_${i}`)?.checked);
  }

  function selfCheckComplete(scenarioKey) {
    const items = SELF_CHECK[scenarioKey] || [];
    if (!items.length) return true;
    return collectSelfCheck(scenarioKey).every(Boolean);
  }

  function buildReportP1(task, wf, taskNum) {
    const p1 = wf.p1 || {};
    const bad = task?.bad_prompt || '';
    const div = '─'.repeat(48);
    return `ПРАКТИКА 1 · ПРОМПТ-ИНЖИНИРИНГ
${div}
Кейс ${taskNum || '?'}: ${task?.title || ''}
${div}

ЧТО БЫЛО НЕ ТАК С ПЛОХИМ ПРОМПТОМ
${bad || '—'}
(Слишком общий запрос — нет роли, контекста, формата, стиля и критериев.)

${div}
ПРОМПТ v1 (RTCFSC)
${div}
${p1.prompt_v1 || '—'}

ОТВЕТ ИИ v1
${p1.ai_v1 || '—'}

${div}
ПРОМПТ v2
${div}
${p1.prompt_v2 || '—'}

ОТВЕТ ИИ v2
${p1.ai_v2 || '—'}
`;
  }

  function buildReportP2(task, wf, taskNum) {
    const p2 = wf.p2 || {};
    const eval_ = wf.p2Eval || {};
    return `ПРАКТИКА 2 · ДИАЛОГ С ТРУДНЫМ СОБЕСЕДНИКОМ
${'─'.repeat(48)}
Сценарий ${taskNum || '?'}: ${task?.title || ''}

Роли:
ИИ = ${val('practiceRoleAi') || task?.ai_role?.slice(0, 80) || '…'}
Я = ${val('practiceRoleMe') || task?.student_role || '…'}

Моя цель в диалоге:
${p2.student_goal || task?.student_goal || '—'}

${'─'.repeat(48)}
ЛУЧШИЙ МОМЕНТ ДИАЛОГА
${'─'.repeat(48)}
${p2.best_reply || eval_?.bestReply?.text || '—'}

${'─'.repeat(48)}
ПРИМЕНЕНИЕ В РЕАЛЬНОЙ РАБОТЕ
${'─'.repeat(48)}
${p2.apply_work || '—'}
${p2.ai_critique ? `\n${'─'.repeat(48)}\nГДЕ ИИ ВЁЛ СЕБЯ НЕРЕАЛИСТИЧНО\n${'─'.repeat(48)}\n${p2.ai_critique}` : ''}
${eval_?.personaFeedback ? `\nАнализ ИИ-тренера:\n${eval_.personaFeedback}` : ''}
`;
  }

  function buildReportP2Html(task, wf, taskNum) {
    const p2 = wf.p2 || {};
    const eval_ = wf.p2Eval || {};
    const persona = wf.p2Persona;

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
      return `<p class="text-sm text-slate-700 leading-relaxed">${esc(text || '—').replace(/\n/g, '<br>')}</p>`;
    }

    const header = `<div class="rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-5 py-4">
      <p class="text-xs font-semibold uppercase tracking-widest opacity-80 mb-0.5">Практика 2 · Диалог с трудным собеседником</p>
      <p class="font-bold text-base">Сценарий ${taskNum || '?'}: ${esc(task?.title)}</p>
    </div>`;

    const rolesCard = collapsible('border-slate-200', 'bg-white', 'text-slate-400', 'Роли',
      `<div class="grid grid-cols-2 gap-2 text-sm">
        <div><span class="text-xs text-slate-400 block">ИИ</span><span class="font-medium text-slate-800">${esc(val('practiceRoleAi') || task?.ai_role || '—')}</span></div>
        <div><span class="text-xs text-slate-400 block">Я</span><span class="font-medium text-slate-800">${esc(val('practiceRoleMe') || task?.student_role || '—')}</span></div>
      </div>
      <p class="text-xs text-slate-500 mt-1"><strong>Цель:</strong> ${esc(p2.student_goal || task?.student_goal || '—')}</p>`,
      (val('practiceRoleMe') || task?.student_role));

    const personaCard = persona ? collapsible('border-indigo-200', 'bg-indigo-50', 'text-indigo-600', 'Персонаж',
      `<div class="flex items-start gap-2">
        <span class="text-2xl">${esc(persona.avatar)}</span>
        <div>
          <p class="font-semibold text-slate-900 text-sm">${esc(persona.name)}</p>
          <p class="text-xs text-slate-500">${esc(persona.role)}</p>
          <p class="text-xs text-indigo-700 italic mt-1">${esc(persona.goal)}</p>
        </div>
      </div>`, persona.name) : '';

    const bestCard = eval_?.bestReply ? collapsible('border-green-200', 'bg-green-50', 'text-green-600', 'Лучшая реплика',
      `<p class="text-sm text-slate-800 italic">«${esc(eval_.bestReply.text)}»</p>
       <p class="text-xs text-slate-600">${esc(eval_.bestReply.why)}</p>`,
      eval_.bestReply.text) : '';

    const weakCard = eval_?.weakReply ? collapsible('border-amber-200', 'bg-amber-50', 'text-amber-600', 'Слабая реплика',
      `<p class="text-sm text-slate-800 italic">«${esc(eval_.weakReply.text)}»</p>
       <p class="text-xs text-slate-600">${esc(eval_.weakReply.how_to_improve)}</p>`,
      eval_.weakReply.text) : '';

    const bestReplyCard = collapsible('border-blue-200', 'bg-blue-50', 'text-blue-600', 'Лучший момент диалога',
      preBox(p2.best_reply), p2.best_reply);

    const applyCard = collapsible('border-emerald-200', 'bg-emerald-50', 'text-emerald-600', 'Применение в реальной работе',
      preBox(p2.apply_work), p2.apply_work);

    const critiqueCard = p2.ai_critique ? collapsible('border-slate-200', 'bg-slate-50', 'text-slate-500', 'Где ИИ вёл себя нереалистично / как усложнить',
      preBox(p2.ai_critique), p2.ai_critique) : '';

    const evalFbCard = eval_?.personaFeedback ? collapsible('border-slate-200', 'bg-slate-50', 'text-slate-500', 'Оценка ИИ-тренера',
      `<p class="text-sm text-slate-700">${esc(eval_.personaFeedback)}</p>`,
      eval_.personaFeedback) : '';

    return [header, rolesCard, personaCard, bestCard, weakCard, bestReplyCard, applyCard, critiqueCard, evalFbCard]
      .filter(Boolean).join('\n');
  }

  function buildReportP3(task, wf, taskNum) {
    const p3 = wf.p3 || {};
    const dec = DECISION_LABELS[p3.decision] || p3.decision || '—';
    const eval3 = wf.p3Eval || {};
    const foundRisks = (eval3.foundRisks || []).map((r) => `  • «${r.text}» (${r.type})`).join('\n') || '  —';
    const missedRisks = (eval3.missedRisks || []).map((r) => `  • «${r.text}» — ${r.hint}`).join('\n') || '  —';
    return `Выбранный фрагмент (${taskNum || '?'}): ${task?.title || ''}

Что я заподозрил:
${p3.suspicious_claims || '—'}

Оценка тренера — найдено:
${foundRisks}

Оценка тренера — пропущено:
${missedRisks}

Вердикт тренера: ${eval3.verdictText || '—'}

Моё решение: ${dec}
Обоснование: ${p3.verdict_reason || '—'}

Главный вывод:
${p3.main_insight || '—'}
`;
  }

  function buildReportP3Html(task, wf, taskNum) {
    const p3 = wf.p3 || {};
    const dec = DECISION_LABELS[p3.decision] || p3.decision || '—';
    const eval3 = wf.p3Eval || {};
    const hint = wf.p3Hint || {};

    const decColor = p3.decision === 'usable' ? 'green' : p3.decision === 'after_check' ? 'amber' : 'red';

    const fragmentSnippet = (task?.fragment_text || task?.context || '').slice(0, 300);

    const hintCard = hint.categories?.length ? `
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:12px 14px;margin-bottom:10px">
        <p style="font-size:11px;font-weight:700;color:#92400e;margin:0 0 6px">Подсказка тренера</p>
        <p style="font-size:12px;color:#78350f;margin:0">${escapeHtml(hint.tip || '')}</p>
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">
          ${(hint.categories || []).map((c) => `<span style="background:#fde68a;color:#92400e;font-size:11px;border-radius:20px;padding:2px 8px">${escapeHtml(c)}</span>`).join('')}
        </div>
      </div>` : '';

    const foundCard = eval3.foundRisks?.length ? `
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px 14px;margin-bottom:10px">
        <p style="font-size:11px;font-weight:700;color:#166534;margin:0 0 6px">✅ Что нашли правильно</p>
        <ul style="margin:0;padding-left:16px;font-size:12px;color:#15803d">
          ${eval3.foundRisks.map((r) => `<li>«${escapeHtml(r.text)}» <span style="color:#6b7280">(${escapeHtml(r.type)})</span></li>`).join('')}
        </ul>
      </div>` : '';

    const missedCard = eval3.missedRisks?.length ? `
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:12px 14px;margin-bottom:10px">
        <p style="font-size:11px;font-weight:700;color:#991b1b;margin:0 0 6px">⚠️ Что пропустили</p>
        <ul style="margin:0;padding-left:16px;font-size:12px;color:#b91c1c">
          ${eval3.missedRisks.map((r) => `<li>«${escapeHtml(r.text)}» — ${escapeHtml(r.hint)}</li>`).join('')}
        </ul>
      </div>` : '';

    const verdictCard = eval3.verdictText ? `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:10px">
        <p style="font-size:11px;font-weight:700;color:#475569;margin:0 0 4px">Итог тренера</p>
        <p style="font-size:12px;color:#334155;margin:0">${escapeHtml(eval3.verdictText)}</p>
      </div>` : '';

    const decBg = decColor === 'green' ? '#f0fdf4' : decColor === 'amber' ? '#fffbeb' : '#fef2f2';
    const decBorder = decColor === 'green' ? '#86efac' : decColor === 'amber' ? '#fcd34d' : '#fca5a5';
    const decText = decColor === 'green' ? '#166534' : decColor === 'amber' ? '#92400e' : '#991b1b';

    function p3Section(bg, border, titleColor, title, bodyHtml, collapsed = true) {
      const openAttr = collapsed ? '' : 'open';
      return `<details ${openAttr} style="background:${bg};border:1px solid ${border};border-radius:10px;padding:10px 14px;margin-bottom:10px">
        <summary style="cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;user-select:none">
          <span style="font-size:10px;color:#94a3b8">▸</span>
          <p style="font-size:11px;font-weight:700;color:${titleColor};margin:0">${title}</p>
        </summary>
        <div style="margin-top:8px">${bodyHtml}</div>
      </details>`;
    }

    return `<div style="font-family:system-ui,sans-serif;max-width:680px;margin:0 auto;padding:4px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <p style="margin:0;font-size:13px;font-weight:700;color:#1e293b">Отчёт: задание 3 — вариант ${taskNum || '?'}</p>
        <span style="font-size:11px;color:#64748b">${escapeHtml(task?.title || '')}</span>
      </div>

      ${fragmentSnippet ? p3Section('#f8fafc','#e2e8f0','#475569','Фрагмент',
        `<p style="font-size:12px;color:#334155;margin:0;white-space:pre-wrap">${escapeHtml(fragmentSnippet)}${(task?.fragment_text || '').length > 300 ? '…' : ''}</p>`) : ''}

      ${hintCard ? p3Section('#fffbeb','#fcd34d','#92400e','Подсказка тренера',
        hint.categories?.length ? `<p style="font-size:12px;color:#78350f;margin:0 0 6px">${escapeHtml(hint.tip || '')}</p><div style="display:flex;flex-wrap:wrap;gap:4px">${(hint.categories || []).map((c) => `<span style="background:#fde68a;color:#92400e;font-size:11px;border-radius:20px;padding:2px 8px">${escapeHtml(c)}</span>`).join('')}</div>` : '') : ''}

      ${p3Section('#f8fafc','#e2e8f0','#475569','Что я заподозрил',
        `<p style="font-size:12px;color:#334155;margin:0;white-space:pre-wrap">${escapeHtml(p3.suspicious_claims || '—')}</p>`, false)}

      ${foundCard ? p3Section('#f0fdf4','#86efac','#166534','✅ Что нашли правильно',
        `<ul style="margin:0;padding-left:16px;font-size:12px;color:#15803d">${eval3.foundRisks.map((r) => `<li>«${escapeHtml(r.text)}» <span style="color:#6b7280">(${escapeHtml(r.type)})</span></li>`).join('')}</ul>`) : ''}

      ${missedCard ? p3Section('#fef2f2','#fca5a5','#991b1b','⚠️ Что пропустили',
        `<ul style="margin:0;padding-left:16px;font-size:12px;color:#b91c1c">${eval3.missedRisks.map((r) => `<li>«${escapeHtml(r.text)}» — ${escapeHtml(r.hint)}</li>`).join('')}</ul>`) : ''}

      ${verdictCard ? p3Section('#f8fafc','#e2e8f0','#475569','Итог тренера',
        `<p style="font-size:12px;color:#334155;margin:0">${escapeHtml(eval3.verdictText)}</p>`) : ''}

      <details open style="background:${decBg};border:1px solid ${decBorder};border-radius:10px;padding:10px 14px;margin-bottom:10px">
        <summary style="cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;user-select:none">
          <span style="font-size:10px;color:#94a3b8">▸</span>
          <p style="font-size:11px;font-weight:700;color:${decText};margin:0">Моё решение</p>
        </summary>
        <div style="margin-top:8px">
          <p style="font-size:13px;font-weight:600;color:${decText};margin:0 0 6px">${escapeHtml(dec)}</p>
          ${p3.verdict_reason ? `<p style="font-size:12px;color:${decText};margin:0;opacity:0.85">${escapeHtml(p3.verdict_reason)}</p>` : ''}
        </div>
      </details>

      <details open style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:10px 14px">
        <summary style="cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;user-select:none">
          <span style="font-size:10px;color:#94a3b8">▸</span>
          <p style="font-size:11px;font-weight:700;color:#075985;margin:0">Главный вывод</p>
        </summary>
        <div style="margin-top:8px">
          <p style="font-size:12px;color:#0c4a6e;margin:0;white-space:pre-wrap">${escapeHtml(p3.main_insight || '—')}</p>
        </div>
      </details>
    </div>`;
  }

  global.AcademyPracticeWorkflow = {
    RISK_TYPES,
    RISK_LEVELS,
    SELF_CHECK,
    DECISION_LABELS,
    renderCaseBrief,
    initRiskTable,
    collectWorkflowFromUi,
    restoreWorkflowToUi,
    renderSelfCheck,
    collectSelfCheck,
    selfCheckComplete,
    buildReportP1,
    buildReportP2,
    buildReportP2Html,
    buildReportP3,
    buildReportP3Html
  };
})(typeof window !== 'undefined' ? window : global);
