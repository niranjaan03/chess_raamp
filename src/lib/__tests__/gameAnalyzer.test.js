import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';

import { analyzeGameWithChessKit } from '../chesskit/gameAnalyzer.js';

describe('analyzeGameWithChessKit', () => {
  it('rejects failed batch results instead of fabricating neutral analysis', async () => {
    const game = new Chess();
    const startFen = game.fen();
    game.move('e4');
    const afterE4Fen = game.fen();

    const history = [
      { from: 'e2', to: 'e4', color: 'w', san: 'e4' },
    ];

    const batchResults = [
      { ok: false, error: 'Batch analysis request failed', bestmove: null, lines: [] },
      { ok: false, error: 'Batch analysis request failed', bestmove: null, lines: [] },
    ];

    await expect(analyzeGameWithChessKit({
      history,
      positions: [startFen, afterE4Fen],
      batchResults,
      meta: null
    })).rejects.toThrow('Batch analysis request failed');
  });

  it('rejects empty engine lines for non-terminal positions', async () => {
    const game = new Chess();
    const startFen = game.fen();
    game.move('e4');
    const afterE4Fen = game.fen();

    const history = [
      { from: 'e2', to: 'e4', color: 'w', san: 'e4' },
    ];

    const batchResults = [
      {
        ok: true,
        bestmove: 'e2e4',
        lines: [{ line: 1, eval: '0.20', depth: 12, pv: 'e2e4' }]
      },
      { ok: true, bestmove: null, lines: [] },
    ];

    await expect(analyzeGameWithChessKit({
      history,
      positions: [startFen, afterE4Fen],
      batchResults,
      meta: null
    })).rejects.toThrow('Engine analysis returned no candidate lines for a non-terminal position.');
  });
});
