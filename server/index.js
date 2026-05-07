// Production server — serves the built SPA + the four API bridges.
// Used in production via `npm start`. Vite still runs the bridges in dev/preview
// via the *Plugin() exports in vite.config.js.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { puzzleBridgeMiddleware, shutdownPuzzleWorker } from './puzzleBridge.js';
import { chesscomBridgeMiddleware } from './chesscomBridge.js';
import { lichessBridgeMiddleware } from './lichessBridge.js';
import { openingStatsBridgeMiddleware } from './openingStatsBridge.js';
import { createOriginGuard } from './originGuard.js';
import { loadServerConfig } from './config.js';
import { createRequestLogger, createErrorHandler, installProcessHandlers, log } from './logging.js';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SERVER_DIR, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');
const VENV_PYTHON = path.join(PROJECT_ROOT, '.venv/bin/python3');

let config;
try {
  config = loadServerConfig({ venvPython: VENV_PYTHON });
} catch (err) {
  console.error(`[server] invalid configuration: ${err.message}`);
  process.exit(1);
}

if (!fs.existsSync(INDEX_HTML)) {
  console.error(`Missing build output at ${DIST_DIR}. Run \`npm run build\` first.`);
  process.exit(1);
}

installProcessHandlers();

const app = express();
app.disable('x-powered-by');

// Request logger runs first so we capture every request, including
// 4xx/5xx from later middleware.
app.use(createRequestLogger());

// Cross-origin isolation — required for SharedArrayBuffer (Stockfish multi-threaded WASM).
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// API bridges — order matches vite.config.js for parity with dev.
// Origin guard runs first so cross-site fetches never reach the
// rate-limited bridges (and don't burn budget for the legit user).
app.use(createOriginGuard({ pathPrefix: '/api/' }));
app.use(puzzleBridgeMiddleware());
app.use(chesscomBridgeMiddleware());
app.use(lichessBridgeMiddleware());
app.use(openingStatsBridgeMiddleware());

// Static assets. `index: false` so we hit the SPA fallback below for `/`.
app.use(express.static(DIST_DIR, {
  index: false,
  maxAge: '1h',
  setHeaders(res, filePath) {
    if (/\/assets\/.+\.[a-f0-9]{8,}\./.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// SPA fallback — any non-API GET that didn't match a static file returns index.html.
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(INDEX_HTML);
});

// Catch-all error handler — must be the last middleware.
app.use(createErrorHandler());

const server = app.listen(config.port, config.host, () => {
  log.info({
    msg: 'server-listening',
    host: config.host,
    port: config.port,
    nodeEnv: config.nodeEnv,
    pythonBin: config.pythonBin
  });
});

// Graceful shutdown — kill the Python puzzle worker and let the
// HTTP server drain in-flight requests before exit.
function gracefulShutdown(signal) {
  log.info({ msg: 'shutdown', signal });
  shutdownPuzzleWorker();
  server.close(() => process.exit(0));
  // Hard-exit if shutdown stalls.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
