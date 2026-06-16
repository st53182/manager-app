/**
 * Модуль 2 — workflow практик (AIM, библиотека промптов, паспорт ассистента).
 */
(function (global) {
  const base = global.AcademyPracticeWorkflow || {};

  const SELF_CHECK_M2 = {
    'block2-practice-techniques': [
      'Я выбрал кейс',
      'Я получил Ответ A на базовый промпт',
      'Я выбрал технику (Method): CoT, few-shot или самокритика',
      'Я применил технику и получил Ответ B',
      'Я сравнил Ответ A и Ответ B',
      'Я назвал минимум 2 отличия',
      'Я записал вывод: где техника поможет в работе'
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
    'block2-practice-assistant': [
      'Я выбрал тип ассистента',
      'Я описал, для каких задач он нужен',
      'Я добавил рабочий контекст',
      'Я описал клиентов / аудиторию',
      'Я задал стиль общения',
      'Я добавил правила и ограничения',
      'Я указал форматы результата',
      'Я подключил базу знаний (по желанию)',
      'Ассистент создан и сохранён в студии',
      'Я протестировал ассистента',
      'Я улучшил паспорт в v2',
      'В v2 есть минимум 2 конкретных улучшения'
    ],
    'block2-practice-kb': [
      'Я выбрал кейс и документ',
      'Я создал базу знаний и загрузил документ',
      'Я получил ответ БЕЗ базы',
      'Я получил ответ С базой',
      'Я описал разницу между ответами',
      'Я проверил вопрос-ловушку (честный отказ)',
      'Я записал вывод: где база знаний нужна в работе'
    ],
    'block2-practice-models': [
      'Я выбрал класс задачи и подготовил промпт',
      'Я прогнал промпт через несколько моделей',
      'Я сравнил ответы по критерию задачи',
      'Я выбрал победителя',
      'Я обосновал выбор',
      'Я записал вывод: какую модель под какой класс задач'
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

    if (scenarioKey === 'block2-practice-techniques') {
      html += `<p class="text-sm text-slate-700 mb-2">${escapeHtml(task.description || '')}</p>`;
      html += `<p class="text-xs font-medium text-slate-600 mt-2">Базовый промпт (для Ответа A)</p><div class="aa-case-raw">${escapeHtml(task.base_prompt || '')}</div>`;
      if (task.expected_result) {
        html += `<p class="text-xs text-slate-500 mt-2"><strong>Ожидаемый результат:</strong> ${escapeHtml(task.expected_result)}</p>`;
      }
    } else if (scenarioKey === 'block2-practice-library') {
      html += `<p class="text-sm text-slate-700 mb-2">${escapeHtml(task.summary || '')}</p>`;
      if (task.prompt_ideas?.length) {
        html += `<p class="text-xs font-medium mt-2">Подходящие промпты для этой роли:</p><ul class="text-xs list-disc pl-5">`;
        for (const idea of task.prompt_ideas) html += `<li>${escapeHtml(idea)}</li>`;
        html += `</ul>`;
      }
    } else if (scenarioKey === 'block2-practice-assistant') {
      html += `<p class="text-sm text-slate-700 mb-2">${escapeHtml(task.summary || '')}</p>`;
      if (task.sample_tasks?.length) {
        html += `<p class="text-xs font-medium mt-2">Примеры задач:</p><ul class="text-xs list-disc pl-5">`;
        for (const t of task.sample_tasks) html += `<li>${escapeHtml(t)}</li>`;
        html += `</ul>`;
      }
    } else if (scenarioKey === 'block2-practice-kb') {
      html += `<p class="text-sm text-slate-700 mb-2">${escapeHtml(task.summary || '')}</p>`;
      if (task.doc_topic) {
        html += `<p class="text-xs text-slate-500 mt-1"><strong>Документ:</strong> ${escapeHtml(task.doc_topic)}</p>`;
      }
      if (task.sample_questions?.length) {
        html += `<p class="text-xs font-medium mt-2">Вопросы к документу:</p><ul class="text-xs list-disc pl-5">`;
        for (const q of task.sample_questions) html += `<li>${escapeHtml(q)}</li>`;
        html += `</ul>`;
      }
      if (task.trap_question) {
        html += `<p class="text-xs font-medium text-amber-800 mt-2">Вопрос-ловушка (ответа в документе нет):</p><div class="aa-case-bad-prompt">${escapeHtml(task.trap_question)}</div>`;
      }
    } else if (scenarioKey === 'block2-practice-models') {
      html += `<p class="text-sm text-slate-700 mb-2">${escapeHtml(task.summary || '')}</p>`;
      if (task.task_type) {
        html += `<p class="text-xs text-slate-500 mt-1"><strong>Класс задачи:</strong> ${escapeHtml(task.task_type)}</p>`;
      }
      if (task.prompt) {
        html += `<p class="text-xs font-medium mt-2">Заготовка промпта:</p><div class="aa-case-raw">${escapeHtml(task.prompt)}</div>`;
      }
      if (task.compare_focus) {
        html += `<p class="text-xs text-slate-500 mt-2"><strong>На что смотреть:</strong> ${escapeHtml(task.compare_focus)}</p>`;
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
      <label class="block text-xs"><span class="font-medium">Критерии хорошего результата</span><textarea class="aa-textarea mt-0.5 text-sm lib-criteria" rows="2">${escapeHtml(data?.criteria || '')}</textarea></label>
      <button type="button" class="aa-btn aa-btn-ghost text-xs w-full js-save-library-card">Сохранить в библиотеку</button>`;
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
      kb: {
        case_id: val('kbCaseIdHidden') || null,
        case_title: val('kbCaseTitleHidden') || '',
        kb_id: val('kbIdHidden') || null,
        doc_name: val('kbDocNameHidden') || '',
        question: val('kbQuestion'),
        answer_without: el('kbAnswerWithoutPreview')?.textContent?.trim() || '',
        answer_with: el('kbAnswerWithPreview')?.textContent?.trim() || '',
        difference: val('kbDifference'),
        trap_question: val('kbTrapQuestion'),
        trap_response: el('kbTrapPreview')?.textContent?.trim() || '',
        decision: val('kbDecision'),
        insight: val('kbInsight')
      },
      models: {
        case_id: val('modelsCaseIdHidden') || null,
        case_title: val('modelsCaseTitleHidden') || '',
        prompt: val('modelsPrompt'),
        results: (() => {
          try {
            return JSON.parse(val('modelsResultsHidden') || '[]');
          } catch {
            return [];
          }
        })(),
        winner: val('modelsWinner'),
        justification: val('modelsJustification'),
        insight: val('modelsInsight')
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

    const kb = wf.kb || {};
    set('kbCaseIdHidden', kb.case_id);
    set('kbCaseTitleHidden', kb.case_title);
    set('kbIdHidden', kb.kb_id);
    set('kbDocNameHidden', kb.doc_name);
    set('kbQuestion', kb.question);
    setText('kbAnswerWithoutPreview', kb.answer_without);
    if (kb.answer_without) el('kbAnswerWithoutBlock')?.classList.remove('hidden');
    setText('kbAnswerWithPreview', kb.answer_with);
    if (kb.answer_with) el('kbAnswerWithBlock')?.classList.remove('hidden');
    set('kbDifference', kb.difference);
    set('kbTrapQuestion', kb.trap_question);
    setText('kbTrapPreview', kb.trap_response);
    if (kb.trap_response) el('kbTrapBlock')?.classList.remove('hidden');
    set('kbDecision', kb.decision);
    set('kbInsight', kb.insight);

    const mdl = wf.models || {};
    set('modelsCaseIdHidden', mdl.case_id);
    set('modelsCaseTitleHidden', mdl.case_title);
    set('modelsPrompt', mdl.prompt);
    if (mdl.results?.length) {
      set('modelsResultsHidden', JSON.stringify(mdl.results));
      if (typeof base.renderModelsResults === 'function') base.renderModelsResults(mdl.results, mdl.winner);
    }
    set('modelsWinner', mdl.winner);
    set('modelsJustification', mdl.justification);
    set('modelsInsight', mdl.insight);

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

Базовый промпт (Ответ A):
${p1.prompt_v1 || '—'}

Ответ A (без техники):
${p1.ai_v1 || '—'}

Оценка Ответа A:
- Решает задачу: ${yn(p1.eval?.solves_task)}
- Достаточно конкретики / глубины: ${yn(p1.eval?.concrete)}
- Что слабо или упущено: ${p1.eval?.ai_missed || '—'}

Применённая техника (что добавлено в Method):
${p1.method || p1.improve_notes || '—'}

Промпт с техникой (Ответ B):
${p1.prompt_v2 || '—'}

Ответ B (с техникой):
${p1.ai_v2 || '—'}

Главный вывод (что добавила техника, где применю):
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

  function buildReportM2Kb(task, wf, taskNum) {
    const kb = wf.kb || {};
    return `Выбранный кейс (${taskNum || '?'}): ${task?.title || kb.case_title || ''}
Документ: ${kb.doc_name || '—'}

Вопрос: ${kb.question || '—'}

Ответ БЕЗ базы знаний:
${kb.answer_without || '—'}

Ответ С базой знаний:
${kb.answer_with || '—'}

Что изменилось (точность, ссылки на документ):
${kb.difference || '—'}

Вопрос-ловушка (ответа в документе нет):
${kb.trap_question || '—'}

Реакция ассистента на ловушку (выдумал / честно отказался):
${kb.trap_response || '—'}

Решение: ${kb.decision || '—'}

Вывод (где база знаний нужна в работе):
${kb.insight || '—'}
`;
  }

  function buildReportM2Models(task, wf, taskNum) {
    const mdl = wf.models || {};
    let resultsBlock = '';
    (mdl.results || []).forEach((r) => {
      const resp = String(r.response || '').slice(0, 600);
      resultsBlock += `
Модель: ${r.model || '—'}${r.latency_ms ? ` (${r.latency_ms} мс)` : ''}
Ответ: ${resp || '—'}
`;
    });
    return `Класс задачи (${taskNum || '?'}): ${task?.title || mdl.case_title || ''}

Промпт:
${mdl.prompt || '—'}

Ответы моделей:${resultsBlock || ' —'}

Победитель: ${mdl.winner || '—'}

Обоснование выбора:
${mdl.justification || '—'}

Вывод (какую модель под какой класс задач):
${mdl.insight || '—'}
`;
  }

  function renderModelsResults(results, winner) {
    const box = el('modelsResultsBlock');
    if (!box) return;
    if (!results?.length) {
      box.classList.add('hidden');
      box.innerHTML = '';
      return;
    }
    box.classList.remove('hidden');
    let html = '';
    results.forEach((r) => {
      const isWin = winner && r.model === winner;
      const bodyHtml = r.error
        ? `<div class="text-sm text-amber-700">⚠ ${escapeHtml(r.error)}</div>`
        : `<div class="aa-task-detail max-h-40 overflow-y-auto text-sm whitespace-pre-wrap">${escapeHtml(String(r.response || ''))}</div>`;
      html += `<div class="aa-practice-workflow-box space-y-1${isWin ? ' ring-2 ring-blue-400' : ''}">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold text-slate-700">${escapeHtml(r.model || '')}</span>
          <span class="text-[11px] text-slate-400">${r.latency_ms ? r.latency_ms + ' мс' : ''}</span>
        </div>
        ${bodyHtml}
      </div>`;
    });
    box.innerHTML = html;
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
    buildReportM2Kb,
    buildReportM2Models,
    renderModelsResults,
    validateLibraryBeforeReport,
    copyPassportV1ToV2Fields
  });

  global.AcademyPracticeWorkflow = base;
})(typeof window !== 'undefined' ? window : global);
