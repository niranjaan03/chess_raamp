import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { puzzleBridgePlugin } from './server/puzzleBridge.js';
import { chesscomBridgePlugin } from './server/chesscomBridge.js';
import { lichessBridgePlugin } from './server/lichessBridge.js';
import { openingStatsBridgePlugin } from './server/openingStatsBridge.js';
import { createOriginGuard } from './server/originGuard.js';

function originGuardPlugin() {
  return {
    name: 'origin-guard',
    configureServer(server) {
      server.middlewares.use(createOriginGuard({ pathPrefix: '/api/' }));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createOriginGuard({ pathPrefix: '/api/' }));
    }
  };
}

export default defineConfig({
  plugins: [react(), originGuardPlugin(), puzzleBridgePlugin(), chesscomBridgePlugin(), lichessBridgePlugin(), openingStatsBridgePlugin()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/')) {
              return 'react-vendor';
            }
            if (id.includes('/chess.js/')) {
              return 'chess-engine';
            }
            return 'vendor';
          }
          // Big lazy data files get their own chunks so they don't
          // bloat the eager chess-engine bundle. Both are loaded via
          // dynamic import() and only when the user opens openings/practice.
          if (id.includes('/src/lib/openingData')) {
            return 'opening-data';
          }
          if (id.includes('/src/lib/chesskit/data/openings')) {
            return 'chesskit-openings';
          }
          if (id.includes('/src/lib/chesskit/') || id.includes('/src/lib/openings') || id.includes('/src/lib/chess.js') || id.includes('/src/lib/pgn-parser')) {
            return 'chess-engine';
          }
        }
      }
    }
  }
});
