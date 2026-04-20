import { describe, it, expect } from 'vitest';
import { MoveClassification, UI_QUALITY_BY_CLASSIFICATION } from '../chesskit/enums.js';
import { getMoveBasicClassification } from '../chesskit/moveClassification.js';

// ── MoveClassification enum ────────────────────────────────────────────────────

describe('MoveClassification enum', () => {
  it('has all expected keys', () => {
    const expected = [
      'Opening', 'Forced', 'Splendid', 'Perfect',
      'Best', 'Excellent', 'Okay', 'Inaccuracy', 'Mistake', 'Blunder',
    ];
    for (const key of expected) {
      expect(MoveClassification).toHaveProperty(key);
    }
  });

  it('values are lowercase strings', () => {
    for (const v of Object.values(MoveClassification)) {
      expect(typeof v).toBe('string');
      expect(v).toBe(v.toLowerCase());
    }
  });

  it('is frozen (immutable)', () => {
    expect(Object.isFrozen(MoveClassification)).toBe(true);
  });

  it('Blunder value is "blunder"', () => {
    expect(MoveClassification.Blunder).toBe('blunder');
  });

  it('Splendid maps to the brilliant UI bucket', () => {
    expect(UI_QUALITY_BY_CLASSIFICATION[MoveClassification.Splendid]).toBe('brilliant');
  });
});

// ── UI_QUALITY_BY_CLASSIFICATION ───────────────────────────────────────────────

describe('UI_QUALITY_BY_CLASSIFICATION', () => {
  it('covers every MoveClassification value', () => {
    for (const v of Object.values(MoveClassification)) {
      expect(UI_QUALITY_BY_CLASSIFICATION).toHaveProperty(v);
    }
  });

  const cases = [
    [MoveClassification.Opening,    'book'],
    [MoveClassification.Splendid,   'brilliant'],
    [MoveClassification.Perfect,    'great'],
    [MoveClassification.Best,       'best'],
    [MoveClassification.Excellent,  'excellent'],
    [MoveClassification.Okay,       'good'],
    [MoveClassification.Forced,     'good'],
    [MoveClassification.Inaccuracy, 'inaccuracy'],
    [MoveClassification.Mistake,    'mistake'],
    [MoveClassification.Blunder,    'blunder'],
  ];
  it.each(cases)('%s → %s', (classification, uiBucket) => {
    expect(UI_QUALITY_BY_CLASSIFICATION[classification]).toBe(uiBucket);
  });
});

// ── getMoveBasicClassification thresholds ──────────────────────────────────────
//
// winPercentageDiff = (posWP - prevWP) * (isWhiteMove ? 1 : -1)
// < -20 → Blunder, < -10 → Mistake, < -5 → Inaccuracy, < -2 → Okay, else → Excellent

describe('getMoveBasicClassification — white to move', () => {
  // isWhiteMove = true → diff = posWP - prevWP

  it('classifies as Blunder when win% drops > 20', () => {
    // diff = 20 - 50 = -30 < -20
    expect(getMoveBasicClassification(50, 20, true)).toBe(MoveClassification.Blunder);
  });

  it('classifies as Mistake when win% drops 11–20', () => {
    // diff = 35 - 50 = -15
    expect(getMoveBasicClassification(50, 35, true)).toBe(MoveClassification.Mistake);
  });

  it('classifies as Inaccuracy when win% drops 6–10', () => {
    // diff = 43 - 50 = -7
    expect(getMoveBasicClassification(50, 43, true)).toBe(MoveClassification.Inaccuracy);
  });

  it('classifies as Okay when win% drops 3–5', () => {
    // diff = 47 - 50 = -3
    expect(getMoveBasicClassification(50, 47, true)).toBe(MoveClassification.Okay);
  });

  it('classifies as Excellent when win% drop ≤ 2', () => {
    // diff = 49 - 50 = -1
    expect(getMoveBasicClassification(50, 49, true)).toBe(MoveClassification.Excellent);
  });

  it('classifies as Excellent when position improves', () => {
    // diff = 60 - 50 = +10
    expect(getMoveBasicClassification(50, 60, true)).toBe(MoveClassification.Excellent);
  });

  it('boundary: exactly -20 is Mistake not Blunder', () => {
    expect(getMoveBasicClassification(50, 30, true)).toBe(MoveClassification.Mistake);
  });

  it('boundary: exactly -10 is Inaccuracy not Mistake', () => {
    expect(getMoveBasicClassification(50, 40, true)).toBe(MoveClassification.Inaccuracy);
  });

  it('boundary: exactly -5 is Okay not Inaccuracy', () => {
    expect(getMoveBasicClassification(50, 45, true)).toBe(MoveClassification.Okay);
  });

  it('boundary: exactly -2 is Excellent not Okay', () => {
    expect(getMoveBasicClassification(50, 48, true)).toBe(MoveClassification.Excellent);
  });
});

describe('getMoveBasicClassification — black to move', () => {
  // isWhiteMove = false → diff = -(posWP - prevWP) = prevWP - posWP
  // A win% drop for Black means white's win% INCREASES

  it('Blunder when white win% rises > 20 (bad for Black)', () => {
    // prevWP=50, posWP=80 → diff = -(80-50) = -30 < -20
    expect(getMoveBasicClassification(50, 80, false)).toBe(MoveClassification.Blunder);
  });

  it('Mistake when white win% rises 11–20', () => {
    // prevWP=50, posWP=65 → diff = -15
    expect(getMoveBasicClassification(50, 65, false)).toBe(MoveClassification.Mistake);
  });

  it('Excellent when Black improves position (white win% drops)', () => {
    // prevWP=50, posWP=30 → diff = -(30-50) = +20
    expect(getMoveBasicClassification(50, 30, false)).toBe(MoveClassification.Excellent);
  });
});
