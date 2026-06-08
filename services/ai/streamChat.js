/**
 * Streams chat completions from OpenRouter (OpenAI-compatible API).
 * Yields { type:'chunk', text } | { type:'done', fullText, usage }
 */
async function* streamChatCompletion(openai, {
  model,
  messages,
  maxTokens = 4096,
  temperature,
  topP
}) {
  let stream;
  try {
    stream = await openai.chat.completions.create({
      model,
      messages,
      stream: true,
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      stream_options: { include_usage: true }
    });
  } catch (firstErr) {
    stream = await openai.chat.completions.create({
      model,
      messages,
      stream: true,
      max_tokens: maxTokens,
      temperature,
      top_p: topP
    });
  }

  let fullText = '';
  let usage = null;
  let citations = [];

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      fullText += delta;
      yield { type: 'chunk', text: delta };
    }
    if (chunk.usage) {
      usage = chunk.usage;
    }
    // Perplexity/sonar returns citations as a top-level field on the last chunk
    if (Array.isArray(chunk.citations) && chunk.citations.length) {
      citations = chunk.citations;
    }
  }

  yield { type: 'done', fullText, usage, citations };
}

function estimateTokensFromText(s) {
  if (!s) return 0;
  return Math.ceil(s.length / 4);
}

/** Rough USD fallback when provider omits cost */
function estimateCostUsd(promptTokens, completionTokens, model) {
  const p = Number(promptTokens) || 0;
  const c = Number(completionTokens) || 0;
  if (model && model.includes('gpt-4o-mini')) {
    return p * 0.00000015 + c * 0.0000006;
  }
  return p * 0.0000002 + c * 0.0000008;
}

/**
 * Non-streaming call to Perplexity/sonar via raw fetch (bypasses OpenAI SDK
 * which strips non-standard fields like citations from the response).
 * Returns the full response text + citations array.
 * Used for verification chatMode where citations must be captured.
 */
async function fetchPerplexityWithCitations(openai, { model, messages, maxTokens = 4096 }) {
  // Extract apiKey and baseURL from the OpenAI client instance
  const apiKey = openai.apiKey;
  const baseURL = (openai.baseURL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(openai.defaultHeaders || {})
    },
    body: JSON.stringify({ model, messages, stream: false, max_tokens: maxTokens })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Perplexity API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  // citations is a non-standard top-level field Perplexity returns
  const citations = Array.isArray(data.citations) ? data.citations : [];
  const usage = data.usage || null;
  // Temporary: expose all top-level keys for debugging
  const _debugKeys = Object.keys(data).join(',');
  return { text, citations, usage, _debugKeys };
}

module.exports = {
  streamChatCompletion,
  fetchPerplexityWithCitations,
  estimateTokensFromText,
  estimateCostUsd
};
