/**
 * Curated model presets for OpenRouter (IDs must match https://openrouter.ai/models).
 * Shown in UI; actual calls still restricted by user.ai_allowed_models.
 */
const MODEL_CATALOG = [
  {
    id: 'openai/gpt-4o-mini',
    label: 'Экономно · текст',
    group: 'general',
    hint: 'Быстрый текст; PDF в чате — только извлечённый текст на сервере (сканы лучше через базу знаний или Gemini)'
  },
  {
    id: 'google/gemini-2.0-flash-001',
    label: 'Аудио · видео · изображения',
    group: 'multimodal',
    hint: 'Мультимодальность: картинки, PDF, аудио, видео (зависит от лимитов модели)'
  },
  {
    id: 'anthropic/claude-3.7-sonnet',
    label: 'Данные · код · анализ',
    group: 'data',
    hint: 'Claude Sonnet; PDF в чате — извлечённый текст на сервере (как у GPT mini)'
  },
  {
    id: 'google/gemini-2.5-flash-image',
    label: 'Генерация изображений',
    group: 'image',
    hint: 'Используется кнопкой «Картинка» (отдельный режим OpenRouter modalities:image)'
  }
];

function getModelCatalog() {
  return MODEL_CATALOG;
}

/** Merge catalog ids into allowed list for new defaults (dedupe). */
function mergeDefaultAllowedModels(existing) {
  const base = Array.isArray(existing) ? [...existing] : [];
  for (const m of MODEL_CATALOG) {
    if (!base.includes(m.id)) base.push(m.id);
  }
  return base;
}

module.exports = {
  MODEL_CATALOG,
  getModelCatalog,
  mergeDefaultAllowedModels
};
