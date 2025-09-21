#!/usr/bin/env python3
"""
Separate review data (comments, tags) and create unmatched professors file with format sample
"""

import json
from typing import Dict, List, Any

def load_review_data() -> Dict[str, Any]:
    """Load the detailed review data"""
    try:
        with open('professors_rmp_data.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ Loaded review data for {len(data)} professors")
        return data
    except Exception as e:
        print(f"❌ Error loading review data: {e}")
        return {}

def load_unmatched_professors() -> List[str]:
    """Load the unmatched professors list"""
    try:
        with open('unmatched_professors.txt', 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Extract professor names (skip header and empty lines)
        names = []
        for line in lines:
            line = line.strip()
            if line.startswith('- '):
                names.append(line[2:])  # Remove "- " prefix
        
        print(f"✅ Loaded {len(names)} unmatched professors")
        return names
    except Exception as e:
        print(f"❌ Error loading unmatched professors: {e}")
        return []

def extract_all_comments(review_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract all individual comments with professor info"""
    all_comments = []
    
    for prof_name, prof_data in review_data.items():
        if prof_data.get('has_rmp_data', False):
            for review in prof_data.get('reviews', []):
                comment_entry = {
                    'professor_name': prof_name,
                    'department': prof_data.get('department', ''),
                    'avg_rating': prof_data.get('avg_rating'),
                    'avg_difficulty': prof_data.get('avg_difficulty'),
                    'comment': review.get('comment', ''),
                    'difficulty_rating': review.get('difficulty_rating'),
                    'clarity_rating': review.get('clarity_rating'),
                    'grade': review.get('grade', ''),
                    'rating_tags': review.get('rating_tags', '')
                }
                all_comments.append(comment_entry)
    
    print(f"✅ Extracted {len(all_comments)} individual comments")
    return all_comments

def extract_all_tags(review_data: Dict[str, Any]) -> Dict[str, Any]:
    """Extract and analyze all rating tags"""
    tag_analysis = {
        'by_professor': {},
        'all_unique_tags': set(),
        'tag_frequency': {}
    }
    
    for prof_name, prof_data in review_data.items():
        if prof_data.get('has_rmp_data', False):
            prof_tags = []
            
            for review in prof_data.get('reviews', []):
                tags = review.get('rating_tags', '')
                if tags:
                    # Split tags by '--' and clean them
                    individual_tags = [tag.strip() for tag in tags.split('--') if tag.strip()]
                    prof_tags.extend(individual_tags)
                    tag_analysis['all_unique_tags'].update(individual_tags)
                    
                    # Count frequency
                    for tag in individual_tags:
                        tag_analysis['tag_frequency'][tag] = tag_analysis['tag_frequency'].get(tag, 0) + 1
            
            if prof_tags:
                tag_analysis['by_professor'][prof_name] = {
                    'department': prof_data.get('department', ''),
                    'avg_rating': prof_data.get('avg_rating'),
                    'avg_difficulty': prof_data.get('avg_difficulty'),
                    'tags': prof_tags,
                    'unique_tags': list(set(prof_tags))
                }
    
    # Convert set to sorted list
    tag_analysis['all_unique_tags'] = sorted(list(tag_analysis['all_unique_tags']))
    
    print(f"✅ Found {len(tag_analysis['all_unique_tags'])} unique tags")
    print(f"✅ Analyzed tags for {len(tag_analysis['by_professor'])} professors")
    
    return tag_analysis

def create_unmatched_with_format(unmatched_names: List[str]) -> Dict[str, Any]:
    """Create unmatched professors file with proper format structure"""
    unmatched_data = {
        'total_unmatched': len(unmatched_names),
        'format_sample': {
            'name': 'Professor Name Example',
            'title': '',
            'department': 'Department Name',
            'email': None,
            'bio': '',
            'rmp_id': '',
            'rmp_rating': '',
            'rmp_difficulty': '',
            'rmp_would_take_again': '',
            'rmp_department': '',
            'rmp_review_count': 0,
            'has_rmp_data': False,
            'notes': 'This professor needs manual RMP data entry'
        },
        'professors_needing_manual_entry': []
    }
    
    # Add all unmatched professors with the proper structure
    for name in unmatched_names:
        prof_entry = {
            'name': name,
            'title': '',
            'department': '',
            'email': None,
            'bio': '',
            'rmp_id': '',
            'rmp_rating': '',
            'rmp_difficulty': '',
            'rmp_would_take_again': '',
            'rmp_department': '',
            'rmp_review_count': 0,
            'has_rmp_data': False,
            'status': 'needs_manual_rmp_data'
        }
        unmatched_data['professors_needing_manual_entry'].append(prof_entry)
    
    print(f"✅ Created structured data for {len(unmatched_names)} unmatched professors")
    return unmatched_data

def save_separated_data(comments: List[Dict], tags: Dict, unmatched: Dict):
    """Save all separated data to files"""
    
    # Save all comments
    with open('../frontend/public/professor_comments.json', 'w', encoding='utf-8') as f:
        json.dump(comments, f, indent=2, ensure_ascii=False)
    print(f"💬 Saved {len(comments)} comments to: ../frontend/public/professor_comments.json")
    
    # Save tag analysis
    with open('../frontend/public/professor_tags_analysis.json', 'w', encoding='utf-8') as f:
        json.dump(tags, f, indent=2, ensure_ascii=False)
    print(f"🏷️  Saved tag analysis to: ../frontend/public/professor_tags_analysis.json")
    
    # Save unmatched professors with format
    with open('../frontend/public/unmatched_professors_structured.json', 'w', encoding='utf-8') as f:
        json.dump(unmatched, f, indent=2, ensure_ascii=False)
    print(f"❌ Saved {unmatched['total_unmatched']} unmatched professors to: ../frontend/public/unmatched_professors_structured.json")
    
    # Also create a simple CSV for easy manual editing
    import csv
    with open('../frontend/public/unmatched_professors_manual_entry.csv', 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['name', 'department', 'rmp_id', 'rmp_rating', 'rmp_difficulty', 'rmp_would_take_again', 'rmp_department', 'notes']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for prof in unmatched['professors_needing_manual_entry']:
            writer.writerow({
                'name': prof['name'],
                'department': '',
                'rmp_id': '',
                'rmp_rating': '',
                'rmp_difficulty': '',
                'rmp_would_take_again': '',
                'rmp_department': '',
                'notes': 'Needs manual RMP lookup'
            })
    
    print(f"📝 Created CSV for manual entry: ../frontend/public/unmatched_professors_manual_entry.csv")

def create_summary_stats(comments: List[Dict], tags: Dict, unmatched: Dict):
    """Create summary statistics"""
    
    # Calculate stats
    total_reviews = len(comments)
    professors_with_data = len(set(comment['professor_name'] for comment in comments))
    avg_reviews_per_prof = total_reviews / professors_with_data if professors_with_data > 0 else 0
    
    # Top tags
    top_tags = sorted(tags['tag_frequency'].items(), key=lambda x: x[1], reverse=True)[:20]
    
    summary = {
        'overview': {
            'total_individual_reviews': total_reviews,
            'professors_with_rmp_data': professors_with_data,
            'professors_needing_manual_entry': unmatched['total_unmatched'],
            'average_reviews_per_professor': round(avg_reviews_per_prof, 1),
            'unique_rating_tags': len(tags['all_unique_tags'])
        },
        'top_20_most_common_tags': [
            {'tag': tag, 'frequency': freq} for tag, freq in top_tags
        ],
        'files_created': [
            'professor_comments.json - All individual student comments',
            'professor_tags_analysis.json - Rating tags analysis',
            'unmatched_professors_structured.json - Professors needing manual RMP data',
            'unmatched_professors_manual_entry.csv - CSV for easy manual editing',
            'rmp_data_summary.json - This summary file'
        ]
    }
    
    with open('../frontend/public/rmp_data_summary.json', 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print(f"\n📊 Summary Statistics:")
    print(f"   💬 Total individual reviews: {total_reviews}")
    print(f"   👨‍🏫 Professors with RMP data: {professors_with_data}")
    print(f"   ❌ Professors needing manual entry: {unmatched['total_unmatched']}")
    print(f"   📈 Average reviews per professor: {round(avg_reviews_per_prof, 1)}")
    print(f"   🏷️  Unique rating tags: {len(tags['all_unique_tags'])}")
    print(f"   🔝 Top tag: '{top_tags[0][0]}' ({top_tags[0][1]} times)")

def main():
    print("🔍 Separating review data and organizing unmatched professors...")
    
    # Load data
    review_data = load_review_data()
    unmatched_names = load_unmatched_professors()
    
    if not review_data:
        print("❌ Cannot proceed without review data")
        return
    
    # Extract data
    all_comments = extract_all_comments(review_data)
    tag_analysis = extract_all_tags(review_data)
    unmatched_structured = create_unmatched_with_format(unmatched_names)
    
    # Save everything
    save_separated_data(all_comments, tag_analysis, unmatched_structured)
    create_summary_stats(all_comments, tag_analysis, unmatched_structured)
    
    print("\n✅ All data separated and organized successfully!")
    print("📁 Check your frontend/public/ folder for all the new files!")

if __name__ == "__main__":
    main()
