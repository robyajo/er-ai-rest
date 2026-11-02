import { loadEnvFile } from 'node:process';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { randomUUID } from 'node:crypto';
import { executeAgy, executeAgyStream, SUPPORTED_MODELS } from './agy.js';
import { formatOpenAIChunk, formatOpenAIResponse, messagesToPrompt } from './openai.js';
import type { ChatRequest, OpenAIChatRequest } from './types.js';

// Auto-load .env file if present
try {
  loadEnvFile();
} catch {
  // .env file not found or already provided via environment
}

const app = new Hono();

// Enable CORS for all routes
app.use('*', cors());

// API Key Authentication Middleware
app.use('*', async (c, next) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return next();

  if (c.req.path === '/' || c.req.path === '/health') {
    return next();
  }

  const authHeader = c.req.header('Authorization');
  const token =
    authHeader?.replace(/^Bearer\s+/i, '') ||
    c.req.header('x-api-key') ||
    c.req.header('api-key');

  if (!token || token !== apiKey) {
    return c.json(
      {
        error: {
          message: 'Unauthorized: Invalid or missing API key',
          type: 'invalid_request_error',
          code: 'invalid_api_key',
        },
      },
      401
    );
  }

  // Token cocok, lanjutkan request
  return next();
});

// Root: API Documentation & Status
app.get('/', (c) => {
  return c.json({
    service: 'agy-rest',
    description: 'REST & OpenAI-compatible API gateway for Antigravity CLI (agy)',
    version: '1.0.0',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'GET', path: '/models', description: 'List available models' },
      { method: 'GET', path: '/v1/models', description: 'OpenAI-compatible models list' },
      { method: 'POST', path: '/api/chat', description: 'Antigravity Chat API (supports streaming & multi-turn)' },
      { method: 'POST', path: '/v1/chat/completions', description: 'OpenAI-compatible Chat Completion API' },
    ],
    features: [
      'Multi-model support (Gemini, Claude, GPT-OSS)',
      'Real-time streaming via SSE',
      'OpenAI Client compatibility (NextChat, Chatbox, Cursor, LangChain)',
      'Multi-turn conversation resumption via conversation_id',
    ],
  });
});

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Model list
app.get('/models', (c) => c.json({ models: SUPPORTED_MODELS }));

app.get('/v1/models', (c) => {
  return c.json({
    object: 'list',
    data: SUPPORTED_MODELS.map((m) => ({
      id: m.id,
      object: 'model',
      created: 1793568000,
      owned_by: 'google-antigravity',
      name: m.name,
    })),
  });
});

// Direct Antigravity Chat API
app.post('/api/chat', async (c) => {
  const body = await c.req.json<ChatRequest>().catch(() => null);

  if (!body || !body.prompt) {
    return c.json({ error: 'Missing required field: prompt' }, 400);
  }

  // Streaming response
  if (body.stream) {
    return streamSSE(c, async (stream) => {
      await executeAgyStream(
        body,
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

  // Non-streaming response
  const result = await executeAgy(body);
  return c.json(result);
});

// OpenAI-Compatible Chat Completions API
app.post('/v1/chat/completions', async (c) => {
  const body = await c.req.json<OpenAIChatRequest>().catch(() => null);

  if (!body || !body.messages || body.messages.length === 0) {
    return c.json({ error: 'Missing required field: messages' }, 400);
  }

  const prompt = messagesToPrompt(body.messages);
  const model = body.model || 'gemini-3.8-flash-high';
  const reqId = `chatcmpl-${randomUUID()}`;

  // Streaming Response
  if (body.stream) {
    return streamSSE(c, async (stream) => {
      // Send initial role chunk
      await stream.writeSSE({
        data: JSON.stringify(formatOpenAIChunk(reqId, model, '', null, 'assistant')),
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
            data: JSON.stringify({ error: { message: error, type: 'internal_error' } }),
          });
          await stream.writeSSE({
            data: '[DONE]',
          });
        }
      );
    });
  }

  // Non-streaming Response
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

  return c.json(formatOpenAIResponse(reqId, model, result.response, result.usage));
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
    console.log(`🚀 agy-rest server running on http://${info.address}:${info.port}`);
  }
);
