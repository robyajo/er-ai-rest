import { loadEnvFile } from 'node:process';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getClientToken, verifyClientToken } from './auth.js';
import { agyRouter, gatewayRouter, llamaRouter } from './routes/index.js';
import type { AuthScope } from './types.js';

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

// Mount Modular Route Handlers
app.route('/agy', agyRouter);
app.route('/llama', llamaRouter);
app.route('/', gatewayRouter);

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
