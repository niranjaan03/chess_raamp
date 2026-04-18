import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const PUZZLE_QUERY_SCRIPT = path.resolve(process.cwd(), 'server/puzzle_query.py');
const VENV_PYTHON = path.resolve(process.cwd(), '.venv/bin/python3');
const PYTHON_BIN = fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3';
let worker = null;

class PuzzleWorker {
  constructor() {
    this.child = null;
    this.pending = new Map();
    this.nextId = 1;
    this.start();
    this.warm();
  }

  start() {
    this.child = spawn(PYTHON_BIN, [PUZZLE_QUERY_SCRIPT, '--serve'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const rl = readline.createInterface({ input: this.child.stdout });
    rl.on('line', (line) => {
      let payload = null;
      try {
        payload = JSON.parse(line);
      } catch (err) {
        return;
      }
      const id = payload && payload.id;
      if (!id || !this.pending.has(id)) return;
      const pending = this.pending.get(id);
      this.pending.delete(id);
      if (payload.ok === false) {
        pending.reject(new Error(payload.error || 'Puzzle query failed'));
        return;
      }
      pending.resolve(payload);
    });

    let stderr = '';
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });

    const teardown = (error) => {
      const pendingError = error || new Error(stderr.trim() || 'Puzzle worker stopped');
      this.pending.forEach(({ reject }) => reject(pendingError));
      this.pending.clear();
      worker = null;
    };

    this.child.on('error', teardown);
    this.child.on('close', () => teardown());
  }

  query(options) {
    if (!this.child || !this.child.stdin || this.child.killed) {
      throw new Error('Puzzle worker unavailable');
    }
    return new Promise((resolve, reject) => {
      const id = String(this.nextId++);
      this.pending.set(id, { resolve, reject });
      const payload = {
        id,
        rating: options.rating || 1200,
        spread: options.spread || 140,
        theme: options.theme || '',
        opening: options.opening || '',
        exclude: options.exclude || '',
        minPopularity: options.minPopularity
      };
      this.child.stdin.write(JSON.stringify(payload) + '\n');
    });
  }

  warm() {
    this.query({
      rating: 1200,
      spread: 140,
      theme: '',
      opening: '',
      exclude: '',
      minPopularity: 50
    }).catch(() => {});
  }
}

function getWorker() {
  if (!worker) worker = new PuzzleWorker();
  return worker;
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function runPuzzleQuery(options) {
  return getWorker().query(options);
}

function createMiddleware() {
  return async function puzzleMiddleware(req, res, next) {
    const reqUrl = req.url || '';
    if (!(req.method === 'GET' && reqUrl.startsWith('/api/puzzles/next'))) {
      next();
      return;
    }

    try {
      const requestUrl = new URL(reqUrl, 'http://localhost');
      const rating = Math.max(400, Math.min(3200, parseInt(requestUrl.searchParams.get('rating'), 10) || 1200));
      const spread = Math.max(60, Math.min(500, parseInt(requestUrl.searchParams.get('spread'), 10) || 140));
      const theme = (requestUrl.searchParams.get('theme') || '').trim();
      const opening = (requestUrl.searchParams.get('opening') || '').trim();
      const exclude = (requestUrl.searchParams.get('exclude') || '').trim();
      const minPopularity = Math.max(0, Math.min(100, parseInt(requestUrl.searchParams.get('minPopularity'), 10) || 50));
      const result = await runPuzzleQuery({
        rating,
        spread,
        theme,
        opening,
        exclude,
        minPopularity
      });
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error: err && err.message ? err.message : 'Puzzle query failed'
      });
    }
  };
}

export function puzzleBridgePlugin() {
  return {
    name: 'puzzle-bridge',
    configureServer(server) {
      getWorker();
      server.middlewares.use(createMiddleware());
    },
    configurePreviewServer(server) {
      getWorker();
      server.middlewares.use(createMiddleware());
    }
  };
}
