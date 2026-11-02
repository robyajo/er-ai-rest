import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { randomUUID } from 'node:crypto';
import { getForbiddenMessage, isScopeAllowedForProvider } from '../auth.js';
import {
  executeLlamaCpp,
  executeLlamaCppStream,
  fetchLlamaDynamicModels,
  isLlamaServerReachable,
  scanAllLocalGgufFiles,
} from '../llamacpp.js';
import {
  formatOpenAIChunk,
  formatOpenAIResponse,
  messagesToPrompt,
} from '../openai.js';
import type { AuthScope, ChatRequest, OpenAIChatRequest } from '../types.js';

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

// POST /llama/api/chat
llamaRouter.post('/api/chat', async (c) => {
  const body = await c.req.json<ChatRequest>().catch(() => null);

  if (!body || !body.prompt) {
    return c.json({ error: 'Missing required field: prompt' }, 400);
  }

  // Force llamacpp provider
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

// POST /llama/v1/chat/completions
llamaRouter.post('/v1/chat/completions', async (c) => {
  const body = await c.req.json<OpenAIChatRequest>().catch(() => null);

  if (!body || !body.messages || body.messages.length === 0) {
    return c.json({ error: 'Missing required field: messages' }, 400);
  }

  const prompt = messagesToPrompt(body.messages);
  const model = body.model || 'qwen3.5-0.8b';
  const reqId = `chatcmpl-${randomUUID()}`;

  const chatReq: ChatRequest = {
    prompt,
    messages: body.messages,
    chat_template_kwargs: body.chat_template_kwargs,
    model,
    provider: 'llamacpp',
    stream: body.stream ?? false,
    temperature: body.temperature,
    max_tokens: body.max_tokens,
  };

  if (body.stream) {
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        data: JSON.stringify(
          formatOpenAIChunk(reqId, model, '', null, 'assistant')
        ),
      });

      await executeLlamaCppStream(
        chatReq,
        async (delta) => {
          await stream.writeSSE({
            data: JSON.stringify(formatOpenAIChunk(reqId, model, delta, null)),
          });
        },
        async () => {
          await stream.writeSSE({
            data: JSON.stringify(formatOpenAIChunk(reqId, model, '', 'stop')),
          });
          await stream.writeSSE({
            data: '[DONE]',
          });
        },
        async (error) => {
          await stream.writeSSE({
            data: JSON.stringify({
              error: { message: error, type: 'llamacpp_error' },
            }),
          });
          await stream.writeSSE({
            data: '[DONE]',
          });
        }
      );
    });
  }

  const result = await executeLlamaCpp(chatReq);

  if (!result.success && result.error) {
    return c.json(
      {
        error: {
          message: result.error,
          type: 'llamacpp_error',
        },
      },
      500
    );
  }

  return c.json(
    formatOpenAIResponse(reqId, model, result.response, result.usage)
  );
});
