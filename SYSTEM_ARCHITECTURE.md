# 📊 CHESS API V2 SYSTEM ARCHITECTURE

## 🏗️ System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR WEBSITE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          React Application (src/)                        │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  GameAnalyzer Component                           │  │   │
│  │  │  - PGN Input                                      │  │   │
│  │  │  - Real-time Analysis                            │  │   │
│  │  │  - Statistics Dashboard                          │  │   │
│  │  │  - Interactive Move Selection                    │  │   │
│  │  └──────────────────┬─────────────────────────────────┘  │   │
│  └─────────────────────┼──────────────────────────────────────┘   │
│                        │                                          │
│                 HTTP/REST (JSON)                                 │
│                        │                                          │
├─────────────────────────┼──────────────────────────────────────────┤
│                        ▼                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │        Express.js Server (server/)                       │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  API Routes                                       │  │   │
│  │  │  POST /api/v2/review    - Game Analysis          │  │   │
│  │  │  POST /api/v2/analyze   - Position Analysis      │  │   │
│  │  │  GET /api/v2/status     - Engine Status          │  │   │
│  │  │  GET /health             - Health Check          │  │   │
│  │  └──────────────────┬─────────────────────────────────┘  │   │
│  └─────────────────────┼──────────────────────────────────────┘   │
│                        │                                          │
│                   UCI Protocol                                    │
│                        │                                          │
│  ┌─────────────────────▼──────────────────────────────────┐      │
│  │     chessReviewApiV2.js (Core Analysis Engine)        │      │
│  │                                                        │      │
│  │  ┌────────────────────────────────────────────────┐   │      │
│  │  │  Stockfish Engine Management                  │   │      │
│  │  │  - Single persistent instance                │   │      │
│  │  │  - Queue-based processing                    │   │      │
│  │  │  - Multi-PV (top 3 moves)                    │   │      │
│  │  │  - Depth 16 analysis                         │   │      │
│  │  └────────────────┬─────────────────────────────┘   │      │
│  │                   │                                   │      │
│  │  ┌────────────────▼─────────────────────────────┐   │      │
│  │  │  Analysis Functions                         │   │      │
│  │  │  - reviewGame(pgn)         → Full analysis  │   │      │
│  │  │  - analyzePosition(fen)    → Position eval  │   │      │
│  │  │  - computeCPL()            → Move quality  │   │      │
│  │  │  - classifyMove()          → Type (best/...) │   │      │
│  │  │  - generateExplanation()   → Human feedback │   │      │
│  │  │  - computeAccuracy()       → % score       │   │      │
│  │  └────────────────┬─────────────────────────────┘   │      │
│  │                   │                                   │      │
│  │  ┌────────────────▼─────────────────────────────┐   │      │
│  │  │  Queue Management                           │   │      │
│  │  │  - Request queue[]                          │   │      │
│  │  │  - Current analysis                         │   │      │
│  │  │  - Sequential processing                    │   │      │
│  │  │  - Error recovery                           │   │      │
│  │  └────────────────────────────────────────────┘   │      │
│  └─────────────────────┬──────────────────────────────┘      │
│                        │                                      │
│                    UCI Commands                              │
│                        │                                      │
│  ┌─────────────────────▼──────────────────────────────┐      │
│  │  Stockfish Executable                             │      │
│  │  stockfish-macos-m1-apple-silicon                 │      │
│  │                                                   │      │
│  │  - Chess analysis engine                         │      │
│  │  - Hardware accelerated (M1)                     │      │
│  │  - Multi-threaded (auto-detected)                │      │
│  │  - Configurable depth & threads                 │      │
│  └───────────────────────────────────────────────────┘      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 📡 Data Flow - Game Analysis

```
User Input (PGN)
    ↓
React Component (GameAnalyzer.jsx)
    ↓ HTTP POST
Express Server (/api/v2/review)
    ↓
reviewGame() function
    ├─ Load PGN with chess.js
    ├─ Parse all moves
    └─ Reset board
        ↓
    For each move:
    ├─ Get FEN before move
    ├─→ analyzePosition(fenBefore)
    │   ├─ Add to queue
    │   └─ Wait for Stockfish
    │       ├─ Run: position fen <fen>
    │       ├─ Run: go depth 16
    │       └─ Get: bestmove, eval, lines[]
    │   ├─ Return: beforeAnalysis
    │
    ├─ Make the move
    ├─ Get FEN after move
    ├─→ analyzePosition(fenAfter)
    │   └─ Similar process
    │   └─ Return: afterAnalysis
    │
    ├─ Analyze best move continuation
    ├─→ analyzePosition(bestMoveFen)
    │   └─ Return: bestEval
    │
    ├─ Compute CPL = bestEval - actualEval
    ├─ Classify move type (6 categories)
    ├─ Generate explanation
    └─ Store: moveNumber, move, cpl, type, explanation
        ↓
    Aggregate Results:
    ├─ Compute avgCPL = sum(CPL) / moveCount
    ├─ Compute accuracy = 100 × e^(-avgCPL/100)
    ├─ Count: blunders, mistakes, inaccuracies
    └─ Create summary
        ↓
HTTP Response (JSON)
    ↓
React Component updates state
    ↓
UI renders results
    ├─ Accuracy percentage
    ├─ Move-by-move breakdown
    ├─ Color-coded quality
    ├─ Alternative moves
    └─ Human explanations
```

---

## 🎮 Data Flow - Position Analysis

```
User Input (FEN)
    ↓
HTTP POST /api/v2/analyze
    ↓
Express Server
    ↓
analyzePosition(fen)
    ↓
Add to queue
    ↓
Process Queue:
├─ engine.stdin.write('position fen <fen>')
├─ engine.stdin.write('go depth 16')
├─ engine.stdout.on('data') listener
│
├─ Parse score cp/mate
├─ Collect multi-pv lines
│
└─ engine.stdout: 'bestmove <move>'
    ↓
Return: {
  eval: <evaluation>,
  bestmove: <move>,
  lines: [{rank, move, eval, depth}, ...]
}
    ↓
HTTP Response (JSON)
```

---

## 📊 Move Classification

```
┌─────────────────────────────────────────────────────────┐
│           MOVE QUALITY CLASSIFICATION                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  CPL Range    Classification   Quality   Handling      │
│  ──────────────────────────────────────────────────    │
│                                                         │
│  0-10         ⭐ Best           Perfect   No feedback  │
│               ───────────                              │
│                                                         │
│  10-30        ⭐⭐ Excellent     Very good No feedback  │
│               ──────────────                           │
│                                                         │
│  30-80        ⭐ Good           Solid    No feedback  │
│               ──────                                   │
│                                                         │
│  80-150       ⚠️  Inaccuracy    Subopt.  Light warning │
│               ────────────                             │
│                                                         │
│  150-300      ❌ Mistake        Bad      Show feedback  │
│               ────────                                 │
│                                                         │
│  300+         💥 Blunder       Terrible Show critical │
│               ──────────                               │
│                                                         │
└─────────────────────────────────────────────────────────┘

CPL = Centipawn Loss (how much worse than best)
```

---

## 🔄 Component Interaction

```
┌─────────────────────────────────────────────────────┐
│  GameAnalyzer Component (React)                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  State:                                            │
│  ├─ pgn: string                                   │
│  ├─ loading: boolean                              │
│  ├─ error: string | null                          │
│  ├─ result: AnalysisResult | null                 │
│  └─ selectedMove: number | null                   │
│                                                     │
│  UI Sections:                                      │
│  ├─ Input Textarea                                │
│  │  └─ [Analyze] Button                           │
│  │                                                 │
│  ├─ Statistics Dashboard                          │
│  │  ├─ Total Moves                                │
│  │  ├─ Accuracy %                                 │
│  │  ├─ Avg CPL                                    │
│  │  └─ Blunders                                   │
│  │                                                 │
│  ├─ Move List (Scrollable)                        │
│  │  ├─ Move #1: e5 [best]                        │
│  │  ├─ Move #2: Nf3 [excellent]                  │
│  │  ├─ Move #3: Nc6 [mistake]                    │
│  │  └─ ...                                        │
│  │                                                 │
│  └─ Selected Move Details                         │
│     ├─ Basic Info                                 │
│     ├─ Top Alternatives                           │
│     ├─ Explanation (if exists)                    │
│     └─ FEN String                                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🌐 API Endpoint Flow

```
POST /api/v2/review
├─ Receive: { pgn: string }
├─ Validate: PGN format
├─ Call: reviewGame(pgn)
│  └─ Complex analysis (30-120 seconds)
├─ Return: 200 OK
└─ Response: {
    ok: true,
    result: {
      metadata: {...},
      summary: {...},
      review: [{...}, ...]
    }
  }

POST /api/v2/analyze
├─ Receive: { fen: string }
├─ Validate: FEN format
├─ Call: analyzePosition(fen)
│  └─ Queue + analysis (5-10 seconds)
├─ Return: 200 OK
└─ Response: {
    ok: true,
    analysis: {
      eval: number,
      bestmove: string,
      lines: [{...}, ...]
    }
  }

GET /api/v2/status
├─ No input
├─ Check: engine state
├─ Return: 200 OK
└─ Response: {
    ok: true,
    engine: {
      ready: boolean,
      queueLength: number,
      analyzing: boolean,
      threads: number
    }
  }

GET /health
├─ No input
├─ Check: server alive
├─ Return: 200 OK
└─ Response: {
    ok: true,
    message: string
  }
```

---

## 📈 Performance Timeline

```
Game Request (40 moves)
│
├─ 0-2 sec: Server receives & parses PGN
├─ 2-5 sec: Initialize analysis
│
├─ 5-60 sec: Main loop (for each move)
│  ├─ Analyze position before
│  ├─ Make move
│  ├─ Analyze position after
│  ├─ Analyze best move
│  └─ Compute metrics
│
├─ 60-65 sec: Aggregate results
├─ 65-67 sec: Send response
│
└─ Total: ~60-70 seconds

(Times vary based on:
 - Game length (moves)
 - Analysis depth (16 = standard)
 - CPU performance
 - Thread count)
```

---

## 🔐 Error Handling Flow

```
Request
  ↓
Validate Input
  ├─ No PGN/FEN? → 400 Bad Request
  ├─ Invalid format? → 400 Bad Request
  └─ OK
      ↓
Try Analysis
  ├─ Engine error? → Error recovery
  │  └─ Restart engine
  │  └─ Retry analysis
  ├─ Invalid move? → Skip & log
  └─ Success
      ↓
Return Results
  ├─ Error? → 500 Server Error
  └─ Success → 200 OK
```

---

## 🎯 Queue Management

```
Queue State Machine

IDLE (ready=true, current=null, queue=[])
  │
  ├─ Request arrives
  │  └─ Add to queue
  │     → QUEUED
  │
QUEUED (ready=true, current=null, queue=[...])
  │
  ├─ processQueue() called
  │  ├─ Dequeue first item
  │  └─ Set as current
  │     → ANALYZING
  │
ANALYZING (ready=true, current={...}, queue=[...])
  │
  ├─ More requests?
  │  └─ Add to queue
  │     → ANALYZING (queue grows)
  │
  ├─ Analysis complete
  │  ├─ Resolve promise
  │  ├─ Clear current
  │  └─ processQueue()
  │     → IDLE or QUEUED
  │
IDLE (ready=true, current=null, queue=[])
```

---

## 📊 Database Schema (Optional)

```javascript
// If adding database storage:

GameAnalysis {
  id: UUID
  gameId: String
  pgn: String (full PGN)
  createdAt: Timestamp
  
  metadata: {
    totalMoves: Number
    totalPlies: Number
  }
  
  summary: {
    avgCPL: Number
    accuracy: Number
    blunders: Number
    mistakes: Number
    inaccuracies: Number
  }
  
  moves: [{
    moveNumber: Number
    move: String
    type: String (enum)
    cpl: Number
    evaluation: Number
    explanation: String (optional)
  }]
}
```

---

## 🔗 Integration Points

```
Frontend
  ├─ React Component
  ├─ Vue/Angular Service
  └─ Plain JavaScript

    ↓ HTTP/JSON

Express Server
  ├─ REST API
  ├─ Route Handlers
  └─ Middleware

    ↓ Function Calls

Analysis Engine
  ├─ reviewGame()
  ├─ analyzePosition()
  └─ Helper Functions

    ↓ UCI Commands

Stockfish
  ├─ Engine Process
  ├─ Stdin/Stdout
  └─ Child Process
```

---

## 🚀 Deployment Architecture

```
Development:
  Laptop → localhost:3000 → Stockfish

Staging:
  Server → Internal:3000 → Stockfish

Production:
  Load Balancer
    ├─ Server 1 → Stockfish
    ├─ Server 2 → Stockfish
    └─ Server N → Stockfish

Cache Layer:
  Redis/Memcached
    ├─ PGN → Results
    └─ FEN → Evaluation
```

---

## 📊 System Requirements

```
Minimum:
├─ Node.js 14+
├─ 2GB RAM
├─ 4-core CPU
└─ macOS (M1 or Intel)

Recommended:
├─ Node.js 18+
├─ 4GB RAM
├─ 8-core CPU
└─ macOS M1 (optimized binary)

For Production:
├─ Node.js 18+ LTS
├─ 8GB+ RAM
├─ 16+ core CPU
└─ Linux Server with Stockfish
```

---

**Architecture Complete! 🎉**

This diagram shows:
- System components and interaction
- Data flows for all operations
- Move classification system
- Error handling
- Queue management
- Integration points
- Performance timeline
- Optional database schema

For implementation details, see the code files!
