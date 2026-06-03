#!/usr/bin/env python3
"""
Filter names.csv to keep only professors confirmed at University of Ottawa on RMP.
Run from services/rmp_scraper/ after run.js finishes: python src/filter_ottawa_only.py
"""

import pandas as pd
import base64
import requests
import concurrent.futures
from pathlib import Path

try:
    from fake_useragent import UserAgent
    _ua = UserAgent()
    def ua(): return _ua.random
except Exception:
    def ua(): return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

RMP_DIR = Path(__file__).parent.parent
GRAPHQL_URL = 'https://www.ratemyprofessors.com/graphql'
WORKERS = 20

QUERY = """
{{
  node(id: "{b64}") {{
    ... on Teacher {{
      school {{ name }}
    }}
  }}
}}
"""

def to_b64(rmp_id: str) -> str:
    return base64.b64encode(f'Teacher-{rmp_id}'.encode()).decode()

def fetch_school(rmp_id: str) -> str | None:
    try:
        r = requests.post(
            GRAPHQL_URL,
            headers={
                'Accept': '*/*',
                'Authorization': 'Basic dGVzdDp0ZXN0',
                'User-Agent': ua(),
            },
            json={'query': QUERY.format(b64=to_b64(rmp_id))},
            timeout=10,
        )
        if r.status_code == 200:
            node = r.json().get('data', {}).get('node') or {}
            return (node.get('school') or {}).get('name')
    except Exception:
        pass
    return None

def is_ottawa(school: str | None) -> bool:
    return bool(school and 'ottawa' in school.lower())

def check_row(args):
    idx, name, rmp_id = args
    rmp_id = str(rmp_id).strip()
    if rmp_id in ('', 'Not Found', 'Error', 'nan'):
        return idx, 'Not Found'
    school = fetch_school(rmp_id)
    if is_ottawa(school):
        return idx, rmp_id
    print(f"  Removed: {name!r} (school: {school!r})")
    return idx, 'Not Found'

def main():
    path = RMP_DIR / 'names.csv'
    df = pd.read_csv(path, dtype=str)
    print(f"Loaded {len(df)} rows from names.csv")

    has_id = df['ID'].notna() & ~df['ID'].isin(['Not Found', 'Error', ''])
    print(f"Checking {has_id.sum()} professors with IDs against RMP school data...")

    tasks = [
        (i, row['Name'], row['ID'])
        for i, row in df.iterrows()
        if has_id[i]
    ]

    id_updates = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for idx, new_id in pool.map(check_row, tasks):
            id_updates[idx] = new_id

    for idx, new_id in id_updates.items():
        df.at[idx, 'ID'] = new_id

    df.to_csv(path, index=False)

    kept    = (df['ID'].notna() & ~df['ID'].isin(['Not Found', 'Error', ''])).sum()
    removed = has_id.sum() - kept
    print(f"\nKept {kept} uOttawa professors")
    print(f"Removed {removed} non-uOttawa / unverified professors")
    print(f"Updated {path}")
    print("\nNow run:")
    print("  python src/pdcsv.py")
    print("  python src/main.py")
    print("  python src/process_rmp_data.py")

if __name__ == '__main__':
    main()
