#!/usr/bin/env python3
"""
Extract professor names from course data and create names.csv for RMP scraping.
"""

import json
import csv
import re
import sys
from pathlib import Path

def clean_professor_name(name):
    """Clean and normalize professor names."""
    if not name or name.lower() in ['staff', 'tba', 'to be announced', '']:
        return None
        
    # Remove common prefixes and suffixes
    name = re.sub(r'^(prof\.?|professor|dr\.?|doctor)\s+', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+(ph\.?d\.?|m\.?d\.?|jr\.?|sr\.?)$', '', name, flags=re.IGNORECASE)
    
    # Remove extra whitespace
    name = ' '.join(name.split())
    
    # Skip if too short or contains numbers
    if len(name) < 3 or any(char.isdigit() for char in name):
        return None
        
    return name.title()

def extract_professors_from_courses():
    """Extract all professor names from course data files."""
    data_dir = Path(__file__).parent.parent.parent / "course_scraper" / "data"
    course_files = [
        data_dir / "all_courses_spring_summer_2025.json",
        data_dir / "all_courses_winter_2026.json",
        data_dir / "all_courses_spring_summer_2026.json",
        data_dir / "all_courses_fall_2026.json",
        data_dir / "all_courses_winter_2027.json",
    ]
    
    professors = set()
    
    for course_file in course_files:
        if not course_file.exists():
            print(f"Warning: Course file not found: {course_file}")
            continue
            
        print(f"Processing: {course_file.name}")
        
        try:
            with open(course_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            courses = data.get('courses', [])
            file_professors = set()
            
            for course in courses:
                section_groups = course.get('sectionGroups', {})
                
                for group_id, group in section_groups.items():
                    # Extract from lecture
                    if group.get('lecture') and group['lecture'].get('instructor'):
                        name = clean_professor_name(group['lecture']['instructor'])
                        if name:
                            professors.add(name)
                            file_professors.add(name)
                    
                    # Extract from labs
                    for lab in group.get('labs', []):
                        if lab.get('instructor'):
                            name = clean_professor_name(lab['instructor'])
                            if name:
                                professors.add(name)
                                file_professors.add(name)
                    
                    # Extract from tutorials
                    for tutorial in group.get('tutorials', []):
                        if tutorial.get('instructor'):
                            name = clean_professor_name(tutorial['instructor'])
                            if name:
                                professors.add(name)
                                file_professors.add(name)
            
            print(f"  Found {len(file_professors)} unique professors")
            
        except Exception as e:
            print(f"Error processing {course_file}: {e}")
    
    return professors

def get_existing_rmp_professors():
    """Get professors who already have RMP data."""
    rmp_file = Path(__file__).parent.parent / "professors_rmp_data.json"

    existing_professors = set()

    if rmp_file.exists():
        try:
            with open(rmp_file, 'r', encoding='utf-8') as f:
                rmp_data = json.load(f)

            for name in rmp_data.keys():
                if name:
                    existing_professors.add(name.lower())

            print(f"Found {len(existing_professors)} professors with existing RMP data")
            
        except Exception as e:
            print(f"Error reading RMP data: {e}")
    else:
        print("No existing RMP data found")
    
    return existing_professors

def main():
    include_all = '--all' in sys.argv
    print("Extracting professor names for RMP scraping...")

    # Extract all professors from course data
    all_professors = extract_professors_from_courses()
    print(f"Total professors found in courses: {len(all_professors)}")

    if include_all:
        # Full refresh: scrape everyone (ratings change over time)
        professors_without_rmp = sorted(all_professors)
        print(f"--all: including every professor ({len(professors_without_rmp)})")
    else:
        # Get professors who already have RMP data
        existing_rmp = get_existing_rmp_professors()

        # Find professors without RMP data
        professors_without_rmp = []
        for prof in sorted(all_professors):
            if prof.lower() not in existing_rmp:
                professors_without_rmp.append(prof)

        print(f"Professors without RMP data: {len(professors_without_rmp)}")
    
    # Save to names.csv
    output_file = Path(__file__).parent.parent / "names.csv"
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Name'])  # Header
        for name in professors_without_rmp:
            writer.writerow([name])
    
    print(f"Saved {len(professors_without_rmp)} professor names to: {output_file}")
    
    # Also create a readable text file
    text_file = output_file.with_suffix('.txt')
    with open(text_file, 'w', encoding='utf-8') as f:
        f.write(f"# Professors without RMP data ({len(professors_without_rmp)} total)\n")
        f.write(f"# Generated from course data\n\n")
        for name in professors_without_rmp:
            f.write(f"{name}\n")
    
    print(f"Also saved readable list to: {text_file}")

if __name__ == "__main__":
    main()