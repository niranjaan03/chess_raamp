import https from 'node:https';

const CACHE_TTL_MS = 10 * 1000;
const cache = new Map();

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, contentType, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function fetchUpstream(targetUrl, acceptHeader) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      targetUrl,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'chess-analyzer/1.0 (+local dev; contact: owner@localhost)',
          'Accept': acceptHeader || 'text/plain, application/json, */*'
        },
        timeout: 15000
      },
      (upstream) => {
        const chunks = [];
        upstream.on('data', (chunk) => chunks.push(chunk));
        upstream.on('end', () => {
          resolve({
            status: upstream.statusCode || 0,
            contentType: upstream.headers['content-type'] || 'text/plain; charset=utf-8',
            body: Buffer.concat(chunks)
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('Upstream request timed out'));
    });
    req.on('error', reject);
    req.end();
  });
}

async function proxy(targetUrl, acceptHeader) {
  const cacheKey = acceptHeader + '::' + targetUrl;
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }
  const result = await fetchUpstream(targetUrl, acceptHeader);
  if (result.status >= 200 && result.status < 300) {
    cache.set(cacheKey, { at: now, value: result });
  }
  return result;
}

function normalizeUsername(rawUsername) {
  const username = encodeURIComponent(decodeURIComponent(rawUsername || ''));
  return username || '';
}

function normalizeGameId(rawGameId) {
  const gameId = String(rawGameId || '').trim();
  return /^[a-zA-Z0-9]{8}$/.test(gameId) ? gameId : '';
}

function resolveUpstream(pathname, search) {
  const userGamesMatch = pathname.match(/^\/api\/lichess\/user\/([^/]+)\/games$/);
  if (userGamesMatch) {
    const username = normalizeUsername(userGamesMatch[1]);
    if (!username) return null;
    return {
      url: 'https://lichess.org/api/games/user/' + username + (search ? '?' + search : ''),
      accept: 'application/x-ndjson'
    };
  }

  const exportMatch = pathname.match(/^\/api\/lichess\/game\/([^/]+)\/export$/);
  if (exportMatch) {
    const gameId = normalizeGameId(exportMatch[1]);
    if (!gameId) return null;
    return {
      url: 'https://lichess.org/game/export/' + gameId + (search ? '?' + search : ''),
      accept: 'application/x-chess-pgn, text/plain, */*'
    };
  }

  return null;
}

function createMiddleware() {
  return async function lichessMiddleware(req, res, next) {
    const reqUrl = req.url || '';
    if (req.method !== 'GET' || !reqUrl.startsWith('/api/lichess/')) {
      next();
      return;
    }

    const [pathname, search = ''] = reqUrl.split('?');
    const upstream = resolveUpstream(pathname, search);
    if (!upstream) {
      sendJson(res, 404, { ok: false, error: 'Unknown Lichess proxy route' });
      return;
    }

    try {
      const result = await proxy(upstream.url, upstream.accept);
      if (result.status === 404) {
        sendJson(res, 404, { ok: false, error: 'Not found on Lichess', upstreamStatus: 404 });
        return;
      }
      if (result.status < 200 || result.status >= 300) {
        sendJson(res, 502, {
          ok: false,
          error: 'Lichess upstream error',
          upstreamStatus: result.status
        });
        return;
      }
      sendText(res, 200, result.contentType, result.body);
    } catch (err) {
      sendJson(res, 502, {
        ok: false,
        error: err && err.message ? err.message : 'Lichess proxy request failed'
      });
    }
  };
}

export function lichessBridgeMiddleware() {
  return createMiddleware();
}

export function lichessBridgePlugin() {
  return {
    name: 'lichess-bridge',
    configureServer(server) {
      server.middlewares.use(createMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware());
    }
  };
}
