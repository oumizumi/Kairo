import os
import time
import threading
from pathlib import Path
from typing import Optional, Callable
import logging

logger = logging.getLogger(__name__)

class ProfessorFileWatcher:
    """File watcher service to monitor ids_with_names_2.0.txt for changes"""
    
    def __init__(self):
        self.rmp_scraper_path = Path(__file__).parent.parent.parent.parent / "rmp scraper"
        self.watch_file = self.rmp_scraper_path / "ids_with_names_2.0.txt"
        self.last_modified = 0
        self.is_watching = False
        self.watch_thread = None
        self.check_interval = 30  # Check every 30 seconds
        self.sync_callback: Optional[Callable] = None
        
    def start_watching(self, sync_callback: Callable = None):
        """Start watching the file for changes"""
        if self.is_watching:
            logger.warning("File watcher is already running")
            return
            
        self.sync_callback = sync_callback
        self.is_watching = True
        
        # Initialize last modified time
        if self.watch_file.exists():
            self.last_modified = self.watch_file.stat().st_mtime
            logger.info(f"Started watching {self.watch_file}")
        else:
            logger.warning(f"Watch file not found: {self.watch_file}")
            
        # Start the watching thread
        self.watch_thread = threading.Thread(target=self._watch_loop, daemon=True)
        self.watch_thread.start()
        
    def stop_watching(self):
        """Stop watching the file"""
        self.is_watching = False
        if self.watch_thread and self.watch_thread.is_alive():
            self.watch_thread.join(timeout=5)
        logger.info("Stopped file watching")
        
    def _watch_loop(self):
        """Main watching loop that runs in a separate thread"""
        while self.is_watching:
            try:
                if self.watch_file.exists():
                    current_modified = self.watch_file.stat().st_mtime
                    
                    if current_modified > self.last_modified:
                        logger.info(f"Detected change in {self.watch_file}")
                        self.last_modified = current_modified
                        
                        # Trigger sync if callback is provided
                        if self.sync_callback:
                            try:
                                # Wait a bit to ensure file write is complete
                                time.sleep(2)
                                self.sync_callback()
                                logger.info("Automatic synchronization completed")
                            except Exception as e:
                                logger.error(f"Error during automatic sync: {e}")
                        else:
                            logger.info("No sync callback provided, skipping automatic sync")
                            
                time.sleep(self.check_interval)
                
            except Exception as e:
                logger.error(f"Error in file watching loop: {e}")
                time.sleep(self.check_interval)
                
    def get_file_status(self) -> dict:
        """Get current file status"""
        try:
            if self.watch_file.exists():
                stat = self.watch_file.stat()
                return {
                    'file_exists': True,
                    'file_path': str(self.watch_file),
                    'file_size': stat.st_size,
                    'last_modified': stat.st_mtime,
                    'is_watching': self.is_watching,
                    'check_interval': self.check_interval
                }
            else:
                return {
                    'file_exists': False,
                    'file_path': str(self.watch_file),
                    'is_watching': self.is_watching,
                    'check_interval': self.check_interval
                }
        except Exception as e:
            logger.error(f"Error getting file status: {e}")
            return {
                'error': str(e),
                'file_path': str(self.watch_file),
                'is_watching': self.is_watching
            }

# Create a global instance for auto-sync functionality
professor_file_watcher = ProfessorFileWatcher()

def setup_auto_sync():
    """Setup automatic synchronization when file changes"""
    try:
        # Check if we're in a production environment where the file might not exist
        if not professor_file_watcher.watch_file.exists():
            logger.warning(f"Watch file not found: {professor_file_watcher.watch_file}")
            logger.info("Skipping auto-sync setup - file not available")
            return
            
        from .professor_sync_service import professor_sync_service
        
        def auto_sync_callback():
            """Callback function for automatic synchronization"""
            try:
                logger.info("Triggering automatic professor synchronization...")
                result = professor_sync_service.sync_professors(force_update=False)
                
                if result['success']:
                    logger.info(f"Auto-sync completed: {result['message']}")
                else:
                    logger.error(f"Auto-sync failed: {result['message']}")
                    
            except Exception as e:
                logger.error(f"Auto-sync callback error: {e}")
        
        # Start watching with auto-sync callback
        professor_file_watcher.start_watching(sync_callback=auto_sync_callback)
        logger.info("Auto-sync setup completed")
        
    except Exception as e:
        logger.error(f"Failed to setup auto-sync: {e}")
        # Don't raise the exception to avoid breaking the application

def stop_auto_sync():
    """Stop automatic synchronization"""
    professor_file_watcher.stop_watching()
    logger.info("Auto-sync stopped") 