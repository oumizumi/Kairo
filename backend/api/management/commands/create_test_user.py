from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Create a test user for login testing'

    def handle(self, *args, **options):
        # Check if test user already exists
        if User.objects.filter(email='test@example.com').exists():
            self.stdout.write("Test user already exists!")
            return
        
        # Create test user
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User'
        )
        
        self.stdout.write(
            self.style.SUCCESS(f"Test user created successfully!")
        )
        self.stdout.write(f"Username: {user.username}")
        self.stdout.write(f"Email: {user.email}")
        self.stdout.write(f"Password: testpass123")
        self.stdout.write("You can now use these credentials to test login.") 