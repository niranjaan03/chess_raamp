import { describe, it, expect } from 'vitest';
import { chesscomBridgeMiddleware } from '../chesscomBridge.js';

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    end(body) { this.body = body; }
  };
}

function call(handler, url, method = 'GET') {
  return new Promise((resolve) => {
    const req = { method, url, headers: {}, socket: { remoteAddress: '127.0.0.1' } };
    const res = makeRes();
    handler(req, res, () => resolve({ res, nextCalled: true }));
    setTimeout(() => resolve({ res, nextCalled: false }), 0);
  });
}

describe('chesscomBridge middleware', () => {
  const middleware = chesscomBridgeMiddleware();

  it('skips non-chesscom routes', async () => {
    const { nextCalled } = await call(middleware, '/api/something/else');
    expect(nextCalled).toBe(true);
  });

  it('returns 404 for unknown chesscom routes', async () => {
    const { res } = await call(middleware, '/api/chesscom/bogus/path');
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).ok).toBe(false);
  });

  it('serves the router HTML page', async () => {
    const { res } = await call(middleware, '/router/chesscom');
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toMatch(/html/);
    expect(res.body).toContain('Chess.com Router Page');
  });

  it('escapes user-supplied router-page query params', async () => {
    const { res } = await call(middleware, '/router/chesscom?username=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('<script>alert(1)</script>');
    expect(res.body).toContain('&lt;script&gt;');
  });

  it('skips POST methods', async () => {
    const { nextCalled } = await call(middleware, '/api/chesscom/player/test', 'POST');
    expect(nextCalled).toBe(true);
  });
});
