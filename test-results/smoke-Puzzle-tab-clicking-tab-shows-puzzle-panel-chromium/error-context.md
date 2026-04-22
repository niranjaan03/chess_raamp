# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.js >> Puzzle tab >> clicking tab shows puzzle panel
- Location: e2e/smoke.spec.js:37:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('[data-tab="puzzle"]')
    - locator resolved to 4 elements. Proceeding with the first one: <button type="button" data-tab="puzzle" class="nav-sublink" data-puzzle-mode="classic">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    54 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - navigation [ref=e3]:
    - button "Open navigation menu" [ref=e4] [cursor=pointer]
    - generic [ref=e8]:
      - img [ref=e9]
      - generic [ref=e12]: chess ramp
      - generic [ref=e13]: Stockfish Review
    - generic [ref=e14]:
      - generic [ref=e17]: Stockfish 18 Ready
      - button "Guest" [ref=e18] [cursor=pointer]:
        - img [ref=e19]
        - generic [ref=e22]: Guest
  - generic [ref=e25]:
    - region "Welcome back, Guest" [ref=e26]:
      - generic [ref=e27]:
        - generic [ref=e28]: Stockfish review workspace
        - heading "Welcome back, Guest" [level=1] [ref=e29]
        - paragraph [ref=e30]: Analyze games, tighten openings, and keep daily tactics in one focused dashboard.
        - generic [ref=e31]:
          - button "Start review" [ref=e32] [cursor=pointer]:
            - img [ref=e33]
            - text: Start review
          - button "Import game" [ref=e35] [cursor=pointer]:
            - img [ref=e36]
            - text: Import game
        - generic "Home overview" [ref=e38]:
          - generic [ref=e39]:
            - generic [ref=e40]: "0"
            - generic [ref=e41]: Games saved
          - generic [ref=e42]:
            - generic [ref=e43]: "18"
            - generic [ref=e44]: Stockfish
          - generic [ref=e45]:
            - generic [ref=e46]: "3"
            - generic [ref=e47]: Rating pools
      - generic [ref=e49]:
        - generic [ref=e50]:
          - generic [ref=e51]: Live position
          - strong [ref=e52]: "+0.6"
        - generic [ref=e53]:
          - generic [ref=e55]: ♜
          - generic [ref=e57]: ♚
          - generic [ref=e58]: ♟
          - generic [ref=e60]: ♟
          - generic [ref=e63]: ♘
          - generic [ref=e65]: ♕
          - generic [ref=e66]: ♖
          - generic [ref=e68]: ♔
        - generic [ref=e70]:
          - generic [ref=e71]: Best move
          - strong [ref=e72]: Nf3
    - generic "Quick actions" [ref=e73]:
      - button "♟ Games Recent imports and fetched games" [ref=e74] [cursor=pointer]:
        - generic [ref=e75]: ♟
        - generic [ref=e76]:
          - strong [ref=e77]: Games
          - generic [ref=e78]: Recent imports and fetched games
      - button "♘ Practice Opening lines and repetition" [ref=e79] [cursor=pointer]:
        - generic [ref=e80]: ♘
        - generic [ref=e81]:
          - strong [ref=e82]: Practice
          - generic [ref=e83]: Opening lines and repetition
      - button "★ Daily puzzle Keep the tactics streak moving" [ref=e84] [cursor=pointer]:
        - generic [ref=e85]: ★
        - generic [ref=e86]:
          - strong [ref=e87]: Daily puzzle
          - generic [ref=e88]: Keep the tactics streak moving
      - button "↗ Player analyze Patterns across recent games" [ref=e89] [cursor=pointer]:
        - generic [ref=e90]: ↗
        - generic [ref=e91]:
          - strong [ref=e92]: Player analyze
          - generic [ref=e93]: Patterns across recent games
    - generic [ref=e94]:
      - generic [ref=e95]:
        - generic [ref=e96]:
          - generic [ref=e97]:
            - generic [ref=e98]:
              - generic [ref=e99]: My Profile
              - generic [ref=e100]: Engine preferences and linked handles
            - button "Edit" [ref=e101] [cursor=pointer]
          - generic [ref=e102]:
            - generic [ref=e103]:
              - generic [ref=e105]: GU
              - generic [ref=e106]:
                - generic [ref=e107]: Guest
                - generic [ref=e109]: No accounts linked
                - generic [ref=e110]: "Engine: Stockfish 18 · Depth: 20"
              - generic "Visit streak" [ref=e111]:
                - generic [ref=e112]: 🔥
                - generic [ref=e113]:
                  - generic [ref=e114]: "1"
                  - generic [ref=e115]: day streak
            - generic [ref=e116]:
              - generic [ref=e117]:
                - generic [ref=e118]: Chess.com Ratings
                - generic [ref=e119]: Not linked
              - generic [ref=e120]:
                - generic [ref=e121]:
                  - generic [ref=e122]: —
                  - generic [ref=e123]: Bullet
                - generic [ref=e124]:
                  - generic [ref=e125]: —
                  - generic [ref=e126]: Blitz
                - generic [ref=e127]:
                  - generic [ref=e128]: —
                  - generic [ref=e129]: Rapid
        - generic [ref=e130]:
          - generic [ref=e131]:
            - generic [ref=e132]:
              - generic [ref=e133]: Saved Profiles
              - generic [ref=e134]: Switch between study setups
            - button "Save Current" [ref=e135] [cursor=pointer]
          - generic [ref=e137]:
            - generic [ref=e138]: No saved profiles yet
            - generic [ref=e139]: Edit your profile, then save it here for quick switching.
      - generic [ref=e141]:
        - generic [ref=e142]:
          - generic [ref=e143]:
            - generic [ref=e144]: Linked Accounts
            - generic [ref=e145]: Fetch games from your platforms
          - generic [ref=e146]:
            - button "Chess.com" [pressed] [ref=e147] [cursor=pointer]
            - button "Lichess" [ref=e148] [cursor=pointer]
        - generic [ref=e149]:
          - generic [ref=e150]:
            - generic [ref=e151]: ♟
            - generic [ref=e152]:
              - generic [ref=e153]: Chess.com
              - text: Not linked
          - generic [ref=e154]:
            - textbox "Chess.com username..." [ref=e155]
            - button "Link" [ref=e156] [cursor=pointer]
          - generic [ref=e158]:
            - generic [ref=e159]: No account linked
            - generic [ref=e160]: Link your Chess.com username to fetch recent games.
      - generic [ref=e162]:
        - generic [ref=e163]:
          - generic [ref=e164]:
            - generic [ref=e165]: Daily Puzzle
            - generic [ref=e166]: One focused tactic per day
          - generic [ref=e167]:
            - generic [ref=e168]:
              - generic [ref=e169]: ★
              - generic [ref=e170]: "0"
              - generic [ref=e171]: streak
            - button "Apr 21, 2026" [ref=e172] [cursor=pointer]
        - generic [ref=e173]:
          - generic [ref=e174]:
            - generic [ref=e175]:
              - generic [ref=e179]: ♜
              - generic [ref=e182]: ♚
              - generic [ref=e183]: ♜
              - generic [ref=e184]: ♟
              - generic [ref=e185]: ♟
              - generic [ref=e186]: ♟
              - generic [ref=e190]: ♟
              - generic [ref=e191]: ♟
              - generic [ref=e202]: ♛
              - generic [ref=e210]: ♙
              - generic [ref=e211]: ♝
              - generic [ref=e213]: ♕
              - generic [ref=e217]: ♙
              - generic [ref=e219]: ♙
              - generic [ref=e222]: ♘
              - generic [ref=e223]: ♙
              - generic [ref=e224]: ♙
              - generic [ref=e229]: ♙
              - generic [ref=e230]: ♙
              - generic [ref=e234]: ♔
              - generic [ref=e235]: ♖
              - generic [ref=e236]: ♖
            - generic [ref=e240]: Puzzle Elo 1123
          - generic [ref=e241]:
            - generic [ref=e242]: Ready to solve. Today's puzzle is waiting.
            - generic [ref=e243]: "Puzzle Elo: 1123"
          - button "Open Daily Puzzle" [ref=e244] [cursor=pointer]
  - generic: Welcome to chess ramp!
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Home tab', () => {
  4  |   test('loads and shows home content', async ({ page }) => {
  5  |     await page.goto('/');
  6  |     await expect(page.locator('#tab-home')).toBeVisible();
  7  |   });
  8  | });
  9  | 
  10 | test.describe('Games / Analyze tab', () => {
  11 |   test('clicking tab shows games panel', async ({ page }) => {
  12 |     await page.goto('/');
  13 |     await page.click('[data-tab="games"]');
  14 |     await expect(page.locator('#tab-games')).toBeVisible();
  15 |   });
  16 | });
  17 | 
  18 | test.describe('Openings tab', () => {
  19 |   test('shows opening gallery with cards', async ({ page }) => {
  20 |     await page.goto('/');
  21 |     await page.click('[data-tab="openings"]');
  22 |     await expect(page.locator('#tab-openings')).toBeVisible();
  23 |     await expect(page.locator('#openingGalleryView')).toBeVisible();
  24 |     await expect(page.locator('.openings-title')).toBeVisible();
  25 |   });
  26 | 
  27 |   test('gallery contains opening cards', async ({ page }) => {
  28 |     await page.goto('/');
  29 |     await page.click('[data-tab="openings"]');
  30 |     await page.waitForSelector('.opening-card', { timeout: 10_000 });
  31 |     const count = await page.locator('.opening-card').count();
  32 |     expect(count).toBeGreaterThan(10);
  33 |   });
  34 | });
  35 | 
  36 | test.describe('Puzzle tab', () => {
  37 |   test('clicking tab shows puzzle panel', async ({ page }) => {
  38 |     await page.goto('/');
> 39 |     await page.click('[data-tab="puzzle"]');
     |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  40 |     await expect(page.locator('#tab-puzzle')).toBeVisible();
  41 |   });
  42 | });
  43 | 
  44 | test.describe('Player Analyze tab', () => {
  45 |   test('shows username input', async ({ page }) => {
  46 |     await page.goto('/');
  47 |     await page.click('[data-tab="player-analyze"]');
  48 |     await expect(page.locator('#tab-player-analyze')).toBeVisible();
  49 |     await expect(page.locator('#paUsernameInput')).toBeVisible();
  50 |   });
  51 | });
  52 | 
```