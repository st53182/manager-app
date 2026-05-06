/**
 * Генерация изображений через OpenRouter (chat/completions + modalities).
 * Обычный текстовый чат этого не умеет — нужна отдельная модель и modalities.
 */

function getImageModel() {
  return process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image';
}

async function openRouterChatCompletionJson(payload) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }
  const referer = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '') || 'http://localhost:3000';
  const title = process.env.OPENROUTER_APP_TITLE || 'AI Academy';

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': referer,
      'X-Title': title
    },
    body: JSON.stringify(payload)
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(raw.slice(0, 800) || `OpenRouter ${res.status}`);
  }
  return JSON.parse(raw);
}

function parseAssistantImages(apiJson) {
  const msg = apiJson?.choices?.[0]?.message;
  const usage = apiJson?.usage || null;
  if (!msg) {
    return {
      markdown: 'Пустой ответ провайдера.',
      images: [],
      text: '',
      usage
    };
  }

  let text = '';
  if (typeof msg.content === 'string') {
    text = msg.content;
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part?.type === 'text' && part.text) text += part.text;
    }
  }

  const urls = [];
  if (Array.isArray(msg.images)) {
    for (const im of msg.images) {
      if (typeof im === 'string') urls.push(im);
      else if (im?.url) urls.push(im.url);
      else if (im?.image_url?.url) urls.push(im.image_url.url);
    }
  }
  if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part?.type === 'image_url' && part.image_url?.url) {
        urls.push(part.image_url.url);
      }
    }
  }

  let md = '';
  for (const u of urls) {
    md += `![Сгенерированное изображение](${u})\n\n`;
  }
  if (text && text.trim()) {
    md += text.trim();
  }
  if (!md.trim()) {
    md =
      'Не удалось получить изображение (пустой ответ). Попробуйте другую формулировку или проверьте модель OPENROUTER_IMAGE_MODEL на OpenRouter.';
  }

  return {
    markdown: md.trim(),
    images: urls,
    text: text.trim(),
    usage
  };
}

async function generateImageForEducation(userPrompt) {
  const model = getImageModel();
  const system =
    'Ты помощник для обучения. Создавай изображения по запросу для учебных целей: иллюстрации, схемы, примеры. ' +
    'При небезопасном или запрещённом запросе откажись коротко текстом, без изображения.';

  const data = await openRouterChatCompletionJson({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt.trim() }
    ],
    modalities: ['image', 'text'],
    stream: false,
    max_tokens: 4096
  });

  return parseAssistantImages(data);
}

module.exports = {
  generateImageForEducation,
  getImageModel,
  parseAssistantImages
};
