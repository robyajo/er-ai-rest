import type { OpenAIMessage } from './types.js';

export function messagesToPrompt(messages: OpenAIMessage[]): string {
  if (!messages || messages.length === 0) return '';
  if (messages.length === 1) return messages[0].content;

  // Format multi-turn messages
  return messages
    .map((m) => {
      if (m.role === 'system') return `[System Instructions: ${m.content}]`;
      if (m.role === 'user') return `User: ${m.content}`;
      if (m.role === 'assistant') return `Assistant: ${m.content}`;
      return `${m.role}: ${m.content}`;
    })
    .join('\n\n');
}

export function promptToMessages(prompt: string | string[]): OpenAIMessage[] {
  const p = Array.isArray(prompt) ? prompt.join('\n') : String(prompt || '');
  return [{ role: 'user', content: p }];
}

export function formatOpenAIResponse(
  id: string,
  model: string,
  content: string,
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number },
  reasoningContent?: string
) {
  const message: Record<string, any> = {
    role: 'assistant',
    content,
  };
  if (reasoningContent) {
    message.reasoning_content = reasoningContent;
  }

  return {
    id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: usage?.input_tokens || 0,
      completion_tokens: usage?.output_tokens || 0,
      total_tokens: usage?.total_tokens || 0,
    },
  };
}

export function formatOpenAIChunk(
  id: string,
  model: string,
  deltaContent: string,
  finishReason: string | null = null,
  role?: string,
  reasoningContent?: string
) {
  const delta: Record<string, any> = {};
  if (role) {
    delta.role = role;
  }
  if (deltaContent) {
    delta.content = deltaContent;
  }
  if (reasoningContent) {
    delta.reasoning_content = reasoningContent;
  }

  return {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta,
        finish_reason: finishReason,
      },
    ],
  };
}

export function formatOpenAICompletionResponse(
  id: string,
  model: string,
  text: string,
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
) {
  return {
    id,
    object: 'text_completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        text,
        index: 0,
        logprobs: null,
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: usage?.input_tokens || 0,
      completion_tokens: usage?.output_tokens || 0,
      total_tokens: usage?.total_tokens || 0,
    },
  };
}

export function formatOpenAICompletionChunk(
  id: string,
  model: string,
  text: string,
  finishReason: string | null = null
) {
  return {
    id,
    object: 'text_completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        text,
        index: 0,
        logprobs: null,
        finish_reason: finishReason,
      },
    ],
  };
}
