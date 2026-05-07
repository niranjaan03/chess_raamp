// Tiny in-process token-bucket rate limiter. Connect-style middleware,
// works in both Vite dev/preview and the Express production server.
//
// Per-IP keys with a fixed-size LRU cap so a flood of unique IPs cannot
// exhaust memory. No external dependencies.

function getClientIp(req) {
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

export function createRateLimiter({
  windowMs = 60_000,
  max = 60,
  pathPrefix = '/',
  maxKeys = 10_000,
  message = 'Too many requests'
} = {}) {
  const buckets = new Map();

  function evictIfFull() {
    if (buckets.size <= maxKeys) return;
    // Oldest insertion is first in Map iteration order.
    const firstKey = buckets.keys().next().value;
    if (firstKey !== undefined) buckets.delete(firstKey);
  }

  return function rateLimitMiddleware(req, res, next) {
    const url = req.url || '';
    if (!url.startsWith(pathPrefix)) {
      next();
      return;
    }
    const ip = getClientIp(req);
    const now = Date.now();
    let bucket = buckets.get(ip);
    if (!bucket || now - bucket.windowStart > windowMs) {
      bucket = { windowStart: now, count: 0 };
      // Reinsert so this key becomes the most-recent in iteration order.
      buckets.delete(ip);
      buckets.set(ip, bucket);
      evictIfFull();
    }
    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil((bucket.windowStart + windowMs) / 1000)));

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.windowStart + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.statusCode = 429;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: message }));
      return;
    }
    next();
  };
}
