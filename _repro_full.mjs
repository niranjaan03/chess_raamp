// Full end-to-end repro: fetch a real Lichess game via the dev proxy, parse,
// hit /api/engine/analyze-batch, run the chess kit pipeline, print stats.

import PGNParser from './src/lib/pgn-parser.js';
import { analyzeGameWithChessKit } from './src/lib/chesskit/gameAnalyzer.js';

const BASE = 'http://localhost:5173';

async function postJson(url, body) {
  const r = await fetch(BASE + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.json();
}

async function fetchOneLichessPgn(user) {
  const url = `${BASE}/api/lichess/user/${user}/games?max=1&clocks=false&evals=false&opening=true&pgnInJson=true`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('lichess HTTP ' + r.status);
  const text = await r.text();
  const line = text.trim().split('\n').filter(Boolean)[0];
  if (!line) throw new Error('no games');
  const game = JSON.parse(line);
  return { id: game.id, pgn: game.pgn };
}

function getReviewProfile(total) {
  if (total > 140) return { depth: 9, chunkSize: 96 };
  if (total > 100) return { depth: 10, chunkSize: 80 };
  if (total > 70)  return { depth: 11, chunkSize: 72 };
  if (total > 45)  return { depth: 12, chunkSize: 64 };
  return { depth: 13, chunkSize: 48 };
}

async function batchAnalyze(positions, depth, chunkSize) {
  const results = new Array(positions.length);
  for (let cursor = 0; cursor < positions.length; cursor += chunkSize) {
    const chunk = positions.slice(cursor, cursor + chunkSize);
    const r = await postJson('/api/engine/analyze-batch', {
      positions: chunk, depth, multiPv: 2,
    });
    if (!r.ok) throw new Error('batch returned ok=false');
    for (let i = 0; i < chunk.length; i++) {
      results[cursor + i] = r.results[i] || { ok: false, bestmove: null, lines: [] };
    }
    process.stdout.write(`  progress: ${Math.min(cursor + chunk.length, positions.length)}/${positions.length}\r`);
  }
  process.stdout.write('\n');
  return results;
}

async function main() {
  const user = process.argv[2] || 'DrNykterstein';
  console.log('1) Fetching real game from Lichess for', user);
  const { id, pgn } = await fetchOneLichessPgn(user);
  console.log('   game id:', id, 'pgn bytes:', pgn.length);

  console.log('2) Parsing PGN');
  const parsedFull = PGNParser.parse(pgn);
  if (!parsedFull) throw new Error('PGN parse returned null');

  const parsed = parsedFull;
  const positions = PGNParser.buildPositions(parsed).map((p) => p.fen);
  console.log('   moves:', parsed.moves.length, 'positions:', positions.length);

  const profile = { depth: 8, chunkSize: 64 };
  console.log('3) Engine batch analyze', positions.length, 'positions @ depth', profile.depth);
  const results = await batchAnalyze(positions, profile.depth, profile.chunkSize);
  const okCount = results.filter((r) => r && r.ok).length;
  console.log('   batch ok:', okCount + '/' + results.length);

  console.log('4) Running chess kit pipeline');
  const summary = analyzeGameWithChessKit({
    history: parsed.moves,
    positions,
    batchResults: results,
    meta: {
      whiteElo: parseInt(parsed.whiteElo, 10) || undefined,
      blackElo: parseInt(parsed.blackElo, 10) || undefined,
    },
  });

  console.log('\n=== ANALYSIS STATS ===');
  console.log('classifiedHistory.length:', summary.classifiedHistory.length);
  console.log('accuracy:', summary.accuracy);
  console.log('estimatedElo:', summary.estimatedElo);
  console.log('openings (first 5):', summary.openings.slice(0, 5));
  const counts = { w: {}, b: {} };
  summary.classifiedHistory.forEach((m) => {
    counts[m.color][m.quality] = (counts[m.color][m.quality] || 0) + 1;
  });
  console.log('quality buckets W:', counts.w);
  console.log('quality buckets B:', counts.b);
  console.log('first 3 classified moves:', summary.classifiedHistory.slice(0, 3).map((m) => ({
    san: m.san, quality: m.quality, classification: m.classification,
    evalBefore: m.evalBefore, evalAfter: m.evalAfter,
    winPercentLoss: Number(m.winPercentLoss.toFixed(2)),
  })));

  // Hard assertions on "non-empty real stats"
  const ok =
    summary.classifiedHistory.length === parsed.moves.length &&
    Number.isFinite(summary.accuracy.white) && summary.accuracy.white > 0 &&
    Number.isFinite(summary.accuracy.black) && summary.accuracy.black > 0 &&
    summary.openings.length > 0;
  console.log('\n=== VERDICT ===');
  console.log(ok ? 'PASS: stats are real and non-empty.' : 'FAIL: stats look empty.');
  if (!ok) process.exit(1);
}

main().catch((e) => { console.error('FAIL:', e); process.exit(1); });
