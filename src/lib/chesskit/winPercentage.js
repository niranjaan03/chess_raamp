// Ported from chess kit/lib/engine/helpers/winPercentage.ts

import { ceilsNumber } from './math.js';

export const getPositionWinPercentage = (position) => {
  return getLineWinPercentage(position.lines[0]);
};

export const getLineWinPercentage = (line) => {
  if (line.cp !== undefined) {
    return getWinPercentageFromCp(line.cp);
  }

  if (line.mate !== undefined) {
    return getWinPercentageFromMate(line.mate);
  }

  throw new Error('No cp or mate in line');
};

const getWinPercentageFromMate = (mate) => {
  return mate > 0 ? 100 : 0;
};

// Source: https://github.com/lichess-org/lila/blob/.../WinPercent.scala
const getWinPercentageFromCp = (cp) => {
  const cpCeiled = ceilsNumber(cp, -1000, 1000);
  const MULTIPLIER = -0.00368208;
  const winChances = 2 / (1 + Math.exp(MULTIPLIER * cpCeiled)) - 1;
  return 50 + 50 * winChances;
};
