import type { OpenAIChatRequest, OpenAIMessage } from './types.js';

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

export function formatOpenAIResponse(
  id: string,
  model: string,
  content: string,
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
) {
  return {
    id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
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
  role?: string
) {
  const delta: Record<string, any> = {};
  if (role) {
    delta.role = role;
  }
  if (deltaContent) {
    delta.content = deltaContent;
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
