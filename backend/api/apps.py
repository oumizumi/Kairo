from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)

class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'
    
    def ready(self):
        """Called when Django starts up"""
        try:
            # Import signals to ensure they're loaded
            from . import models  # This will load the signals
            
            # Import here to avoid circular imports
            from .services.professor_file_watcher import setup_auto_sync
            
            # Start auto-sync if enabled in settings
            from django.conf import settings
            
            # Check if auto-sync is enabled (default to False for now to fix login issues)
            auto_sync_enabled = getattr(settings, 'PROFESSOR_AUTO_SYNC_ENABLED', False)
            
            if auto_sync_enabled:
                logger.info("Starting professor auto-sync on Django startup...")
                setup_auto_sync()
                logger.info("Professor auto-sync initialized successfully")
            else:
                logger.info("Professor auto-sync is disabled in settings")
                
        except Exception as e:
            logger.error(f"Failed to initialize professor auto-sync: {e}")
            # Don't raise exception to avoid breaking Django startup
