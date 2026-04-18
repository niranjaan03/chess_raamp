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

  function analyze(fen, depth, multiPvCount, onUpdate) {
    stop();
    analysisCallback = onUpdate;
    activeController = new AbortController();

    fetch('/api/engine/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fen: fen,
        depth: depth,
        multiPv: multiPvCount || 1
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
    var results = new Array(positions.length);
    var cursor = 0;

    function finish(payload) {
      if (activeController === controller) {
        activeController = null;
      }
      if (typeof onComplete === 'function') {
        onComplete(payload || []);
      }
    }

    function handleFailure() {
      for (var i = 0; i < positions.length; i++) {
        if (!results[i]) {
          results[i] = { ok: false, bestmove: null, lines: [] };
        }
      }
      finish(results);
    }

    function runNextChunk() {
      if (signal.aborted) {
        finish([]);
        return;
      }

      var start = cursor;
      var chunk = positions.slice(start, start + chunkSize);
      if (!chunk.length) {
        finish(results);
        return;
      }

      fetch('/api/engine/analyze-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positions: chunk,
          depth: depth,
          multiPv: multiPv || 1
        }),
        signal: signal
      })
        .then(function(r) {
          if (!r.ok) throw new Error('Batch analysis request failed');
          return r.json();
        })
        .then(function(data) {
          if (signal.aborted) {
            finish([]);
            return;
          }

          var chunkResults = data && data.results ? data.results : [];
          for (var i = 0; i < chunk.length; i++) {
            results[start + i] = chunkResults[i] || { ok: false, bestmove: null, lines: [] };
          }

          cursor = start + chunk.length;
          if (typeof onProgress === 'function') {
            onProgress(cursor, positions.length);
          }

          if (cursor >= positions.length) {
            finish(results);
            return;
          }

          runNextChunk();
        })
        .catch(function(err) {
          if (err && err.name === 'AbortError') {
            finish([]);
            return;
          }
          handleFailure();
        });
    }

    if (typeof onProgress === 'function') {
      onProgress(0, positions.length);
    }
    runNextChunk();
  }

  function setOption() {
    // Native bridge ignores dynamic UCI option changes for now.
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
