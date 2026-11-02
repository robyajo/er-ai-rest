import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const app = new Hono();
const htmlPath = join(process.cwd(), 'labs', 'index.html');

app.get('/', (c) => {
  if (existsSync(htmlPath)) {
    const html = readFileSync(htmlPath, 'utf-8');
    return c.html(html);
  }
  return c.text('labs/index.html tidak ditemukan', 404);
});

const port = Number(process.env.LAB_PORT) || 8061;

serve(
  {
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0',
  },
  (info) => {
    console.log(`\n🧪 Er AI Rest Testing Laboratory siap dibuka:`);
    console.log(`👉 http://localhost:${info.port}`);
    console.log(`(Menghubungkan ke API di http://localhost:8060 secara default)\n`);
  }
);
