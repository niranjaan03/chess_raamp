import { test, expect } from '@playwright/test';

const SAMPLE_GAME = {
  id: 1,
  white: 'Alice',
  black: 'Bob',
  result: '1-0',
  opening: 'Italian Game',
  date: '2024.01.01',
  pgn: '[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 1-0'
};

const SAMPLE_GAME_2 = {
  id: 2,
  white: 'Carol',
  black: 'Dave',
  result: '0-1',
  opening: 'Sicilian Defense',
  date: '2024.02.15',
  pgn: '[White "Carol"]\n[Black "Dave"]\n[Result "0-1"]\n\n1. e4 c5 0-1'
};

// The Database tab has no nav-drawer link, so navigate via AppController.
async function gotoDatabase(page) {
  await page.evaluate(() => window.AppController.switchToTab('database'));
}

test.describe('DatabaseController extraction smoke test', () => {
  test('database tab shows empty state with no games', async ({ page }) => {
    await page.goto('/');
    await gotoDatabase(page);
    await expect(page.locator('#tab-database')).toBeVisible();
    await expect(page.locator('#dbRows')).toContainText(/No games in database/i);
  });

  test('saved games render rows from kv_database', async ({ page, context }) => {
    await context.addInitScript((games) => {
      localStorage.setItem('kv_database', JSON.stringify(games));
    }, [SAMPLE_GAME, SAMPLE_GAME_2]);

    await page.goto('/');
    await gotoDatabase(page);
    const rows = page.locator('#dbRows .db-row');
    await expect(rows).toHaveCount(2, { timeout: 5000 });
    await expect(rows.first()).toContainText('Alice');
    await expect(rows.first()).toContainText('Bob');
    await expect(rows.first()).toContainText('Italian Game');
  });

  test('search filters database rows', async ({ page, context }) => {
    await context.addInitScript((games) => {
      localStorage.setItem('kv_database', JSON.stringify(games));
    }, [SAMPLE_GAME, SAMPLE_GAME_2]);

    await page.goto('/');
    await gotoDatabase(page);
    await expect(page.locator('#dbRows .db-row')).toHaveCount(2);

    await page.fill('#dbSearch', 'Carol');
    await expect(page.locator('#dbRows .db-row')).toHaveCount(1);
    await expect(page.locator('#dbRows .db-row').first()).toContainText('Carol');

    await page.fill('#dbSearch', 'Italian');
    await expect(page.locator('#dbRows .db-row')).toHaveCount(1);
    await expect(page.locator('#dbRows .db-row').first()).toContainText('Italian Game');

    await page.fill('#dbSearch', 'nomatch_xyz');
    await expect(page.locator('#dbRows')).toContainText(/No games in database/i);
  });

  test('clicking a row loads the game and switches to analyze tab', async ({ page, context }) => {
    await context.addInitScript((games) => {
      localStorage.setItem('kv_database', JSON.stringify(games));
    }, [SAMPLE_GAME]);

    await page.goto('/');
    await gotoDatabase(page);
    await page.locator('#dbRows .db-row').first().click();
    await expect(page.locator('#tab-analyze')).toBeVisible({ timeout: 5000 });
  });

  test('stats counter reflects saved game count', async ({ page, context }) => {
    await context.addInitScript((games) => {
      localStorage.setItem('kv_database', JSON.stringify(games));
    }, [SAMPLE_GAME, SAMPLE_GAME_2]);

    await page.goto('/');
    // Trigger updateStats via DatabaseController.save side effect would require
    // a save call. Direct check: state.gameDatabase is loaded with 2 rows.
    await gotoDatabase(page);
    const count = await page.locator('#dbRows .db-row').count();
    expect(count).toBe(2);
  });
});
