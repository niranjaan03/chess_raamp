import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/__tests__/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/lib/pgn-parser.js',
        'src/lib/chesskit/enums.js',
        'src/lib/chesskit/moveClassification.js',
        'src/controllers/PlayerAnalyzeController.js',
      ],
    },
  },
});
