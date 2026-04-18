// Ported from chess kit/lib/chess.ts (analysis-relevant helpers only).
// Uses chess.js v1.x (camelCase API).

import { Chess } from 'chess.js';

export const uciMoveParams = (uciMove) => ({
  from: uciMove.slice(0, 2),
  to: uciMove.slice(2, 4),
  promotion: uciMove.slice(4, 5) || undefined,
});

export const getIsStalemate = (fen) => {
  const game = new Chess(fen);
  return game.isStalemate();
};

export const getWhoIsCheckmated = (fen) => {
  const game = new Chess(fen);
  if (!game.isCheckmate()) return null;
  return game.turn();
};

export const isSimplePieceRecapture = (fen, uciMoves) => {
  const game = new Chess(fen);
  const moves = uciMoves.map((uciMove) => uciMoveParams(uciMove));

  if (moves[0].to !== moves[1].to) return false;

  const piece = game.get(moves[0].to);
  if (piece) return true;

  return false;
};

const getPieceValue = (piece) => {
  switch (piece) {
    case 'p':
      return 1;
    case 'n':
      return 3;
    case 'b':
      return 3;
    case 'r':
      return 5;
    case 'q':
      return 9;
    default:
      return 0;
  }
};

export const getMaterialDifference = (fen) => {
  const game = new Chess(fen);
  const board = game.board().flat();

  return board.reduce((acc, square) => {
    if (!square) return acc;
    const piece = square.type;

    if (square.color === 'w') {
      return acc + getPieceValue(piece);
    }

    return acc - getPieceValue(piece);
  }, 0);
};

export const getIsPieceSacrifice = (fen, playedMove, bestLinePvToPlay) => {
  if (!bestLinePvToPlay.length) return false;

  const game = new Chess(fen);
  const whiteToPlay = game.turn() === 'w';
  const startingMaterialDifference = getMaterialDifference(fen);

  let moves = [playedMove, ...bestLinePvToPlay];
  if (moves.length % 2 === 1) {
    moves = moves.slice(0, -1);
  }
  let nonCapturingMovesTemp = 1;

  const capturedPieces = { w: [], b: [] };
  for (const move of moves) {
    try {
      const fullMove = game.move(uciMoveParams(move));
      if (fullMove.captured) {
        capturedPieces[fullMove.color].push(fullMove.captured);
        nonCapturingMovesTemp = 1;
      } else {
        nonCapturingMovesTemp--;
        if (nonCapturingMovesTemp < 0) break;
      }
    } catch (e) {
      return false;
    }
  }

  for (const p of capturedPieces.w.slice(0)) {
    if (capturedPieces.b.includes(p)) {
      capturedPieces.b.splice(capturedPieces.b.indexOf(p), 1);
      capturedPieces.w.splice(capturedPieces.w.indexOf(p), 1);
    }
  }

  if (
    Math.abs(capturedPieces.w.length - capturedPieces.b.length) <= 1 &&
    capturedPieces.w.concat(capturedPieces.b).every((p) => p === 'p')
  ) {
    return false;
  }

  const endingMaterialDifference = getMaterialDifference(game.fen());

  const materialDiff = endingMaterialDifference - startingMaterialDifference;
  const materialDiffPlayerRelative = whiteToPlay ? materialDiff : -materialDiff;

  return materialDiffPlayerRelative < 0;
};

export const formatUciPv = (fen, uciMoves) => {
  const castlingRights = fen.split(' ')[2] || '';

  let canWhiteCastleKingSide = castlingRights.includes('K');
  let canWhiteCastleQueenSide = castlingRights.includes('Q');
  let canBlackCastleKingSide = castlingRights.includes('k');
  let canBlackCastleQueenSide = castlingRights.includes('q');

  return uciMoves.map((uci) => {
    if (uci === 'e1h1' && canWhiteCastleKingSide) {
      canWhiteCastleKingSide = false;
      return 'e1g1';
    }
    if (uci === 'e1a1' && canWhiteCastleQueenSide) {
      canWhiteCastleQueenSide = false;
      return 'e1c1';
    }

    if (uci === 'e8h8' && canBlackCastleKingSide) {
      canBlackCastleKingSide = false;
      return 'e8g8';
    }
    if (uci === 'e8a8' && canBlackCastleQueenSide) {
      canBlackCastleQueenSide = false;
      return 'e8c8';
    }

    return uci;
  });
};
