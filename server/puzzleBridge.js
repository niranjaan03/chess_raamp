import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { createRateLimiter } from './rateLimit.js';
import { log } from './logging.js';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SERVER_DIR, '..');
const PUZZLE_QUERY_SCRIPT = path.resolve(SERVER_DIR, 'puzzle_query.py');
const VENV_PYTHON = path.resolve(PROJECT_ROOT, '.venv/bin/python3');
const PYTHON_BIN = process.env.PYTHON_BIN
  || (fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3');
let worker = null;

// Crash recovery: if the Python child dies, schedule a restart with
// exponential backoff (1s, 2s, 4s, … capped at 30s). Pending queries
// are rejected so callers see a clear error instead of hanging.
const RESTART_BACKOFF_MIN_MS = 1_000;
const RESTART_BACKOFF_MAX_MS = 30_000;
const QUERY_TIMEOUT_MS = 30_000;

class PuzzleWorker {
  constructor() {
    this.child = null;
    this.pending = new Map();
    this.nextId = 1;
    this.restartAttempt = 0;
    this.restartTimer = null;
    this.shuttingDown = false;
    this.start();
    this.warm();
  }

  start() {
    if (this.shuttingDown) return;
    let child;
    try {
      child = spawn(PYTHON_BIN, [PUZZLE_QUERY_SCRIPT, '--serve'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (err) {
      log.error({ msg: 'puzzle-worker-spawn-failed', error: err && err.message });
      this.scheduleRestart(err);
      return;
    }
    this.child = child;

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
      if (pending.timer) clearTimeout(pending.timer);
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

    let exited = false;
    const handleExit = (error) => {
      if (exited) return;
      exited = true;
      const pendingError = error || new Error(stderr.trim() || 'Puzzle worker stopped');
      this.pending.forEach((entry) => {
        if (entry.timer) clearTimeout(entry.timer);
        entry.reject(pendingError);
      });
      this.pending.clear();
      this.child = null;
      this.scheduleRestart(pendingError);
    };

    this.child.on('error', handleExit);
    this.child.on('close', () => handleExit());
  }

  scheduleRestart(error) {
    if (this.shuttingDown) return;
    if (this.restartTimer) return;
    const attempt = this.restartAttempt++;
    const delay = Math.min(RESTART_BACKOFF_MAX_MS, RESTART_BACKOFF_MIN_MS * Math.pow(2, attempt));
    log.error({
      msg: 'puzzle-worker-exited',
      error: error && error.message,
      restartDelayMs: delay,
      attempt
    });
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.start();
      // Best-effort warm; if it fails we'll just re-restart.
      this.warm();
    }, delay);
    if (this.restartTimer.unref) this.restartTimer.unref();
  }

  query(options) {
    if (!this.child || !this.child.stdin || this.child.killed) {
      return Promise.reject(new Error('Puzzle worker unavailable'));
    }
    return new Promise((resolve, reject) => {
      const id = String(this.nextId++);
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Puzzle query timed out'));
        }
      }, QUERY_TIMEOUT_MS);
      if (timer.unref) timer.unref();
      this.pending.set(id, { resolve, reject, timer });
      const payload = {
        id,
        rating: options.rating || 1200,
        spread: options.spread || 140,
        theme: options.theme || '',
        opening: options.opening || '',
        exclude: options.exclude || '',
        minRating: options.minRating || 0,
        maxRating: options.maxRating || 0,
        minPopularity: options.minPopularity
      };
      try {
        this.child.stdin.write(JSON.stringify(payload) + '\n');
        // First successful write after a restart resets the backoff.
        this.restartAttempt = 0;
      } catch (err) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(err);
      }
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

  shutdown() {
    this.shuttingDown = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.child && !this.child.killed) {
      try { this.child.kill('SIGTERM'); } catch { /* already gone */ }
    }
  }
}

function getWorker() {
  if (!worker) worker = new PuzzleWorker();
  return worker;
}

export function shutdownPuzzleWorker() {
  if (worker) {
    worker.shutdown();
    worker = null;
  }
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
      const minRating = Math.max(0, Math.min(3200, parseInt(requestUrl.searchParams.get('minRating'), 10) || 0));
      const maxRating = Math.max(0, Math.min(3200, parseInt(requestUrl.searchParams.get('maxRating'), 10) || 0));
      const minPopularity = Math.max(0, Math.min(100, parseInt(requestUrl.searchParams.get('minPopularity'), 10) || 50));
      const result = await runPuzzleQuery({
        rating,
        spread,
        theme,
        opening,
        exclude,
        minRating,
        maxRating,
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

function createLimiter() {
  // Puzzle queries hit a long-running Python worker; cap per-IP burst.
  return createRateLimiter({
    pathPrefix: '/api/puzzles/',
    windowMs: 60_000,
    max: 120,
    message: 'Too many puzzle requests; slow down.'
  });
}

export function puzzleBridgeMiddleware() {
  getWorker();
  const limiter = createLimiter();
  const handler = createMiddleware();
  return function puzzleBridgeChain(req, res, next) {
    limiter(req, res, function() { handler(req, res, next); });
  };
}

export function puzzleBridgePlugin() {
  return {
    name: 'puzzle-bridge',
    configureServer(server) {
      getWorker();
      server.middlewares.use(createLimiter());
      server.middlewares.use(createMiddleware());
    },
    configurePreviewServer(server) {
      getWorker();
      server.middlewares.use(createLimiter());
      server.middlewares.use(createMiddleware());
    }
  };
}
