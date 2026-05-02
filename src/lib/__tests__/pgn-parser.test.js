import { describe, it, expect } from 'vitest';
import PGNParser from '../pgn-parser.js';

// ── fixtures ───────────────────────────────────────────────────────────────────

const RUY_LOPEZ = `[White "Alice"]
[Black "Bob"]
[Result "1-0"]
[WhiteElo "1800"]
[BlackElo "1650"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O 1-0`;

// Ends in checkmate (Scholar's Mate)
const SCHOLARS_MATE = `[White "W"]
[Black "B"]
[Result "1-0"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6?? 4. Qxf7# 1-0`;

const TWO_GAME_PGN = `[Event "Game 1"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 e5 1-0

[Event "Game 2"]
[White "Carol"]
[Black "Dave"]
[Result "0-1"]

1. d4 d5 0-1`;

const PGN_WITH_COMMENTS = `[White "A"]
[Black "B"]
[Result "*"]

1. e4 {Best by test} e5 2. Nf3 {Develops knight} Nc6 *`;

const PGN_WITH_CLOCKS = `[White "Clocky"]
[Black "Timer"]
[Result "*"]

1. e4 {[%clk 0:10:00]} e5 {[%clk 0:09:58]} 2. Nf3 {[%clk 0:09:55][%emt 0:00:05]} Nc6 {[%clk 0:09:54]} *`;

// ── parse() ────────────────────────────────────────────────────────────────────

describe('PGNParser.parse', () => {
  it('returns null for empty string', () => {
    expect(PGNParser.parse('')).toBeNull();
  });

  it('returns null for whitespace-only input', () => {
    expect(PGNParser.parse('   \n  ')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(PGNParser.parse(null)).toBeNull();
  });

  it('returns an object for valid PGN', () => {
    expect(PGNParser.parse(RUY_LOPEZ)).not.toBeNull();
  });

  it('extracts White and Black headers', () => {
    const g = PGNParser.parse(RUY_LOPEZ);
    expect(g.white).toBe('Alice');
    expect(g.black).toBe('Bob');
  });

  it('extracts Result header', () => {
    const g = PGNParser.parse(RUY_LOPEZ);
    expect(g.result).toBe('1-0');
  });

  it('extracts Elo headers', () => {
    const g = PGNParser.parse(RUY_LOPEZ);
    expect(g.whiteElo).toBe('1800');
    expect(g.blackElo).toBe('1650');
  });

  it('produces the correct number of moves', () => {
    // 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O = 9 half-moves
    const g = PGNParser.parse(RUY_LOPEZ);
    expect(g.moves).toHaveLength(9);
  });

  it('each move has from/to/san fields', () => {
    const g = PGNParser.parse(RUY_LOPEZ);
    const first = g.moves[0];
    expect(first).toHaveProperty('san');
    expect(first).toHaveProperty('from');
    expect(first).toHaveProperty('to');
    expect(first.san).toBe('e4');
    expect(first.from).toBe('e2');
    expect(first.to).toBe('e4');
  });

  it('strips comments and still parses', () => {
    const g = PGNParser.parse(PGN_WITH_COMMENTS);
    expect(g).not.toBeNull();
    expect(g.moves).toHaveLength(4);
  });

  it('parses checkmate game correctly', () => {
    const g = PGNParser.parse(SCHOLARS_MATE);
    expect(g.result).toBe('1-0');
    expect(g.moves).toHaveLength(7);
    expect(g.moves[6].san).toBe('Qxf7#');
  });

  it('returns a non-empty pgn string', () => {
    const g = PGNParser.parse(RUY_LOPEZ);
    expect(typeof g.pgn).toBe('string');
    expect(g.pgn.length).toBeGreaterThan(10);
  });

  it('canonical PGN includes result token', () => {
    const g = PGNParser.parse(RUY_LOPEZ);
    expect(g.pgn).toContain('1-0');
  });

  it('preserves move clock annotations when present', () => {
    const g = PGNParser.parse(PGN_WITH_CLOCKS);
    expect(g.moves[0].clock).toBe('0:10:00');
    expect(g.moves[1].clock).toBe('0:09:58');
    expect(g.moves[2].clock).toBe('0:09:55');
    expect(g.moves[2].elapsedTime).toBe('0:00:05');
    expect(g.pgn).toContain('[%clk 0:10:00]');
  });
});

// ── buildPositions() ───────────────────────────────────────────────────────────

describe('PGNParser.buildPositions', () => {
  it('returns positions.length === moves.length + 1', () => {
    const g = PGNParser.parse(RUY_LOPEZ);
    const positions = PGNParser.buildPositions(g);
    expect(positions).toHaveLength(g.moves.length + 1);
  });

  it('first position is the starting FEN', () => {
    const g = PGNParser.parse(RUY_LOPEZ);
    const positions = PGNParser.buildPositions(g);
    expect(positions[0].fen).toMatch(/^rnbqkbnr\/pppppppp/);
  });

  it('each position has a fen string', () => {
    const g = PGNParser.parse(RUY_LOPEZ);
    const positions = PGNParser.buildPositions(g);
    for (const p of positions) {
      expect(typeof p.fen).toBe('string');
      expect(p.fen.split(' ')).toHaveLength(6); // valid FEN has 6 parts
    }
  });

  it('positions[1].move.san matches first move san', () => {
    const g = PGNParser.parse(RUY_LOPEZ);
    const positions = PGNParser.buildPositions(g);
    expect(positions[1].san).toBe('e4');
  });
});

// ── parseMultiple() ────────────────────────────────────────────────────────────

describe('PGNParser.parseMultiple', () => {
  it('returns an array', () => {
    const games = PGNParser.parseMultiple(TWO_GAME_PGN);
    expect(Array.isArray(games)).toBe(true);
  });

  it('splits two games correctly', () => {
    const games = PGNParser.parseMultiple(TWO_GAME_PGN);
    expect(games).toHaveLength(2);
  });

  it('each game has correct White player', () => {
    const games = PGNParser.parseMultiple(TWO_GAME_PGN);
    expect(games[0].white).toBe('Alice');
    expect(games[1].white).toBe('Carol');
  });

  it('each game has correct result', () => {
    const games = PGNParser.parseMultiple(TWO_GAME_PGN);
    expect(games[0].result).toBe('1-0');
    expect(games[1].result).toBe('0-1');
  });
});

// ── gameToSummary() ────────────────────────────────────────────────────────────

describe('PGNParser.gameToSummary', () => {
  it('summary has expected shape', () => {
    const g = PGNParser.parse(RUY_LOPEZ);
    const s = PGNParser.gameToSummary(g);
    expect(s).toHaveProperty('white', 'Alice');
    expect(s).toHaveProperty('black', 'Bob');
    expect(s).toHaveProperty('result', '1-0');
    expect(s).toHaveProperty('moveCount');
    expect(s).toHaveProperty('pgn');
  });

  it('moveCount equals moves array length', () => {
    const g = PGNParser.parse(RUY_LOPEZ);
    const s = PGNParser.gameToSummary(g);
    expect(s.moveCount).toBe(g.moves.length);
  });
});
