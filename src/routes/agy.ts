import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { randomUUID } from 'node:crypto';
import {
  executeAgy,
  executeAgyStream,
  fetchAgyDynamicModels,
  SUPPORTED_MODELS,
} from '../agy.js';
import { getForbiddenMessage, isScopeAllowedForProvider } from '../auth.js';
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

export const agyRouter = new Hono<Env>();

// Check auth scope specifically for Antigravity provider
agyRouter.use('*', async (c, next) => {
  const scope = c.get('authScope');
  if (!isScopeAllowedForProvider(scope, 'agy')) {
    return c.json(
      {
        error: {
          message: getForbiddenMessage(scope, 'agy'),
          type: 'permission_denied',
          code: 'forbidden_provider',
        },
      },
      403
    );
  }
  return next();
});

// GET /agy/models (Dynamic query from CLI)
agyRouter.get('/models', async (c) => {
  const fresh = c.req.query('fresh') === 'true';
  const models = await fetchAgyDynamicModels(fresh);
  return c.json({
    total: models.length,
    source: 'antigravity_cli_live_discovery',
    models,
  });
});

// GET /agy/v1/models (OpenAI format, dynamic)
agyRouter.get('/v1/models', async (c) => {
  const fresh = c.req.query('fresh') === 'true';
  const models = await fetchAgyDynamicModels(fresh);
  return c.json({
    object: 'list',
    data: models.map((m) => ({
      id: m.id,
      object: 'model',
      created: 1793568000,
      owned_by: 'google-antigravity',
      name: m.name,
      description: m.description,
      provider: 'agy',
    })),
  });
});

// POST /agy/api/chat
agyRouter.post('/api/chat', async (c) => {
  const body = await c.req.json<ChatRequest>().catch(() => null);

  if (!body || !body.prompt) {
    return c.json({ error: 'Missing required field: prompt' }, 400);
  }

  // Force agy provider
  const chatReq: ChatRequest = { ...body, provider: 'agy' };

  if (chatReq.stream) {
    return streamSSE(c, async (stream) => {
      await executeAgyStream(
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

  const result = await executeAgy(chatReq);
  return c.json(result);
});

// POST /agy/v1/chat/completions
agyRouter.post('/v1/chat/completions', async (c) => {
  const body = await c.req.json<OpenAIChatRequest>().catch(() => null);

  if (!body || !body.messages || body.messages.length === 0) {
    return c.json({ error: 'Missing required field: messages' }, 400);
  }

  const prompt = messagesToPrompt(body.messages);
  const model = body.model || 'gemini-3.8-flash-high';
  const reqId = `chatcmpl-${randomUUID()}`;

  if (body.stream) {
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        data: JSON.stringify(
          formatOpenAIChunk(reqId, model, '', null, 'assistant')
        ),
      });

      await executeAgyStream(
        { prompt, model, stream: true },
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
              error: { message: error, type: 'internal_error' },
            }),
          });
          await stream.writeSSE({
            data: '[DONE]',
          });
        }
      );
    });
  }

  const result = await executeAgy({ prompt, model, stream: false });

  if (!result.success && result.error) {
    return c.json(
      {
        error: {
          message: result.error,
          type: 'agy_error',
        },
      },
      500
    );
  }

  return c.json(
    formatOpenAIResponse(reqId, model, result.response, result.usage)
  );
});
