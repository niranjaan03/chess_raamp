// Orchestrator that wraps the chess kit analysis pipeline.
// Inputs use this project's engine batch shape; output adapts back into
// the existing UI history fields (quality / evalBefore / evalAfter / ...).

import { Chess } from 'chess.js';

import { getMovesClassification } from './moveClassification.js';
import { computeAccuracy } from './accuracy.js';
import { computeEstimatedElo } from './estimateElo.js';
import { getPositionWinPercentage } from './winPercentage.js';
import { formatUciPv } from './chess.js';
import { MoveClassification, UI_QUALITY_BY_CLASSIFICATION } from './enums.js';

const MATE_SENTINEL_CP = 100000;

const sideToMove = (fen) => (fen ? (fen.split(' ')[1] || 'w') : 'w');

const getTerminalPositionEval = (fen) => {
  try {
    const game = new Chess(fen);
    if (game.isCheckmate()) {
      const stm = game.turn();
      return {
        lines: [{ pv: [], mate: stm === 'w' ? -1 : 1, depth: 0, multiPv: 1 }]
      };
    }
    if (
      game.isStalemate() ||
      game.isInsufficientMaterial() ||
      game.isThreefoldRepetition() ||
      game.isDraw()
    ) {
      return { lines: [{ pv: [], cp: 0, depth: 0, multiPv: 1 }] };
    }
  } catch (_) {
    // Invalid FENs are handled by the caller.
  }
  return null;
};

// Convert one engine line (eval string from side-to-move perspective + pv) into
// a chess kit LineEval. cp/mate are stored in white's perspective.
const lineEvalFromEngineLine = (rawLine, fen) => {
  if (!rawLine) {
    return { pv: [], cp: 0, depth: 0, multiPv: 1 };
  }

  const stm = sideToMove(fen);
  const evalStr = rawLine.eval !== undefined && rawLine.eval !== null
    ? String(rawLine.eval)
    : '';
  const pvArr = formatUciPv(fen, (rawLine.pv || '').split(' ').filter(Boolean));
  const depth = Number(rawLine.depth) || 0;
  const multiPv = Number(rawLine.line) || 1;

  if (evalStr.includes('M')) {
    const sign = evalStr.charAt(0) === '-' ? -1 : 1;
    const moves = parseInt(evalStr.replace(/[^0-9]/g, ''), 10) || 1;
    let mate = sign * moves;
    if (stm === 'b') mate = -mate;
    return { pv: pvArr, mate, depth, multiPv };
  }

  const pawn = parseFloat(evalStr);
  if (!Number.isFinite(pawn)) {
    return { pv: pvArr, cp: 0, depth, multiPv };
  }
  const cpStm = Math.round(pawn * 100);
  const cp = stm === 'b' ? -cpStm : cpStm;
  return { pv: pvArr, cp, depth, multiPv };
};

const positionEvalFromBatchResult = (batchResult, fen) => {
  if (!batchResult || batchResult.ok !== true) {
    throw new Error(batchResult && batchResult.error
      ? String(batchResult.error)
      : 'Engine analysis did not finish for all positions.');
  }

  if (!Array.isArray(batchResult.lines)) {
    throw new Error('Engine analysis returned an invalid response.');
  }

  if (!batchResult.lines.length) {
    const terminalEval = getTerminalPositionEval(fen);
    if (terminalEval) {
      return terminalEval;
    }
    throw new Error('Engine analysis returned no candidate lines for a non-terminal position.');
  }

  const sorted = batchResult.lines
    .slice()
    .sort((a, b) => (Number(a.line) || 0) - (Number(b.line) || 0));

  const lines = sorted.map((line) => lineEvalFromEngineLine(line, fen));
  const bestMoveRaw = batchResult.bestmove
    || (lines[0] && lines[0].pv && lines[0].pv[0])
    || undefined;
  const bestMove = bestMoveRaw ? formatUciPv(fen, [bestMoveRaw])[0] : undefined;

  const positionEval = { lines };
  if (bestMove) positionEval.bestMove = bestMove;
  return positionEval;
};

// chess.js v1.x exposes a couple of terminal-state helpers. Returns whatever
// terminal flag fits the position so chess kit can short-circuit cleanly.
const ensureTerminalEval = (positionEval, fen, isLastPosition) => {
  if (!isLastPosition) return positionEval;
  return getTerminalPositionEval(fen) || positionEval;
};

// Build the inputs the chess kit pipeline expects, given this project's
// per-position engine batch results.
//
// `positions` is the array of FEN strings produced by walking the PGN
// (length history.length + 1, positions[0] = startpos).
// `batchResults` is the parallel array of raw engine batch results.
const buildPipelineInputs = (history, positions, batchResults) => {
  const fens = positions.slice();
  const rawPositions = positions.map((fen, index) => {
    const pe = positionEvalFromBatchResult(batchResults && batchResults[index], fen);
    return ensureTerminalEval(pe, fen, index === positions.length - 1);
  });
  const uciMoves = history.map((move) => {
    const promo = move.promotion ? String(move.promotion).toLowerCase() : '';
    return move.from + move.to + promo;
  });
  return { rawPositions, uciMoves, fens };
};

const winPercentForMover = (rawPosition, isWhiteMove) => {
  const wpWhite = getPositionWinPercentage(rawPosition);
  return isWhiteMove ? wpWhite : (100 - wpWhite);
};

const cpFromLine = (line) => {
  if (!line) return 0;
  if (typeof line.cp === 'number') return line.cp;
  if (typeof line.mate === 'number') {
    return line.mate >= 0 ? MATE_SENTINEL_CP : -MATE_SENTINEL_CP;
  }
  return 0;
};

const uciFromHistoryMove = (move) => {
  if (!move) return '';
  const promo = move.promotion ? String(move.promotion).toLowerCase() : '';
  return `${move.from}${move.to}${promo}`;
};

const candidateMovesFromPosition = (position, playedMove) => {
  if (!position || !Array.isArray(position.lines)) return [];

  const seen = new Set();
  return position.lines
    .filter((line) => line && Array.isArray(line.pv) && line.pv[0])
    .filter((line) => {
      const firstMove = line.pv[0];
      if (seen.has(firstMove)) return false;
      seen.add(firstMove);
      return true;
    })
    .slice(0, 5)
    .map((line, index) => ({
      rank: index + 1,
      move: line.pv[0],
      pv: line.pv.slice(0, 8),
      cp: typeof line.cp === 'number' ? line.cp : undefined,
      mate: typeof line.mate === 'number' ? line.mate : undefined,
      depth: line.depth || 0,
      multiPv: line.multiPv || index + 1,
      isBest: index === 0,
      isPlayed: line.pv[0] === playedMove,
    }));
};

// Adapt one chess kit classified position back into the per-move history
// fields the existing UI consumes. `prevPosition` is the rawPositions entry
// from before the move was played.
const adaptHistoryEntry = (move, prevPosition, classifiedPosition, isLast) => {
  const isWhite = move.color === 'w';
  const moverWpBefore = winPercentForMover(prevPosition, isWhite);
  const moverWpAfter = winPercentForMover(classifiedPosition, isWhite);
  const winPercentLoss = Math.max(0, moverWpBefore - moverWpAfter);

  const cpBeforeWhite = cpFromLine(prevPosition.lines[0]);
  const cpAfterWhite = cpFromLine(classifiedPosition.lines[0]);
  const mateBefore = typeof prevPosition.lines[0]?.mate === 'number'
    ? prevPosition.lines[0].mate
    : undefined;
  const mateAfter = typeof classifiedPosition.lines[0]?.mate === 'number'
    ? classifiedPosition.lines[0].mate
    : undefined;
  const evalBefore = cpBeforeWhite / 100;
  const evalAfter = cpAfterWhite / 100;

  const cpBeforeMover = isWhite ? cpBeforeWhite : -cpBeforeWhite;
  const cpAfterMover = isWhite ? cpAfterWhite : -cpAfterWhite;
  const centipawnLoss = Math.max(0, cpBeforeMover - cpAfterMover);

  const classification = classifiedPosition.moveClassification || MoveClassification.Excellent;
  const quality = UI_QUALITY_BY_CLASSIFICATION[classification] || 'good';
  const playedMove = uciFromHistoryMove(move);
  const bestMove = prevPosition.bestMove || null;

  const entry = Object.assign({}, move);
  entry.classification = classification;
  entry.quality = quality;
  entry.opening = classifiedPosition.opening || null;
  entry.evalBefore = evalBefore;
  entry.evalAfter = evalAfter;
  entry.mateBefore = mateBefore;
  entry.mateAfter = mateAfter;
  entry.winPercentBefore = moverWpBefore;
  entry.winPercentAfter = moverWpAfter;
  entry.winPercentLoss = winPercentLoss;
  entry.centipawnLoss = centipawnLoss;
  entry.playedMove = playedMove;
  entry.bestMove = bestMove;
  entry.candidateMoves = candidateMovesFromPosition(prevPosition, playedMove);
  if (isLast && classifiedPosition.terminal) {
    entry.terminal = classifiedPosition.terminal;
  }
  return entry;
};

// Public API.
//
// `history` is chess.js v0.x verbose history (move.from/to/promotion/color/san),
// `positions` are the FENs (length history.length + 1),
// `batchResults` are the raw engine batch results (length history.length + 1),
// `meta` may contain whiteElo/blackElo for elo estimation.
//
// Returns: {
//   classifiedHistory: Array<historyEntry>,
//   rawPositions, classifiedPositions, openings,
//   accuracy: { white, black },
//   estimatedElo: { white, black } | undefined,
// }
export const analyzeGameWithChessKit = async ({ history, positions, batchResults, meta }) => {
  if (!history || !history.length) {
    return {
      classifiedHistory: [],
      rawPositions: [],
      classifiedPositions: [],
      openings: [],
      accuracy: { white: 0, black: 0 },
      estimatedElo: undefined,
    };
  }

  const { rawPositions, uciMoves, fens } = buildPipelineInputs(history, positions, batchResults);
  const classifiedPositions = await getMovesClassification(rawPositions, uciMoves, fens);

  const classifiedHistory = history.map((move, i) => {
    const prev = rawPositions[i];
    const cur = classifiedPositions[i + 1];
    const entry = adaptHistoryEntry(move, prev, cur, i === history.length - 1);
    entry.moveNumber = Math.floor(i / 2) + 1;
    return entry;
  });

  const accuracy = computeAccuracy(rawPositions);

  let estimatedElo;
  try {
    estimatedElo = computeEstimatedElo(
      rawPositions,
      meta && meta.whiteElo,
      meta && meta.blackElo
    );
  } catch (_) {
    estimatedElo = undefined;
  }

  const openings = classifiedPositions
    .map((p) => p && p.opening)
    .filter(Boolean);

  return {
    classifiedHistory,
    rawPositions,
    classifiedPositions,
    openings,
    accuracy,
    estimatedElo,
  };
};
