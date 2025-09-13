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
        fields = ['id', 'title', 'day_of_week', 'start_time', 'end_time', 'start_date', 'end_date', 'description', 'professor', 'recurrence_pattern', 'reference_date', 'theme', 'user']
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
    
    class Meta:
        model = UserCalendar
        fields = [
            'title', 'start_time', 'end_time', 'day_of_week',
            'start_date', 'end_date', 'description', 'professor', 
            'location', 'recurrence_pattern', 'reference_date', 'theme'
        ]
        extra_kwargs = {
            'theme': { 'required': False, 'allow_null': True, 'allow_blank': True }
        }
    
    def validate_reference_date(self, value):
        """Handle empty string reference_date by converting to None"""
        if value == '' or value is None:
            return None
        return value
    
    def validate_start_date(self, value):
        """Handle empty string start_date by converting to None"""
        if value == '' or value is None:
            return None
        return value
    
    def validate_end_date(self, value):
        """Handle empty string end_date by converting to None"""
        if value == '' or value is None:
            return None
        return value
    
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



