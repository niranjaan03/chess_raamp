# CLAUDE.md — project context for AI assistants

## What this is

A chess analysis SPA. React + Vite frontend, vanilla JS controllers for tab interactivity (DOM manipulation, not React state), Express server in production with four API bridges (Chess.com, Lichess, opening stats, puzzles).

## Architecture rules

- **Tabs are static JSX.** All tab markup lives in `src/components/tabs/*.jsx` and is rendered eagerly into the DOM at boot. Tabs are toggled via the `active` class on `.tab-content` divs, not via React conditional rendering.
- **Controllers own behavior.** `src/controllers/*.js` (vanilla JS modules) drive interactivity by `getElementById` / `querySelector` against the static tab DOM. `AppController.init()` runs once from `App.jsx`'s `useEffect` and sets up the rest.
- **Per-tab controllers init lazily.** `PuzzleController.init()`, `OpeningPracticeController.init()`, and `PlayerAnalyzeController.init()` only run on first activation of their tab (`AppController.switchTab`).
- **Lazy tabs.** `OpeningsTab`, `PlayerAnalyzeTab`, `PricingTab` are `React.lazy()`-wrapped. Suspense fallbacks are placeholder `<div className="tab-content" id="tab-X" />` so `switchTab` can still find them while the chunk loads. Each lazy tab is also wrapped in an `ErrorBoundary` so a chunk failure shows a styled fallback instead of the raw browser overlay.
- **Don't lazy-load eager tabs.** `Home`, `Analyze`, `Database`, `Import`, `Games`, `Puzzle`, `Profile`, `Settings` — these are touched by `AppController.init()` at boot. Lazy-loading them will break startup.

## Bridges

Each bridge in `server/` exports two things:
- `*BridgePlugin()` — Vite plugin used by `vite.config.js` (dev + preview)
- `*BridgeMiddleware()` — Connect-style middleware mounted by `server/index.js` (production)

The puzzle bridge spawns a long-running Python worker (`server/puzzle_query.py`) over stdin/stdout. The worker reads from `puzzles dataset/` (16 ZSTD parquets, elo-bucketed). Paths are resolved via `import.meta.url` — never `process.cwd()`. The worker auto-restarts with exponential backoff on crashes; pending queries time out after 30s.

All bridges are wrapped by:
- `server/originGuard.js` — rejects cross-site browser fetches (Sec-Fetch-Site). Allowlist via `ORIGIN_ALLOWLIST` env.
- `server/rateLimit.js` — per-IP token bucket (60–120 req/min depending on bridge).

Server boot validates env vars via `server/config.js` (PORT/HOST/PYTHON_BIN). Logs go through `server/logging.js` as structured JSON. SIGTERM/SIGINT trigger graceful shutdown that kills the Python worker and drains in-flight HTTP requests.

## Storage conventions

- React/JSX state is the runtime UI state for things like the active tab.
- `localStorage` is the persistent state. Keys are namespaced: `cr_*` (puzzle), `kv_profile`, `streak.*`, etc.
- **Use `getJson` / `setJson` from `src/utils/storage.js`** for new localStorage reads. Many older controllers hand-roll `JSON.parse(localStorage.getItem(...) || '{}')` — those throw on corrupt data; the helpers don't.

## Common gotchas

- `window.AppController` and `window.HomeController` are exposed in `App.jsx` for **cross-controller lookups only** (avoids import cycles like AppController.switchTab → HomeController.refreshHomeData). They are NOT used by inline `onclick="..."` handlers — those have been replaced with the `data-action` delegator in `src/utils/actions.js`. Treat any new inline handler string as an XSS regression.
- `import.meta.env.BASE_URL` is read by `EngineManager`, `ChessBoard`, `OpeningPracticeController`, `SoundController`, `AppController` to resolve `/engines/*`, `/sounds/*`, etc. Respect the base URL when constructing asset paths.
- `switchTab('support')` opens the Feedback modal and returns; there is no SupportTab JSX (deleted). The route name is kept for backward compat with nav links.

## Testing

- Vitest unit tests in `src/**/__tests__/*.test.js` and `server/**/__tests__/*.test.js`
- Playwright E2E in `e2e/`
- The Vitest config splits browser (jsdom) and server (node) projects — don't move server tests into `src/`.

## When changing things

- **Adding a new tab:** add JSX to `src/components/tabs/`, register in `App.jsx`, add nav link, decide if eager or lazy. If the tab needs DOM at boot (chess board, etc.), keep it eager.
- **Adding a new API route:** create a bridge in `server/` exporting both `*Plugin()` and `*Middleware()`. Mount in both `vite.config.js` (plugins array) and `server/index.js`.
- **Touching CSS:** tab-specific CSS goes inside the tab JSX file (`import '../../styles/foo.css'`). Global CSS imports stay in `src/index.css`. Keeps the lazy-tab CSS chunked correctly. Currently only `OpeningsTab` follows this — `.pa-*` (PlayerAnalyze) and `.pricing-*` rules still live in the shared `sigma-refresh.css`/`themes.css`. Extracting them is open work; do it as you touch those rules.
- **Touching the puzzle dataset:** rerun `scripts/bucket_puzzles.py` after replacing the source parquets. The query path expects 200-pt elo buckets named `puzzles-LLLL-HHHH.parquet`.
