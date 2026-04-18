const { test } = require('@playwright/test');

test('repro home chesscom fetch', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.stack || err.message));
  await page.addInitScript(() => {
    localStorage.setItem('kv_profile', JSON.stringify({ displayName:'', chesscomUsername:'hikaru', lichessUsername:'', prefDepth:'20', prefEngine:'sf16' }));
  });
  await page.goto('http://127.0.0.1:5173/home');
  await page.waitForTimeout(1000);
  console.log('initial url', page.url());
  console.log('linked', await page.locator('#chesscomLinkedName').textContent());
  await page.click('#fetchChesscomGames');
  await page.waitForTimeout(4000);
  console.log('after url', page.url());
  console.log('sub', await page.locator('#gamesTabSub').textContent());
  console.log('controls display', await page.locator('#gamesTabControls').evaluate(el => getComputedStyle(el).display));
  console.log('user', await page.locator('#gamesTabUser').textContent());
  console.log('list', (await page.locator('#gamesTabList').textContent()).slice(0, 1000));
});
