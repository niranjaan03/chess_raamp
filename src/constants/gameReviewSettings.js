export const GAME_REVIEW_SETTINGS_KEY = 'cr_game_review_settings';

export const GAME_REVIEW_SETTINGS_SCHEMA = {
  engine: {
    provider: ['browser', 'server', 'auto'],
    depth: ['8', '10', '12', '14', '16', '18'],
    multiPv: ['1', '2', '3'],
    showEngineLines: [true, false],
    useOpeningBook: [true, false],
  },
  interface: {
    analysis: {
      suggestionArrow: [true, false],
      showMoveClassificationOnBoard: [true, false],
      showThreats: [true, false],
      useHotkeys: [true, false],
      moveStrengthColoring: ['none', 'key', 'all'],
    },
    review: {
      showArrows: ['none', 'best', 'played', 'both'],
      highlightKeyMovesFor: ['white', 'black', 'both'],
      showMoveClassificationOnBoard: [true, false],
      autoplayShowMoves: [true, false],
      delayBetweenMoves: ['500', '1000', '1500', '2000', '3000'],
      showCoachAvatar: [true, false],
      showCourseRecommendations: [true, false],
    },
  },
  board: {
    pieces: ['classic', 'modern', 'gothic', 'neo'],
    board: ['green', 'blue', 'brown', 'purple', 'dark'],
    soundTheme: ['none', 'classic', 'modern'],
    coordinates: ['none', 'inside', 'outside'],
    pieceNotation: ['figurine', 'letters'],
    moveClassificationStyle: ['default', 'compact', 'badge'],
    pieceAnimations: ['none', 'fast', 'normal', 'slow'],
    highlightMoves: [true, false],
    playSounds: [true, false],
    showLegalMoves: [true, false],
  },
};

export const DEFAULT_GAME_REVIEW_SETTINGS = {
  engine: {
    provider: 'browser',
    depth: '14',
    multiPv: '2',
    showEngineLines: true,
    useOpeningBook: true,
  },
  interface: {
    analysis: {
      suggestionArrow: true,
      showMoveClassificationOnBoard: true,
      showThreats: false,
      useHotkeys: true,
      moveStrengthColoring: 'key',
    },
    review: {
      showArrows: 'best',
      highlightKeyMovesFor: 'both',
      showMoveClassificationOnBoard: true,
      autoplayShowMoves: true,
      delayBetweenMoves: '1000',
      showCoachAvatar: true,
      showCourseRecommendations: true,
    },
  },
  board: {
    pieces: 'classic',
    board: 'blue',
    soundTheme: 'classic',
    coordinates: 'outside',
    pieceNotation: 'figurine',
    moveClassificationStyle: 'default',
    pieceAnimations: 'normal',
    highlightMoves: true,
    playSounds: false,
    showLegalMoves: true,
  },
};

export const GAME_REVIEW_SETTING_LABELS = {
  provider: {
    browser: 'Browser Stockfish',
    server: 'Server Stockfish',
    auto: 'Auto',
  },
  depth: {
    8: '8',
    10: '10',
    12: '12',
    14: '14',
    16: '16',
    18: '18',
  },
  multiPv: {
    1: '1 line',
    2: '2 lines',
    3: '3 lines',
  },
  moveStrengthColoring: {
    none: 'None',
    key: 'Key Moves',
    all: 'All Moves',
  },
  showArrows: {
    none: 'None',
    best: 'Best Move',
    played: 'Played Move',
    both: 'Both',
  },
  highlightKeyMovesFor: {
    white: 'White',
    black: 'Black',
    both: 'Both',
  },
  delayBetweenMoves: {
    500: '0.5 second',
    1000: '1 second',
    1500: '1.5 seconds',
    2000: '2 seconds',
    3000: '3 seconds',
  },
  pieces: {
    classic: 'Classic',
    modern: 'Modern',
    gothic: 'Gothic',
    neo: 'Neo',
  },
  board: {
    green: 'Green',
    blue: 'Blue',
    brown: 'Brown',
    purple: 'Purple',
    dark: 'Dark',
  },
  soundTheme: {
    none: 'None',
    classic: 'Classic',
    modern: 'Modern',
  },
  coordinates: {
    none: 'None',
    inside: 'Inside',
    outside: 'Outside',
  },
  pieceNotation: {
    figurine: 'Figurine',
    letters: 'Letters',
  },
  moveClassificationStyle: {
    default: 'Default',
    compact: 'Compact',
    badge: 'Badge',
  },
  pieceAnimations: {
    none: 'None',
    fast: 'Fast',
    normal: 'Normal',
    slow: 'Slow',
  },
};
