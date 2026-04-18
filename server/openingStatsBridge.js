const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const cache = new Map();

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function decodeHtml(text) {
  return String(text || '')
    .replace(/&#x27;|&#39;/g, '\'')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function readCached(cacheKey) {
  const cached = cache.get(cacheKey);
  if (!cached) return null;
  if ((Date.now() - cached.at) > CACHE_TTL_MS) {
    cache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

function writeCached(cacheKey, value) {
  cache.set(cacheKey, {
    at: Date.now(),
    value
  });
}

async function fetchTrueEloPage(slug, side) {
  const url = 'https://trueelo.app/stats/' + encodeURIComponent(slug) + '?side=' + encodeURIComponent(side);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'chess-ramp/1.0 (+local dev; contact: owner@localhost)',
      'Accept': 'text/html,application/xhtml+xml'
    },
    redirect: 'follow'
  });

  return {
    status: response.status,
    body: await response.text(),
    url
  };
}

function extractDataset(html) {
  const matches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && parsed['@type'] === 'Dataset') {
        return parsed;
      }
    } catch (err) {
      // Ignore malformed JSON-LD blocks and keep scanning.
    }
  }
  return null;
}

function parseTrueEloStats(html, slug, side, sourceUrl) {
  const descriptionMatch = html.match(/<meta name="description" content="([^"]+)"/i);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const winsMatch = html.match(/title="Wins:\s*([0-9.]+)%"/i);
  const drawsMatch = html.match(/title="Draws:\s*([0-9.]+)%"/i);
  const lossesMatch = html.match(/title="Losses:\s*([0-9.]+)%"/i);
  const description = decodeHtml(descriptionMatch ? descriptionMatch[1] : '');
  const pageTitle = decodeHtml(titleMatch ? titleMatch[1] : '').replace(/\s*\|\s*TrueElo.*$/, '').trim();
  const dataset = extractDataset(html);

  let openingName = pageTitle.replace(/\s+Opening Statistics$/i, '').trim();
  let games = '';
  let variations = null;
  let winRate = winsMatch ? parseFloat(winsMatch[1]) : null;
  let drawRate = drawsMatch ? parseFloat(drawsMatch[1]) : null;
  let lossRate = lossesMatch ? parseFloat(lossesMatch[1]) : null;

  const summaryMatch = description.match(/^(.*?) family has ([0-9.,]+[KMB]?) games with ([0-9.]+)% win rate\. See ([0-9,]+) variations/i);
  if (summaryMatch) {
    openingName = decodeHtml(summaryMatch[1]).trim() || openingName;
    games = summaryMatch[2];
    if (!Number.isFinite(winRate)) winRate = parseFloat(summaryMatch[3]);
    variations = parseInt(summaryMatch[4].replace(/,/g, ''), 10);
  }

  if (!openingName) openingName = slug.replace(/-/g, ' ').trim();
  if (!Number.isFinite(winRate)) {
    throw new Error('Could not parse win rate from upstream stats page');
  }

  return {
    ok: true,
    slug,
    side,
    openingName,
    winRate: Number(winRate.toFixed(1)),
    drawRate: Number.isFinite(drawRate) ? Number(drawRate.toFixed(1)) : null,
    lossRate: Number.isFinite(lossRate) ? Number(lossRate.toFixed(1)) : null,
    games,
    variations: Number.isFinite(variations) ? variations : null,
    source: 'trueelo',
    sourceName: 'TrueElo',
    sourceUrl,
    description,
    temporalCoverage: dataset && dataset.temporalCoverage ? dataset.temporalCoverage : '',
    dateModified: dataset && dataset.dateModified ? dataset.dateModified : ''
  };
}

function createMiddleware() {
  return async function openingStatsMiddleware(req, res, next) {
    const reqUrl = req.url || '';
    if (req.method !== 'GET' || !reqUrl.startsWith('/api/opening-stats')) {
      next();
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(reqUrl, 'http://localhost');
    } catch (err) {
      sendJson(res, 400, { ok: false, error: 'Invalid request URL' });
      return;
    }

    const slug = String(parsedUrl.searchParams.get('slug') || '').trim().toLowerCase();
    const side = String(parsedUrl.searchParams.get('side') || '').trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      sendJson(res, 400, { ok: false, error: 'Invalid opening stats slug' });
      return;
    }
    if (side !== 'white' && side !== 'black') {
      sendJson(res, 400, { ok: false, error: 'Invalid opening stats side' });
      return;
    }

    const cacheKey = slug + '::' + side;
    const cached = readCached(cacheKey);
    if (cached) {
      sendJson(res, cached.ok === false ? 404 : 200, cached);
      return;
    }

    try {
      const upstream = await fetchTrueEloPage(slug, side);
      if (upstream.status === 404) {
        const missing = {
          ok: false,
          slug,
          side,
          error: 'Opening stats page not found'
        };
        writeCached(cacheKey, missing);
        sendJson(res, 404, missing);
        return;
      }
      if (upstream.status < 200 || upstream.status >= 300) {
        sendJson(res, 502, {
          ok: false,
          slug,
          side,
          error: 'Opening stats upstream error',
          upstreamStatus: upstream.status
        });
        return;
      }

      const stats = parseTrueEloStats(upstream.body, slug, side, upstream.url);
      writeCached(cacheKey, stats);
      sendJson(res, 200, stats);
    } catch (err) {
      sendJson(res, 502, {
        ok: false,
        slug,
        side,
        error: err && err.message ? err.message : 'Opening stats request failed'
      });
    }
  };
}

export function openingStatsBridgeMiddleware() {
  return createMiddleware();
}

export function openingStatsBridgePlugin() {
  return {
    name: 'opening-stats-bridge',
    configureServer(server) {
      server.middlewares.use(createMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware());
    }
  };
}
