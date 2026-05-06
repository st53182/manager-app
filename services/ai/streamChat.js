/**
 * Streams chat completions from OpenRouter (OpenAI-compatible API).
 * Yields { type:'chunk', text } | { type:'done', fullText, usage }
 */
async function* streamChatCompletion(openai, {
  model,
  messages,
  maxTokens = 4096
}) {
  let stream;
  try {
    stream = await openai.chat.completions.create({
      model,
      messages,
      stream: true,
      max_tokens: maxTokens,
      stream_options: { include_usage: true }
    });
  } catch (firstErr) {
    stream = await openai.chat.completions.create({
      model,
      messages,
      stream: true,
      max_tokens: maxTokens
    });
  }

  let fullText = '';
  let usage = null;

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      fullText += delta;
      yield { type: 'chunk', text: delta };
    }
    if (chunk.usage) {
      usage = chunk.usage;
    }
  }

  yield { type: 'done', fullText, usage };
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

module.exports = {
  streamChatCompletion,
  estimateTokensFromText,
  estimateCostUsd
};
