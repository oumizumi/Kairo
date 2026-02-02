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
    
    # Theme field for event colors - no choices constraint for flexibility
    theme = models.CharField(max_length=40, default='purple', blank=True)
    
    # Term field for filtering courses by semester
    term = models.CharField(max_length=100, blank=True, null=True)  # e.g., "2025 Fall Term", "Fall 2025"

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
    
    # Theme field - no choices constraint for flexibility
    theme = models.CharField(max_length=50, default='purple', blank=True)
    
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


class UserPreferences(models.Model):
    """Store user-specific preferences and settings"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='preferences')
    key = models.CharField(max_length=100)  # e.g., 'course-visibility', 'selected-sections'
    value = models.JSONField()  # Store any JSON data
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('user', 'key')  # Each user can have only one preference per key
        ordering = ['user', 'key']
        indexes = [
            models.Index(fields=['user', 'key']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.key}"


class Schedule(models.Model):
    """Auto-generated schedules for users"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='auto_schedules')
    
    # Schedule metadata
    term = models.CharField(max_length=50)  # e.g., "2025FALL", "2026WINTER"
    term_display = models.CharField(max_length=100)  # e.g., "Fall 2025", "Winter 2026"
    
    # Generation preferences and context
    preferences = models.JSONField(default=dict, blank=True)  # Time preferences, constraints, etc.
    generation_context = models.TextField(blank=True)  # Original user request
    
    # Status and metadata
    is_active = models.BooleanField(default=True)  # Only one active schedule per user per term
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Scraper version tracking for invalidation
    dataset_version = models.CharField(max_length=100, blank=True)  # ETag or version from scraper
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'term', 'is_active']),
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['dataset_version']),
        ]
        # Ensure only one active schedule per user per term
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'term'],
                condition=models.Q(is_active=True),
                name='unique_active_schedule_per_user_term'
            )
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.term_display} Schedule"


class ScheduleEntry(models.Model):
    """Individual course sections within a schedule"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name='entries')
    
    # Course identification
    course_code = models.CharField(max_length=20)  # e.g., "CSI2110"
    course_title = models.CharField(max_length=255)  # e.g., "Data Structures and Algorithms"
    section_code = models.CharField(max_length=20)  # e.g., "A01-LEC"
    
    # Section details
    component = models.CharField(max_length=10)  # e.g., "LEC", "LAB", "DGD", "TUT"
    
    # Schedule information
    day_of_week = models.CharField(max_length=20)  # e.g., "Monday"
    start_time = models.TimeField()
    end_time = models.TimeField()
    
    # Additional information
    instructor = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=255, blank=True)
    class_number = models.CharField(max_length=20, blank=True)  # Unique identifier from scraper
    
    # Visual styling
    color = models.CharField(max_length=50, blank=True)  # Stable color for this course
    
    # Date range for term
    start_date = models.DateField()
    end_date = models.DateField()
    
    class Meta:
        ordering = ['day_of_week', 'start_time']
        indexes = [
            models.Index(fields=['schedule', 'course_code']),
            models.Index(fields=['schedule', 'day_of_week', 'start_time']),
        ]
    
    def __str__(self):
        return f"{self.course_code} {self.section_code} - {self.day_of_week} {self.start_time}"


class ScheduleAdjustment(models.Model):
    """Track natural language adjustments made to schedules"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name='adjustments')
    
    # Adjustment details
    user_request = models.TextField()  # Original natural language request
    adjustment_type = models.CharField(max_length=50)  # e.g., "remove_course", "change_time", "prefer_instructor"
    
    # What was changed
    affected_courses = models.JSONField(default=list)  # List of course codes affected
    previous_state = models.JSONField(default=dict)  # Previous schedule state
    new_state = models.JSONField(default=dict)  # New schedule state
    
    # Processing status
    success = models.BooleanField(default=False)
    error_message = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['schedule', 'created_at']),
            models.Index(fields=['adjustment_type']),
        ]
    
    def __str__(self):
        return f"{self.schedule} - {self.adjustment_type} ({self.created_at})"






# AI Response Feedback Models
from django.core.validators import MinValueValidator, MaxValueValidator

class AIResponseFeedback(models.Model):
    """Model to collect feedback on AI-generated responses"""
    
    FEEDBACK_TYPE_CHOICES = [
        ('email', 'Email Generation'),
        ('chat', 'Chat Response'),
        ('schedule', 'Schedule Generation'),
        ('other', 'Other AI Response'),
    ]
    
    RATING_CHOICES = [
        (1, 'Very Poor'),
        (2, 'Poor'), 
        (3, 'Average'),
        (4, 'Good'),
        (5, 'Excellent'),
    ]
    
    # Unique identifier for this feedback entry
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # User who provided feedback (optional for anonymous feedback)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Type of AI response being rated
    feedback_type = models.CharField(max_length=20, choices=FEEDBACK_TYPE_CHOICES, default='chat')
    
    # The original user input/prompt
    user_input = models.TextField(help_text="The original user message/prompt")
    
    # The AI-generated response
    ai_response = models.TextField(help_text="The AI-generated response")
    
    # Feedback details
    rating = models.IntegerField(
        choices=RATING_CHOICES,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="1=Very Poor, 5=Excellent"
    )
    
    # Optional detailed feedback
    feedback_text = models.TextField(
        blank=True, 
        null=True,
        help_text="Optional detailed feedback from user"
    )
    
    # What specifically was good/bad
    is_helpful = models.BooleanField(default=True, help_text="Was this response helpful?")
    is_accurate = models.BooleanField(default=True, help_text="Was this response accurate?")
    is_professional = models.BooleanField(default=True, help_text="Was this response professional? (for emails)")
    is_relevant = models.BooleanField(default=True, help_text="Was this response relevant to the request?")
    
    # Technical details for debugging
    model_used = models.CharField(max_length=50, default='gpt-4o-mini', help_text="AI model used")
    prompt_version = models.CharField(max_length=20, default='v1.0', help_text="Version of prompt used")
    
    # Session context
    session_id = models.UUIDField(null=True, blank=True, help_text="Chat session ID if applicable")
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # IP address for analytics (anonymized)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    # User agent for context
    user_agent = models.TextField(blank=True, null=True)
    
    class Meta:
        db_table = 'ai_response_feedback'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['feedback_type', 'rating']),
            models.Index(fields=['created_at']),
            models.Index(fields=['user', 'feedback_type']),
            models.Index(fields=['is_helpful', 'rating']),
        ]
    
    def __str__(self):
        return f"{self.feedback_type} - Rating: {self.rating}/5 - {self.created_at.strftime('%Y-%m-%d')}"
    
    @property
    def is_positive_feedback(self):
        """Returns True if this is considered positive feedback"""
        return self.rating >= 4 and self.is_helpful
    
    @property
    def is_negative_feedback(self):
        """Returns True if this is considered negative feedback"""
        return self.rating <= 2 or not self.is_helpful


class EmailFeedback(models.Model):
    """Specific feedback model for email generation"""
    
    # Link to the general feedback
    ai_feedback = models.OneToOneField(AIResponseFeedback, on_delete=models.CASCADE, related_name='email_details')
    
    # Email-specific fields
    generated_subject = models.CharField(max_length=200, help_text="AI-generated subject line")
    generated_body = models.TextField(help_text="AI-generated email body")
    
    # Professor context
    professor_name = models.CharField(max_length=100, blank=True, null=True)
    professor_email = models.EmailField(blank=True, null=True)
    
    # Email quality metrics
    subject_quality = models.IntegerField(
        choices=AIResponseFeedback.RATING_CHOICES,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Quality of generated subject line"
    )
    
    body_quality = models.IntegerField(
        choices=AIResponseFeedback.RATING_CHOICES,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Quality of generated email body"
    )
    
    # Specific email issues
    too_formal = models.BooleanField(default=False)
    too_casual = models.BooleanField(default=False)
    wrong_tone = models.BooleanField(default=False)
    missing_context = models.BooleanField(default=False)
    grammatical_errors = models.BooleanField(default=False)
    
    # Did user modify the generated email?
    user_modified_subject = models.BooleanField(default=False)
    user_modified_body = models.BooleanField(default=False)
    
    # Final email sent (if user allows tracking)
    final_subject_sent = models.CharField(max_length=200, blank=True, null=True)
    final_body_sent = models.TextField(blank=True, null=True)
    
    class Meta:
        db_table = 'email_feedback'
    
    def __str__(self):
        return f"Email Feedback - Subject: {self.subject_quality}/5, Body: {self.body_quality}/5"


class FeedbackAnalytics(models.Model):
    """Aggregated analytics for feedback data"""
    
    # Date for this analytics record
    date = models.DateField(unique=True)
    
    # Overall metrics
    total_responses = models.IntegerField(default=0)
    total_feedback_received = models.IntegerField(default=0)
    feedback_rate = models.FloatField(default=0.0, help_text="Percentage of responses that received feedback")
    
    # Quality metrics
    average_rating = models.FloatField(default=0.0)
    positive_feedback_count = models.IntegerField(default=0)
    negative_feedback_count = models.IntegerField(default=0)
    
    # By type
    email_feedback_count = models.IntegerField(default=0)
    chat_feedback_count = models.IntegerField(default=0)
    
    # Email-specific metrics
    average_email_rating = models.FloatField(default=0.0)
    email_modification_rate = models.FloatField(default=0.0, help_text="% of emails modified by users")
    
    # Common issues (top 3)
    top_issue_1 = models.CharField(max_length=50, blank=True, null=True)
    top_issue_2 = models.CharField(max_length=50, blank=True, null=True)
    top_issue_3 = models.CharField(max_length=50, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'feedback_analytics'
        ordering = ['-date']
    
    def __str__(self):
        return f"Analytics for {self.date} - Avg Rating: {self.average_rating:.1f}"