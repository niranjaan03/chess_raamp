// Reproduce: fetch -> analyze -> stats end-to-end against the live dev server.
// Mirrors EngineController.analyzeGame() / analyzeGameWithChessKit() exactly.

import { Chess } from 'chess.js';
import PGNParser from '/Users/niranjaan/Downloads/chess_raamp-main/src/lib/pgn-parser.js';
import { analyzeGameWithChessKit } from '/Users/niranjaan/Downloads/chess_raamp-main/src/lib/chesskit/gameAnalyzer.js';

const BASE = 'http://localhost:5173';

// Tiny well-known game: Scholar's Mate (4 plies).
const PGN = `[Event "Repro"]\n[White "W"]\n[Black "B"]\n[Result "1-0"]\n\n1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0`;

async function postJson(url, body) {
  const r = await fetch(BASE + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.json();
}

async function main() {
  const parsed = PGNParser.parse(PGN);
  if (!parsed) throw new Error('PGN parse returned null');
  console.log('PGN parsed: moves=', parsed.moves.length);

  const positions = PGNParser.buildPositions(parsed).map((p) => p.fen);
  console.log('positions:', positions.length);

  // Hit batch endpoint at the same depth/multipv the EngineController uses for
  // a small game (totalPositions <= 45 -> depth 13, chunkSize 48, multiPv 2).
  const r = await postJson('/api/engine/analyze-batch', {
    positions,
    depth: 13,
    multiPv: 2,
  });
  if (!r.ok) throw new Error('batch ok=false');
  console.log('batch results:', r.results.length, 'first lines:', r.results[0]?.lines?.length);

  const summary = analyzeGameWithChessKit({
    history: parsed.moves,
    positions,
    batchResults: r.results,
    meta: null,
  });

  console.log('---STATS---');
  console.log('classifiedHistory.length:', summary.classifiedHistory.length);
  console.log('accuracy:', summary.accuracy);
  console.log('estimatedElo:', summary.estimatedElo);
  console.log('openings:', summary.openings.slice(0, 3));
  const counts = {};
  summary.classifiedHistory.forEach((m) => {
    counts[m.quality] = (counts[m.quality] || 0) + 1;
  });
  console.log('quality buckets:', counts);
  console.log('first move:', summary.classifiedHistory[0]);
}

main().catch((e) => { console.error('FAIL:', e); process.exit(1); });
