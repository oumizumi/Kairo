from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Check if users exist in the database'

    def handle(self, *args, **options):
        users = User.objects.all()
        self.stdout.write(f"Found {users.count()} users in the database:")
        
        for user in users:
            self.stdout.write(f"- {user.username} ({user.email}) - {'Active' if user.is_active else 'Inactive'}")
        
        if users.count() == 0:
            self.stdout.write(self.style.WARNING("No users found in the database!"))
            self.stdout.write("You may need to create a user first using:")
            self.stdout.write("python manage.py createsuperuser") 