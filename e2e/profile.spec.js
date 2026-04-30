import { test, expect } from '@playwright/test';

// ProfileController is responsible for the local profile saved under the
// `kv_profile` key in localStorage. The edit form lives on the Home tab.

test.describe('ProfileController extraction smoke test', () => {
  test('saving display name updates navbar and persists across reload', async ({ page }) => {
    await page.goto('/');
    await page.click('#editProfileToggle');
    await expect(page.locator('#profileEditMode')).toBeVisible();

    const name = `Tester ${Date.now()}`;
    await page.fill('#profileDisplayName', name);
    await page.click('#saveProfile');

    // Save closes edit mode and updates the navbar profile name.
    await expect(page.locator('#profileEditMode')).toBeHidden();
    await expect(page.locator('#profileViewMode')).toBeVisible();
    await expect(page.locator('#profileName')).toHaveText(name, { timeout: 5000 });

    // Reload and verify it stuck.
    await page.reload();
    await expect(page.locator('#profileName')).toHaveText(name, { timeout: 5000 });
  });

  test('saving with empty display name falls back to "Guest" in navbar', async ({ page }) => {
    await page.goto('/');
    await page.click('#editProfileToggle');
    await page.fill('#profileDisplayName', '');
    await page.click('#saveProfile');
    await expect(page.locator('#profileName')).toHaveText('Guest', { timeout: 5000 });
  });

  test('depth preference round-trips through localStorage', async ({ page }) => {
    await page.goto('/');
    await page.click('#editProfileToggle');
    await page.fill('#profileDisplayName', 'Depth Tester');
    await page.fill('#prefDepth', '28');
    await page.click('#saveProfile');

    await page.reload();
    await page.click('#editProfileToggle');
    await expect(page.locator('#prefDepth')).toHaveValue('28');
  });

  test('chess.com username persists into kv_profile', async ({ page }) => {
    await page.goto('/');
    await page.click('#editProfileToggle');
    await page.fill('#profileDisplayName', 'Linked User');
    await page.fill('#chesscomUsername', 'magnuscarlsen');
    await page.click('#saveProfile');

    const stored = await page.evaluate(() => localStorage.getItem('kv_profile'));
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored);
    expect(parsed.displayName).toBe('Linked User');
    expect(parsed.chesscomUsername).toBe('magnuscarlsen');
  });

  test('migrate preserves displayName from existing localStorage on load', async ({ page, context }) => {
    await context.addInitScript(() => {
      localStorage.setItem('kv_profile', JSON.stringify({
        displayName: 'Legacy User',
        prefEngine: 'sf18',
        prefDepth: '22'
      }));
    });
    await page.goto('/');
    await expect(page.locator('#profileName')).toHaveText('Legacy User', { timeout: 5000 });
  });
});
