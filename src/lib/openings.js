/**
 * KnightVision - Opening Recognition
 * ECO-based opening identification
 */

const OpeningBook = (function() {
  var OPENINGS_BY_PIECES = new Map();
  var chesskitOpeningsPromise = null;

  function hydrateChesskitOpenings(openings) {
    (openings || []).forEach(function(opening) {
      var piecePos = String(opening.fen || '').split(' ')[0];
      if (piecePos && !OPENINGS_BY_PIECES.has(piecePos)) {
        OPENINGS_BY_PIECES.set(piecePos, opening.name);
      }
    });
  }

  function preloadChesskitOpenings() {
    if (!chesskitOpeningsPromise) {
      chesskitOpeningsPromise = import('./chesskit/data/openings.js')
        .then(function(module) {
          hydrateChesskitOpenings(module.openings || []);
          return OPENINGS_BY_PIECES;
        })
        .catch(function() {
          return OPENINGS_BY_PIECES;
        });
    }
    return chesskitOpeningsPromise;
  }

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(preloadChesskitOpenings);
  } else {
    setTimeout(preloadChesskitOpenings, 0);
  }

  // Compact opening database: [eco, name, moves_start]
  var OPENINGS = [
    ['A00', "Uncommon Opening", ""],
    ['A00', "Polish Opening", "b4"],
    ['A00', "Hungarian Opening", "g3"],
    ['A01', "Nimzovich-Larsen Attack", "b3"],
    ['A02', "Bird's Opening", "f4"],
    ['A04', "Reti Opening", "Nf3"],
    ['A10', "English Opening", "c4"],
    ['A20', "English: King's English", "c4 e5"],
    ['A40', "Queen's Pawn Game", "d4"],
    ['A45', "Trompowsky Attack", "d4 Nf6 Bg5"],
    ['A80', "Dutch Defense", "d4 f5"],
    ['B00', "King's Pawn Game", "e4"],
    ['B01', "Scandinavian Defense", "e4 d5"],
    ['B02', "Alekhine Defense", "e4 Nf6"],
    ['B06', "Modern Defense", "e4 g6"],
    ['B07', "Pirc Defense", "e4 d6"],
    ['B10', "Caro-Kann Defense", "e4 c6"],
    ['B12', "Caro-Kann: Advance", "e4 c6 d4 d5 e5"],
    ['B13', "Caro-Kann: Exchange", "e4 c6 d4 d5 exd5 cxd5"],
    ['B20', "Sicilian Defense", "e4 c5"],
    ['B21', "Sicilian: Smith-Morra Gambit", "e4 c5 d4"],
    ['B22', "Sicilian: Alapin", "e4 c5 c3"],
    ['B23', "Sicilian: Closed", "e4 c5 Nc3"],
    ['B27', "Sicilian: Hyper-Accelerated Dragon", "e4 c5 Nf3 g6"],
    ['B30', "Sicilian: Old Sicilian", "e4 c5 Nf3 Nc6"],
    ['B40', "Sicilian: Kan", "e4 c5 Nf3 e6"],
    ['B50', "Sicilian: Pin", "e4 c5 Nf3 d6"],
    ['B60', "Sicilian: Richter-Rauzer", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6 Bg5"],
    ['B70', "Sicilian: Dragon", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6"],
    ['B80', "Sicilian: Scheveningen", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6"],
    ['B90', "Sicilian: Najdorf", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6"],
    ['C00', "French Defense", "e4 e6"],
    ['C01', "French: Exchange", "e4 e6 d4 d5 exd5 exd5"],
    ['C02', "French: Advance", "e4 e6 d4 d5 e5"],
    ['C10', "French: Rubinstein", "e4 e6 d4 d5 Nc3 dxe4"],
    ['C11', "French: Classical", "e4 e6 d4 d5 Nc3 Nf6"],
    ['C20', "King's Pawn Game: Wayward Queen", "e4 e5"],
    ['C21', "Danish Gambit", "e4 e5 d4"],
    ['C23', "Bishop's Opening", "e4 e5 Bc4"],
    ['C24', "Bishop's Opening: Berlin Defense", "e4 e5 Bc4 Nf6"],
    ['C25', "Vienna Game", "e4 e5 Nc3"],
    ['C30', "King's Gambit", "e4 e5 f4"],
    ['C40', "King's Knight Opening", "e4 e5 Nf3"],
    ['C41', "Philidor Defense", "e4 e5 Nf3 d6"],
    ['C42', "Petrov Defense", "e4 e5 Nf3 Nf6"],
    ['C44', "Scotch Game", "e4 e5 Nf3 Nc6 d4"],
    ['C45', "Scotch: Classical", "e4 e5 Nf3 Nc6 d4 exd4 Nxd4"],
    ['C46', "Three Knights Game", "e4 e5 Nf3 Nc6 Nc3"],
    ['C47', "Four Knights Game", "e4 e5 Nf3 Nc6 Nc3 Nf6"],
    ['C50', "Italian Game", "e4 e5 Nf3 Nc6 Bc4"],
    ['C51', "Evans Gambit", "e4 e5 Nf3 Nc6 Bc4 Bc5 b4"],
    ['C53', "Italian: Classical", "e4 e5 Nf3 Nc6 Bc4 Bc5 c3"],
    ['C54', "Italian: Giuoco Piano", "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4"],
    ['C55', "Italian: Two Knights Defense", "e4 e5 Nf3 Nc6 Bc4 Nf6"],
    ['C60', "Ruy Lopez", "e4 e5 Nf3 Nc6 Bb5"],
    ['C61', "Ruy Lopez: Bird's Defense", "e4 e5 Nf3 Nc6 Bb5 Nd4"],
    ['C62', "Ruy Lopez: Old Steinitz", "e4 e5 Nf3 Nc6 Bb5 d6"],
    ['C65', "Ruy Lopez: Berlin Defense", "e4 e5 Nf3 Nc6 Bb5 Nf6"],
    ['C67', "Ruy Lopez: Berlin Endgame", "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 Re1"],
    ['C70', "Ruy Lopez: Morphy Defense", "e4 e5 Nf3 Nc6 Bb5 a6"],
    ['C77', "Ruy Lopez: Worrall Attack", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 Qe2"],
    ['C78', "Ruy Lopez: Archangel", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O"],
    ['C80', "Ruy Lopez: Open", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4"],
    ['C84', "Ruy Lopez: Closed", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7"],
    ['C90', "Ruy Lopez: Breyer", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8"],
    ['D00', "Queen's Pawn Game: Accelerated London", "d4 d5"],
    ['D01', "Richter-Veresov Attack", "d4 d5 Nc3 Nf6 Bg5"],
    ['D02', "Queen's Pawn: London System", "d4 d5 Nf3 Nf6 Bf4"],
    ['D04', "Queen's Pawn: Colle System", "d4 d5 Nf3 Nf6 e3"],
    ['D06', "Queen's Gambit", "d4 d5 c4"],
    ['D07', "Queen's Gambit Declined: Chigorin", "d4 d5 c4 Nc6"],
    ['D09', "Queen's Gambit Declined: Albin", "d4 d5 c4 e5"],
    ['D10', "Slav Defense", "d4 d5 c4 c6"],
    ['D20', "Queen's Gambit Accepted", "d4 d5 c4 dxc4"],
    ['D30', "Queen's Gambit Declined", "d4 d5 c4 e6"],
    ['D35', "QGD: Exchange", "d4 d5 c4 e6 Nc3 Nf6 cxd5"],
    ['D37', "QGD: Harrwitz Attack", "d4 d5 c4 e6 Nc3 Nf6 Nf3"],
    ['D43', "Semi-Slav Defense", "d4 d5 c4 e6 Nc3 Nf6 Nf3 c6"],
    ['D50', "Queen's Gambit Declined: Modern", "d4 d5 c4 e6 Nc3 Nf6 Bg5"],
    ['D70', "Grunfeld Defense", "d4 Nf6 c4 g6 Nc3 d5"],
    ['D80', "Grunfeld: Russian Variation", "d4 Nf6 c4 g6 Nc3 d5 Bg5"],
    ['E00', "Catalan Opening", "d4 Nf6 c4 e6 g3"],
    ['E10', "Queen's Indian Defense", "d4 Nf6 c4 e6 Nf3 b6"],
    ['E20', "Nimzo-Indian Defense", "d4 Nf6 c4 e6 Nc3 Bb4"],
    ['E32', "Nimzo-Indian: Classical", "d4 Nf6 c4 e6 Nc3 Bb4 Qc2"],
    ['E40', "Nimzo-Indian: Normal", "d4 Nf6 c4 e6 Nc3 Bb4 e3"],
    ['E60', "King's Indian Defense", "d4 Nf6 c4 g6"],
    ['E70', "King's Indian: Averbakh", "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Be2"],
    ['E80', "King's Indian: Samisch", "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3"],
    ['E90', "King's Indian: Orthodox", "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3"],
  ];

  function identify(chess) {
    if (chess && typeof chess.fen === 'function') {
      var piecePos = String(chess.fen() || '').split(' ')[0];
      var chesskitName = OPENINGS_BY_PIECES.get(piecePos);
      if (chesskitName) {
        return { eco: '', name: chesskitName };
      }
    }

    var sanHistory = chess.history();
    var movesStr = sanHistory.join(' ');
    
    var bestMatch = null;
    var bestLen = -1;
    
    for (var i = 0; i < OPENINGS.length; i++) {
      var opening = OPENINGS[i];
      var openingMoves = opening[2];
      
      if (!openingMoves) continue;
      
      if (movesStr.startsWith(openingMoves) || openingMoves === '') {
        if (openingMoves.length > bestLen) {
          bestLen = openingMoves.length;
          bestMatch = opening;
        }
      }
    }
    
    return bestMatch ? {eco: bestMatch[0], name: bestMatch[1]} : {eco: '', name: 'Unknown Opening'};
  }

  function identifyByMoves(moves) {
    var movesStr = Array.isArray(moves) ? moves.join(' ') : moves;
    var bestMatch = null;
    var bestLen = -1;
    
    for (var i = 0; i < OPENINGS.length; i++) {
      var opening = OPENINGS[i];
      var openingMoves = opening[2];
      
      if (!openingMoves) continue;
      
      if (movesStr.startsWith(openingMoves)) {
        if (openingMoves.length > bestLen) {
          bestLen = openingMoves.length;
          bestMatch = opening;
        }
      }
    }
    
    return bestMatch ? {eco: bestMatch[0], name: bestMatch[1]} : null;
  }

  return {
    identify: identify,
    identifyByMoves: identifyByMoves,
    getAll: function() { return OPENINGS; },
    preload: preloadChesskitOpenings
  };
})();

export default OpeningBook;
