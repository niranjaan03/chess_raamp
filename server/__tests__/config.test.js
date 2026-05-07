import { describe, it, expect } from 'vitest';
import { loadServerConfig } from '../config.js';

describe('loadServerConfig', () => {
  it('uses sensible defaults when env is empty', () => {
    const config = loadServerConfig({ env: {} });
    expect(config.port).toBe(3000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.pythonBin).toBe('python3');
    expect(config.nodeEnv).toBe('development');
    expect(config.isProduction).toBe(false);
  });

  it('accepts a valid PORT', () => {
    const config = loadServerConfig({ env: { PORT: '8080' } });
    expect(config.port).toBe(8080);
  });

  it('rejects non-numeric PORT', () => {
    expect(() => loadServerConfig({ env: { PORT: '8O80' } })).toThrow(/PORT must be an integer/);
  });

  it('rejects out-of-range PORT', () => {
    expect(() => loadServerConfig({ env: { PORT: '0' } })).toThrow(/PORT must be >= 1/);
    expect(() => loadServerConfig({ env: { PORT: '99999' } })).toThrow(/PORT must be <= 65535/);
  });

  it('rejects HOST with control characters', () => {
    expect(() => loadServerConfig({ env: { HOST: 'foo bar' } })).toThrow(/HOST contains invalid/);
  });

  it('marks production when NODE_ENV=production', () => {
    const config = loadServerConfig({ env: { NODE_ENV: 'production' } });
    expect(config.isProduction).toBe(true);
  });

  it('rejects PYTHON_BIN pointing to a missing file', () => {
    expect(() => loadServerConfig({ env: { PYTHON_BIN: '/no/such/python' } })).toThrow(/missing file/);
  });
});
