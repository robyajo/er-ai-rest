import { loadEnvFile } from 'node:process';

// Load .env if present
try {
  loadEnvFile();
} catch {
  // Ignore if not present
}

interface TestResult {
  category: string;
  name: string;
  method: string;
  path: string;
  expectedStatus: number;
  actualStatus: number;
  durationMs: number;
  passed: boolean;
  message?: string;
}

// Parse CLI Flags
const args = process.argv.slice(2);
const isProd = args.includes("--prod") || args.includes("--production");
const isLocal = args.includes("--local");
const urlFlagIdx = args.findIndex((a) => a === "--url" || a === "-u");
const customUrl = urlFlagIdx !== -1 ? args[urlFlagIdx + 1] : undefined;

const PROD_URL = "https://er-ai-api.mooo.com";
const LOCAL_URL = "http://localhost:8060";

const BASE_URL = customUrl
  ? customUrl
  : isProd
  ? PROD_URL
  : isLocal
  ? LOCAL_URL
  : process.env.TEST_BASE_URL || process.env.BASE_URL || LOCAL_URL;

const MASTER_KEY = process.env.API_KEY || "sk-agy-roby-master-key-8060";
const AGY_KEY = process.env.AGY_API_KEY || "sk-agy-cloud-only-token-8060";
const LLAMA_KEY = process.env.LLAMA_API_KEY || "sk-llama-local-only-token-8060";

// ANSI color helpers
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
};

async function executeRequest(
  method: string,
  path: string,
  token?: string,
  body?: unknown
): Promise<{ status: number; data: any; durationMs: number; rawText: string }> {
  const url = `${BASE_URL.replace(/\/+$/, '')}${path}`;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const start = performance.now();
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const durationMs = Math.round(performance.now() - start);
    const rawText = await res.text();
    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }
    return { status: res.status, data, durationMs, rawText };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    return {
      status: 0,
      data: null,
      durationMs,
      rawText: err.message || 'Network Error',
    };
  }
}

async function runTestSuite() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  🧪 Er AI Rest — Automated Endpoint Test Laboratory  ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}`);
  console.log(`${colors.gray}Target Server   :${colors.reset} ${colors.bold}${BASE_URL}${colors.reset}`);
  console.log(`${colors.gray}Master Key      :${colors.reset} ${MASTER_KEY ? 'Configured (Active)' : colors.yellow + 'Not configured' + colors.reset}`);
  console.log(`${colors.gray}AGY Scope Key   :${colors.reset} ${AGY_KEY ? 'Configured (Active)' : colors.yellow + 'Not configured' + colors.reset}`);
  console.log(`${colors.gray}Llama Scope Key :${colors.reset} ${LLAMA_KEY ? 'Configured (Active)' : colors.yellow + 'Not configured' + colors.reset}\n`);

  const results: TestResult[] = [];

  // Helper to record test
  function record(
    category: string,
    name: string,
    method: string,
    path: string,
    expectedStatus: number,
    res: { status: number; durationMs: number; rawText: string; data: any },
    customCheck?: (res: any) => boolean
  ) {
    let passed = res.status === expectedStatus;
    if (passed && customCheck) {
      passed = customCheck(res);
    }

    const result: TestResult = {
      category,
      name,
      method,
      path,
      expectedStatus,
      actualStatus: res.status,
      durationMs: res.durationMs,
      passed,
      message: passed ? undefined : (res.rawText.slice(0, 100) || `Expected ${expectedStatus}, got ${res.status}`),
    };
    results.push(result);

    const mark = passed ? `${colors.green}✓ PASS${colors.reset}` : `${colors.red}✗ FAIL${colors.reset}`;
    const statusStr = res.status === 0 ? 'NET_ERR' : String(res.status);
    console.log(
      ` ${mark} [${res.durationMs.toString().padStart(4)}ms] ${method.padEnd(4)} ${path.padEnd(28)} -> ${statusStr} ${colors.gray}(${name})${colors.reset}`
    );
    if (!passed && result.message) {
      console.log(`        ${colors.red}↳ Error: ${result.message}${colors.reset}`);
    }
  }

  // 1. PUBLIC ENDPOINTS
  console.log(`${colors.bold}${colors.yellow}1. Public Endpoints (No Auth Needed)${colors.reset}`);
  const rRoot = await executeRequest('GET', '/');
  record('Public', 'Server Banner & Directory', 'GET', '/', 200, rRoot, (r) => r.data?.service === 'er-ai-rest');

  const rHealth = await executeRequest('GET', '/health');
  record('Public', 'System Health Check', 'GET', '/health', 200, rHealth, (r) => r.data?.status === 'ok');

  // 2. AUTHENTICATION & SECURITY ENFORCEMENT
  console.log(`\n${colors.bold}${colors.yellow}2. Authentication Enforcement${colors.reset}`);
  const rNoAuth = await executeRequest('GET', '/v1/models');
  record('Security', 'Reject Missing Token', 'GET', '/v1/models', 401, rNoAuth);

  const rBadAuth = await executeRequest('GET', '/v1/models', 'invalid-token-12345');
  record('Security', 'Reject Invalid Token', 'GET', '/v1/models', 401, rBadAuth);

  // 3. DYNAMIC MODEL DISCOVERY (MASTER KEY)
  console.log(`\n${colors.bold}${colors.yellow}3. Dynamic Model Discovery (Master Key)${colors.reset}`);
  const rModels = await executeRequest('GET', '/models', MASTER_KEY);
  record('Models', 'Models List (/models)', 'GET', '/models', 200, rModels);

  const rV1Models = await executeRequest('GET', '/v1/models', MASTER_KEY);
  record('Models', 'OpenAI Models List (/v1/models)', 'GET', '/v1/models', 200, rV1Models, (r) => Array.isArray(r.data?.data));

  const rApiModels = await executeRequest('GET', '/api/models', MASTER_KEY);
  record('Models', 'Dynamic Breakdown (/api/models)', 'GET', '/api/models', 200, rApiModels, (r) => r.data?.breakdown !== undefined);

  // 4. MODULAR ANTIGRAVITY (AGY) ENDPOINTS
  console.log(`\n${colors.bold}${colors.yellow}4. Antigravity Modular Routes (/agy/*)${colors.reset}`);
  const rAgyModels = await executeRequest('GET', '/agy/models', MASTER_KEY);
  record('AGY', 'AGY Models (/agy/models)', 'GET', '/agy/models', 200, rAgyModels);

  const rAgyV1Models = await executeRequest('GET', '/agy/v1/models', MASTER_KEY);
  record('AGY', 'AGY OpenAI Models (/agy/v1/models)', 'GET', '/agy/v1/models', 200, rAgyV1Models, (r) => Array.isArray(r.data?.data));

  // 5. MODULAR LLAMA.CPP ENDPOINTS
  console.log(`\n${colors.bold}${colors.yellow}5. Llama.cpp Modular Routes (/llama/*)${colors.reset}`);
  const rLlamaStatus = await executeRequest('GET', '/llama/status', MASTER_KEY);
  record('Llama', 'Llama Engine Status (/llama/status)', 'GET', '/llama/status', 200, rLlamaStatus, (r) => r.data?.status !== undefined);

  const rLlamaModels = await executeRequest('GET', '/llama/models', MASTER_KEY);
  record('Llama', 'Llama Models (/llama/models)', 'GET', '/llama/models', 200, rLlamaModels);

  const rLlamaV1Models = await executeRequest('GET', '/llama/v1/models', MASTER_KEY);
  record('Llama', 'Llama OpenAI Models (/llama/v1/models)', 'GET', '/llama/v1/models', 200, rLlamaV1Models);

  const rLlamaChat = await executeRequest(
    'POST',
    '/llama/v1/chat/completions',
    MASTER_KEY,
    {
      model: 'qwen3.5-0.8b',
      messages: [{ role: 'user', content: '1+1=' }],
      max_tokens: 5,
      chat_template_kwargs: { enable_thinking: false },
    }
  );
  record('Llama', 'Llama Chat Completions (/llama/v1/chat/completions)', 'POST', '/llama/v1/chat/completions', 200, rLlamaChat, (r) => r.data?.choices !== undefined);

  const rLlamaCmpl = await executeRequest(
    'POST',
    '/llama/v1/completions',
    MASTER_KEY,
    {
      model: 'qwen3.5-0.8b',
      prompt: '1 + 1 =',
      max_tokens: 5,
    }
  );
  record('Llama', 'Llama Legacy Completions (/llama/v1/completions)', 'POST', '/llama/v1/completions', 200, rLlamaCmpl, (r) => r.data?.choices !== undefined);

  const rUnifiedCmpl = await executeRequest(
    'POST',
    '/v1/completions',
    MASTER_KEY,
    {
      model: 'qwen3.5-0.8b',
      prompt: 'Test',
      max_tokens: 5,
    }
  );
  record('Unified', 'Unified Completions (/v1/completions)', 'POST', '/v1/completions', 200, rUnifiedCmpl, (r) => r.data?.choices !== undefined);

  // 6. ROLE ISOLATION & ACCESS CONTROL
  console.log(`\n${colors.bold}${colors.yellow}6. Role-Based Access Isolation (AGY vs LLAMA Keys)${colors.reset}`);
  // AGY token access to agy endpoint -> 200
  const rAgyKeyOnAgy = await executeRequest('GET', '/agy/v1/models', AGY_KEY);
  record('Role Access', 'AGY_API_KEY accessing /agy/v1/models', 'GET', '/agy/v1/models', 200, rAgyKeyOnAgy);

  // AGY token access to llama endpoint -> 403 Forbidden!
  const rAgyKeyOnLlama = await executeRequest('GET', '/llama/v1/models', AGY_KEY);
  record('Role Isolation', 'Block AGY_API_KEY on /llama/v1/models', 'GET', '/llama/v1/models', 403, rAgyKeyOnLlama);

  // LLAMA token access to llama endpoint -> 200
  const rLlamaKeyOnLlama = await executeRequest('GET', '/llama/v1/models', LLAMA_KEY);
  record('Role Access', 'LLAMA_API_KEY accessing /llama/v1/models', 'GET', '/llama/v1/models', 200, rLlamaKeyOnLlama);

  // LLAMA token access to agy endpoint -> 403 Forbidden!
  const rLlamaKeyOnAgy = await executeRequest('GET', '/agy/v1/models', LLAMA_KEY);
  record('Role Isolation', 'Block LLAMA_API_KEY on /agy/v1/models', 'GET', '/agy/v1/models', 403, rLlamaKeyOnAgy);

  // 7. SUMMARY REPORT
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;
  const avgDuration = Math.round(results.reduce((acc, r) => acc + r.durationMs, 0) / total);

  console.log(`\n${colors.bold}${colors.cyan}======================================================${colors.reset}`);
  console.log(`${colors.bold}  📊 Ringkasan Hasil Pengujian (${total} Pengujian)${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}`);
  console.log(`  Total Pengujian : ${colors.bold}${total}${colors.reset}`);
  console.log(`  Berhasil (PASS) : ${colors.bold}${colors.green}${passedCount}${colors.reset}`);
  console.log(`  Gagal (FAIL)    : ${colors.bold}${failedCount === 0 ? colors.green : colors.red}${failedCount}${colors.reset}`);
  console.log(`  Rata-rata Waktu : ${colors.yellow}${avgDuration} ms${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}\n`);

  if (failedCount > 0) {
    console.log(`${colors.red}${colors.bold}⚠️ Terdapat pengujian yang belum berhasil. Pastikan server sudah aktif!${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}✨ Seluruh endpoint berfungsi dengan sempurna!${colors.reset}\n`);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
