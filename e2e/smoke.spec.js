import { test, expect } from '@playwright/test';

test.describe('Home tab', () => {
  test('loads and shows home content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tab-home')).toBeVisible();
  });
});

test.describe('Games / Analyze tab', () => {
  test('clicking tab shows games panel', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-tab="games"]');
    await expect(page.locator('#tab-games')).toBeVisible();
  });
});

test.describe('Openings tab', () => {
  test('shows opening gallery with cards', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-tab="openings"]');
    await expect(page.locator('#tab-openings')).toBeVisible();
    await expect(page.locator('#openingGalleryView')).toBeVisible();
    await expect(page.locator('.openings-title')).toBeVisible();
  });

  test('gallery contains opening cards', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-tab="openings"]');
    await page.waitForSelector('.opening-card', { timeout: 10_000 });
    const count = await page.locator('.opening-card').count();
    expect(count).toBeGreaterThan(10);
  });
});

test.describe('Puzzle tab', () => {
  test('clicking tab shows puzzle panel', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-tab="puzzle"]');
    await expect(page.locator('#tab-puzzle')).toBeVisible();
  });
});

test.describe('Player Analyze tab', () => {
  test('shows username input', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-tab="player-analyze"]');
    await expect(page.locator('#tab-player-analyze')).toBeVisible();
    await expect(page.locator('#paUsernameInput')).toBeVisible();
  });
});
