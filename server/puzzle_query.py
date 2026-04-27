#!/usr/bin/env python3

import argparse
import json
import random
import sys
from pathlib import Path

import pyarrow.compute as pc
import pyarrow.parquet as pq


ROOT = Path(__file__).resolve().parent.parent
PUZZLE_DIR = ROOT / "puzzles"
PUZZLE_FILES = sorted(PUZZLE_DIR.glob("*.parquet"))
PARQUET_MAP = {path: pq.ParquetFile(path) for path in PUZZLE_FILES}
ROW_GROUPS = [(path, idx) for path, parquet in PARQUET_MAP.items() for idx in range(parquet.num_row_groups)]
DEFAULT_SPREAD = 140
MAX_SPREAD = 520
# Minimum popularity to serve — filters out poorly-rated / downvoted puzzles
MIN_POPULARITY = 50
# Popularity threshold for the "quality" tier used in weighted selection
QUALITY_POPULARITY = 75


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rating", type=int, default=1200)
    parser.add_argument("--spread", type=int, default=DEFAULT_SPREAD)
    parser.add_argument("--theme", type=str, default="")
    parser.add_argument("--opening", type=str, default="")
    parser.add_argument("--exclude", type=str, default="")
    parser.add_argument("--min-rating", type=int, default=0)
    parser.add_argument("--min-popularity", type=int, default=MIN_POPULARITY)
    parser.add_argument("--serve", action="store_true")
    args = parser.parse_args()
    args.rating = max(400, min(3200, args.rating))
    args.spread = max(60, min(500, args.spread))
    args.min_rating = max(0, min(3200, args.min_rating))
    args.exclude_ids = set(filter(None, [value.strip() for value in args.exclude.split(",")]))
    return args


def row_to_payload(row):
    themes = row.get("Themes") or []
    opening_tags = row.get("OpeningTags") or []
    moves = (row.get("Moves") or "").split()
    return {
        "id": row.get("PuzzleId") or "",
        "fen": row.get("FEN") or "",
        "moves": moves,
        "rating": int(row.get("Rating") or 0),
        "themes": list(themes),
        "openingTags": list(opening_tags),
        "popularity": int(row.get("Popularity") or 0),
        "plays": int(row.get("NbPlays") or 0),
    }


def row_matches_filters(row, theme_filter, opening_filter, exclude_ids, min_pop):
    puzzle_id = row.get("PuzzleId") or ""
    if exclude_ids and puzzle_id in exclude_ids:
      return False

    themes = row.get("Themes") or []
    opening_tags = row.get("OpeningTags") or []

    if theme_filter and theme_filter not in themes:
      return False
    if opening_filter and opening_filter not in opening_tags:
      return False
    if not row.get("FEN") or not row.get("Moves"):
      return False

    # Quality gate: filter out puzzles with poor popularity (downvoted / bad quality)
    popularity = row.get("Popularity") or 0
    if popularity < min_pop:
      return False

    return True


def weighted_pick(candidates):
    """Pick a puzzle weighted by popularity — higher popularity = more likely to be served.
    This implements the Chess.com principle of preferring well-rated, validated puzzles."""
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]

    # Split into quality tier (popularity >= QUALITY_POPULARITY) and standard tier
    quality = [c for c in candidates if c.get("popularity", 0) >= QUALITY_POPULARITY]
    standard = [c for c in candidates if c.get("popularity", 0) < QUALITY_POPULARITY]

    # 80% chance to pick from quality tier if available, 20% from standard
    # This ensures variety while strongly preferring well-validated puzzles
    if quality and (not standard or random.random() < 0.80):
        pool = quality
    else:
        pool = standard if standard else quality

    # Within the chosen pool, weight by popularity so better puzzles appear more often
    weights = []
    for p in pool:
        pop = max(1, p.get("popularity", 50))
        weights.append(pop)

    total = sum(weights)
    r = random.random() * total
    cumulative = 0
    for i, w in enumerate(weights):
        cumulative += w
        if r <= cumulative:
            return pool[i]
    return pool[-1]


def pick_from_row_group(path, row_group_index, target_rating, spread, theme_filter, opening_filter, exclude_ids, min_pop, min_rating=0):
    table = PARQUET_MAP[path].read_row_group(
        row_group_index,
        columns=["PuzzleId", "FEN", "Moves", "Rating", "Popularity", "NbPlays", "Themes", "OpeningTags"],
    )
    rating_col = table["Rating"]
    lower_bound = max(target_rating - spread, min_rating)
    mask = pc.and_(
        pc.greater_equal(rating_col, lower_bound),
        pc.less_equal(rating_col, target_rating + spread),
    )
    filtered = table.filter(mask)
    if filtered.num_rows == 0:
        return None

    candidates = []
    for row in filtered.to_pylist():
        if row_matches_filters(row, theme_filter, opening_filter, exclude_ids, min_pop):
            candidates.append(row_to_payload(row))

    if not candidates:
        return None

    return weighted_pick(candidates)


def choose_puzzle(target_rating, spread, theme_filter, opening_filter, exclude_ids, min_pop=MIN_POPULARITY, min_rating=0):
    if not PUZZLE_FILES:
        raise RuntimeError("Puzzle parquet files not found in ./puzzles")

    current_spread = spread
    while current_spread <= MAX_SPREAD:
        attempts = ROW_GROUPS[:]
        random.shuffle(attempts)
        for path, row_group_index in attempts:
            payload = pick_from_row_group(path, row_group_index, target_rating, current_spread, theme_filter, opening_filter, exclude_ids, min_pop, min_rating)
            if payload:
                return payload
        current_spread += 100

    # Fallback: relax filters but keep minimum popularity
    attempts = ROW_GROUPS[:]
    random.shuffle(attempts)
    for path, row_group_index in attempts:
        payload = pick_from_row_group(path, row_group_index, target_rating, MAX_SPREAD, "", "", exclude_ids, min_pop, min_rating)
        if payload:
            return payload

    # Last resort: drop popularity requirement entirely, but keep any explicit
    # rating floor requested by the caller.
    attempts = ROW_GROUPS[:]
    random.shuffle(attempts)
    for path, row_group_index in attempts:
        payload = pick_from_row_group(path, row_group_index, target_rating, MAX_SPREAD, "", "", exclude_ids, 0, min_rating)
        if payload:
            return payload

    raise RuntimeError("No puzzle candidates found")


def choose_payload(args):
    return {
        "ok": True,
        "puzzle": choose_puzzle(args.rating, args.spread, args.theme, args.opening, args.exclude_ids, args.min_popularity, args.min_rating),
    }


def make_args_from_payload(payload):
    args = argparse.Namespace()
    args.rating = max(400, min(3200, int(payload.get("rating", 1200) or 1200)))
    args.spread = max(60, min(500, int(payload.get("spread", DEFAULT_SPREAD) or DEFAULT_SPREAD)))
    args.min_rating = max(0, min(3200, int(payload.get("minRating", 0) or 0)))
    args.theme = str(payload.get("theme", "") or "")
    args.opening = str(payload.get("opening", "") or "")
    args.exclude_ids = set(filter(None, [value.strip() for value in str(payload.get("exclude", "") or "").split(",")]))
    args.min_popularity = max(0, min(100, int(payload.get("minPopularity", MIN_POPULARITY) or MIN_POPULARITY)))
    return args


def serve():
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        response_id = None
        try:
            payload = json.loads(line)
            response_id = payload.get("id")
            args = make_args_from_payload(payload)
            response = choose_payload(args)
            response["id"] = response_id
        except Exception as exc:
            response = {
                "id": response_id,
                "ok": False,
                "error": str(exc),
            }
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


def main():
    args = parse_args()
    if args.serve:
        serve()
        return
    print(json.dumps(choose_payload(args)))


if __name__ == "__main__":
    main()
