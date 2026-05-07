import { describe, it, expect } from 'vitest';
import { createOriginGuard } from '../originGuard.js';

function mock(url, headers = {}) {
  const resHeaders = {};
  return {
    req: { url, headers, socket: { remoteAddress: '1.1.1.1' } },
    res: {
      statusCode: 200,
      setHeader(k, v) { resHeaders[k] = v; },
      end(body) { this.body = body; },
      headers: resHeaders
    }
  };
}

describe('createOriginGuard', () => {
  it('skips paths outside the prefix', () => {
    const guard = createOriginGuard({ pathPrefix: '/api/' });
    let called = 0;
    const { req, res } = mock('/static/asset.js', { 'sec-fetch-site': 'cross-site' });
    guard(req, res, () => { called++; });
    expect(called).toBe(1);
  });

  it('allows same-origin browser fetches', () => {
    const guard = createOriginGuard({ pathPrefix: '/api/' });
    let called = 0;
    const { req, res } = mock('/api/x', { 'sec-fetch-site': 'same-origin' });
    guard(req, res, () => { called++; });
    expect(called).toBe(1);
    expect(res.statusCode).toBe(200);
  });

  it('allows direct navigation (Sec-Fetch-Site: none)', () => {
    const guard = createOriginGuard({ pathPrefix: '/api/' });
    let called = 0;
    const { req, res } = mock('/api/x', { 'sec-fetch-site': 'none' });
    guard(req, res, () => { called++; });
    expect(called).toBe(1);
  });

  it('blocks cross-site browser fetches without an allowlist match', () => {
    const guard = createOriginGuard({ pathPrefix: '/api/', allowlist: [] });
    let called = 0;
    const { req, res } = mock('/api/x', {
      'sec-fetch-site': 'cross-site',
      origin: 'https://evil.example'
    });
    guard(req, res, () => { called++; });
    expect(called).toBe(0);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).ok).toBe(false);
  });

  it('allows cross-site fetches when origin is on the allowlist', () => {
    const guard = createOriginGuard({ pathPrefix: '/api/', allowlist: ['https://partner.example'] });
    let called = 0;
    const { req, res } = mock('/api/x', {
      'sec-fetch-site': 'cross-site',
      origin: 'https://partner.example'
    });
    guard(req, res, () => { called++; });
    expect(called).toBe(1);
  });

  it('allows server-to-server requests with no Sec-Fetch-Site', () => {
    const guard = createOriginGuard({ pathPrefix: '/api/' });
    let called = 0;
    const { req, res } = mock('/api/x', {});
    guard(req, res, () => { called++; });
    expect(called).toBe(1);
  });

  it('still rejects browser-like requests with mismatched Origin and no Sec-Fetch-Site', () => {
    const guard = createOriginGuard({ pathPrefix: '/api/', allowlist: ['https://allowed.example'] });
    let called = 0;
    const { req, res } = mock('/api/x', { origin: 'https://evil.example' });
    guard(req, res, () => { called++; });
    expect(called).toBe(0);
    expect(res.statusCode).toBe(403);
  });
});
