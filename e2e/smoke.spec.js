import { test, expect } from '@playwright/test';

// All `data-tab` nav-links live inside the off-canvas NavDrawer (hidden by
// default behind the #navMenuBtn hamburger). Tests must open the drawer
// before clicking a nav-link.
async function gotoTab(page, tab) {
  await page.click('#navMenuBtn');
  await page.click(`[data-tab="${tab}"]`);
}

test.describe('Home tab', () => {
  test('loads and shows home content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tab-home')).toBeVisible();
  });
});

test.describe('Games / Analyze tab', () => {
  test('clicking tab shows games panel', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'games');
    await expect(page.locator('#tab-games')).toBeVisible();
  });
});

test.describe('Openings tab', () => {
  test('shows opening gallery with cards', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'openings');
    await expect(page.locator('#tab-openings')).toBeVisible();
    await expect(page.locator('#openingGalleryView')).toBeVisible();
    await expect(page.locator('.openings-title')).toBeVisible();
  });

  test('gallery contains opening cards', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'openings');
    await page.waitForSelector('.opening-card', { timeout: 10_000 });
    const count = await page.locator('.opening-card').count();
    expect(count).toBeGreaterThan(10);
  });
});

test.describe('Puzzle tab', () => {
  // Puzzle has no top-level nav-link, only sublinks under a collapsed
  // accordion. Expand the Puzzles group, then click one of the modes.
  test('clicking tab shows puzzle panel', async ({ page }) => {
    await page.goto('/');
    await page.click('#navMenuBtn');
    await page.click('#puzzleMenuToggle');
    await page.click('.nav-sublink[data-tab="puzzle"][data-puzzle-mode="classic"]');
    await expect(page.locator('#tab-puzzle')).toBeVisible();
  });
});

test.describe('Player Analyze tab', () => {
  test('shows username input', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'player-analyze');
    await expect(page.locator('#tab-player-analyze')).toBeVisible();
    await expect(page.locator('#paUsernameInput')).toBeVisible();
  });
});
