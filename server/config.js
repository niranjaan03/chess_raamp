// Validates and exposes the server's runtime configuration. Failing
// fast on misconfiguration is better than a confused-deputy startup
// where, e.g., PORT silently falls back to 3000 because someone wrote
// `PORT=8O80` (letter O instead of zero).
//
// Returns a frozen config object. Throws on validation failure.

import fs from 'node:fs';

function parseInteger(rawValue, { min, max, name }) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return null;
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer (got ${JSON.stringify(rawValue)})`);
  }
  if (typeof min === 'number' && parsed < min) {
    throw new Error(`${name} must be >= ${min} (got ${parsed})`);
  }
  if (typeof max === 'number' && parsed > max) {
    throw new Error(`${name} must be <= ${max} (got ${parsed})`);
  }
  return parsed;
}

function parseHost(rawHost) {
  if (!rawHost) return '0.0.0.0';
  const host = String(rawHost).trim();
  if (!host) return '0.0.0.0';
  // Accept anything but obvious nonsense (whitespace, control chars).
  // eslint-disable-next-line no-control-regex -- intentional control-char validation
  if (/[\s\x00-\x1f]/.test(host)) {
    throw new Error(`HOST contains invalid characters: ${JSON.stringify(rawHost)}`);
  }
  return host;
}

function resolvePythonBin(envValue, fallbackVenvPath) {
  if (envValue) {
    if (!fs.existsSync(envValue)) {
      throw new Error(`PYTHON_BIN points to a missing file: ${envValue}`);
    }
    return envValue;
  }
  if (fs.existsSync(fallbackVenvPath)) return fallbackVenvPath;
  return 'python3';
}

export function loadServerConfig({ env = process.env, venvPython } = {}) {
  const port = parseInteger(env.PORT, { min: 1, max: 65535, name: 'PORT' }) ?? 3000;
  const host = parseHost(env.HOST);
  const pythonBin = resolvePythonBin(env.PYTHON_BIN, venvPython || '');
  const nodeEnv = env.NODE_ENV || 'development';

  const config = Object.freeze({
    port,
    host,
    pythonBin,
    nodeEnv,
    isProduction: nodeEnv === 'production'
  });
  return config;
}
