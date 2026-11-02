import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { randomUUID } from 'node:crypto';
import {
  executeAgy,
  executeAgyStream,
  fetchAgyDynamicModels,
} from '../agy.js';
import { getForbiddenMessage, isScopeAllowedForProvider } from '../auth.js';
import {
  executeLlamaCpp,
  executeLlamaCppStream,
  fetchLlamaDynamicModels,
  isLlamaCppTarget,
  isLlamaServerReachable,
  scanAllLocalGgufFiles,
} from '../llamacpp.js';
import {
  formatOpenAIChunk,
  formatOpenAIResponse,
  messagesToPrompt,
} from '../openai.js';
import type { AuthScope, ChatRequest, ModelInfo, OpenAIChatRequest } from '../types.js';

type Env = {
  Variables: {
    authScope: AuthScope;
  };
};

export const gatewayRouter = new Hono<Env>();

// Helper: Dynamically discover all live models from Antigravity and llama.cpp
export async function getAllAvailableModels(fresh = false): Promise<ModelInfo[]> {
  const [agyModels, llamaModels] = await Promise.all([
    fetchAgyDynamicModels(fresh),
    fetchLlamaDynamicModels(fresh),
  ]);

  const modelsMap = new Map<string, ModelInfo>();
  for (const m of agyModels) {
    modelsMap.set(m.id, m);
  }
  for (const m of llamaModels) {
    modelsMap.set(m.id, m);
  }

  return Array.from(modelsMap.values());
}

// GET / — Service Info & Architecture Overview
gatewayRouter.get('/', async (c) => {
  const llamaServerUp = await isLlamaServerReachable();
  const localGgufs = scanAllLocalGgufFiles();

  return c.json({
    service: 'agy-rest',
    description:
      'Dynamic multi-engine REST & OpenAI-compatible API gateway for Antigravity (Cloud) & llama.cpp (Local GGUF)',
    version: '1.4.0',
    modules: {
      antigravity: {
        route_prefix: '/agy',
        description: 'Dedicated Antigravity endpoints (Live CLI models discovery)',
        endpoints: [
          'GET /agy/models',
          'GET /agy/v1/models',
          'POST /agy/api/chat',
          'POST /agy/v1/chat/completions',
        ],
      },
      llamacpp: {
        route_prefix: '/llama',
        description: 'Dedicated llama.cpp endpoints (Filesystem GGUF & server auto-discovery)',
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
        description: 'Unified smart gateway with dynamic model resolution',
        endpoints: [
          'GET /models',
          'GET /v1/models',
          'GET /api/models',
          'POST /api/chat',
          'POST /v1/chat/completions',
        ],
      },
    },
    auth_modes: {
      master_key: 'Grants access to all models (Antigravity & llama.cpp)',
      agy_api_key: 'Restricted strictly to Antigravity (/agy and cloud models)',
      llama_api_key: 'Restricted strictly to llama.cpp (/llama and local models)',
    },
    engines: {
      antigravity: {
        status: 'available',
        discovery: 'dynamic_cli_detection',
      },
      llamacpp: {
        status: llamaServerUp ? 'server_connected' : 'cli_mode',
        discovery: 'filesystem_gguf_scan',
        local_files_detected: localGgufs.length,
      },
    },
  });
});

// GET /health — Health check
gatewayRouter.get('/health', async (c) => {
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

// GET /api/models — Comprehensive Dynamic Model Breakdown
gatewayRouter.get('/api/models', async (c) => {
  const fresh = c.req.query('fresh') === 'true';
  const scope = c.get('authScope');
  const allModels = await getAllAvailableModels(fresh);
  const models = allModels.filter((m) => isScopeAllowedForProvider(scope, m.provider));

  const agyCount = models.filter((m) => m.provider === 'agy').length;
  const llamaCount = models.filter((m) => m.provider === 'llamacpp').length;

  return c.json({
    total: models.length,
    timestamp: new Date().toISOString(),
    auth_scope: scope,
    breakdown: {
      antigravity: { count: agyCount, source: 'agy_models_cli_live' },
      llamacpp: { count: llamaCount, source: 'local_gguf_filesystem_scan' },
    },
    models,
  });
});

// GET /models — Unified Model list (filtered dynamically by auth scope)
gatewayRouter.get('/models', async (c) => {
  const fresh = c.req.query('fresh') === 'true';
  const scope = c.get('authScope');
  const allModels = await getAllAvailableModels(fresh);
  const models = allModels.filter((m) => isScopeAllowedForProvider(scope, m.provider));
  return c.json({ total: models.length, models });
});

// GET /v1/models — OpenAI-Compatible Models list
gatewayRouter.get('/v1/models', async (c) => {
  const fresh = c.req.query('fresh') === 'true';
  const scope = c.get('authScope');
  const allModels = await getAllAvailableModels(fresh);
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

// POST /api/chat — Unified Direct Chat API
gatewayRouter.post('/api/chat', async (c) => {
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

  const result = isLlama ? await executeLlamaCpp(body) : await executeAgy(body);
  return c.json(result);
});

// POST /v1/chat/completions — Unified OpenAI-Compatible Chat Completions API
gatewayRouter.post('/v1/chat/completions', async (c) => {
  const body = await c.req.json<OpenAIChatRequest>().catch(() => null);

  if (!body || !body.messages || body.messages.length === 0) {
    return c.json({ error: 'Missing required field: messages' }, 400);
  }

  const prompt = messagesToPrompt(body.messages);
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

  const model =
    body.model ||
    (isLlama ? 'qwen3.5-0.8b' : 'gemini-3.8-flash-high');
  const reqId = `chatcmpl-${randomUUID()}`;

  if (body.stream) {
    return streamSSE(c, async (stream) => {
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
