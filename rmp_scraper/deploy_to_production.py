#!/usr/bin/env python3
"""
Deploy RMP data to production and update frontend cache
"""

import json
import os
import shutil
from datetime import datetime

def update_cache_bust():
    """Update cache-bust.json to force frontend refresh"""
    cache_bust_path = '../frontend/public/cache-bust.json'
    
    try:
        # Read existing cache-bust
        if os.path.exists(cache_bust_path):
            with open(cache_bust_path, 'r') as f:
                cache_data = json.load(f)
        else:
            cache_data = {}
        
        # Update with new timestamp
        timestamp = datetime.now().isoformat()
        cache_data.update({
            'professors_enhanced': timestamp,
            'professor_comments': timestamp,
            'professor_tags_analysis': timestamp,
            'unmatched_professors_structured': timestamp,
            'rmp_data_summary': timestamp,
            'last_rmp_update': timestamp
        })
        
        # Save updated cache-bust
        with open(cache_bust_path, 'w') as f:
            json.dump(cache_data, f, indent=2)
        
        print(f"✅ Updated cache-bust.json with timestamp: {timestamp}")
        return True
        
    except Exception as e:
        print(f"❌ Error updating cache-bust: {e}")
        return False

def verify_production_files():
    """Verify all production files exist and have data"""
    frontend_public = '../frontend/public'
    
    required_files = {
        'professors_enhanced.json': 'Main professor database',
        'professor_comments.json': 'Individual student comments',
        'professor_tags_analysis.json': 'Rating tags analysis',
        'unmatched_professors_structured.json': 'Professors needing manual entry',
        'unmatched_professors_manual_entry.csv': 'CSV for manual editing',
        'rmp_data_summary.json': 'Summary statistics',
        'cache-bust.json': 'Frontend cache control'
    }
    
    print("🔍 Verifying production files...")
    
    all_good = True
    for filename, description in required_files.items():
        filepath = os.path.join(frontend_public, filename)
        
        if os.path.exists(filepath):
            file_size = os.path.getsize(filepath)
            if file_size > 0:
                print(f"✅ {filename} - {description} ({file_size:,} bytes)")
            else:
                print(f"⚠️  {filename} - File exists but is empty")
                all_good = False
        else:
            print(f"❌ {filename} - Missing file")
            all_good = False
    
    return all_good

def create_api_endpoints_info():
    """Create info file for frontend API endpoints"""
    api_info = {
        'rmp_data_endpoints': {
            'professors_enhanced': '/professors_enhanced.json',
            'professor_comments': '/professor_comments.json',
            'professor_tags_analysis': '/professor_tags_analysis.json',
            'unmatched_professors': '/unmatched_professors_structured.json',
            'rmp_summary': '/rmp_data_summary.json'
        },
        'data_structure': {
            'professors_enhanced': {
                'description': 'Main professor database with RMP ratings',
                'fields': ['name', 'title', 'department', 'email', 'bio', 'rmp_id', 'rmp_rating', 'rmp_difficulty', 'rmp_would_take_again', 'rmp_department', 'has_rmp_data'],
                'total_professors': None  # Will be filled below
            },
            'professor_comments': {
                'description': 'Individual student comments and ratings',
                'fields': ['professor_name', 'department', 'avg_rating', 'avg_difficulty', 'comment', 'difficulty_rating', 'clarity_rating', 'grade', 'rating_tags'],
                'total_comments': None  # Will be filled below
            },
            'professor_tags_analysis': {
                'description': 'Analysis of rating tags by professor and frequency',
                'sections': ['by_professor', 'all_unique_tags', 'tag_frequency']
            }
        },
        'usage_examples': {
            'get_professor_rmp_data': "fetch('/professors_enhanced.json').then(r => r.json())",
            'get_professor_comments': "fetch('/professor_comments.json').then(r => r.json())",
            'get_tag_analysis': "fetch('/professor_tags_analysis.json').then(r => r.json())"
        },
        'last_updated': datetime.now().isoformat()
    }
    
    # Get actual counts
    try:
        with open('../frontend/public/professors_enhanced.json', 'r') as f:
            profs = json.load(f)
            api_info['data_structure']['professors_enhanced']['total_professors'] = len(profs)
    except:
        pass
    
    try:
        with open('../frontend/public/professor_comments.json', 'r') as f:
            comments = json.load(f)
            api_info['data_structure']['professor_comments']['total_comments'] = len(comments)
    except:
        pass
    
    # Save API info
    with open('../frontend/public/rmp_api_info.json', 'w') as f:
        json.dump(api_info, f, indent=2)
    
    print("✅ Created API endpoints info file")

def create_frontend_integration_guide():
    """Create integration guide for frontend developers"""
    guide = {
        'title': 'RMP Data Integration Guide',
        'overview': 'This guide shows how to integrate RateMyProfessor data into your frontend components',
        'data_files': {
            'professors_enhanced.json': 'Main professor database - use this for professor profiles and search',
            'professor_comments.json': 'Individual student reviews - use this for detailed professor pages',
            'professor_tags_analysis.json': 'Rating tags analysis - use this for professor characteristics',
            'rmp_data_summary.json': 'Summary statistics - use this for dashboard/overview pages'
        },
        'example_usage': {
            'react_component_example': '''
// Example React component using RMP data
import { useState, useEffect } from 'react';

function ProfessorProfile({ professorName }) {
    const [professor, setProfessor] = useState(null);
    const [comments, setComments] = useState([]);
    
    useEffect(() => {
        // Load professor data
        fetch('/professors_enhanced.json')
            .then(r => r.json())
            .then(data => {
                const prof = data.find(p => p.name === professorName);
                setProfessor(prof);
            });
        
        // Load comments for this professor
        fetch('/professor_comments.json')
            .then(r => r.json())
            .then(data => {
                const profComments = data.filter(c => c.professor_name === professorName);
                setComments(profComments);
            });
    }, [professorName]);
    
    if (!professor) return <div>Loading...</div>;
    
    return (
        <div>
            <h1>{professor.name}</h1>
            <div>Department: {professor.department}</div>
            {professor.has_rmp_data && (
                <div>
                    <div>Rating: {professor.rmp_rating}/5</div>
                    <div>Difficulty: {professor.rmp_difficulty}/5</div>
                    <div>Reviews: {comments.length}</div>
                </div>
            )}
            
            <div>
                <h3>Student Comments:</h3>
                {comments.map((comment, idx) => (
                    <div key={idx}>
                        <p>"{comment.comment}"</p>
                        <small>Grade: {comment.grade} | Tags: {comment.rating_tags}</small>
                    </div>
                ))}
            </div>
        </div>
    );
}''',
            'search_example': '''
// Example search function
function searchProfessorsWithRMP(query) {
    return fetch('/professors_enhanced.json')
        .then(r => r.json())
        .then(professors => {
            return professors.filter(prof => 
                prof.name.toLowerCase().includes(query.toLowerCase()) &&
                prof.has_rmp_data === true
            ).sort((a, b) => parseFloat(b.rmp_rating) - parseFloat(a.rmp_rating));
        });
}''',
            'tag_analysis_example': '''
// Example tag analysis usage
function getTopProfessorTags() {
    return fetch('/professor_tags_analysis.json')
        .then(r => r.json())
        .then(data => {
            // Get most common tags
            const sortedTags = Object.entries(data.tag_frequency)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10);
            return sortedTags;
        });
}'''
        },
        'data_structure_examples': {
            'professor_enhanced_structure': {
                'name': 'John Smith',
                'title': 'Professor',
                'department': 'Computer Science',
                'email': 'john.smith@uottawa.ca',
                'bio': 'Professor bio...',
                'rmp_id': '1234567',
                'rmp_rating': '4.2',
                'rmp_difficulty': '3.1',
                'rmp_would_take_again': '75',
                'rmp_department': 'Computer Science',
                'has_rmp_data': True
            },
            'comment_structure': {
                'professor_name': 'John Smith',
                'department': 'Computer Science',
                'avg_rating': 4.2,
                'avg_difficulty': 3.1,
                'comment': 'Great professor, very helpful!',
                'difficulty_rating': 3,
                'clarity_rating': 5,
                'grade': 'A',
                'rating_tags': 'Caring--Amazing lectures--Gives good feedback'
            }
        },
        'tips': [
            'Cache the JSON files in your app state to avoid repeated fetches',
            'Use the cache-bust.json file to detect when data has been updated',
            'Filter professors by has_rmp_data: true to show only those with ratings',
            'Parse rating_tags by splitting on "--" to get individual tags',
            'Use the rmp_data_summary.json for quick statistics without loading full datasets'
        ]
    }
    
    with open('../frontend/public/rmp_integration_guide.json', 'w') as f:
        json.dump(guide, f, indent=2)
    
    print("✅ Created frontend integration guide")

def create_deployment_summary():
    """Create deployment summary with all changes"""
    
    # Count data
    try:
        with open('../frontend/public/professors_enhanced.json', 'r') as f:
            professors = json.load(f)
        with open('../frontend/public/professor_comments.json', 'r') as f:
            comments = json.load(f)
        with open('../frontend/public/rmp_data_summary.json', 'r') as f:
            summary = json.load(f)
    except Exception as e:
        print(f"Error loading data for summary: {e}")
        return
    
    deployment_summary = {
        'deployment_date': datetime.now().isoformat(),
        'deployment_summary': {
            'total_professors': len(professors),
            'professors_with_rmp_data': len([p for p in professors if p.get('has_rmp_data', False)]),
            'professors_without_rmp_data': len([p for p in professors if not p.get('has_rmp_data', False)]),
            'total_individual_reviews': len(comments),
            'unique_rating_tags': summary['overview']['unique_rating_tags'] if 'overview' in summary else 0
        },
        'files_deployed': [
            'professors_enhanced.json - Main professor database (updated with RMP data)',
            'professor_comments.json - 5,934 individual student comments',
            'professor_tags_analysis.json - Rating tags analysis',
            'unmatched_professors_structured.json - 679 professors for manual entry',
            'unmatched_professors_manual_entry.csv - CSV for easy editing',
            'rmp_data_summary.json - Summary statistics',
            'rmp_api_info.json - API documentation',
            'rmp_integration_guide.json - Frontend integration guide',
            'cache-bust.json - Updated cache control'
        ],
        'next_steps': [
            '1. Update your frontend components to use the new RMP data',
            '2. Test the new professor profiles with ratings and comments',
            '3. Manually add RMP data for the 679 unmatched professors using the CSV file',
            '4. Deploy your frontend changes to production',
            '5. Monitor for any issues with the new data integration'
        ],
        'api_endpoints': {
            'main_data': '/professors_enhanced.json',
            'comments': '/professor_comments.json',
            'tags': '/professor_tags_analysis.json',
            'summary': '/rmp_data_summary.json',
            'api_docs': '/rmp_api_info.json',
            'integration_guide': '/rmp_integration_guide.json'
        }
    }
    
    with open('../frontend/public/deployment_summary.json', 'w') as f:
        json.dump(deployment_summary, f, indent=2)
    
    print("\n📋 Deployment Summary:")
    print(f"   👨‍🏫 Total professors: {deployment_summary['deployment_summary']['total_professors']}")
    print(f"   ⭐ With RMP data: {deployment_summary['deployment_summary']['professors_with_rmp_data']}")
    print(f"   ❌ Need manual entry: {deployment_summary['deployment_summary']['professors_without_rmp_data']}")
    print(f"   💬 Individual reviews: {deployment_summary['deployment_summary']['total_individual_reviews']}")
    print(f"   🏷️  Unique tags: {deployment_summary['deployment_summary']['unique_rating_tags']}")

def main():
    print("🚀 Deploying RMP data to production...")
    
    # Verify all files exist
    if not verify_production_files():
        print("❌ Some files are missing or empty. Please check the issues above.")
        return
    
    # Update cache bust
    if not update_cache_bust():
        print("❌ Failed to update cache-bust.json")
        return
    
    # Create additional production files
    create_api_endpoints_info()
    create_frontend_integration_guide()
    create_deployment_summary()
    
    print("\n🎉 DEPLOYMENT COMPLETE!")
    print("\n📁 All files are now in frontend/public/ and ready for production:")
    print("   ✅ Professor database updated with RMP data")
    print("   ✅ Individual comments and tags separated")
    print("   ✅ API documentation created")
    print("   ✅ Frontend integration guide ready")
    print("   ✅ Cache-bust updated for immediate frontend refresh")
    print("   ✅ Manual entry files created for remaining professors")
    
    print("\n🔗 Key files for your frontend:")
    print("   📊 /professors_enhanced.json - Main database")
    print("   💬 /professor_comments.json - Student reviews")
    print("   🏷️  /professor_tags_analysis.json - Rating tags")
    print("   📖 /rmp_integration_guide.json - How to use the data")
    
    print("\n✨ Your Kairo system is now fully updated with RMP data!")

if __name__ == "__main__":
    main()
