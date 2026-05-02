import { DEFAULT_ENGINE_ID } from './state.js';

export const ENGINE_LABELS = {
  auto: 'Auto Stockfish',
  sf18: 'Stockfish 18 Browser',
  'sf18-lite': 'Stockfish 18 Lite Browser',
  'sf18-full': 'Stockfish 18 Full Browser',
  'sf17-1-lite': 'Stockfish 17.1 Lite Browser',
  'sf17-1-full': 'Stockfish 17.1 Full Browser',
  'sf17-lite': 'Stockfish 17 Lite Browser',
  'sf17-full': 'Stockfish 17 Full Browser',
  'sf16-1-lite': 'Stockfish 16.1 Lite Browser',
  'sf16-1-full': 'Stockfish 16.1 Full Browser',
  'sf16-nnue': 'Stockfish 16 NNUE Browser'
};

export const REVIEW_STRENGTHS = ['fast', 'balanced', 'slow'];

export const DEFAULT_ENGINE_SETTINGS = {
  gameReview: {
    engine: DEFAULT_ENGINE_ID,
    strength: 'fast'
  },
  analysis: {
    engine: DEFAULT_ENGINE_ID,
    maxTimeMs: 1000,
    lines: 3,
    suggestionArrows: 'best-moves',
    depth: '25'
  }
};

export function normalizeEngineSettings(raw) {
  var source = raw || {};
  var reviewSource = source.gameReview || {
    engine: source.reviewEngine,
    strength: source.reviewStrength
  };
  var analysisSource = source.analysis || {
    engine: source.engine,
    maxTimeMs: source.maxTimeMs || (source.time ? parseInt(source.time, 10) * 1000 : undefined),
    lines: source.lines,
    suggestionArrows: source.suggestionArrows || source.arrows,
    depth: source.depth
  };
  var maxTimeMs = parseInt(analysisSource.maxTimeMs, 10);
  if ([1000, 3000, 5000, 10000].indexOf(maxTimeMs) === -1) maxTimeMs = DEFAULT_ENGINE_SETTINGS.analysis.maxTimeMs;

  return {
    gameReview: {
      engine: ENGINE_LABELS[reviewSource.engine] ? reviewSource.engine : DEFAULT_ENGINE_SETTINGS.gameReview.engine,
      strength: REVIEW_STRENGTHS.indexOf(reviewSource.strength) !== -1 ? reviewSource.strength : DEFAULT_ENGINE_SETTINGS.gameReview.strength
    },
    analysis: {
      engine: ENGINE_LABELS[analysisSource.engine] ? analysisSource.engine : DEFAULT_ENGINE_SETTINGS.analysis.engine,
      maxTimeMs: maxTimeMs,
      lines: Math.max(1, Math.min(5, parseInt(analysisSource.lines, 10) || DEFAULT_ENGINE_SETTINGS.analysis.lines)),
      suggestionArrows: ['off', 'best', 'best-moves', 'all'].indexOf(analysisSource.suggestionArrows) !== -1 ? analysisSource.suggestionArrows : DEFAULT_ENGINE_SETTINGS.analysis.suggestionArrows,
      depth: ['auto', '15', '20', '25'].indexOf(String(analysisSource.depth)) !== -1 ? String(analysisSource.depth) : DEFAULT_ENGINE_SETTINGS.analysis.depth
    }
  };
}
