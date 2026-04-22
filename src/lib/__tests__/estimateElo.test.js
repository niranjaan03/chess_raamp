import { describe, it, expect } from 'vitest';

import { computeEstimatedElo } from '../chesskit/estimateElo.js';

describe('computeEstimatedElo', () => {
  it('returns undefined when only one side has moved', () => {
    const positions = [
      { lines: [{ cp: 0 }] },
      { lines: [{ cp: 20 }] },
    ];

    expect(computeEstimatedElo(positions, 1200, 1200)).toBeUndefined();
  });

  it('returns finite values once both players have at least one move', () => {
    const positions = [
      { lines: [{ cp: 0 }] },
      { lines: [{ cp: 20 }] },
      { lines: [{ cp: 0 }] },
    ];

    const estimated = computeEstimatedElo(positions, 1200, 1200);

    expect(estimated).toBeDefined();
    expect(Number.isFinite(estimated.white)).toBe(true);
    expect(Number.isFinite(estimated.black)).toBe(true);
  });
});
