import https from 'node:https';

// Chess.com published data API has a 5s edge cache already; we add a small
// in-process cache to absorb retries/burst clicks without re-hitting the CDN.
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDefaultArchiveDate() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return {
    year: String(yesterday.getFullYear()),
    month: String(yesterday.getMonth() + 1).padStart(2, '0')
  };
}

function normalizeArchiveParts(rawUsername, rawYear, rawMonth) {
  const username = encodeURIComponent(decodeURIComponent(rawUsername || ''));
  const year = String(rawYear || '');
  const monthNum = parseInt(String(rawMonth || ''), 10);
  if (!username || !/^\d{4}$/.test(year) || !monthNum || monthNum < 1 || monthNum > 12) {
    return null;
  }
  return {
    username,
    year,
    month: String(monthNum).padStart(2, '0')
  };
}

function buildArchiveUpstreamUrl(rawUsername, rawYear, rawMonth, format) {
  const parts = normalizeArchiveParts(rawUsername, rawYear, rawMonth);
  if (!parts) return null;
  return 'https://api.chess.com/pub/player/' + parts.username + '/games/' + parts.year + '/' + parts.month + (format === 'pgn' ? '/pgn' : '');
}

function buildLocalArchivePath(rawUsername, rawYear, rawMonth, format) {
  const parts = normalizeArchiveParts(rawUsername, rawYear, rawMonth);
  if (!parts) return '';
  return '/api/chesscom/archive/' + parts.username + '/' + parts.year + '/' + parts.month + (format === 'pgn' ? '/pgn' : '');
}

function renderRouterPage(search) {
  const params = new URLSearchParams(search || '');
  const fallback = getDefaultArchiveDate();
  const username = String(params.get('username') || '').trim().replace(/^@+/, '');
  const year = /^\d{4}$/.test(String(params.get('year') || '')) ? String(params.get('year')) : fallback.year;
  const monthRaw = parseInt(String(params.get('month') || fallback.month), 10);
  const month = String((monthRaw >= 1 && monthRaw <= 12) ? monthRaw : parseInt(fallback.month, 10)).padStart(2, '0');
  const format = params.get('format') === 'json' ? 'json' : 'pgn';
  const localPath = username ? buildLocalArchivePath(username, year, month, format) : '';
  const upstreamUrl = username ? buildArchiveUpstreamUrl(username, year, month, format) : '';
  const query = new URLSearchParams({ username, year, month, format }).toString();

  return '<!doctype html>' +
    '<html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Chess.com Router</title>' +
    '<style>' +
      'body{margin:0;background:#0b0b0c;color:#f3f5f7;font:14px/1.5 "IBM Plex Mono",ui-monospace,monospace;padding:32px;}' +
      '.wrap{max-width:980px;margin:0 auto;}' +
      '.card{background:#121417;border:1px solid #2a2f37;border-radius:16px;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.25);}' +
      'h1{margin:0 0 8px;font-size:28px;}p{color:#a8b3c2;}label{display:block;margin:14px 0 6px;font-size:12px;color:#9fb0c4;text-transform:uppercase;letter-spacing:.08em;}' +
      'input,select{width:100%;box-sizing:border-box;border:1px solid #313845;background:#0d1014;color:#f3f5f7;border-radius:10px;padding:11px 12px;font:inherit;}' +
      '.grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;}' +
      '.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px;}' +
      'button,a.btn{border:0;border-radius:999px;padding:11px 16px;background:#7dcf82;color:#061108;font-weight:700;text-decoration:none;cursor:pointer;}' +
      'a.btn.alt{background:#1a2230;color:#d8e1ec;border:1px solid #2e394d;}' +
      'code,.endpoint{display:block;margin-top:10px;padding:12px;border-radius:12px;background:#0c1016;border:1px solid #242c38;color:#8fe18f;overflow:auto;white-space:pre-wrap;word-break:break-all;}' +
      'pre{margin:16px 0 0;padding:14px;border-radius:12px;background:#090c11;border:1px solid #222b38;max-height:420px;overflow:auto;white-space:pre-wrap;word-break:break-word;}' +
      '.note{margin-top:12px;font-size:12px;color:#90a0b4;}' +
      '@media (max-width:900px){.grid{grid-template-columns:1fr;}}' +
    '</style></head><body><div class="wrap"><div class="card">' +
    '<h1>Chess.com Router Page</h1>' +
    '<p>Use this local route page to build and open a local Chess.com endpoint.</p>' +
    '<form method="get" action="/router/chesscom">' +
    '<div class="grid">' +
    '<div><label>Username</label><input name="username" value="' + escapeHtml(username) + '" placeholder="ninja_vm"></div>' +
    '<div><label>Year</label><input name="year" value="' + escapeHtml(year) + '" inputmode="numeric"></div>' +
    '<div><label>Month</label><input name="month" value="' + escapeHtml(month) + '" inputmode="numeric"></div>' +
    '<div><label>Format</label><select name="format"><option value="pgn"' + (format === 'pgn' ? ' selected' : '') + '>PGN</option><option value="json"' + (format === 'json' ? ' selected' : '') + '>JSON</option></select></div>' +
    '</div>' +
    '<div class="actions"><button type="submit">Build Route</button>' +
    (localPath ? '<a class="btn alt" href="' + escapeHtml(localPath) + '" target="_blank" rel="noreferrer">Open Local Endpoint</a>' : '') +
    (upstreamUrl ? '<a class="btn alt" href="' + escapeHtml(upstreamUrl) + '" target="_blank" rel="noreferrer">Open Chess.com Upstream</a>' : '') +
    '</div></form>' +
    '<label>Local Endpoint</label>' +
    '<div class="endpoint">' + (localPath ? escapeHtml(localPath) : 'Fill the form to generate an endpoint.') + '</div>' +
    '<label>Router Page URL</label>' +
    '<div class="endpoint">' + escapeHtml('/router/chesscom' + (username ? '?' + query : '')) + '</div>' +
    '<div class="note">Available endpoint aliases: <code>/api/chesscom/archive/:username/:year/:month</code> and <code>/api/chesscom/archive/:username/:year/:month/pgn</code></div>' +
    '<pre id="preview">' + (localPath ? 'Click "Preview Response" to fetch ' + localPath : 'No endpoint generated yet.') + '</pre>' +
    (localPath
      ? '<div class="actions"><button type="button" id="previewBtn">Preview Response</button></div>' +
        '<script>document.getElementById("previewBtn").addEventListener("click",async function(){var out=document.getElementById("preview");out.textContent="Loading...";try{var r=await fetch(' + JSON.stringify(localPath) + ',{cache:"no-store"});var t=await r.text();out.textContent="HTTP "+r.status+"\\n\\n"+t.slice(0,12000);}catch(err){out.textContent=String(err&&err.message?err.message:err);}});</script>'
      : '') +
    '</div></div></body></html>';
}

function fetchUpstream(targetUrl) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      targetUrl,
      {
        method: 'GET',
        headers: {
          // Chess.com recommends identifying the integration via User-Agent.
          'User-Agent': 'chess-analyzer/1.0 (+local dev; contact: owner@localhost)',
          'Accept': 'application/json, application/vnd.chess-pgn, text/plain, */*'
        },
        timeout: 15000
      },
      (upstream) => {
        const chunks = [];
        upstream.on('data', (chunk) => chunks.push(chunk));
        upstream.on('end', () => {
          resolve({
            status: upstream.statusCode || 0,
            contentType: upstream.headers['content-type'] || 'application/octet-stream',
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

async function proxy(targetUrl) {
  const cached = cache.get(targetUrl);
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }
  const result = await fetchUpstream(targetUrl);
  // Only cache successful responses — 404/5xx should retry fresh.
  if (result.status >= 200 && result.status < 300) {
    cache.set(targetUrl, { at: now, value: result });
  }
  return result;
}

// Map our proxy paths to the corresponding chess.com API URLs.
// We validate path segments strictly to avoid SSRF.
function resolveUpstreamUrl(pathname, _search) {
  // /api/chesscom/player/:username (profile — must be checked before sub-path routes)
  const profileMatch = pathname.match(/^\/api\/chesscom\/player\/([^/]+)$/);
  if (profileMatch) {
    const username = encodeURIComponent(decodeURIComponent(profileMatch[1]));
    return 'https://api.chess.com/pub/player/' + username;
  }
  // /api/chesscom/player/:username/stats
  const statsMatch = pathname.match(/^\/api\/chesscom\/player\/([^/]+)\/stats$/);
  if (statsMatch) {
    const username = encodeURIComponent(decodeURIComponent(statsMatch[1]));
    return 'https://api.chess.com/pub/player/' + username + '/stats';
  }
  // /api/chesscom/player/:username/games/:year/:month
  const gamesJsonMatch = pathname.match(/^\/api\/chesscom\/player\/([^/]+)\/games\/(\d{4})\/(\d{1,2})$/);
  if (gamesJsonMatch) {
    const username = encodeURIComponent(decodeURIComponent(gamesJsonMatch[1]));
    const year = gamesJsonMatch[2];
    const month = String(parseInt(gamesJsonMatch[3], 10)).padStart(2, '0');
    return 'https://api.chess.com/pub/player/' + username + '/games/' + year + '/' + month;
  }
  // /api/chesscom/player/:username/games/:year/:month/pgn
  const gamesPgnMatch = pathname.match(/^\/api\/chesscom\/player\/([^/]+)\/games\/(\d{4})\/(\d{1,2})\/pgn$/);
  if (gamesPgnMatch) {
    return buildArchiveUpstreamUrl(gamesPgnMatch[1], gamesPgnMatch[2], gamesPgnMatch[3], 'pgn');
  }
  // /api/chesscom/player/:username/games/archives
  const archivesMatch = pathname.match(/^\/api\/chesscom\/player\/([^/]+)\/games\/archives$/);
  if (archivesMatch) {
    const username = encodeURIComponent(decodeURIComponent(archivesMatch[1]));
    return 'https://api.chess.com/pub/player/' + username + '/games/archives';
  }
  // /api/chesscom/archive/:username/:year/:month
  const archiveJsonAliasMatch = pathname.match(/^\/api\/chesscom\/archive\/([^/]+)\/(\d{4})\/(\d{1,2})$/);
  if (archiveJsonAliasMatch) {
    return buildArchiveUpstreamUrl(archiveJsonAliasMatch[1], archiveJsonAliasMatch[2], archiveJsonAliasMatch[3], 'json');
  }
  // /api/chesscom/archive/:username/:year/:month/pgn
  const archivePgnAliasMatch = pathname.match(/^\/api\/chesscom\/archive\/([^/]+)\/(\d{4})\/(\d{1,2})\/pgn$/);
  if (archivePgnAliasMatch) {
    return buildArchiveUpstreamUrl(archivePgnAliasMatch[1], archivePgnAliasMatch[2], archivePgnAliasMatch[3], 'pgn');
  }
  return null;
}

function createMiddleware() {
  return async function chesscomMiddleware(req, res, next) {
    const reqUrl = req.url || '';
    const [pathname, search] = reqUrl.split('?');
    if (req.method === 'GET' && pathname === '/router/chesscom') {
      sendText(res, 200, 'text/html; charset=utf-8', renderRouterPage(search || ''));
      return;
    }

    if (req.method !== 'GET' || !reqUrl.startsWith('/api/chesscom/')) {
      next();
      return;
    }

    const upstream = resolveUpstreamUrl(pathname, search || '');
    if (!upstream) {
      sendJson(res, 404, { ok: false, error: 'Unknown Chess.com proxy route' });
      return;
    }

    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[chesscom-bridge]', reqUrl, '->', upstream);
      }
      const result = await proxy(upstream);
      if (result.status === 404) {
        sendJson(res, 404, { ok: false, error: 'Not found on Chess.com', upstreamStatus: 404 });
        return;
      }
      if (result.status < 200 || result.status >= 300) {
        sendJson(res, 502, {
          ok: false,
          error: 'Chess.com upstream error',
          upstreamStatus: result.status
        });
        return;
      }
      sendText(res, 200, result.contentType, result.body);
    } catch (err) {
      sendJson(res, 502, {
        ok: false,
        error: err && err.message ? err.message : 'Chess.com proxy request failed'
      });
    }
  };
}

export function chesscomBridgeMiddleware() {
  return createMiddleware();
}

export function chesscomBridgePlugin() {
  return {
    name: 'chesscom-bridge',
    configureServer(server) {
      server.middlewares.use(createMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware());
    }
  };
}
