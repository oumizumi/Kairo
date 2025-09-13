from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Synchronize professor data from ids_with_names_2.0.txt to professors_enhanced.json'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force update all professors regardless of changes',
        )
        parser.add_argument(
            '--check-only',
            action='store_true',
            help='Only check sync status without performing sync',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Enable verbose output',
        )
    
    def handle(self, *args, **options):
        try:
            from api.services.professor_sync_service import professor_sync_service
            
            verbose = options['verbose']
            
            if verbose:
                self.stdout.write(self.style.SUCCESS('Initializing professor synchronization...'))
            
            # Check sync status first
            status = professor_sync_service.get_sync_status()
            
            if verbose:
                self.stdout.write(f"Source file exists: {status.get('source_file_exists', False)}")
                self.stdout.write(f"Target file exists: {status.get('target_file_exists', False)}")
                self.stdout.write(f"Sync needed: {status.get('needs_sync', False)}")
            
            if options['check_only']:
                if status.get('needs_sync', False):
                    self.stdout.write(
                        self.style.WARNING('Professor data needs synchronization')
                    )
                    return
                else:
                    self.stdout.write(
                        self.style.SUCCESS('Professor data is up to date')
                    )
                    return
            
            # Check if source file exists
            if not status.get('source_file_exists', False):
                raise CommandError('Source file (ids_with_names_2.0.txt) not found')
            
            # Perform synchronization
            force_update = options['force']
            
            if verbose:
                self.stdout.write(f"Starting synchronization (force_update={force_update})...")
            
            result = professor_sync_service.sync_professors(force_update=force_update)
            
            if result['success']:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"✅ {result['message']}\n"
                        f"📊 Processed: {result['professors_processed']} professors\n"
                        f"➕ Added: {result['professors_added']} new professors\n"
                        f"🔄 Updated: {result['professors_updated']} existing professors\n"
                        f"📁 Total: {result.get('total_professors', 0)} professors in database"
                    )
                )
            else:
                raise CommandError(f"Synchronization failed: {result['message']}")
                
        except Exception as e:
            logger.error(f"Management command sync_professors failed: {e}")
            raise CommandError(f"Synchronization failed: {str(e)}")
            
        if verbose:
            self.stdout.write(self.style.SUCCESS('Professor synchronization completed successfully!')) 