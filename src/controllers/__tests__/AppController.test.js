import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppController from '../AppController.js';
import HomeController from '../HomeController.js';

const SAMPLE_PGN = '[Event "Live Chess"]\n[Site "Chess.com"]\n[Date "2025.02.01"]\n[White "Alpha"]\n[Black "Beta"]\n[Result "1-0"]\n[ECO "C40"]\n[ECOUrl "https://www.chess.com/openings/Kings-Knight-Opening"]\n\n1. e4 e5 2. Nf3 Nc6 1-0';

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => store.has(String(key)) ? store.get(String(key)) : null,
    setItem: (key, value) => store.set(String(key), String(value)),
    removeItem: (key) => store.delete(String(key)),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] || null,
    get length() { return store.size; }
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createMemoryStorage());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('AppController.fetchChesscomMonthPgn', () => {
  it('accepts JSON monthly archive payloads and leaves PGNs available for parsing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        games: [
          {
            url: 'https://www.chess.com/game/live/123',
            pgn: SAMPLE_PGN,
            white: { username: 'Alpha', rating: 1500, result: 'win' },
            black: { username: 'Beta', rating: 1450, result: 'checkmated' }
          }
        ]
      })
    }));

    const archive = await AppController.fetchChesscomMonthPgn('hikaru', 2025, '02');
    const games = AppController.parseChesscomArchiveGames(archive);

    expect(Array.isArray(archive.games)).toBe(true);
    expect(games).toHaveLength(1);
    expect(games[0].pgn).toContain('[Event "Live Chess"]');
  });

  it('still returns raw PGN text when the endpoint serves PGN directly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => SAMPLE_PGN
    }));

    const archive = await AppController.fetchChesscomMonthPgn('hikaru', 2025, '02');

    expect(archive).toBe(SAMPLE_PGN);
  });

  it('treats Chess.com\'s empty 200 PGN response as "no games" instead of an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => ''
    }));

    const archive = await AppController.fetchChesscomMonthPgn('nogames_user', 2010, '01');
    const games = AppController.parseChesscomArchiveGames(archive);

    expect(games).toEqual([]);
  });
});

describe('AppController.formatChesscomOpeningLabel', () => {
  it('hides bare ECO codes and uses the Chess.com opening URL when available', () => {
    const games = AppController.parseChesscomArchiveGames(SAMPLE_PGN);

    expect(games[0].eco).toBe('C40');
    expect(games[0].opening).toBe('Kings Knight Opening');
    expect(AppController.formatChesscomOpeningLabel({ eco: 'C40' })).toBe('');
  });
});

describe('HomeController saved profiles', () => {
  it('renders fetch actions for linked accounts in saved profiles', () => {
    document.body.innerHTML = '<div id="savedProfilesList"></div>';

    HomeController.saveCurrentAsProfile({
      displayName: 'Study',
      chesscomUsername: 'ninja_vm',
      lichessUsername: 'ninja_lichess',
      prefDepth: '20'
    }, true);

    expect(document.querySelector('[data-profile-platform="chesscom"]')?.textContent).toBe('Fetch Games');
    expect(document.querySelector('[data-profile-platform="lichess"]')?.textContent).toBe('Fetch Lichess Games');
  });
});
