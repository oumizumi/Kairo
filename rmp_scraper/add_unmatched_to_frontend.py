#!/usr/bin/env python3
"""
Add unmatched professors to main frontend database with N/A values
"""

import json
from datetime import datetime

def add_unmatched_to_main_database():
    """Add unmatched professors to the main database with N/A values"""
    
    # Load main database
    with open('../frontend/public/professors_enhanced.json', 'r') as f:
        main_profs = json.load(f)
    
    # Load unmatched professors
    with open('../frontend/public/unmatched_professors_structured.json', 'r') as f:
        unmatched_data = json.load(f)
    
    print(f"📊 Current main database: {len(main_profs)} professors")
    print(f"➕ Adding unmatched professors: {unmatched_data['total_unmatched']}")
    
    # Add each unmatched professor to main database with N/A values
    added_count = 0
    for unmatched_prof in unmatched_data['professors_needing_manual_entry']:
        # Create professor entry with N/A values for missing RMP data
        prof_entry = {
            'name': unmatched_prof['name'],
            'title': unmatched_prof.get('title', ''),
            'department': unmatched_prof.get('department', ''),
            'email': unmatched_prof.get('email'),
            'bio': unmatched_prof.get('bio', ''),
            'rmp_id': 'N/A',  # Show N/A instead of empty
            'rmp_rating': 'N/A',  # Show N/A instead of empty
            'rmp_difficulty': 'N/A',  # Show N/A instead of empty
            'rmp_would_take_again': 'N/A',  # Show N/A instead of empty
            'rmp_department': 'N/A',  # Show N/A instead of empty
            'rmp_review_count': 0,
            'has_rmp_data': False,
            'needs_manual_entry': True  # Flag for frontend to show "Add RMP Data" button
        }
        
        main_profs.append(prof_entry)
        added_count += 1
    
    print(f"✅ Added {added_count} professors with N/A RMP values")
    print(f"📈 New total: {len(main_profs)} professors")
    
    # Create backup
    import shutil
    shutil.copy('../frontend/public/professors_enhanced.json', 
                '../frontend/public/professors_enhanced_before_unmatched.json')
    print("🔒 Created backup: professors_enhanced_before_unmatched.json")
    
    # Save updated database
    with open('../frontend/public/professors_enhanced.json', 'w') as f:
        json.dump(main_profs, f, indent=2, ensure_ascii=False)
    
    print("💾 Updated main database with unmatched professors")
    
    # Update cache-bust
    cache_bust_path = '../frontend/public/cache-bust.json'
    try:
        with open(cache_bust_path, 'r') as f:
            cache_data = json.load(f)
        
        timestamp = datetime.now().isoformat()
        cache_data['professors_enhanced'] = timestamp
        cache_data['unmatched_professors_added'] = timestamp
        
        with open(cache_bust_path, 'w') as f:
            json.dump(cache_data, f, indent=2)
        
        print(f"🔄 Updated cache-bust.json")
        
    except Exception as e:
        print(f"⚠️  Could not update cache-bust: {e}")
    
    return len(main_profs), added_count

def create_frontend_helper():
    """Create helper functions for frontend to handle N/A values"""
    
    helper_functions = {
        'title': 'Frontend Helper Functions for RMP Data',
        'description': 'Helper functions to handle professors with and without RMP data',
        'functions': {
            'hasRMPData': '''
// Check if professor has real RMP data
function hasRMPData(professor) {
    return professor.has_rmp_data === true && 
           professor.rmp_rating !== 'N/A' && 
           professor.rmp_rating !== '';
}''',
            'getRMPRating': '''
// Get RMP rating with fallback
function getRMPRating(professor) {
    if (hasRMPData(professor)) {
        return parseFloat(professor.rmp_rating);
    }
    return null; // or return 'N/A' for display
}''',
            'getRMPDifficulty': '''
// Get RMP difficulty with fallback  
function getRMPDifficulty(professor) {
    if (hasRMPData(professor)) {
        return parseFloat(professor.rmp_difficulty);
    }
    return null; // or return 'N/A' for display
}''',
            'shouldShowAddRMPButton': '''
// Check if should show "Add RMP Data" button
function shouldShowAddRMPButton(professor) {
    return professor.needs_manual_entry === true || 
           professor.rmp_rating === 'N/A';
}''',
            'formatRMPDisplay': '''
// Format RMP data for display
function formatRMPDisplay(professor) {
    if (!hasRMPData(professor)) {
        return {
            rating: 'No rating available',
            difficulty: 'No difficulty data',
            showAddButton: true
        };
    }
    
    return {
        rating: `${professor.rmp_rating}/5.0`,
        difficulty: `${professor.rmp_difficulty}/5.0`,
        showAddButton: false
    };
}''',
            'filterProfessorsWithRMP': '''
// Filter professors that have RMP data
function filterProfessorsWithRMP(professors) {
    return professors.filter(prof => hasRMPData(prof));
}''',
            'filterProfessorsNeedingRMP': '''
// Filter professors that need RMP data
function filterProfessorsNeedingRMP(professors) {
    return professors.filter(prof => !hasRMPData(prof));
}'''
        },
        'usage_examples': {
            'react_component': '''
// Example React component
function ProfessorCard({ professor }) {
    const rmpDisplay = formatRMPDisplay(professor);
    
    return (
        <div className="professor-card">
            <h3>{professor.name}</h3>
            <div>Department: {professor.department}</div>
            
            <div className="rmp-section">
                <div>Rating: {rmpDisplay.rating}</div>
                <div>Difficulty: {rmpDisplay.difficulty}</div>
                
                {rmpDisplay.showAddButton && (
                    <button onClick={() => handleAddRMP(professor)}>
                        Add RMP Data
                    </button>
                )}
            </div>
        </div>
    );
}''',
            'search_with_rmp_filter': '''
// Search with RMP filter option
function searchProfessors(query, onlyWithRMP = false) {
    return fetch('/professors_enhanced.json')
        .then(r => r.json())
        .then(professors => {
            let filtered = professors.filter(prof => 
                prof.name.toLowerCase().includes(query.toLowerCase())
            );
            
            if (onlyWithRMP) {
                filtered = filterProfessorsWithRMP(filtered);
            }
            
            return filtered;
        });
}'''
        }
    }
    
    with open('../frontend/public/rmp_frontend_helpers.json', 'w') as f:
        json.dump(helper_functions, f, indent=2)
    
    print("🛠️  Created frontend helper functions: rmp_frontend_helpers.json")

def main():
    print("🔄 Adding unmatched professors to frontend database...")
    
    total_profs, added_count = add_unmatched_to_main_database()
    create_frontend_helper()
    
    print(f"\n🎉 SUCCESS!")
    print(f"📊 Your frontend now has {total_profs} total professors:")
    print(f"   ✅ {total_profs - added_count} with RMP data")
    print(f"   ➕ {added_count} with 'N/A' values (ready for manual entry)")
    
    print(f"\n🎯 Frontend Benefits:")
    print(f"   • All professors now appear in search/browse")
    print(f"   • 'N/A' values clearly show missing RMP data") 
    print(f"   • 'needs_manual_entry' flag for 'Add RMP Data' buttons")
    print(f"   • Helper functions created for easy integration")
    
    print(f"\n📁 Files updated:")
    print(f"   • professors_enhanced.json (main database)")
    print(f"   • cache-bust.json (force refresh)")
    print(f"   • rmp_frontend_helpers.json (helper functions)")
    print(f"   • professors_enhanced_before_unmatched.json (backup)")

if __name__ == "__main__":
    main()
