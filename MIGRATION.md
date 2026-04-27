# chess_raamp-main → chess-raamp-frontend + chess-raamp-backend

Split of the monorepo at `/Users/niranjaan/Downloads/chess_raamp-main/` into two sibling repos:

- **Frontend**: `/Users/niranjaan/Downloads/chess-raamp-frontend/`
- **Backend**:  `/Users/niranjaan/Downloads/chess-raamp-backend/`

Git history is **not preserved** across the split — both new repos are fresh commits. (`git mv` only preserves history within a single repo; there is no clean way to carry it across two new repos without `git filter-repo` surgery.)

The original monorepo is left untouched so you can diff against it or fall back.

## Moves

| From (monorepo) | To | Notes |
|---|---|---|
| `src/**` | `chess-raamp-frontend/src/**` | Unchanged; API call sites wrapped with `apiUrl(...)` from new `src/lib/apiClient.js` |
| `public/**` | `chess-raamp-frontend/public/**` | Unchanged |
| `index.html` | `chess-raamp-frontend/index.html` | Unchanged |
| `vite.config.js` | `chess-raamp-frontend/vite.config.js` | Rewritten: bridge plugin imports removed; dev proxy added |
| `vitest.config.js` | `chess-raamp-frontend/vitest.config.js` | Unchanged |
| `playwright.config.js` | `chess-raamp-frontend/playwright.config.js` | Unchanged |
| `tailwind.config.js` | `chess-raamp-frontend/tailwind.config.js` | Unchanged |
| `postcss.config.js` | `chess-raamp-frontend/postcss.config.js` | Unchanged |
| `eslint.config.js` | `chess-raamp-frontend/eslint.config.js` | Trimmed: server/** block dropped; now covers scripts/** |
| `e2e/smoke.spec.js` | `chess-raamp-frontend/e2e/smoke.spec.js` | Unchanged |
| `generate-sounds.js` | `chess-raamp-frontend/scripts/generate-sounds.js` | Unchanged |
| `server/stockfishBridge.js` | `chess-raamp-backend/src/services/stockfish.js` | `stockfishBridgePlugin` → `createStockfishMiddleware`; engine path now prefers `STOCKFISH_PATH` env |
| `server/chesscomBridge.js` | `chess-raamp-backend/src/services/chesscom.js` | Plugin export removed; middleware export renamed |
| `server/lichessBridge.js` | `chess-raamp-backend/src/services/lichess.js` | Plugin export removed; middleware export renamed |
| `server/openingStatsBridge.js` | `chess-raamp-backend/src/services/openingStats.js` | Plugin export removed; middleware export renamed |
| `server/puzzleBridge.js` | `chess-raamp-backend/src/services/puzzles.js` | Plugin export removed; script path now resolved relative to the module, python honours `PYTHON_BIN` |
| `server/puzzle_query.py` | `chess-raamp-backend/src/services/puzzle_query.py` | `PUZZLE_DIR` now env-configurable; defaults to `./puzzles` at cwd |
| `test-brilliant-logic.js` | `chess-raamp-backend/tests/brilliant-move-classification.test.js` | Renamed only |
| `test-chesscom-brilliant.js` | `chess-raamp-backend/tests/chesscom-brilliant.test.js` | Renamed only |
| `test-fixes.js` | `chess-raamp-backend/tests/move-classification-fixes.test.js` | Renamed only |
| `test-move-classification.js` | `chess-raamp-backend/tests/move-classification.test.js` | Renamed; removed stale `import { EVALUATION_CONSTANTS } from './src/lib/fullChessIntegration.js'` (imported file does not exist anywhere; symbol was unused) |

## New files (not from the monorepo)

| Path | Purpose |
|---|---|
| `chess-raamp-frontend/src/lib/apiClient.js` | `apiUrl(path)` helper that prepends `VITE_API_BASE_URL` |
| `chess-raamp-frontend/.env.example` | Lists `VITE_API_BASE_URL` |
| `chess-raamp-frontend/.gitignore` | Per-repo ignores |
| `chess-raamp-frontend/README.md` | Setup, tech stack, folder layout |
| `chess-raamp-frontend/package.json` | Frontend-only deps |
| `chess-raamp-backend/src/index.js` | Express bootstrap |
| `chess-raamp-backend/src/config/env.js` | Env loader |
| `chess-raamp-backend/src/routes/index.js` | Mounts all service middlewares |
| `chess-raamp-backend/.env.example` | Lists `PORT`, `CORS_ORIGIN`, `STOCKFISH_PATH`, `PUZZLE_DIR`, `PYTHON_BIN` |
| `chess-raamp-backend/.gitignore` | Per-repo ignores |
| `chess-raamp-backend/README.md` | Setup, endpoints with request/response examples |
| `chess-raamp-backend/package.json` | Backend-only deps (express, cors, dotenv) |

## Modified (across the move)

| File | Change |
|---|---|
| `chess-raamp-frontend/src/controllers/EngineManager.js` | Added `apiClient` import; wrapped 3 `/api/...` literals with `apiUrl()` |
| `chess-raamp-frontend/src/controllers/AppController.js` | Wrapped 7 `/api/...` literals (2 `lichess.org` direct URLs left untouched) |
| `chess-raamp-frontend/src/controllers/PlayerAnalyzeController.js` | Wrapped 1 literal |
| `chess-raamp-frontend/src/controllers/PuzzleController.js` | Wrapped 1 literal |
| `chess-raamp-frontend/src/controllers/OpeningPracticeController.js` | Wrapped 2 literals |
| `chess-raamp-frontend/vite.config.js` | Dropped `server/*BridgePlugin` imports; added `server.proxy` for `/api` → `VITE_API_BASE_URL` |

## Deleted

| Path | Reason |
|---|---|
| `chess.py` | 157 KB PySide6 desktop app; imports missing modules (`reason_classifier`, `llmreviewer`, `explanation_engine`, `context_builder`, `positional_context`) — cannot run; unrelated to web app. User confirmed delete. |
| `chess-analyzer-main/` | Third-party Python chess.com analytics CLI (Fayed-Rsl/chess-analyzer). Never imported by `src/` or `server/`. User confirmed delete. |
| `chess kit/` | TypeScript reference copy of the upstream `GaspardLev/chess-kit` library. All needed pieces already ported to `src/lib/chesskit/` (see in-file `// Ported from chess kit/...` headers). User confirmed delete. |
| `INTEGRATION_EXAMPLES.js` | Speculative integration doc referencing files that don't exist in the repo (`chessReviewApiV2.js`, `existingApi.js`). Stale. |
| `_repro_full.mjs` | Debug reproduction script. |
| `_repro_pipeline.mjs` | Debug reproduction script. |
| `repro.spec.js` | Debug reproduction spec. |
| `css/style.css` | Empty file (0 bytes). Not imported anywhere. |
| `css/` | Empty after removing `style.css`. |

## Gitignored / kept out of the new repos

| Path | Handling |
|---|---|
| `node_modules/`, `dist/`, `coverage/`, `.DS_Store`, `*.log` | gitignored in both |
| `.env`, `.env.*` (except `.env.example`) | gitignored in both |
| `test-results/`, `playwright-report/` | gitignored in frontend |
| `.vscode/`, `.idea/` | gitignored in both; the monorepo's `.vscode/settings.json` is **not** carried over |
| `.venv/`, `__pycache__/`, `*.pyc` | gitignored in backend |
| `stockfish/` (binary + build artifacts) | gitignored in backend; operator sets `STOCKFISH_PATH` |
| `puzzles/*.parquet` | gitignored in backend; operator sets `PUZZLE_DIR` |
| `.claude/settings.json` | Left in the monorepo; not copied into either split repo |

## Known quirks carried over

- `src/lib/__tests__/chess-in-draw.test.js` was untracked/modified at split time (visible in `git status`). Copied as-is.
- `move-classification.test.js` (previously `test-move-classification.js`) was using `console.log` checks rather than `node:test` assertions. The broken `EVALUATION_CONSTANTS` import was removed; the body is unchanged.
- Two controllers (`AppController.js`) still fall back to direct `https://lichess.org/api/games/user/...` URLs when the proxy path fails. Those are intentional (client-side fallback) and not wrapped with `apiUrl()`.

## How to adopt

```bash
# From each new repo, init git fresh:
cd /Users/niranjaan/Downloads/chess-raamp-frontend
git init && git add . && git commit -m "initial split from chess_raamp-main"

cd /Users/niranjaan/Downloads/chess-raamp-backend
git init && git add . && git commit -m "initial split from chess_raamp-main"
```

The original `/Users/niranjaan/Downloads/chess_raamp-main/` is untouched — remove it only after verifying both new repos run cleanly.
