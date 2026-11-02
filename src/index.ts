import { loadEnvFile } from 'node:process';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { randomUUID } from 'node:crypto';
import { executeAgy, executeAgyStream, SUPPORTED_MODELS } from './agy.js';
import {
  getClientToken,
  getForbiddenMessage,
  isScopeAllowedForProvider,
  verifyClientToken,
} from './auth.js';
import {
  executeLlamaCpp,
  executeLlamaCppStream,
  fetchLlamaServerModels,
  isLlamaCppTarget,
  isLlamaServerReachable,
  SUPPORTED_LLAMA_MODELS,
} from './llamacpp.js';
import {
  formatOpenAIChunk,
  formatOpenAIResponse,
  messagesToPrompt,
} from './openai.js';
import type { AuthScope, ChatRequest, ModelInfo, OpenAIChatRequest } from './types.js';

// Auto-load .env file if present
try {
  loadEnvFile();
} catch {
  // .env file not found or already provided via environment
}

type Env = {
  Variables: {
    authScope: AuthScope;
  };
};

const app = new Hono<Env>();

// Enable CORS for all routes
app.use('*', cors());

// API Key Authentication Middleware with Provider Separation
app.use('*', async (c, next) => {
  if (c.req.path === '/' || c.req.path === '/health') {
    return next();
  }

  const token = getClientToken(c);
  const auth = verifyClientToken(token);

  if (!auth.authenticated) {
    return c.json(
      {
        error: {
          message: auth.error || 'Unauthorized: Invalid or missing API key',
          type: 'invalid_request_error',
          code: 'invalid_api_key',
        },
      },
      auth.statusCode || 401
    );
  }

  c.set('authScope', auth.scope || 'all');
  return next();
});

// Helper: Get combined models from agy and llama.cpp
async function getAllAvailableModels(): Promise<ModelInfo[]> {
  const serverModels = await fetchLlamaServerModels();
  const modelsMap = new Map<string, ModelInfo>();

  for (const m of SUPPORTED_MODELS) {
    modelsMap.set(m.id, m);
  }

  for (const m of SUPPORTED_LLAMA_MODELS) {
    modelsMap.set(m.id, m);
  }

  for (const m of serverModels) {
    modelsMap.set(m.id, m);
  }

  return Array.from(modelsMap.values());
}

// Root: API Documentation & Status
app.get('/', async (c) => {
  const llamaServerUp = await isLlamaServerReachable();

  return c.json({
    service: 'agy-rest',
    description:
      'REST & OpenAI-compatible API gateway with isolated authentication for Antigravity (Cloud) & llama.cpp (Local GGUF)',
    version: '1.2.0',
    auth_modes: {
      master_key: 'Grants access to both Antigravity & llama.cpp models',
      agy_api_key: 'Restricted strictly to Antigravity (Gemini, Claude, GPT-OSS)',
      llama_api_key: 'Restricted strictly to llama.cpp (Local GGUF offline inference)',
    },
    providers: {
      antigravity: {
        status: 'available',
        default_models: SUPPORTED_MODELS.map((m) => m.id),
      },
      llamacpp: {
        status: llamaServerUp ? 'server_connected' : 'cli_mode',
        default_models: SUPPORTED_LLAMA_MODELS.map((m) => m.id),
      },
    },
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check' },
      {
        method: 'GET',
        path: '/models',
        description: 'List available models (filtered by API key permissions)',
      },
      {
        method: 'GET',
        path: '/v1/models',
        description: 'OpenAI-compatible models list (filtered by API key permissions)',
      },
      {
        method: 'POST',
        path: '/api/chat',
        description: 'Direct Chat API (supports streaming & multi-turn)',
      },
      {
        method: 'POST',
        path: '/v1/chat/completions',
        description: 'OpenAI-compatible Chat Completion API with scope enforcement',
      },
    ],
    features: [
      'Isolated API Keys for Antigravity vs llama.cpp for maximum safety and quota control',
      'Multi-provider routing: Google Antigravity & llama.cpp',
      'Real-time streaming via Server-Sent Events (SSE)',
      '100% OpenAI Client compatibility (NextChat, Chatbox, Cursor, LangChain)',
      'Automatic fallback between llama-server HTTP API and direct llama CLI execution',
    ],
  });
});

// Health check
app.get('/health', async (c) => {
  const llamaServerUp = await isLlamaServerReachable();
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    providers: {
      agy: true,
      llamacpp_server: llamaServerUp,
    },
  });
});

// Model list (filtered by client authorization scope)
app.get('/models', async (c) => {
  const scope = c.get('authScope');
  const allModels = await getAllAvailableModels();
  const models = allModels.filter((m) => isScopeAllowedForProvider(scope, m.provider));
  return c.json({ models });
});

app.get('/v1/models', async (c) => {
  const scope = c.get('authScope');
  const allModels = await getAllAvailableModels();
  const models = allModels.filter((m) => isScopeAllowedForProvider(scope, m.provider));
  return c.json({
    object: 'list',
    data: models.map((m) => ({
      id: m.id,
      object: 'model',
      created: 1793568000,
      owned_by: m.provider === 'llamacpp' ? 'llama.cpp' : 'google-antigravity',
      name: m.name,
      description: m.description,
      provider: m.provider,
    })),
  });
});

// Direct Chat API
app.post('/api/chat', async (c) => {
  const body = await c.req.json<ChatRequest>().catch(() => null);

  if (!body || !body.prompt) {
    return c.json({ error: 'Missing required field: prompt' }, 400);
  }

  const isLlama = isLlamaCppTarget(body.model, body.provider);
  const targetProvider: 'agy' | 'llamacpp' = isLlama ? 'llamacpp' : 'agy';
  const scope = c.get('authScope');

  if (!isScopeAllowedForProvider(scope, targetProvider)) {
    return c.json(
      {
        error: {
          message: getForbiddenMessage(scope, targetProvider),
          type: 'permission_denied',
          code: 'forbidden_provider',
        },
      },
      403
    );
  }

  // Streaming response
  if (body.stream) {
    return streamSSE(c, async (stream) => {
      const onDelta = async (delta: string) => {
        await stream.writeSSE({
          event: 'delta',
          data: JSON.stringify({ text: delta }),
        });
      };

      const onDone = async (result: any) => {
        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify(result),
        });
      };

      const onError = async (error: string) => {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ error }),
        });
      };

      if (isLlama) {
        await executeLlamaCppStream(body, onDelta, onDone, onError);
      } else {
        await executeAgyStream(body, onDelta, onDone, onError);
      }
    });
  }

  // Non-streaming response
  const result = isLlama ? await executeLlamaCpp(body) : await executeAgy(body);
  return c.json(result);
});

// OpenAI-Compatible Chat Completions API
app.post('/v1/chat/completions', async (c) => {
  const body = await c.req.json<OpenAIChatRequest>().catch(() => null);

  if (!body || !body.messages || body.messages.length === 0) {
    return c.json({ error: 'Missing required field: messages' }, 400);
  }

  const prompt = messagesToPrompt(body.messages);
  const isLlama = isLlamaCppTarget(body.model, body.provider);
  const targetProvider: 'agy' | 'llamacpp' = isLlama ? 'llamacpp' : 'agy';
  const scope = c.get('authScope');

  // Verify key permissions for targeted provider
  if (!isScopeAllowedForProvider(scope, targetProvider)) {
    return c.json(
      {
        error: {
          message: getForbiddenMessage(scope, targetProvider),
          type: 'permission_denied',
          code: 'forbidden_provider',
        },
      },
      403
    );
  }

  const model =
    body.model ||
    (isLlama
      ? 'qwen3.5-0.8b'
      : process.env.DEFAULT_PROVIDER === 'llamacpp'
      ? 'qwen3.5-0.8b'
      : 'gemini-3.8-flash-high');
  const reqId = `chatcmpl-${randomUUID()}`;

  // Streaming Response
  if (body.stream) {
    return streamSSE(c, async (stream) => {
      // Send initial role chunk
      await stream.writeSSE({
        data: JSON.stringify(
          formatOpenAIChunk(reqId, model, '', null, 'assistant')
        ),
      });

      const onDelta = async (delta: string) => {
        await stream.writeSSE({
          data: JSON.stringify(formatOpenAIChunk(reqId, model, delta, null)),
        });
      };

      const onDone = async () => {
        await stream.writeSSE({
          data: JSON.stringify(formatOpenAIChunk(reqId, model, '', 'stop')),
        });
        await stream.writeSSE({
          data: '[DONE]',
        });
      };

      const onError = async (error: string) => {
        await stream.writeSSE({
          data: JSON.stringify({
            error: {
              message: error,
              type: isLlama ? 'llamacpp_error' : 'internal_error',
            },
          }),
        });
        await stream.writeSSE({
          data: '[DONE]',
        });
      };

      const chatReq: ChatRequest = {
        prompt,
        model,
        stream: true,
        temperature: body.temperature,
        max_tokens: body.max_tokens,
      };

      if (isLlama) {
        await executeLlamaCppStream(chatReq, onDelta, onDone, onError);
      } else {
        await executeAgyStream(chatReq, onDelta, onDone, onError);
      }
    });
  }

  // Non-streaming Response
  const chatReq: ChatRequest = {
    prompt,
    model,
    stream: false,
    temperature: body.temperature,
    max_tokens: body.max_tokens,
  };

  const result = isLlama
    ? await executeLlamaCpp(chatReq)
    : await executeAgy(chatReq);

  if (!result.success && result.error) {
    return c.json(
      {
        error: {
          message: result.error,
          type: isLlama ? 'llamacpp_error' : 'agy_error',
        },
      },
      500
    );
  }

  return c.json(
    formatOpenAIResponse(reqId, model, result.response, result.usage)
  );
});

const port = Number(process.env.PORT) || 8060;
const host = process.env.HOST || '0.0.0.0';

serve(
  {
    fetch: app.fetch,
    port,
    hostname: host,
  },
  (info) => {
    console.log(
      `🚀 agy-rest server running on http://${info.address}:${info.port}`
    );
  }
);
