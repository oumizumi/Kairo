#!/usr/bin/env python3
"""
Merge new RMP data with existing professors_enhanced.json
"""

import json
from typing import Dict, List, Any

def load_existing_professors() -> List[Dict[str, Any]]:
    """Load the existing professors_enhanced.json file"""
    try:
        with open('../frontend/public/professors_enhanced.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ Loaded {len(data)} existing professors")
        return data
    except Exception as e:
        print(f"❌ Error loading existing professors: {e}")
        return []

def load_new_rmp_data() -> List[Dict[str, Any]]:
    """Load the new RMP data from professors_rmp_update.json"""
    try:
        with open('../frontend/public/professors_rmp_update.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ Loaded {len(data)} new RMP entries")
        return data
    except Exception as e:
        print(f"❌ Error loading new RMP data: {e}")
        return []

def normalize_name(name: str) -> str:
    """Normalize professor name for matching"""
    return name.lower().strip().replace('  ', ' ')

def find_matching_professor(new_prof: Dict[str, Any], existing_profs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Find matching professor in existing data"""
    new_name = normalize_name(new_prof['name'])
    
    for existing_prof in existing_profs:
        existing_name = normalize_name(existing_prof['name'])
        
        # Direct match
        if new_name == existing_name:
            return existing_prof
            
        # Check if names are similar (handling middle names, etc.)
        new_parts = new_name.split()
        existing_parts = existing_name.split()
        
        # If both have at least first and last name
        if len(new_parts) >= 2 and len(existing_parts) >= 2:
            # Check if first and last names match
            if (new_parts[0] == existing_parts[0] and 
                new_parts[-1] == existing_parts[-1]):
                return existing_prof
    
    return None

def merge_professor_data(existing_prof: Dict[str, Any], new_rmp_data: Dict[str, Any]) -> Dict[str, Any]:
    """Merge new RMP data into existing professor data"""
    # Create a copy of existing professor
    merged_prof = existing_prof.copy()
    
    # Update RMP fields with new data
    merged_prof.update({
        'rmp_rating': str(new_rmp_data['rmp_rating']),
        'rmp_difficulty': str(new_rmp_data['rmp_difficulty']),
        'rmp_department': new_rmp_data['rmp_department'],
        'has_rmp_data': True
    })
    
    # Add review count if not present
    if 'rmp_review_count' not in merged_prof:
        merged_prof['rmp_review_count'] = new_rmp_data['rmp_review_count']
    
    return merged_prof

def create_new_professor_entry(new_rmp_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new professor entry from RMP data"""
    return {
        'name': new_rmp_data['name'],
        'title': '',
        'department': new_rmp_data['rmp_department'],
        'email': None,
        'bio': '',
        'rmp_id': '',  # We don't have this from the update file
        'rmp_rating': str(new_rmp_data['rmp_rating']),
        'rmp_difficulty': str(new_rmp_data['rmp_difficulty']),
        'rmp_would_take_again': '',  # We don't have this from the update file
        'rmp_department': new_rmp_data['rmp_department'],
        'rmp_review_count': new_rmp_data['rmp_review_count'],
        'has_rmp_data': True
    }

def merge_data():
    """Main function to merge the data"""
    print("🔄 Starting RMP data merge...")
    
    # Load data
    existing_profs = load_existing_professors()
    new_rmp_data = load_new_rmp_data()
    
    if not existing_profs or not new_rmp_data:
        print("❌ Cannot proceed without both data files")
        return
    
    # Create lookup for faster searching
    existing_profs_dict = {normalize_name(prof['name']): prof for prof in existing_profs}
    
    # Track statistics
    updated_count = 0
    new_count = 0
    not_found_count = 0
    
    merged_professors = []
    processed_names = set()
    
    # Process each existing professor
    for existing_prof in existing_profs:
        existing_name = normalize_name(existing_prof['name'])
        processed_names.add(existing_name)
        
        # Check if this professor has new RMP data
        matching_new_data = None
        for new_data in new_rmp_data:
            if normalize_name(new_data['name']) == existing_name:
                matching_new_data = new_data
                break
        
        if matching_new_data:
            # Merge the data
            merged_prof = merge_professor_data(existing_prof, matching_new_data)
            merged_professors.append(merged_prof)
            updated_count += 1
            print(f"✅ Updated: {existing_prof['name']}")
        else:
            # Keep existing professor as is
            merged_professors.append(existing_prof)
    
    # Add any completely new professors that weren't in the existing data
    for new_data in new_rmp_data:
        new_name = normalize_name(new_data['name'])
        if new_name not in processed_names:
            new_prof = create_new_professor_entry(new_data)
            merged_professors.append(new_prof)
            new_count += 1
            print(f"➕ Added new: {new_data['name']}")
    
    # Save the merged data
    output_file = '../frontend/public/professors_enhanced_merged.json'
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(merged_professors, f, indent=2, ensure_ascii=False)
        
        print(f"\n📊 Merge Results:")
        print(f"✅ Updated existing professors: {updated_count}")
        print(f"➕ Added new professors: {new_count}")
        print(f"📝 Total professors in merged file: {len(merged_professors)}")
        print(f"💾 Saved to: {output_file}")
        
        # Create backup of original
        import shutil
        backup_file = '../frontend/public/professors_enhanced_backup.json'
        shutil.copy('../frontend/public/professors_enhanced.json', backup_file)
        print(f"🔒 Backup created: {backup_file}")
        
        # Option to replace original
        print(f"\n🔄 To replace the original file, run:")
        print(f"mv {output_file} ../frontend/public/professors_enhanced.json")
        
    except Exception as e:
        print(f"❌ Error saving merged data: {e}")

if __name__ == "__main__":
    merge_data()
