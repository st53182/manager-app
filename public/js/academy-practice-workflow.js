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
      'Я указал роль ИИ',
      'Я дал конкретный контекст',
      'Я указал формат ответа',
      'Я задал стиль',
      'Я добавил ограничения',
      'Я получил результат v1',
      'Я улучшил промпт после первого результата',
      'В v2 есть минимум 2 конкретных улучшения'
    ],
    'block1-practice-scenario': [
      'Я задал роль ИИ',
      'Я задал свою роль',
      'Я указал цель диалога',
      'Я провёл минимум 4 пары реплик',
      'В диалоге было возражение или сложная реакция',
      'Я использовал признание позиции собеседника',
      'Я использовал конкретный факт',
      'Я задал вопрос',
      'Я предложил следующий шаг',
      'Я проанализировал не только ИИ, но и свои ответы'
    ],
    'block1-practice-hallucination': [
      'Я нашёл минимум 4 риска',
      'У каждого риска есть цитата',
      'У каждого риска есть тип проблемы',
      'У каждого риска есть уровень риска',
      'Я объяснил, что нужно проверить',
      'Я написал безопасную версию',
      'Я принял решение, можно ли использовать текст',
      'Я составил чек-лист из 5 пунктов'
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
        ai_v1: val('aiResultV1Preview') || el('aiResultV1Preview')?.textContent?.trim() || '',
        prompt_v2: val('practicePromptV2'),
        ai_v2: val('aiResultV2Preview') || el('aiResultV2Preview')?.textContent?.trim() || '',
        ai_eval: '',
        main_insight: ''
      },
      p2: {
        student_goal: val('practiceStudentGoal'),
        analysis: {
          good_replies: val('p2GoodReplies'),
          weak_reply: val('p2WeakReply'),
          ai_issues: val('p2AiIssues'),
          harder_instruction: val('p2HarderInstruction'),
          apply_work: val('p2ApplyWork')
        }
      },
      p3: {
        suspicious_claims: val('p3SuspiciousClaims'),
        verify_questions: val('p3VerifyQuestions'),
        ai_response_eval: val('p3AiResponseEval'),
        decision: document.querySelector('input[name="riskDecision"]:checked')?.value || '',
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
    const setText = (id, v) => {
      const node = el(id);
      if (node && v != null) node.textContent = v;
    };
    set('practicePromptV1', p1.prompt_v1);
    setText('aiResultV1Preview', p1.ai_v1);
    if (p1.ai_v1) el('aiResultBlockV1')?.classList.remove('hidden');
    set('practicePromptV2', p1.prompt_v2);
    setText('aiResultV2Preview', p1.ai_v2);
    if (p1.ai_v2) el('aiResultBlockV2')?.classList.remove('hidden');
    // ai_eval and main_insight removed from flow — no restore needed

    const p2 = wf.p2 || {};
    set('practiceStudentGoal', p2.student_goal);
    const a = p2.analysis || {};
    set('p2GoodReplies', a.good_replies);
    set('p2WeakReply', a.weak_reply);
    set('p2AiIssues', a.ai_issues);
    set('p2HarderInstruction', a.harder_instruction);
    set('p2ApplyWork', a.apply_work);

    const p3 = wf.p3 || {};
    set('p3SuspiciousClaims', p3.suspicious_claims);
    set('p3VerifyQuestions', p3.verify_questions);
    set('p3AiResponseEval', p3.ai_response_eval);
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
    const a = p2.analysis || {};
    return `Выбранный сценарий (${taskNum || '?'}): ${task?.title || ''}

Роли:
ИИ = ${val('practiceRoleAi') || task?.ai_role?.slice(0, 80) || '…'}
Я = ${val('practiceRoleMe') || task?.student_role || '…'}

Моя цель в диалоге:
${p2.student_goal || task?.student_goal || '—'}

Диалог (скопируйте из чата, минимум 4 пары):
Я: …
ИИ: …
…

Какие 2 мои реплики сработали хорошо и почему:
${a.good_replies || '—'}

Какая 1 моя реплика была слабой и как переписать:
${a.weak_reply || '—'}

Где ИИ был нереалистичен / услужлив:
${a.ai_issues || '—'}

Как изменить инструкцию ИИ для более сложной тренировки:
${a.harder_instruction || '—'}

Применение на работе:
${a.apply_work || '—'}
`;
  }

  function buildReportP3(task, wf, taskNum) {
    const p3 = wf.p3 || {};
    const frag = task?.fragment_text || '';
    const dec = DECISION_LABELS[p3.decision] || p3.decision || '—';
    return `Выбранный вариант (${taskNum || '?'}): ${task?.title || ''}

Исходный фрагмент:
${frag}

Подозрительные утверждения, которые я заметил:
${p3.suspicious_claims || '—'}

Вопросы, которые я задал нейросети для проверки:
${p3.verify_questions || '—'}

Как ИИ ответил на вопросы о источниках:
${p3.ai_response_eval || '—'}

Итоговое решение: ${dec}

Главный вывод:
${p3.main_insight || '—'}
`;
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
    buildReportP3
  };
})(typeof window !== 'undefined' ? window : global);
