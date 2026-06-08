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
 * Non-streaming call to Perplexity/sonar via OpenRouter.
 * Returns the full response text + citations array.
 * Used for verification chatMode where citations must be captured.
 */
async function fetchPerplexityWithCitations(openai, { model, messages, maxTokens = 4096 }) {
  const resp = await openai.chat.completions.create({
    model,
    messages,
    stream: false,
    max_tokens: maxTokens
  });
  const text = resp.choices?.[0]?.message?.content || '';
  // citations is a non-standard top-level field Perplexity adds
  const citations = Array.isArray(resp.citations) ? resp.citations : [];
  const usage = resp.usage || null;
  return { text, citations, usage };
}

module.exports = {
  streamChatCompletion,
  fetchPerplexityWithCitations,
  estimateTokensFromText,
  estimateCostUsd
};
