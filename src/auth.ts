import type { Context } from 'hono';
import type { AuthResult, AuthScope } from './types.js';

export function getClientToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization');
  return (
    authHeader?.replace(/^Bearer\s+/i, '') ||
    c.req.header('x-api-key') ||
    c.req.header('api-key') ||
    null
  );
}

export function verifyClientToken(token: string | null): AuthResult {
  const masterKey = process.env.API_KEY || process.env.MASTER_API_KEY;
  const agyKey = process.env.AGY_API_KEY || process.env.API_KEY_AGY;
  const llamaKey =
    process.env.LLAMA_API_KEY ||
    process.env.API_KEY_LLAMA ||
    process.env.LLAMACPP_API_KEY;

  const anyAuthEnabled = Boolean(masterKey || agyKey || llamaKey);
  if (!anyAuthEnabled) {
    return { authenticated: true, scope: 'all' };
  }

  if (!token) {
    return {
      authenticated: false,
      error: 'Unauthorized: Missing API key',
      statusCode: 401,
    };
  }

  if (masterKey && token === masterKey) {
    return { authenticated: true, scope: 'all' };
  }

  if (agyKey && token === agyKey) {
    return { authenticated: true, scope: 'agy' };
  }

  if (llamaKey && token === llamaKey) {
    return { authenticated: true, scope: 'llamacpp' };
  }

  return {
    authenticated: false,
    error: 'Unauthorized: Invalid API key',
    statusCode: 401,
  };
}

export function isScopeAllowedForProvider(
  scope: AuthScope | undefined,
  targetProvider: 'agy' | 'llamacpp'
): boolean {
  if (!scope || scope === 'all') return true;
  return scope === targetProvider;
}

export function getForbiddenMessage(
  scope: AuthScope,
  targetProvider: 'agy' | 'llamacpp'
): string {
  if (scope === 'llamacpp' && targetProvider === 'agy') {
    return 'Forbidden: Your API key is restricted to llama.cpp (local models) and cannot access Antigravity (cloud) models.';
  }
  if (scope === 'agy' && targetProvider === 'llamacpp') {
    return 'Forbidden: Your API key is restricted to Antigravity models and cannot access llama.cpp (local models).';
  }
  return 'Forbidden: Access to this provider is not permitted with your API key.';
}
