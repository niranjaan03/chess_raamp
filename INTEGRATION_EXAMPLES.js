/**
 * 📋 EXAMPLE: How to Integrate API V2 into Existing Server
 * 
 * This file shows different ways to integrate the Chess Review API V2
 * into your existing Express server setup.
 */

// ============================================================
// OPTION 1: Add to Existing Express App
// ============================================================

import express from 'express';
import { createReviewRoutes } from './chessReviewApiV2.js';

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));

// Add Chess API V2 routes
createReviewRoutes(app);

// Your other routes
app.get('/api/puzzles', (req, res) => {
  // ... your puzzle code
});

app.listen(3000, () => {
  console.log('Server with Chess API V2 running on :3000');
});


// ============================================================
// OPTION 2: Modular with Route Mounting
// ============================================================

import express from 'express';
import { createReviewRoutes } from './chessReviewApiV2.js';

const app = express();
app.use(express.json());

// Create a router for chess endpoints
const chessRouter = express.Router();
createReviewRoutes(app); // This adds routes directly

// Alternatively, mount chess routes under /chess prefix
// chessRouter.post('/review', chessReviewHandler);
// chessRouter.post('/analyze', chessAnalyzeHandler);
// app.use('/chess', chessRouter);

app.listen(3000);


// ============================================================
// OPTION 3: With Middleware Chain
// ============================================================

import express from 'express';
import cors from 'cors';
import { createReviewRoutes } from './chessReviewApiV2.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Chess API routes
createReviewRoutes(app);

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: 'Server error' });
});

app.listen(3000);


// ============================================================
// OPTION 4: With Route Prefix
// ============================================================

import express from 'express';
import { createReviewRoutes } from './chessReviewApiV2.js';

const app = express();
app.use(express.json());

// Mount API v2 under /api/v2 prefix
const apiRouter = express.Router();
createReviewRoutes(apiRouter);
app.use('/api/v2', apiRouter);

// Results in:
// POST /api/v2/review
// POST /api/v2/analyze
// GET  /api/v2/status

app.listen(3000);


// ============================================================
// OPTION 5: Microservice Architecture
// ============================================================

import express from 'express';
import { createReviewRoutes } from './chessReviewApiV2.js';
import { createReviewRoutes as createV1Routes } from './existingApi.js';

const app = express();
app.use(express.json());

// API v1 (legacy)
const v1Router = express.Router();
createV1Routes(v1Router);
app.use('/api/v1', v1Router);

// API v2 (new)
const v2Router = express.Router();
createReviewRoutes(v2Router);
app.use('/api/v2', v2Router);

// Allows coexistence of both versions
app.listen(3000);


// ============================================================
// OPTION 6: With Custom Analysis Handler
// ============================================================

import express from 'express';
import { reviewGame, analyzePosition, createReviewRoutes } from './chessReviewApiV2.js';

const app = express();
app.use(express.json());

// Use built-in routes
createReviewRoutes(app);

// OR create your own custom routes
app.post('/custom/analyze-with-cache', async (req, res) => {
  try {
    const { pgn } = req.body;
    
    // Your custom logic (e.g., check cache first)
    const cacheKey = `game_${pgn.hashCode()}`;
    // ... check cache ...
    
    // Use the analysis function
    const result = await reviewGame(pgn);
    
    // ... cache result ...
    
    res.json({ ok: true, result, cached: false });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.listen(3000);


// ============================================================
// OPTION 7: With Streaming Response (Long Analysis)
// ============================================================

import express from 'express';
import { reviewGame } from './chessReviewApiV2.js';

const app = express();
app.use(express.json());

// Stream analysis progress
app.post('/api/v2/review-stream', async (req, res) => {
  try {
    const { pgn } = req.body;
    
    res.setHeader('Content-Type', 'application/x-ndjson');
    
    // Send updates as analysis progresses
    res.write(JSON.stringify({ status: 'starting' }) + '\n');
    
    const result = await reviewGame(pgn);
    
    res.write(JSON.stringify({ 
      status: 'complete', 
      result 
    }) + '\n');
    
    res.end();
  } catch (error) {
    res.write(JSON.stringify({ 
      status: 'error', 
      error: error.message 
    }) + '\n');
    res.end();
  }
});

app.listen(3000);


// ============================================================
// OPTION 8: With Authentication
// ============================================================

import express from 'express';
import { createReviewRoutes } from './chessReviewApiV2.js';

const app = express();
app.use(express.json());

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !validateToken(token)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}

// Protected routes
app.use('/api/v2', authMiddleware, express.Router());
createReviewRoutes(app);

app.listen(3000);


// ============================================================
// OPTION 9: Full Integration Example
// ============================================================

import express from 'express';
import cors from 'cors';
import { createReviewRoutes } from './chessReviewApiV2.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// ===== LOGGING =====
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${res.statusCode} ${req.method} ${req.path} ${duration}ms`);
  });
  next();
});

// ===== CHESS API V2 =====
createReviewRoutes(app);

// ===== YOUR EXISTING ROUTES =====
app.get('/api/puzzles', (req, res) => {
  res.json({ puzzles: [] });
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    ok: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Server error' 
      : err.message
  });
});

// ===== 404 =====
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// ===== START =====
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;


// ============================================================
// OPTION 10: Docker Configuration
// ============================================================

/*
// Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY server/ ./server/
COPY stockfish/ ./stockfish/

# Make binary executable
RUN chmod +x ./stockfish/stockfish-macos-m1-apple-silicon

EXPOSE 3000

CMD ["node", "server/apiV2Server.js"]


// docker-compose.yml
version: '3.9'

services:
  chess-analyzer:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      - ./logs:/app/logs
*/


// ============================================================
// CLIENT-SIDE USAGE EXAMPLES
// ============================================================

/*

// === Vue 3 Composition API ===
import { ref } from 'vue';

const pgn = ref('');
const loading = ref(false);
const result = ref(null);

async function analyzeGame() {
  loading.value = true;
  try {
    const response = await fetch('/api/v2/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pgn: pgn.value })
    });
    result.value = await response.json();
  } finally {
    loading.value = false;
  }
}


// === Angular Service ===
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ChessAnalysisService {
  constructor(private http: HttpClient) {}

  reviewGame(pgn: string) {
    return this.http.post<AnalysisResult>(
      '/api/v2/review',
      { pgn }
    );
  }

  analyzePosition(fen: string) {
    return this.http.post<PositionAnalysis>(
      '/api/v2/analyze',
      { fen }
    );
  }
}


// === Svelte ===
<script>
  let pgn = '';
  let loading = false;
  let result = null;

  async function analyze() {
    loading = true;
    const response = await fetch('/api/v2/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pgn })
    });
    result = await response.json();
    loading = false;
  }
</script>


// === Next.js API Route ===
// pages/api/analyze.js
import { reviewGame } from '@/server/chessReviewApiV2';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await reviewGame(req.body.pgn);
    res.status(200).json({ ok: true, result });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

*/

export const examples = {
  integration_guide: 'See examples above',
  documentation: 'Check API_V2_INTEGRATION.md',
  component: 'Check src/components/GameAnalyzer.jsx'
};
