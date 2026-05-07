#!/usr/bin/env python3
"""Split puzzles_zstd/*.parquet into per-elo-range files (200-point buckets).

Reads all *.parquet files in puzzles_zstd/, partitions rows by Rating into
200-point buckets, and writes one ZSTD-22 parquet per bucket named
`puzzles-LLLL-HHHH.parquet`. Within each bucket, rows are sorted by Rating so
parquet row-group statistics enable fast pruning at query time.

After verification, the old monolithic 0000/0001/0002.parquet files can be
deleted manually.

Run:  python3 scripts/bucket_puzzles.py
"""

from pathlib import Path
import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow.compute as pc

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "puzzles dataset"
OUT_DIR = ROOT / "puzzles dataset"
BUCKET_WIDTH = 200
KEEP = ["PuzzleId", "FEN", "Moves", "Rating", "Popularity", "NbPlays", "Themes", "OpeningTags"]

src_files = sorted(SRC_DIR.glob("*.parquet"))
src_files = [p for p in src_files if not p.name.startswith("puzzles-")]
if not src_files:
    raise SystemExit(f"no source parquets in {SRC_DIR} (already bucketed?)")

print(f"reading {len(src_files)} source file(s) ...", flush=True)
tables = [pq.read_table(p, columns=KEEP) for p in src_files]
combined = pa.concat_tables(tables)
print(f"  {combined.num_rows:,} rows total", flush=True)

rating_min = pc.min(combined["Rating"]).as_py()
rating_max = pc.max(combined["Rating"]).as_py()
unique_buckets = list(range(
    (rating_min // BUCKET_WIDTH) * BUCKET_WIDTH,
    ((rating_max // BUCKET_WIDTH) + 1) * BUCKET_WIDTH,
    BUCKET_WIDTH,
))
print(f"  {len(unique_buckets)} buckets: {unique_buckets[0]}..{unique_buckets[-1]}", flush=True)

written = []
for bucket_lo in unique_buckets:
    bucket_hi = bucket_lo + BUCKET_WIDTH - 1
    mask = pc.and_(
        pc.greater_equal(combined["Rating"], bucket_lo),
        pc.less_equal(combined["Rating"], bucket_hi),
    )
    sub = combined.filter(mask)
    if sub.num_rows == 0:
        continue
    sort_idx = pc.sort_indices(sub, sort_keys=[("Rating", "ascending")])
    sub = sub.take(sort_idx)
    name = f"puzzles-{bucket_lo:04d}-{bucket_hi:04d}.parquet"
    out = OUT_DIR / name
    pq.write_table(
        sub,
        out,
        compression="zstd",
        compression_level=22,
        use_dictionary=True,
        write_statistics=True,
        row_group_size=50_000,
    )
    size_mb = out.stat().st_size / 1e6
    print(f"  {name}: {sub.num_rows:>8,} rows -> {size_mb:5.1f} MB", flush=True)
    written.append((name, sub.num_rows, size_mb))

total_rows = sum(r for _, r, _ in written)
total_mb = sum(s for _, _, s in written)
print()
print(f"wrote {len(written)} bucket files, {total_rows:,} rows, {total_mb:.1f} MB total")
print(f"source files left in place — delete after verifying:")
for p in src_files:
    print(f"  {p.name}")
