# Project Structure

## 📁 Directory Layout

```
chess-ramp/
├── src/
│   ├── components/          React components
│   ├── controllers/         Business logic & state
│   ├── lib/                 Utility functions
│   ├── data/
│   │   └── openings/        Chess opening data (PGN, FEN)
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
├── public/                  Static assets (served at root)
│   ├── chess-pieces/        Piece SVGs/images
│   ├── opening-images/      Opening diagram PNGs
│   └── sounds/              Audio files
│
├── server/                  Backend services
│   ├── chesscomBridge.js    Chess.com API wrapper
│   ├── puzzleBridge.js      Puzzle API wrapper
│   └── stockfishBridge.js   Engine communication
│
├── stockfish/               Chess engine (gitignored)
│   ├── scripts/
│   ├── src/
│   ├── wiki/
│   └── stockfish-macos-m1-apple-silicon (binary)
│
├── puzzles/                 Puzzle data (gitignored)
│
├── index.html               Vite entry point
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
├── README.md
└── .gitignore
```

## 🗑️ Deleted Clutter

- ✅ `/js` → Replaced by `/src` (React)
- ✅ `/css/style.css` → Using Tailwind CSS
- ✅ `practice.html` → Single app entry point
- ✅ `debug-bundle.js` → Build artifact
- ✅ `{css,js,assets}/` → Invalid folder name
- ✅ `/engine` → Consolidated with `/stockfish`
- ✅ `/opening-images` (root) → Moved to `/public`
- ✅ `.DS_Store` files → Cleaned up

## 📦 Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS + PostCSS
- **Build**: Vite
- **Engine**: Stockfish (M1 native binary)
- **APIs**: Chess.com, Lichess, Puzzles

