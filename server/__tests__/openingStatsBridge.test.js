import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openingStatsBridgeMiddleware } from '../openingStatsBridge.js';

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    end(body) { this.body = body; }
  };
}

function call(handler, url) {
  return new Promise((resolve) => {
    const req = { method: 'GET', url, headers: {}, socket: { remoteAddress: '127.0.0.1' } };
    const res = makeRes();
    let nextCalled = false;
    handler(req, res, () => { nextCalled = true; resolve({ res, nextCalled }); });
    // Async handlers settle on next tick.
    setTimeout(() => resolve({ res, nextCalled }), 0);
  });
}

describe('openingStatsBridge middleware', () => {
  let middleware;
  let originalFetch;

  beforeEach(() => {
    middleware = openingStatsBridgeMiddleware();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('passes through non-matching routes', async () => {
    const { nextCalled } = await call(middleware, '/api/something-else');
    expect(nextCalled).toBe(true);
  });

  it('rejects invalid slug', async () => {
    const { res } = await call(middleware, '/api/opening-stats?slug=Bad%20Slug&side=white');
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).ok).toBe(false);
  });

  it('rejects invalid side', async () => {
    const { res } = await call(middleware, '/api/opening-stats?slug=ruy-lopez&side=neutral');
    expect(res.statusCode).toBe(400);
  });

  it('parses upstream HTML and returns stats', async () => {
    const html = `
      <html><head>
        <title>Ruy Lopez Opening Statistics | TrueElo</title>
        <meta name="description" content="Ruy Lopez family has 1.2M games with 52.3% win rate. See 184 variations">
        <script type="application/ld+json">{"@type":"Dataset","temporalCoverage":"2024","dateModified":"2024-01-01"}</script>
      </head><body>
        <div title="Wins: 52.3%"></div>
        <div title="Draws: 27.1%"></div>
        <div title="Losses: 20.6%"></div>
      </body></html>
    `;
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => html
    });

    const { res } = await call(middleware, '/api/opening-stats?slug=ruy-lopez&side=white');
    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body);
    expect(payload.ok).toBe(true);
    expect(payload.slug).toBe('ruy-lopez');
    expect(payload.side).toBe('white');
    expect(payload.winRate).toBe(52.3);
    expect(payload.drawRate).toBe(27.1);
    expect(payload.lossRate).toBe(20.6);
    expect(payload.openingName).toMatch(/Ruy Lopez/i);
  });

  it('returns 404 when upstream is missing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 404,
      text: async () => 'not found'
    });
    const { res } = await call(middleware, '/api/opening-stats?slug=does-not-exist&side=black');
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).ok).toBe(false);
  });

  it('returns 502 on parse failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => '<html><body>nothing parseable</body></html>'
    });
    const { res } = await call(middleware, '/api/opening-stats?slug=parsefail-test&side=white');
    expect(res.statusCode).toBe(502);
  });
});
