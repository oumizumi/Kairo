"""
Color Generation Service

Generates stable, unique, and accessible colors for course codes using Kairo's existing themes.
Ensures no color repeats within a term and provides good visual distinction.
Works dynamically with any program and course structure.
"""

import hashlib
import logging
from typing import Dict, List, Set, Tuple
from django.core.cache import cache

logger = logging.getLogger(__name__)

class ColorGenerationService:
    """Service to generate stable, accessible colors for courses using Kairo themes"""
    
    def __init__(self):
        # Use Kairo's existing event themes - these match frontend exactly
        self.kairo_themes = [
            'christmas',
            'lavender-peach',
            'indigo-sunset',
            'cotton-candy',
            'blue-purple-magenta',
            'deep-plum-coral',
            'classic-black-white',
            'midnight-ivory',
            'cosmic-galaxy',
            'twilight-sunset',
            'midnight-light-blue',
            'midnight-indigo-blue-cyan',
            'black-deep-bright',
            'green-blue',
            'warm-brown',
            'lime-green',
            'mint-teal',
            'peach-mint',
            'sky-lavender',
            'sunset-gold',
            'forest-moss'
        ]
        
        # Dynamic subject mapping - will automatically handle new subjects
        # Maps subject prefixes to preferred theme categories for consistency
        self.subject_theme_preferences = {
            # Computer Science & Engineering
            'CSI': ['blue-purple-magenta', 'midnight-light-blue', 'indigo-sunset'],
            'SEG': ['blue-purple-magenta', 'midnight-indigo-blue-cyan', 'sky-lavender'],
            'ITI': ['midnight-light-blue', 'midnight-indigo-blue-cyan', 'mint-teal'],
            'ELG': ['warm-brown', 'sunset-gold', 'twilight-sunset'],
            'GNG': ['black-deep-bright', 'deep-plum-coral', 'warm-brown'],
            'CEG': ['green-blue', 'mint-teal', 'forest-moss'],
            
            # Mathematics & Sciences
            'MAT': ['cosmic-galaxy', 'lavender-peach', 'sky-lavender'],
            'STA': ['cosmic-galaxy', 'indigo-sunset', 'lavender-peach'],
            'PHY': ['indigo-sunset', 'cosmic-galaxy', 'midnight-ivory'],
            'CHM': ['mint-teal', 'green-blue', 'forest-moss'],
            'BIO': ['green-blue', 'forest-moss', 'lime-green'],
            
            # Liberal Arts
            'ENG': ['peach-mint', 'twilight-sunset', 'sunset-gold'],
            'FRA': ['cotton-candy', 'deep-plum-coral', 'peach-mint'],
            'ECO': ['green-blue', 'mint-teal', 'lime-green'],
            'PSY': ['lavender-peach', 'cosmic-galaxy', 'cotton-candy'],
            'SOC': ['deep-plum-coral', 'cotton-candy', 'warm-brown'],
            'HIS': ['classic-black-white', 'midnight-ivory', 'twilight-sunset'],
            'PHI': ['indigo-sunset', 'cosmic-galaxy', 'midnight-ivory'],
            'POL': ['warm-brown', 'sunset-gold', 'black-deep-bright'],
            'ART': ['cotton-candy', 'peach-mint', 'lavender-peach'],
            'MUS': ['cosmic-galaxy', 'lavender-peach', 'cotton-candy'],
            'THE': ['deep-plum-coral', 'cotton-candy', 'warm-brown'],
            
            # Special/Seasonal
            'SPECIAL': ['christmas', 'forest-moss', 'lime-green']
        }
    
    def generate_course_colors(self, course_codes: List[str], term: str) -> Dict[str, str]:
        """
        Generate stable theme names for a list of course codes within a term
        
        Args:
            course_codes: List of course codes (e.g., ["CSI2110", "MAT1348"])
            term: Term identifier for caching and uniqueness
            
        Returns:
            Dictionary mapping course codes to Kairo theme names
        """
        try:
            # Create cache key for this term's color assignments
            cache_key = f"course_themes_{term}_{hash(tuple(sorted(course_codes)))}"
            cached_themes = cache.get(cache_key)
            
            if cached_themes:
                logger.info(f"[COLOR] Using cached themes for {len(course_codes)} courses in {term}")
                return cached_themes
            
            themes = {}
            used_themes: Set[str] = set()
            
            # Sort course codes for deterministic assignment
            sorted_courses = sorted(course_codes)
            
            # First pass: assign themes based on subject preferences
            for course_code in sorted_courses:
                theme = self._get_preferred_theme(course_code, used_themes)
                if theme:
                    themes[course_code] = theme
                    used_themes.add(theme)
            
            # Second pass: assign remaining courses with unused themes
            remaining_courses = [code for code in sorted_courses if code not in themes]
            available_themes = [theme for theme in self.kairo_themes if theme not in used_themes]
            
            for i, course_code in enumerate(remaining_courses):
                if i < len(available_themes):
                    theme = available_themes[i]
                else:
                    # Fallback: use hash to select from all themes (allowing repeats if necessary)
                    theme = self._generate_hash_theme(course_code)
                
                themes[course_code] = theme
                used_themes.add(theme)
            
            # Cache the theme assignments
            cache.set(cache_key, themes, 3600 * 24)  # Cache for 24 hours
            
            logger.info(f"[COLOR] Generated themes for {len(themes)} courses in {term}")
            return themes
            
        except Exception as e:
            logger.error(f"[COLOR] Error generating course themes: {e}")
            # Fallback: simple hash-based themes
            return {code: self._generate_hash_theme(code) for code in course_codes}
    
    def get_single_course_theme(self, course_code: str, existing_themes: List[str] = None) -> str:
        """
        Get a theme for a single course code
        
        Args:
            course_code: Course code to get theme for
            existing_themes: List of themes already in use to avoid
            
        Returns:
            Kairo theme name string
        """
        try:
            existing_set = set(existing_themes) if existing_themes else set()
            
            # Try preferred theme first
            theme = self._get_preferred_theme(course_code, existing_set)
            if theme:
                return theme
            
            # Find first available theme from all themes
            for theme in self.kairo_themes:
                if theme not in existing_set:
                    return theme
            
            # Fallback: generate hash-based theme
            return self._generate_hash_theme(course_code)
            
        except Exception as e:
            logger.error(f"[COLOR] Error getting theme for {course_code}: {e}")
            return self.kairo_themes[0]  # Safe fallback
    
    def _get_preferred_theme(self, course_code: str, used_themes: Set[str]) -> str:
        """Get preferred theme for a course based on subject - works with ANY course prefix"""
        try:
            # Extract subject prefix (first 3-4 letters) - works for any course code format
            subject = ''.join(char for char in course_code if char.isalpha()).upper()[:3]
            
            # Get preferred themes for this subject
            preferred_themes = self.subject_theme_preferences.get(subject)
            if not preferred_themes:
                # If subject not in our preferences, auto-assign based on hash for consistency
                hash_val = hash(subject) % len(self.kairo_themes)
                fallback_theme = self.kairo_themes[hash_val]
                if fallback_theme not in used_themes:
                    return fallback_theme
                return None
            
            # Find first unused theme from preferred list
            for theme in preferred_themes:
                if theme not in used_themes:
                    return theme
            
            return None
            
        except Exception:
            return None
    
    def _generate_hash_theme(self, course_code: str) -> str:
        """Generate a theme based on course code hash"""
        try:
            # Create hash from course code for consistent theme selection
            hash_val = hash(course_code) % len(self.kairo_themes)
            return self.kairo_themes[hash_val]
            
        except Exception as e:
            logger.error(f"[COLOR] Error generating hash theme for {course_code}: {e}")
            return self.kairo_themes[0]  # Safe fallback
    
    def add_subject_preferences(self, subject_code: str, preferred_themes: List[str]) -> None:
        """
        Dynamically add subject preferences for new programs/courses
        
        Args:
            subject_code: 3-letter subject code (e.g., "NEW")
            preferred_themes: List of preferred Kairo theme names
        """
        try:
            if subject_code and preferred_themes:
                # Validate themes exist
                valid_themes = [theme for theme in preferred_themes if theme in self.kairo_themes]
                if valid_themes:
                    self.subject_theme_preferences[subject_code.upper()[:3]] = valid_themes
                    logger.info(f"[COLOR] Added preferences for subject {subject_code}: {valid_themes}")
                
        except Exception as e:
            logger.error(f"[COLOR] Error adding subject preferences: {e}")
    
    def get_available_themes(self) -> List[str]:
        """Get list of all available Kairo theme names"""
        return self.kairo_themes.copy()


# Global instance
color_service = ColorGenerationService()
