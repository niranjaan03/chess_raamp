// Minimal structured-log helpers + a request-logger middleware.
//
// Outputs single-line JSON to stdout/stderr. No deps. Drop in a real
// logger (pino, winston) later if needs grow — but for this app, JSON
// lines are enough for `grep`, `jq`, and most log shippers.

function emit(stream, level, fields) {
  const payload = Object.assign(
    {
      level,
      time: new Date().toISOString()
    },
    fields
  );
  try {
    stream.write(JSON.stringify(payload) + '\n');
  } catch {
    // If the log target is broken there's nothing useful left to do.
  }
}

export const log = {
  info(fields) { emit(process.stdout, 'info', fields); },
  warn(fields) { emit(process.stderr, 'warn', fields); },
  error(fields) { emit(process.stderr, 'error', fields); }
};

export function createRequestLogger({ skipPaths = ['/health', '/favicon.ico'] } = {}) {
  return function requestLogger(req, res, next) {
    const start = Date.now();
    const url = req.url || '';
    if (skipPaths.some((prefix) => url === prefix || url.startsWith(prefix + '?'))) {
      next();
      return;
    }
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const fields = {
        msg: 'request',
        method: req.method,
        url,
        status: res.statusCode,
        durationMs
      };
      // Errors get warn so they're easy to grep.
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      emit(level === 'info' ? process.stdout : process.stderr, level, fields);
    });
    next();
  };
}

// Catch-all error handler — Express 5 invokes 4-arg middleware with
// any thrown/passed error. We log it and respond with a generic 500.
export function createErrorHandler() {
  return function errorHandler(err, req, res, _next) {
    log.error({
      msg: 'unhandled-error',
      method: req.method,
      url: req.url,
      error: err && err.message ? err.message : String(err),
      stack: err && err.stack
    });
    if (res.headersSent) return;
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Internal server error' }));
  };
}

// Last-line-of-defense process handlers. Without these, an unhandled
// rejection in a bridge becomes a silent black hole.
export function installProcessHandlers() {
  process.on('uncaughtException', (err) => {
    log.error({ msg: 'uncaught-exception', error: err && err.message, stack: err && err.stack });
  });
  process.on('unhandledRejection', (reason) => {
    log.error({
      msg: 'unhandled-rejection',
      error: reason && reason.message ? reason.message : String(reason),
      stack: reason && reason.stack
    });
  });
}
