// Ported from chess kit/types/enums.ts
// MoveClassification labels used by the analysis pipeline.

export const MoveClassification = Object.freeze({
  Opening: 'opening',
  Forced: 'forced',
  Splendid: 'splendid',
  Perfect: 'perfect',
  Best: 'best',
  Excellent: 'excellent',
  Okay: 'okay',
  Inaccuracy: 'inaccuracy',
  Mistake: 'mistake',
  Blunder: 'blunder',
});

export const Color = Object.freeze({
  White: 'w',
  Black: 'b',
});

// Maps the chess kit MoveClassification to the existing UI quality buckets.
// UI quality keys: brilliant, great, book, best, excellent, good, inaccuracy, mistake, miss, blunder.
export const UI_QUALITY_BY_CLASSIFICATION = Object.freeze({
  [MoveClassification.Splendid]: 'brilliant',
  [MoveClassification.Perfect]: 'great',
  [MoveClassification.Opening]: 'book',
  [MoveClassification.Best]: 'best',
  [MoveClassification.Excellent]: 'excellent',
  [MoveClassification.Okay]: 'good',
  [MoveClassification.Forced]: 'good',
  [MoveClassification.Inaccuracy]: 'inaccuracy',
  [MoveClassification.Mistake]: 'mistake',
  [MoveClassification.Blunder]: 'blunder',
});
