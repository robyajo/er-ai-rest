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
import { agyRouter } from './routes/agy.js';
import { llamaRouter } from './routes/llamacpp.js';
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

// Mount Modular Prefixed Routers
app.route('/agy', agyRouter);
app.route('/llama', llamaRouter);

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
      'Modular REST & OpenAI-compatible API gateway with isolated authentication for Antigravity (Cloud) & llama.cpp (Local GGUF)',
    version: '1.3.0',
    modules: {
      antigravity: {
        route_prefix: '/agy',
        description: 'Dedicated Antigravity endpoints (Gemini, Claude, GPT-OSS)',
        endpoints: [
          'GET /agy/models',
          'GET /agy/v1/models',
          'POST /agy/api/chat',
          'POST /agy/v1/chat/completions',
        ],
      },
      llamacpp: {
        route_prefix: '/llama',
        description: 'Dedicated llama.cpp endpoints (Local GGUF models)',
        endpoints: [
          'GET /llama/models',
          'GET /llama/v1/models',
          'GET /llama/status',
          'POST /llama/api/chat',
          'POST /llama/v1/chat/completions',
        ],
      },
      unified_gateway: {
        route_prefix: '/',
        description: 'Unified smart gateway routing to both providers automatically based on model',
        endpoints: [
          'GET /models',
          'GET /v1/models',
          'POST /api/chat',
          'POST /v1/chat/completions',
        ],
      },
    },
    auth_modes: {
      master_key: 'Grants access to both Antigravity & llama.cpp models',
      agy_api_key: 'Restricted strictly to Antigravity (/agy and cloud models)',
      llama_api_key: 'Restricted strictly to llama.cpp (/llama and local models)',
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

// Unified Model list (filtered by client authorization scope)
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

// Unified Direct Chat API
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

// Unified OpenAI-Compatible Chat Completions API
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
