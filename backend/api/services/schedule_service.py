import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, time, date
import logging
import re
from django.contrib.auth.models import User
from ..models import UserCalendar

logger = logging.getLogger(__name__)

class ScheduleService:
    """Service to handle schedule generation, section matching, and conflict detection"""
    
    @classmethod
    def _get_course_data_path(cls, term: str) -> Path:
        """Get the path to the KaiRoll course data file - PRIORITIZES LATEST SCRAPED DATA"""
        # PRIORITY ORDER: Latest scraped data first, then fallbacks
        possible_paths = [
            # Path 1: LATEST SCRAPED DATA (highest priority)
            Path(__file__).parent.parent.parent.parent / "scrapers" / "data" / "all_courses_by_term.json",
            # Path 2: Backend API data location (synced from scrapers)
            Path(__file__).parent.parent / "data" / "all_courses_by_term.json",
            # Path 3: Frontend public data (synced from scrapers)
            Path(__file__).parent.parent.parent.parent / "frontend" / "public" / "api" / "data" / "all_courses_by_term.json",
            # Path 4: Absolute path for deployment
            Path("/app/backend/api/data/all_courses_by_term.json"),
            # Path 5: Alternative deployment path
            Path("/app/scrapers/data/all_courses_by_term.json"),
        ]
        
        for path in possible_paths:
            if path.exists():
                logger.info(f"[COURSE_DATA] Using course data from: {path}")
                return path
        
        # Fallback - log all attempted paths for debugging
        logger.error(f"[COURSE_DATA] Could not find course data file. Tried paths: {possible_paths}")
        return possible_paths[0]  # Return first path as fallback

    @classmethod
    def _map_term_to_kairoll_format(cls, term: str) -> str:
        """Normalize term label without hardcoded years (compat shim)."""
        normalized = term.strip().title()
        logger.info(f"[TERM_MAP] Normalized term '{term}' -> '{normalized}'")
        return normalized

    @classmethod
    def _load_course_data(cls, term: str) -> Dict[str, List[Dict[str, Any]]]:
        """Load course sections for a specific term from KaiRoll format"""
        try:
            course_data_path = cls._get_course_data_path(term)
            
            with open(course_data_path, 'r', encoding='utf-8') as file:
                kairoll_data = json.load(file)
            
            # Choose best-matching term key dynamically
            term_key = cls._map_term_to_kairoll_format(term)
            matching_keys = [key for key in kairoll_data.keys() if term.lower() in key.lower()]
            if not matching_keys:
                matching_keys = [key for key in kairoll_data.keys() if key.lower() == term_key.lower()]
            best_key = None
            if matching_keys:
                def extract_year(k: str) -> int:
                    m = re.search(r"(20\d{2})", k)
                    return int(m.group(1)) if m else 0
                best_key = sorted(matching_keys, key=lambda k: extract_year(k), reverse=True)[0]
            term_data = kairoll_data.get(best_key) if best_key else None
            
            if not term_data:
                logger.warning(f"No data found for term: {term} in KaiRoll by-term file. Available terms: {list(kairoll_data.keys())}")
                # Fallback: try single-term files like all_courses_winter_2026.json
                single_term_sections = cls._load_course_data_from_single_file(term)
                if single_term_sections:
                    return single_term_sections
                return {}
            
            # Group sections by course code (support both 'courseCode' and 'code' keys)
            course_sections = {}
            for section in term_data:
                raw_code = section.get('courseCode') or section.get('code') or section.get('course_code') or ''
                course_code = str(raw_code).replace(' ', '').upper()  # Remove spaces and uppercase
                if course_code:
                    if course_code not in course_sections:
                        course_sections[course_code] = []
                    
                    # Convert KaiRoll format to expected format
                    # Capture section openness if available in KaiRoll data
                    raw_status = section.get('status') or section.get('availability') or section.get('openStatus') or section.get('open')
                    status_str = str(raw_status).strip().lower() if raw_status is not None else ''
                    is_open = False
                    if isinstance(raw_status, bool):
                        is_open = raw_status
                    else:
                        # Treat common strings as open
                        if any(tok in status_str for tok in ['open', 'available', 'spaces', 'spots']):
                            is_open = True
                        if any(tok in status_str for tok in ['closed', 'full', 'waitlist']):
                            is_open = False

                    schedule_blob = section.get('schedule')
                    # Build a synthetic schedule dict if not present
                    if not schedule_blob:
                        schedule_blob = {
                            'days': section.get('days') or section.get('day') or '',
                            'time': section.get('time') or section.get('hours') or ''
                        }
                    section_info = {
                        'code': course_code,
                        'section': section.get('section', ''),
                        'time': cls._extract_time_from_schedule(schedule_blob),
                        'days': cls._extract_days_from_schedule(schedule_blob),
                        'instructor': section.get('instructor', ''),
                        'location': section.get('location', ''),
                        'courseTitle': section.get('courseTitle') or section.get('title') or section.get('name') or '',
                        'type': cls._determine_section_type(section.get('section', '')),
                        'status': raw_status if raw_status is not None else '',
                        'is_open': is_open
                    }
                    course_sections[course_code].append(section_info)
            
            logger.info(f"Loaded {len(course_sections)} courses for term {term} from KaiRoll")
            return course_sections
            
        except Exception as e:
            logger.error(f"Error loading course sections for {term} from KaiRoll: {e}")
            return {}

    @classmethod
    def _load_course_data_from_single_file(cls, term: str) -> Dict[str, List[Dict[str, Any]]]:
        """Fallback loader: read per-term file (e.g., all_courses_winter_2026.json) and normalize."""
        try:
            # Map to slug
            label = cls._map_term_to_kairoll_format(term)  # e.g., Winter 2026
            parts = label.split()
            if len(parts) == 2 and parts[0] and parts[1].isdigit():
                slug = f"{parts[0].lower()}_{parts[1]}"
            else:
                slug = term.lower().replace(' ', '_')

            candidate_paths = [
                Path(__file__).parent.parent.parent.parent / "scrapers" / "data" / f"all_courses_{slug}.json",
                Path(__file__).parent.parent / "data" / f"all_courses_{slug}.json",
                Path(__file__).parent.parent.parent.parent / "frontend" / "public" / f"all_courses_{slug}.json",
                Path("/app/scrapers/data") / f"all_courses_{slug}.json",
                Path("/app/backend/api/data") / f"all_courses_{slug}.json",
            ]

            data = None
            for p in candidate_paths:
                if p.exists():
                    logger.info(f"[COURSE_DATA:FALLBACK] Using per-term file: {p}")
                    with open(p, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    break

            if not data:
                logger.warning(f"[COURSE_DATA:FALLBACK] No per-term file found for slug {slug}")
                return {}

            # Normalize into course_sections map
            course_sections: Dict[str, List[Dict[str, Any]]] = {}
            for section in data:
                course_code = section.get('courseCode', '').replace(' ', '').upper()
                if not course_code:
                    continue
                if course_code not in course_sections:
                    course_sections[course_code] = []

                raw_status = section.get('status') or section.get('availability') or section.get('openStatus') or section.get('open')
                status_str = str(raw_status).strip().lower() if raw_status is not None else ''
                is_open = False
                if isinstance(raw_status, bool):
                    is_open = raw_status
                else:
                    if any(tok in status_str for tok in ['open', 'available', 'spaces', 'spots']):
                        is_open = True
                    if any(tok in status_str for tok in ['closed', 'full', 'waitlist']):
                        is_open = False

                section_info = {
                    'code': course_code,
                    'section': section.get('section', ''),
                    'time': cls._extract_time_from_schedule(section.get('schedule', '')),
                    'days': cls._extract_days_from_schedule(section.get('schedule', '')),
                    'instructor': section.get('instructor', ''),
                    'location': section.get('location', ''),
                    'courseTitle': section.get('courseTitle', ''),
                    'type': cls._determine_section_type(section.get('section', '')),
                    'status': raw_status if raw_status is not None else '',
                    'is_open': is_open
                }
                course_sections[course_code].append(section_info)

            logger.info(f"[COURSE_DATA:FALLBACK] Loaded {len(course_sections)} courses for term {term}")
            return course_sections
        except Exception as e:
            logger.error(f"[COURSE_DATA:FALLBACK] Error loading per-term data for {term}: {e}")
            return {}
    
    @classmethod
    def _parse_time_string(cls, time_str: str) -> Optional[Tuple[time, time]]:
        """Parse time string like '08:30 - 10:00' into start and end time objects"""
        try:
            if not time_str or time_str == 'TBA':
                return None
                
            # Clean up the time string
            time_str = time_str.strip()
            
            # Handle different time formats
            time_patterns = [
                r'(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})',  # HH:MM - HH:MM
                r'(\d{1,2})h(\d{2})\s*-\s*(\d{1,2})h(\d{2})',  # HHhMM - HHhMM (French format)
            ]
            
            for pattern in time_patterns:
                match = re.search(pattern, time_str)
                if match:
                    start_hour, start_min, end_hour, end_min = map(int, match.groups())
                    
                    start_time = time(start_hour, start_min)
                    end_time = time(end_hour, end_min)
                    
                    return start_time, end_time
            
            logger.warning(f"Could not parse time string: {time_str}")
            return None
            
        except Exception as e:
            logger.error(f"Error parsing time string '{time_str}': {e}")
            return None
    
    @classmethod
    def _parse_days_string(cls, days_input) -> List[str]:
        """Parse days from either string like 'MW' or array like ['Mo', 'We'] into list of day names"""
        if not days_input:
            return []
        
        day_mapping = {
            'M': 'Monday', 'Mo': 'Monday',
            'T': 'Tuesday', 'Tu': 'Tuesday', 
            'W': 'Wednesday', 'We': 'Wednesday',
            'R': 'Thursday', 'Th': 'Thursday',
            'F': 'Friday', 'Fr': 'Friday',
            'S': 'Saturday', 'Sa': 'Saturday',
            'U': 'Sunday', 'Su': 'Sunday'
        }
        
        days = []
        
        # Handle array format like ["Mo", "We", "Fr"]
        if isinstance(days_input, list):
            for item in days_input:
                # Accept full names as-is
                if isinstance(item, str) and item.lower() in [v.lower() for v in day_mapping.values()]:
                    days.append(item.title())
                    continue
                # Map known abbreviations
                if item in day_mapping:
                    days.append(day_mapping[item])
        # Handle string format like "MWF"
        elif isinstance(days_input, str):
            # If it already contains full names separated by commas/spaces
            tokens = [tok.strip() for tok in re.split(r"[,/\s]+", days_input) if tok.strip()]
            if any(tok.lower() in [v.lower() for v in day_mapping.values()] for tok in tokens):
                for tok in tokens:
                    if tok.lower() in [v.lower() for v in day_mapping.values()]:
                        days.append(tok.title())
            else:
                for char in days_input.upper():
                    if char in day_mapping:
                        days.append(day_mapping[char])
                    
        return days
    
    @classmethod
    def _times_conflict(cls, time1: Tuple[time, time], time2: Tuple[time, time]) -> bool:
        """Check if two time ranges conflict"""
        start1, end1 = time1
        start2, end2 = time2
        
        # Two time ranges conflict if they overlap
        return not (end1 <= start2 or end2 <= start1)
    
    @classmethod
    def _section_conflicts_with_schedule(cls, section: Dict[str, Any], existing_schedule: List[Dict[str, Any]]) -> bool:
        """Check if a section conflicts with existing schedule"""
        try:
            # Parse section time and days
            time_str = section.get('time', '')
            days_input = section.get('days', [])
            
            section_times = cls._parse_time_string(time_str)
            section_days = cls._parse_days_string(days_input)
            
            if not section_times or not section_days:
                # If we can't parse time/days, assume no conflict
                return False
            
            # Check against each item in existing schedule
            for scheduled_item in existing_schedule:
                scheduled_time_str = scheduled_item.get('time', '')
                scheduled_days_input = scheduled_item.get('days', [])
                
                scheduled_times = cls._parse_time_string(scheduled_time_str)
                scheduled_days = cls._parse_days_string(scheduled_days_input)
                
                if not scheduled_times or not scheduled_days:
                    continue
                
                # Check if they share any days
                common_days = set(section_days) & set(scheduled_days)
                if common_days:
                    # Check if times conflict on those days
                    if cls._times_conflict(section_times, scheduled_times):
                        logger.info(f"[CONFLICT] Found conflict between {section.get('section', 'Unknown')} and {scheduled_item.get('section', 'Unknown')} on {common_days}")
                        return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking section conflicts: {e}")
            return False
    
    @classmethod
    def _normalize_course_code(cls, course_code: str) -> str:
        """Normalize course code for consistent matching"""
        if not course_code:
            return ""
        
        # Remove spaces and convert to uppercase for consistency
        normalized = course_code.replace(" ", "").upper()
        return normalized
    
    @classmethod
    def _add_space_to_course_code(cls, course_code: str) -> str:
        """Add space to course code to match KaiRoll format (e.g., GNG2101 -> GNG 2101)"""
        if not course_code or len(course_code) < 4:
            return course_code
            
        # Find where letters end and numbers begin
        i = 0
        while i < len(course_code) and course_code[i].isalpha():
            i += 1
        
        if i > 0 and i < len(course_code):
            # Insert space between letters and numbers
            return course_code[:i] + " " + course_code[i:]
        
        return course_code

    @classmethod
    def find_sections_for_courses(cls, course_codes: List[str], term: str) -> Dict[str, List[Dict[str, Any]]]:
        """Find available sections for a list of course codes"""
        logger.info(f"[SECTION_FIND] Looking for sections for {len(course_codes)} courses in {term} term")
        logger.info(f"[SECTION_FIND] Course codes: {course_codes}")
        
        try:
            logger.info(f"[SECTION_FIND] Looking for sections for {len(course_codes)} courses in {term} term")
            logger.info(f"[SECTION_FIND] Course codes: {course_codes}")
            
            # Load course sections from KaiRoll data for the specified term
            course_sections = cls._load_course_data(term)
            
            logger.info(f"[SECTION_FIND] Loaded course data with {len(course_sections)} total courses")
            
            # Log sample of available course codes for debugging
            sample_codes = list(course_sections.keys())[:10]
            logger.info(f"[SECTION_FIND] Sample course codes in data: {sample_codes}")
            
            result = {}

            def extract_subject_and_number(code: str) -> Tuple[str, Optional[int]]:
                # Normalize and split into leading letters (subject) and trailing digits (number)
                normalized = cls._normalize_course_code(code)
                subject_chars: List[str] = []
                number_chars: List[str] = []
                for ch in normalized:
                    if ch.isalpha() and not number_chars:
                        subject_chars.append(ch)
                    elif ch.isdigit():
                        number_chars.append(ch)
                    # ignore anything else
                subject = "".join(subject_chars)
                number = int("".join(number_chars)) if number_chars else None
                return subject, number

            # Build fast lookup helpers for fuzzy matching
            available_codes = list(course_sections.keys())  # already normalized codes (no spaces, upper)
            # Map subject -> list of (code, number)
            subject_to_codes: Dict[str, List[Tuple[str, Optional[int]]]] = {}
            for avail in available_codes:
                subj, num = extract_subject_and_number(avail)
                if subj:
                    subject_to_codes.setdefault(subj, []).append((avail, num))
            
            for course_code in course_codes:
                # Normalize course code (remove spaces) 
                normalized_code = cls._normalize_course_code(course_code)
                # Also try with space for KaiRoll format
                spaced_code = cls._add_space_to_course_code(course_code)
                logger.info(f"[SECTION_FIND] Looking for '{course_code}' (normalized: '{normalized_code}', spaced: '{spaced_code}')")
                
                # Try multiple variations of the course code
                search_codes = [course_code, normalized_code, spaced_code]
                
                found = False
                for search_code in search_codes:
                    if search_code in course_sections:
                        # Found sections for this course
                        sections = course_sections[search_code]
                        logger.info(f"[SECTION_FIND] Found {len(sections)} sections for {course_code} using search code '{search_code}'")
                        result[course_code] = sections
                        found = True
                        break
                
                if not found:
                    logger.warning(f"[SECTION_FIND] No sections found for {course_code}")
                    # Fuzzy match by subject and numeric proximity
                    target_subject, target_number = extract_subject_and_number(course_code)
                    best_code: Optional[str] = None
                    best_score: Tuple[int, int] = (10**9, 10**9)  # (abs number diff, fallback lexicographic)
                    if target_subject and target_subject in subject_to_codes:
                        candidates = subject_to_codes[target_subject]
                        for cand_code, cand_num in candidates:
                            # Prefer same thousand-level when numbers available
                            if target_number is not None and cand_num is not None:
                                # Compute absolute difference
                                diff = abs(cand_num - target_number)
                                # Tie-breaker: lexicographic distance to keep deterministic
                                tie = 0 if cand_code == normalized_code else 1
                                score = (diff, tie)
                            else:
                                # If numbers missing, fall back to lexicographic tie only
                                score = (10**8, 0 if cand_code == normalized_code else 1)
                            if score < best_score:
                                best_score = score
                                best_code = cand_code
                    # If nothing found within subject, try substring similarity as last resort
                    if not best_code:
                        normalized_target = cls._normalize_course_code(course_code)
                        similar_codes = [code for code in available_codes if normalized_target[:3] in code]
                        if similar_codes:
                            best_code = similar_codes[0]
                    if best_code and best_code in course_sections:
                        result[course_code] = course_sections[best_code]
                        logger.info(f"[SECTION_FIND] Fuzzy-mapped '{course_code}' -> '{best_code}' with {len(course_sections[best_code])} sections")
                    else:
                        logger.warning(f"[SECTION_FIND] No viable fuzzy match found for {course_code}")
                        result[course_code] = []
            
            logger.info(f"[SECTION_FIND] Final result: {[(code, len(sections)) for code, sections in result.items()]}")
            return result
        
        except Exception as e:
            logger.error(f"[SECTION_FIND] Failed to load course sections: {e}")
            return {}
    
    @classmethod
    def auto_select_sections(cls, available_sections: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Optional[Dict[str, Any]]]:
        """
        Auto-select one section per course, avoiding time conflicts
        Returns a dictionary mapping course_code to selected section (or None if no valid section)
        """
        logger.info(f"[SECTION_SELECT] Auto-selecting from {len(available_sections)} courses")
        logger.info(f"[SECTION_SELECT] Available courses: {list(available_sections.keys())}")
        
        selected_sections = {}
        schedule = []
        
        # Sort courses by number of available sections (courses with fewer options first)
        # Within each course, we will prefer OPEN sections first
        courses_by_options = sorted(available_sections.items(), key=lambda x: len(x[1]))
        logger.info(f"[SECTION_SELECT] Course priority order: {[(code, len(sections)) for code, sections in courses_by_options]}")
        
        for course_code, sections in courses_by_options:
            logger.info(f"[SECTION_SELECT] Processing {course_code} with {len(sections)} sections")
            
            if not sections:
                selected_sections[course_code] = None
                logger.warning(f"[SECTION_SELECT] No sections available for {course_code}")
                continue
            
            # Find the best section that doesn't conflict
            best_section = None
            
            # Sort sections: prefer open first, then earlier start times
            sorted_sections = sorted(
                sections,
                key=lambda s: (
                    0 if s.get('is_open', False) else 1,
                    cls._get_section_priority(s)
                )
            )
            logger.info(f"[SECTION_SELECT] Trying {len(sorted_sections)} sections for {course_code}")
            
            for i, section in enumerate(sorted_sections):
                conflicts = cls._section_conflicts_with_schedule(section, schedule)
                logger.info(f"[SECTION_SELECT] Section {i+1}/{len(sorted_sections)} for {course_code}: conflicts={conflicts}")
                
                if not conflicts:
                    best_section = section
                    logger.info(f"[SECTION_SELECT] Selected section {section.get('section', 'Unknown')} for {course_code}")
                    break
            
            if best_section:
                selected_sections[course_code] = best_section
                schedule.append(best_section)
                logger.info(f"[SECTION_SELECT] Added {course_code} to schedule. Total scheduled: {len(schedule)}")
            else:
                selected_sections[course_code] = None
                logger.warning(f"[SECTION_SELECT] Could not find non-conflicting section for {course_code}")
        
        successful_selections = [code for code, section in selected_sections.items() if section is not None]
        logger.info(f"[SECTION_SELECT] Final selections: {len(successful_selections)}/{len(available_sections)} courses scheduled")
        logger.info(f"[SECTION_SELECT] Successfully scheduled: {successful_selections}")
        
        return selected_sections
    
    @classmethod
    def _get_section_priority(cls, section: Dict[str, Any]) -> int:
        """Get priority score for section (lower is better)"""
        try:
            # Priority factors:
            # 1. Earlier start times are preferred
            # 2. Avoid online/TBA classes if possible
            
            time_str = section.get('time', '')
            location = section.get('location', '').upper()
            
            priority = 0
            
            # Parse start time
            times = cls._parse_time_string(time_str)
            if times:
                start_time, _ = times
                # Convert to minutes since midnight for comparison
                priority += start_time.hour * 60 + start_time.minute
            else:
                # TBA times get lower priority
                priority += 2000
            
            # Online/TBA locations get lower priority
            if 'ONLINE' in location or 'TBA' in location:
                priority += 1000
            
            return priority
            
        except Exception as e:
            logger.error(f"Error calculating section priority: {e}")
            return 9999
    
    @classmethod
    def _get_term_dates(cls, term: str, year: int = 2025) -> Tuple[date, date]:
        """Get start and end dates for academic terms"""
        # Define standard term dates for University of Ottawa
        if term.lower() == 'fall':
            return date(year, 9, 3), date(year, 12, 2)
        elif term.lower() == 'winter':
            return date(year + 1, 1, 12), date(year + 1, 4, 15) 
        elif term.lower() in ['spring', 'summer']:
            return date(year + 1, 5, 5), date(year + 1, 7, 29)
        else:
            # Default fallback
            return date(year, 9, 3), date(year, 12, 2)
    
    @classmethod
    def add_sections_to_calendar(cls, user: User, selected_sections: Dict[str, Dict[str, Any]], term: str, year: int = 2025) -> int:
        """
        Add selected course sections to user's calendar
        
        Args:
            user: User object
            selected_sections: Dictionary of course_code -> section data
            term: Academic term (Fall, Winter, Spring, Summer)
            year: Academic year
            
        Returns:
            Number of events successfully added
        """
        events_added = 0
        term_start, term_end = cls._get_term_dates(term, year)
        
        for course_code, section in selected_sections.items():
            if not section:
                continue
                
            try:
                # Parse section data
                title = f"{course_code} - {section.get('title', 'Course')}"
                instructor = section.get('instructor', 'TBA')
                location = section.get('location', 'TBA')
                time_str = section.get('time', '')
                days_str = section.get('days', '')
                section_code = section.get('section', '')
                
                # Parse times and days
                times = cls._parse_time_string(time_str)
                days = cls._parse_days_string(days_str)
                
                if not times or not days:
                    logger.warning(f"Could not parse schedule for {course_code} - skipping calendar entry")
                    continue
                
                start_time, end_time = times
                
                # Create calendar events for each day of the week
                for day in days:
                    # Use persistent user calendar model for saving
                    calendar_event = UserCalendar.objects.create(
                        user=user,
                        title=title,
                        start_time=start_time,
                        end_time=end_time,
                        day_of_week=day,
                        start_date=term_start,
                        end_date=term_end,
                        description=f"Section: {section_code}\nLocation: {location}",
                        professor=instructor,
                        location=location,
                        recurrence_pattern='weekly',
                        theme='midnight-light-blue'
                    )
                    
                    events_added += 1
                    logger.info(f"Added calendar event for {course_code} on {day}")
                
            except Exception as e:
                logger.error(f"Error adding {course_code} to calendar: {e}")
                continue
        
        logger.info(f"Successfully added {events_added} calendar events for {user.username}")
        return events_added
    
    @classmethod
    def clear_user_schedule(cls, user: User, term: str, year: int = 2025) -> int:
        """
        Clear existing course schedule for a user in a specific term
        
        Args:
            user: User object
            term: Academic term
            year: Academic year
            
        Returns:
            Number of events removed
        """
        try:
            term_start, term_end = cls._get_term_dates(term, year)
            
            # Find events within this term's date range
            events_to_remove = UserCalendar.objects.filter(
                user=user,
                start_date=term_start,
                end_date=term_end,
                recurrence_pattern='weekly'
            )
            
            deleted_count = events_to_remove.count()
            events_to_remove.delete()
            
            logger.info(f"Cleared {deleted_count} calendar events for user {user.username} in {term} {year}")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error clearing schedule for {user.username}: {e}")
            return 0 

    @classmethod
    def _extract_time_from_schedule(cls, schedule_input: Any) -> str:
        """Extract time range from schedule input (string or dict)."""
        if not schedule_input:
            return ''
        try:
            if isinstance(schedule_input, dict):
                t = schedule_input.get('time') or schedule_input.get('hours') or ''
                if isinstance(t, str) and '-' in t:
                    return t.replace(' ', '')
                if isinstance(t, list) and t:
                    s = str(t[0]).replace(' ', '')
                    if '-' in s:
                        return s
                schedule_input = json.dumps(schedule_input)
        except Exception:
            pass
        s = schedule_input if isinstance(schedule_input, str) else str(schedule_input)
        import re
        m1 = re.search(r'(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})', s)
        if m1:
            return f"{m1.group(1)}-{m1.group(2)}"
        m2 = re.search(r'(\d{1,2}:\d{2})-(\d{1,2}:\d{2})', s)
        if m2:
            return f"{m2.group(1)}-{m2.group(2)}"
        return ''

    @classmethod
    def _extract_days_from_schedule(cls, schedule_input: Any) -> List[str]:
        """Extract days from schedule input (string or dict)."""
        if not schedule_input:
            return []
        try:
            if isinstance(schedule_input, dict):
                days_val = schedule_input.get('days') or schedule_input.get('day') or []
                return cls._parse_days_string(days_val)
        except Exception:
            pass
        day_mapping = {
            'Mo': 'Monday', 'Tu': 'Tuesday', 'We': 'Wednesday', 
            'Th': 'Thursday', 'Fr': 'Friday', 'Sa': 'Saturday', 'Su': 'Sunday'
        }
        days = []
        s = schedule_input if isinstance(schedule_input, str) else str(schedule_input)
        for abbr, name in day_mapping.items():
            if abbr in s:
                days.append(name)
        return days

    @classmethod
    def _determine_section_type(cls, section_code: str) -> str:
        """Determine section type from section code"""
        if not section_code:
            return 'LEC'
        
        section_upper = section_code.upper()
        
        # Check for explicit type indicators in section code
        if 'LAB' in section_upper:
            return 'LAB'
        elif 'DGD' in section_upper:
            return 'DGD' 
        elif 'TUT' in section_upper:
            return 'TUT'
        elif 'SEM' in section_upper:
            return 'SEM'
        elif 'LEC' in section_upper:
            return 'LEC'
        elif 'WRK' in section_upper or 'WORKSHOP' in section_upper:
            return 'WRK'
        elif 'STU' in section_upper or 'STUDIO' in section_upper:
            return 'STU'
        else:
            # Default based on section code pattern
            # If it's just like "A01", "B02" etc, assume LEC
            return 'LEC' 

    @classmethod
    def auto_select_sections_with_preferences(cls, available_sections: Dict[str, List[Dict[str, Any]]], 
                                            preferences: Dict[str, Any] = None,
                                            avoid_sections: List[str] = None) -> Dict[str, Optional[Dict[str, Any]]]:
        """
        Auto-select sections with user preferences and avoidance rules
        
        Args:
            available_sections: Dictionary of course_code -> list of sections
            preferences: User preferences for times, instructors, etc.
            avoid_sections: List of section codes to avoid (e.g., ['A00-LEC', 'B01-LAB'])
            
        Returns:
            Dictionary of course_code -> selected section (or None if no valid selection)
        """
        try:
            logger.info(f"[SCHEDULE_SELECT] Auto-selecting with preferences: {preferences}")
            logger.info(f"[SCHEDULE_SELECT] Avoiding sections: {avoid_sections}")
            
            preferences = preferences or {}
            avoid_sections = avoid_sections or []
            time_constraints = preferences.get('time_constraints', {})
            instructor_preferences = preferences.get('instructor_preferences', {})
            
            # Group sections by course and type
            course_type_sections = {}
            for course_code, sections in available_sections.items():
                course_type_sections[course_code] = {}
                for section in sections:
                    section_type = section.get('type', 'LEC')
                    if section_type not in course_type_sections[course_code]:
                        course_type_sections[course_code][section_type] = []
                    course_type_sections[course_code][section_type].append(section)
            
            selected_sections = {}
            all_selected = []  # Track all selected sections for conflict checking
            
            # Select sections for each course
            for course_code, type_sections in course_type_sections.items():
                selected_sections[course_code] = {}
                
                # For each section type (LEC, LAB, DGD, etc.)
                for section_type, sections in type_sections.items():
                    best_section = cls._find_best_section(
                        sections, all_selected, avoid_sections, 
                        time_constraints, instructor_preferences, course_code
                    )
                    
                    if best_section:
                        selected_sections[course_code][section_type] = best_section
                        all_selected.append(best_section)
                        logger.info(f"[SCHEDULE_SELECT] Selected {course_code} {section_type}: {best_section.get('section', 'Unknown')}")
                    else:
                        logger.warning(f"[SCHEDULE_SELECT] No valid {section_type} section found for {course_code}")
            
            # Flatten the result to match the expected format
            result = {}
            for course_code, type_sections in selected_sections.items():
                if type_sections:
                    # For now, return all selected sections for the course
                    # The calling code will handle multiple sections per course
                    result[course_code] = list(type_sections.values())
                else:
                    result[course_code] = None
            
            logger.info(f"[SCHEDULE_SELECT] Final selection: {[(code, len(sections) if sections else 0) for code, sections in result.items()]}")
            return result
            
        except Exception as e:
            logger.error(f"Error in auto_select_sections_with_preferences: {e}")
            # Fallback to original method
            return cls.auto_select_sections(available_sections)
    
    @classmethod
    def _find_best_section(cls, sections: List[Dict[str, Any]], existing_sections: List[Dict[str, Any]], 
                          avoid_sections: List[str], time_constraints: Dict[str, Any], 
                          instructor_preferences: Dict[str, Any], course_code: str) -> Optional[Dict[str, Any]]:
        """Find the best section based on preferences and constraints"""
        
        avoid_instructors = instructor_preferences.get('avoid_instructors', [])
        earliest_start = time_constraints.get('earliest_start', '06:00')
        latest_end = time_constraints.get('latest_end', '22:00')
        avoid_days = time_constraints.get('avoid_days', [])
        
        # Score and filter sections
        scored_sections = []
        
        for section in sections:
            section_code = section.get('section', '')
            instructor = section.get('instructor', '').strip()
            
            # Skip if in avoid list
            if any(avoid_sec in section_code for avoid_sec in avoid_sections):
                continue
                
            # Skip if conflicts with existing sections
            if cls._section_conflicts_with_schedule(section, existing_sections):
                continue
                
            # Skip if instructor should be avoided
            if any(avoid_inst.lower() in instructor.lower() for avoid_inst in avoid_instructors):
                continue
                
            # Check time constraints
            if not cls._section_meets_time_constraints(section, earliest_start, latest_end, avoid_days):
                continue
            
            # Calculate preference score
            score = cls._calculate_section_score(section, time_constraints, instructor_preferences)
            scored_sections.append((score, section))
        
        # Sort by score (higher is better) and return the best
        if scored_sections:
            scored_sections.sort(key=lambda x: x[0], reverse=True)
            return scored_sections[0][1]
        
        return None
    
    @classmethod
    def _section_meets_time_constraints(cls, section: Dict[str, Any], earliest_start: str, 
                                      latest_end: str, avoid_days: List[str]) -> bool:
        """Check if section meets time constraints"""
        try:
            time_str = section.get('time', '')
            days = section.get('days', [])
            
            # Check days
            if any(day.lower() in [d.lower() for d in days] for day in avoid_days):
                return False
            
            # Check time range
            if time_str and '-' in time_str:
                times = cls._parse_time_string(time_str)
                if times:
                    start_time, end_time = times
                    earliest = cls._parse_time_string(earliest_start + '-' + earliest_start)
                    latest = cls._parse_time_string(latest_end + '-' + latest_end)
                    
                    if earliest and latest:
                        if start_time < earliest[0] or end_time > latest[1]:
                            return False
            
            return True
            
        except Exception as e:
            logger.warning(f"Error checking time constraints: {e}")
            return True  # Default to allowing the section
    
    @classmethod 
    def _calculate_section_score(cls, section: Dict[str, Any], time_constraints: Dict[str, Any], 
                               instructor_preferences: Dict[str, Any]) -> float:
        """Calculate a preference score for a section (higher is better)"""
        score = 0.0
        
        try:
            time_str = section.get('time', '')
            preferred_times = time_constraints.get('preferred_times', [])
            
            # Score based on preferred times
            if preferred_times and time_str:
                for pref_time in preferred_times:
                    if pref_time.lower() == 'morning' and any(t in time_str for t in ['08:', '09:', '10:', '11:']):
                        score += 2.0
                    elif pref_time.lower() == 'afternoon' and any(t in time_str for t in ['12:', '13:', '14:', '15:', '16:']):
                        score += 2.0
                    elif pref_time.lower() == 'evening' and any(t in time_str for t in ['17:', '18:', '19:', '20:']):
                        score += 2.0
            
            # Small bonus for non-conflicting sections
            score += 1.0
            
            # Randomize slightly to get variety when regenerating
            import random
            score += random.uniform(0, 0.5)
            
        except Exception as e:
            logger.warning(f"Error calculating section score: {e}")
            score = 1.0
        
        return score

    @classmethod
    def generate_alternative_schedule(cls, course_codes: List[str], term: str, 
                                    current_schedule: List[Dict[str, Any]] = None,
                                    preferences: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Generate an alternative schedule, avoiding sections from current schedule
        
        Args:
            course_codes: List of course codes to schedule
            term: Academic term
            current_schedule: Current schedule sections to avoid
            preferences: User preferences from AI analysis
            
        Returns:
            Dictionary with generation results
        """
        try:
            logger.info(f"[ALT_SCHEDULE] Generating alternative for {len(course_codes)} courses")
            
            # Find available sections
            available_sections = cls.find_sections_for_courses(course_codes, term)
            
            if not available_sections:
                return {
                    'success': False,
                    'message': f"No course data found for {', '.join(course_codes)}",
                    'sections': {}
                }
            
            # Extract section codes to avoid from current schedule
            avoid_sections = []
            if current_schedule:
                for section in current_schedule:
                    section_code = section.get('section_code') or section.get('section', '')
                    if section_code:
                        avoid_sections.append(section_code)
            
            logger.info(f"[ALT_SCHEDULE] Avoiding sections: {avoid_sections}")
            
            # Generate new schedule with preferences
            selected_sections = cls.auto_select_sections_with_preferences(
                available_sections, preferences, avoid_sections
            )
            
            # Count successful selections
            successful_selections = {}
            total_sections = 0
            
            for course_code, sections in selected_sections.items():
                if sections:
                    if isinstance(sections, list):
                        successful_selections[course_code] = sections
                        total_sections += len(sections)
                    else:
                        successful_selections[course_code] = [sections]
                        total_sections += 1
            
            if total_sections > 0:
                return {
                    'success': True,
                    'message': f"Generated alternative schedule with {total_sections} sections",
                    'sections': successful_selections,
                    'total_sections': total_sections
                }
            else:
                return {
                    'success': False,
                    'message': "Could not generate alternative schedule with given constraints",
                    'sections': {}
                }
                
        except Exception as e:
            logger.error(f"Error generating alternative schedule: {e}")
            return {
                'success': False,
                'message': "Error generating alternative schedule",
                'sections': {}
            } 