import requests
import os
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class ScraperClient:
    def __init__(self):
        self.base_url = os.environ.get('SCRAPER_API_URL', 'http://localhost:4000')
        self.timeout = 30  # 30 seconds timeout
    
    def scrape_courses(self, subject: str, term: str) -> List[Dict[str, Any]]:
        """
        Scrape courses for a given subject and term
        """
        try:
            url = f"{self.base_url}/api/scrape"
            params = {
                'subject': subject,
                'term': term
            }
            
            logger.info(f"Scraping courses: {subject} for {term}")
            response = requests.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            
            data = response.json()
            courses = data.get('data', [])
            
            logger.info(f"Successfully scraped {len(courses)} courses")
            return courses
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error scraping courses: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return []
    
    def health_check(self) -> bool:
        """
        Check if scraper service is healthy
        """
        try:
            response = requests.get(f"{self.base_url}/", timeout=5)
            return response.status_code == 200
        except:
            return False

# Global instance
scraper_client = ScraperClient() 