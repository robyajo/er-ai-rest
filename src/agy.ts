import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { ChatRequest, ChatResponse, AgyStreamEvent } from './types.js';

function getAgyBinary(): string {
  if (process.env.AGY_PATH && existsSync(process.env.AGY_PATH)) {
    return process.env.AGY_PATH;
  }
  const defaultPath = '/home/roby/.local/bin/agy';
  if (existsSync(defaultPath)) {
    return defaultPath;
  }
  return 'agy';
}

function buildArgs(req: ChatRequest, outputFormat: 'json' | 'stream-json'): string[] {
  const args: string[] = ['-p', req.prompt, '--output-format', outputFormat];

  if (req.conversation_id) {
    args.push('--conversation', req.conversation_id);
  }
  if (req.model) {
    args.push('--model', req.model);
  }
  if (req.effort) {
    args.push('--effort', req.effort);
  }
  if (req.mode) {
    args.push('--mode', req.mode);
  }
  if (req.dangerously_skip_permissions) {
    args.push('--dangerously-skip-permissions');
  }

  return args;
}

export async function executeAgy(req: ChatRequest): Promise<ChatResponse> {
  const agyBinary = getAgyBinary();
  const args = buildArgs(req, 'json');

  return new Promise((resolve) => {
    const proc = spawn(agyBinary, args, {
      cwd: req.cwd || process.cwd(),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0 && !stdout) {
        resolve({
          success: false,
          response: '',
          error: stderr.trim() || `Process exited with code ${code}`,
        });
        return;
      }

      // Find the JSON object line in stdout
      const lines = stdout.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('{') && line.endsWith('}')) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.response !== undefined || parsed.conversation_id !== undefined) {
              resolve({
                success: parsed.status === 'SUCCESS' || true,
                conversation_id: parsed.conversation_id,
                response: parsed.response || '',
                duration_seconds: parsed.duration_seconds,
                num_turns: parsed.num_turns,
                usage: parsed.usage,
              });
              return;
            }
          } catch {
            // continue checking other lines
          }
        }
      }

      resolve({
        success: code === 0,
        response: stdout.trim(),
        error: code !== 0 ? stderr.trim() : undefined,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        response: '',
        error: `Failed to spawn agy: ${err.message}`,
      });
    });
  });
}

export async function executeAgyStream(
  req: ChatRequest,
  onDelta: (text: string) => void | Promise<void>,
  onComplete: (result: ChatResponse) => void | Promise<void>,
  onError: (error: string) => void | Promise<void>
): Promise<void> {
  const agyBinary = getAgyBinary();
  const args = buildArgs(req, 'stream-json');

  return new Promise<void>((resolve) => {
    const proc = spawn(agyBinary, args, {
      cwd: req.cwd || process.cwd(),
      env: { ...process.env },
    });

    let buffer = '';
    let fullResponse = '';
    let finalResult: ChatResponse = {
      success: true,
      response: '',
    };

    proc.stdout.on('data', async (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed) as AgyStreamEvent;

          if (parsed.event === 'step_update' && parsed.step_update?.text_delta) {
            const delta = parsed.step_update.text_delta;
            fullResponse += delta;
            await onDelta(delta);
          } else if (parsed.event === 'result' && parsed.result) {
            finalResult = {
              success: parsed.result.status === 'SUCCESS',
              conversation_id: parsed.result.conversation_id,
              response: parsed.result.response || fullResponse,
              duration_seconds: parsed.result.duration_seconds,
              num_turns: parsed.result.num_turns,
              usage: parsed.result.usage as any,
            };
          }
        } catch {
          // ignore non-json
        }
      }
    });

    let stderr = '';
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', async (code) => {
      if (code !== 0 && !fullResponse) {
        await onError(stderr.trim() || `Process exited with code ${code}`);
      } else {
        finalResult.response = finalResult.response || fullResponse;
        await onComplete(finalResult);
      }
      resolve();
    });

    proc.on('error', async (err) => {
      await onError(`Failed to spawn agy: ${err.message}`);
      resolve();
    });
  });
}

export const SUPPORTED_MODELS = [
  { id: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)' },
  { id: 'gemini-3.8-flash-medium', name: 'Gemini 3.8 Flash (Medium)' },
  { id: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Thinking)' },
  { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)' },
  { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B (Medium)' },
];
