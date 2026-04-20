import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules', 'dist', 'coverage', 'playwright-report', 'test-results'] },

  // Browser source files
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // Implicit globals set on window by the app's controller pattern
        ChessBoard: 'readonly',
        AppController: 'readonly',
        EngineController: 'readonly',
        OpeningPracticeController: 'readonly',
        PuzzleController: 'readonly',
        SoundController: 'readonly',
        HomeController: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'warn',
    },
  },

  // Node / config files
  {
    files: ['server/**/*.js', '*.config.js', 'e2e/**/*.spec.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
