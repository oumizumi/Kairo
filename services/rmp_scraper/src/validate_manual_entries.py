#!/usr/bin/env python3
"""
Validate manual RMP entries before applying them to production
Use this to check your CSV file for errors before running the deployment script.
"""

import json
import csv
import os
from typing import List, Dict, Any, Tuple

def normalize_name(name: str) -> str:
    """Normalize professor name for matching"""
    return name.lower().strip().replace('  ', ' ')

def validate_csv_format(csv_path: str) -> Tuple[List[Dict], List[str]]:
    """Validate CSV file format and return valid entries and errors"""
    
    if not os.path.exists(csv_path):
        return [], [f"CSV file not found: {csv_path}"]
    
    valid_entries = []
    errors = []
    line_num = 1  # Start at 1 (header row)
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            # Check required columns exist
            required_cols = ['name', 'rmp_id', 'rmp_rating']
            if not all(col in reader.fieldnames for col in required_cols):
                missing = [col for col in required_cols if col not in reader.fieldnames]
                errors.append(f"Missing required columns: {', '.join(missing)}")
                return [], errors
            
            for row in reader:
                line_num += 1
                
                # Skip empty rows
                if not row['name'] or not row['name'].strip():
                    continue
                
                # Skip rows without RMP data (placeholders)
                if not row['rmp_id'] or not row['rmp_rating']:
                    continue
                
                # Validate name
                if not row['name'].strip():
                    errors.append(f"Line {line_num}: Name is empty")
                    continue
                
                # Validate RMP ID
                if not row['rmp_id'].strip():
                    errors.append(f"Line {line_num} ({row['name']}): RMP ID is required")
                    continue
                
                # Validate rating
                try:
                    rating = float(row['rmp_rating'])
                    if rating < 0 or rating > 5:
                        errors.append(f"Line {line_num} ({row['name']}): Rating must be between 0 and 5, got {rating}")
                        continue
                except ValueError:
                    errors.append(f"Line {line_num} ({row['name']}): Invalid rating '{row['rmp_rating']}', must be a number")
                    continue
                
                # Validate difficulty (if provided)
                if row.get('rmp_difficulty') and row['rmp_difficulty'].strip():
                    try:
                        difficulty = float(row['rmp_difficulty'])
                        if difficulty < 0 or difficulty > 5:
                            errors.append(f"Line {line_num} ({row['name']}): Difficulty must be between 0 and 5, got {difficulty}")
                            continue
                    except ValueError:
                        errors.append(f"Line {line_num} ({row['name']}): Invalid difficulty '{row['rmp_difficulty']}', must be a number")
                        continue
                
                # Validate would take again (if provided)
                if row.get('rmp_would_take_again') and row['rmp_would_take_again'].strip():
                    try:
                        wta = float(row['rmp_would_take_again'])
                        if wta < 0 or wta > 100:
                            errors.append(f"Line {line_num} ({row['name']}): Would take again must be between 0 and 100, got {wta}")
                            continue
                    except ValueError:
                        errors.append(f"Line {line_num} ({row['name']}): Invalid would take again '{row['rmp_would_take_again']}', must be a number")
                        continue
                
                # Entry is valid
                valid_entries.append({
                    'line': line_num,
                    'name': row['name'].strip(),
                    'rmp_id': row['rmp_id'].strip(),
                    'rmp_rating': float(row['rmp_rating']),
                    'rmp_difficulty': float(row['rmp_difficulty']) if row.get('rmp_difficulty', '').strip() else None,
                    'rmp_would_take_again': row.get('rmp_would_take_again', '').strip(),
                    'department': row.get('department', '').strip(),
                    'rmp_department': row.get('rmp_department', '').strip(),
                })
        
    except Exception as e:
        errors.append(f"Error reading CSV: {e}")
    
    return valid_entries, errors

def check_professor_names(valid_entries: List[Dict], professors_path: str) -> Tuple[List[Dict], List[str]]:
    """Check if professor names exist in the database"""
    
    matched = []
    not_found = []
    
    try:
        with open(professors_path, 'r', encoding='utf-8') as f:
            professors = json.load(f)
        
        # Create lookup for fast matching
        prof_lookup = {normalize_name(p['name']): p['name'] for p in professors}
        
        for entry in valid_entries:
            normalized = normalize_name(entry['name'])
            
            if normalized in prof_lookup:
                entry['matched_name'] = prof_lookup[normalized]
                matched.append(entry)
            else:
                # Try fuzzy matching (first + last name)
                name_parts = normalized.split()
                found_match = False
                
                if len(name_parts) >= 2:
                    for prof_normalized, prof_real_name in prof_lookup.items():
                        prof_parts = prof_normalized.split()
                        if len(prof_parts) >= 2:
                            if name_parts[0] == prof_parts[0] and name_parts[-1] == prof_parts[-1]:
                                entry['matched_name'] = prof_real_name
                                matched.append(entry)
                                found_match = True
                                break
                
                if not found_match:
                    not_found.append(entry['name'])
        
    except Exception as e:
        print(f"❌ Error loading professors database: {e}")
        return [], []
    
    return matched, not_found

def main():
    print("🔍 Validating Manual RMP Entries\n")
    print("=" * 60)
    
    # Paths
    csv_path = '../frontend/public/unmatched_professors_manual_entry.csv'
    professors_path = '../frontend/public/professors_enhanced.json'
    
    # Step 1: Validate CSV format
    print("\n📋 Step 1: Validating CSV format...\n")
    valid_entries, format_errors = validate_csv_format(csv_path)
    
    if format_errors:
        print("❌ CSV Format Errors:")
        for error in format_errors:
            print(f"   • {error}")
        print("\nPlease fix these errors and try again.")
        return
    
    if not valid_entries:
        print("⚠️  No valid entries found in CSV.")
        print(f"\nMake sure you've added RMP data to: {csv_path}")
        print("\nRequired columns: name, rmp_id, rmp_rating")
        return
    
    print(f"✅ Found {len(valid_entries)} valid entries in CSV")
    
    # Step 2: Check professor names
    print("\n👥 Step 2: Checking professor names in database...\n")
    matched_entries, not_found = check_professor_names(valid_entries, professors_path)
    
    if matched_entries:
        print(f"✅ {len(matched_entries)} professors found in database:")
        for entry in matched_entries:
            matched_name = entry.get('matched_name', entry['name'])
            name_match = "" if matched_name == entry['name'] else f" (matched to: {matched_name})"
            print(f"   • {entry['name']}{name_match} - RMP: {entry['rmp_rating']}/5.0")
    
    if not_found:
        print(f"\n⚠️  {len(not_found)} professors NOT found in database:")
        for name in not_found:
            print(f"   • {name}")
        print("\nThese entries will be skipped. Check spelling or database.")
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Validation Summary:")
    print("=" * 60)
    print(f"✅ Valid entries: {len(valid_entries)}")
    print(f"✅ Will be applied: {len(matched_entries)}")
    print(f"⚠️  Will be skipped: {len(not_found)}")
    
    if format_errors:
        print(f"❌ Format errors: {len(format_errors)}")
    
    # Final verdict
    print("\n" + "=" * 60)
    if matched_entries and not format_errors:
        print("✅ VALIDATION PASSED!")
        print(f"\n{len(matched_entries)} entries are ready to be applied.")
        print("\nTo apply these changes to production, run:")
        print("   python3 apply_manual_rmp_entries.py")
    elif not matched_entries:
        print("⚠️  NO ENTRIES WILL BE APPLIED")
        print("\nAll entries either have errors or professors not found.")
    else:
        print("❌ VALIDATION FAILED")
        print("\nPlease fix the errors above and try again.")
    
    print("=" * 60)

if __name__ == "__main__":
    main()


