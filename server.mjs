import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const PRESETS_FILE = path.join(DATA_DIR, 'community-presets.json');

const PORT = Number(process.env.PORT || 3456);
const HOST = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function readCommunityPresets() {
  try {
    const raw = await fs.readFile(PRESETS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeCommunityPresets(presets) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PRESETS_FILE, JSON.stringify(presets, null, 2), 'utf8');
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function readRequestBody(req, maxBytes = 512 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error('Payload too large');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function handleRequest(req, res) {
  try {
    const url = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);

    // REST API: Local Community Presets Gallery
    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, { status: 'ok', app: 'GravitySynth', version: '1.0.0' });
    }

    if (pathname === '/api/presets' && req.method === 'GET') {
      const presets = await readCommunityPresets();
      return sendJson(res, 200, { presets });
    }

    if (pathname === '/api/presets' && req.method === 'POST') {
      const raw = await readRequestBody(req);
      const body = JSON.parse(raw);
      if (!body || typeof body.name !== 'string' || !body.scene || typeof body.scene !== 'object') {
        return sendJson(res, 400, { error: 'Invalid preset payload: name and scene are required.' });
      }
      const cleanName = body.name.trim().slice(0, 60);
      if (!cleanName) {
        return sendJson(res, 400, { error: 'Preset name cannot be empty.' });
      }
      const presets = await readCommunityPresets();
      const entry = {
        id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        author: typeof body.author === 'string' && body.author.trim() ? body.author.trim().slice(0, 40) : 'Hackathon Creator',
        createdAt: new Date().toISOString(),
        scene: body.scene,
      };
      presets.unshift(entry);
      await writeCommunityPresets(presets.slice(0, 50));
      return sendJson(res, 201, { preset: entry });
    }

    if (pathname.startsWith('/api/presets/') && req.method === 'DELETE') {
      const id = pathname.slice('/api/presets/'.length);
      const presets = await readCommunityPresets();
      const filtered = presets.filter((p) => p.id !== id);
      if (filtered.length === presets.length) {
        return sendJson(res, 404, { error: 'Preset not found' });
      }
      await writeCommunityPresets(filtered);
      return sendJson(res, 200, { deleted: id });
    }

    // Static file serving from public/
    const requestedPath = pathname === '/' ? '/index.html' : pathname;
    const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
    const fullPath = path.join(PUBLIC_DIR, safePath);

    if (!fullPath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Forbidden');
    }

    try {
      const stat = await fs.stat(fullPath);
      if (!stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Not Found');
      }
      const ext = path.extname(fullPath).toLowerCase();
      const data = await fs.readFile(fullPath);
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    }
  } catch (err) {
    sendJson(res, 500, { error: err?.message || 'Internal Server Error' });
  }
}

export function createServer() {
  return http.createServer(handleRequest);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`\n  ✦ GravitySynth is running!`);
    console.log(`  ➜ Open in browser: http://${HOST}:${PORT}`);
    console.log(`  ➜ Chinese UI link: http://${HOST}:${PORT}/?lang=zh\n`);
  });
}
