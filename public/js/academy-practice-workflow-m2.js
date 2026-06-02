/**
 * Модуль 2 — workflow практик (AIM, библиотека промптов, паспорт ассистента).
 */
(function (global) {
  const base = global.AcademyPracticeWorkflow || {};

  const SELF_CHECK_M2 = {
    'block2-practice-aim': [
      'Я указал цель результата (Aim)',
      'Я добавил входные данные (Inputs)',
      'Я описал метод работы ИИ (Method)',
      'Я указал формат ответа',
      'Я добавил ограничения',
      'Я добавил критерии качества',
      'Я получил результат v1',
      'Я улучшил промпт в v2',
      'В v2 есть минимум 2 конкретных улучшения'
    ],
    'block2-practice-library': [
      'Я выбрал роль / направление',
      'Я создал минимум 3 промпта',
      'Каждый промпт можно использовать повторно',
      'В каждом промпте есть переменные',
      'В каждом промпте есть пример входных данных',
      'В каждом промпте есть критерии результата',
      'Я протестировал минимум 1 промпт',
      'Я улучшил минимум 1 промпт после теста',
      'Я понимаю, где буду использовать эту библиотеку'
    ],
    'block2-practice-context': [
      'Я выбрал тип ассистента',
      'Я описал, для каких задач он нужен',
      'Я добавил рабочий контекст',
      'Я описал клиентов / аудиторию',
      'Я задал стиль общения',
      'Я добавил правила и ограничения',
      'Я указал форматы результата',
      'Я добавил критерии качества',
      'Я добавил минимум 1 пример',
      'Я протестировал ассистента',
      'Я улучшил контекст в v2',
      'В v2 есть минимум 2 конкретных улучшения'
    ]
  };

  const LIBRARY_CATEGORIES = [
    { value: 'communication', label: 'Коммуникация' },
    { value: 'analytics', label: 'Аналитика' },
    { value: 'documents', label: 'Документы' },
    { value: 'content', label: 'Контент' },
    { value: 'self_check', label: 'Самопроверка' }
  ];

  const DEFAULT_PROMPT_TEMPLATE =
    'Ты — {роль}. Твоя задача — {цель}. Контекст: {контекст}. Входные данные: {входные данные}. Аудитория: {аудитория}. Формат ответа: {формат}. Тон: {тон}. Ограничения: {ограничения}. Перед финальным ответом проверь результат по критериям: {критерии качества}. Если данных недостаточно, сначала задай до 3 уточняющих вопросов.';

  function el(id) {
    return document.getElementById(id);
  }

  function val(id) {
    return el(id)?.value?.trim() || '';
  }

  function yn(v) {
    return v ? 'да' : 'нет';
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function isBlock2(scenarioKey) {
    return scenarioKey && scenarioKey.startsWith('block2-practice-');
  }

  function assembleAimPrompt() {
    const parts = [
      ['Aim (цель)', val('aimFieldA')],
      ['Inputs (входные данные)', val('aimFieldI')],
      ['Method (метод)', val('aimFieldM')],
      ['Формат ответа', val('aimFieldFormat')],
      ['Ограничения', val('aimFieldConstraints')],
      ['Критерии качества', val('aimFieldCriteria')]
    ].filter(([, v]) => v);
    if (!parts.length) return '';
    return parts.map(([k, v]) => `${k}:\n${v}`).join('\n\n');
  }

  function assemblePassport(which) {
    const suffix = which === 'v2' ? 'V2' : 'V1';
    const role = val(`passportRole${suffix}`);
    const tasks = val(`passportTasks${suffix}`);
    const work = val(`passportWork${suffix}`);
    const audience = val(`passportAudience${suffix}`);
    const products = val(`passportProducts${suffix}`);
    const style = val(`passportStyle${suffix}`);
    const rules = val(`passportRules${suffix}`);
    const formats = val(`passportFormats${suffix}`);
    const criteria = val(`passportCriteria${suffix}`);
    const goodEx = val(`passportGoodExample${suffix}`);
    const badEx = val(`passportBadExample${suffix}`);

    if (!role && !work) return '';

    return `Ты — ${role || 'рабочий ассистент'}. Ты помогаешь с задачами: ${tasks || '—'}.

Контекст:
${work || '—'}
Клиенты / аудитория:
${audience || '—'}
Продукты / услуги:
${products || '—'}

Стиль:
${style || 'Отвечай на русском языке. Тон — деловой и спокойный.'}

Правила:
${rules || '1. Если данных недостаточно — задай до 3 уточняющих вопросов.\n2. Не выдумывай факты, цифры, ссылки, цены и юридические утверждения.\n3. По GDPR, персональным данным, договорам, налогам и финансам — предупреди о проверке специалистом.'}

Форматы:
${formats || 'Письма: тема + текст. Анализ: проблема → почему важно → что улучшить. Планы: шаг → ответственный → срок → результат.'}

Критерии качества:
${criteria || 'Конкретность, практичность, отсутствие выдуманных фактов, понятность для новичков.'}

Пример хорошего ответа:
${goodEx || '—'}

Пример плохого ответа:
${badEx || '—'}`;
  }

  function renderCaseBriefM2(task, scenarioKey) {
    const box = el('caseBriefBlock');
    if (!box || !task) {
      box?.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    let html = `<h4 class="font-semibold text-slate-900 mb-2">${escapeHtml(task.title)}</h4>`;

    if (scenarioKey === 'block2-practice-aim') {
      html += `<p class="text-sm text-slate-700 mb-2">${escapeHtml(task.description || '')}</p>`;
      html += `<p class="text-xs font-medium text-slate-600 mt-2">Входные данные</p><div class="aa-case-raw">${escapeHtml(task.raw_input || '')}</div>`;
      html += `<p class="text-xs font-medium text-red-800 mt-2">Плохой промпт</p><div class="aa-case-bad-prompt">${escapeHtml(task.bad_prompt || '')}</div>`;
      if (task.expected_result) {
        html += `<p class="text-xs text-slate-500 mt-2"><strong>Ожидаемый результат:</strong> ${escapeHtml(task.expected_result)}</p>`;
      }
      const whyEl = el('aimWhyBad');
      if (whyEl && !whyEl.value.trim() && task.bad_prompt) {
        whyEl.value =
          'Запрос слишком общий: нет цели, входных данных, метода работы, формата, ограничений и критериев качества.';
      }
    } else if (scenarioKey === 'block2-practice-library') {
      html += `<p class="text-sm text-slate-700 mb-2">${escapeHtml(task.summary || '')}</p>`;
      if (task.prompt_ideas?.length) {
        html += `<p class="text-xs font-medium mt-2">Подходящие промпты для этой роли:</p><ul class="text-xs list-disc pl-5">`;
        for (const idea of task.prompt_ideas) html += `<li>${escapeHtml(idea)}</li>`;
        html += `</ul>`;
      }
    } else if (scenarioKey === 'block2-practice-context') {
      html += `<p class="text-sm text-slate-700 mb-2">${escapeHtml(task.summary || '')}</p>`;
      if (task.sample_tasks?.length) {
        html += `<p class="text-xs font-medium mt-2">Примеры задач:</p><ul class="text-xs list-disc pl-5">`;
        for (const t of task.sample_tasks) html += `<li>${escapeHtml(t)}</li>`;
        html += `</ul>`;
      }
    }
    box.innerHTML = html;
  }

  function getLibraryCardsContainer() {
    return el('libraryPromptCards');
  }

  function createLibraryCard(index, data, roleTitle) {
    const card = document.createElement('div');
    card.className = 'aa-library-prompt-card aa-practice-workflow-box space-y-2';
    card.dataset.cardIndex = String(index);
    const catOpts = LIBRARY_CATEGORIES.map(
      (c) =>
        `<option value="${c.value}"${data?.category === c.value ? ' selected' : ''}>${c.label}</option>`
    ).join('');
    card.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <span class="aa-label text-sm">Промпт ${index + 1}</span>
        <button type="button" class="aa-btn aa-btn-ghost text-xs library-remove-card" ${index < 3 ? 'hidden' : ''}>Удалить</button>
      </div>
      <label class="block text-xs"><span class="font-medium">Название</span><input type="text" class="aa-input mt-0.5 text-sm lib-name" value="${escapeHtml(data?.name || '')}" /></label>
      <label class="block text-xs"><span class="font-medium">Категория</span><select class="aa-select mt-0.5 text-sm w-full lib-category"><option value="">—</option>${catOpts}</select></label>
      <label class="block text-xs"><span class="font-medium">Для какой задачи</span><textarea class="aa-textarea mt-0.5 text-sm lib-task" rows="2">${escapeHtml(data?.task || '')}</textarea></label>
      <button type="button" class="aa-btn aa-btn-ghost text-xs library-insert-template">Вставить шаблон</button>
      <label class="block text-xs"><span class="font-medium">Шаблон промпта</span><textarea class="aa-textarea mt-0.5 text-sm lib-template" rows="4">${escapeHtml(data?.template || '')}</textarea></label>
      <label class="block text-xs"><span class="font-medium">Переменные (что можно менять)</span><textarea class="aa-textarea mt-0.5 text-sm lib-variables" rows="2" placeholder="{цель}, {аудитория}, {контекст}…">${escapeHtml(data?.variables || '')}</textarea></label>
      <label class="block text-xs"><span class="font-medium">Пример входных данных</span><textarea class="aa-textarea mt-0.5 text-sm lib-example" rows="2">${escapeHtml(data?.example || '')}</textarea></label>
      <label class="block text-xs"><span class="font-medium">Критерии хорошего результата</span><textarea class="aa-textarea mt-0.5 text-sm lib-criteria" rows="2">${escapeHtml(data?.criteria || '')}</textarea></label>`;
    card.querySelector('.library-insert-template')?.addEventListener('click', () => {
      const tpl = el('libraryTemplateDefault')?.value || DEFAULT_PROMPT_TEMPLATE;
      const role = roleTitle || '{роль}';
      card.querySelector('.lib-template').value = tpl.replace(/\{роль\}/g, role);
    });
    card.querySelector('.library-remove-card')?.addEventListener('click', () => {
      const container = getLibraryCardsContainer();
      if (container && container.querySelectorAll('.aa-library-prompt-card').length > 3) {
        card.remove();
        reindexLibraryCards();
      }
    });
    return card;
  }

  function reindexLibraryCards() {
    const container = getLibraryCardsContainer();
    if (!container) return;
    container.querySelectorAll('.aa-library-prompt-card').forEach((card, i) => {
      card.dataset.cardIndex = String(i);
      const label = card.querySelector('.aa-label');
      if (label) label.textContent = `Промпт ${i + 1}`;
      const rm = card.querySelector('.library-remove-card');
      if (rm) rm.classList.toggle('hidden', i < 3);
    });
    updateLibraryTestSelect();
  }

  function collectLibraryPrompts() {
    const container = getLibraryCardsContainer();
    if (!container) return [];
    const prompts = [];
    container.querySelectorAll('.aa-library-prompt-card').forEach((card) => {
      prompts.push({
        name: card.querySelector('.lib-name')?.value?.trim() || '',
        category: card.querySelector('.lib-category')?.value || '',
        task: card.querySelector('.lib-task')?.value?.trim() || '',
        template: card.querySelector('.lib-template')?.value?.trim() || '',
        variables: card.querySelector('.lib-variables')?.value?.trim() || '',
        example: card.querySelector('.lib-example')?.value?.trim() || '',
        criteria: card.querySelector('.lib-criteria')?.value?.trim() || ''
      });
    });
    return prompts;
  }

  function initLibraryCards(savedPrompts, roleTitle) {
    const container = getLibraryCardsContainer();
    if (!container) return;
    container.innerHTML = '';
    const prompts = savedPrompts?.length >= 3 ? savedPrompts : [...(savedPrompts || []), {}, {}, {}].slice(0, 3);
    while (prompts.length < 3) prompts.push({});
    prompts.forEach((p, i) => container.appendChild(createLibraryCard(i, p, roleTitle)));
    updateLibraryTestSelect(savedPrompts ? undefined : null);
  }

  function addLibraryCard(roleTitle) {
    const container = getLibraryCardsContainer();
    if (!container || container.querySelectorAll('.aa-library-prompt-card').length >= 5) return;
    const idx = container.querySelectorAll('.aa-library-prompt-card').length;
    container.appendChild(createLibraryCard(idx, {}, roleTitle));
    reindexLibraryCards();
  }

  function updateLibraryTestSelect(preserveIndex) {
    const sel = el('libraryTestPromptSelect');
    if (!sel) return;
    const prev = preserveIndex != null ? preserveIndex : sel.value;
    const prompts = collectLibraryPrompts();
    sel.innerHTML = '<option value="">— выберите промпт —</option>';
    prompts.forEach((p, i) => {
      if (!p.name && !p.template) return;
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = p.name || `Промпт ${i + 1}`;
      sel.appendChild(o);
    });
    if (prev !== '' && sel.querySelector(`option[value="${prev}"]`)) sel.value = prev;
  }

  function getSelectedLibraryPrompt(index) {
    const prompts = collectLibraryPrompts();
    const i = Number(index);
    return Number.isFinite(i) && prompts[i] ? prompts[i] : null;
  }

  function buildLibraryTestPrompt(prompt, exampleOverride) {
    if (!prompt?.template) return '';
    let text = prompt.template;
    const example = exampleOverride || prompt.example || '';
    text += `\n\n---\nПример входных данных для этого запуска:\n${example}`;
    if (prompt.criteria) text += `\n\nКритерии хорошего результата:\n${prompt.criteria}`;
    return text;
  }

  function collectWorkflowFromUiM2(scenarioKey) {
    const wf = {
      m2p1: {
        aim: val('aimFieldA'),
        inputs: val('aimFieldI'),
        method: val('aimFieldM'),
        format: val('aimFieldFormat'),
        constraints: val('aimFieldConstraints'),
        quality_criteria: val('aimFieldCriteria'),
        why_bad: val('aimWhyBad'),
        prompt_v1: val('m2PracticePromptV1') || assembleAimPrompt(),
        ai_v1: el('m2AiResultV1Preview')?.textContent?.trim() || '',
        eval: {
          solves_task: !!el('aimEvalSolves')?.checked,
          concrete: !!el('aimEvalConcrete')?.checked,
          ai_missed: val('aimEvalMissed')
        },
        improve_notes: val('m2PracticeImproveNotes'),
        prompt_v2: val('m2PracticePromptV2'),
        ai_v2: el('m2AiResultV2Preview')?.textContent?.trim() || '',
        main_insight: val('m2PracticeMainInsight')
      },
      m2p2: {
        role_id: val('libraryRoleIdHidden') || null,
        role_title: val('libraryRoleTitleHidden') || '',
        prompts: collectLibraryPrompts(),
        tested_index: val('libraryTestPromptSelect'),
        test_input: val('libraryTestInput'),
        ai_result: val('libraryAiResultPreview') || el('libraryAiResultPreview')?.textContent?.trim() || '',
        improve_notes: val('libraryImproveNotes'),
        prompt_v2: val('libraryPromptV2'),
        library_use_note: val('libraryUseNote')
      },
      m2p3: {
        assistant_type_id: val('contextTypeIdHidden') || null,
        assistant_title: val('contextTypeTitleHidden') || '',
        tasks_description: val('passportTasksV1'),
        passport_v1: {
          role: val('passportRoleV1'),
          work_context: val('passportWorkV1'),
          audience: val('passportAudienceV1'),
          products: val('passportProductsV1'),
          style: val('passportStyleV1'),
          rules: val('passportRulesV1'),
          formats: val('passportFormatsV1'),
          criteria: val('passportCriteriaV1'),
          good_example: val('passportGoodExampleV1'),
          bad_example: val('passportBadExampleV1'),
          assembled: val('passportPreviewV1') || assemblePassport('v1')
        },
        test_task: val('passportTestTask'),
        ai_result: val('contextAiResultPreview') || el('contextAiResultPreview')?.textContent?.trim() || '',
        eval_worked: val('contextEvalWorked'),
        eval_missed: val('contextEvalMissed'),
        passport_v2: val('passportPreviewV2') || assemblePassport('v2'),
        usage_note: val('contextUsageNote')
      },
      self_check: collectSelfCheckM2(scenarioKey)
    };
    return wf;
  }

  function collectSelfCheckM2(scenarioKey) {
    const items = SELF_CHECK_M2[scenarioKey] || [];
    return items.map((_, i) => !!el(`selfCheck_${scenarioKey}_${i}`)?.checked);
  }

  function renderSelfCheckM2(scenarioKey, saved) {
    const block = el('practiceSelfCheckBlock');
    const list = el('practiceSelfCheckList');
    if (!block || !list) return;
    const items = SELF_CHECK_M2[scenarioKey] || [];
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

  function selfCheckCompleteM2(scenarioKey) {
    const items = SELF_CHECK_M2[scenarioKey] || [];
    if (!items.length) return true;
    return collectSelfCheckM2(scenarioKey).every(Boolean);
  }

  function restoreWorkflowToUiM2(wf, scenarioKey) {
    if (!wf) return;
    const set = (id, v) => {
      const node = el(id);
      if (node && v != null) node.value = v;
    };
    const setText = (id, v) => {
      const node = el(id);
      if (node && v != null) node.textContent = v;
    };

    const p1 = wf.m2p1 || {};
    set('aimFieldA', p1.aim);
    set('aimFieldI', p1.inputs);
    set('aimFieldM', p1.method);
    set('aimFieldFormat', p1.format);
    set('aimFieldConstraints', p1.constraints);
    set('aimFieldCriteria', p1.quality_criteria);
    set('aimWhyBad', p1.why_bad);
    set('m2PracticePromptV1', p1.prompt_v1);
    setText('m2AiResultV1Preview', p1.ai_v1);
    if (p1.ai_v1) el('m2AiResultBlockV1')?.classList.remove('hidden');
    if (p1.eval) {
      if (el('aimEvalSolves')) el('aimEvalSolves').checked = !!p1.eval.solves_task;
      if (el('aimEvalConcrete')) el('aimEvalConcrete').checked = !!p1.eval.concrete;
      set('aimEvalMissed', p1.eval.ai_missed);
    }
    set('m2PracticeImproveNotes', p1.improve_notes);
    set('m2PracticePromptV2', p1.prompt_v2);
    setText('m2AiResultV2Preview', p1.ai_v2);
    if (p1.ai_v2) el('m2AiResultBlockV2')?.classList.remove('hidden');
    set('m2PracticeMainInsight', p1.main_insight);

    const p2 = wf.m2p2 || {};
    set('libraryRoleIdHidden', p2.role_id);
    set('libraryRoleTitleHidden', p2.role_title);
    initLibraryCards(p2.prompts, p2.role_title);
    set('libraryTestPromptSelect', p2.tested_index);
    set('libraryTestInput', p2.test_input);
    setText('libraryAiResultPreview', p2.ai_result);
    if (p2.ai_result) el('libraryAiResultBlock')?.classList.remove('hidden');
    set('libraryImproveNotes', p2.improve_notes);
    set('libraryPromptV2', p2.prompt_v2);
    set('libraryUseNote', p2.library_use_note);

    const p3 = wf.m2p3 || {};
    set('contextTypeIdHidden', p3.assistant_type_id);
    set('contextTypeTitleHidden', p3.assistant_title);
    const pv1 = p3.passport_v1 || {};
    set('passportRoleV1', pv1.role);
    set('passportTasksV1', p3.tasks_description || pv1.tasks);
    set('passportWorkV1', pv1.work_context);
    set('passportAudienceV1', pv1.audience);
    set('passportProductsV1', pv1.products);
    set('passportStyleV1', pv1.style);
    set('passportRulesV1', pv1.rules);
    set('passportFormatsV1', pv1.formats);
    set('passportCriteriaV1', pv1.criteria);
    set('passportGoodExampleV1', pv1.good_example);
    set('passportBadExampleV1', pv1.bad_example);
    set('passportPreviewV1', pv1.assembled || assemblePassport('v1'));
    set('passportTestTask', p3.test_task);
    setText('contextAiResultPreview', p3.ai_result);
    if (p3.ai_result) el('contextAiResultBlock')?.classList.remove('hidden');
    set('contextEvalWorked', p3.eval_worked);
    set('contextEvalMissed', p3.eval_missed);
    if (p3.passport_v2) {
      set('passportPreviewV2', p3.passport_v2);
    } else {
      copyPassportV1ToV2Fields();
    }
    set('contextUsageNote', p3.usage_note);

    renderSelfCheckM2(scenarioKey, wf.self_check);
  }

  function copyPassportV1ToV2Fields() {
    ['Role', 'Tasks', 'Work', 'Audience', 'Products', 'Style', 'Rules', 'Formats', 'Criteria', 'GoodExample', 'BadExample'].forEach(
      (suffix) => {
        const v1 = el(`passport${suffix}V1`);
        const v2 = el(`passport${suffix}V2`);
        if (v1 && v2 && !v2.value.trim()) v2.value = v1.value;
      }
    );
  }

  function buildReportM2P1(task, wf, taskNum) {
    const p1 = wf.m2p1 || {};
    return `Выбранный кейс (${taskNum || '?'}): ${task?.title || ''}

Плохой промпт:
${task?.bad_prompt || '—'}

Почему плохой промпт слабый:
${p1.why_bad || '—'}

AIM:
Aim (цель): ${p1.aim || '—'}
Inputs (входные данные): ${p1.inputs || '—'}
Method (метод): ${p1.method || '—'}

Дополнительно:
Формат: ${p1.format || '—'}
Ограничения: ${p1.constraints || '—'}
Критерии качества: ${p1.quality_criteria || '—'}

Промпт v1:
${p1.prompt_v1 || '—'}

Ответ ИИ v1:
${p1.ai_v1 || '—'}

Оценка v1:
- Результат решает задачу: ${yn(p1.eval?.solves_task)}
- Достаточно конкретики: ${yn(p1.eval?.concrete)}
- Что ИИ упустил: ${p1.eval?.ai_missed || '—'}

Что нужно улучшить:
${p1.improve_notes || '—'}

Промпт v2:
${p1.prompt_v2 || '—'}

Ответ ИИ v2:
${p1.ai_v2 || '—'}

Главный вывод (что изменилось после AIM):
${p1.main_insight || '—'}
`;
  }

  function buildReportM2P2(task, wf, taskNum) {
    const p2 = wf.m2p2 || {};
    let promptsBlock = '';
    (p2.prompts || []).forEach((pr, i) => {
      if (!pr.name && !pr.template) return;
      promptsBlock += `
Промпт ${i + 1}: ${pr.name || '—'}
Категория: ${LIBRARY_CATEGORIES.find((c) => c.value === pr.category)?.label || pr.category || '—'}
Задача: ${pr.task || '—'}
Шаблон: ${pr.template || '—'}
Переменные: ${pr.variables || '—'}
Пример входных данных: ${pr.example || '—'}
Критерии: ${pr.criteria || '—'}
`;
    });
    return `Выбранная роль (${taskNum || '?'}): ${task?.title || p2.role_title || '—'}

${promptsBlock || '—'}

Какой промпт протестировал: ${p2.tested_index !== '' ? Number(p2.tested_index) + 1 : '—'}
Пример для теста: ${p2.test_input || '—'}

Ответ ИИ:
${p2.ai_result || '—'}

Что улучил в версии v2:
${p2.improve_notes || '—'}

Промпт v2 (улучшенный шаблон):
${p2.prompt_v2 || '—'}

Где буду использовать библиотеку:
${p2.library_use_note || '—'}
`;
  }

  function buildReportM2P3(task, wf, taskNum) {
    const p3 = wf.m2p3 || {};
    const pv1 = p3.passport_v1?.assembled || assemblePassport('v1');
    return `Выбранный тип ассистента (${taskNum || '?'}): ${task?.title || p3.assistant_title || '—'}

Для каких задач нужен:
${p3.tasks_description || '—'}

Паспорт ассистента v1:
${pv1 || '—'}

Тестовая задача:
${p3.test_task || '—'}

Ответ ассистента:
${p3.ai_result || '—'}

Что сработало:
${p3.eval_worked || '—'}

Что ассистент понял неправильно или сделал слишком общо:
${p3.eval_missed || '—'}

Паспорт ассистента v2:
${p3.passport_v2 || '—'}

Где буду использовать:
${p3.usage_note || '—'}
`;
  }

  function validateLibraryBeforeReport() {
    const prompts = collectLibraryPrompts().filter((p) => p.template && p.variables);
    if (prompts.length < 3) {
      alert('Нужно минимум 3 промпта с заполненными шаблоном и переменными.');
      return false;
    }
    return true;
  }

  Object.assign(base, {
    SELF_CHECK_M2,
    LIBRARY_CATEGORIES,
    DEFAULT_PROMPT_TEMPLATE,
    isBlock2,
    assembleAimPrompt,
    assemblePassport,
    renderCaseBriefM2,
    initLibraryCards,
    addLibraryCard,
    collectLibraryPrompts,
    updateLibraryTestSelect,
    getSelectedLibraryPrompt,
    buildLibraryTestPrompt,
    collectWorkflowFromUiM2,
    restoreWorkflowToUiM2,
    renderSelfCheckM2,
    selfCheckCompleteM2,
    collectSelfCheckM2,
    buildReportM2P1,
    buildReportM2P2,
    buildReportM2P3,
    validateLibraryBeforeReport,
    copyPassportV1ToV2Fields
  });

  global.AcademyPracticeWorkflow = base;
})(typeof window !== 'undefined' ? window : global);
