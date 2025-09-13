import logging
import openai
import os
import json
from typing import Dict, List, Optional, Any
from django.conf import settings
from django.contrib.auth.models import User

logger = logging.getLogger(__name__)

class ScheduleCustomizationService:
    """AI-powered service to understand and handle schedule customization requests"""
    
    @classmethod
    async def analyze_schedule_change_request(cls, message: str, current_schedule: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Use AI to analyze what the user wants to change about their schedule
        
        Args:
            message: User's message about changing their schedule
            current_schedule: Current schedule sections (optional, for context)
            
        Returns:
            Dictionary with analysis results
        """
        try:
            openai_api_key = getattr(settings, 'OPENAI_API_KEY', None) or os.getenv('OPENAI_API_KEY')
            
            if not openai_api_key:
                logger.error("OpenAI API key not found for schedule customization")
                return {"type": "complete_regeneration", "reason": "AI analysis unavailable"}
            
            client = openai.OpenAI(api_key=openai_api_key)
            
            # Prepare current schedule context
            schedule_context = ""
            if current_schedule:
                schedule_context = "\n\nCurrent Schedule:\n"
                for section in current_schedule:
                    course = section.get('course_code', 'Unknown')
                    section_code = section.get('section_code', 'Unknown')
                    section_type = section.get('type', 'Unknown')
                    time = section.get('time', 'TBA')
                    instructor = section.get('instructor', 'TBA')
                    schedule_context += f"- {course} {section_type}: {section_code} at {time} with {instructor}\n"
            
            prompt = f"""Analyze this user message about changing their course schedule:

User Message: "{message}"
{schedule_context}

Determine what type of schedule change the user wants:

1. COMPLETE_REGENERATION: They want a completely new schedule (different sections for all courses)
   - Examples: "make a new schedule", "I want to see a different one", "generate another schedule"

2. SPECIFIC_CHANGES: They want to change specific courses, times, or instructors
   - Examples: "I don't like the 8am class", "change my math course", "different instructor for CSI2110"

3. TIME_PREFERENCE: They want schedule based on time preferences
   - Examples: "no morning classes", "prefer afternoon", "nothing before 10am"

4. INSTRUCTOR_PREFERENCE: They want different instructors
   - Examples: "different professor", "not this instructor", "better teacher"

Respond with JSON:
{{
    "change_type": "complete_regeneration|specific_changes|time_preference|instructor_preference",
    "confidence": 0.0-1.0,
    "specific_courses": ["course1", "course2"],  // Only if specific courses mentioned
    "time_constraints": {{
        "earliest_start": "09:00",  // Only if time preferences mentioned
        "latest_end": "17:00",
        "avoid_days": ["friday"],
        "preferred_times": ["morning", "afternoon", "evening"]
    }},
    "instructor_preferences": {{
        "avoid_instructors": ["instructor name"],  // Only if specific instructors mentioned
        "course_instructor_pairs": [{{"course": "CSI2110", "avoid_instructor": "John Doe"}}]
    }},
    "reasoning": "Brief explanation of the analysis"
}}"""

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an academic schedule analysis assistant. Analyze student requests for schedule changes and respond with structured JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=400
            )
            
            response_text = response.choices[0].message.content.strip()
            logger.info(f"[SCHEDULE_CUSTOM] AI analysis: {response_text}")
            
            # Parse JSON response
            try:
                # Remove code blocks if present
                if "```json" in response_text:
                    response_text = response_text.split("```json")[1].split("```")[0]
                elif "```" in response_text:
                    response_text = response_text.split("```")[1].split("```")[0]
                
                analysis = json.loads(response_text)
                
                # Validate and normalize the response
                change_type = analysis.get('change_type', 'complete_regeneration')
                confidence = analysis.get('confidence', 0.5)
                
                return {
                    'change_type': change_type,
                    'confidence': confidence,
                    'specific_courses': analysis.get('specific_courses', []),
                    'time_constraints': analysis.get('time_constraints', {}),
                    'instructor_preferences': analysis.get('instructor_preferences', {}),
                    'reasoning': analysis.get('reasoning', 'AI analysis of schedule change request'),
                    'success': True
                }
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse AI response as JSON: {e}")
                # Fallback analysis based on keywords
                return cls._fallback_analysis(message)
                
        except Exception as e:
            logger.error(f"Error in AI schedule analysis: {e}")
            return cls._fallback_analysis(message)
    
    @classmethod
    def _fallback_analysis(cls, message: str) -> Dict[str, Any]:
        """Fallback analysis when AI is unavailable"""
        message_lower = message.lower()
        
        # Simple keyword-based analysis
        if any(phrase in message_lower for phrase in ['new schedule', 'different schedule', 'another schedule', 'generate again']):
            return {
                'change_type': 'complete_regeneration',
                'confidence': 0.8,
                'specific_courses': [],
                'time_constraints': {},
                'instructor_preferences': {},
                'reasoning': 'Keyword-based detection of complete regeneration request',
                'success': True
            }
        elif any(phrase in message_lower for phrase in ['morning', 'afternoon', 'evening', 'am', 'pm', 'early', 'late']):
            return {
                'change_type': 'time_preference', 
                'confidence': 0.7,
                'specific_courses': [],
                'time_constraints': {'preferred_times': ['afternoon'] if 'afternoon' in message_lower else ['morning']},
                'instructor_preferences': {},
                'reasoning': 'Keyword-based detection of time preference',
                'success': True
            }
        else:
            return {
                'change_type': 'complete_regeneration',
                'confidence': 0.6,
                'specific_courses': [],
                'time_constraints': {},
                'instructor_preferences': {},
                'reasoning': 'Default fallback to complete regeneration',
                'success': True
            }
    
    @classmethod 
    def is_schedule_change_request(cls, message: str) -> bool:
        """Use AI to detect if ANY message is requesting schedule changes - NO HARDCODING"""
        try:
            import openai
            import os
            from django.conf import settings
            
            openai_api_key = getattr(settings, 'OPENAI_API_KEY', None) or os.getenv('OPENAI_API_KEY')
            
            if not openai_api_key:
                # Fallback: assume any message could be a schedule request
                return True
            
            client = openai.OpenAI(api_key=openai_api_key)
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{
                    "role": "system",
                    "content": """You are an AI that detects if a user message is requesting ANY kind of schedule change or modification.

Users can ask for ANYTHING related to changing their schedule in ANY way they want. Be very liberal in detection.

Examples that should return TRUE:
- "make a new schedule"
- "I don't like this"
- "change everything"
- "something different"
- "try again"
- "not good"
- "better options"
- "modify my classes"
- "different time"
- "I want morning classes"
- "no conflicts"
- "easier schedule"
- "harder classes"
- "less walking"
- "same building"
- "different professor"
- "update this"
- "improve my schedule"
- "other choices"
- "alternatives"
- "switch courses"
- literally ANY request for changes

Only return FALSE if the message is clearly NOT about schedule changes (like asking for course information, general questions, etc.)

Respond with only 'true' or 'false'."""
                }, {
                    "role": "user", 
                    "content": message
                }],
                max_tokens=10,
                temperature=0.1
            )
            
            result = response.choices[0].message.content.strip().lower()
            return result == 'true'
            
        except Exception as e:
            logger.error(f"Error in AI schedule change detection: {e}")
            # Fallback: assume it could be a schedule request
            return True 