from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid

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