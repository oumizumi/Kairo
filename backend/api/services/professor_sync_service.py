import json
import os
import re
from pathlib import Path
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

class ProfessorSyncService:
    """Service to synchronize professor data from ids_with_names_2.0.txt to professors_enhanced.json"""
    
    def __init__(self):
        self.rmp_scraper_path = Path(__file__).parent.parent.parent.parent / "rmp scraper"
        self.source_file = self.rmp_scraper_path / "ids_with_names_2.0.txt"
        self.target_file = Path(__file__).parent.parent / "data" / "professors_enhanced.json"
        
    def parse_professor_text_file(self) -> List[Dict]:
        """Parse the ids_with_names_2.0.txt file and extract professor data"""
        professors = []
        
        try:
            if not self.source_file.exists():
                logger.error(f"Source file not found: {self.source_file}")
                return professors
                
            with open(self.source_file, 'r', encoding='utf-8') as file:
                content = file.read()
                
            # Split by the separator pattern
            professor_blocks = content.split('--------------------------------------------------')
            
            for block in professor_blocks:
                block = block.strip()
                if not block:
                    continue
                    
                professor = self.parse_professor_block(block)
                if professor:
                    professors.append(professor)
                    
            logger.info(f"Successfully parsed {len(professors)} professors from text file")
            return professors
            
        except Exception as e:
            logger.error(f"Error parsing professor text file: {e}")
            return professors
    
    def parse_professor_block(self, block: str) -> Optional[Dict]:
        """Parse a single professor block from the text file"""
        try:
            lines = [line.strip() for line in block.split('\n') if line.strip()]
            
            professor = {
                "name": "",
                "title": "",
                "department": "",
                "email": None,
                "bio": "",
                "rmp_id": "",
                "rmp_rating": "",
                "rmp_difficulty": "",
                "rmp_would_take_again": "",
                "rmp_department": "",
                "has_rmp_data": True
            }
            
            for line in lines:
                if line.startswith('ID:'):
                    professor['rmp_id'] = line.replace('ID:', '').strip()
                elif line.startswith('Name:'):
                    professor['name'] = line.replace('Name:', '').strip()
                elif line.startswith('Department:'):
                    dept = line.replace('Department:', '').strip()
                    professor['rmp_department'] = dept
                elif line.startswith('Rating:'):
                    rating = line.replace('Rating:', '').strip()
                    # Extract just the numeric part (e.g., "4.2/5" -> "4.2")
                    rating_match = re.match(r'(\d+\.?\d*)', rating)
                    if rating_match:
                        professor['rmp_rating'] = rating_match.group(1)
                elif line.startswith('Difficulty:'):
                    difficulty = line.replace('Difficulty:', '').strip()
                    # Extract just the numeric part
                    diff_match = re.match(r'(\d+\.?\d*)', difficulty)
                    if diff_match:
                        professor['rmp_difficulty'] = diff_match.group(1)
                elif line.startswith('Would Take Again:'):
                    wta = line.replace('Would Take Again:', '').strip()
                    # Extract just the numeric part (e.g., "60%" -> "60")
                    wta_match = re.match(r'(\d+)', wta)
                    if wta_match:
                        professor['rmp_would_take_again'] = wta_match.group(1)
            
            # Only return if we have essential data
            if professor['name'] and professor['rmp_id']:
                return professor
            else:
                logger.warning(f"Incomplete professor data: {professor}")
                return None
                
        except Exception as e:
            logger.error(f"Error parsing professor block: {e}")
            return None
    
    def load_existing_professors(self) -> List[Dict]:
        """Load existing professors from the JSON file"""
        try:
            if self.target_file.exists():
                with open(self.target_file, 'r', encoding='utf-8') as file:
                    return json.load(file)
            else:
                logger.info("Target JSON file doesn't exist, will create new one")
                return []
        except Exception as e:
            logger.error(f"Error loading existing professors: {e}")
            return []
    
    def save_professors_json(self, professors: List[Dict]) -> bool:
        """Save professors to the JSON file"""
        try:
            # Ensure the target directory exists
            self.target_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Sort professors by name for consistent ordering
            professors_sorted = sorted(professors, key=lambda x: x.get('name', '').lower())
            
            with open(self.target_file, 'w', encoding='utf-8') as file:
                json.dump(professors_sorted, file, indent=2, ensure_ascii=False)
                
            logger.info(f"Successfully saved {len(professors)} professors to JSON file")
            return True
            
        except Exception as e:
            logger.error(f"Error saving professors to JSON: {e}")
            return False
    
    def sync_professors(self, force_update: bool = False) -> Dict:
        """
        Synchronize professors from text file to JSON file
        
        Args:
            force_update: If True, update all professors regardless of changes
            
        Returns:
            Dict with sync results
        """
        try:
            logger.info("Starting professor synchronization...")
            
            # Parse the text file
            text_professors = self.parse_professor_text_file()
            if not text_professors:
                return {
                    'success': False,
                    'message': 'No professors found in text file',
                    'professors_processed': 0,
                    'professors_added': 0,
                    'professors_updated': 0
                }
            
            # Load existing JSON data
            existing_professors = self.load_existing_professors()
            existing_by_id = {prof.get('rmp_id'): prof for prof in existing_professors}
            
            professors_added = 0
            professors_updated = 0
            final_professors = []
            
            # Process each professor from text file
            for text_prof in text_professors:
                rmp_id = text_prof.get('rmp_id')
                
                if rmp_id in existing_by_id:
                    # Update existing professor
                    existing_prof = existing_by_id[rmp_id]
                    
                    # Check if update is needed
                    needs_update = force_update or self.professor_needs_update(existing_prof, text_prof)
                    
                    if needs_update:
                        # Preserve existing fields not in text file
                        updated_prof = existing_prof.copy()
                        updated_prof.update({
                            'name': text_prof['name'],
                            'rmp_id': text_prof['rmp_id'],
                            'rmp_rating': text_prof['rmp_rating'],
                            'rmp_difficulty': text_prof['rmp_difficulty'],
                            'rmp_would_take_again': text_prof['rmp_would_take_again'],
                            'rmp_department': text_prof['rmp_department'],
                            'has_rmp_data': True
                        })
                        final_professors.append(updated_prof)
                        professors_updated += 1
                    else:
                        final_professors.append(existing_prof)
                else:
                    # Add new professor
                    final_professors.append(text_prof)
                    professors_added += 1
            
            # Add any existing professors that weren't in the text file
            text_ids = {prof['rmp_id'] for prof in text_professors}
            for existing_prof in existing_professors:
                if existing_prof.get('rmp_id') not in text_ids:
                    final_professors.append(existing_prof)
            
            # Save the updated data
            if self.save_professors_json(final_professors):
                return {
                    'success': True,
                    'message': f'Successfully synchronized professors',
                    'professors_processed': len(text_professors),
                    'professors_added': professors_added,
                    'professors_updated': professors_updated,
                    'total_professors': len(final_professors)
                }
            else:
                return {
                    'success': False,
                    'message': 'Failed to save synchronized data',
                    'professors_processed': len(text_professors),
                    'professors_added': professors_added,
                    'professors_updated': professors_updated
                }
                
        except Exception as e:
            logger.error(f"Error during professor synchronization: {e}")
            return {
                'success': False,
                'message': f'Synchronization failed: {str(e)}',
                'professors_processed': 0,
                'professors_added': 0,
                'professors_updated': 0
            }
    
    def professor_needs_update(self, existing: Dict, new: Dict) -> bool:
        """Check if a professor needs to be updated"""
        # Compare key fields to see if update is needed
        key_fields = ['name', 'rmp_rating', 'rmp_difficulty', 'rmp_would_take_again', 'rmp_department']
        
        for field in key_fields:
            if existing.get(field) != new.get(field):
                return True
        
        return False
    
    def get_sync_status(self) -> Dict:
        """Get the current sync status"""
        try:
            source_exists = self.source_file.exists()
            target_exists = self.target_file.exists()
            
            source_size = self.source_file.stat().st_size if source_exists else 0
            target_size = self.target_file.stat().st_size if target_exists else 0
            
            source_modified = self.source_file.stat().st_mtime if source_exists else 0
            target_modified = self.target_file.stat().st_mtime if target_exists else 0
            
            return {
                'source_file_exists': source_exists,
                'target_file_exists': target_exists,
                'source_file_size': source_size,
                'target_file_size': target_size,
                'source_last_modified': source_modified,
                'target_last_modified': target_modified,
                'needs_sync': source_modified > target_modified if source_exists and target_exists else source_exists,
                'source_file_path': str(self.source_file),
                'target_file_path': str(self.target_file)
            }
            
        except Exception as e:
            logger.error(f"Error getting sync status: {e}")
            return {
                'error': str(e)
            }

# Global instance
professor_sync_service = ProfessorSyncService() 