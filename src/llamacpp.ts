import type { Context } from 'hono';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import type {
  ChatRequest,
  ChatResponse,
  ModelInfo,
} from './types.js';

export const SUPPORTED_LLAMA_MODELS: ModelInfo[] = [
  {
    id: 'Qwen3.5-0.8B-Q8_0',
    name: 'Qwen 3.5 0.8B Q8_0 (Active Llama Server)',
    provider: 'llamacpp',
    description: 'Active high-speed reasoning model on llama.cpp server',
  },
  {
    id: 'qwen3.5-0.8b',
    name: 'Qwen 3.5 0.8B (Alias)',
    provider: 'llamacpp',
    description: 'Lightweight local GGUF model alias',
  },
  {
    id: 'llama-3.2-1b',
    name: 'Llama 3.2 1B Instruct (Local GGUF)',
    provider: 'llamacpp',
    description: 'Compact Meta Llama 3.2 instruction model',
  },
  {
    id: 'llama-3.2-3b',
    name: 'Llama 3.2 3B Instruct (Local GGUF)',
    provider: 'llamacpp',
    description: 'Balanced Meta Llama 3.2 instruction model',
  },
  {
    id: 'mistral-7b',
    name: 'Mistral 7B Instruct (Local GGUF)',
    provider: 'llamacpp',
    description: 'Powerful general instruction model',
  },
  {
    id: 'deepseek-r1-distill-qwen-7b',
    name: 'DeepSeek R1 Distill Qwen 7B (Local GGUF)',
    provider: 'llamacpp',
    description: 'Reasoning-focused local GGUF model',
  },
  {
    id: 'local-gguf',
    name: 'Default Local GGUF Model',
    provider: 'llamacpp',
    description: 'Configured local GGUF model file',
  },
];

/**
 * Check if the model or request targets llama.cpp
 */
export function isLlamaCppTarget(model?: string, provider?: string): boolean {
  if (provider === 'llamacpp' || provider === 'llama') return true;
  if (provider === 'agy') return false;

  if (!model) {
    return false;
  }

  const m = model.toLowerCase();
  return (
    m.startsWith('llama-') ||
    m.startsWith('llama/') ||
    m.startsWith('llamacpp/') ||
    m.startsWith('gguf:') ||
    m.startsWith('local:') ||
    m.startsWith('qwen') ||
    m.startsWith('mistral') ||
    m.startsWith('deepseek') ||
    m.startsWith('phi') ||
    m.startsWith('gemma') ||
    m.endsWith('.gguf') ||
    m === 'local-gguf' ||
    m === 'default'
  );
}

export function getLlamaServerUrl(): string {
  return (
    process.env.LLAMA_CPP_BASE_URL ||
    process.env.LLAMA_SERVER_URL ||
    process.env.LLAMA_BASE_URL ||
    'http://127.0.0.1:9931'
  ).replace(/\/+$/, '');
}

export function getLlamaBinary(): string {
  if (process.env.LLAMA_BIN && existsSync(process.env.LLAMA_BIN)) {
    return process.env.LLAMA_BIN;
  }
  if (process.env.LLAMA_PATH && existsSync(process.env.LLAMA_PATH)) {
    return process.env.LLAMA_PATH;
  }

  const userHome = homedir();
  const candidatePaths = [
    join(userHome, '.local/bin/llama'),
    join(userHome, '.llama-app/llama'),
    '/usr/local/bin/llama',
    '/opt/homebrew/bin/llama',
    '/usr/local/bin/llama-cli',
    '/opt/homebrew/bin/llama-cli',
  ];

  for (const p of candidatePaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return 'llama';
}

export function getLlamaModelPath(requestedModel?: string): string {
  if (requestedModel && existsSync(requestedModel)) {
    return requestedModel;
  }
  if (
    process.env.LLAMA_MODEL_PATH &&
    existsSync(process.env.LLAMA_MODEL_PATH)
  ) {
    return process.env.LLAMA_MODEL_PATH;
  }

  const userHome = homedir();
  const searchDirs = [
    join(userHome, '.cache/huggingface/hub'),
    join(userHome, '.cache'),
    join(userHome, 'models'),
    join(userHome, '.llama-app/models'),
  ];

  const keyword =
    requestedModel && requestedModel !== 'local-gguf'
      ? requestedModel.toLowerCase()
      : undefined;

  for (const dir of searchDirs) {
    if (existsSync(dir)) {
      try {
        const found = findGgufFileRecursive(dir, 8, keyword);
        if (found) return found;
      } catch {}
    }
  }

  if (keyword) {
    for (const dir of searchDirs) {
      if (existsSync(dir)) {
        try {
          const found = findGgufFileRecursive(dir, 8);
          if (found) return found;
        } catch {}
      }
    }
  }

  return '';
}

function findGgufFileRecursive(
  dir: string,
  maxDepth: number,
  keyword?: string
): string | null {
  if (maxDepth <= 0) return null;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (
      (entry.isFile() || entry.isSymbolicLink()) &&
      entry.name.toLowerCase().endsWith('.gguf')
    ) {
      const fullPath = join(dir, entry.name);
      if (
        !keyword ||
        entry.name.toLowerCase().includes(keyword) ||
        fullPath.toLowerCase().includes(keyword)
      ) {
        return fullPath;
      }
    }
  }

  for (const entry of entries) {
    if (
      !entry.name.startsWith('.') &&
      (entry.isDirectory() || entry.isSymbolicLink())
    ) {
      const fullPath = join(dir, entry.name);
      const nested = findGgufFileRecursive(fullPath, maxDepth - 1, keyword);
      if (nested) return nested;
    }
  }

  return null;
}

/**
 * Scan filesystem for all available .gguf files
 */
export function scanAllLocalGgufFiles(): Array<{
  path: string;
  filename: string;
  sizeMb: string;
}> {
  const userHome = homedir();
  const searchDirs = [
    join(userHome, '.cache/huggingface/hub'),
    join(userHome, '.cache'),
    join(userHome, 'models'),
    join(userHome, '.llama-app/models'),
  ];

  if (process.env.LLAMA_MODELS_DIR && existsSync(process.env.LLAMA_MODELS_DIR)) {
    searchDirs.unshift(process.env.LLAMA_MODELS_DIR);
  }

  const results: Array<{ path: string; filename: string; sizeMb: string }> = [];
  const visitedPaths = new Set<string>();

  function walk(dir: string, depth: number) {
    if (depth <= 0 || !existsSync(dir)) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (
          (entry.isFile() || entry.isSymbolicLink()) &&
          entry.name.toLowerCase().endsWith('.gguf')
        ) {
          if (!visitedPaths.has(fullPath)) {
            visitedPaths.add(fullPath);
            let sizeMb = 'unknown';
            try {
              const st = statSync(fullPath);
              sizeMb = `${(st.size / (1024 * 1024)).toFixed(1)} MB`;
            } catch {}
            results.push({ path: fullPath, filename: entry.name, sizeMb });
          }
        } else if (
          !entry.name.startsWith('.') &&
          (entry.isDirectory() || entry.isSymbolicLink())
        ) {
          walk(fullPath, depth - 1);
        }
      }
    } catch {}
  }

  for (const d of searchDirs) {
    walk(d, 8);
  }

  return results;
}

// In-memory model caching to prevent latency on every request
let cachedServerModels: ModelInfo[] = [];
let cachedActiveModelId = 'Qwen3.5-0.8B-Q8_0';
let lastServerModelsFetchTime = 0;
const SERVER_MODELS_CACHE_TTL_MS = 60_000; // 60 seconds

export async function isLlamaServerReachable(): Promise<boolean> {
  const baseUrl = getLlamaServerUrl();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${baseUrl}/v1/models`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchLlamaServerModels(forceFresh = false): Promise<ModelInfo[]> {
  const now = Date.now();
  if (
    !forceFresh &&
    cachedServerModels.length > 0 &&
    now - lastServerModelsFetchTime < SERVER_MODELS_CACHE_TTL_MS
  ) {
    return cachedServerModels;
  }

  const baseUrl = getLlamaServerUrl();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${baseUrl}/v1/models`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return cachedServerModels;
    const data = (await res.json()) as any;
    const modelsList: any[] = data.data || data.models || [];

    const mapped = modelsList.map((m: any) => {
      const id = m.id || m.name || m.model;
      const cleanName = id.split('/').pop()?.replace(/\.gguf$/i, '') || id;
      return {
        id,
        name: `${cleanName} (llama.cpp server)`,
        provider: 'llamacpp' as const,
        description: `Model loaded on active llama.cpp server at ${baseUrl}`,
      };
    });

    if (mapped.length > 0) {
      cachedServerModels = mapped;
      // Set the first loaded model as active default
      const loadedModel = modelsList.find((m: any) => m.status?.value === 'loaded');
      if (loadedModel?.id) {
        cachedActiveModelId = loadedModel.id;
      } else if (mapped[0]?.id) {
        cachedActiveModelId = mapped[0].id;
      }
      lastServerModelsFetchTime = now;
    }

    return mapped;
  } catch {
    return cachedServerModels;
  }
}

/**
 * Resolves requested model alias (e.g. 'qwen3.5-0.8b', 'qwen', 'local-gguf', 'default')
 * to the exact model loaded in llama.cpp router without blocking.
 */
export async function resolveLlamaServerModel(requested?: string): Promise<string> {
  if (!requested || requested === 'default' || requested === 'local-gguf' || requested === 'auto') {
    return cachedActiveModelId || 'Qwen3.5-0.8B-Q8_0';
  }

  const reqLower = requested.toLowerCase();

  // If already matches cached active model
  if (cachedActiveModelId.toLowerCase() === reqLower || cachedActiveModelId === requested) {
    return cachedActiveModelId;
  }

  // Fast mapping for common aliases targeting Qwen
  if (reqLower.includes('qwen') || reqLower.includes('0.8b') || reqLower === 'llama') {
    return cachedActiveModelId || 'Qwen3.5-0.8B-Q8_0';
  }

  // Check known server models cache
  if (cachedServerModels.length > 0) {
    const exact = cachedServerModels.find((m) => m.id === requested);
    if (exact) return exact.id;

    const caseMatch = cachedServerModels.find((m) => m.id.toLowerCase() === reqLower);
    if (caseMatch) return caseMatch.id;

    const partial = cachedServerModels.find(
      (m) =>
        m.id.toLowerCase().includes(reqLower) || reqLower.includes(m.id.toLowerCase())
    );
    if (partial) return partial.id;
  }

  // Asynchronous background refresh if cache is cold
  if (Date.now() - lastServerModelsFetchTime > SERVER_MODELS_CACHE_TTL_MS) {
    fetchLlamaServerModels(true).catch(() => {});
  }

  return cachedActiveModelId || requested;
}

let cachedLlamaModels: ModelInfo[] | null = null;
let lastLlamaFetchTime = 0;
const LLAMA_CACHE_TTL_MS = 30_000;

/**
 * Dynamically queries all available llama.cpp models from:
 * 1. Active llama-server HTTP API
 * 2. Scanned .gguf files on the local filesystem
 * 3. Default known models fallback
 */
export async function fetchLlamaDynamicModels(
  forceFresh = false
): Promise<ModelInfo[]> {
  const now = Date.now();
  if (
    !forceFresh &&
    cachedLlamaModels &&
    now - lastLlamaFetchTime < LLAMA_CACHE_TTL_MS
  ) {
    return cachedLlamaModels;
  }

  const modelsMap = new Map<string, ModelInfo>();

  // 1. Check active llama-server models
  const serverModels = await fetchLlamaServerModels(forceFresh);
  for (const sm of serverModels) {
    modelsMap.set(sm.id, sm);
  }

  // 2. Scan local filesystem for real .gguf files
  const localFiles = scanAllLocalGgufFiles();
  for (const f of localFiles) {
    const rawName = f.filename.replace(/\.gguf$/i, '');
    const cleanId = rawName.toLowerCase().replace(/[^a-z0-9._-]/g, '-');

    modelsMap.set(cleanId, {
      id: cleanId,
      name: `${rawName} (Local GGUF - ${f.sizeMb})`,
      provider: 'llamacpp',
      description: `Discovered on disk: ${f.path} (${f.sizeMb})`,
    });

    // Provide friendly alias without quant suffix
    const baseSlug = cleanId.split(/[-_](q[0-9]|f16|f32)/i)[0];
    if (baseSlug && baseSlug !== cleanId && !modelsMap.has(baseSlug)) {
      modelsMap.set(baseSlug, {
        id: baseSlug,
        name: `${rawName} (Alias - ${f.sizeMb})`,
        provider: 'llamacpp',
        description: `Alias for ${f.filename}`,
      });
    }
  }

  // 3. Include standard templates if no files were found on disk
  if (modelsMap.size === 0) {
    for (const m of SUPPORTED_LLAMA_MODELS) {
      modelsMap.set(m.id, m);
    }
  }

  const results = Array.from(modelsMap.values());
  cachedLlamaModels = results;
  lastLlamaFetchTime = now;
  return results;
}

/**
 * High-performance direct proxy for OpenAI-compatible chat completions.
 * Transparently pipes SSE streams or returns JSON with zero latency and full fidelity.
 */
export async function forwardLlamaChatCompletions(
  c: Context,
  body: any
): Promise<Response> {
  const baseUrl = getLlamaServerUrl();

  // Resolve model to active server model
  body.model = await resolveLlamaServerModel(body.model);

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (body.stream && res.ok && res.body) {
      return new Response(res.body, {
        status: res.status,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const data = await res.json();
    return c.json(data, res.status as any);
  } catch (err: any) {
    return c.json(
      {
        error: {
          message: `Failed to connect to llama.cpp server at ${baseUrl}: ${err.message}`,
          type: 'llamacpp_connection_error',
          code: 'llama_server_unreachable',
        },
      },
      502
    );
  }
}

/**
 * High-performance direct proxy for legacy OpenAI-compatible text completions (/v1/completions).
 */
export async function forwardLlamaCompletions(
  c: Context,
  body: any
): Promise<Response> {
  const baseUrl = getLlamaServerUrl();

  body.model = await resolveLlamaServerModel(body.model);

  try {
    const res = await fetch(`${baseUrl}/v1/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (body.stream && res.ok && res.body) {
      return new Response(res.body, {
        status: res.status,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const data = await res.json();
    return c.json(data, res.status as any);
  } catch (err: any) {
    return c.json(
      {
        error: {
          message: `Failed to connect to llama.cpp server at ${baseUrl}: ${err.message}`,
          type: 'llamacpp_connection_error',
          code: 'llama_server_unreachable',
        },
      },
      502
    );
  }
}

/**
 * Direct proxy for native llama.cpp completion (/completion).
 */
export async function forwardLlamaNativeCompletion(
  c: Context,
  body: any
): Promise<Response> {
  const baseUrl = getLlamaServerUrl();

  body.model = await resolveLlamaServerModel(body.model);

  try {
    const res = await fetch(`${baseUrl}/completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (body.stream && res.ok && res.body) {
      return new Response(res.body, {
        status: res.status,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const data = await res.json();
    return c.json(data, res.status as any);
  } catch (err: any) {
    return c.json(
      {
        error: {
          message: `Failed to connect to llama.cpp server at ${baseUrl}: ${err.message}`,
          type: 'llamacpp_connection_error',
        },
      },
      502
    );
  }
}

/**
 * Proxy for /props and /slots monitoring
 */
export async function forwardLlamaGet(c: Context, path: string): Promise<Response> {
  const baseUrl = getLlamaServerUrl();
  let query = c.req.url.includes('?') ? c.req.url.slice(c.req.url.indexOf('?')) : '';
  if (path === '/slots' && !query.includes('model=')) {
    query = query ? `${query}&model=${encodeURIComponent(cachedActiveModelId)}` : `?model=${encodeURIComponent(cachedActiveModelId)}`;
  }

  try {
    const res = await fetch(`${baseUrl}${path}${query}`);
    const data = await res.json();
    return c.json(data, res.status as any);
  } catch (err: any) {
    return c.json(
      { error: `Failed to query llama.cpp ${path}: ${err.message}` },
      502
    );
  }
}

/**
 * Execute Llama for unified internal ChatRequest (e.g. /api/chat)
 */
export async function executeLlamaCpp(req: ChatRequest): Promise<ChatResponse> {
  // Try HTTP server directly without pre-flight latency
  try {
    return await executeLlamaServerHttp(req);
  } catch (err: any) {
    // Only fall back to CLI if HTTP connection failed
    return executeLlamaCli(req);
  }
}

export async function executeLlamaCppStream(
  req: ChatRequest,
  onDelta: (text: string) => void | Promise<void>,
  onComplete: (result: ChatResponse) => void | Promise<void>,
  onError: (error: string) => void | Promise<void>
): Promise<void> {
  try {
    await executeLlamaServerHttpStream(req, onDelta, onComplete, onError);
  } catch {
    await executeLlamaCliStream(req, onDelta, onComplete, onError);
  }
}

async function executeLlamaServerHttp(req: ChatRequest): Promise<ChatResponse> {
  const baseUrl = getLlamaServerUrl();
  const startTime = Date.now();

  const targetModel = await resolveLlamaServerModel(req.model);
  const payload: Record<string, any> = {
    model: targetModel,
    messages: req.messages && req.messages.length > 0
      ? req.messages
      : [{ role: 'user', content: req.prompt }],
    stream: false,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.max_tokens ?? 2048,
  };

  if (req.chat_template_kwargs) {
    payload.chat_template_kwargs = req.chat_template_kwargs;
  }
  if (req.top_p !== undefined) {
    payload.top_p = req.top_p;
  }
  if (req.stop !== undefined) {
    payload.stop = req.stop;
  }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    return {
      success: false,
      response: '',
      error: `llama.cpp server error (${res.status}): ${errText}`,
      provider: 'llamacpp',
    };
  }

  const data = (await res.json()) as any;
  const msg = data.choices?.[0]?.message;
  // If content is empty (e.g. truncated thinking), fall back to reasoning_content
  const content = msg?.content || msg?.reasoning_content || '';
  const duration_seconds = (Date.now() - startTime) / 1000;

  return {
    success: true,
    response: content,
    duration_seconds,
    num_turns: 1,
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
      total_tokens: data.usage?.total_tokens ?? 0,
    },
    provider: 'llamacpp',
  };
}

async function executeLlamaServerHttpStream(
  req: ChatRequest,
  onDelta: (text: string) => void | Promise<void>,
  onComplete: (result: ChatResponse) => void | Promise<void>,
  onError: (error: string) => void | Promise<void>
): Promise<void> {
  const baseUrl = getLlamaServerUrl();
  const startTime = Date.now();

  const targetModel = await resolveLlamaServerModel(req.model);
  const payload: Record<string, any> = {
    model: targetModel,
    messages: req.messages && req.messages.length > 0
      ? req.messages
      : [{ role: 'user', content: req.prompt }],
    stream: true,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.max_tokens ?? 2048,
  };

  if (req.chat_template_kwargs) {
    payload.chat_template_kwargs = req.chat_template_kwargs;
  }
  if (req.top_p !== undefined) {
    payload.top_p = req.top_p;
  }
  if (req.stop !== undefined) {
    payload.stop = req.stop;
  }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text();
    await onError(
      `llama.cpp server stream error (${res.status}): ${errText}`
    );
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;

      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6).trim();
        if (jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const delta =
            parsed.choices?.[0]?.delta?.content ??
            parsed.choices?.[0]?.delta?.reasoning_content;
          if (delta) {
            fullResponse += delta;
            await onDelta(delta);
          }
        } catch {}
      }
    }
  }

  const duration_seconds = (Date.now() - startTime) / 1000;
  await onComplete({
    success: true,
    response: fullResponse,
    duration_seconds,
    num_turns: 1,
    provider: 'llamacpp',
  });
}

function buildCliArgs(req: ChatRequest): {
  binary: string;
  args: string[];
  error?: string;
} {
  const binary = getLlamaBinary();
  const modelPath = getLlamaModelPath(req.model);

  if (!modelPath) {
    return {
      binary,
      args: [],
      error:
        'No GGUF model found. Please specify LLAMA_MODEL_PATH in .env or start llama.cpp server via `llama serve -m <model.gguf>`',
    };
  }

  const args: string[] = [
    'completion',
    '-m',
    modelPath,
    '-p',
    req.prompt,
    '-no-cnv',
    '--no-display-prompt',
  ];

  if (req.max_tokens) {
    args.push('-n', String(req.max_tokens));
  } else {
    args.push('-n', '2048');
  }

  if (req.temperature !== undefined) {
    args.push('--temp', String(req.temperature));
  }

  return { binary, args };
}

async function executeLlamaCli(req: ChatRequest): Promise<ChatResponse> {
  const startTime = Date.now();
  const { binary, args, error } = buildCliArgs(req);

  if (error) {
    return {
      success: false,
      response: '',
      error,
      provider: 'llamacpp',
    };
  }

  return new Promise((resolve) => {
    const proc = spawn(binary, args, {
      cwd: req.cwd || process.cwd(),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      const duration_seconds = (Date.now() - startTime) / 1000;
      if (code !== 0 && !stdout.trim()) {
        resolve({
          success: false,
          response: '',
          error: stderr.trim() || `llama process exited with code ${code}`,
          duration_seconds,
          provider: 'llamacpp',
        });
        return;
      }

      resolve({
        success: true,
        response: stdout.trim(),
        duration_seconds,
        num_turns: 1,
        provider: 'llamacpp',
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        response: '',
        error: `Failed to spawn llama binary (${binary}): ${err.message}`,
        provider: 'llamacpp',
      });
    });
  });
}

async function executeLlamaCliStream(
  req: ChatRequest,
  onDelta: (text: string) => void | Promise<void>,
  onComplete: (result: ChatResponse) => void | Promise<void>,
  onError: (error: string) => void | Promise<void>
): Promise<void> {
  const startTime = Date.now();
  const { binary, args, error } = buildCliArgs(req);

  if (error) {
    await onError(error);
    return;
  }

  return new Promise<void>((resolve) => {
    const proc = spawn(binary, args, {
      cwd: req.cwd || process.env.PWD || process.cwd(),
      env: { ...process.env },
    });

    let fullResponse = '';
    let stderr = '';

    proc.stdout.on('data', async (chunk) => {
      const text = chunk.toString();
      fullResponse += text;
      await onDelta(text);
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', async (code) => {
      const duration_seconds = (Date.now() - startTime) / 1000;
      if (code !== 0 && !fullResponse.trim()) {
        await onError(stderr.trim() || `llama process exited with code ${code}`);
      } else {
        await onComplete({
          success: true,
          response: fullResponse.trim(),
          duration_seconds,
          num_turns: 1,
          provider: 'llamacpp',
        });
      }
      resolve();
    });

    proc.on('error', async (err) => {
      await onError(`Failed to spawn llama binary (${binary}): ${err.message}`);
      resolve();
    });
  });
}
