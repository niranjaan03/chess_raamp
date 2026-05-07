import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRateLimiter } from '../rateLimit.js';

function mockReqRes(url, ip = '1.2.3.4') {
  const headers = {};
  return {
    req: { url, headers: {}, socket: { remoteAddress: ip } },
    res: {
      headers,
      statusCode: 200,
      setHeader(k, v) { headers[k] = v; },
      end(body) { this.body = body; }
    }
  };
}

describe('createRateLimiter', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('passes requests under the limit through', () => {
    const limiter = createRateLimiter({ pathPrefix: '/api/x', max: 3, windowMs: 1000 });
    let called = 0;
    for (let i = 0; i < 3; i++) {
      const { req, res } = mockReqRes('/api/x/test');
      limiter(req, res, () => { called++; });
    }
    expect(called).toBe(3);
  });

  it('rejects requests over the limit with 429', () => {
    const limiter = createRateLimiter({ pathPrefix: '/api/x', max: 2, windowMs: 1000 });
    let nextCalled = 0;
    for (let i = 0; i < 4; i++) {
      const { req, res } = mockReqRes('/api/x/test');
      limiter(req, res, () => { nextCalled++; });
      if (i >= 2) {
        expect(res.statusCode).toBe(429);
        expect(JSON.parse(res.body).ok).toBe(false);
      }
    }
    expect(nextCalled).toBe(2);
  });

  it('does not apply to paths outside the prefix', () => {
    const limiter = createRateLimiter({ pathPrefix: '/api/x', max: 1, windowMs: 1000 });
    let called = 0;
    for (let i = 0; i < 5; i++) {
      const { req, res } = mockReqRes('/api/y/other');
      limiter(req, res, () => { called++; });
    }
    expect(called).toBe(5);
  });

  it('isolates buckets per IP', () => {
    const limiter = createRateLimiter({ pathPrefix: '/api/x', max: 1, windowMs: 1000 });
    let called = 0;
    const a = mockReqRes('/api/x/a', '1.1.1.1');
    const b = mockReqRes('/api/x/b', '2.2.2.2');
    limiter(a.req, a.res, () => { called++; });
    limiter(b.req, b.res, () => { called++; });
    expect(called).toBe(2);
    // Both IPs at the limit; another from .1.1.1.1 should be blocked
    const a2 = mockReqRes('/api/x/a', '1.1.1.1');
    limiter(a2.req, a2.res, () => { called++; });
    expect(a2.res.statusCode).toBe(429);
    expect(called).toBe(2);
  });

  it('resets after the window elapses', () => {
    const limiter = createRateLimiter({ pathPrefix: '/api/x', max: 1, windowMs: 1000 });
    let called = 0;
    const a = mockReqRes('/api/x/a');
    limiter(a.req, a.res, () => { called++; });
    const b = mockReqRes('/api/x/a');
    limiter(b.req, b.res, () => { called++; });
    expect(b.res.statusCode).toBe(429);
    vi.advanceTimersByTime(1500);
    const c = mockReqRes('/api/x/a');
    limiter(c.req, c.res, () => { called++; });
    expect(called).toBe(2);
  });

  it('honors X-Forwarded-For first hop', () => {
    const limiter = createRateLimiter({ pathPrefix: '/api/x', max: 1, windowMs: 1000 });
    const r1 = {
      req: { url: '/api/x/a', headers: { 'x-forwarded-for': '9.9.9.9, 1.1.1.1' }, socket: { remoteAddress: '127.0.0.1' } },
      res: { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end() {} }
    };
    let called = 0;
    limiter(r1.req, r1.res, () => { called++; });
    const r2 = {
      req: { url: '/api/x/a', headers: { 'x-forwarded-for': '9.9.9.9' }, socket: { remoteAddress: '127.0.0.1' } },
      res: { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } }
    };
    limiter(r2.req, r2.res, () => { called++; });
    expect(r2.res.statusCode).toBe(429);
    expect(called).toBe(1);
  });
});
