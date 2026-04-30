/**
 * Browser-first Stockfish bridge.
 *
 * The public API intentionally matches the old server-backed EngineManager so
 * EngineController and the game-review pipeline can keep using it unchanged.
 */

const EngineManager = (function() {
  var ENGINE_CANDIDATES = [
    {
      id: 'sf18',
      label: 'Stockfish 18 WASM',
      script: getPublicPath('/engines/stockfish-18/stockfish.js'),
      supportsThreads: false
    },
    {
      id: 'sf18-lite',
      label: 'Stockfish 18 Lite WASM',
      script: getPublicPath('/engines/stockfish-18/stockfish-18-lite-single.js'),
      supportsThreads: false
    },
    {
      id: 'sf18-full',
      label: 'Stockfish 18 Full WASM',
      script: getPublicPath('/engines/stockfish-18/stockfish-18-single-6563532.js'),
      supportsThreads: false
    },
    {
      id: 'sf17-1-lite',
      label: 'Stockfish 17.1 Lite WASM',
      script: getPublicPath('/engines/stockfish-17.1/stockfish-17.1-lite-single.js'),
      supportsThreads: false
    },
    {
      id: 'sf17-1-full',
      label: 'Stockfish 17.1 Full WASM',
      script: getPublicPath('/engines/stockfish-17.1/stockfish-17.1-single.js'),
      supportsThreads: false
    },
    {
      id: 'sf17-lite',
      label: 'Stockfish 17 Lite WASM',
      script: getPublicPath('/engines/stockfish-17/stockfish-17-lite-single.js'),
      supportsThreads: false
    },
    {
      id: 'sf17-full',
      label: 'Stockfish 17 Full WASM',
      script: getPublicPath('/engines/stockfish-17/stockfish-17-single.js'),
      supportsThreads: false
    },
    {
      id: 'sf16-1-lite',
      label: 'Stockfish 16.1 Lite WASM',
      script: getPublicPath('/engines/stockfish-16.1/stockfish-16.1-lite-single.js'),
      supportsThreads: false
    },
    {
      id: 'sf16-1-full',
      label: 'Stockfish 16.1 Full WASM',
      script: getPublicPath('/engines/stockfish-16.1/stockfish-16.1-single.js'),
      supportsThreads: false
    },
    {
      id: 'sf16-nnue',
      label: 'Stockfish 16 NNUE WASM',
      script: getPublicPath('/engines/stockfish-16/stockfish-nnue-16-single.js'),
      supportsThreads: false
    }
  ];

  var isReady = false;
  var mode = 'browser-wasm';
  var activeEngine = ENGINE_CANDIDATES[0];
  var selectedEngineId = activeEngine.id;
  var readyCallback = null;
  var readyNotified = false;
  var workerPool = [];
  var bootPromise = null;
  var userThreads = null;
  var userHash = null;
  var activeRun = null;
  var runSeq = 0;
  var failedEngineIds = new Set();

  function getPublicPath(path) {
    var base = '/';
    try {
      base = (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/';
    } catch {
      base = '/';
    }
    return base.replace(/\/$/, '') + path;
  }

  function isWasmSupported() {
    return typeof WebAssembly === 'object' &&
      typeof WebAssembly.validate === 'function' &&
      WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
  }

  function isIosDevice() {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  }

  function isMobileDevice() {
    if (typeof navigator === 'undefined') return false;
    return isIosDevice() || /Android|Opera Mini/i.test(navigator.userAgent || '');
  }

  function hasSharedArrayBuffer() {
    return typeof SharedArrayBuffer !== 'undefined' &&
      typeof crossOriginIsolated !== 'undefined' &&
      crossOriginIsolated === true;
  }

  function getHardwareConcurrency() {
    if (typeof navigator === 'undefined') return 4;
    return Math.max(1, parseInt(navigator.hardwareConcurrency, 10) || 4);
  }

  function getRecommendedWorkerCount(requested) {
    if (isMobileDevice()) return 1;
    var cpuBased = Math.max(1, Math.min(4, getHardwareConcurrency() - 2));
    var requestedCount = Math.max(1, parseInt(requested, 10) || cpuBased);
    return Math.max(1, Math.min(requestedCount, cpuBased));
  }

  function getRequestedThreads(override) {
    if (!activeEngine.supportsThreads) return 1;
    var threads = parseInt(override || userThreads, 10);
    if (!threads || threads < 1) threads = hasSharedArrayBuffer() ? 2 : 1;
    if (isMobileDevice()) threads = 1;
    return Math.max(1, Math.min(8, threads));
  }

  function getHashMb() {
    var hash = parseInt(userHash, 10);
    if (!hash || hash < 16) hash = isMobileDevice() ? 16 : 32;
    return Math.max(16, Math.min(128, hash));
  }

  function adjustDepthForDevice(depth, isBatch) {
    var target = Math.max(1, Math.min(50, parseInt(depth, 10) || 16));
    if (!isMobileDevice()) return target;
    return Math.min(target, isBatch ? 12 : 15);
  }

  function getPositionDepth(baseDepth, index, total, options) {
    if (options && Array.isArray(options.depths)) {
      var specific = parseInt(options.depths[index], 10);
      if (specific > 0) return adjustDepthForDevice(specific, true);
    }

    var target = adjustDepthForDevice(baseDepth, true);
    if (!total || total < 80) return target;
    if (index < 12) return Math.max(8, target - 2);
    if (index % 3 === 0) return Math.max(8, target - 1);
    return target;
  }

  function parseInfoLine(raw) {
    var line = String(raw || '').trim();
    var depthMatch = line.match(/ depth (\d+)/);
    var scoreMatch = line.match(/ score (cp|mate) (-?\d+)/);
    var pvMatch = line.match(/ pv (.+)/);
    var nodesMatch = line.match(/ nodes (\d+)/);
    var multipvMatch = line.match(/ multipv (\d+)/);
    var npsMatch = line.match(/ nps (\d+)/);
    var seldepthMatch = line.match(/ seldepth (\d+)/);
    var wdlMatch = line.match(/ wdl (\d+) (\d+) (\d+)/);

    if (!depthMatch || !scoreMatch || !pvMatch) return null;

    var scoreType = scoreMatch[1];
    var scoreValue = parseInt(scoreMatch[2], 10);
    var evalValue = scoreType === 'mate'
      ? (scoreValue > 0 ? 'M' + scoreValue : '-M' + Math.abs(scoreValue))
      : (scoreValue / 100).toFixed(2);

    return {
      type: 'info',
      depth: parseInt(depthMatch[1], 10),
      seldepth: seldepthMatch ? parseInt(seldepthMatch[1], 10) : 0,
      line: multipvMatch ? parseInt(multipvMatch[1], 10) : 1,
      eval: evalValue,
      scoreType: scoreType,
      scoreValue: scoreValue,
      pv: pvMatch[1].trim(),
      nodes: nodesMatch ? parseInt(nodesMatch[1], 10) : 0,
      nps: npsMatch ? parseInt(npsMatch[1], 10) : 0,
      wdl: wdlMatch ? {
        w: parseInt(wdlMatch[1], 10),
        d: parseInt(wdlMatch[2], 10),
        l: parseInt(wdlMatch[3], 10)
      } : null
    };
  }

  function parseBestMove(line) {
    var parts = String(line || '').trim().split(/\s+/);
    return parts[1] && parts[1] !== '(none)' ? parts[1] : null;
  }

  function getEngineById(engineId) {
    return ENGINE_CANDIDATES.find(function(engine) {
      return engine.id === engineId;
    }) || ENGINE_CANDIDATES[0];
  }

  function getWorkerUrl(engine) {
    var separator = engine.script.indexOf('?') === -1 ? '?' : '&';
    return engine.script + separator + 'v=' + encodeURIComponent(engine.id);
  }

  function getWorkerErrorMessage(error, engine) {
    if (!error) return engine.label + ' worker failed to load';
    var parts = [];
    if (error.message) parts.push(error.message);
    if (error.filename) parts.push(error.filename);
    if (error.lineno) parts.push('line ' + error.lineno);
    return (parts.length ? parts.join(' ') : 'worker failed to load') + ' (' + engine.label + ')';
  }

  function terminateWorkerPool() {
    workerPool.forEach(function(worker) {
      worker.terminate();
    });
    workerPool = [];
  }

  function BrowserStockfishWorker(index, engine) {
    this.index = index;
    this.engine = engine;
    this.worker = new Worker(getWorkerUrl(engine));
    this.listeners = [];
    this.multiPv = null;
    this.threads = null;
    this.hashMb = null;
    this.ready = false;
    this.searching = false;
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = this.handleError.bind(this);
    this.readyPromise = this.boot();
  }

  BrowserStockfishWorker.prototype.handleMessage = function(event) {
    var line = String(event && event.data ? event.data : '');
    if (line.indexOf('bestmove') === 0) this.searching = false;
    this.listeners.slice().forEach(function(listener) {
      listener(line);
    });
  };

  BrowserStockfishWorker.prototype.handleError = function(error) {
    this.lastError = new Error(getWorkerErrorMessage(error, this.engine));
    this.crashed = true;
    this.listeners.slice().forEach(function(listener) {
      listener('__engine_error__');
    });
  };

  BrowserStockfishWorker.prototype.send = function(command) {
    this.worker.postMessage(command);
  };

  BrowserStockfishWorker.prototype.waitFor = function(match, timeoutMs, onLine) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var finished = false;
      var timeout = setTimeout(function() {
        cleanup();
        reject(new Error('Stockfish browser worker timed out'));
      }, timeoutMs || 15000);

      function cleanup() {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        self.listeners = self.listeners.filter(function(item) { return item !== listener; });
      }

      function listener(line) {
        if (line === '__engine_error__') {
          cleanup();
          reject(self.lastError || new Error(self.engine.label + ' worker failed to load'));
          return;
        }
        if (typeof onLine === 'function') onLine(line);
        if (match(line)) {
          cleanup();
          resolve(line);
        }
      }

      self.listeners.push(listener);
    });
  };

  BrowserStockfishWorker.prototype.waitForAfterSend = function(commands, match, timeoutMs, onLine) {
    var promise = this.waitFor(match, timeoutMs, onLine);
    commands.forEach(this.send.bind(this));
    return promise;
  };

  BrowserStockfishWorker.prototype.boot = function() {
    var self = this;
    return this.waitForAfterSend(['uci'], function(line) {
      return line === 'uciok';
    }, 20000).then(function() {
      var commands = [
        'setoption name UCI_ShowWDL value true',
        'setoption name Hash value ' + getHashMb(),
      ];
      if (self.engine.supportsThreads) {
        commands.push('setoption name Threads value ' + getRequestedThreads());
      }
      commands.push('isready');
      return self.waitForAfterSend(commands, function(line) {
        return line === 'readyok';
      }, 10000);
    }).then(function() {
      self.ready = true;
      self.hashMb = getHashMb();
      self.threads = getRequestedThreads();
      return self;
    });
  };

  BrowserStockfishWorker.prototype.configure = function(options) {
    var self = this;
    return this.readyPromise.then(function() {
      var multiPv = Math.max(1, Math.min(5, parseInt(options && options.multiPv, 10) || 1));
      var threads = getRequestedThreads(options && options.threads);
      var hashMb = getHashMb();
      var commands = [];

      if (self.multiPv !== multiPv) {
        commands.push('setoption name MultiPV value ' + multiPv);
        self.multiPv = multiPv;
      }
      if (self.threads !== threads) {
        if (self.engine.supportsThreads) {
          commands.push('setoption name Threads value ' + threads);
        }
        self.threads = threads;
      }
      if (self.hashMb !== hashMb) {
        commands.push('setoption name Hash value ' + hashMb);
        self.hashMb = hashMb;
      }

      if (!commands.length) return self;
      commands.push('isready');
      return self.waitForAfterSend(commands, function(line) {
        return line === 'readyok';
      }, 10000).then(function() {
        return self;
      });
    });
  };

  BrowserStockfishWorker.prototype.drainSearch = function() {
    var self = this;
    if (!self.searching) return Promise.resolve();
    return new Promise(function(resolve) {
      var timeout = setTimeout(function() {
        self.listeners = self.listeners.filter(function(item) { return item !== listener; });
        self.searching = false;
        resolve();
      }, 2000);
      function listener(line) {
        if (line.indexOf('bestmove') === 0 || line === '__engine_error__') {
          clearTimeout(timeout);
          self.listeners = self.listeners.filter(function(item) { return item !== listener; });
          resolve();
        }
      }
      self.listeners.push(listener);
      try { self.worker.postMessage('stop'); } catch { /* worker may already be gone */ }
    });
  };

  BrowserStockfishWorker.prototype.analyzePosition = function(params) {
    var self = this;
    var linesByPv = new Map();
    var bestmove = null;
    var depth = adjustDepthForDevice(params.depth, !!params.isBatch);
    var movetimeMs = parseInt(params.movetimeMs, 10) || null;
    var budget = movetimeMs && movetimeMs > 0
      ? Math.max(8000, movetimeMs + 5000)
      : 18000 + Math.max(0, depth - 15) * 1500;

    return this.drainSearch().then(function() {
      return self.configure(params);
    }).then(function() {
      var commands = [];
      if (params.newGame) commands.push('ucinewgame');
      commands.push('position fen ' + params.fen);
      commands.push(movetimeMs && movetimeMs > 0
        ? 'go depth ' + depth + ' movetime ' + movetimeMs
        : 'go depth ' + depth);
      self.searching = true;

      return self.waitForAfterSend(commands, function(line) {
        return line.indexOf('bestmove') === 0;
      }, budget, function(line) {
        if (!params.run || params.run.aborted) return;
        if (line.indexOf('info ') === 0) {
          var parsed = parseInfoLine(line);
          if (!parsed) return;
          linesByPv.set(parsed.line, parsed);
          if (typeof params.onInfo === 'function') params.onInfo(parsed);
          return;
        }
        if (line.indexOf('bestmove') === 0) {
          bestmove = parseBestMove(line);
        }
      });
    }).then(function() {
      var lines = Array.from(linesByPv.values()).sort(function(a, b) {
        return a.line - b.line;
      });
      return {
        ok: true,
        engineId: self.engine.id,
        engine: self.engine.label,
        bestmove: bestmove,
        lines: lines
      };
    });
  };

  BrowserStockfishWorker.prototype.stop = function() {
    try { this.send('stop'); } catch { /* worker may already be gone */ }
  };

  BrowserStockfishWorker.prototype.terminate = function() {
    try {
      this.send('quit');
      this.worker.terminate();
    } catch { /* worker may already be gone */ }
  };

  function beginRun() {
    if (activeRun) activeRun.aborted = true;
    activeRun = { id: ++runSeq, aborted: false };
    return activeRun;
  }

  function isActiveRun(run) {
    return activeRun === run && run && !run.aborted;
  }

  function ensureEngineCandidate(workerCount, candidateIndex) {
    while (
      candidateIndex < ENGINE_CANDIDATES.length &&
      failedEngineIds.has(ENGINE_CANDIDATES[candidateIndex].id)
    ) {
      candidateIndex++;
    }
    if (candidateIndex >= ENGINE_CANDIDATES.length) {
      return Promise.reject(new Error('No working Stockfish engine available'));
    }
    var engine = ENGINE_CANDIDATES[candidateIndex];
    if (activeEngine.id !== engine.id) {
      terminateWorkerPool();
      activeEngine = engine;
      isReady = false;
    }

    var count = Math.max(1, workerCount || 1);
    var creations = [];
    for (var i = workerPool.length; i < count; i++) {
      workerPool.push(new BrowserStockfishWorker(i, engine));
    }
    for (var j = 0; j < count; j++) {
      creations.push(workerPool[j].readyPromise);
    }

    return Promise.all(creations).then(function() {
      isReady = true;
      mode = 'browser-wasm';
      activeEngine = engine;
      selectedEngineId = engine.id;
      return workerPool.slice(0, count);
    }).catch(function(err) {
      var hasFallback = candidateIndex + 1 < ENGINE_CANDIDATES.length;
      console.warn('[EngineManager] ' + engine.label + ' failed to boot' + (hasFallback ? ', trying next candidate.' : '.'), err);
      if (hasFallback) failedEngineIds.add(engine.id);
      terminateWorkerPool();
      isReady = false;
      bootPromise = null;
      if (hasFallback) {
        return ensureEngineCandidate(workerCount, candidateIndex + 1);
      }
      throw err;
    });
  }

  function markActiveEngineFailed(reason) {
    if (!activeEngine) return false;
    var failedEngine = activeEngine;
    var nextEngine = ENGINE_CANDIDATES.find(function(candidate) {
      return candidate.id !== failedEngine.id && !failedEngineIds.has(candidate.id);
    });
    console.warn('[EngineManager] ' + failedEngine.label + ' faulted at runtime' + (nextEngine ? ', falling back.' : ', restarting.'), reason || '');
    if (nextEngine) failedEngineIds.add(failedEngine.id);
    terminateWorkerPool();
    isReady = false;
    bootPromise = null;
    if (nextEngine) {
      activeEngine = nextEngine;
      selectedEngineId = nextEngine.id;
    } else {
      activeEngine = failedEngine;
      selectedEngineId = failedEngine.id;
    }
    return true;
  }

  function ensureBrowserEngine(workerCount) {
    if (!isWasmSupported()) {
      return Promise.reject(new Error('WebAssembly is not supported in this browser'));
    }
    if (typeof Worker === 'undefined') {
      return Promise.reject(new Error('Web Workers are not supported in this browser'));
    }

    activeEngine = getEngineById(selectedEngineId);
    return ensureEngineCandidate(workerCount, ENGINE_CANDIDATES.indexOf(activeEngine));
  }

  function getBrowserStatus() {
    return {
      ready: isReady,
      simulation: false,
      mode: mode,
      engineId: activeEngine.id,
      engine: activeEngine.label,
      local: mode === 'browser-wasm',
      workers: workerPool.length || 1,
      mobile: isMobileDevice(),
      sharedArrayBuffer: hasSharedArrayBuffer(),
      threaded: activeEngine.supportsThreads && hasSharedArrayBuffer() && getRequestedThreads() > 1
    };
  }

  function initEngine(onReady) {
    readyCallback = onReady;
    readyNotified = false;

    bootPromise = ensureBrowserEngine(1)
      .then(function() {
        notifyReady(getBrowserStatus());
      })
      .catch(function(err) {
        isReady = false;
        mode = 'browser-wasm';
        notifyReady(Object.assign({}, getBrowserStatus(), {
          ready: false,
          error: err && err.message ? err.message : 'Browser Stockfish unavailable'
        }));
      });
  }

  function notifyReady(status) {
    if (readyNotified) return;
    readyNotified = true;
    if (typeof readyCallback === 'function') {
      readyCallback(status || getBrowserStatus());
    }
  }

  function ensureReady() {
    if (bootPromise) {
      return bootPromise.then(function() {
        if (mode === 'browser-wasm' && isReady) return ensureBrowserEngine(1);
        throw new Error('browser engine unavailable');
      });
    }
    return ensureBrowserEngine(1);
  }

  function analyze(fen, depth, multiPvCount, onUpdate, options) {
    stop();
    var run = beginRun();
    var requestOptions = options || {};

    function attempt(retriesLeft) {
      return ensureReady()
        .then(function(workers) {
          if (!isActiveRun(run)) return null;
          return workers[0].analyzePosition({
            fen: fen,
            depth: depth,
            multiPv: multiPvCount || 1,
            movetimeMs: requestOptions.movetimeMs,
            threads: requestOptions.threads,
            newGame: true,
            run: run,
            onInfo: function(line) {
              if (isActiveRun(run) && typeof onUpdate === 'function') onUpdate(line);
            }
          });
        })
        .then(function(result) {
          if (!isActiveRun(run) || !result) return;
          if (typeof onUpdate === 'function') {
            onUpdate({ type: 'bestmove', move: result.bestmove });
          }
        })
        .catch(function(err) {
          if (!isActiveRun(run)) return;
          if (retriesLeft > 0 && markActiveEngineFailed(err)) {
            return attempt(retriesLeft - 1);
          }
          if (typeof onUpdate === 'function') {
            onUpdate({ type: 'bestmove', move: null });
          }
        });
    }

    attempt(Math.max(1, ENGINE_CANDIDATES.length - 1));
  }

  function buildChunks(positions, chunkSize, initialChunkSize) {
    var chunks = [];
    var cursor = 0;
    while (cursor < positions.length) {
      var size = cursor === 0 ? initialChunkSize : chunkSize;
      var start = cursor;
      var end = Math.min(positions.length, start + Math.max(1, size));
      chunks.push({ start: start, end: end });
      cursor = end;
    }
    return chunks;
  }

  function analyzeBatch(positions, depth, multiPv, onProgress, onComplete, options) {
    stop();
    if (!positions || !positions.length) {
      if (typeof onComplete === 'function') onComplete([]);
      return;
    }

    var run = beginRun();
    var requestOptions = options || {};
    var total = positions.length;
    var requestedConcurrency = parseInt(requestOptions.concurrency, 10) || 1;
    var workerCount = getRecommendedWorkerCount(requestedConcurrency);
    var results = new Array(total);
    var completed = 0;
    var chunkSize = Math.max(1, Math.min(128, parseInt(requestOptions.chunkSize, 10) || 32));
    var initialChunkSize = Math.max(1, Math.min(chunkSize, parseInt(requestOptions.initialChunkSize, 10) || chunkSize));
    var chunks = buildChunks(positions, chunkSize, initialChunkSize);
    var nextChunk = 0;

    if (typeof onProgress === 'function') onProgress(0, total);

    ensureBrowserEngine(workerCount).then(function(workers) {
      function takeChunk() {
        if (nextChunk >= chunks.length) return null;
        return chunks[nextChunk++];
      }

      function runWorker(worker) {
        var chunk = takeChunk();
        if (!chunk || !isActiveRun(run)) return Promise.resolve();

        var chain = Promise.resolve();
        for (var i = chunk.start; i < chunk.end; i++) {
          (function(index) {
            chain = chain.then(function() {
              if (!isActiveRun(run)) return null;
              return worker.analyzePosition({
                fen: positions[index],
                depth: getPositionDepth(depth, index, total, requestOptions),
                multiPv: multiPv || 1,
                movetimeMs: requestOptions.movetimeMs,
                threads: requestOptions.threads,
                newGame: index === chunk.start,
                isBatch: true,
                run: run
              }).then(function(result) {
                results[index] = result;
                completed++;
                if (typeof onProgress === 'function') onProgress(completed, total);
              });
            });
          })(i);
        }
        return chain.then(function() {
          return runWorker(worker);
        });
      }

      return Promise.all(workers.map(runWorker));
    }).then(function() {
      if (!isActiveRun(run)) return;
      activeRun = null;
      if (typeof onComplete === 'function') onComplete(results);
    }).catch(function(err) {
      if (!isActiveRun(run)) return;
      // If the active engine crashed mid-batch, mark it dead and let the
      // next analyze() / analyzeBatch() boot the fallback. Surface a useful
      // error message either way.
      markActiveEngineFailed(err);
      var errorMessage = err && err.message ? err.message : 'Browser Stockfish batch analysis failed';
      for (var i = 0; i < positions.length; i++) {
        if (!results[i]) results[i] = { ok: false, error: errorMessage, bestmove: null, lines: [] };
      }
      activeRun = null;
      if (typeof onComplete === 'function') onComplete(results);
    });
  }

  function stop() {
    if (activeRun) activeRun.aborted = true;
    activeRun = null;
    workerPool.forEach(function(worker) {
      worker.stop();
    });
  }

  function setOption(name, value) {
    if (name === 'Threads') userThreads = parseInt(value, 10) || null;
    else if (name === 'Hash') userHash = parseInt(value, 10) || null;
    else if (name === 'Engine') {
      var nextEngine = getEngineById(value);
      if (nextEngine.id !== selectedEngineId) {
        selectedEngineId = nextEngine.id;
        activeEngine = nextEngine;
        isReady = false;
        bootPromise = null;
        terminateWorkerPool();
        // User-driven engine choice resets prior failure flags so the
        // engine they picked actually gets a chance to boot.
        failedEngineIds.delete(nextEngine.id);
      }
    }
  }

  return {
    init: initEngine,
    analyze: analyze,
    analyzeBatch: analyzeBatch,
    stop: stop,
    setOption: setOption,
    status: getBrowserStatus,
    _parseInfoLine: parseInfoLine
  };
})();

export default EngineManager;
