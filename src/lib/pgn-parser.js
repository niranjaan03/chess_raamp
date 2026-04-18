/**
 * KnightVision - PGN Parser & Game Manager
 *
 * Uses chess.js v1 (camelCase API) internally. The legacy `./chess.js`
 * (v0.x snake_case) infinite-loops in `chess.move(san)` on certain real-world
 * positions (reproduced on Lichess game kAdOQKeh after `Qh5+ g6 Qf3`), which
 * froze the entire analyze pipeline and produced empty stats.
 */

import { Chess as ChessV1 } from 'chess.js';

const PGNParser = (function() {
  var HEADER_ORDER = [
    'Event',
    'Site',
    'Date',
    'Round',
    'White',
    'Black',
    'Result',
    'SetUp',
    'FEN',
    'WhiteElo',
    'BlackElo',
    'ECO',
    'Opening',
    'TimeControl'
  ];

  function tryLoadPgn(chess, pgn) {
    try {
      chess.loadPgn(pgn);
      return true;
    } catch (e) {
      return false;
    }
  }

  function adaptVerboseMove(m) {
    // Chess.js v1 verbose move shape -> shape the rest of the app expects.
    // Legacy code reads: color, from, to, san, piece, promotion, captured.
    return {
      color: m.color,
      from: m.from,
      to: m.to,
      san: m.san,
      piece: m.piece,
      promotion: m.promotion,
      captured: m.captured,
      flags: m.flags,
    };
  }

  function stripProblematicPgnMarkup(pgn) {
    return String(pgn || '')
      .replace(/\{[^}]*\}/g, '')   // Remove comments
      .replace(/\([^)]*\)/g, '')   // Remove variations
      .replace(/\$\d+/g, '')       // Remove NAG
      .replace(/\d+\.\.\./g, '')   // Remove black move numbers
      .trim();
  }

  function getStartingFen(headers) {
    if (!headers || !headers.FEN) return '';
    return String(headers.FEN).trim();
  }

  function buildCanonicalPgn(headers, moves) {
    var safeHeaders = headers || {};
    var result = safeHeaders.Result || '*';
    var orderedKeys = HEADER_ORDER.filter(function(key) {
      return safeHeaders[key] !== undefined && safeHeaders[key] !== null && safeHeaders[key] !== '';
    });

    Object.keys(safeHeaders).forEach(function(key) {
      if (orderedKeys.indexOf(key) === -1 && safeHeaders[key] !== undefined && safeHeaders[key] !== null && safeHeaders[key] !== '') {
        orderedKeys.push(key);
      }
    });

    var headerLines = orderedKeys.map(function(key) {
      return '[' + key + ' "' + String(safeHeaders[key]).replace(/"/g, '\\"') + '"]';
    });

    var startFen = getStartingFen(safeHeaders);
    var fenParts = startFen ? startFen.split(/\s+/) : [];
    var moveNumber = parseInt(fenParts[5], 10) || 1;
    var isWhiteTurn = !fenParts.length || fenParts[1] !== 'b';
    var moveParts = [];

    (moves || []).forEach(function(move) {
      var san = move && move.san ? move.san : String(move || '').trim();
      if (!san) return;
      if (isWhiteTurn) {
        moveParts.push(moveNumber + '.');
      } else if (!moveParts.length) {
        moveParts.push(moveNumber + '...');
      }
      moveParts.push(san);
      if (!isWhiteTurn) moveNumber++;
      isWhiteTurn = !isWhiteTurn;
    });

    if (result) {
      moveParts.push(result);
    }

    if (!headerLines.length) {
      return moveParts.join(' ').trim();
    }

    return headerLines.join('\n') + '\n\n' + moveParts.join(' ').trim();
  }
  
  function parse(pgnText) {
    if (!pgnText || !pgnText.trim()) return null;

    var chess = new ChessV1();

    // Clean up PGN
    var cleaned = pgnText.trim();

    // Extract headers
    var headers = {};
    var headerMatches = cleaned.matchAll(/\[(\w+)\s+"([^"]*)"\]/g);
    for (var match of headerMatches) {
      headers[match[1]] = match[2];
    }

    // Try to load
    var success = tryLoadPgn(chess, cleaned);

    if (!success) {
      // Try cleaning the PGN more aggressively
      var movesOnly = stripProblematicPgnMarkup(cleaned);
      chess = new ChessV1();
      success = tryLoadPgn(chess, movesOnly);
    }

    if (!success) return null;

    var history = chess.history({ verbose: true }).map(adaptVerboseMove);

    return {
      headers: headers,
      moves: history,
      chess: chess,
      white: headers.White || 'White',
      black: headers.Black || 'Black',
      whiteElo: headers.WhiteElo || '?',
      blackElo: headers.BlackElo || '?',
      result: headers.Result || '*',
      event: headers.Event || '',
      date: headers.Date || '',
      opening: headers.Opening || '',
      eco: headers.ECO || '',
      timeControl: headers.TimeControl || '',
      pgn: buildCanonicalPgn(headers, history)
    };
  }

  function parsePGNFile(text) {
    // Handle multi-game PGN files
    var games = [];
    var parts = text.split(/(?=\[Event)/);
    
    for (var part of parts) {
      var trimmed = part.trim();
      if (trimmed.length > 10) {
        var game = parse(trimmed);
        if (game) games.push(game);
      }
    }
    
    return games;
  }

  function buildPositions(game) {
    // Rebuild all positions from a parsed game using chess.js v1 (camelCase API).
    var startFen = game && game.headers ? getStartingFen(game.headers) : '';
    var chess = startFen ? new ChessV1(startFen) : new ChessV1();
    var positions = [{ fen: chess.fen(), move: null, moveNum: 0 }];

    for (var i = 0; i < game.moves.length; i++) {
      var m = game.moves[i];
      // Prefer from/to/promotion (deterministic) over SAN to avoid ambiguity.
      try {
        if (m.from && m.to) {
          chess.move({ from: m.from, to: m.to, promotion: m.promotion });
        } else {
          chess.move(m.san);
        }
      } catch (_) {
        // Skip illegal move (parser would have rejected the game otherwise).
        break;
      }
      positions.push({
        fen: chess.fen(),
        move: m,
        moveNum: i + 1,
        san: m.san
      });
    }

    return positions;
  }

  function gameToSummary(game) {
    return {
      white: game.white,
      black: game.black,
      whiteElo: game.whiteElo,
      blackElo: game.blackElo,
      result: game.result,
      event: game.event,
      date: game.date,
      opening: game.opening || game.eco,
      moveCount: game.moves ? game.moves.length : 0,
      pgn: game.pgn
    };
  }

  return {
    parse: parse,
    parseMultiple: parsePGNFile,
    buildPositions: buildPositions,
    gameToSummary: gameToSummary
  };
})();

export default PGNParser;
