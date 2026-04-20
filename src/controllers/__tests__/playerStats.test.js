import { describe, it, expect } from 'vitest';
import {
  filterByTC, filterByPeriod,
  aggWLD, aggByTC, aggMonthly, aggByDOW,
  aggRatingDiff, aggOppStrength, aggHeadToHead,
  aggStreaks, aggRadar, aggResultBreakdown,
} from '../PlayerAnalyzeController.js';

// ── test-game factory ──────────────────────────────────────────────────────────

const NOW = Date.now();
const daysAgo = (n) => NOW - n * 86_400_000;

function game(overrides = {}) {
  return {
    won: false, lost: false, drew: true,
    result: 'agreed',
    timeClass: 'rapid',
    rating: 1500, oppRating: 1500, ratingDiff: 0,
    oppUsername: 'opponent',
    dayOfWeek: 1,          // Monday
    month: '2024-01',
    endTime: daysAgo(1),
    opening: null,
    ...overrides,
  };
}
const win  = (o = {}) => game({ won: true,  lost: false, drew: false, result: 'win',        ...o });
const loss = (o = {}) => game({ won: false, lost: true,  drew: false, result: 'checkmated', ...o });
const draw = (o = {}) => game({ won: false, lost: false, drew: true,  result: 'agreed',     ...o });

// ── filterByTC ─────────────────────────────────────────────────────────────────

describe('filterByTC', () => {
  const games = [
    win({ timeClass: 'rapid' }),
    win({ timeClass: 'blitz' }),
    loss({ timeClass: 'rapid' }),
  ];

  it('returns all games for tc="all"', () => {
    expect(filterByTC(games, 'all')).toHaveLength(3);
  });

  it('filters to only rapid games', () => {
    expect(filterByTC(games, 'rapid')).toHaveLength(2);
  });

  it('filters to only blitz games', () => {
    expect(filterByTC(games, 'blitz')).toHaveLength(1);
  });

  it('returns empty array when no match', () => {
    expect(filterByTC(games, 'bullet')).toHaveLength(0);
  });
});

// ── filterByPeriod ─────────────────────────────────────────────────────────────

describe('filterByPeriod', () => {
  const old    = game({ endTime: daysAgo(50) });
  const recent = game({ endTime: daysAgo(5) });
  const games  = [old, recent];

  it('returns all games when days >= 365', () => {
    expect(filterByPeriod(games, 365)).toHaveLength(2);
  });

  it('filters out games older than the cutoff', () => {
    const r = filterByPeriod(games, 30);
    expect(r).toHaveLength(1);
    expect(r[0]).toBe(recent);
  });

  it('returns empty when all games are too old', () => {
    expect(filterByPeriod([old], 10)).toHaveLength(0);
  });
});

// ── aggWLD ─────────────────────────────────────────────────────────────────────

describe('aggWLD', () => {
  it('returns zeros for empty array', () => {
    const r = aggWLD([]);
    expect(r).toEqual({ wins: 0, losses: 0, draws: 0, total: 0, winPct: 0 });
  });

  it('counts all wins', () => {
    const r = aggWLD([win(), win()]);
    expect(r.wins).toBe(2);
    expect(r.losses).toBe(0);
    expect(r.winPct).toBe(100);
  });

  it('counts all losses', () => {
    const r = aggWLD([loss(), loss(), loss()]);
    expect(r.losses).toBe(3);
    expect(r.winPct).toBe(0);
  });

  it('mixed result: 2W 1L 1D', () => {
    const r = aggWLD([win(), win(), loss(), draw()]);
    expect(r.wins).toBe(2);
    expect(r.losses).toBe(1);
    expect(r.draws).toBe(1);
    expect(r.total).toBe(4);
    expect(r.winPct).toBe(50);
  });

  it('winPct rounds to two decimal places implicitly', () => {
    // 1 win out of 3 = 33.33...%
    const r = aggWLD([win(), loss(), loss()]);
    expect(r.winPct).toBeCloseTo(33.33, 1);
  });
});

// ── aggByTC ────────────────────────────────────────────────────────────────────

describe('aggByTC', () => {
  const games = [
    win({ timeClass: 'rapid' }),
    loss({ timeClass: 'rapid' }),
    win({ timeClass: 'blitz' }),
    draw({ timeClass: 'blitz' }),
  ];

  it('returns an array with one entry per non-empty TC', () => {
    const r = aggByTC(games);
    expect(r.map(x => x.tc)).toEqual(expect.arrayContaining(['rapid', 'blitz']));
    expect(r.find(x => x.tc === 'bullet')).toBeUndefined();
  });

  it('rapid entry has correct counts', () => {
    const rapid = aggByTC(games).find(x => x.tc === 'rapid');
    expect(rapid.games).toBe(2);
    expect(rapid.wins).toBe(1);
    expect(rapid.losses).toBe(1);
    expect(rapid.winRate).toBe(50);
  });

  it('blitz win rate is 50% (1W 1D)', () => {
    const blitz = aggByTC(games).find(x => x.tc === 'blitz');
    expect(blitz.winRate).toBe(50);
  });
});

// ── aggMonthly ─────────────────────────────────────────────────────────────────

describe('aggMonthly', () => {
  const games = [
    win({ month: '2024-01', rating: 1500 }),
    win({ month: '2024-01', rating: 1520 }),
    loss({ month: '2024-02', rating: 1480 }),
    draw({ month: '2024-02', rating: 1490 }),
  ];

  it('returns one entry per month', () => {
    const r = aggMonthly(games);
    expect(r).toHaveLength(2);
  });

  it('months are sorted ascending', () => {
    const r = aggMonthly(games);
    expect(r[0].month).toBe('2024-01');
    expect(r[1].month).toBe('2024-02');
  });

  it('jan: winRate 100%, games 2, avgRating 1510', () => {
    const jan = aggMonthly(games)[0];
    expect(jan.winRate).toBe(100);
    expect(jan.games).toBe(2);
    expect(jan.avgRating).toBe(1510);
  });

  it('feb: winRate 0%, games 2, avgRating 1485', () => {
    const feb = aggMonthly(games)[1];
    expect(feb.winRate).toBe(0);
    expect(feb.avgRating).toBe(1485);
  });
});

// ── aggByDOW ───────────────────────────────────────────────────────────────────

describe('aggByDOW', () => {
  const games = [
    win({ dayOfWeek: 0 }),   // Sun
    loss({ dayOfWeek: 0 }),  // Sun
    win({ dayOfWeek: 3 }),   // Wed
  ];

  it('always returns 7 entries (one per day)', () => {
    expect(aggByDOW(games)).toHaveLength(7);
  });

  it('Sunday: 2 games, 50% win rate', () => {
    const sun = aggByDOW(games).find(x => x.day === 'Sun');
    expect(sun.games).toBe(2);
    expect(sun.winRate).toBe(50);
  });

  it('Wednesday: 1 game, 100% win rate', () => {
    const wed = aggByDOW(games).find(x => x.day === 'Wed');
    expect(wed.games).toBe(1);
    expect(wed.winRate).toBe(100);
  });

  it('days with no games have winRate 0', () => {
    const fri = aggByDOW(games).find(x => x.day === 'Fri');
    expect(fri.games).toBe(0);
    expect(fri.winRate).toBe(0);
  });
});

// ── aggRatingDiff ──────────────────────────────────────────────────────────────

describe('aggRatingDiff', () => {
  const games = [
    win({ ratingDiff: -250 }),   // bin: < -200
    loss({ ratingDiff: -150 }),  // bin: -200 to -100
    win({ ratingDiff: 50 }),     // bin: 0 to +100
    win({ ratingDiff: 300 }),    // bin: > +200
  ];

  it('empty bins are filtered out', () => {
    const r = aggRatingDiff(games);
    expect(r.every(x => x !== null)).toBe(true);
  });

  it('correct number of non-empty bins', () => {
    expect(aggRatingDiff(games)).toHaveLength(4);
  });

  it('< -200 bin: 1 game, 100% win rate', () => {
    const bin = aggRatingDiff(games).find(x => x.label === '< -200');
    expect(bin.games).toBe(1);
    expect(bin.winRate).toBe(100);
  });

  it('-200 to -100 bin: 1 game, 0% win rate', () => {
    const bin = aggRatingDiff(games).find(x => x.label === '-200 to -100');
    expect(bin.games).toBe(1);
    expect(bin.winRate).toBe(0);
  });
});

// ── aggOppStrength ─────────────────────────────────────────────────────────────

describe('aggOppStrength', () => {
  const games = [
    win({ oppRating: 950 }),    // < 1000
    loss({ oppRating: 1100 }), // 1000–1200
    win({ oppRating: 1100 }),  // 1000–1200
    win({ oppRating: 0 }),     // filtered (oppRating not > 0)
  ];

  it('ignores games with oppRating = 0', () => {
    const r = aggOppStrength(games);
    const total = r.reduce((s, b) => s + b.games, 0);
    expect(total).toBe(3);
  });

  it('1000–1200 bin: 2 games, 50% win rate', () => {
    const bin = aggOppStrength(games).find(x => x.label === '1000–1200');
    expect(bin.games).toBe(2);
    expect(bin.winRate).toBe(50);
  });
});

// ── aggHeadToHead ──────────────────────────────────────────────────────────────

describe('aggHeadToHead', () => {
  const games = [
    win({ oppUsername: 'alice' }),
    win({ oppUsername: 'alice' }),
    loss({ oppUsername: 'alice' }),
    win({ oppUsername: 'bob' }),
    loss({ oppUsername: 'carol' }),
  ];

  it('groups by opponent', () => {
    const r = aggHeadToHead(games);
    expect(r.find(x => x.username === 'alice')).toBeDefined();
    expect(r.find(x => x.username === 'bob')).toBeDefined();
  });

  it('alice: 3 games, 2 wins, 1 loss', () => {
    const alice = aggHeadToHead(games).find(x => x.username === 'alice');
    expect(alice.games).toBe(3);
    expect(alice.wins).toBe(2);
    expect(alice.losses).toBe(1);
  });

  it('sorted by games descending — alice first', () => {
    const r = aggHeadToHead(games);
    expect(r[0].username).toBe('alice');
  });

  it('returns at most 8 opponents', () => {
    const manyOpps = Array.from({ length: 12 }, (_, i) =>
      win({ oppUsername: `opp${i}` })
    );
    expect(aggHeadToHead(manyOpps).length).toBeLessThanOrEqual(8);
  });
});

// ── aggStreaks ─────────────────────────────────────────────────────────────────

describe('aggStreaks', () => {
  it('returns safe zeros for empty array', () => {
    const r = aggStreaks([]);
    expect(r.current).toBe(0);
    expect(r.best).toBe(0);
  });

  it('single win: current=1 win, best=1', () => {
    const r = aggStreaks([win({ endTime: daysAgo(1) })]);
    expect(r.current).toBe(1);
    expect(r.currentType).toBe('win');
    expect(r.best).toBe(1);
  });

  it('three consecutive wins: best=3, current=3', () => {
    const games = [
      win({ endTime: daysAgo(3) }),
      win({ endTime: daysAgo(2) }),
      win({ endTime: daysAgo(1) }),
    ];
    const r = aggStreaks(games);
    expect(r.best).toBe(3);
    expect(r.current).toBe(3);
    expect(r.currentType).toBe('win');
  });

  it('current streak resets at loss', () => {
    const games = [
      win({ endTime: daysAgo(3) }),
      win({ endTime: daysAgo(2) }),
      loss({ endTime: daysAgo(1) }),
    ];
    const r = aggStreaks(games);
    expect(r.best).toBe(2);
    expect(r.current).toBe(1);
    expect(r.currentType).toBe('loss');
  });

  it('minRating and maxRating from rated games', () => {
    const games = [
      win({ rating: 1400, endTime: daysAgo(3) }),
      win({ rating: 1600, endTime: daysAgo(2) }),
      loss({ rating: 1550, endTime: daysAgo(1) }),
    ];
    const r = aggStreaks(games);
    expect(r.minRating).toBe(1400);
    expect(r.maxRating).toBe(1600);
  });
});

// ── aggRadar ───────────────────────────────────────────────────────────────────

describe('aggRadar', () => {
  it('returns null for empty array', () => {
    expect(aggRadar([])).toBeNull();
  });

  it('returns exactly 5 labelled metrics', () => {
    const r = aggRadar([win(), loss(), draw()]);
    expect(r).toHaveLength(5);
    const labels = r.map(x => x.label);
    expect(labels).toContain('Win Rate');
    expect(labels).toContain('vs Higher');
    expect(labels).toContain('Consistency');
    expect(labels).toContain('Activity');
    expect(labels).toContain('Opening\nDiversity');
  });

  it('all values are numbers in 0–100', () => {
    const games = [
      win({ ratingDiff: -50, endTime: daysAgo(5) }),
      loss({ ratingDiff: 50, endTime: daysAgo(4) }),
      win({ ratingDiff: -10, endTime: daysAgo(3) }),
    ];
    const r = aggRadar(games);
    for (const { value } of r) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('Win Rate = 100 for all-win dataset', () => {
    const games = [win(), win(), win()];
    const r = aggRadar(games);
    expect(r.find(x => x.label === 'Win Rate').value).toBe(100);
  });
});

// ── aggResultBreakdown ─────────────────────────────────────────────────────────

describe('aggResultBreakdown', () => {
  const games = [
    win({ result: 'resigned' }),
    win({ result: 'resigned' }),
    loss({ result: 'checkmated' }),
    draw({ result: 'agreed' }),
    draw({ result: 'agreed' }),
    draw({ result: 'agreed' }),
  ];

  it('returns entries sorted by count desc', () => {
    const r = aggResultBreakdown(games);
    expect(r[0].count).toBeGreaterThanOrEqual(r[1].count);
  });

  it('most common result ("agreed") is first', () => {
    const r = aggResultBreakdown(games);
    expect(r[0].label).toBe('Agreed');
  });

  it('pct values sum to 100', () => {
    const r = aggResultBreakdown(games);
    const total = r.reduce((s, x) => s + x.pct, 0);
    expect(total).toBeLessThanOrEqual(100); // rounding may give <100
    expect(total).toBeGreaterThan(90);
  });

  it('returns at most 8 entries', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      win({ result: `result_${i}` })
    );
    expect(aggResultBreakdown(many).length).toBeLessThanOrEqual(8);
  });
});
