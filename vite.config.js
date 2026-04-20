import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { stockfishBridgePlugin } from './server/stockfishBridge.js';
import { puzzleBridgePlugin } from './server/puzzleBridge.js';
import { chesscomBridgePlugin } from './server/chesscomBridge.js';
import { lichessBridgePlugin } from './server/lichessBridge.js';
import { openingStatsBridgePlugin } from './server/openingStatsBridge.js';

export default defineConfig({
  plugins: [react(), stockfishBridgePlugin(), puzzleBridgePlugin(), chesscomBridgePlugin(), lichessBridgePlugin(), openingStatsBridgePlugin()],
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/')) {
              return 'react-vendor';
            }
            return 'vendor';
          }
        }
      }
    }
  }
});
