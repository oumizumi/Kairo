# Course Description Service for University of Ottawa courses
# This service provides official course descriptions from the uOttawa course catalog

import json
import os
from pathlib import Path

class CourseDescriptionService:
    """Service to manage course descriptions from scraped University of Ottawa course data"""
    
    _course_data = None  # Cache for loaded course data
    
    @classmethod
    def _load_course_data(cls):
        """Load course data from the scrapers JSON file"""
        if cls._course_data is not None:
            return cls._course_data
        
        try:
            # Try multiple possible paths for the course data file - PRIORITIZES LATEST SCRAPED DATA
            possible_paths = [
                # Path 1: LATEST SCRAPED DATA (highest priority)
                Path(__file__).parent.parent.parent.parent / "scrapers" / "data" / "all_courses_complete.json",
                # Path 2: Backend API data location (synced from scrapers)
                Path(__file__).parent.parent / "data" / "all_courses_complete.json",
                # Path 3: Frontend public data (synced from scrapers)
                Path(__file__).parent.parent.parent.parent / "frontend" / "public" / "all_courses_complete.json",
                # Path 4: Root level data
                Path(__file__).parent.parent.parent.parent / "all_courses_complete.json",
                # Path 5: Current directory
                Path("all_courses_complete.json"),
                # Path 6: Absolute common paths on Render
                Path("/app/scrapers/data/all_courses_complete.json"),
                Path("/app/backend/api/data/all_courses_complete.json"),
                Path("/app/all_courses_complete.json")
            ]
            
            data = {}
            file_found = False
            
            for json_file_path in possible_paths:
                try:
                    if json_file_path.exists():
                        print(f"✅ Found course data at: {json_file_path}")
                        with open(json_file_path, 'r', encoding='utf-8') as file:
                            content = file.read().strip()
                            if content and content.startswith('{'):
                                data = json.load(open(json_file_path, 'r', encoding='utf-8'))
                                file_found = True
                                break
                            else:
                                print(f"❌ File exists but content is invalid: {content[:100]}...")
                    else:
                        print(f"❌ Path does not exist: {json_file_path}")
                except Exception as e:
                    print(f"❌ Error reading {json_file_path}: {e}")
                    continue
            
            if not file_found:
                print("❌ No valid course data file found, using hardcoded sample data")
                # Hardcoded sample data for ITI courses as fallback
                data = {
                    "ITI": [
                        {
                            "courseCode": "ITI1120",
                            "courseTitle": "Introduction to Computing I",
                            "units": "3",
                            "description": "Introduction to computing and programming using Python. Covers basic programming concepts, data structures, and problem-solving techniques.",
                            "prerequisites": ""
                        },
                        {
                            "courseCode": "ITI1121",
                            "courseTitle": "Introduction to Computing II", 
                            "units": "3",
                            "description": "Continuation of ITI1120. Object-oriented programming, advanced data structures, and algorithm design.",
                            "prerequisites": "ITI1120"
                        }
                    ]
                }
            
            # Flatten the data and store with multiple key formats
            cls._course_data = {}
            
            for subject, courses in data.items():
                for course in courses:
                    if 'courseCode' in course:
                        original_code = course['courseCode'].strip().upper()
                        # Store course info
                        course_info = {
                            'courseCode': original_code,
                            'courseTitle': course.get('courseTitle', ''),
                            'units': course.get('units', '3'),
                            'description': course.get('description', ''),
                            'prerequisites': course.get('prerequisites', ''),
                            'subject': subject
                        }
                        
                        # Store under multiple formats for easy lookup
                        search_formats = [
                            original_code,  # ITI1120
                            original_code.replace(' ', ''),  # ITI1120 (no space)
                            cls._normalize_course_code(original_code),  # ITI 1120 (with space)
                            original_code.lower(),  # iti1120
                            original_code.lower().replace(' ', '')  # iti1120
                        ]
                        
                        for format_key in search_formats:
                            if format_key:
                                cls._course_data[format_key] = course_info
            
            print(f"✅ Loaded course data: {len(data)} subjects, {len(cls._course_data)} total entries")
            return cls._course_data
            
        except Exception as e:
            print(f"❌ Fatal error loading course data: {e}")
            # Return minimal hardcoded data as absolute fallback
            cls._course_data = {
                "ITI1120": {
                    'courseCode': "ITI1120",
                    'courseTitle': "Introduction to Computing I",
                    'units': "3", 
                    'description': "Introduction to computing and programming using Python.",
                    'prerequisites': "",
                    'subject': "ITI"
                }
            }
            return cls._course_data
    
    @classmethod
    def get_course_description(cls, course_code):
        """
        Get the course description for a given course code.
        
        Args:
            course_code (str): Course code like "ITI 1100" or "ITI1100"
            
        Returns:
            str: Course description or None if not found
        """
        data = cls._load_course_data()
        normalized_code = cls._normalize_course_code(course_code)
        course_info = data.get(normalized_code)
        
        if course_info and course_info.get('description'):
            return course_info['description']
        return None
    
    @classmethod
    def get_course_prerequisites(cls, course_code):
        """
        Get the prerequisites for a given course code.
        
        Args:
            course_code (str): Course code like "ITI 1100" or "ITI1100"
            
        Returns:
            str: Prerequisites string or None if not found
        """
        data = cls._load_course_data()
        normalized_code = cls._normalize_course_code(course_code)
        course_info = data.get(normalized_code)
        
        if course_info:
            prereqs = course_info.get('prerequisites', '').strip()
            return prereqs if prereqs else None
        return None
    
    @classmethod
    def get_course_credits(cls, course_code):
        """
        Get the number of credits for a given course code.
        
        Args:
            course_code (str): Course code like "ITI 1100" or "ITI1100"
            
        Returns:
            int: Number of credits or 3 as default
        """
        data = cls._load_course_data()
        normalized_code = cls._normalize_course_code(course_code)
        course_info = data.get(normalized_code)
        
        if course_info:
            units = course_info.get('units', '3')
            try:
                return int(units) if units and units.isdigit() else 3
            except:
                return 3
        return 3
    
    @classmethod
    def get_enhanced_course_info(cls, course_code):
        """
        Get comprehensive course information including description, prerequisites, and credits.
        
        Args:
            course_code (str): Course code like "ITI 1100" or "ITI1100"
            
        Returns:
            dict: Complete course information
        """
        data = cls._load_course_data()
        
        # Try multiple formats to find the course
        search_codes = [
            course_code.upper(),  # Original format
            cls._normalize_course_code(course_code),  # Normalized format with space
            course_code.replace(' ', '').upper(),  # Remove spaces
            course_code.replace('-', '').replace('_', '').upper()  # Remove separators
        ]
        
        course_info = None
        for search_code in search_codes:
            if search_code in data:
                course_info = data[search_code]
                print(f"🔍 Found course {course_code} using format: {search_code}")
                break
        
        if course_info:
            return {
                'courseCode': course_info.get('courseCode'),  # Use stored normalized format
                'courseTitle': course_info.get('courseTitle', ''),
                'description': course_info.get('description', ''),
                'prerequisites': course_info.get('prerequisites', ''),
                'credits': cls.get_course_credits(course_code),
                'units': course_info.get('units', '3'),
                'subject': course_info.get('subject', ''),
                'hasOfficialDescription': bool(course_info.get('description', '').strip())
            }
        else:
            print(f"❌ Course {course_code} not found. Tried formats: {search_codes}")
            return {
                'courseCode': cls._normalize_course_code(course_code),
                'courseTitle': '',
                'description': '',
                'prerequisites': '',
                'credits': 3,
                'units': '3',
                'subject': '',
                'hasOfficialDescription': False
            }
    
    @classmethod
    def _normalize_course_code(cls, course_code):
        """
        Normalize course code to standard format with space.
        
        Args:
            course_code (str): Course code in any format
            
        Returns:
            str: Normalized course code like "ITI 1100"
        """
        if not course_code:
            return ""
        
        # Remove extra spaces and convert to uppercase
        code = course_code.strip().upper()
        
        # Handle different formats: "ITI1100", "ITI 1100", "iti1100", etc.
        import re
        match = re.match(r'^([A-Z]{2,4})(\s*)(\d{3,4})$', code)
        if match:
            subject = match.group(1)
            number = match.group(3)
            return f"{subject} {number}"
        
        return code
    
    @classmethod
    def search_courses_by_keyword(cls, keyword):
        """
        Search for courses by keyword in descriptions or titles.
        
        Args:
            keyword (str): Keyword to search for
            
        Returns:
            list: List of course codes that match the keyword
        """
        data = cls._load_course_data()
        keyword_lower = keyword.lower()
        matching_courses = []
        
        for course_code, course_info in data.items():
            description = course_info.get('description', '').lower()
            title = course_info.get('courseTitle', '').lower()
            
            if keyword_lower in description or keyword_lower in title:
                matching_courses.append(course_code)
                
        return matching_courses
    
    @classmethod
    def get_courses_by_subject(cls, subject_code):
        """
        Get all courses for a specific subject.
        
        Args:
            subject_code (str): Subject code like "ITI", "CSI", etc.
            
        Returns:
            list: List of course information dictionaries
        """
        data = cls._load_course_data()
        subject_code_upper = subject_code.upper()
        subject_courses = []
        
        for course_code, course_info in data.items():
            if course_info.get('subject', '').upper() == subject_code_upper:
                subject_courses.append(course_info)
        
        # Sort by course number
        subject_courses.sort(key=lambda x: x.get('courseCode', ''))
        return subject_courses
    
    @classmethod
    def get_all_available_courses(cls):
        """
        Get all course codes that have data available.
        
        Returns:
            list: List of all available course codes
        """
        data = cls._load_course_data()
        return list(data.keys())
    
    @classmethod
    def get_course_count(cls):
        """
        Get the total number of courses available.
        
        Returns:
            int: Total number of courses
        """
        data = cls._load_course_data()
        return len(data)
    
    @classmethod
    def reload_data(cls):
        """
        Force reload of course data from JSON file.
        """
        cls._course_data = None
        return cls._load_course_data()
    
    @classmethod
    def clear_cache(cls):
        """
        Clear the cached course data to force a fresh reload.
        """
        cls._course_data = None
        print("🔄 Course data cache cleared - next request will reload from scraped data") 