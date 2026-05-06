#!/usr/bin/env python3
"""Recompress puzzle parquets with ZSTD level 22 and drop unused columns.

Reads ./puzzles/*.parquet (SNAPPY) and writes to ./puzzles_zstd/*.parquet (ZSTD-22).
Keeps the same file count and row distribution so puzzle_query.py works unchanged
once PUZZLE_DIR is repointed.

Run:  python3 scripts/compress_puzzles.py
"""

from pathlib import Path
import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "puzzles"
OUT_DIR = ROOT / "puzzles_zstd"
KEEP = ["PuzzleId", "FEN", "Moves", "Rating", "Popularity", "NbPlays", "Themes", "OpeningTags"]

OUT_DIR.mkdir(exist_ok=True)
src_files = sorted(SRC_DIR.glob("*.parquet"))
if not src_files:
    raise SystemExit(f"no parquet files in {SRC_DIR}")

total_in = 0
total_out = 0
for src in src_files:
    print(f"reading {src.name} ...", flush=True)
    table = pq.read_table(src, columns=KEEP)
    out = OUT_DIR / src.name
    print(f"  writing {out.name} (zstd-22, {table.num_rows:,} rows) ...", flush=True)
    pq.write_table(
        table,
        out,
        compression="zstd",
        compression_level=22,
        use_dictionary=True,
        write_statistics=True,
        row_group_size=250_000,
    )
    in_size = src.stat().st_size
    out_size = out.stat().st_size
    total_in += in_size
    total_out += out_size
    print(f"  {in_size/1e6:.1f} MB -> {out_size/1e6:.1f} MB  ({100*out_size/in_size:.1f}%)")

print()
print(f"TOTAL: {total_in/1e6:.1f} MB -> {total_out/1e6:.1f} MB  ({100*total_out/total_in:.1f}%)")
print(f"output: {OUT_DIR}")
