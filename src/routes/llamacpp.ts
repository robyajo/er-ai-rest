import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getForbiddenMessage, isScopeAllowedForProvider } from '../auth.js';
import {
  executeLlamaCpp,
  executeLlamaCppStream,
  fetchLlamaDynamicModels,
  forwardLlamaChatCompletions,
  forwardLlamaCompletions,
  forwardLlamaGet,
  forwardLlamaNativeCompletion,
  isLlamaServerReachable,
  scanAllLocalGgufFiles,
} from '../llamacpp.js';
import type { AuthScope, ChatRequest } from '../types.js';

type Env = {
  Variables: {
    authScope: AuthScope;
  };
};

export const llamaRouter = new Hono<Env>();

// Check auth scope specifically for llama.cpp provider
llamaRouter.use('*', async (c, next) => {
  const scope = c.get('authScope');
  if (!isScopeAllowedForProvider(scope, 'llamacpp')) {
    return c.json(
      {
        error: {
          message: getForbiddenMessage(scope, 'llamacpp'),
          type: 'permission_denied',
          code: 'forbidden_provider',
        },
      },
      403
    );
  }
  return next();
});

// GET /llama/status (Check server & local discovery)
llamaRouter.get('/status', async (c) => {
  const reachable = await isLlamaServerReachable();
  const localFiles = scanAllLocalGgufFiles();
  return c.json({
    status: 'ok',
    mode: reachable ? 'server_connected' : 'cli_fallback',
    server_reachable: reachable,
    local_gguf_count: localFiles.length,
    local_files: localFiles,
  });
});

// GET /llama/models (Dynamic models discovery)
llamaRouter.get('/models', async (c) => {
  const fresh = c.req.query('fresh') === 'true';
  const models = await fetchLlamaDynamicModels(fresh);
  return c.json({
    total: models.length,
    source: 'llama_dynamic_discovery',
    models,
  });
});

// GET /llama/v1/models (OpenAI format, dynamic)
llamaRouter.get('/v1/models', async (c) => {
  const fresh = c.req.query('fresh') === 'true';
  const models = await fetchLlamaDynamicModels(fresh);
  return c.json({
    object: 'list',
    data: models.map((m) => ({
      id: m.id,
      object: 'model',
      created: 1793568000,
      owned_by: 'llama.cpp',
      name: m.name,
      description: m.description,
      provider: 'llamacpp',
    })),
  });
});

// GET /llama/props (Server diagnostic props)
llamaRouter.get('/props', async (c) => {
  return forwardLlamaGet(c, '/props');
});

// GET /llama/slots (Server slot allocation diagnostic)
llamaRouter.get('/slots', async (c) => {
  return forwardLlamaGet(c, '/slots');
});

// POST /llama/api/chat (Simplified custom JSON chat API)
llamaRouter.post('/api/chat', async (c) => {
  const body = await c.req.json<ChatRequest>().catch(() => null);

  if (!body || !body.prompt) {
    return c.json({ error: 'Missing required field: prompt' }, 400);
  }

  const chatReq: ChatRequest = { ...body, provider: 'llamacpp' };

  if (chatReq.stream) {
    return streamSSE(c, async (stream) => {
      await executeLlamaCppStream(
        chatReq,
        async (delta) => {
          await stream.writeSSE({
            event: 'delta',
            data: JSON.stringify({ text: delta }),
          });
        },
        async (result) => {
          await stream.writeSSE({
            event: 'done',
            data: JSON.stringify(result),
          });
        },
        async (error) => {
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({ error }),
          });
        }
      );
    });
  }

  const result = await executeLlamaCpp(chatReq);
  return c.json(result);
});

// POST /llama/v1/chat/completions (OpenAI Chat Completions - High Speed Streaming/Non-Streaming)
llamaRouter.post('/v1/chat/completions', async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body || !body.messages || body.messages.length === 0) {
    return c.json({ error: 'Missing required field: messages' }, 400);
  }

  return forwardLlamaChatCompletions(c, body);
});

// POST /llama/v1/completions (OpenAI Legacy Text Completions - High Speed Streaming/Non-Streaming)
llamaRouter.post('/v1/completions', async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body || (body.prompt === undefined && body.prompt === null)) {
    return c.json({ error: 'Missing required field: prompt' }, 400);
  }

  return forwardLlamaCompletions(c, body);
});

// POST /llama/completion (Native llama.cpp completion API)
llamaRouter.post('/completion', async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json({ error: 'Missing request body' }, 400);
  }

  return forwardLlamaNativeCompletion(c, body);
});
