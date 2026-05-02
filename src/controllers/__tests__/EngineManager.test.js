import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest';

import EngineManager from '../EngineManager.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

class FakeStockfishWorker {
  static instances = [];
  static failNextGo = false;

  constructor(url) {
    this.url = url;
    this.commands = [];
    this.multiPv = 1;
    this.onmessage = null;
    FakeStockfishWorker.instances.push(this);
  }

  postMessage(command) {
    this.commands.push(command);

    if (command === 'uci') {
      this.emit('uciok');
      return;
    }

    if (command.startsWith('setoption name MultiPV value')) {
      this.multiPv = parseInt(command.split(/\s+/).pop(), 10) || 1;
      return;
    }

    if (command === 'isready') {
      this.emit('readyok');
      return;
    }

    if (command.startsWith('go ')) {
      if (FakeStockfishWorker.failNextGo) {
        FakeStockfishWorker.failNextGo = false;
        setTimeout(() => {
          if (this.onerror) {
            this.onerror({
              message: 'simulated worker crash',
              filename: this.url,
              lineno: 1
            });
          }
        }, 0);
        return;
      }
      const depth = parseInt((command.match(/depth (\d+)/) || [])[1], 10) || 4;
      this.emit('info depth 1 seldepth 1 multipv 1 score cp 12 nodes 100 nps 1000 pv e2e4 e7e5');
      this.emit(`info depth ${depth} seldepth ${depth} multipv 1 score cp 24 nodes 2000 nps 2000 pv e2e4 e7e5`);
      if (this.multiPv > 1) {
        this.emit(`info depth ${depth} seldepth ${depth} multipv 2 score cp 8 nodes 1800 nps 1800 pv d2d4 d7d5`);
      }
      this.emit('bestmove e2e4 ponder e7e5');
    }
  }

  emit(data) {
    setTimeout(() => {
      if (this.onmessage) this.onmessage({ data });
    }, 0);
  }

  terminate() {}
}

beforeAll(() => {
  vi.stubGlobal('Worker', FakeStockfishWorker);
  vi.stubGlobal('crossOriginIsolated', true);
});

afterEach(() => {
  EngineManager._resetForTests();
  FakeStockfishWorker.instances = [];
  FakeStockfishWorker.failNextGo = false;
  vi.clearAllMocks();
  vi.stubGlobal('crossOriginIsolated', true);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('EngineManager browser Stockfish', () => {
  it('initializes the browser WASM worker', async () => {
    const status = await new Promise((resolve) => {
      EngineManager.init(resolve);
    });

    expect(status.ready).toBe(true);
    expect(status.mode).toBe('browser-wasm');
    expect(status.local).toBe(true);
    expect(status.engine).toContain('Stockfish 18');
    expect(FakeStockfishWorker.instances[0].url).toContain('/engines/stockfish-18/stockfish.js');
  });

  it('falls back to the strongest single-thread engine when shared-memory threads are unavailable', async () => {
    vi.stubGlobal('crossOriginIsolated', false);
    EngineManager._resetForTests();

    const status = await new Promise((resolve) => {
      EngineManager.init(resolve);
    });

    expect(status.ready).toBe(true);
    expect(status.engineId).toBe('sf18-full');
    expect(status.selectedEngineId).toBe('auto');
    expect(FakeStockfishWorker.instances[0].url).toContain('/engines/stockfish-18/stockfish-18-single-6563532.js');
  });

  it('keeps explicit engine overrides for power users', async () => {
    EngineManager.setOption('Engine', 'sf17-1-full');

    const status = await new Promise((resolve) => {
      EngineManager.init(resolve);
    });

    expect(status.ready).toBe(true);
    expect(status.engineId).toBe('sf17-1-full');
    expect(status.selectedEngineId).toBe('sf17-1-full');
    expect(FakeStockfishWorker.instances[0].url).toContain('/engines/stockfish-17.1/stockfish-17.1-single.js');
  });

  it('streams progressive info and finishes a single FEN analysis', async () => {
    const events = [];

    await new Promise((resolve) => {
      EngineManager.analyze(START_FEN, 6, 2, (event) => {
        events.push(event);
        if (event.type === 'bestmove') resolve();
      });
    });

    const infoEvents = events.filter((event) => event.type === 'info');
    expect(infoEvents.length).toBeGreaterThanOrEqual(2);
    expect(infoEvents.some((event) => event.depth === 1)).toBe(true);
    expect(infoEvents.some((event) => event.depth === 6)).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'bestmove', move: 'e2e4' });
  });

  it('returns one browser analysis result per batch position', async () => {
    const progress = [];
    const result = await new Promise((resolve) => {
      EngineManager.analyzeBatch(
        [START_FEN, AFTER_E4_FEN],
        5,
        2,
        (done, total) => progress.push([done, total]),
        resolve,
        { concurrency: 2, chunkSize: 1, initialChunkSize: 1 }
      );
    });

    expect(result).toHaveLength(2);
    expect(result.every((item) => item.ok === true)).toBe(true);
    expect(result.every((item) => item.bestmove === 'e2e4')).toBe(true);
    expect(result.every((item) => item.lines.length === 2)).toBe(true);
    expect(progress[0]).toEqual([0, 2]);
    expect(progress.at(-1)).toEqual([2, 2]);
  });

  it('recovers with another browser WASM worker after a transient runtime crash', async () => {
    const events = [];
    FakeStockfishWorker.failNextGo = true;

    await new Promise((resolve) => {
      EngineManager.analyze(START_FEN, 6, 1, (event) => {
        events.push(event);
        if (event.type === 'bestmove') resolve();
      });
    });

    expect(events.at(-1)).toEqual({ type: 'bestmove', move: 'e2e4' });
    expect(FakeStockfishWorker.instances.at(-1).url).toContain('/engines/');
  });
});
