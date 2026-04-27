import { describe, it, expect } from 'vitest';
import Chess from '../chess.js';

// Regression: in_draw() used to reference in_stalemate() as a free function
// that was never defined, so calling it threw ReferenceError. These tests
// cover the call paths that previously crashed.
describe('Chess.in_draw()', () => {
  it('does not throw and returns false from the starting position', () => {
    const chess = Chess();
    expect(() => chess.in_draw()).not.toThrow();
    expect(chess.in_draw()).toBe(false);
  });

  it('does not throw after ordinary moves', () => {
    const chess = Chess();
    chess.move('e4');
    chess.move('e5');
    expect(() => chess.in_draw()).not.toThrow();
    expect(chess.in_draw()).toBe(false);
  });

  it('returns true for insufficient material (K vs K)', () => {
    const chess = Chess();
    expect(chess.load('8/8/8/4k3/8/4K3/8/8 w - - 0 1')).toBe(true);
    expect(chess.in_draw()).toBe(true);
  });

  it('returns true when the 50-move rule is reached', () => {
    const chess = Chess();
    // Endgame position with only minor pieces shuffling; halfmove clock at 100 triggers draw.
    expect(chess.load('8/8/8/3k4/8/3K4/8/7N w - - 100 60')).toBe(true);
    expect(chess.in_draw()).toBe(true);
  });
});
