"""
Scraper Integration Service

Handles communication with the Express scraper API and manages data versioning
to ensure the schedule builder always uses current data.
"""

import requests
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from django.core.cache import cache
from django.conf import settings
import hashlib
import json

logger = logging.getLogger(__name__)

class ScraperIntegrationService:
    """Service to integrate with the Express scraper API"""
    
    def __init__(self):
        # Default to development scraper URL, override in production
        self.scraper_base_url = getattr(settings, 'SCRAPER_API_URL', 'http://localhost:4000')
        self.cache_timeout = 3600  # 1 hour cache
        self.dataset_version = None
        
    def get_available_terms(self) -> List[Dict[str, Any]]:
        """
        Get list of available terms from scraper
        
        Returns:
            List of terms with IDs and date ranges
        """
        try:
            cache_key = 'scraper_terms'
            cached_terms = cache.get(cache_key)
            
            if cached_terms:
                logger.info("[SCRAPER] Using cached terms data")
                return cached_terms
            
            url = f"{self.scraper_base_url}/api/terms"
            response = requests.get(url, timeout=30)
            
            if response.status_code == 200:
                terms = response.json()
                
                # Cache the terms data
                cache.set(cache_key, terms, self.cache_timeout)
                
                # Update dataset version if provided
                etag = response.headers.get('etag')
                if etag:
                    self.dataset_version = etag
                    cache.set('scraper_dataset_version', etag, self.cache_timeout * 24)  # Cache longer
                
                logger.info(f"[SCRAPER] Retrieved {len(terms)} terms from API")
                return terms
            else:
                logger.error(f"[SCRAPER] Failed to fetch terms: {response.status_code}")
                return self._get_fallback_terms()
                
        except Exception as e:
            logger.error(f"[SCRAPER] Error fetching terms: {e}")
            return self._get_fallback_terms()
    
    def get_sections_for_term(self, term: str, subject: str = None) -> List[Dict[str, Any]]:
        """
        Get course sections for a specific term
        
        Args:
            term: Term ID (e.g., "2025FALL", "2026WINTER")
            subject: Optional subject filter (e.g., "CSI")
            
        Returns:
            List of course sections with full details
        """
        try:
            # Create cache key based on term and subject
            cache_key = f"scraper_sections_{term}_{subject or 'all'}"
            cached_sections = cache.get(cache_key)
            
            # Check if we have valid cached data
            if cached_sections and self._is_cache_valid(cache_key):
                logger.info(f"[SCRAPER] Using cached sections for {term}/{subject}")
                return cached_sections
            
            # Build API URL
            url = f"{self.scraper_base_url}/api/sections"
            params = {'term': term}
            if subject:
                params['subject'] = subject
            
            response = requests.get(url, params=params, timeout=60)
            
            if response.status_code == 200:
                sections = response.json()
                
                # Cache the sections data
                cache.set(cache_key, sections, self.cache_timeout)
                cache.set(f"{cache_key}_timestamp", datetime.now().isoformat(), self.cache_timeout)
                
                # Update dataset version
                etag = response.headers.get('etag')
                if etag:
                    self.dataset_version = etag
                    cache.set('scraper_dataset_version', etag, self.cache_timeout * 24)
                
                logger.info(f"[SCRAPER] Retrieved {len(sections)} sections for {term}/{subject}")
                return sections
            else:
                logger.error(f"[SCRAPER] Failed to fetch sections: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"[SCRAPER] Error fetching sections for {term}/{subject}: {e}")
            return []
    
    def get_course_catalogue(self, course_code: str) -> Optional[Dict[str, Any]]:
        """
        Get course catalogue information (prerequisites, credits, description)
        
        Args:
            course_code: Course code (e.g., "CSI 2110")
            
        Returns:
            Course catalogue information or None
        """
        try:
            cache_key = f"scraper_catalogue_{course_code.replace(' ', '')}"
            cached_info = cache.get(cache_key)
            
            if cached_info:
                logger.info(f"[SCRAPER] Using cached catalogue for {course_code}")
                return cached_info
            
            url = f"{self.scraper_base_url}/api/catalogue"
            params = {'course': course_code}
            
            response = requests.get(url, params=params, timeout=30)
            
            if response.status_code == 200:
                catalogue_info = response.json()
                
                # Cache for longer since catalogue info changes less frequently
                cache.set(cache_key, catalogue_info, self.cache_timeout * 24)
                
                logger.info(f"[SCRAPER] Retrieved catalogue info for {course_code}")
                return catalogue_info
            else:
                logger.warning(f"[SCRAPER] No catalogue info found for {course_code}")
                return None
                
        except Exception as e:
            logger.error(f"[SCRAPER] Error fetching catalogue for {course_code}: {e}")
            return None
    
    def get_all_courses_for_term(self, term: str) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get all courses organized by subject for a term
        
        Args:
            term: Term ID
            
        Returns:
            Dictionary mapping subject codes to course lists
        """
        try:
            # Get all sections for the term (no subject filter)
            all_sections = self.get_sections_for_term(term)
            
            if not all_sections:
                logger.warning(f"[SCRAPER] No sections found for term {term}")
                return {}
            
            # Group sections by course code
            courses_by_code = {}
            for section in all_sections:
                course_code = section.get('courseCode', '').replace(' ', '').upper()
                if not course_code:
                    continue
                    
                if course_code not in courses_by_code:
                    courses_by_code[course_code] = []
                
                courses_by_code[course_code].append(section)
            
            logger.info(f"[SCRAPER] Organized {len(courses_by_code)} courses for {term}")
            return courses_by_code
            
        except Exception as e:
            logger.error(f"[SCRAPER] Error organizing courses for {term}: {e}")
            return {}
    
    def check_dataset_version(self) -> str:
        """
        Check current dataset version from scraper
        
        Returns:
            Current dataset version/ETag
        """
        try:
            # Try to get version from cache first
            cached_version = cache.get('scraper_dataset_version')
            if cached_version:
                return cached_version
            
            # Make a lightweight request to check version
            url = f"{self.scraper_base_url}/api/version"
            response = requests.head(url, timeout=10)
            
            etag = response.headers.get('etag', '')
            if etag:
                cache.set('scraper_dataset_version', etag, self.cache_timeout * 24)
                return etag
            
            # Fallback: generate version from current timestamp
            fallback_version = hashlib.md5(str(datetime.now().date()).encode()).hexdigest()[:12]
            return fallback_version
            
        except Exception as e:
            logger.warning(f"[SCRAPER] Could not check dataset version: {e}")
            return hashlib.md5(str(datetime.now().date()).encode()).hexdigest()[:12]
    
    def invalidate_cache_if_stale(self, current_version: str = None) -> bool:
        """
        Check if cached data is stale and invalidate if necessary
        
        Args:
            current_version: Known current version to compare against
            
        Returns:
            True if cache was invalidated
        """
        try:
            if not current_version:
                current_version = self.check_dataset_version()
            
            cached_version = cache.get('scraper_dataset_version')
            
            if cached_version != current_version:
                logger.info(f"[SCRAPER] Dataset version changed ({cached_version} -> {current_version}), invalidating cache")
                
                # Clear all scraper-related cache
                cache_keys = [
                    'scraper_terms',
                    'scraper_dataset_version'
                ]
                
                # Clear section caches (pattern-based)
                # Note: Django cache doesn't support pattern deletion, so we track keys
                section_cache_keys = cache.get('scraper_section_cache_keys', [])
                cache_keys.extend(section_cache_keys)
                
                for key in cache_keys:
                    cache.delete(key)
                
                # Update to new version
                cache.set('scraper_dataset_version', current_version, self.cache_timeout * 24)
                cache.delete('scraper_section_cache_keys')
                
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"[SCRAPER] Error checking cache staleness: {e}")
            return False
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid"""
        try:
            timestamp_key = f"{cache_key}_timestamp"
            cached_timestamp = cache.get(timestamp_key)
            
            if not cached_timestamp:
                return False
            
            cached_time = datetime.fromisoformat(cached_timestamp)
            return datetime.now() - cached_time < timedelta(seconds=self.cache_timeout)
            
        except Exception:
            return False
    
    def _get_fallback_terms(self) -> List[Dict[str, Any]]:
        """Fallback terms when scraper is unavailable"""
        current_year = datetime.now().year
        
        return [
            {
                'id': f'{current_year}FALL',
                'name': f'Fall {current_year}',
                'start_date': f'{current_year}-09-03',
                'end_date': f'{current_year}-12-02'
            },
            {
                'id': f'{current_year + 1}WINTER',
                'name': f'Winter {current_year + 1}',
                'start_date': f'{current_year + 1}-01-12',
                'end_date': f'{current_year + 1}-04-15'
            }
        ]
    
    def normalize_term_id(self, term_input: str) -> str:
        """
        Normalize various term inputs to standard format
        
        Args:
            term_input: User input like "Fall", "Winter 2025", etc.
            
        Returns:
            Standardized term ID like "2025FALL"
        """
        term_input = term_input.strip().lower()
        current_year = datetime.now().year
        
        # Extract year if present
        year = current_year
        if any(char.isdigit() for char in term_input):
            year_match = ''.join(char for char in term_input if char.isdigit())
            if len(year_match) == 4:
                year = int(year_match)
        
        # Determine season
        if 'fall' in term_input or 'autumn' in term_input:
            return f"{year}FALL"
        elif 'winter' in term_input:
            return f"{year}WINTER"
        elif 'spring' in term_input or 'summer' in term_input:
            return f"{year}SUMMER"
        
        # Default to fall of current year
        return f"{current_year}FALL"
    
    def get_term_date_range(self, term_id: str) -> Tuple[str, str]:
        """
        Get start and end dates for a term
        
        Args:
            term_id: Term ID like "2025FALL"
            
        Returns:
            Tuple of (start_date, end_date) as ISO strings
        """
        try:
            terms = self.get_available_terms()
            
            for term in terms:
                if term.get('id') == term_id:
                    return term.get('start_date', ''), term.get('end_date', '')
            
            # Fallback calculation
            year = int(term_id[:4]) if term_id[:4].isdigit() else datetime.now().year
            season = term_id[4:].upper()
            
            if season == 'FALL':
                return f"{year}-09-03", f"{year}-12-02"
            elif season == 'WINTER':
                return f"{year}-01-12", f"{year}-04-15"
            elif season == 'SUMMER':
                return f"{year}-05-05", f"{year}-07-29"
            
            return f"{year}-09-03", f"{year}-12-02"
            
        except Exception as e:
            logger.error(f"[SCRAPER] Error getting date range for {term_id}: {e}")
            year = datetime.now().year
            return f"{year}-09-03", f"{year}-12-02"


# Global instance
scraper_service = ScraperIntegrationService()
