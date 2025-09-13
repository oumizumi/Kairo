from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
import uuid

class Professor(models.Model):
    name = models.CharField(max_length=255)
    title = models.CharField(max_length=255, blank=True) # e.g., "Associate Professor", "Lecturer"
    department = models.CharField(max_length=255, blank=True) # e.g., "Computer Science", "Mathematics"
    # Email can be optional and might not always be unique if some entries lack it.
    # However, if an email is provided, it should ideally be unique.
    # Setting unique=True with null=True means the uniqueness constraint
    # will not apply to NULL values (in most databases like PostgreSQL).
    email = models.EmailField(unique=True, blank=True, null=True)
    bio = models.TextField(blank=True)
    # phone_number = models.CharField(max_length=20, blank=True) # Example of another potential field
    # office_location = models.CharField(max_length=100, blank=True) # Example

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']


class Course(models.Model):
    code = models.CharField(max_length=10, unique=True)  # Now required after migration
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    units = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)  # Optional field
    prerequisites = models.TextField(blank=True, null=True)
    department = models.CharField(max_length=255, blank=True)
    
    # A course can be taught by multiple professors, and a professor can teach multiple courses.
    professors = models.ManyToManyField(
        Professor, 
        blank=True, 
        related_name='courses',
        through='CourseProfessorLink'
    )

    def __str__(self):
        return f"{self.code} - {self.title}"

    class Meta:
        ordering = ['code']


class Term(models.Model):
    name = models.CharField(max_length=100, unique=True)  # e.g., "Fall 2024"
    term_code = models.CharField(max_length=20, unique=True)  # e.g., "2249"
    season = models.CharField(max_length=50)  # e.g., "Fall", "Winter", "SpringSummer"

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['-term_code']


class CourseOffering(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='offerings')
    term = models.ForeignKey(Term, on_delete=models.CASCADE, related_name='offerings')
    section = models.CharField(max_length=20)  # e.g., "A00"
    instructor = models.CharField(max_length=255)  # e.g., "Prof. Ada Lovelace"
    schedule = models.TextField()  # can store complex schedule strings
    location = models.CharField(max_length=255)  # e.g., "ONLINE", "STEM Hall 101"

    def __str__(self):
        return f"{self.course.code} - {self.section} ({self.term.name})"

    class Meta:
        unique_together = ('course', 'term', 'section')


class CourseProfessorLink(models.Model):
    """
    Explicit through model for the ManyToMany relationship
    between Course and Professor. This allows adding extra attributes
    to the relationship itself in the future, e.g., semester_taught.
    """
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    professor = models.ForeignKey(Professor, on_delete=models.CASCADE)
    # Example of an additional field:
    # semester_taught = models.CharField(max_length=50, blank=True, null=True

    class Meta:
        unique_together = ('course', 'professor') # Ensure a professor is not listed twice for the same course

    def __str__(self):
        return f"{self.professor.name} teaches {self.course.code}"


class Message(models.Model):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='messages')
    session_id = models.UUIDField(default=uuid.uuid4, editable=False)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)

    def __str__(self):
        return f"{self.user.username} ({self.role} at {self.timestamp.strftime('%Y-%m-%d %H:%M')}): {self.content[:50]}"

    class Meta:
        ordering = ['timestamp']


class CalendarEvent(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='calendar_events')
    title = models.CharField(max_length=200)
    
    # For recurring weekly events
    day_of_week = models.CharField(max_length=10, blank=True, null=True)  # e.g., "Monday", "Tuesday"
    start_time = models.TimeField(blank=True, null=True)
    end_time = models.TimeField(blank=True, null=True)
    
    # For specific date events
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    
    # Optional fields
    description = models.TextField(blank=True)
    professor = models.CharField(max_length=200, blank=True)  # Professor name
    
    # Recurrence fields
    RECURRENCE_CHOICES = [
        ('weekly', 'Weekly'),
        ('biweekly', 'Bi-weekly'),
        ('none', 'None'),
    ]
    recurrence_pattern = models.CharField(max_length=10, choices=RECURRENCE_CHOICES, default='weekly', blank=True)
    reference_date = models.DateField(blank=True, null=True)  # Reference date for bi-weekly events
    
    # Theme field for event colors
    THEME_CHOICES = [
        ('lavender-peach', 'Lavender Peach'),
        ('indigo-sunset', 'Indigo Sunset'),
        ('cotton-candy', 'Cotton Candy'),
        ('blue-purple-magenta', 'Blue Purple Magenta'),
        ('deep-plum-coral', 'Deep Plum Coral'),
        ('classic-black-white', 'Classic Black White'),
        ('midnight-ivory', 'Midnight Ivory'),
        ('cosmic-galaxy', 'Cosmic Galaxy'),
        ('twilight-sunset', 'Twilight Sunset'),
        # Blue Gradients - Only keeping 2 as requested
        ('midnight-light-blue', 'Midnight to Light Blue'),
        ('midnight-indigo-blue-cyan', 'Midnight to Indigo to Blue to Cyan'),
        # Red Gradients - Only keeping 1 as requested
        ('black-deep-bright', 'Black to Deep to Bright Red'),
        # New Vibrant Gradients - Two-tone combinations
        ('green-blue', 'Green Blue'),
        ('warm-brown', 'Warm Brown'),
        ('lime-green', 'Lime Green'),
        ('mint-teal', 'Mint Teal'),
        # Newly added themes (must match frontend EVENT_THEMES)
        ('peach-mint', 'Peach Mint'),
        ('sky-lavender', 'Sky Lavender'),
        ('sunset-gold', 'Sunset Gold'),
        ('forest-moss', 'Forest Moss'),
    ]
    theme = models.CharField(max_length=40, choices=THEME_CHOICES, default='lavender-peach', blank=True)

    def __str__(self):
        if self.start_date:
            return f"{self.title} for {self.user.username} on {self.start_date}"
        else:
            return f"{self.title} for {self.user.username} on {self.day_of_week} at {self.start_time}"

    class Meta:
        ordering = ['user', 'start_date', 'day_of_week', 'start_time']


class ImportantDate(models.Model):
    CATEGORY_CHOICES = [
        ('holiday', 'Holiday'),
        ('enrollment', 'Enrollment'),
        ('exam', 'Exam'),
        ('payment', 'Tuition Payment'),
        ('scholarship', 'Scholarship'),
        ('religious', 'Religious Holiday'),
        ('service', 'Student Service'),
        ('research', 'Research & Thesis'),
        ('program', 'Program Change'),
        ('other', 'Other')
    ]

    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    link = models.URLField(null=True, blank=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['start_date', 'title']


class ExamEvent(models.Model):
    course_code = models.CharField(max_length=10)
    title = models.CharField(max_length=255)  # Final Exam, Deferred Exam, Midterm, etc.
    description = models.TextField()
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    location = models.CharField(max_length=255)
    is_deferred = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.course_code} - {self.title} on {self.date}"

    class Meta:
        ordering = ['date', 'start_time']


# User profile to store additional user information
class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    program = models.CharField(max_length=200, blank=True, null=True)  # Store program name
    profile_pic = models.URLField(blank=True, null=True)  # Profile picture URL
    bio = models.TextField(max_length=500, blank=True)  # User bio for social features
    banner_style = models.CharField(max_length=50, blank=True, null=True)  # UI banner preference key
    profile_mode = models.CharField(max_length=50, blank=True, null=True)  # e.g., lock-in, study, chill
    
    def __str__(self):
        return f"{self.user.username}'s profile"

    class Meta:
        ordering = ['user__username']


# Signal to automatically create UserProfile when User is created
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()


# User Calendar Models
class UserCalendar(models.Model):
    """Store user's persistent calendar events"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_calendar_events')
    
    # Event details
    title = models.CharField(max_length=200)
    start_time = models.TimeField()  # Proper time field
    end_time = models.TimeField()    # Proper time field
    day_of_week = models.CharField(max_length=20, blank=True, null=True)  # "Monday"
    start_date = models.DateField(blank=True, null=True)   # Proper date field
    end_date = models.DateField(blank=True, null=True)     # Proper date field
    
    # Optional fields
    description = models.TextField(blank=True, null=True)
    professor = models.CharField(max_length=100, blank=True, null=True)
    location = models.CharField(max_length=100, blank=True, null=True)
    
    # Recurrence and theme
    RECURRENCE_CHOICES = [
        ('weekly', 'Weekly'),
        ('biweekly', 'Biweekly'), 
        ('none', 'None'),
    ]
    recurrence_pattern = models.CharField(
        max_length=20, 
        choices=RECURRENCE_CHOICES,
        default='weekly'
    )
    reference_date = models.DateField(blank=True, null=True)  # Proper date field
    
    # Theme choices matching CalendarEvent model
    THEME_CHOICES = [
        ('lavender-peach', 'Lavender Peach'),
        ('indigo-sunset', 'Indigo Sunset'),
        ('cotton-candy', 'Cotton Candy'),
        ('blue-purple-magenta', 'Blue Purple Magenta'),
        ('deep-plum-coral', 'Deep Plum Coral'),
        ('classic-black-white', 'Classic Black White'),
        ('midnight-ivory', 'Midnight Ivory'),
        ('cosmic-galaxy', 'Cosmic Galaxy'),
        ('twilight-sunset', 'Twilight Sunset'),
        ('midnight-light-blue', 'Midnight to Light Blue'),
        ('midnight-indigo-blue-cyan', 'Midnight to Indigo to Blue to Cyan'),
        ('black-deep-bright', 'Black to Deep to Bright Red'),
        ('green-blue', 'Green Blue'),
        ('warm-brown', 'Warm Brown'),
        ('lime-green', 'Lime Green'),
        ('mint-teal', 'Mint Teal'),
        ('blue-gradient', 'Blue Gradient'),  # Keep existing default
        # Newly added themes to match frontend
        ('peach-mint', 'Peach Mint'),
        ('sky-lavender', 'Sky Lavender'),
        ('sunset-gold', 'Sunset Gold'),
        ('forest-moss', 'Forest Moss'),
    ]
    theme = models.CharField(max_length=50, choices=THEME_CHOICES, default='blue-gradient')
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['day_of_week', 'start_time']
        indexes = [
            models.Index(fields=['user', 'day_of_week']),
            models.Index(fields=['user', 'start_date']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.title} ({self.day_of_week} {self.start_time}-{self.end_time})"


class SharedSchedule(models.Model):
    """Store shared schedule snapshots"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shared_schedules')
    
    # Schedule metadata
    title = models.CharField(max_length=200, default="My Schedule")
    term = models.CharField(max_length=100, blank=True, null=True)  # e.g., "Fall 2024"
    
    # Schedule data (JSON field to store the complete schedule)
    schedule_data = models.JSONField()  # Will contain events, colors, term info, etc.
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    view_count = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"Shared Schedule: {self.title} by {self.user.username}"





