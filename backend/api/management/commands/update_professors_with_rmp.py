from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import Professor
import json
import os

class Command(BaseCommand):
    help = 'Update professors with RMP data from enhanced professors file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            default='api/data/professors_enhanced.json',
            help='Path to the enhanced professors JSON file'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes'
        )

    def handle(self, *args, **options):
        file_path = options['file']
        dry_run = options['dry_run']
        
        if not os.path.exists(file_path):
            self.stdout.write(
                self.style.ERROR(f'File not found: {file_path}')
            )
            return
        
        # Load enhanced professors data
        with open(file_path, 'r', encoding='utf-8') as f:
            professors_data = json.load(f)
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))
        
        updated_count = 0
        created_count = 0
        rmp_added_count = 0
        
        with transaction.atomic():
            for prof_data in professors_data:
                try:
                    # Try to find existing professor by name
                    professor, created = Professor.objects.get_or_create(
                        name=prof_data['name'],
                        defaults={
                            'title': prof_data.get('title', ''),
                            'department': prof_data.get('department', ''),
                            'email': prof_data.get('email'),
                            'bio': prof_data.get('bio', ''),
                        }
                    )
                    
                    if created:
                        created_count += 1
                        self.stdout.write(f'Created new professor: {professor.name}')
                    
                    # Check if we need to update with RMP data
                    needs_update = False
                    
                    # Update basic fields if they're empty or different
                    if prof_data.get('title') and professor.title != prof_data['title']:
                        if not dry_run:
                            professor.title = prof_data['title']
                        needs_update = True
                    
                    if prof_data.get('department') and professor.department != prof_data['department']:
                        if not dry_run:
                            professor.department = prof_data['department']
                        needs_update = True
                    
                    if prof_data.get('email') and professor.email != prof_data['email']:
                        if not dry_run:
                            professor.email = prof_data['email']
                        needs_update = True
                    
                    # Add RMP data as JSON in bio field (temporary solution)
                    if prof_data.get('has_rmp_data'):
                        rmp_data = {
                            'rmp_id': prof_data.get('rmp_id'),
                            'rmp_rating': prof_data.get('rmp_rating'),
                            'rmp_difficulty': prof_data.get('rmp_difficulty'),
                            'rmp_department': prof_data.get('rmp_department')
                        }
                        
                        # Check if RMP data is not already in bio
                        if 'rmp_id' not in (professor.bio or ''):
                            rmp_text = f"\nRMP Data: ID={rmp_data['rmp_id']}, Rating={rmp_data['rmp_rating']}/5, Difficulty={rmp_data['rmp_difficulty']}/5"
                            if not dry_run:
                                professor.bio = (professor.bio or '') + rmp_text
                            needs_update = True
                            rmp_added_count += 1
                            
                            self.stdout.write(
                                self.style.SUCCESS(
                                    f'Added RMP data for {professor.name}: '
                                    f'Rating={rmp_data["rmp_rating"]}, '
                                    f'Difficulty={rmp_data["rmp_difficulty"]}'
                                )
                            )
                    
                    if needs_update and not dry_run:
                        professor.save()
                        updated_count += 1
                    elif needs_update and dry_run:
                        updated_count += 1
                        self.stdout.write(f'Would update: {professor.name}')
                
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'Error processing {prof_data["name"]}: {str(e)}')
                    )
        
        # Print summary
        self.stdout.write('\n' + '='*50)
        self.stdout.write(self.style.SUCCESS('SUMMARY:'))
        self.stdout.write(f'Professors processed: {len(professors_data)}')
        self.stdout.write(f'Professors created: {created_count}')
        self.stdout.write(f'Professors updated: {updated_count}')
        self.stdout.write(f'RMP data added: {rmp_added_count}')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('This was a dry run - no actual changes were made'))
        else:
            self.stdout.write(self.style.SUCCESS('All changes have been saved to the database')) 