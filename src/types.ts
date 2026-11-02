export interface ChatRequest {
  prompt: string;
  conversation_id?: string;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  mode?: 'accept-edits' | 'auto' | 'plan';
  dangerously_skip_permissions?: boolean;
  stream?: boolean;
  cwd?: string;
}

export interface ChatResponse {
  success: boolean;
  conversation_id?: string;
  response: string;
  duration_seconds?: number;
  num_turns?: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    thinking_tokens: number;
    cache_read_tokens?: number;
    total_tokens: number;
  };
  error?: string;
}

export interface AgyStreamEvent {
  event: 'init' | 'step_update' | 'result';
  conversation_id?: string;
  init?: {
    cwd: string;
    tools: string[];
    permission_mode: string;
  };
  step_update?: {
    conversation_id: string;
    step_index: number;
    state: string;
    step_type: string;
    text_delta?: string;
    duration_seconds?: number;
    usage?: Record<string, number>;
  };
  result?: {
    conversation_id: string;
    status: string;
    response: string;
    duration_seconds: number;
    num_turns: number;
    usage: Record<string, number>;
  };
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatRequest {
  model?: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}
