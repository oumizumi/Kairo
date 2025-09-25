"""
Natural Language Schedule Adjustments Service

Processes natural language requests to modify existing schedules.
Handles requests like "remove CSI 2110 Friday lab", "no 8am", "prefer Prof. X", etc.
"""

import re
import logging
from typing import Dict, List, Optional, Any, Tuple, Set
from datetime import time, datetime
from django.contrib.auth.models import User
from django.db import transaction

from ..models import Schedule, ScheduleEntry, ScheduleAdjustment
from .scraper_integration_service import scraper_service
from .auto_schedule_builder_service import auto_schedule_service

logger = logging.getLogger(__name__)

class NLPScheduleAdjustmentsService:
    """Service to handle natural language schedule adjustments"""
    
    def __init__(self):
        # Patterns for different types of adjustments
        self.adjustment_patterns = {
            'remove_course': [
                r'remove\s+([A-Z]{3,4}\s?\d{4})',
                r'drop\s+([A-Z]{3,4}\s?\d{4})',
                r'delete\s+([A-Z]{3,4}\s?\d{4})',
                r'take\s+out\s+([A-Z]{3,4}\s?\d{4})',
            ],
            'remove_section': [
                r'remove\s+([A-Z]{3,4}\s?\d{4})\s+(.*?)(?:lab|lecture|tutorial|dgd)',
                r'drop\s+([A-Z]{3,4}\s?\d{4})\s+(.*?)(?:section)',
                r'no\s+([A-Z]{3,4}\s?\d{4})\s+(.*?)(?:lab|lecture|tutorial)',
            ],
            'avoid_time': [
                r'no\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)',
                r'avoid\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)',
                r'not\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)',
                r'no\s+classes?\s+(?:at|before|after)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)',
            ],
            'avoid_day': [
                r'no\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)',
                r'avoid\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)',
                r'not\s+on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)',
                r'free\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)',
            ],
            'prefer_instructor': [
                r'prefer\s+(?:prof(?:essor)?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
                r'with\s+(?:prof(?:essor)?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
                r'taught\s+by\s+(?:prof(?:essor)?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
            ],
            'avoid_instructor': [
                r'not\s+(?:prof(?:essor)?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
                r'avoid\s+(?:prof(?:essor)?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
                r'no\s+(?:prof(?:essor)?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
            ],
            'stack_days': [
                r'stack\s+(?:on\s+)?(monday|tuesday|wednesday|thursday|friday)',
                r'bunch\s+(?:on\s+)?(monday|tuesday|wednesday|thursday|friday)',
                r'all\s+on\s+(monday|tuesday|wednesday|thursday|friday)',
                r'only\s+(?:on\s+)?(monday|tuesday|wednesday|thursday|friday)',
            ],
            'compact_schedule': [
                r'compact',
                r'close\s+together',
                r'back\s+to\s+back',
                r'minimize\s+gaps',
                r'tight\s+schedule',
            ],
            'spread_schedule': [
                r'spread\s+out',
                r'space\s+out',
                r'gaps?\s+between',
                r'breaks?\s+between',
            ]
        }
    
    def process_adjustment(
        self,
        user: User,
        schedule_id: str,
        adjustment_request: str
    ) -> Dict[str, Any]:
        """
        Process a natural language adjustment request
        
        Args:
            user: User making the request
            schedule_id: UUID of the schedule to adjust
            adjustment_request: Natural language adjustment request
            
        Returns:
            Dictionary with adjustment results
        """
        try:
            logger.info(f"[NLP_ADJUST] Processing adjustment for {user.username}: {adjustment_request}")
            
            # Get the schedule
            try:
                schedule = Schedule.objects.get(id=schedule_id, user=user)
            except Schedule.DoesNotExist:
                return {
                    'success': False,
                    'message': "Schedule not found or not accessible",
                    'error': 'schedule_not_found'
                }
            
            # Parse the adjustment request
            parsed_adjustments = self._parse_adjustment_request(adjustment_request)
            
            if not parsed_adjustments:
                return {
                    'success': False,
                    'message': "Could not understand the adjustment request. Please try rephrasing.",
                    'error': 'parse_failed'
                }
            
            # Apply adjustments
            adjustment_results = []
            overall_success = True
            
            for adjustment in parsed_adjustments:
                result = self._apply_adjustment(schedule, adjustment)
                adjustment_results.append(result)
                
                if not result['success']:
                    overall_success = False
            
            # Log the adjustment
            with transaction.atomic():
                ScheduleAdjustment.objects.create(
                    schedule=schedule,
                    user_request=adjustment_request,
                    adjustment_type=','.join(adj['type'] for adj in parsed_adjustments),
                    affected_courses=[],  # Will be populated by individual adjustments
                    success=overall_success,
                    error_message='' if overall_success else 'Some adjustments failed'
                )
            
            return {
                'success': overall_success,
                'message': self._generate_adjustment_summary(adjustment_results),
                'adjustments': adjustment_results,
                'schedule_updated': overall_success
            }
            
        except Exception as e:
            logger.error(f"[NLP_ADJUST] Error processing adjustment: {e}")
            return {
                'success': False,
                'message': f"Error processing adjustment: {str(e)}",
                'error': str(e)
            }
    
    def _parse_adjustment_request(self, request: str) -> List[Dict[str, Any]]:
        """Parse natural language request into structured adjustments"""
        try:
            adjustments = []
            request_lower = request.lower().strip()
            
            # Check each adjustment type
            for adj_type, patterns in self.adjustment_patterns.items():
                for pattern in patterns:
                    matches = re.finditer(pattern, request_lower)
                    
                    for match in matches:
                        adjustment = {
                            'type': adj_type,
                            'raw_match': match.group(0),
                            'groups': match.groups()
                        }
                        
                        # Parse specific details based on type
                        if adj_type == 'remove_course':
                            adjustment['course_code'] = match.group(1).replace(' ', '').upper()
                        
                        elif adj_type == 'remove_section':
                            adjustment['course_code'] = match.group(1).replace(' ', '').upper()
                            adjustment['section_filter'] = match.group(2).strip()
                        
                        elif adj_type == 'avoid_time':
                            adjustment['time'] = self._normalize_time(match.group(1))
                        
                        elif adj_type == 'avoid_day':
                            adjustment['day'] = match.group(1).capitalize()
                        
                        elif adj_type in ['prefer_instructor', 'avoid_instructor']:
                            adjustment['instructor'] = match.group(1).strip()
                        
                        elif adj_type == 'stack_days':
                            adjustment['target_day'] = match.group(1).capitalize()
                        
                        adjustments.append(adjustment)
            
            # Remove duplicates
            unique_adjustments = []
            seen = set()
            
            for adj in adjustments:
                key = (adj['type'], str(adj.get('course_code', '')), str(adj.get('time', '')), str(adj.get('day', '')))
                if key not in seen:
                    unique_adjustments.append(adj)
                    seen.add(key)
            
            logger.info(f"[NLP_PARSE] Parsed {len(unique_adjustments)} adjustments from request")
            return unique_adjustments
            
        except Exception as e:
            logger.error(f"[NLP_PARSE] Error parsing adjustment request: {e}")
            return []
    
    def _apply_adjustment(self, schedule: Schedule, adjustment: Dict[str, Any]) -> Dict[str, Any]:
        """Apply a single adjustment to the schedule"""
        try:
            adj_type = adjustment['type']
            
            if adj_type == 'remove_course':
                return self._remove_course(schedule, adjustment['course_code'])
            
            elif adj_type == 'remove_section':
                return self._remove_section(schedule, adjustment['course_code'], adjustment['section_filter'])
            
            elif adj_type == 'avoid_time':
                return self._avoid_time(schedule, adjustment['time'])
            
            elif adj_type == 'avoid_day':
                return self._avoid_day(schedule, adjustment['day'])
            
            elif adj_type == 'prefer_instructor':
                return self._prefer_instructor(schedule, adjustment['instructor'])
            
            elif adj_type == 'avoid_instructor':
                return self._avoid_instructor(schedule, adjustment['instructor'])
            
            elif adj_type == 'stack_days':
                return self._stack_days(schedule, adjustment['target_day'])
            
            elif adj_type == 'compact_schedule':
                return self._compact_schedule(schedule)
            
            elif adj_type == 'spread_schedule':
                return self._spread_schedule(schedule)
            
            else:
                return {
                    'success': False,
                    'message': f"Adjustment type '{adj_type}' not implemented",
                    'type': adj_type
                }
                
        except Exception as e:
            logger.error(f"[APPLY_ADJUST] Error applying {adj_type} adjustment: {e}")
            return {
                'success': False,
                'message': f"Error applying adjustment: {str(e)}",
                'type': adj_type,
                'error': str(e)
            }
    
    def _remove_course(self, schedule: Schedule, course_code: str) -> Dict[str, Any]:
        """Remove all sections of a course from the schedule"""
        try:
            entries_to_remove = ScheduleEntry.objects.filter(
                schedule=schedule,
                course_code=course_code
            )
            
            count = entries_to_remove.count()
            if count == 0:
                return {
                    'success': False,
                    'message': f"Course {course_code} not found in schedule",
                    'type': 'remove_course'
                }
            
            entries_to_remove.delete()
            
            return {
                'success': True,
                'message': f"Removed {course_code} ({count} sections) from schedule",
                'type': 'remove_course',
                'course_code': course_code,
                'sections_removed': count
            }
            
        except Exception as e:
            logger.error(f"[REMOVE_COURSE] Error removing {course_code}: {e}")
            return {
                'success': False,
                'message': f"Error removing {course_code}: {str(e)}",
                'type': 'remove_course'
            }
    
    def _remove_section(self, schedule: Schedule, course_code: str, section_filter: str) -> Dict[str, Any]:
        """Remove specific sections of a course based on filter"""
        try:
            # Build filter based on section_filter text
            entries = ScheduleEntry.objects.filter(
                schedule=schedule,
                course_code=course_code
            )
            
            # Apply section filter
            if 'friday' in section_filter.lower():
                entries = entries.filter(day_of_week__icontains='Friday')
            elif 'monday' in section_filter.lower():
                entries = entries.filter(day_of_week__icontains='Monday')
            elif 'tuesday' in section_filter.lower():
                entries = entries.filter(day_of_week__icontains='Tuesday')
            elif 'wednesday' in section_filter.lower():
                entries = entries.filter(day_of_week__icontains='Wednesday')
            elif 'thursday' in section_filter.lower():
                entries = entries.filter(day_of_week__icontains='Thursday')
            
            if 'lab' in section_filter.lower():
                entries = entries.filter(component='LAB')
            elif 'lecture' in section_filter.lower():
                entries = entries.filter(component='LEC')
            elif 'tutorial' in section_filter.lower():
                entries = entries.filter(component='TUT')
            elif 'dgd' in section_filter.lower():
                entries = entries.filter(component='DGD')
            
            count = entries.count()
            if count == 0:
                return {
                    'success': False,
                    'message': f"No matching sections found for {course_code} {section_filter}",
                    'type': 'remove_section'
                }
            
            entries.delete()
            
            return {
                'success': True,
                'message': f"Removed {count} {course_code} sections matching '{section_filter}'",
                'type': 'remove_section',
                'course_code': course_code,
                'sections_removed': count
            }
            
        except Exception as e:
            logger.error(f"[REMOVE_SECTION] Error removing {course_code} sections: {e}")
            return {
                'success': False,
                'message': f"Error removing sections: {str(e)}",
                'type': 'remove_section'
            }
    
    def _avoid_time(self, schedule: Schedule, avoid_time: str) -> Dict[str, Any]:
        """Remove sections that occur at a specific time"""
        try:
            # Parse the time
            parsed_time = self._parse_time_constraint(avoid_time)
            if not parsed_time:
                return {
                    'success': False,
                    'message': f"Could not parse time '{avoid_time}'",
                    'type': 'avoid_time'
                }
            
            # Find entries that conflict with this time
            entries_to_remove = []
            all_entries = ScheduleEntry.objects.filter(schedule=schedule)
            
            for entry in all_entries:
                if self._time_overlaps(entry.start_time, entry.end_time, parsed_time):
                    entries_to_remove.append(entry)
            
            if not entries_to_remove:
                return {
                    'success': True,
                    'message': f"No classes found at {avoid_time}",
                    'type': 'avoid_time'
                }
            
            # Remove conflicting entries
            course_codes = set(entry.course_code for entry in entries_to_remove)
            for entry in entries_to_remove:
                entry.delete()
            
            return {
                'success': True,
                'message': f"Removed {len(entries_to_remove)} sections at {avoid_time}",
                'type': 'avoid_time',
                'sections_removed': len(entries_to_remove),
                'affected_courses': list(course_codes)
            }
            
        except Exception as e:
            logger.error(f"[AVOID_TIME] Error avoiding time {avoid_time}: {e}")
            return {
                'success': False,
                'message': f"Error avoiding time: {str(e)}",
                'type': 'avoid_time'
            }
    
    def _avoid_day(self, schedule: Schedule, day: str) -> Dict[str, Any]:
        """Remove all sections on a specific day"""
        try:
            entries_to_remove = ScheduleEntry.objects.filter(
                schedule=schedule,
                day_of_week=day
            )
            
            count = entries_to_remove.count()
            if count == 0:
                return {
                    'success': True,
                    'message': f"No classes found on {day}",
                    'type': 'avoid_day'
                }
            
            course_codes = set(entry.course_code for entry in entries_to_remove)
            entries_to_remove.delete()
            
            return {
                'success': True,
                'message': f"Removed {count} sections on {day}",
                'type': 'avoid_day',
                'day': day,
                'sections_removed': count,
                'affected_courses': list(course_codes)
            }
            
        except Exception as e:
            logger.error(f"[AVOID_DAY] Error avoiding {day}: {e}")
            return {
                'success': False,
                'message': f"Error avoiding {day}: {str(e)}",
                'type': 'avoid_day'
            }
    
    def _prefer_instructor(self, schedule: Schedule, instructor_name: str) -> Dict[str, Any]:
        """Try to find sections with preferred instructor"""
        try:
            # This requires rebuilding parts of the schedule
            # For now, return a message that this needs manual selection
            return {
                'success': False,
                'message': f"Instructor preferences require rebuilding the schedule. Please use 'build my schedule with Prof. {instructor_name}' instead.",
                'type': 'prefer_instructor',
                'instructor': instructor_name
            }
            
        except Exception as e:
            logger.error(f"[PREFER_INSTRUCTOR] Error preferring {instructor_name}: {e}")
            return {
                'success': False,
                'message': f"Error applying instructor preference: {str(e)}",
                'type': 'prefer_instructor'
            }
    
    def _avoid_instructor(self, schedule: Schedule, instructor_name: str) -> Dict[str, Any]:
        """Remove sections taught by a specific instructor"""
        try:
            entries_to_remove = ScheduleEntry.objects.filter(
                schedule=schedule,
                instructor__icontains=instructor_name
            )
            
            count = entries_to_remove.count()
            if count == 0:
                return {
                    'success': True,
                    'message': f"No sections found with instructor {instructor_name}",
                    'type': 'avoid_instructor'
                }
            
            course_codes = set(entry.course_code for entry in entries_to_remove)
            entries_to_remove.delete()
            
            return {
                'success': True,
                'message': f"Removed {count} sections taught by {instructor_name}",
                'type': 'avoid_instructor',
                'instructor': instructor_name,
                'sections_removed': count,
                'affected_courses': list(course_codes)
            }
            
        except Exception as e:
            logger.error(f"[AVOID_INSTRUCTOR] Error avoiding {instructor_name}: {e}")
            return {
                'success': False,
                'message': f"Error avoiding instructor: {str(e)}",
                'type': 'avoid_instructor'
            }
    
    def _stack_days(self, schedule: Schedule, target_day: str) -> Dict[str, Any]:
        """Try to move classes to a specific day (requires schedule rebuild)"""
        try:
            return {
                'success': False,
                'message': f"Day stacking requires rebuilding the schedule. Please use 'build my schedule with classes only on {target_day}' instead.",
                'type': 'stack_days',
                'target_day': target_day
            }
            
        except Exception as e:
            logger.error(f"[STACK_DAYS] Error stacking on {target_day}: {e}")
            return {
                'success': False,
                'message': f"Error stacking days: {str(e)}",
                'type': 'stack_days'
            }
    
    def _compact_schedule(self, schedule: Schedule) -> Dict[str, Any]:
        """Make schedule more compact (requires rebuild)"""
        try:
            return {
                'success': False,
                'message': "Schedule compacting requires rebuilding. Please use 'build my compact schedule' instead.",
                'type': 'compact_schedule'
            }
            
        except Exception as e:
            logger.error(f"[COMPACT] Error compacting schedule: {e}")
            return {
                'success': False,
                'message': f"Error compacting schedule: {str(e)}",
                'type': 'compact_schedule'
            }
    
    def _spread_schedule(self, schedule: Schedule) -> Dict[str, Any]:
        """Spread out schedule (requires rebuild)"""
        try:
            return {
                'success': False,
                'message': "Schedule spreading requires rebuilding. Please use 'build my spread out schedule' instead.",
                'type': 'spread_schedule'
            }
            
        except Exception as e:
            logger.error(f"[SPREAD] Error spreading schedule: {e}")
            return {
                'success': False,
                'message': f"Error spreading schedule: {str(e)}",
                'type': 'spread_schedule'
            }
    
    def _normalize_time(self, time_str: str) -> str:
        """Normalize time string to standard format"""
        try:
            time_str = time_str.strip().lower()
            
            # Handle formats like "8", "8am", "8:00", "8:00am"
            if 'am' in time_str or 'pm' in time_str:
                return time_str
            
            # Add am/pm if missing
            if ':' in time_str:
                hour = int(time_str.split(':')[0])
            else:
                hour = int(time_str)
            
            if hour < 8:
                return time_str + 'pm'
            elif hour < 12:
                return time_str + 'am'
            else:
                return time_str + 'pm'
                
        except Exception:
            return time_str
    
    def _parse_time_constraint(self, time_str: str) -> Optional[time]:
        """Parse time constraint into time object"""
        try:
            import re
            
            time_str = time_str.lower().strip()
            
            # Extract hour and minute
            if ':' in time_str:
                match = re.match(r'(\d{1,2}):(\d{2})\s*(am|pm)?', time_str)
                if match:
                    hour = int(match.group(1))
                    minute = int(match.group(2))
                    period = match.group(3)
                else:
                    return None
            else:
                match = re.match(r'(\d{1,2})\s*(am|pm)?', time_str)
                if match:
                    hour = int(match.group(1))
                    minute = 0
                    period = match.group(2)
                else:
                    return None
            
            # Convert to 24-hour format
            if period == 'pm' and hour != 12:
                hour += 12
            elif period == 'am' and hour == 12:
                hour = 0
            
            return time(hour, minute)
            
        except Exception as e:
            logger.error(f"[PARSE_TIME] Error parsing time '{time_str}': {e}")
            return None
    
    def _time_overlaps(self, start_time: time, end_time: time, target_time: time) -> bool:
        """Check if target time falls within start and end time"""
        try:
            return start_time <= target_time <= end_time
        except Exception:
            return False
    
    def _generate_adjustment_summary(self, adjustment_results: List[Dict[str, Any]]) -> str:
        """Generate a summary message for all adjustments"""
        try:
            successful = [r for r in adjustment_results if r['success']]
            failed = [r for r in adjustment_results if not r['success']]
            
            if successful and not failed:
                return f"✅ Successfully applied {len(successful)} adjustment(s)"
            elif successful and failed:
                return f"⚠️ Applied {len(successful)} adjustment(s), {len(failed)} failed"
            else:
                return f"❌ All {len(failed)} adjustment(s) failed"
                
        except Exception as e:
            logger.error(f"[SUMMARY] Error generating adjustment summary: {e}")
            return "Adjustment processing completed"


# Global instance
nlp_adjustments_service = NLPScheduleAdjustmentsService()
