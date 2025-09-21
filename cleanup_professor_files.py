#!/usr/bin/env python3
"""
Clean up professor files and keep only the essential ones
"""

import os
import json
from datetime import datetime

def cleanup_professor_files():
    """Clean up unnecessary professor files and keep only essential ones"""
    
    frontend_public = 'frontend/public'
    
    print("🧹 Cleaning up professor files...")
    
    # Files to KEEP (essential ones)
    essential_files = {
        'professors_enhanced.json': 'Main database (old + new combined)',
        'unmatched_professors_structured.json': 'Professors needing manual entry',
        'unmatched_professors_manual_entry.csv': 'CSV for manual editing',
        'professor_comments.json': 'Individual student reviews',
        'professor_tags_analysis.json': 'Rating tags analysis',
        'rmp_data_summary.json': 'Summary statistics'
    }
    
    # Files to DELETE (unnecessary backups and intermediates)
    files_to_delete = [
        'professors_enhanced_backup.json',           # Backup before RMP integration
        'professors_enhanced_before_unmatched.json', # Backup before adding unmatched
        'professors_rmp_update.json',                # Intermediate update file
        'rmp_api_info.json',                         # API documentation (can regenerate)
        'rmp_integration_guide.json',                # Integration guide (can regenerate)
        'rmp_frontend_helpers.json',                 # Helper functions (can regenerate)
        'deployment_summary.json'                    # Deployment summary (can regenerate)
    ]
    
    print(f"\n📋 Files to KEEP:")
    for filename, description in essential_files.items():
        filepath = os.path.join(frontend_public, filename)
        if os.path.exists(filepath):
            size = os.path.getsize(filepath)
            print(f"   ✅ {filename} - {description} ({size:,} bytes)")
        else:
            print(f"   ⚠️  {filename} - {description} (MISSING!)")
    
    print(f"\n🗑️  Files to DELETE:")
    deleted_count = 0
    total_size_freed = 0
    
    for filename in files_to_delete:
        filepath = os.path.join(frontend_public, filename)
        if os.path.exists(filepath):
            size = os.path.getsize(filepath)
            total_size_freed += size
            os.remove(filepath)
            print(f"   🗑️  Deleted {filename} ({size:,} bytes)")
            deleted_count += 1
        else:
            print(f"   ➖ {filename} (already missing)")
    
    print(f"\n📊 Cleanup Summary:")
    print(f"   🗑️  Files deleted: {deleted_count}")
    print(f"   💾 Space freed: {total_size_freed:,} bytes ({total_size_freed/1024/1024:.1f} MB)")
    print(f"   ✅ Essential files preserved: {len(essential_files)}")
    
    # Update cache-bust to reflect cleanup
    cache_bust_path = os.path.join(frontend_public, 'cache-bust.json')
    try:
        if os.path.exists(cache_bust_path):
            with open(cache_bust_path, 'r') as f:
                cache_data = json.load(f)
        else:
            cache_data = {}
        
        timestamp = datetime.now().isoformat()
        cache_data.update({
            'file_cleanup': timestamp,
            'professors_enhanced': timestamp
        })
        
        with open(cache_bust_path, 'w') as f:
            json.dump(cache_data, f, indent=2)
        
        print(f"   🔄 Updated cache-bust.json")
        
    except Exception as e:
        print(f"   ⚠️  Could not update cache-bust: {e}")

def verify_essential_data():
    """Verify that essential files contain the expected data"""
    
    frontend_public = 'frontend/public'
    
    print(f"\n🔍 Verifying essential data...")
    
    # Check main professors file
    main_file = os.path.join(frontend_public, 'professors_enhanced.json')
    if os.path.exists(main_file):
        with open(main_file, 'r') as f:
            professors = json.load(f)
        
        with_rmp = len([p for p in professors if p.get('has_rmp_data', False) and p.get('rmp_rating', 'N/A') != 'N/A'])
        without_rmp = len([p for p in professors if not p.get('has_rmp_data', False) or p.get('rmp_rating', 'N/A') == 'N/A'])
        
        print(f"   📊 Main database: {len(professors)} total professors")
        print(f"      ✅ With RMP data: {with_rmp}")
        print(f"      ❌ Without RMP data: {without_rmp}")
    
    # Check unmatched file
    unmatched_file = os.path.join(frontend_public, 'unmatched_professors_structured.json')
    if os.path.exists(unmatched_file):
        with open(unmatched_file, 'r') as f:
            unmatched_data = json.load(f)
        
        print(f"   📋 Unmatched professors: {unmatched_data.get('total_unmatched', 0)}")
    
    # Check comments file
    comments_file = os.path.join(frontend_public, 'professor_comments.json')
    if os.path.exists(comments_file):
        with open(comments_file, 'r') as f:
            comments = json.load(f)
        
        print(f"   💬 Individual reviews: {len(comments)}")
    
    print(f"   ✅ All essential data verified!")

def main():
    print("🧹 Professor Files Cleanup Script")
    print("=" * 50)
    
    cleanup_professor_files()
    verify_essential_data()
    
    print(f"\n🎉 Cleanup complete!")
    print(f"📁 Your frontend/public/ folder is now clean and organized")
    print(f"🚀 Only essential RMP files remain for production")

if __name__ == "__main__":
    main()
