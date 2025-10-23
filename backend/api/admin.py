from django.contrib import admin
from .models import ImportantDate, ExamEvent

# Register your models here.
admin.site.register(ImportantDate)
admin.site.register(ExamEvent)
# Feedback Admin
from .models import AIResponseFeedback, EmailFeedback, FeedbackAnalytics

@admin.register(AIResponseFeedback)
class AIResponseFeedbackAdmin(admin.ModelAdmin):
    list_display = ['feedback_type', 'rating', 'is_helpful', 'user', 'created_at', 'is_positive_feedback']
    list_filter = ['feedback_type', 'rating', 'is_helpful', 'is_accurate', 'is_professional', 'created_at']
    search_fields = ['user__username', 'feedback_text', 'user_input']
    readonly_fields = ['id', 'created_at', 'updated_at', 'ip_address', 'user_agent']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('id', 'user', 'feedback_type', 'created_at', 'updated_at')
        }),
        ('Content', {
            'fields': ('user_input', 'ai_response', 'feedback_text')
        }),
        ('Ratings', {
            'fields': ('rating', 'is_helpful', 'is_accurate', 'is_professional', 'is_relevant')
        }),
        ('Technical', {
            'fields': ('model_used', 'prompt_version', 'session_id'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('ip_address', 'user_agent'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')


@admin.register(EmailFeedback)
class EmailFeedbackAdmin(admin.ModelAdmin):
    list_display = ['ai_feedback', 'subject_quality', 'body_quality', 'professor_name', 'user_modified_subject', 'user_modified_body']
    list_filter = ['subject_quality', 'body_quality', 'too_formal', 'too_casual', 'wrong_tone', 'user_modified_subject', 'user_modified_body']
    search_fields = ['professor_name', 'professor_email', 'generated_subject', 'generated_body']
    
    fieldsets = (
        ('Email Details', {
            'fields': ('ai_feedback', 'generated_subject', 'generated_body')
        }),
        ('Professor Info', {
            'fields': ('professor_name', 'professor_email')
        }),
        ('Quality Ratings', {
            'fields': ('subject_quality', 'body_quality')
        }),
        ('Issues', {
            'fields': ('too_formal', 'too_casual', 'wrong_tone', 'missing_context', 'grammatical_errors')
        }),
        ('User Modifications', {
            'fields': ('user_modified_subject', 'user_modified_body', 'final_subject_sent', 'final_body_sent')
        }),
    )


@admin.register(FeedbackAnalytics)
class FeedbackAnalyticsAdmin(admin.ModelAdmin):
    list_display = ['date', 'total_feedback_received', 'average_rating', 'positive_feedback_count', 'negative_feedback_count', 'feedback_rate']
    list_filter = ['date']
    date_hierarchy = 'date'
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Date', {
            'fields': ('date',)
        }),
        ('Overall Metrics', {
            'fields': ('total_responses', 'total_feedback_received', 'feedback_rate', 'average_rating')
        }),
        ('Feedback Breakdown', {
            'fields': ('positive_feedback_count', 'negative_feedback_count', 'email_feedback_count', 'chat_feedback_count')
        }),
        ('Email Metrics', {
            'fields': ('average_email_rating', 'email_modification_rate')
        }),
        ('Common Issues', {
            'fields': ('top_issue_1', 'top_issue_2', 'top_issue_3')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )