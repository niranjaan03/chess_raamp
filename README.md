# chess ramp

Chess analysis web app with engine analysis, game review, opening practice, puzzle training, and player statistics. React + Vite frontend; vanilla JS controllers for interactivity; Express server in production with four API bridges (Chess.com, Lichess, opening stats, puzzles).

## Requirements

- Node 18+ (developed against Node 25)
- Python 3.10+ with `pyarrow` — used by the puzzle bridge to query the parquet dataset
- ~600 MB free disk for engines + puzzle dataset (gitignored, see below)

## Local development

```bash
npm install

# Python deps for puzzle bridge
python3 -m venv .venv
.venv/bin/pip install pyarrow

# Copy the env template and fill in your Google client ID if using sign-in
cp .env.example .env

npm run dev          # http://localhost:5173
```

The dev server runs Vite with the four bridges as middleware, so `/api/puzzles/next`, `/api/chesscom/...`, `/api/lichess/...`, and `/api/openings/...` are all live during development.

## Production build & run

```bash
npm run build        # outputs to dist/
npm start            # serves dist/ + bridges on $PORT (default 3000)
```

`npm start` runs `server/index.js`, which mounts all four bridges, serves the built SPA, and sets the `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers required for multi-threaded Stockfish (WASM `SharedArrayBuffer`).

## Required runtime assets (gitignored)

These are not committed and must be present at the repo root for full functionality:

- `puzzles dataset/` — 16 ZSTD-compressed parquet files split by elo bucket (~232 MB total). Run `python3 scripts/bucket_puzzles.py` to regenerate from raw Lichess parquets.
- `public/engines/stockfish-*` — Stockfish WASM builds. Run `npm run sync:stockfish` to fetch.

## Environment variables

See `.env.example`. The most important are:

- `VITE_GOOGLE_CLIENT_ID` — Google OAuth client ID for sign-in (`AuthController.js`). The app boots without it, but the sign-in modal won't authenticate.
- `PORT` — server port (default `3000`).
- `HOST` — bind address (default `0.0.0.0`).
- `PYTHON_BIN` — override the Python interpreter for the puzzle bridge (default: `.venv/bin/python3` if present, else `python3`).

## Deploying

Recommended: a single Node web service that runs `npm start`. Render, Railway, Fly.io, and a plain VPS all work. Two operational notes:

1. **Python on the host.** The puzzle bridge spawns `python3` and imports `pyarrow`. Ensure both are installed during the build step.
2. **Asset offloading.** Stockfish engines (~400 MB across all 5 versions) and the puzzle parquets (~232 MB) bloat the deploy image. For tighter free-tier hosts, host them on object storage (Cloudflare R2 / Backblaze B2) and point the runtime there.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR + bridges |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the built SPA (Vite) |
| `npm start` | Production Express server |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run lint` | ESLint |
| `npm run sync:stockfish` | Pull the Stockfish WASM builds into `public/engines/` |

## Project layout

```
src/
  App.jsx                  React root + tab wiring
  controllers/             Vanilla JS controllers (DOM manipulation per tab)
  components/tabs/         JSX structure for each tab
  styles/                  CSS modules
  lib/                     chess.js fork, openings dataset, pgn parser, chesskit
server/
  index.js                 Production Express server
  *Bridge.js               Connect-style middleware for each API proxy
  puzzle_query.py          Long-running Python worker queried by puzzleBridge
public/
  engines/                 Stockfish WASM builds (gitignored)
  opening-images/          Opening illustrations
puzzles dataset/           Parquet puzzles, elo-bucketed (gitignored)
```
