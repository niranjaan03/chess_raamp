import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Prefer the Stockfish 18 ARM64 binary shipped under /stockfish.
// Fall back to the legacy /engine/stockfish copy for backwards compatibility.
const CANDIDATE_PATHS = [
  path.resolve(process.cwd(), 'stockfish/stockfish-macos-m1-apple-silicon'),
  path.resolve(process.cwd(), 'engine/stockfish/stockfish-macos-m1-apple-silicon'),
  path.resolve(process.cwd(), 'stockfish/src/stockfish'),
  path.resolve(process.cwd(), 'stockfish/src/stockfish-apple-silicon'),
  path.resolve(process.cwd(), 'stockfish/src/stockfish-x86-64')
];

function resolveEnginePath() {
  for (const p of CANDIDATE_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return CANDIDATE_PATHS[0];
}

const ENGINE_PATH = resolveEnginePath();
const ENGINE_CWD = path.dirname(ENGINE_PATH);

// Engine tuning: leave a couple of cores for the OS/browser, cap hash at 512MB.
const CPU_COUNT = Math.max(1, os.cpus() ? os.cpus().length : 1);
const ENGINE_THREADS = Math.max(1, Math.min(8, CPU_COUNT - 2));
const ENGINE_HASH_MB = (() => {
  const totalMb = Math.floor((os.totalmem() || 0) / (1024 * 1024));
  if (totalMb >= 16384) return 512;
  if (totalMb >= 8192) return 256;
  if (totalMb >= 4096) return 128;
  return 64;
})();

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function parseInfoLine(line) {
  const depthMatch = line.match(/ depth (\d+)/);
  const scoreMatch = line.match(/ score (cp|mate) (-?\d+)/);
  const pvMatch = line.match(/ pv (.+)/);
  const nodesMatch = line.match(/ nodes (\d+)/);
  const multipvMatch = line.match(/ multipv (\d+)/);
  const npsMatch = line.match(/ nps (\d+)/);
  const wdlMatch = line.match(/ wdl (\d+) (\d+) (\d+)/);
  const seldepthMatch = line.match(/ seldepth (\d+)/);

  if (!depthMatch || !scoreMatch || !pvMatch) return null;

  const scoreType = scoreMatch[1];
  const scoreValue = parseInt(scoreMatch[2], 10);
  let evalValue;

  if (scoreType === 'mate') {
    evalValue = scoreValue > 0 ? `M${scoreValue}` : `-M${Math.abs(scoreValue)}`;
  } else {
    evalValue = (scoreValue / 100).toFixed(2);
  }

  return {
    type: 'info',
    depth: parseInt(depthMatch[1], 10),
    seldepth: seldepthMatch ? parseInt(seldepthMatch[1], 10) : 0,
    line: multipvMatch ? parseInt(multipvMatch[1], 10) : 1,
    eval: evalValue,
    scoreType,
    scoreValue,
    pv: pvMatch[1].trim(),
    nodes: nodesMatch ? parseInt(nodesMatch[1], 10) : 0,
    nps: npsMatch ? parseInt(npsMatch[1], 10) : 0,
    wdl: wdlMatch ? {
      w: parseInt(wdlMatch[1], 10),
      d: parseInt(wdlMatch[2], 10),
      l: parseInt(wdlMatch[3], 10)
    } : null
  };
}

function writeEngineSetup(engine, { multiPv, threads, hashMb }) {
  const t = (threads && threads > 0 && threads <= 32) ? threads : ENGINE_THREADS;
  const h = (hashMb && hashMb >= 16 && hashMb <= 2048) ? hashMb : ENGINE_HASH_MB;
  engine.stdin.write(`setoption name Threads value ${t}\n`);
  engine.stdin.write(`setoption name Hash value ${h}\n`);
  engine.stdin.write(`setoption name UCI_ShowWDL value true\n`);
  engine.stdin.write(`setoption name MultiPV value ${multiPv}\n`);
  engine.stdin.write(`setoption name UCI_LimitStrength value false\n`);
}

function runStockfishAnalysis({ fen, depth, multiPv, threads, hashMb }) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(ENGINE_PATH)) {
      reject(new Error(`Stockfish binary not found at ${ENGINE_PATH}`));
      return;
    }

    const engine = spawn(ENGINE_PATH, [], {
      cwd: ENGINE_CWD,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const linesByPv = new Map();
    let stdoutBuffer = '';
    let finished = false;
    let uciAcknowledged = false;
    let startedSearch = false;
    let bestmove = null;
    // 20s base + 1s per depth unit above 15 gives room for depth 22-24.
    const budget = 20000 + Math.max(0, depth - 15) * 1500;
    const timeout = setTimeout(() => {
      // Force engine to emit bestmove and wrap up cleanly.
      if (!finished && startedSearch) {
        try { engine.stdin.write('stop\n'); } catch (e) { /* ignore */ }
        setTimeout(() => finish(null), 500);
      } else {
        finish(new Error('Stockfish analysis timed out'));
      }
    }, budget);

    function cleanup() {
      clearTimeout(timeout);
      engine.stdout.removeAllListeners();
      engine.stderr.removeAllListeners();
      engine.removeAllListeners();
      if (!engine.killed) {
        try {
          engine.stdin.write('quit\n');
        } catch (e) { /* ignore */ }
        setTimeout(() => {
          if (!engine.killed) engine.kill('SIGKILL');
        }, 50);
      }
    }

    function finish(err) {
      if (finished) return;
      finished = true;
      cleanup();
      const lines = Array.from(linesByPv.values()).sort((a, b) => a.line - b.line);
      if (err && lines.length === 0 && !bestmove) {
        reject(err);
        return;
      }
      resolve({
        ok: !err,
        bestmove,
        lines
      });
    }

    function processLine(raw) {
      const line = raw.trim();
      if (!line) return;

      if (line === 'uciok' && !uciAcknowledged) {
        uciAcknowledged = true;
        writeEngineSetup(engine, { multiPv, threads, hashMb });
        engine.stdin.write('ucinewgame\n');
        engine.stdin.write('isready\n');
        return;
      }

      if (line === 'readyok' && !startedSearch) {
        startedSearch = true;
        engine.stdin.write(`position fen ${fen}\n`);
        engine.stdin.write(`go depth ${depth}\n`);
        return;
      }

      if (line.startsWith('info ')) {
        const parsed = parseInfoLine(line);
        if (parsed) linesByPv.set(parsed.line, parsed);
        return;
      }

      if (line.startsWith('bestmove')) {
        const parts = line.split(/\s+/);
        bestmove = parts[1] && parts[1] !== '(none)' ? parts[1] : null;
        finish(null);
      }
    }

    engine.stdout.setEncoding('utf8');
    engine.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk;
      const parts = stdoutBuffer.split('\n');
      stdoutBuffer = parts.pop() || '';
      parts.forEach(processLine);
    });

    engine.stderr.setEncoding('utf8');
    engine.stderr.on('data', () => { /* ignore */ });

    engine.on('error', (err) => { finish(err); });
    engine.on('close', (code) => {
      if (!finished) {
        finish(code === 0 ? null : new Error(`Stockfish exited with code ${code}`));
      }
    });

    engine.stdin.write('uci\n');
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function runBatchAnalysis({ positions, depth, multiPv, threads, hashMb }) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(ENGINE_PATH)) {
      reject(new Error(`Stockfish binary not found at ${ENGINE_PATH}`));
      return;
    }

    const engine = spawn(ENGINE_PATH, [], {
      cwd: ENGINE_CWD,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const results = [];
    let stdoutBuffer = '';
    let finished = false;
    let currentIdx = 0;
    let currentLinesByPv = new Map();
    let currentBestmove = null;
    let uciAcknowledged = false;
    let engineReady = false;

    // Budget: ~2.2s/position at depth 18 on modern hardware, scaled by depth.
    const perPos = 2200 + Math.max(0, depth - 18) * 900;
    const budget = Math.max(60000, positions.length * perPos + 10000);
    const timeout = setTimeout(() => {
      finish(new Error('Batch analysis timed out'));
    }, budget);

    function cleanup() {
      clearTimeout(timeout);
      engine.stdout.removeAllListeners();
      engine.stderr.removeAllListeners();
      engine.removeAllListeners();
      if (!engine.killed) {
        try {
          engine.stdin.write('stop\n');
          engine.stdin.write('quit\n');
        } catch (e) { /* ignore */ }
        setTimeout(() => {
          if (!engine.killed) engine.kill('SIGKILL');
        }, 100);
      }
    }

    function finish(err) {
      if (finished) return;
      finished = true;
      cleanup();
      if (err && results.length === 0) {
        reject(err);
        return;
      }
      while (results.length < positions.length) {
        results.push({ ok: false, bestmove: null, lines: [] });
      }
      resolve(results);
    }

    function startNextPosition() {
      if (currentIdx >= positions.length) {
        finish(null);
        return;
      }
      currentLinesByPv = new Map();
      currentBestmove = null;
      const fen = positions[currentIdx];
      // Do NOT send ucinewgame between positions from the same game —
      // the transposition table carries massive speedups across adjacent plies.
      engine.stdin.write(`position fen ${fen}\n`);
      engine.stdin.write(`go depth ${depth}\n`);
    }

    function processLine(raw) {
      const line = raw.trim();
      if (!line) return;

      if (line === 'uciok' && !uciAcknowledged) {
        uciAcknowledged = true;
        writeEngineSetup(engine, { multiPv, threads, hashMb });
        engine.stdin.write('ucinewgame\n');
        engine.stdin.write('isready\n');
        return;
      }

      if (line === 'readyok' && !engineReady) {
        engineReady = true;
        startNextPosition();
        return;
      }

      if (line.startsWith('info ')) {
        const parsed = parseInfoLine(line);
        if (parsed) currentLinesByPv.set(parsed.line, parsed);
        return;
      }

      if (line.startsWith('bestmove')) {
        const parts = line.split(/\s+/);
        currentBestmove = parts[1] && parts[1] !== '(none)' ? parts[1] : null;
        const lines = Array.from(currentLinesByPv.values()).sort((a, b) => a.line - b.line);
        results.push({ ok: true, bestmove: currentBestmove, lines });
        currentIdx++;
        if (currentIdx < positions.length) {
          startNextPosition();
        } else {
          finish(null);
        }
      }
    }

    engine.stdout.setEncoding('utf8');
    engine.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk;
      const parts = stdoutBuffer.split('\n');
      stdoutBuffer = parts.pop() || '';
      parts.forEach(processLine);
    });

    engine.stderr.setEncoding('utf8');
    engine.stderr.on('data', () => { });

    engine.on('error', (err) => { finish(err); });
    engine.on('close', (code) => {
      if (!finished) finish(code === 0 ? null : new Error(`Stockfish exited with code ${code}`));
    });

    engine.stdin.write('uci\n');
  });
}

function createMiddleware() {
  return async function stockfishMiddleware(req, res, next) {
    const reqUrl = req.url || '';

    if (req.method === 'GET' && reqUrl === '/api/engine/status') {
      sendJson(res, 200, {
        ready: fs.existsSync(ENGINE_PATH),
        engine: 'Stockfish 18',
        mode: 'native',
        path: ENGINE_PATH,
        cwd: ENGINE_CWD,
        threads: ENGINE_THREADS,
        hashMb: ENGINE_HASH_MB
      });
      return;
    }

    if (req.method === 'POST' && reqUrl === '/api/engine/analyze') {
      try {
        const body = await readJsonBody(req);
        const fen = typeof body.fen === 'string' ? body.fen : '';
        const depth = Math.max(1, Math.min(30, parseInt(body.depth, 10) || 18));
        const multiPv = Math.max(1, Math.min(5, parseInt(body.multiPv, 10) || 1));
        const threads = body.threads ? parseInt(body.threads, 10) : null;
        const hashMb = body.hashMb ? parseInt(body.hashMb, 10) : null;

        if (!fen) {
          sendJson(res, 400, { ok: false, error: 'Missing FEN' });
          return;
        }

        const result = await runStockfishAnalysis({ fen, depth, multiPv, threads, hashMb });
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 500, {
          ok: false,
          error: err && err.message ? err.message : 'Stockfish bridge failed'
        });
      }
      return;
    }

    if (req.method === 'POST' && reqUrl === '/api/engine/analyze-batch') {
      try {
        const body = await readJsonBody(req);
        const positions = Array.isArray(body.positions) ? body.positions : [];
        const depth = Math.max(1, Math.min(30, parseInt(body.depth, 10) || 18));
        const multiPv = Math.max(1, Math.min(5, parseInt(body.multiPv, 10) || 1));
        const threads = body.threads ? parseInt(body.threads, 10) : null;
        const hashMb = body.hashMb ? parseInt(body.hashMb, 10) : null;

        if (!positions.length) {
          sendJson(res, 400, { ok: false, error: 'No positions provided' });
          return;
        }

        const results = await runBatchAnalysis({ positions, depth, multiPv, threads, hashMb });
        sendJson(res, 200, { ok: true, results });
      } catch (err) {
        sendJson(res, 500, {
          ok: false,
          error: err && err.message ? err.message : 'Batch analysis failed'
        });
      }
      return;
    }

    next();
  };
}

export function stockfishBridgePlugin() {
  return {
    name: 'stockfish-bridge',
    configureServer(server) {
      server.middlewares.use(createMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware());
    }
  };
}
