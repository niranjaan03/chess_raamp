import { describe, it, expect } from 'vitest';
import { lichessBridgeMiddleware } from '../lichessBridge.js';

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
    handler(req, res, () => resolve({ res, nextCalled: true }));
    setTimeout(() => resolve({ res, nextCalled: false }), 0);
  });
}

describe('lichessBridge middleware', () => {
  const middleware = lichessBridgeMiddleware();

  it('skips non-lichess routes', async () => {
    const { nextCalled } = await call(middleware, '/api/something/else');
    expect(nextCalled).toBe(true);
  });

  it('returns 404 for unknown lichess routes', async () => {
    const { res } = await call(middleware, '/api/lichess/unknown/route');
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).ok).toBe(false);
  });

  it('rejects invalid game id length', async () => {
    const { res } = await call(middleware, '/api/lichess/game/short/export');
    expect(res.statusCode).toBe(404);
  });

  it('rejects POST methods', async () => {
    const handler = lichessBridgeMiddleware();
    let nextCalled = false;
    const req = { method: 'POST', url: '/api/lichess/user/foo/games', headers: {}, socket: { remoteAddress: '127.0.0.1' } };
    const res = makeRes();
    await new Promise((resolve) => {
      handler(req, res, () => { nextCalled = true; resolve(); });
      setTimeout(resolve, 0);
    });
    expect(nextCalled).toBe(true);
  });
});
