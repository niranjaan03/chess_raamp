import { test, expect } from '@playwright/test';

// Verifies the PlatformFetchController surface that's reachable through
// the AppController public API. Network behavior is exercised via mocked
// fetch() inside the page so we don't hit Chess.com or Lichess.

test.describe('PlatformFetchController extraction smoke test', () => {
  test('renderFetchSkeleton injects skeleton markup', async ({ page }) => {
    await page.goto('/');
    const html = await page.evaluate(() => {
      const div = document.createElement('div');
      window.AppController.renderFetchSkeleton(div, 'Loading test…');
      return div.innerHTML;
    });
    expect(html).toContain('skeleton-fetch-list');
    expect(html).toContain('Loading test');
    expect(html.match(/skeleton-card/g)?.length).toBe(3);
  });

  test('parseChesscomArchiveGames handles PGN string', async ({ page }) => {
    await page.goto('/');
    const games = await page.evaluate(() => {
      const pgn = [
        '[Event "Test"]',
        '[Site "?"]',
        '[White "Alice"]',
        '[Black "Bob"]',
        '[Result "1-0"]',
        '[ECO "C50"]',
        '',
        '1. e4 e5 1-0',
        '',
        '[Event "Test 2"]',
        '[White "Carol"]',
        '[Black "Dave"]',
        '[Result "0-1"]',
        '',
        '1. e4 c5 0-1'
      ].join('\n');
      return window.AppController.parseChesscomArchiveGames(pgn);
    });
    expect(games).toHaveLength(2);
    expect(games[0].white).toBe('Alice');
    expect(games[0].black).toBe('Bob');
    expect(games[0].result).toBe('1-0');
    expect(games[1].white).toBe('Carol');
    expect(games[1].result).toBe('0-1');
  });

  test('parseChesscomArchiveGames respects maxGames limit', async ({ page }) => {
    await page.goto('/');
    const count = await page.evaluate(() => {
      const pgn = '[Event "1"]\n[Result "*"]\n\n*\n\n[Event "2"]\n[Result "*"]\n\n*\n\n[Event "3"]\n[Result "*"]\n\n*';
      return window.AppController.parseChesscomArchiveGames(pgn, 2).length;
    });
    expect(count).toBe(2);
  });

  test('parseChesscomArchiveGames accepts JSON archive payload', async ({ page }) => {
    await page.goto('/');
    const games = await page.evaluate(() => {
      return window.AppController.parseChesscomArchiveGames({
        games: [
          { pgn: '[Event "JSON1"]\n*' },
          { url: 'https://chess.com/game/1' },
          { /* no pgn or url, filtered out */ }
        ]
      });
    });
    expect(games).toHaveLength(2);
  });

  test('formatChesscomOpeningLabel prefers explicit opening over ECO code', async ({ page }) => {
    await page.goto('/');
    const labels = await page.evaluate(() => {
      const a = window.AppController.formatChesscomOpeningLabel({
        opening: 'Sicilian Defense'
      });
      const b = window.AppController.formatChesscomOpeningLabel({
        ecoUrl: 'https://chess.com/openings/Italian-Game-Classical-Variation'
      });
      const c = window.AppController.formatChesscomOpeningLabel({ eco: 'C50' });
      return { a, b, c };
    });
    expect(labels.a).toBe('Sicilian Defense');
    expect(labels.b).toMatch(/Italian Game/);
    expect(labels.c).toBe('');
  });

  test('describeChesscomError customizes by error shape', async ({ page }) => {
    await page.goto('/');
    const messages = await page.evaluate(() => {
      const fourOhFour = window.AppController.describeChesscomError(
        Object.assign(new Error('not found'), { status: 404 }),
        'ghost', '2024-01'
      );
      const timeout = window.AppController.describeChesscomError(
        Object.assign(new Error('Request timed out'), { timeout: true }),
        'magnus', '2024-02'
      );
      const network = window.AppController.describeChesscomError(
        new Error('Failed to fetch'), 'magnus', '2024-03'
      );
      const fallback = window.AppController.describeChesscomError(null, 'x', '');
      return { fourOhFour, timeout, network, fallback };
    });
    expect(messages.fourOhFour).toMatch(/404/);
    expect(messages.fourOhFour).toMatch(/ghost/);
    expect(messages.timeout).toMatch(/timed out/i);
    expect(messages.network).toMatch(/blocked/i);
    expect(messages.fallback).toMatch(/Could not reach Chess\.com/);
  });

  test('describeLichessError customizes by error shape', async ({ page }) => {
    await page.goto('/');
    const messages = await page.evaluate(() => {
      const fourOhFour = window.AppController.describeLichessError(
        Object.assign(new Error('not found'), { status: 404 }),
        'ghost'
      );
      const network = window.AppController.describeLichessError(
        new Error('NetworkError'), 'magnus'
      );
      const fallback = window.AppController.describeLichessError(null, 'x');
      return { fourOhFour, network, fallback };
    });
    expect(messages.fourOhFour).toMatch(/No public games/i);
    expect(messages.network).toMatch(/blocked/i);
    expect(messages.fallback).toMatch(/Could not reach Lichess/);
  });

  test('fetchTextWithFallback uses proxy on success', async ({ page }) => {
    await page.goto('/');
    await page.route('**/api/test-proxy**', (route) =>
      route.fulfill({ status: 200, body: 'PROXY_OK' })
    );

    const text = await page.evaluate(async () => {
      return window.AppController.fetchTextWithFallback(
        '/api/test-proxy/foo', 'https://example.invalid/foo'
      );
    });
    expect(text).toBe('PROXY_OK');
  });

  test('fetchTextWithFallback falls back to direct URL when proxy fails', async ({ page }) => {
    await page.goto('/');
    await page.route('**/api/test-proxy-down**', (route) =>
      route.fulfill({ status: 503, body: 'unavailable' })
    );
    await page.route('**direct-fallback.example/**', (route) =>
      route.fulfill({ status: 200, body: 'DIRECT_OK' })
    );

    const text = await page.evaluate(async () => {
      return window.AppController.fetchTextWithFallback(
        '/api/test-proxy-down/foo', 'https://direct-fallback.example/foo'
      );
    });
    expect(text).toBe('DIRECT_OK');
  });

  test('fetchTextWithFallback rethrows 404 from proxy without retry', async ({ page }) => {
    await page.goto('/');
    let directHits = 0;
    await page.route('**/api/test-proxy-404**', (route) =>
      route.fulfill({ status: 404, body: 'nope' })
    );
    await page.route('**direct-after-404.example/**', (route) => {
      directHits++;
      route.fulfill({ status: 200, body: 'should-not-call' });
    });

    const result = await page.evaluate(async () => {
      try {
        await window.AppController.fetchTextWithFallback(
          '/api/test-proxy-404/foo', 'https://direct-after-404.example/foo'
        );
        return { ok: true };
      } catch (e) {
        return { ok: false, status: e.status, message: e.message };
      }
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(directHits).toBe(0);
  });
});
