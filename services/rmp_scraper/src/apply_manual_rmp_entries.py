#!/usr/bin/env python3
"""
Apply manual RMP entries from CSV to production
This script reads the manual_entry CSV, merges data into professors_enhanced.json,
and deploys to both frontend and backend for production use.
"""

import json
import csv
import os
import shutil
from datetime import datetime
from typing import Dict, List, Any

def normalize_name(name: str) -> str:
    """Normalize professor name for matching"""
    return name.lower().strip().replace('  ', ' ')

def read_manual_entries() -> List[Dict[str, Any]]:
    """Read manual RMP entries from CSV"""
    csv_path = '../frontend/public/unmatched_professors_manual_entry.csv'
    
    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        return []
    
    manual_entries = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Skip rows without RMP data
            if not row['rmp_id'] or not row['rmp_rating']:
                continue
            
            # Parse and validate data
            try:
                entry = {
                    'name': row['name'].strip(),
                    'department': row['department'].strip() if row['department'] else '',
                    'rmp_id': row['rmp_id'].strip(),
                    'rmp_rating': float(row['rmp_rating']),
                    'rmp_difficulty': float(row['rmp_difficulty']) if row['rmp_difficulty'] else None,
                    'rmp_would_take_again': row['rmp_would_take_again'].strip() if row['rmp_would_take_again'] else '',
                    'rmp_department': row['rmp_department'].strip() if row['rmp_department'] else row['department'].strip(),
                    'notes': row['notes'].strip() if 'notes' in row else ''
                }
                manual_entries.append(entry)
                print(f"✅ Loaded manual entry: {entry['name']} (RMP: {entry['rmp_rating']})")
            except (ValueError, KeyError) as e:
                print(f"⚠️  Skipping invalid row for {row.get('name', 'Unknown')}: {e}")
                continue
    
    print(f"\n📊 Loaded {len(manual_entries)} manual RMP entries from CSV")
    return manual_entries

def load_professors_enhanced(path: str) -> List[Dict[str, Any]]:
    """Load professors_enhanced.json file"""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ Loaded {len(data)} professors from {path}")
        return data
    except Exception as e:
        print(f"❌ Error loading {path}: {e}")
        return []

def find_professor_by_name(name: str, professors: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Find professor in list by name (normalized matching)"""
    normalized_name = normalize_name(name)
    
    for prof in professors:
        prof_name = normalize_name(prof['name'])
        
        # Direct match
        if normalized_name == prof_name:
            return prof
        
        # Check if names are similar (first + last name match)
        name_parts = normalized_name.split()
        prof_parts = prof_name.split()
        
        if len(name_parts) >= 2 and len(prof_parts) >= 2:
            if name_parts[0] == prof_parts[0] and name_parts[-1] == prof_parts[-1]:
                return prof
    
    return None

def apply_manual_entries(professors: List[Dict[str, Any]], manual_entries: List[Dict[str, Any]]) -> tuple:
    """Apply manual entries to professors list"""
    updated_count = 0
    not_found = []
    
    for entry in manual_entries:
        professor = find_professor_by_name(entry['name'], professors)
        
        if professor:
            # Update with manual RMP data
            professor['rmp_id'] = entry['rmp_id']
            professor['rmp_rating'] = str(entry['rmp_rating'])
            
            if entry['rmp_difficulty']:
                professor['rmp_difficulty'] = str(entry['rmp_difficulty'])
            
            if entry['rmp_would_take_again']:
                professor['rmp_would_take_again'] = entry['rmp_would_take_again']
            
            if entry['rmp_department']:
                professor['rmp_department'] = entry['rmp_department']
            
            professor['has_rmp_data'] = True
            professor['manual_entry'] = True  # Flag to track manual entries
            professor['manual_entry_date'] = datetime.now().isoformat()
            
            if entry['notes']:
                professor['manual_notes'] = entry['notes']
            
            updated_count += 1
            print(f"✅ Updated {professor['name']}: RMP {entry['rmp_rating']}/5.0")
        else:
            not_found.append(entry['name'])
            print(f"⚠️  Professor not found in database: {entry['name']}")
    
    return updated_count, not_found

def save_professors_enhanced(professors: List[Dict[str, Any]], path: str):
    """Save professors_enhanced.json file"""
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(professors, f, indent=2, ensure_ascii=False)
        print(f"✅ Saved {len(professors)} professors to {path}")
    except Exception as e:
        print(f"❌ Error saving {path}: {e}")
        raise

def update_cache_bust():
    """Update cache-bust.json to force frontend refresh"""
    cache_bust_path = '../frontend/public/cache-bust.json'
    
    try:
        if os.path.exists(cache_bust_path):
            with open(cache_bust_path, 'r') as f:
                cache_data = json.load(f)
        else:
            cache_data = {}
        
        timestamp = datetime.now().isoformat()
        cache_data.update({
            'professors_enhanced': timestamp,
            'last_manual_rmp_update': timestamp
        })
        
        with open(cache_bust_path, 'w') as f:
            json.dump(cache_data, f, indent=2)
        
        print(f"✅ Updated cache-bust.json with timestamp: {timestamp}")
        return True
        
    except Exception as e:
        print(f"❌ Error updating cache-bust: {e}")
        return False

def deploy_to_production(professors: List[Dict[str, Any]]):
    """Deploy updated data to both frontend and backend"""
    
    # Frontend path
    frontend_path = '../frontend/public/professors_enhanced.json'
    # Backend path
    backend_path = '../backend/api/data/professors_enhanced.json'
    
    # Create backups
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    if os.path.exists(frontend_path):
        backup_path = f'../frontend/public/professors_enhanced_backup_{timestamp}.json'
        shutil.copy(frontend_path, backup_path)
        print(f"🔒 Created frontend backup: {backup_path}")
    
    if os.path.exists(backend_path):
        backend_backup = f'../backend/api/data/professors_enhanced_backup_{timestamp}.json'
        shutil.copy(backend_path, backend_backup)
        print(f"🔒 Created backend backup: {backend_backup}")
    
    # Save to both locations
    save_professors_enhanced(professors, frontend_path)
    save_professors_enhanced(professors, backend_path)
    
    # Update cache bust
    update_cache_bust()
    
    print("\n✅ Deployed to production:")
    print(f"   • Frontend: {frontend_path}")
    print(f"   • Backend: {backend_path}")

def generate_update_report(updated_count: int, not_found: List[str], professors: List[Dict[str, Any]]):
    """Generate a report of the update"""
    total_with_rmp = len([p for p in professors if p.get('has_rmp_data', False)])
    manual_entries = len([p for p in professors if p.get('manual_entry', False)])
    
    report = {
        'update_date': datetime.now().isoformat(),
        'manual_entries_applied': updated_count,
        'professors_not_found': not_found,
        'total_professors': len(professors),
        'professors_with_rmp_data': total_with_rmp,
        'manual_rmp_entries': manual_entries,
        'coverage_percentage': round((total_with_rmp / len(professors)) * 100, 2) if professors else 0
    }
    
    report_path = '../frontend/public/manual_rmp_update_report.json'
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📊 Update Report:")
    print(f"   • Manual entries applied: {updated_count}")
    print(f"   • Total professors with RMP: {total_with_rmp}")
    print(f"   • Manual RMP entries: {manual_entries}")
    print(f"   • Coverage: {report['coverage_percentage']}%")
    print(f"   • Report saved to: {report_path}")
    
    if not_found:
        print(f"\n⚠️  {len(not_found)} professors not found in database:")
        for name in not_found[:10]:  # Show first 10
            print(f"      - {name}")
        if len(not_found) > 10:
            print(f"      ... and {len(not_found) - 10} more")

def main():
    print("🚀 Applying Manual RMP Entries to Production\n")
    print("=" * 60)
    
    # Read manual entries from CSV
    manual_entries = read_manual_entries()
    
    if not manual_entries:
        print("\n❌ No manual entries found in CSV. Please add RMP data to:")
        print("   frontend/public/unmatched_professors_manual_entry.csv")
        print("\nCSV Format:")
        print("   name,department,rmp_id,rmp_rating,rmp_difficulty,rmp_would_take_again,rmp_department,notes")
        return
    
    # Load current professors_enhanced.json
    frontend_path = '../frontend/public/professors_enhanced.json'
    professors = load_professors_enhanced(frontend_path)
    
    if not professors:
        print("❌ Cannot proceed without professors_enhanced.json")
        return
    
    # Apply manual entries
    print("\n" + "=" * 60)
    print("Applying manual entries...\n")
    updated_count, not_found = apply_manual_entries(professors, manual_entries)
    
    if updated_count == 0:
        print("\n❌ No professors were updated. Check that names match exactly.")
        return
    
    # Deploy to production
    print("\n" + "=" * 60)
    print("Deploying to production...\n")
    deploy_to_production(professors)
    
    # Generate report
    print("\n" + "=" * 60)
    generate_update_report(updated_count, not_found, professors)
    
    print("\n" + "=" * 60)
    print("🎉 SUCCESS! Manual RMP entries applied to production")
    print("=" * 60)
    print("\n✨ Your changes are now live in:")
    print("   • Frontend (for users)")
    print("   • Backend (for API)")
    print("\n🔄 The frontend cache has been busted - changes will appear immediately!")
    print("\n💡 Tip: You can continue adding more entries to the CSV and run this script again.")

if __name__ == "__main__":
    main()


