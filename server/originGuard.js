// Block cross-site browser fetches against the API bridges.
//
// CSRF is mostly a non-issue here because every bridge is GET-only and
// we don't read cookies. The realistic attack is a malicious site
// driving traffic through the local proxy to consume the per-IP rate
// budget or to mask its own outbound requests behind the user's IP.
//
// Strategy: trust `Sec-Fetch-Site` (sent by every modern browser since
// 2020). Allow `same-origin`, `same-site`, and `none` (direct nav,
// non-browser). Reject `cross-site` unless the `Origin` header is on
// an explicit allowlist (env: ORIGIN_ALLOWLIST=comma,separated,list).

function parseAllowlist(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function createOriginGuard({
  pathPrefix = '/',
  allowlist = parseAllowlist(process.env.ORIGIN_ALLOWLIST)
} = {}) {
  return function originGuardMiddleware(req, res, next) {
    const url = req.url || '';
    if (!url.startsWith(pathPrefix)) {
      next();
      return;
    }
    const headers = req.headers || {};
    const fetchSite = headers['sec-fetch-site'];
    const origin = headers.origin || '';

    // Non-browser clients (curl, server-to-server) usually omit Sec-Fetch-Site.
    if (!fetchSite) {
      // If a browser bothered to send Origin, hold it to the allowlist.
      if (origin && allowlist.length && !allowlist.includes(origin)) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'Origin not allowed' }));
        return;
      }
      next();
      return;
    }

    if (fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none') {
      next();
      return;
    }

    if (fetchSite === 'cross-site' && origin && allowlist.includes(origin)) {
      next();
      return;
    }

    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Cross-site request blocked' }));
  };
}
