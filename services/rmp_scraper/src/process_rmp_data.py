#!/usr/bin/env python3
"""
Build professors_rmp_data.json directly from FinalOutput.csv.
Keys are the professor names as scraped from RMP (First Last).
Run from services/rmp_scraper/: python src/process_rmp_data.py
"""

import pandas as pd
import json
from pathlib import Path

RMP_DIR = Path(__file__).parent.parent
SCRAPED = RMP_DIR / 'FinalOutput.csv'
NAMES   = RMP_DIR / 'names.csv'
OUTPUT  = RMP_DIR / 'professors_rmp_data.json'


def normalize(s: str) -> str:
    import unicodedata
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.lower().replace('-', ' ').replace("'", ' ').strip()


def main():
    df = pd.read_csv(SCRAPED, dtype=str, on_bad_lines='skip')
    print(f"Loaded {len(df)} rows from FinalOutput.csv")

    # Build name -> rmp_id lookup from names.csv
    names_df = pd.read_csv(NAMES, dtype=str)
    id_lookup: dict[str, str] = {}
    for _, row in names_df.iterrows():
        rmp_id = str(row.get('ID', '')).strip()
        if rmp_id and rmp_id not in ('Not Found', 'Error', 'nan'):
            full = normalize(str(row['Name']))
            id_lookup[full] = rmp_id
            # Also map first+last only (drops middle names/initials)
            parts = full.split()
            if len(parts) > 2:
                short = f"{parts[0]} {parts[-1]}"
                if short not in id_lookup:
                    id_lookup[short] = rmp_id

    # Convert numeric columns back
    for col in ('Avg Rating', 'Avg Difficulty'):
        df[col] = pd.to_numeric(df[col], errors='coerce')

    result = {}
    skipped = 0

    for (first, last), group in df.groupby(['First Name', 'Last Name'], sort=True):
        first = str(first).strip()
        last  = str(last).strip()
        name  = f"{first} {last}"

        # Skip obviously garbage entries (single-character or numeric tokens)
        if len(first) <= 1 or len(last) <= 1:
            skipped += 1
            continue

        avg_rating     = group['Avg Rating'].dropna().iloc[0]     if not group['Avg Rating'].dropna().empty     else None
        avg_difficulty = group['Avg Difficulty'].dropna().iloc[0] if not group['Avg Difficulty'].dropna().empty else None
        department     = group['Department'].dropna().iloc[0]     if not group['Department'].dropna().empty     else 'Unknown'

        if avg_rating is None:
            skipped += 1
            continue

        rmp_id = id_lookup.get(normalize(name))

        result[name] = {
            'name':           name,
            'avg_rating':     round(float(avg_rating), 2),
            'avg_difficulty': round(float(avg_difficulty), 2) if avg_difficulty is not None else None,
            'department':     str(department),
            'total_reviews':  len(group),
            'rmp_id':         rmp_id,
            'has_rmp_data':   True,
        }

    print(f"Built {len(result)} professor entries  (skipped {skipped})")

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Wrote {OUTPUT}")
    print("Restart Next.js dev server (or wait — route reloads on file change).")


if __name__ == '__main__':
    main()
