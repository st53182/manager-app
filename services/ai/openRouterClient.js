const OpenAI = require('openai');

function getPublicOrigin() {
  const url = process.env.APP_PUBLIC_URL || '';
  if (url) return url.replace(/\/$/, '');
  return '';
}

function createOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const referer = getPublicOrigin() || 'http://localhost:3000';
  const title = process.env.OPENROUTER_APP_TITLE || 'AI Academy';

  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': referer,
      'X-Title': title
    }
  });
}

module.exports = {
  createOpenRouterClient,
  getDefaultModel: () =>
    process.env.OPENROUTER_DEFAULT_MODEL || 'openai/gpt-4o-mini'
};
