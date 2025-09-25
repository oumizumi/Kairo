"""
Auto Schedule Builder Service

Core service that generates conflict-free schedules from course requirements,
integrates with scraper data, and handles natural language preferences.
"""

import logging
from typing import Dict, List, Optional, Any, Tuple, Set
from datetime import datetime, time, date, timedelta
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from ..models import Schedule, ScheduleEntry, ScheduleAdjustment, UserProfile
from .scraper_integration_service import scraper_service
from .color_generation_service import color_service
from .program_service import ProgramService

logger = logging.getLogger(__name__)

class AutoScheduleBuilderService:
    """Service to build and manage auto-generated schedules"""
    
    def __init__(self):
        self.program_service = ProgramService()
    
    def build_schedule(
        self,
        user: User,
        request_text: str,
        term: str = None,
        preferences: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Build a complete schedule based on user request
        
        Args:
            user: User requesting the schedule
            request_text: Natural language request
            term: Specific term or None for auto-detection
            preferences: Time preferences and constraints
            
        Returns:
            Dictionary with schedule results
        """
        try:
            logger.info(f"[SCHEDULE_BUILD] Building schedule for {user.username}: {request_text}")
            
            # Parse the request to extract terms and requirements
            parsed_request = self._parse_schedule_request(request_text, user)
            
            if not parsed_request['success']:
                return parsed_request
            
            terms_to_build = parsed_request['terms']
            course_requirements = parsed_request['courses']
            
            # Override with specific term if provided
            if term:
                normalized_term = scraper_service.normalize_term_id(term)
                terms_to_build = [normalized_term]
            
            results = {}
            all_schedules = []
            
            # Build schedule for each term
            for term_id in terms_to_build:
                term_result = self._build_term_schedule(
                    user=user,
                    term_id=term_id,
                    course_codes=course_requirements.get(term_id, []),
                    preferences=preferences or {},
                    request_context=request_text
                )
                
                results[term_id] = term_result
                
                if term_result['success'] and term_result['schedule']:
                    all_schedules.append(term_result['schedule'])
            
            # Determine overall success
            successful_terms = [term for term, result in results.items() if result['success']]
            
            return {
                'success': len(successful_terms) > 0,
                'message': self._generate_summary_message(results),
                'schedules': all_schedules,
                'results_by_term': results,
                'terms_built': successful_terms,
                'total_courses': sum(len(result.get('entries', [])) for result in results.values()),
            }
            
        except Exception as e:
            logger.error(f"[SCHEDULE_BUILD] Error building schedule: {e}")
            return {
                'success': False,
                'message': f"Error building schedule: {str(e)}",
                'schedules': [],
                'error': str(e)
            }
    
    def _build_term_schedule(
        self,
        user: User,
        term_id: str,
        course_codes: List[str],
        preferences: Dict[str, Any],
        request_context: str
    ) -> Dict[str, Any]:
        """Build schedule for a single term"""
        try:
            logger.info(f"[TERM_BUILD] Building {term_id} schedule with {len(course_codes)} courses")
            
            # Get current dataset version for cache invalidation
            dataset_version = scraper_service.check_dataset_version()
            
            # Get course data from scraper
            course_data = scraper_service.get_all_courses_for_term(term_id)
            
            if not course_data:
                return {
                    'success': False,
                    'message': f"No course data available for {term_id}",
                    'schedule': None
                }
            
            # Find sections for required courses
            available_sections = self._find_available_sections(course_codes, course_data)
            
            if not available_sections:
                return {
                    'success': False,
                    'message': f"No sections found for requested courses in {term_id}",
                    'schedule': None
                }
            
            # Generate optimal schedule
            selected_sections = self._select_optimal_sections(
                available_sections=available_sections,
                preferences=preferences
            )
            
            if not selected_sections:
                return {
                    'success': False,
                    'message': f"Could not create conflict-free schedule for {term_id}",
                    'schedule': None
                }
            
            # Generate Kairo themes for courses
            course_codes_found = list(selected_sections.keys())
            course_themes = color_service.generate_course_colors(course_codes_found, term_id)
            
            # Create schedule in database
            with transaction.atomic():
                # Deactivate any existing active schedule for this term
                Schedule.objects.filter(
                    user=user,
                    term=term_id,
                    is_active=True
                ).update(is_active=False)
                
                # Create new schedule
                schedule = Schedule.objects.create(
                    user=user,
                    term=term_id,
                    term_display=self._get_term_display_name(term_id),
                    preferences=preferences,
                    generation_context=request_context,
                    dataset_version=dataset_version,
                    is_active=True
                )
                
                # Create schedule entries
                entries = []
                for course_code, sections in selected_sections.items():
                    entries.extend(
                        self._create_schedule_entries(
                            schedule=schedule,
                            course_code=course_code,
                            sections=sections,
                            theme=course_themes.get(course_code, 'blue-purple-magenta'),
                            term_id=term_id
                        )
                    )
                
                # Bulk create entries
                ScheduleEntry.objects.bulk_create(entries)
            
            logger.info(f"[TERM_BUILD] Successfully created {term_id} schedule with {len(entries)} entries")
            
            return {
                'success': True,
                'message': f"Created {term_id} schedule with {len(course_codes_found)} courses",
                'schedule': schedule,
                'entries': entries,
                'courses_scheduled': course_codes_found,
                'total_sections': len(entries)
            }
            
        except Exception as e:
            logger.error(f"[TERM_BUILD] Error building {term_id} schedule: {e}")
            return {
                'success': False,
                'message': f"Error building {term_id} schedule: {str(e)}",
                'schedule': None,
                'error': str(e)
            }
    
    def _parse_schedule_request(self, request_text: str, user: User) -> Dict[str, Any]:
        """Parse natural language schedule request"""
        try:
            request_lower = request_text.lower()
            
            # Determine terms to build
            terms_to_build = []
            current_year = datetime.now().year
            
            if 'fall' in request_lower:
                terms_to_build.append(f"{current_year}FALL")
            if 'winter' in request_lower:
                terms_to_build.append(f"{current_year + 1}WINTER")
            
            # If no specific term mentioned, build both Fall and Winter
            if not terms_to_build:
                terms_to_build = [f"{current_year}FALL", f"{current_year + 1}WINTER"]
            
            # Extract program from request first
            program = self._extract_program_from_request(request_text)
            
            # If no program in request, try user profile
            if not program:
                user_profile = getattr(user, 'profile', None)
                program = user_profile.program if user_profile else None
            
            # Extract year if mentioned in request
            year = self._extract_year_from_request(request_text)
            
            # Require both program and year to be specified
            if not program:
                return {
                    'success': False,
                    'message': "Please specify your program. Example: 'Build my Year 2 Software Engineering Fall schedule' or 'Generate Computer Science Year 1 schedule'",
                    'terms': [],
                    'courses': {}
                }
            
            if not year:
                return {
                    'success': False,
                    'message': "Please specify your year. Example: 'Build my Year 2 Software Engineering Fall schedule' or 'Generate Year 1 schedule'",
                    'terms': [],
                    'courses': {}
                }
            
            # Get course requirements for each term
            course_requirements = {}
            
            for term_id in terms_to_build:
                if program:
                    # Get courses from curriculum
                    courses = self._get_curriculum_courses(program, year, term_id)
                else:
                    # Extract course codes from request text if no program
                    courses = self._extract_course_codes_from_text(request_text)
                
                if courses:
                    course_requirements[term_id] = courses
            
            if not any(course_requirements.values()):
                return {
                    'success': False,
                    'message': "Could not determine course requirements. Please specify your program or list specific courses.",
                    'terms': [],
                    'courses': {}
                }
            
            return {
                'success': True,
                'terms': terms_to_build,
                'courses': course_requirements,
                'program': program,
                'year': year
            }
            
        except Exception as e:
            logger.error(f"[PARSE_REQUEST] Error parsing request: {e}")
            return {
                'success': False,
                'message': f"Error parsing schedule request: {str(e)}",
                'terms': [],
                'courses': {}
            }
    
    def _get_curriculum_courses(self, program: str, year: int, term_id: str) -> List[str]:
        """Get course codes from curriculum for a specific program/year/term - works with ANY program"""
        try:
            # Map term_id to season
            season = 'Fall' if 'FALL' in term_id else 'Winter' if 'WINTER' in term_id else 'Summer'
            
            # Try to use program service first
            try:
                courses = self.program_service.get_courses_for_term(program, year, season)
                if courses:
                    return self._extract_course_codes_from_curriculum(courses)
            except Exception as e:
                logger.info(f"[CURRICULUM] Program service failed for {program}, trying direct curriculum lookup: {e}")
            
            # Fallback: try direct curriculum file lookup for any program
            curriculum_courses = self._load_curriculum_directly(program, year, season)
            if curriculum_courses:
                return curriculum_courses
            
            # Final fallback: return empty list so user can specify courses manually
            logger.warning(f"[CURRICULUM] No curriculum found for {program} Y{year} {season}")
            return []
            
        except Exception as e:
            logger.error(f"[CURRICULUM] Error getting courses for {program} Y{year} {term_id}: {e}")
            return []
    
    def _extract_course_codes_from_curriculum(self, courses: List[str]) -> List[str]:
        """Extract course codes from curriculum course list"""
        course_codes = []
        for course in courses:
            if 'elective' not in course.lower():
                # Extract code part (before any | or - separator)
                code = course.split('|')[0].split('-')[0].strip()
                if code and len(code) >= 6:  # Valid course code format
                    course_codes.append(code.replace(' ', ''))
        return course_codes
    
    def _load_curriculum_directly(self, program: str, year: int, season: str) -> List[str]:
        """Try to load curriculum directly from files for any program"""
        try:
            import os
            import json
            from pathlib import Path
            
            # Look for curriculum files in the public directory
            curriculum_dir = Path(__file__).parent.parent.parent.parent / "frontend" / "public" / "curriculums"
            
            if not curriculum_dir.exists():
                return []
            
            # Try different program name formats
            program_variations = [
                program,
                program.lower(),
                program.upper(),
                program.replace(' ', '_'),
                program.replace(' ', '-'),
                program.replace(' ', '').lower()
            ]
            
            for prog_name in program_variations:
                curriculum_file = curriculum_dir / f"{prog_name}.json"
                if curriculum_file.exists():
                    try:
                        with open(curriculum_file, 'r') as f:
                            curriculum_data = json.load(f)
                        
                        # Extract courses for the specified year and term
                        courses = self._extract_courses_from_curriculum_data(curriculum_data, year, season)
                        if courses:
                            logger.info(f"[CURRICULUM] Loaded {len(courses)} courses from {curriculum_file}")
                            return courses
                            
                    except Exception as e:
                        logger.warning(f"[CURRICULUM] Error reading {curriculum_file}: {e}")
                        continue
            
            return []
            
        except Exception as e:
            logger.error(f"[CURRICULUM] Error loading curriculum directly: {e}")
            return []
    
    def _extract_courses_from_curriculum_data(self, curriculum_data: Dict[str, Any], year: int, season: str) -> List[str]:
        """Extract course codes from curriculum data structure"""
        try:
            course_codes = []
            
            # Handle different curriculum data structures
            if 'years' in curriculum_data:
                # Standard format
                for year_data in curriculum_data['years']:
                    if year_data.get('year') == year:
                        for term_data in year_data.get('terms', []):
                            if term_data.get('term', '').lower() == season.lower():
                                for course in term_data.get('courses', []):
                                    code = self._extract_single_course_code(course)
                                    if code:
                                        course_codes.append(code)
                                break
                        break
            
            # Handle other possible formats
            elif f'year{year}' in curriculum_data:
                year_data = curriculum_data[f'year{year}']
                if season.lower() in year_data:
                    courses = year_data[season.lower()]
                    for course in courses:
                        code = self._extract_single_course_code(course)
                        if code:
                            course_codes.append(code)
            
            return course_codes
            
        except Exception as e:
            logger.error(f"[CURRICULUM] Error extracting courses from data: {e}")
            return []
    
    def _extract_single_course_code(self, course_text: str) -> Optional[str]:
        """Extract a single course code from course text"""
        try:
            if not course_text or 'elective' in course_text.lower():
                return None
            
            # Extract code part (before any | or - separator)
            code = course_text.split('|')[0].split('-')[0].strip()
            
            # Validate course code format (3-4 letters + 4 digits)
            import re
            if re.match(r'^[A-Z]{3,4}\s*\d{4}$', code.upper()):
                return code.replace(' ', '').upper()
            
            return None
            
        except Exception:
            return None
    
    def _extract_course_codes_from_text(self, text: str) -> List[str]:
        """Extract course codes from text using regex"""
        import re
        
        # Pattern for course codes like CSI2110, MAT 1348, etc.
        pattern = r'\b([A-Z]{3,4}\s*\d{4})\b'
        matches = re.findall(pattern, text.upper())
        
        # Clean up matches (remove spaces)
        return [match.replace(' ', '') for match in matches]
    
    def _extract_program_from_request(self, text: str) -> Optional[str]:
        """Extract program name from request text"""
        import re
        
        text_lower = text.lower()
        
        # Common program patterns
        program_patterns = {
            'software engineering': ['software engineering', 'software eng', 'seg', 'swe'],
            'computer science': ['computer science', 'comp sci', 'cs', 'csi'],
            'computer engineering': ['computer engineering', 'comp eng', 'ceg'],
            'electrical engineering': ['electrical engineering', 'elec eng', 'elg'],
            'mechanical engineering': ['mechanical engineering', 'mech eng', 'mec'],
            'civil engineering': ['civil engineering', 'civil eng', 'civ'],
            'chemical engineering': ['chemical engineering', 'chem eng', 'che'],
            'biomedical engineering': ['biomedical engineering', 'biomed eng', 'bme'],
            'mathematics': ['mathematics', 'math', 'mat'],
            'physics': ['physics', 'phy'],
            'chemistry': ['chemistry', 'chem', 'chm'],
            'biology': ['biology', 'bio'],
            'psychology': ['psychology', 'psych', 'psy'],
            'economics': ['economics', 'econ', 'eco'],
            'business': ['business', 'commerce', 'bcom'],
            'english': ['english', 'eng'],
            'french': ['french', 'fra'],
            'history': ['history', 'his'],
            'political science': ['political science', 'poli sci', 'pol'],
            'sociology': ['sociology', 'soc'],
            'philosophy': ['philosophy', 'phil', 'phi'],
        }
        
        # Look for program matches
        for program_name, patterns in program_patterns.items():
            for pattern in patterns:
                if pattern in text_lower:
                    return program_name
        
        return None
    
    def _extract_year_from_request(self, text: str) -> Optional[int]:
        """Extract year from request text"""
        import re
        
        text_lower = text.lower()
        
        # Year patterns
        year_patterns = [
            (r'\byear\s*(\d)\b', lambda m: int(m.group(1))),
            (r'\b(\d)(?:st|nd|rd|th)\s*year\b', lambda m: int(m.group(1))),
            (r'\bfirst\s*year\b', lambda m: 1),
            (r'\bsecond\s*year\b', lambda m: 2),
            (r'\bthird\s*year\b', lambda m: 3),
            (r'\bfourth\s*year\b', lambda m: 4),
            (r'\by(\d)\b', lambda m: int(m.group(1))),  # Y1, Y2, etc.
        ]
        
        for pattern, extractor in year_patterns:
            match = re.search(pattern, text_lower)
            if match:
                try:
                    year = extractor(match)
                    if 1 <= year <= 4:
                        return year
                except (ValueError, IndexError):
                    continue
        
        return None
    
    def _find_available_sections(
        self,
        course_codes: List[str],
        course_data: Dict[str, List[Dict[str, Any]]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Find available sections for required courses"""
        available_sections = {}
        
        for course_code in course_codes:
            # Normalize course code for lookup
            normalized_code = course_code.replace(' ', '').upper()
            
            # Try exact match first
            if normalized_code in course_data:
                sections = course_data[normalized_code]
            else:
                # Try with space (e.g., CSI2110 -> CSI 2110)
                spaced_code = self._add_space_to_course_code(normalized_code)
                if spaced_code in course_data:
                    sections = course_data[spaced_code]
                else:
                    logger.warning(f"[SECTIONS] No sections found for {course_code}")
                    continue
            
            # Filter to only open sections and group by type
            grouped_sections = self._group_sections_by_type(sections)
            if grouped_sections:
                available_sections[course_code] = grouped_sections
        
        return available_sections
    
    def _group_sections_by_type(self, sections: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Group sections by type (LEC, LAB, DGD, etc.)"""
        grouped = {}
        
        for section in sections:
            # Skip closed sections unless no open alternatives
            if section.get('status', '').lower() == 'closed':
                continue
            
            section_code = section.get('section', '')
            section_type = self._determine_section_type(section_code)
            
            if section_type not in grouped:
                grouped[section_type] = []
            
            grouped[section_type].append(section)
        
        return grouped
    
    def _determine_section_type(self, section_code: str) -> str:
        """Determine section type from section code"""
        if not section_code:
            return 'LEC'
        
        section_upper = section_code.upper()
        
        if 'LAB' in section_upper:
            return 'LAB'
        elif 'DGD' in section_upper:
            return 'DGD'
        elif 'TUT' in section_upper:
            return 'TUT'
        elif 'SEM' in section_upper:
            return 'SEM'
        elif 'WRK' in section_upper:
            return 'WRK'
        else:
            return 'LEC'
    
    def _select_optimal_sections(
        self,
        available_sections: Dict[str, Dict[str, List[Dict[str, Any]]]],
        preferences: Dict[str, Any]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Select optimal sections avoiding conflicts"""
        try:
            selected_sections = {}
            scheduled_times = []  # Track scheduled time slots to avoid conflicts
            
            # Sort courses by constraint level (fewer options first)
            courses_by_constraint = sorted(
                available_sections.items(),
                key=lambda x: sum(len(sections) for sections in x[1].values())
            )
            
            for course_code, section_types in courses_by_constraint:
                course_selections = []
                
                # For each section type (LEC, LAB, etc.), select the best option
                for section_type, sections in section_types.items():
                    best_section = self._select_best_section(
                        sections=sections,
                        scheduled_times=scheduled_times,
                        preferences=preferences,
                        course_code=course_code,
                        section_type=section_type
                    )
                    
                    if best_section:
                        course_selections.append(best_section)
                        # Add to scheduled times to avoid conflicts
                        section_times = self._extract_section_times(best_section)
                        scheduled_times.extend(section_times)
                    else:
                        logger.warning(f"[SELECT] No suitable {section_type} section for {course_code}")
                
                if course_selections:
                    selected_sections[course_code] = course_selections
                else:
                    logger.warning(f"[SELECT] No sections selected for {course_code}")
            
            return selected_sections
            
        except Exception as e:
            logger.error(f"[SELECT] Error selecting optimal sections: {e}")
            return {}
    
    def _select_best_section(
        self,
        sections: List[Dict[str, Any]],
        scheduled_times: List[Dict[str, Any]],
        preferences: Dict[str, Any],
        course_code: str,
        section_type: str
    ) -> Optional[Dict[str, Any]]:
        """Select the best section based on preferences and conflicts"""
        try:
            # Score each section
            scored_sections = []
            
            for section in sections:
                score = self._score_section(section, scheduled_times, preferences)
                if score > 0:  # Only consider non-conflicting sections
                    scored_sections.append((score, section))
            
            if not scored_sections:
                logger.warning(f"[SCORE] No non-conflicting {section_type} sections for {course_code}")
                return None
            
            # Sort by score (highest first) and return best
            scored_sections.sort(key=lambda x: x[0], reverse=True)
            best_section = scored_sections[0][1]
            
            logger.info(f"[SCORE] Selected {section_type} section {best_section.get('section', '')} for {course_code}")
            return best_section
            
        except Exception as e:
            logger.error(f"[SCORE] Error selecting best section: {e}")
            return sections[0] if sections else None
    
    def _score_section(
        self,
        section: Dict[str, Any],
        scheduled_times: List[Dict[str, Any]],
        preferences: Dict[str, Any]
    ) -> float:
        """Score a section based on preferences and conflicts"""
        try:
            score = 100.0  # Base score
            
            # Extract section timing
            section_times = self._extract_section_times(section)
            
            # Check for conflicts (immediate disqualification)
            for section_time in section_times:
                if self._has_time_conflict(section_time, scheduled_times):
                    return 0.0  # Conflict = not selectable
            
            # Apply preference scoring
            for section_time in section_times:
                score += self._apply_time_preferences(section_time, preferences)
            
            # Prefer sections with known instructors
            instructor = section.get('instructor', '').strip()
            if instructor and instructor.lower() not in ['tba', 'staff', '']:
                score += 5.0
            
            # Prefer open sections
            status = section.get('status', '').lower()
            if status == 'open':
                score += 10.0
            elif status == 'waitlist':
                score += 2.0
            
            return max(0.0, score)
            
        except Exception as e:
            logger.error(f"[SCORE] Error scoring section: {e}")
            return 50.0  # Neutral score on error
    
    def _extract_section_times(self, section: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract time slots from a section"""
        try:
            times = []
            
            time_str = section.get('time', '')
            days = section.get('days', [])
            
            # Parse time range
            time_range = self._parse_time_range(time_str)
            if not time_range:
                return times
            
            start_time, end_time = time_range
            
            # Create time slot for each day
            for day in days:
                times.append({
                    'day': day,
                    'start_time': start_time,
                    'end_time': end_time,
                    'section_code': section.get('section', '')
                })
            
            return times
            
        except Exception as e:
            logger.error(f"[TIME_EXTRACT] Error extracting times: {e}")
            return []
    
    def _parse_time_range(self, time_str: str) -> Optional[Tuple[time, time]]:
        """Parse time string like '10:00 - 11:20' into time objects"""
        try:
            import re
            
            # Pattern for time ranges like "10:00 - 11:20"
            pattern = r'(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})'
            match = re.search(pattern, time_str)
            
            if match:
                start_hour, start_min, end_hour, end_min = map(int, match.groups())
                start_time = time(start_hour, start_min)
                end_time = time(end_hour, end_min)
                return start_time, end_time
            
            return None
            
        except Exception as e:
            logger.error(f"[TIME_PARSE] Error parsing time '{time_str}': {e}")
            return None
    
    def _has_time_conflict(
        self,
        new_time: Dict[str, Any],
        scheduled_times: List[Dict[str, Any]]
    ) -> bool:
        """Check if new time conflicts with scheduled times"""
        try:
            new_day = new_time['day']
            new_start = new_time['start_time']
            new_end = new_time['end_time']
            
            for scheduled_time in scheduled_times:
                # Only check same day
                if scheduled_time['day'] != new_day:
                    continue
                
                sched_start = scheduled_time['start_time']
                sched_end = scheduled_time['end_time']
                
                # Check for time overlap
                if not (new_end <= sched_start or new_start >= sched_end):
                    return True  # Conflict found
            
            return False
            
        except Exception as e:
            logger.error(f"[CONFLICT] Error checking time conflict: {e}")
            return False
    
    def _apply_time_preferences(
        self,
        section_time: Dict[str, Any],
        preferences: Dict[str, Any]
    ) -> float:
        """Apply user preferences to section scoring"""
        try:
            score_adjustment = 0.0
            
            start_time = section_time['start_time']
            end_time = section_time['end_time']
            day = section_time['day']
            
            # No early classes preference
            if preferences.get('no_early_classes') and start_time < time(9, 0):
                score_adjustment -= 20.0
            
            # No late classes preference  
            if preferences.get('no_late_classes') and end_time > time(18, 0):
                score_adjustment -= 15.0
            
            # Avoid specific days
            avoid_days = preferences.get('avoid_days', [])
            if day in avoid_days:
                score_adjustment -= 25.0
            
            # Prefer specific days
            preferred_days = preferences.get('preferred_days', [])
            if preferred_days and day in preferred_days:
                score_adjustment += 15.0
            
            # Compact schedule preference
            if preferences.get('prefer_compact'):
                # Prefer mid-day times for compactness
                if time(10, 0) <= start_time <= time(14, 0):
                    score_adjustment += 10.0
            
            return score_adjustment
            
        except Exception as e:
            logger.error(f"[PREFERENCES] Error applying preferences: {e}")
            return 0.0
    
    def _create_schedule_entries(
        self,
        schedule: Schedule,
        course_code: str,
        sections: List[Dict[str, Any]],
        theme: str,
        term_id: str
    ) -> List[ScheduleEntry]:
        """Create ScheduleEntry objects for course sections"""
        try:
            entries = []
            term_start, term_end = scraper_service.get_term_date_range(term_id)
            
            for section in sections:
                section_times = self._extract_section_times(section)
                
                for section_time in section_times:
                    entry = ScheduleEntry(
                        schedule=schedule,
                        course_code=course_code,
                        course_title=section.get('courseTitle', ''),
                        section_code=section.get('section', ''),
                        component=self._determine_section_type(section.get('section', '')),
                        day_of_week=section_time['day'],
                        start_time=section_time['start_time'],
                        end_time=section_time['end_time'],
                        instructor=section.get('instructor', ''),
                        location=section.get('location', ''),
                        class_number=section.get('classNumber', ''),
                        color=theme,
                        start_date=datetime.fromisoformat(term_start).date() if term_start else date.today(),
                        end_date=datetime.fromisoformat(term_end).date() if term_end else date.today() + timedelta(days=120)
                    )
                    entries.append(entry)
            
            return entries
            
        except Exception as e:
            logger.error(f"[ENTRIES] Error creating schedule entries: {e}")
            return []
    
    def _add_space_to_course_code(self, course_code: str) -> str:
        """Add space to course code (e.g., CSI2110 -> CSI 2110)"""
        if len(course_code) < 6:
            return course_code
        
        # Find where letters end and numbers begin
        for i, char in enumerate(course_code):
            if char.isdigit():
                return f"{course_code[:i]} {course_code[i:]}"
        
        return course_code
    
    def _get_term_display_name(self, term_id: str) -> str:
        """Convert term ID to display name"""
        try:
            if 'FALL' in term_id:
                year = term_id[:4]
                return f"Fall {year}"
            elif 'WINTER' in term_id:
                year = term_id[:4]
                return f"Winter {year}"
            elif 'SUMMER' in term_id:
                year = term_id[:4]
                return f"Summer {year}"
            
            return term_id
            
        except Exception:
            return term_id
    
    def _generate_summary_message(self, results: Dict[str, Dict[str, Any]]) -> str:
        """Generate a summary message for the schedule build results"""
        try:
            successful_terms = []
            failed_terms = []
            total_courses = 0
            
            for term_id, result in results.items():
                term_display = self._get_term_display_name(term_id)
                
                if result['success']:
                    course_count = len(result.get('courses_scheduled', []))
                    successful_terms.append(f"{term_display} ({course_count} courses)")
                    total_courses += course_count
                else:
                    failed_terms.append(term_display)
            
            if successful_terms and not failed_terms:
                terms_str = " and ".join(successful_terms)
                return f"✅ Successfully built schedule for {terms_str} with {total_courses} total courses"
            elif successful_terms and failed_terms:
                success_str = " and ".join(successful_terms)
                failed_str = " and ".join(failed_terms)
                return f"⚠️ Built schedule for {success_str}, but failed for {failed_str}"
            else:
                failed_str = " and ".join(failed_terms)
                return f"❌ Failed to build schedule for {failed_str}"
                
        except Exception as e:
            logger.error(f"[SUMMARY] Error generating summary: {e}")
            return "Schedule build completed with mixed results"


# Global instance
auto_schedule_service = AutoScheduleBuilderService()
