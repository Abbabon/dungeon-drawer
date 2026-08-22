// Receives PNGs from scripts/og/index.html and writes them into public/.
// Deliberately localhost-only and short-lived — run it, generate, Ctrl-C.
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PUBLIC_DIR = resolve(import.meta.dirname, '../../public');
const PORT = 4319;

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  const name = (req.url ?? '').replace(/^\/save\//, '');
  if (req.method !== 'POST' || !/^[a-z0-9-]+\.png$/.test(name)) {
    return res.writeHead(400).end('bad request');
  }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    writeFileSync(resolve(PUBLIC_DIR, name), buf);
    console.log(`wrote public/${name} (${Math.round(buf.length / 1024)} kB)`);
    res.writeHead(200).end('ok');
  });
}).listen(PORT, () => console.log(`og writer on http://localhost:${PORT}`));
