import logging
from typing import Dict, List, Optional, Any, Tuple
from django.contrib.auth.models import User
from .program_service import ProgramService
from .schedule_service import ScheduleService

logger = logging.getLogger(__name__)

class ScheduleGeneratorService:
    """Main service that orchestrates program-based schedule generation"""
    
    @classmethod
    async def generate_schedule_from_message(cls, user: User, message: str) -> Dict[str, Any]:
        """
        Main entry point for generating schedules from natural language messages
        
        Args:
            user: User object
            message: User's natural language message
            
        Returns:
            Dictionary containing generation results and information
        """
        try:
            logger.info(f"Starting schedule generation for user {user.username} with message: '{message}'")
            
            # Step 1: Detect program(s) from message or use stored program
            program_name, confidence = await ProgramService.detect_program_name(message)
            multi_programs: List[str] = []
            if not program_name:
                # Try multi-candidate offline detection for joint programs
                candidates = ProgramService.detect_program_names_offline_many(message, max_results=3)
                multi_programs = [n for (n, s) in candidates]
            
            if not program_name and not multi_programs:
                # Try to get stored program
                stored_program = ProgramService.get_user_program(user)
                if stored_program:
                    program_name = stored_program
                    confidence = 1.0
                    logger.info(f"Using stored program: {program_name}")
                else:
                    return {
                        'success': False,
                        'message': "I couldn't detect which program you're referring to. Please mention your program name (e.g., 'Computer Science', 'Software Engineering') and try again.",
                        'program_detected': False
                    }
            
            # Step 2: Store program in user profile if detected with high confidence
            if confidence >= 0.7:
                year = ProgramService.infer_year_from_message(message)
                ProgramService.store_user_program(user, program_name, year)
            
            # Step 3: Infer year and term from message
            year = ProgramService.infer_year_from_message(message) or 1  # Default to year 1
            single_term = cls._infer_term_from_message(message)

            # If only year is given, schedule Fall and Winter (and Summer when exists)
            terms_to_process = [single_term] if single_term else ['Fall', 'Winter', 'Summer']

            all_events = []
            all_successful = []
            all_failed = []
            all_electives = []
            term_summaries = []

            # Determine which programs to generate (single or multiple)
            programs_to_process = multi_programs if multi_programs else [program_name]

            for term in terms_to_process:
                for pname in programs_to_process:
                    logger.info(f"Generating schedule for {pname}, Year {year}, {term} term")

                # Step 4: Get required courses for the program/year/term
                logger.info(f"[SCHEDULE_GEN] Extracting courses for {pname} Year {year} {term}")
                required_courses = ProgramService.get_required_courses(pname, year, term)
                electives_info = ProgramService.get_electives_info(pname, year, term)

                if not required_courses and not electives_info:
                    logger.warning(f"[SCHEDULE_GEN] No curriculum data found for {program_name} Year {year} {term}")
                    continue

                # Step 5: Find available sections for required courses
                available_sections = ScheduleService.find_sections_for_courses(required_courses, term)
                # Step 6: Auto-select sections avoiding conflicts (prefers open in ScheduleService)
                selected_sections = ScheduleService.auto_select_sections(available_sections)
                # Step 7: Add selected sections to calendar
                events_added = ScheduleService.add_sections_to_calendar(user, selected_sections, term)

                # Accumulate
                term_events = cls._convert_sections_to_events(selected_sections, term)
                all_events.extend(term_events)
                all_successful.extend([c for c, s in selected_sections.items() if s is not None])
                all_failed.extend([c for c, s in selected_sections.items() if s is None])
                all_electives.extend(electives_info or [])
                term_summaries.append((f"{pname} {term}", events_added))

            if not all_events and not all_successful and not all_electives:
                return {
                    'success': False,
                    'message': f"I couldn't build a schedule for {program_name} Year {year}. Try specifying a term (Fall/Winter/Summer).",
                    'program_detected': True,
                    'program_name': program_name,
                    'events': [],
                    'matched_courses': [],
                    'unmatched_courses': [],
                    'errors': ["No term data available"],
                    'year': year
                }

            # Prepare multi-term response
            summary_lines = [f"📚 **Generated schedule - Year {year}**"]
            for t, count in term_summaries:
                summary_lines.append(f"- {t}: {count} events added")

            return {
                'success': True,
                'message': '\n'.join(summary_lines),
                'events': all_events,
                'matched_courses': all_successful,
                'unmatched_courses': all_failed,
                'errors': [],
                'program_detected': True,
                'program_name': program_name or ', '.join(programs_to_process),
                'year': year
            }
            
        except Exception as e:
            logger.error(f"Error in schedule generation: {e}")
            return {
                'success': False,
                'message': "An error occurred while generating your schedule. Please try again.",
                'error': str(e)
            }
    
    @classmethod
    def _infer_term_from_message(cls, message: str) -> Optional[str]:
        """Infer academic term from user message"""
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['fall', 'autumn', 'september', 'sept']):
            return 'Fall'
        elif any(word in message_lower for word in ['winter', 'january', 'jan']):
            return 'Winter'
        elif any(word in message_lower for word in ['spring', 'may']):
            return 'Spring'
        elif any(word in message_lower for word in ['summer', 'june', 'july']):
            return 'Summer'
        
        return None
    
    @classmethod
    def _prepare_response(cls, program_name: str, year: int, term: str, 
                         required_courses: List[str], selected_sections: Dict[str, Any],
                         electives_info: List[str], events_added: int, confidence: float) -> Dict[str, Any]:
        """Prepare the response message for the user"""
        
        # Count successful and failed course selections
        successful_courses = [course for course, section in selected_sections.items() if section is not None]
        failed_courses = [course for course, section in selected_sections.items() if section is None]
        
        # Build response message
        response_parts = []
        
        # Header
        response_parts.append(f"📚 **Generated schedule for {program_name} - Year {year}, {term} Term**\n")
        
        # Successfully scheduled courses
        if successful_courses:
            response_parts.append(f"✅ **Successfully scheduled ({len(successful_courses)} courses):**")
            for course in successful_courses:
                section = selected_sections[course]
                time_info = f"{section.get('days', 'TBA')} {section.get('time', 'TBA')}"
                location = section.get('location', 'TBA')
                instructor = section.get('instructor', 'TBA')
                response_parts.append(f"• **{course}** - {section.get('title', '')}")
                response_parts.append(f"  📅 {time_info} | 📍 {location} | 👨‍🏫 {instructor}")
            response_parts.append("")
        
        # Failed course selections
        if failed_courses:
            response_parts.append(f"⚠️ **Could not schedule ({len(failed_courses)} courses):**")
            for course in failed_courses:
                response_parts.append(f"• **{course}** - No available sections or time conflicts")
            response_parts.append("💡 You may need to manually select these courses using Kairoll.\n")
        
        # Electives information
        if electives_info:
            response_parts.append(f"🎯 **Electives this term ({len(electives_info)}):**")
            for elective in electives_info:
                response_parts.append(f"• {elective}")
            response_parts.append("\n**You have electives this term. Please use Kairoll to select your electives manually.**\n")
        
        # Calendar integration status
        if events_added > 0:
            response_parts.append(f"📅 **Calendar Updated:** {events_added} class sessions added to your calendar")
        else:
            response_parts.append("📅 **Calendar:** No events were added due to scheduling conflicts")
        
        # Additional help
        response_parts.append("\n💡 **Next steps:**")
        if electives_info:
            response_parts.append("• Use Kairoll to select your elective courses")
        if failed_courses:
            response_parts.append("• Manually register for courses that couldn't be auto-scheduled")
        response_parts.append("• Check your calendar for any time conflicts")
        response_parts.append("• Verify course prerequisites before registration")
        
        return {
            'success': True,
            'message': '\n'.join(response_parts),
            'events': cls._convert_sections_to_events(selected_sections, term),
            'matched_courses': successful_courses,
            'unmatched_courses': failed_courses,
            'errors': [],
            'program_detected': True,
            'program_name': program_name,
            'year': year,
            'term': term,
            'scheduled_courses': successful_courses,
            'failed_courses': failed_courses,
            'electives': electives_info,
            'events_added': events_added,
            'confidence': confidence
        }
    
    @classmethod
    def _convert_sections_to_events(cls, selected_sections: Dict[str, Any], term: str) -> List[Dict[str, Any]]:
        """Convert selected sections to calendar event format expected by frontend"""
        events = []
        
        for course_code, section in selected_sections.items():
            if section is None:
                continue
                
            try:
                # Parse time and days from section data
                time_str = section.get('time', '')
                days_str = section.get('days', '')
                
                if not time_str or not days_str or time_str == 'TBA' or days_str == 'TBA':
                    logger.warning(f"Skipping {course_code} - missing time/days info")
                    continue
                
                # Parse start and end times
                time_parts = time_str.replace(' ', '').split('-')
                if len(time_parts) != 2:
                    continue
                    
                start_time = time_parts[0]
                end_time = time_parts[1]
                
                # Parse days
                day_mapping = {
                    'M': 'Monday', 'T': 'Tuesday', 'W': 'Wednesday', 
                    'R': 'Thursday', 'F': 'Friday', 'S': 'Saturday'
                }
                
                days_list = []
                for char in days_str:
                    if char in day_mapping:
                        days_list.append(day_mapping[char])
                
                # Create event for each day
                for day in days_list:
                    event = {
                        'title': f"{course_code} - {section.get('title', course_code)}",
                        'start_time': start_time,
                        'end_time': end_time,
                        'day_of_week': day,
                        'start_date': '2025-09-02',  # Fall term start
                        'end_date': '2025-12-09',    # Fall term end
                        'description': f"Section: {section.get('section', 'TBA')}\\nInstructor: {section.get('instructor', 'TBA')}\\nLocation: {section.get('location', 'TBA')}",
                        'recurrence_pattern': 'weekly',
                        'theme': 'blue'
                    }
                    events.append(event)
                    
            except Exception as e:
                logger.error(f"Error converting section {course_code} to event: {e}")
                continue
        
        logger.info(f"[SCHEDULE_GEN] Converted {len(events)} calendar events from sections")
        return events
    
    @classmethod
    async def is_schedule_generation_request(cls, message: str) -> bool:
        """Use GPT to intelligently detect if the message is requesting schedule generation"""
        try:
            import openai
            import os
            from django.conf import settings
            import json
            
            openai_api_key = getattr(settings, 'OPENAI_API_KEY', None) or os.getenv('OPENAI_API_KEY')
            
            if not openai_api_key:
                logger.error("OpenAI API key not found for schedule detection")
                return False
            
            client = openai.OpenAI(api_key=openai_api_key)
            
            prompt = f"""Analyze this message to determine if the user is requesting academic schedule/course planning assistance.

User Message: "{message}"

Return true if the user is asking for:
- Schedule generation or creation
- Course planning for a specific term/year
- What courses to take
- Help planning their academic program
- Timetable creation
- Course selection assistance

Return false if they're asking about:
- Individual course information
- Prerequisites
- Course descriptions
- General questions
- Calendar events (meetings, deadlines)
- Other topics

Respond with only a JSON object:
{{"is_schedule_request": true/false, "confidence": 0.0-1.0, "reasoning": "brief explanation"}}"""

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an academic intent detection assistant."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=150
            )
            
            response_text = response.choices[0].message.content.strip()
            
            try:
                result = json.loads(response_text)
                is_request = result.get('is_schedule_request', False)
                confidence = result.get('confidence', 0.0)
                reasoning = result.get('reasoning', '')
                
                logger.info(f"Schedule detection: {is_request} (confidence: {confidence}) - {reasoning}")
                
                # Only return True if confidence is high enough
                return is_request and confidence >= 0.6
                
            except json.JSONDecodeError:
                logger.error(f"Failed to parse GPT response for schedule detection: {response_text}")
                return False
                
        except Exception as e:
            logger.error(f"Error in AI schedule detection: {e}")
            return False 