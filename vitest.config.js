import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/lib/pgn-parser.js',
        'src/lib/chesskit/enums.js',
        'src/lib/chesskit/moveClassification.js',
        'src/controllers/AppController.js',
        'src/controllers/DatabaseController.js',
        'src/controllers/EngineManager.js',
        'src/controllers/OpeningPracticeController.js',
        'src/controllers/PlayerAnalyzeController.js',
        'src/controllers/PuzzleController.js',
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'browser',
          environment: 'jsdom',
          globals: true,
          include: ['src/**/__tests__/**/*.test.{js,jsx}'],
        }
      },
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          globals: true,
          include: ['server/**/__tests__/**/*.test.{js,mjs}'],
        }
      }
    ]
  },
});
