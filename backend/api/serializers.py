from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    CalendarEvent, Message, Course, Professor, CourseOffering, Term, 
    ImportantDate, ExamEvent, UserProfile, UserCalendar, SharedSchedule
)

class CalendarEventSerializer(serializers.ModelSerializer):
    start_time = serializers.TimeField(format='%H:%M')
    end_time = serializers.TimeField(format='%H:%M')

    class Meta:
        model = CalendarEvent
        fields = ['id', 'title', 'day_of_week', 'start_time', 'end_time', 'start_date', 'end_date', 'description', 'professor', 'recurrence_pattern', 'reference_date', 'theme', 'term', 'user']
        read_only_fields = ['user']


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'session_id', 'content', 'timestamp', 'role', 'user']
        read_only_fields = ['user', 'timestamp', 'session_id', 'role']


class ProfessorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Professor
        fields = '__all__'


class CourseSerializer(serializers.ModelSerializer):
    professors = ProfessorSerializer(many=True, read_only=True)

    class Meta:
        model = Course
        fields = ['id', 'title', 'course_code', 'description', 'credits', 'department', 'professors']


class TermSerializer(serializers.ModelSerializer):
    class Meta:
        model = Term
        fields = '__all__'


class CourseOfferingSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    term = TermSerializer(read_only=True)
    # Use PrimaryKeyRelatedField for write operations if needed, or customize create/update
    course_id = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.all(), source='course', write_only=True
    )
    term_id = serializers.PrimaryKeyRelatedField(
        queryset=Term.objects.all(), source='term', write_only=True
    )

    class Meta:
        model = CourseOffering
        fields = [
            'id', 'course', 'term', 'section', 'instructor', 
            'schedule', 'location', 'course_id', 'term_id'
        ]
        # Ensure course and term are not required for read operations if they are nested
        # For write operations, course_id and term_id will be used.
        extra_kwargs = {
            'course': {'read_only': True},
            'term': {'read_only': True}
        }

    def create(self, validated_data):
        # 'course' and 'term' will be automatically handled by source='course_id' and source='term_id'
        return CourseOffering.objects.create(**validated_data)

    def update(self, instance, validated_data):
        instance.course = validated_data.get('course_id', instance.course)
        instance.term = validated_data.get('term_id', instance.term)
        instance.section = validated_data.get('section', instance.section)
        instance.instructor = validated_data.get('instructor', instance.instructor)
        instance.schedule = validated_data.get('schedule', instance.schedule)
        instance.location = validated_data.get('location', instance.location)
        instance.save()
        return instance


class ImportantDateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportantDate
        fields = ['id', 'title', 'description', 'category', 'start_date', 'end_date', 'link']


class ExamEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamEvent
        fields = ['id', 'course_code', 'title', 'description', 'date', 'start_time', 'end_time', 'location', 'is_deferred']


# User Calendar Serializers
class UserCalendarSerializer(serializers.ModelSerializer):
    """Serializer for user calendar events"""
    
    class Meta:
        model = UserCalendar
        fields = [
            'id', 'title', 'start_time', 'end_time', 'day_of_week',
            'start_date', 'end_date', 'description', 'professor', 
            'location', 'recurrence_pattern', 'reference_date', 'theme',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

class CreateUserCalendarSerializer(serializers.ModelSerializer):
    """Serializer for creating user calendar events"""
    # Override date fields to accept empty strings
    reference_date = serializers.DateField(required=False, allow_null=True)
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = UserCalendar
        fields = [
            'title', 'start_time', 'end_time', 'day_of_week',
            'start_date', 'end_date', 'description', 'professor',
            'location', 'recurrence_pattern', 'reference_date', 'theme'
        ]
        extra_kwargs = {
            'theme': { 'required': False, 'allow_null': True, 'allow_blank': True },
            'location': { 'required': False, 'allow_blank': True },
            'professor': { 'required': False, 'allow_blank': True }
        }

    def to_internal_value(self, data):
        """Convert empty strings to None for date fields before validation"""
        if 'reference_date' in data and data['reference_date'] == '':
            data['reference_date'] = None
        if 'start_date' in data and data['start_date'] == '':
            data['start_date'] = None
        if 'end_date' in data and data['end_date'] == '':
            data['end_date'] = None
        return super().to_internal_value(data)
    
    def create(self, validated_data):
        # Automatically associate with the current user
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

# Shared Schedule Serializers
class SharedScheduleSerializer(serializers.ModelSerializer):
    """Serializer for shared schedule snapshots"""
    
    class Meta:
        model = SharedSchedule
        fields = ['id', 'title', 'term', 'schedule_data', 'created_at', 'view_count']
        read_only_fields = ['id', 'created_at', 'view_count']

class CreateSharedScheduleSerializer(serializers.ModelSerializer):
    """Serializer for creating shared schedule snapshots"""
    
    class Meta:
        model = SharedSchedule
        fields = ['title', 'term', 'schedule_data']
    
    def create(self, validated_data):
        # Set the user from the request context
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

# User Serializer for general use
class UserSerializer(serializers.ModelSerializer):
    profile_pic = serializers.CharField(source='profile.profile_pic', read_only=True)
    bio = serializers.CharField(source='profile.bio', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'profile_pic', 'bio', 'date_joined']




# Feedback Serializers
from .models import AIResponseFeedback, EmailFeedback, FeedbackAnalytics

class AIResponseFeedbackSerializer(serializers.ModelSerializer):
    """Serializer for reading AI response feedback"""
    user_username = serializers.CharField(source='user.username', read_only=True)
    is_positive = serializers.BooleanField(source='is_positive_feedback', read_only=True)
    is_negative = serializers.BooleanField(source='is_negative_feedback', read_only=True)
    
    class Meta:
        model = AIResponseFeedback
        fields = [
            'id', 'user_username', 'feedback_type', 'user_input', 'ai_response',
            'rating', 'feedback_text', 'is_helpful', 'is_accurate', 'is_professional',
            'is_relevant', 'model_used', 'prompt_version', 'session_id',
            'created_at', 'is_positive', 'is_negative'
        ]
        read_only_fields = ['id', 'created_at', 'user_username', 'is_positive', 'is_negative']


class AIResponseFeedbackCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating AI response feedback"""
    
    class Meta:
        model = AIResponseFeedback
        fields = [
            'user', 'feedback_type', 'user_input', 'ai_response', 'rating',
            'feedback_text', 'is_helpful', 'is_accurate', 'is_professional',
            'is_relevant', 'model_used', 'prompt_version', 'session_id',
            'ip_address', 'user_agent'
        ]
        
    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be between 1 and 5")
        return value


class EmailFeedbackSerializer(serializers.ModelSerializer):
    """Serializer for reading email feedback"""
    
    class Meta:
        model = EmailFeedback
        fields = [
            'ai_feedback', 'generated_subject', 'generated_body', 'professor_name',
            'professor_email', 'subject_quality', 'body_quality', 'too_formal',
            'too_casual', 'wrong_tone', 'missing_context', 'grammatical_errors',
            'user_modified_subject', 'user_modified_body', 'final_subject_sent',
            'final_body_sent'
        ]


class EmailFeedbackCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating email feedback"""
    
    class Meta:
        model = EmailFeedback
        fields = [
            'ai_feedback', 'generated_subject', 'generated_body', 'professor_name',
            'professor_email', 'subject_quality', 'body_quality', 'too_formal',
            'too_casual', 'wrong_tone', 'missing_context', 'grammatical_errors',
            'user_modified_subject', 'user_modified_body', 'final_subject_sent',
            'final_body_sent'
        ]
        
    def validate_subject_quality(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Subject quality rating must be between 1 and 5")
        return value
        
    def validate_body_quality(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Body quality rating must be between 1 and 5")
        return value


class FeedbackAnalyticsSerializer(serializers.ModelSerializer):
    """Serializer for feedback analytics"""
    
    class Meta:
        model = FeedbackAnalytics
        fields = [
            'date', 'total_responses', 'total_feedback_received', 'feedback_rate',
            'average_rating', 'positive_feedback_count', 'negative_feedback_count',
            'email_feedback_count', 'chat_feedback_count', 'average_email_rating',
            'email_modification_rate', 'top_issue_1', 'top_issue_2', 'top_issue_3',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class QuickFeedbackSerializer(serializers.Serializer):
    """Serializer for quick thumbs up/down feedback"""
    type = serializers.ChoiceField(choices=['email', 'chat', 'schedule', 'other'], default='chat')
    user_input = serializers.CharField(max_length=1000)
    ai_response = serializers.CharField(max_length=5000)
    thumbs_up = serializers.BooleanField()
    session_id = serializers.UUIDField(required=False, allow_null=True)
    model = serializers.CharField(max_length=50, default='gpt-4o-mini')