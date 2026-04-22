// Ported from chess kit/lib/engine/helpers/estimateElo.ts

import { ceilsNumber } from './math.js';

export const computeEstimatedElo = (positions, whiteElo, blackElo) => {
  // Need at least one move from each side, otherwise one player's divisor
  // becomes zero and the estimate is not meaningful.
  if (positions.length < 3) {
    return undefined;
  }

  const { whiteCpl, blackCpl } = getPlayersAverageCpl(positions);

  const whiteEstimatedElo = getEloFromRatingAndCpl(
    whiteCpl,
    whiteElo ?? blackElo
  );
  const blackEstimatedElo = getEloFromRatingAndCpl(
    blackCpl,
    blackElo ?? whiteElo
  );

  if (!Number.isFinite(whiteEstimatedElo) || !Number.isFinite(blackEstimatedElo)) {
    return undefined;
  }

  return { white: whiteEstimatedElo, black: blackEstimatedElo };
};

const getPositionCp = (position) => {
  const line = position.lines[0];

  if (line.cp !== undefined) {
    return ceilsNumber(line.cp, -1000, 1000);
  }

  if (line.mate !== undefined) {
    return ceilsNumber(line.mate * Infinity, -1000, 1000);
  }

  throw new Error('No cp or mate in line');
};

const getPlayersAverageCpl = (positions) => {
  let previousCp = getPositionCp(positions[0]);

  const { whiteCpl, blackCpl } = positions.slice(1).reduce(
    (acc, position, index) => {
      const cp = getPositionCp(position);

      if (index % 2 === 0) {
        acc.whiteCpl += cp > previousCp ? 0 : Math.min(previousCp - cp, 1000);
      } else {
        acc.blackCpl += cp < previousCp ? 0 : Math.min(cp - previousCp, 1000);
      }

      previousCp = cp;
      return acc;
    },
    { whiteCpl: 0, blackCpl: 0 }
  );

  return {
    whiteCpl: whiteCpl / Math.ceil((positions.length - 1) / 2),
    blackCpl: blackCpl / Math.floor((positions.length - 1) / 2),
  };
};

const getEloFromAverageCpl = (averageCpl) =>
  3100 * Math.exp(-0.01 * averageCpl);

const getAverageCplFromElo = (elo) =>
  -100 * Math.log(Math.min(elo, 3100) / 3100);

const getEloFromRatingAndCpl = (gameCpl, rating) => {
  const eloFromCpl = getEloFromAverageCpl(gameCpl);
  if (!rating) return eloFromCpl;

  const expectedCpl = getAverageCplFromElo(rating);
  const cplDiff = gameCpl - expectedCpl;
  if (cplDiff === 0) return eloFromCpl;

  if (cplDiff > 0) {
    return rating * Math.exp(-0.005 * cplDiff);
  }
  return rating / Math.exp(-0.005 * -cplDiff);
};
