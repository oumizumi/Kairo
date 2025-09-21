#!/usr/bin/env python3
"""
Process RMP scraper data to match professors and extract their ratings/reviews
"""

import pandas as pd
import json
from collections import defaultdict

def load_original_professors():
    """Load the original professors who had no RMP data"""
    try:
        # Read the names.csv to get original professor list
        df = pd.read_csv('names.csv')
        original_profs = df['Name'].tolist()
        print(f"Found {len(original_profs)} original professors without RMP data")
        return original_profs
    except Exception as e:
        print(f"Error loading original professors: {e}")
        return []

def load_scraped_data():
    """Load the scraped RMP data from FinalOutput.csv"""
    try:
        df = pd.read_csv('FinalOutput.csv')
        print(f"Loaded {len(df)} reviews from FinalOutput.csv")
        return df
    except Exception as e:
        print(f"Error loading scraped data: {e}")
        return pd.DataFrame()

def match_professor_names(original_name, scraped_first, scraped_last):
    """Match professor names with various formats"""
    original_clean = original_name.lower().strip()
    scraped_full = f"{scraped_first} {scraped_last}".lower().strip()
    
    # Direct match
    if original_clean == scraped_full:
        return True
    
    # Check if scraped name is contained in original (handles middle names)
    if scraped_first.lower() in original_clean and scraped_last.lower() in original_clean:
        return True
    
    # Check reverse order
    scraped_reverse = f"{scraped_last} {scraped_first}".lower().strip()
    if original_clean == scraped_reverse:
        return True
    
    return False

def process_professor_data(original_profs, scraped_df):
    """Process and match professor data"""
    professor_data = {}
    unmatched_originals = []
    
    for original_name in original_profs:
        matches = []
        
        # Find all reviews for this professor
        for idx, row in scraped_df.iterrows():
            if match_professor_names(original_name, str(row['First Name']), str(row['Last Name'])):
                matches.append(row)
        
        if matches:
            # Calculate aggregated metrics
            difficulties = [float(x) for x in [m['Avg Difficulty'] for m in matches] if pd.notna(x)]
            ratings = [float(x) for x in [m['Avg Rating'] for m in matches] if pd.notna(x)]
            
            professor_data[original_name] = {
                'name': original_name,
                'scraped_name': f"{matches[0]['First Name']} {matches[0]['Last Name']}",
                'avg_difficulty': round(sum(difficulties) / len(difficulties), 2) if difficulties else None,
                'avg_rating': round(sum(ratings) / len(ratings), 2) if ratings else None,
                'department': matches[0]['Department'] if pd.notna(matches[0]['Department']) else 'Not Specified',
                'total_reviews': len(matches),
                'reviews': [
                    {
                        'comment': str(m['Comment']) if pd.notna(m['Comment']) else '',
                        'difficulty_rating': m['Difficulty Rating'] if pd.notna(m['Difficulty Rating']) else None,
                        'clarity_rating': m['Clarity Rating'] if pd.notna(m['Clarity Rating']) else None,
                        'grade': str(m['Grade']) if pd.notna(m['Grade']) else '',
                        'rating_tags': str(m['Rating Tags']) if pd.notna(m['Rating Tags']) else ''
                    }
                    for m in matches
                ],
                'has_rmp_data': True
            }
            print(f"✅ Matched: {original_name} -> {len(matches)} reviews")
        else:
            unmatched_originals.append(original_name)
            professor_data[original_name] = {
                'name': original_name,
                'scraped_name': None,
                'avg_difficulty': None,
                'avg_rating': None,
                'department': 'Unknown',
                'total_reviews': 0,
                'reviews': [],
                'has_rmp_data': False
            }
            print(f"❌ No match: {original_name}")
    
    return professor_data, unmatched_originals

def save_results(professor_data, unmatched_originals):
    """Save the processed results"""
    
    # Save complete professor data as JSON
    with open('professors_rmp_data.json', 'w', encoding='utf-8') as f:
        json.dump(professor_data, f, indent=2, ensure_ascii=False)
    
    # Create summary for Kairo integration
    kairo_summary = []
    for name, data in professor_data.items():
        if data['has_rmp_data']:
            kairo_summary.append({
                'name': data['name'],
                'rmp_rating': data['avg_rating'],
                'rmp_difficulty': data['avg_difficulty'],
                'rmp_department': data['department'],
                'rmp_review_count': data['total_reviews'],
                'has_rmp_data': True
            })
    
    # Save Kairo-ready summary
    with open('../frontend/public/professors_rmp_update.json', 'w', encoding='utf-8') as f:
        json.dump(kairo_summary, f, indent=2, ensure_ascii=False)
    
    # Save unmatched professors for manual review
    with open('unmatched_professors.txt', 'w', encoding='utf-8') as f:
        f.write("Professors from original list with no RMP matches:\n\n")
        for name in unmatched_originals:
            f.write(f"- {name}\n")
    
    print(f"\n📊 Results Summary:")
    print(f"✅ Professors with RMP data: {len([p for p in professor_data.values() if p['has_rmp_data']])}")
    print(f"❌ Professors without matches: {len(unmatched_originals)}")
    print(f"📄 Files created:")
    print(f"   - professors_rmp_data.json (complete data)")
    print(f"   - ../frontend/public/professors_rmp_update.json (Kairo integration)")
    print(f"   - unmatched_professors.txt (manual review needed)")

def main():
    print("🔍 Processing RMP scraper data...")
    
    # Load data
    original_profs = load_original_professors()
    scraped_df = load_scraped_data()
    
    if not original_profs or scraped_df.empty:
        print("❌ Could not load required data files")
        return
    
    # Process and match
    professor_data, unmatched_originals = process_professor_data(original_profs, scraped_df)
    
    # Save results
    save_results(professor_data, unmatched_originals)
    
    print("\n✅ Processing complete!")

if __name__ == "__main__":
    main()
