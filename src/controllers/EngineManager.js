/**
 * chess ramp - Local Stockfish bridge client
 * Talks to the native Stockfish middleware exposed by Vite dev/preview.
 */

const EngineManager = (function() {
  var isReady = false;
  var analysisCallback = null;
  var activeController = null;
  var readyCallback = null;
  var readyNotified = false;
  var userThreads = null;
  var userHash = null;
  var userEngine = null;

  function initEngine(onReady) {
    readyCallback = onReady;
    readyNotified = false;

    fetch('/api/engine/status')
      .then(function(r) {
        if (!r.ok) throw new Error('Status unavailable');
        return r.json();
      })
      .then(function(status) {
        isReady = !!(status && status.ready);
        notifyReady({
          ready: isReady,
          simulation: false,
          mode: 'native',
          engine: status && status.engine ? status.engine : 'Stockfish 18'
        });
      })
      .catch(function() {
        isReady = false;
        notifyReady({
          ready: false,
          simulation: false,
          mode: 'native',
          engine: 'Stockfish 18'
        });
      });
  }

  function notifyReady(status) {
    if (readyNotified) return;
    readyNotified = true;
    if (typeof readyCallback === 'function') {
      readyCallback(status || {
        ready: isReady,
        simulation: false,
        mode: 'native',
        engine: 'Stockfish 18'
      });
    }
  }

  function analyze(fen, depth, multiPvCount, onUpdate, options) {
    stop();
    analysisCallback = onUpdate;
    activeController = new AbortController();
    var movetimeMs = parseInt(options && options.movetimeMs, 10) || null;
    var engineChoice = options && options.engine ? options.engine : userEngine;

    fetch('/api/engine/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fen: fen,
        depth: depth,
        multiPv: multiPvCount || 1,
        threads: userThreads,
        hashMb: userHash,
        engine: engineChoice,
        movetimeMs: movetimeMs
      }),
      signal: activeController.signal
    })
      .then(function(r) {
        if (!r.ok) throw new Error('Analysis request failed');
        return r.json();
      })
      .then(function(result) {
        if (!analysisCallback) return;
        var lines = result && result.lines ? result.lines : [];
        lines.forEach(function(line) {
          analysisCallback({
            type: 'info',
            depth: line.depth,
            line: line.line,
            eval: line.eval,
            pv: line.pv,
            nodes: line.nodes,
            nps: line.nps
          });
        });
        analysisCallback({
          type: 'bestmove',
          move: result ? result.bestmove : null
        });
      })
      .catch(function(err) {
        if (err && err.name === 'AbortError') return;
        if (analysisCallback) {
          analysisCallback({ type: 'bestmove', move: null });
        }
      });
  }

  function stop() {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  }

  function analyzeBatch(positions, depth, multiPv, onProgress, onComplete, options) {
    stop();
    if (!positions || !positions.length) {
      if (typeof onComplete === 'function') onComplete([]);
      return;
    }

    activeController = new AbortController();

    var controller = activeController;
    var signal = controller.signal;
    var chunkSize = Math.max(1, Math.min(128, parseInt(options && options.chunkSize, 10) || 32));
    var initialChunkSize = Math.max(1, Math.min(chunkSize, parseInt(options && options.initialChunkSize, 10) || chunkSize));
    var concurrency = Math.max(1, Math.min(8, parseInt(options && options.concurrency, 10) || 1));
    var movetimeMs = parseInt(options && options.movetimeMs, 10) || null;
    var engineChoice = options && options.engine ? options.engine : userEngine;
    var threadsOverride = options && options.threads ? parseInt(options.threads, 10) : userThreads;
    var results = new Array(positions.length);
    var cursor = 0;
    var completed = 0;
    var inFlight = 0;
    var done = false;

    function finish(payload) {
      if (done) return;
      done = true;
      if (activeController === controller) activeController = null;
      if (typeof onComplete === 'function') onComplete(payload || []);
    }

    function handleFailure(err) {
      var errorMessage = err && err.message ? err.message : 'Batch analysis request failed';
      for (var i = 0; i < positions.length; i++) {
        if (!results[i]) {
          results[i] = { ok: false, error: errorMessage, bestmove: null, lines: [] };
        }
      }
      finish(results);
    }

    function pump() {
      if (done) return;
      if (signal.aborted) { finish([]); return; }

      while (inFlight < concurrency && cursor < positions.length) {
        var start = cursor;
        var nextChunkSize = (start === 0) ? initialChunkSize : chunkSize;
        var chunk = positions.slice(start, start + nextChunkSize);
        cursor = start + chunk.length;
        inFlight++;

        fetch('/api/engine/analyze-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            positions: chunk,
            depth: depth,
            multiPv: multiPv || 1,
            threads: threadsOverride,
            hashMb: userHash,
            engine: engineChoice,
            movetimeMs: movetimeMs
          }),
          signal: signal
        })
          .then(function(r) {
            if (!r.ok) throw new Error('Batch analysis request failed');
            return r.json();
          })
          .then((function(chunkStart, chunkLen) {
            return function(data) {
              if (done || signal.aborted) return;
              var chunkResults = data && data.results ? data.results : [];
              for (var i = 0; i < chunkLen; i++) {
                results[chunkStart + i] = chunkResults[i] || { ok: false, bestmove: null, lines: [] };
              }
              completed += chunkLen;
              inFlight--;
              if (typeof onProgress === 'function') onProgress(completed, positions.length);
              if (completed >= positions.length) finish(results);
              else pump();
            };
          })(start, chunk.length))
          .catch(function(err) {
            if (done) return;
            inFlight--;
            if (err && err.name === 'AbortError') { finish([]); return; }
            handleFailure(err);
          });
      }
    }

    if (typeof onProgress === 'function') onProgress(0, positions.length);
    pump();
  }

  function setOption(name, value) {
    if (name === 'Threads') userThreads = parseInt(value, 10) || null;
    else if (name === 'Hash') userHash = parseInt(value, 10) || null;
    else if (name === 'Engine') userEngine = value || null;
  }

  function getStatus() {
    return {
      ready: isReady,
      simulation: false,
      mode: 'native',
      engine: 'Stockfish 18'
    };
  }

  return {
    init: initEngine,
    analyze: analyze,
    analyzeBatch: analyzeBatch,
    stop: stop,
    setOption: setOption,
    status: getStatus
  };
})();

export default EngineManager;
