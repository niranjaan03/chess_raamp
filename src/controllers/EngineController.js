/**
 * KnightVision - Engine Analysis Controller
 *
 * Live single-FEN analysis still uses this project's existing UI plumbing.
 * Full-game review uses the chess kit pipeline end-to-end:
 *   raw engine batch -> chess kit position evals -> chess kit classification ->
 *   chess kit accuracy + estimated elo -> per-move history fields the UI reads.
 */

import Chess from '../lib/chess';
import PGNParser from '../lib/pgn-parser.js';
import EngineManager from './EngineManager';
import { analyzeGameWithChessKit } from '../lib/chesskit/gameAnalyzer.js';
import { MoveClassification } from '../lib/chesskit/enums.js';
import { escapeAttr, escapeHtml, setText } from '../utils/dom.js';

const EngineController = (function() {
  var REVIEW_MULTI_PV = 5;
  var currentLines = {};
  var currentAnalysisFen = null;
  var isAnalyzing = false;
  var analysisTimer = null;
  var numLines = 3;
  var analysisDepth = 20;
  var fullGameAnalysis = [];
  var gameAnalysisToken = 0;
  var onBestMoveCallback = null;

  // ---------- Live-analysis helpers ----------

  function normalizeEval(evalStr) {
    if (evalStr === null || evalStr === undefined) return null;
    var raw = String(evalStr);
    if (raw.indexOf('M') !== -1) {
      var sign = raw.indexOf('-') === 0 ? -1 : 1;
      var mateMoves = parseInt(raw.replace(/[^0-9]/g, ''), 10) || 1;
      return sign * (30 - Math.min(20, mateMoves - 1) * 0.5);
    }
    var num = parseFloat(raw);
    return isNaN(num) ? null : num;
  }

  // Lichess win-probability model — used by the live eval bar so the bar
  // matches the win-percentage scale used inside chess kit.
  function centipawnsToWinPercent(cp) {
    var clamped = Math.max(-1500, Math.min(1500, cp));
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
  }

  function cloneHistory(history) {
    return history.map(function(move) {
      return Object.assign({}, move);
    });
  }

  function getReviewProfile(totalPositions) {
    if (totalPositions > 140) return { depth: 9, chunkSize: 96 };
    if (totalPositions > 100) return { depth: 10, chunkSize: 80 };
    if (totalPositions > 70)  return { depth: 11, chunkSize: 72 };
    if (totalPositions > 45)  return { depth: 12, chunkSize: 64 };
    return { depth: 13, chunkSize: 48 };
  }

  // ---------- Live analysis (single FEN) ----------

  function init() {
    var statusEl = document.getElementById('engineStatus');
    if (statusEl) {
      statusEl.classList.remove('is-ready', 'is-offline');
      statusEl.classList.add('is-loading');
    }
    EngineManager.init(function(status) {
      var engineEl = document.getElementById('engineStatus');
      var label = engineEl ? engineEl.querySelector('.engine-label') : null;
      var engineName = status && status.engine ? status.engine : 'Stockfish 18';
      if (label) {
        setText(label, status && status.ready ? (engineName + ' Ready') : (engineName + ' Offline'));
      }
      if (engineEl) {
        engineEl.classList.remove('is-loading', 'is-ready', 'is-offline');
        engineEl.classList.add(status && status.ready ? 'is-ready' : 'is-offline');
      }
    });
  }

  function analyzeFen(fen, depth, lines, onBestMove) {
    if (isAnalyzing) {
      EngineManager.stop();
    }

    currentLines = {};
    currentAnalysisFen = fen || null;
    isAnalyzing = true;
    onBestMoveCallback = onBestMove;
    numLines = lines || 3;
    analysisDepth = depth || 20;

    updateLinesDisplay([]);

    var sideToMove = fen ? fen.split(' ')[1] : 'w';

    EngineManager.analyze(fen, analysisDepth, numLines, function(data) {
      if (data.type === 'info') {
        if (sideToMove === 'b' && data.eval != null) {
          var rawEval = String(data.eval);
          if (rawEval.indexOf('M') !== -1) {
            data.eval = rawEval.charAt(0) === '-' ? rawEval.slice(1) : '-' + rawEval;
          } else {
            data.eval = String((-parseFloat(rawEval)).toFixed(2));
          }
        }
        currentLines[data.line] = data;
        updateDisplay(data, fen);

        var lineArray = [];
        for (var i = 1; i <= numLines; i++) {
          if (currentLines[i]) lineArray.push(currentLines[i]);
        }
        updateLinesDisplay(lineArray, fen);

      } else if (data.type === 'bestmove') {
        isAnalyzing = false;
        if (typeof onBestMoveCallback === 'function' && data.move) {
          onBestMoveCallback(data.move);
        }

        if (data.move && currentLines[1]) {
          var pvMoves = currentLines[1].pv ? currentLines[1].pv.split(' ') : [];
          var arrowList = [];
          if (pvMoves[0] && pvMoves[0].length >= 4) {
            arrowList.push({from: pvMoves[0].slice(0,2), to: pvMoves[0].slice(2,4), color: 'rgba(100,220,100,0.8)'});
          }
          if (pvMoves[1] && pvMoves[1].length >= 4) {
            arrowList.push({from: pvMoves[1].slice(0,2), to: pvMoves[1].slice(2,4), color: 'rgba(100,150,255,0.5)'});
          }
          ChessBoard.setArrows(arrowList);
        }
      }
    });
  }

  function updateDisplay(data, fen) {
    var evalScore = parseFloat(data.eval);
    var isMate = data.eval && data.eval.toString().indexOf('M') !== -1;

    var evalEl = document.getElementById('evalScore');
    var evalDepthEl = document.getElementById('evalDepth');
    var evalNodesEl = document.getElementById('evalNodes');
    var bestMoveEl = document.getElementById('bestMoveDisplay');

    if (evalEl) {
      if (isMate) {
        setText(evalEl, data.eval);
        evalEl.style.color = 'var(--accent)';
      } else {
        setText(evalEl, evalScore > 0 ? '+' + evalScore.toFixed(2) : evalScore.toFixed(2));
        evalEl.style.color = evalScore > 0 ? 'var(--text-primary)' : 'var(--danger)';
      }
    }

    setText(evalDepthEl, data.depth);
    if (evalNodesEl && data.nodes) {
      setText(evalNodesEl, formatNodes(data.nodes));
    }

    updateEvalBar(evalScore, isMate, data.eval);

    if (bestMoveEl && data.line === 1 && data.pv) {
      var bestMove = data.pv.split(' ')[0];
      setText(bestMoveEl, formatMove(bestMove));
    }
  }

  function updateEvalBar(score, isMate, rawEval) {
    var whiteFill = document.getElementById('evalFillWhite');
    var blackFill = document.getElementById('evalFillBlack');
    if (!whiteFill || !blackFill) return;

    var whitePercent;

    if (isMate) {
      whitePercent = rawEval.toString().indexOf('-') === -1 ? 95 : 5;
    } else {
      var winPct = centipawnsToWinPercent(score * 100);
      whitePercent = Math.max(5, Math.min(95, winPct));
    }

    whiteFill.style.height = (100 - whitePercent) + '%';
    blackFill.style.height = whitePercent + '%';
  }

  function updateLinesDisplay(lines, fen) {
    var container = document.getElementById('linesContainer');
    if (!container) return;

    if (!lines || lines.length === 0) {
      container.innerHTML =
        '<div class="engine-lines-skeleton">' +
          '<div class="line-item loading skeleton-line-row"><span class="skeleton-chip"></span><span class="skeleton-line w-70"></span><span class="skeleton-chip small"></span></div>' +
          '<div class="line-item loading skeleton-line-row"><span class="skeleton-chip"></span><span class="skeleton-line w-62"></span><span class="skeleton-chip small"></span></div>' +
          '<div class="line-item loading skeleton-line-row"><span class="skeleton-chip"></span><span class="skeleton-line w-76"></span><span class="skeleton-chip small"></span></div>' +
        '</div>';
      return;
    }

    container.innerHTML = lines.map(function(line, idx) {
      var evalStr = line.eval;
      var evalNum = parseFloat(evalStr);
      var isMate = evalStr && evalStr.toString().indexOf('M') !== -1;
      var evalClass = (!isMate && evalNum < 0) ? 'line-eval negative' : 'line-eval';
      var evalDisplay = isMate ? evalStr : (evalNum > 0 ? '+' + evalStr : evalStr);

      var pvFormatted = formatPV(line.pv, fen);

      return `<div class="line-item" data-pv="${escapeAttr(line.pv || '')}" onclick="EngineController.loadLine(this)">
        <span class="${evalClass}">${escapeHtml(evalDisplay)}</span>
        <span class="line-moves">${escapeHtml(pvFormatted)}</span>
        <span class="line-depth-badge">d${line.depth}</span>
      </div>`;
    }).join('');

    renderLiveCandidates();
  }

  function formatPV(pv, fen) {
    if (!pv) return '—';

    var moves = pv.split(' ');
    var chess = null;

    try {
      chess = new Chess();
      if (fen) chess.load(fen);

      var formatted = [];
      var startMoveNum = parseInt(fen ? fen.split(' ')[5] : 1);
      var startTurn = fen ? fen.split(' ')[1] : 'w';
      var moveNum = startMoveNum;
      var isWhite = startTurn === 'w';

      for (var i = 0; i < Math.min(moves.length, 8); i++) {
        var m = moves[i];
        if (!m || m.length < 4) break;

        if (isWhite || i === 0) {
          var numPrefix = isWhite ? moveNum + '.' : moveNum + '...';
          formatted.push(numPrefix);
          if (isWhite) moveNum++;
        }

        var moveResult = chess.move({from: m.slice(0,2), to: m.slice(2,4), promotion: m[4] || 'q'});
        if (moveResult) {
          formatted.push(moveResult.san);
          isWhite = !isWhite;
        } else {
          formatted.push(m);
        }
      }

      return formatted.join(' ');
    } catch(e) {
      return moves.slice(0, 6).join(' ');
    }
  }

  function formatMove(uciMove) {
    if (!uciMove || uciMove.length < 4) return uciMove;
    return uciMove.slice(0,2) + '-' + uciMove.slice(2,4);
  }

  function formatNodes(n) {
    if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n/1000).toFixed(0) + 'K';
    return n;
  }

  function loadLine(el) {
    var pv = el.getAttribute('data-pv');
    if (!pv || !window.AppController) return;
    AppController.loadEngineLine(pv);
  }

  function renderLiveCandidates() {
    var container = document.getElementById('grLiveCandidates');
    if (!container) return;

    var lines = [];
    for (var i = 1; i <= numLines; i++) {
      if (currentLines[i]) lines.push(currentLines[i]);
    }

    if (!lines.length) {
      container.innerHTML = '<div class="gr-analysis-empty">Start analyzing a position to see engine candidates.</div>';
      return;
    }

    var fen = currentAnalysisFen;
    var qualityLabels = ['Best', 'Good', 'Interesting'];

    container.innerHTML = lines.map(function(line, idx) {
      var evalStr = line.eval;
      var evalNum = parseFloat(evalStr);
      var isMate = evalStr && evalStr.toString().indexOf('M') !== -1;
      var evalDisplay = isMate ? evalStr : (evalNum > 0 ? '+' + evalStr : evalStr);
      var evalClass = (!isMate && evalNum < 0) ? 'gr-live-card-eval negative' : 'gr-live-card-eval';

      var firstUci = line.pv ? line.pv.split(' ')[0] : '';
      var firstSan = firstUci ? (firstUci.slice(0, 2) + '-' + firstUci.slice(2, 4)) : '—';
      try {
        var chess = new Chess();
        if (fen) chess.load(fen);
        if (firstUci && firstUci.length >= 4) {
          var m = chess.move({ from: firstUci.slice(0, 2), to: firstUci.slice(2, 4), promotion: firstUci[4] || 'q' });
          if (m) firstSan = m.san;
        }
      } catch { /* invalid position – skip SAN conversion */ }

      var pvFormatted = formatPV(line.pv, fen);
      var tagLabel = qualityLabels[idx] || '';
      var tagClass = idx === 0 ? 'gr-live-card-tag best' : idx === 1 ? 'gr-live-card-tag good' : 'gr-live-card-tag alt';
      var tag = tagLabel ? '<span class="' + tagClass + '">' + tagLabel + '</span>' : '';

      return '<button type="button" class="gr-live-card' + (idx === 0 ? ' is-best' : '') + '" data-pv="' + escapeAttr(line.pv || '') + '" onclick="EngineController.loadLine(this)">' +
        '<span class="' + evalClass + '">' + escapeHtml(evalDisplay) + '</span>' +
        '<div class="gr-live-card-body">' +
          '<div class="gr-live-card-top">' +
            '<span class="gr-live-card-move">' + escapeHtml(firstSan) + '</span>' +
            tag +
          '</div>' +
          '<span class="gr-live-card-line">' + escapeHtml(pvFormatted) + '</span>' +
        '</div>' +
        '<span class="gr-live-card-depth">d' + (line.depth || '?') + '</span>' +
      '</button>';
    }).join('');
  }

  function stop() {
    isAnalyzing = false;
    EngineManager.stop();
  }

  // ---------- Full game review (chess kit pipeline) ----------

  function analyzeGame(pgn, meta, onProgress, onComplete) {
    var parsedGame = PGNParser.parse(pgn || '');
    var history = parsedGame && parsedGame.moves ? parsedGame.moves.slice() : [];
    if (!history.length) {
      if (typeof onComplete === 'function') onComplete([], []);
      return;
    }

    var positions = PGNParser.buildPositions(parsedGame).map(function(position) {
      return position.fen;
    });

    stop();
    var reviewToken = ++gameAnalysisToken;
    var profile = getReviewProfile(positions.length);
    var totalUnits = positions.length;

    // Chess kit needs at least two lines for classification. Keeping five
    // lets the review Analyze panel explain viable alternatives per move.
    EngineManager.analyzeBatch(positions, profile.depth, REVIEW_MULTI_PV, function(done) {
      if (reviewToken !== gameAnalysisToken) return;
      if (typeof onProgress === 'function') onProgress(done, totalUnits);
    }, function(batchResults) {
      if (reviewToken !== gameAnalysisToken) return;
      if (!batchResults || !batchResults.length) {
        if (typeof onComplete === 'function') onComplete([], history);
        return;
      }

      analyzeGameWithChessKit({
        history: history,
        positions: positions,
        batchResults: batchResults,
        meta: meta || null
      }).then(function(summary) {
        if (reviewToken !== gameAnalysisToken) return;
        var reviewedHistory = summary.classifiedHistory;
        reviewedHistory.gameSummary = {
          accuracy: summary.accuracy,
          estimatedElo: summary.estimatedElo,
          openings: summary.openings
        };
        if (typeof onComplete === 'function') {
          onComplete(reviewedHistory, reviewedHistory);
        }
      });
    }, { chunkSize: profile.chunkSize });
  }

  return {
    init: init,
    analyzeFen: analyzeFen,
    analyzeGame: analyzeGame,
    updateLinesDisplay: updateLinesDisplay,
    renderLiveCandidates: renderLiveCandidates,
    loadLine: loadLine,
    stop: stop,
    setNumLines: function(n) { numLines = n; },
    setDepth: function(d) { analysisDepth = d; },
    setOption: function(name, value) { EngineManager.setOption(name, value); },
    centipawnsToWinPercent: centipawnsToWinPercent,
    MoveClassification: MoveClassification
  };
})();

export default EngineController;
