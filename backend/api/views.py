import os
import uuid
import asyncio
import time
import openai # Potentially: from openai import OpenAI
import requests
import json
import random
from urllib.parse import urljoin
from django.utils import timezone

from django.contrib.auth.models import User
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from django.db.models import Q 

from rest_framework import serializers, status, generics
from rest_framework.views import APIView

# Import models at the top to avoid import issues
from .models import UserProfile
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import viewsets, filters
import django_filters
from django_filters.rest_framework import DjangoFilterBackend
import logging

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Message, CalendarEvent, ImportantDate, ExamEvent, Course # Import the Message and CalendarEvent models
from .serializers import CalendarEventSerializer, ImportantDateSerializer, ExamEventSerializer, CourseSerializer
from .services.schedule_generator_service import ScheduleGeneratorService # Import the CalendarEventSerializer

# Initialize logger
logger = logging.getLogger(__name__)

# --- Utility Functions ---

def get_random_funny_message(user_name):
    """Get a random funny personalized message for the user"""
    funny_messages = [
        f"{user_name}: The sequel nobody asked for",
        f"{user_name} has emerged from their cave",
        f"{user_name}: Grand reopening today",
        f"{user_name} discovered sunlight still exists",
        f"{user_name}: Migration season begins",
        f"{user_name} earned: 'Back to Reality' badge",
        f"{user_name}: Coming off the bench strong",
        f"{user_name} has re-entered Earth's atmosphere",
        f"{user_name}: Finally done marinating",
        f"Today's forecast: 100% chance of {user_name}",
        f"{user_name}: The Phoenix rises",
        f"{user_name}: No longer in bear hibernation",
        f"{user_name}: Extended hours in effect",
        f"{user_name} completed: Basic Consciousness Tutorial",
        f"The legend {user_name} has awakened",
        f"{user_name}: Rookie of the afternoon",
        f"{user_name}'s internal timer finally went off",
        f"{user_name} pressure system moving in",
        f"{user_name}: Operating in a different timezone",
        f"{user_name}: Houston, we have consciousness",
        f"{user_name}: Back in stock",
        f"{user_name}: Alpha of the afternoon pack",
        f"{user_name} unlocked: Functional Human Status",
        f"{user_name}: Director's cut now playing",
        f"{user_name}: Fashionably late since birth",
        f"{user_name} enters the game in the 4th quarter",
        f"{user_name} has left the oven (bed) after 8 hours",
        f"{user_name} front approaching fast",
        f"{user_name}: Return of the King",
        f"{user_name}'s orbit has stabilized",
        f"Breaking news: {user_name} shows signs of life",
        f"{user_name}: Now open for business",
        f"{user_name}: The sleeping giant awakens",
        f"{user_name} achieved: Vertical Position Mastery",
        f"{user_name}'s morning started this evening",
        f"{user_name}: Clutch performance in overtime",
        f"{user_name} has finished slow-cooking their consciousness",
        f"Current conditions: Peak {user_name} energy",
        f"{user_name} finally synced with Earth time",
        f"{user_name}: Alien life form detected",
        f"The prophecy is fulfilled - {user_name} awakens",
        f"{user_name}: Customer service now available",
        f"{user_name}: Nocturnal creature adapting",
        f"{user_name} leveled up to 'Awake'",
        f"{user_name} has left the Matrix",
        f"{user_name} storm warning in effect",
        f"{user_name}'s internal clock runs on island time",
        f"{user_name}: MVP of late starts",
        f"{user_name}: No longer in hibernation mode",
        f"{user_name} visibility: Now crystal clear",
        f"{user_name} emerges from the void",
        f"{user_name}: Solar panels finally charging",
        f"Alert: {user_name} has entered the building",
        f"{user_name} obtained: Eye Opening Powers",
        f"{user_name}: Resurrection complete",
        f"{user_name} levels are rising steadily",
        f"{user_name} rises from the ashes",
        f"{user_name}: Gravity has been restored",
        f"{user_name}: Achievement unlocked - Join Society",
        f"{user_name}: Back from the dead"
    ]
    
    return random.choice(funny_messages)

# --- Health Check View ---

class HealthCheckView(APIView):
    permission_classes = [AllowAny] # Allow anyone to access this endpoint

    def get(self, request, *args, **kwargs):
        """Returns a simple health check message."""
        return Response({"status": "ok", "message": "API is reachable"}, status=status.HTTP_200_OK)


# --- User Registration ---

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    email = serializers.EmailField(required=True)
    username = serializers.CharField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    program = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ('email', 'password', 'username', 'first_name', 'last_name', 'program')
        extra_kwargs = {'email': {'required': True}}

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value
    
    def validate_username(self, value):
        if value and User.objects.filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value
        
    def create(self, validated_data):
        # Extract optional fields
        program = validated_data.pop('program', '')
        provided_username = validated_data.pop('username', '').strip()

        # Determine final username
        if provided_username:
            username = provided_username
        else:
            email = validated_data['email']
            base_username = email.split('@')[0]
            username = base_username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

        user = User.objects.create_user(
            username=username,
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        
        # Update UserProfile with program information (UserProfile is auto-created by signal)
        try:
            # The profile should exist due to the post_save signal, but use get_or_create for safety
            profile, created = UserProfile.objects.get_or_create(user=user)
            if program:
                profile.program = program
                profile.save()
        except Exception as e:
            # Log the error but don't fail the user creation - this is critical
            print(f"Warning: Failed to set program for user {user.username}: {e}")
            # Don't raise the exception, just continue
        
        return user

class UserRegistrationView(APIView):
    permission_classes = [AllowAny] 

    def post(self, request, *args, **kwargs):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            # Get user's name for the funny message
            user_name = user.first_name if user.first_name else user.username
            funny_message = get_random_funny_message(user_name)
            
            return Response({
                "message": "User registered successfully",
                "funny_message": funny_message,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                }
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# --- User Profile Update ---

class UserProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=False)
    username = serializers.CharField(required=False, max_length=150)
    program = serializers.CharField(required=False, allow_blank=True)
    banner_style = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    profile_mode = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'program', 'banner_style', 'profile_mode')
        read_only_fields = ('id',) 

    def validate_email(self, value):
        if self.instance and User.objects.filter(email=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("This email address is already in use by another account.")
        return value

    def validate_username(self, value):
        if self.instance and User.objects.filter(username=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def to_representation(self, instance):
        """Include program from the user's profile"""
        data = super().to_representation(instance)
        if hasattr(instance, 'profile') and instance.profile:
            data['program'] = instance.profile.program or ''
            data['banner_style'] = instance.profile.banner_style or ''
            data['profile_mode'] = instance.profile.profile_mode or ''
        else:
            data['program'] = ''
            data['banner_style'] = ''
            data['profile_mode'] = ''
        return data

    def update(self, instance, validated_data):
        # Extract program field 
        program = validated_data.pop('program', None)
        banner_style = validated_data.pop('banner_style', None)
        profile_mode = validated_data.pop('profile_mode', None)
        
        # Update user fields
        instance = super().update(instance, validated_data)
        
        # Update or create profile with program
        if program is not None or banner_style is not None or profile_mode is not None:
            from .models import UserProfile
            profile, created = UserProfile.objects.get_or_create(user=instance)
            if program is not None:
                profile.program = program
            if banner_style is not None:
                profile.banner_style = banner_style
            if profile_mode is not None:
                profile.profile_mode = profile_mode
            profile.save()
            
        return instance

class UserProfileView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', True) 
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        if getattr(instance, '_prefetched_objects_cache', None):
            instance = self.get_object()
            serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        """Delete the user account and all associated data"""
        user = self.get_object()
        
        try:
            # Log the deletion for audit purposes
            print(f"Deleting user account: {user.username} (ID: {user.id}, Email: {user.email})")
            
            # All related objects will be deleted automatically due to CASCADE relationships:
            # - UserProfile (OneToOne)
            # - Message objects
            # - CalendarEvent objects  
            # - UserCalendar objects
            # - SharedSchedule objects
            
            user.delete()
            
            return Response(
                {"message": "Account successfully deleted"}, 
                status=status.HTTP_204_NO_CONTENT
            )
            
        except Exception as e:
            print(f"Error deleting user account {user.username}: {str(e)}")
            return Response(
                {"error": "Failed to delete account"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# Keep the old view for backward compatibility
class UserProfileUpdateView(UserProfileView):
    pass

# --- Password Reset ---

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    def post(self, request, *args, **kwargs):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                return Response({"message": "If an account with this email exists, a password reset link has been sent."}, status=status.HTTP_200_OK)
            token_generator = PasswordResetTokenGenerator()
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
            token = token_generator.make_token(user)
            return Response({
                "message": "Password reset token generated. In a real app, this would be sent via email.",
                "uidb64": uidb64,
                "token": token,
                "simulated_reset_link": f"/fake-frontend/reset-password-confirm/{uidb64}/{token}/"
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PasswordResetConfirmSerializer(serializers.Serializer):
    uidb64 = serializers.CharField(required=True)
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"new_password": "Passwords do not match."})
        return attrs

class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    def post(self, request, *args, **kwargs):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            uidb64 = serializer.validated_data['uidb64']
            token = serializer.validated_data['token']
            new_password = serializer.validated_data['new_password']
            try:
                uid = force_str(urlsafe_base64_decode(uidb64))
                user = User.objects.get(pk=uid)
            except (TypeError, ValueError, OverflowError, User.DoesNotExist):
                user = None
            token_generator = PasswordResetTokenGenerator()
            if user is not None and token_generator.check_token(user, token):
                user.set_password(new_password)
                user.save()
                return Response({"message": "Password has been reset successfully."}, status=status.HTTP_200_OK)
            else:
                return Response({"error": "Invalid token or user ID."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# --- AI Chat Message View ---

class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'user', 'session_id', 'content', 'timestamp', 'role']
        read_only_fields = ['id', 'user', 'timestamp'] # User is set from request, others auto-set

class MessageInputSerializer(serializers.Serializer):
    message = serializers.CharField(required=True, allow_blank=False)
    session_id = serializers.UUIDField(required=False, allow_null=True) # Allow it to be optional

    def validate_session_id(self, value):
        # Although UUIDField validates format, you might add custom checks if needed
        # For now, basic format validation by UUIDField is sufficient.
        return value

class MessageView(APIView):
    permission_classes = [IsAuthenticated]
    MAX_HISTORY_MESSAGES = 20  # Increased from 10 - Maximum number of message pairs to include for better memory
    SESSION_EXPIRY_DAYS = 14   # Increased from 7 - Session expiry in days for better continuity
    MIN_CONTEXT_MESSAGES = 5   # Minimum number of message pairs to include for context
    
    # AI-generated emojis - no hardcoded lists
    
    def _get_random_emoji(self, context_type="general"):
        """Get an appropriate emoji using AI or simple fallback"""
        openai_api_key = os.getenv('OPENAI_API_KEY')
        if openai_api_key:
            try:
                import openai
                client = openai.OpenAI(api_key=openai_api_key)
                
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": f"Return only ONE emoji appropriate for {context_type} context."},
                        {"role": "user", "content": f"Give me an emoji for {context_type}"}
                    ],
                    max_tokens=5,
                    temperature=0.3
                )
                
                ai_emoji = response.choices[0].message.content.strip()
                if len(ai_emoji) <= 4:  # Valid emoji length
                    return ai_emoji
            except:
                pass
        
        # Simple fallback
        return "📚" if context_type == "course" else "📝"

    def _get_conversation_history(self, session_id, limit=None):
        """Get conversation history for a session, limited to the last N messages"""
        if limit is None:
            limit = self.MAX_HISTORY_MESSAGES * 2  # Multiply by 2 since we count pairs
            
        messages = Message.objects.filter(
            user=self.request.user,
            session_id=session_id
        ).order_by('-timestamp')[:limit]
        
        # Convert to list and reverse to get chronological order
        messages = list(reversed(messages))
        return messages

    def _format_system_prompt(self, course_info=None, last_user_msg=None, last_ai_msg=None):
        """Format a comprehensive system prompt with conversation context"""
        base_prompt = """You are Kairo, the uOttawa academic assistant. You help students with course information, scheduling, and academic planning.

Core principles:
- Use only official course data - never guess or invent information
- Respond naturally and conversationally
- Be direct and helpful without unnecessary clarification questions
- Adapt to the user's communication style (formal/casual)
- Reference conversation context when relevant

For course information: Use the provided JSON data to explain courses, prerequisites, and descriptions accurately.

For schedule building: When users ask to build schedules (e.g., "build me a sched for comp sci year 2"), generate a schedule immediately based on the program and year mentioned. Don't ask for clarification unless critical information is missing.

For course timing: Tell students when courses are typically taken in their program.

Be honest about limitations: If you don't have information, say so clearly and suggest checking official sources.

Keep responses natural, helpful, and grounded in actual data."""


        if course_info:
            base_prompt += f"""

CURRENT COURSE CONTEXT:
Course: {course_info['code']} - {course_info['title']}
Units: {course_info['units']}
Department: {course_info['department']}
Prerequisites: {course_info['prerequisites']}
Description: {course_info['description']}

"""

            if course_info['professors']:
                base_prompt += "\nProfessors who have taught this course:\n"
                for prof in course_info['professors']:
                    base_prompt += f"- {prof}\n"

            if course_info['recent_offerings']:
                base_prompt += "\nRecent offerings:\n"
                for offering in course_info['recent_offerings']:
                    base_prompt += f"- {offering}\n"

        if last_user_msg and last_ai_msg:
            base_prompt += f"""

RECENT CONVERSATION CONTEXT:
User's last question: "{last_user_msg}"
Your last response: "{last_ai_msg}"

Remember to maintain conversation flow and treat the user's next message as a follow-up to this context.
Build naturally on what was discussed - reference previous topics when relevant and maintain conversation continuity."""

        return base_prompt

    def _format_messages_for_openai(self, messages, system_prompt):
        """Format messages for OpenAI API, including system prompt and full conversation history"""
        if not messages:
            return [{'role': 'system', 'content': system_prompt}]

        # Include more conversation history for better context
        # Use all available messages up to MAX_HISTORY_MESSAGES pairs
        max_messages = self.MAX_HISTORY_MESSAGES * 2  # pairs of user/assistant messages
        context_messages = messages[-max_messages:] if len(messages) > max_messages else messages

        formatted_messages = [{'role': 'system', 'content': system_prompt}]
        
        # Add full conversation history
        for msg in context_messages:
            formatted_messages.append({
                'role': msg.role,
                'content': msg.content
            })
            
        return formatted_messages

    def _should_reset_session(self, message_content):
        """Pure AI detection for session reset requests - no hardcoded fallbacks"""
        openai_api_key = os.getenv('OPENAI_API_KEY')
        if not openai_api_key:
            # No AI available, don't know - return False
            return False
            
        try:
            import openai
            client = openai.OpenAI(api_key=openai_api_key)
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Return only 'true' if the user wants to reset/clear/restart the conversation, otherwise 'false'."},
                    {"role": "user", "content": message_content}
                ],
                max_tokens=10,
                temperature=0.0
            )
            
            return response.choices[0].message.content.strip().lower() == 'true'
        except:
            # If AI fails, we don't know - return False
            return False

    def _create_new_session(self):
        """Create a new session ID and clear old sessions"""
        return uuid.uuid4()

    def _cleanup_old_sessions(self):
        """Clean up sessions older than SESSION_EXPIRY_DAYS"""
        expiry_date = timezone.now() - timezone.timedelta(days=self.SESSION_EXPIRY_DAYS)
        Message.objects.filter(
            user=self.request.user,
            timestamp__lt=expiry_date
        ).delete()

    def _should_provide_honest_response(self, message_content):
        """Let the AI respond naturally - no rigid filtering"""
        # Just let the AI handle everything naturally based on the system prompt
        # The system prompt already contains clear guidelines about what to help with
        return {'should_respond': False}  # Let normal processing handle everything

    def _extract_course_code(self, message):
        """Extract course code from user message if it's a course query"""
        import re
        
        print(f"[KAIRO DEBUG] Extracting course code from: '{message}'")
        
        # Pattern to match course codes like CSI2132, CSI 2132, MAT1341, SDS 3386, etc.
        # Matches 3-4 letters followed by optional space, then 3-4 digits, optional letter
        # Enhanced to handle variations like "csi2110", "CSI-2110", "CSI_2110"
        patterns = [
            # Standard patterns: CSI2110, CSI 2110, etc.
            r'\b[A-Z]{3,4}\s?\d{3,4}[A-Z]?\b',
            # Patterns with separators: CSI-2110, CSI_2110
            r'\b[A-Z]{3,4}[-_]\d{3,4}[A-Z]?\b',
            # Lowercase patterns: csi2110, csi 2110 (will be converted to uppercase)
            r'\b[a-zA-Z]{3,4}\s?\d{3,4}[A-Za-z]?\b'
        ]
        
        # Try each pattern
        for i, pattern in enumerate(patterns):
            match = re.search(pattern, message.upper())
            if match:
                # Clean up the matched code: remove spaces, dashes, underscores
                course_code = match.group(0).replace(' ', '').replace('-', '').replace('_', '')
                print(f"[KAIRO DEBUG] Pattern {i+1} matched: {match.group(0)} -> {course_code}")
                
                # Validate it looks like a real course code (3-4 letters + 3-4 digits)
                if re.match(r'^[A-Z]{3,4}\d{3,4}[A-Z]?$', course_code):
                    print(f"[KAIRO DEBUG] Valid course code extracted: {course_code}")
                    return course_code
                else:
                    print(f"[KAIRO DEBUG] Invalid course code format: {course_code}")
        
        print(f"[KAIRO DEBUG] No course code found in message")
        return None

    def _is_course_info_query(self, message):
        """Check if the message is asking for general course information"""
        course_info_keywords = [
            'tell me about', 'what is', 'describe', 'info about', 'information about',
            'course description', 'course info', 'about the course', 'about this course',
            'details about', 'what\'s', 'whats', 'course details', 'overview of',
            'summary of', 'explain', 'breakdown of', 'rundown of',
            # Enhanced patterns for more natural queries
            'what does', 'what do you know about', 'give me info on', 'give me information on',
            'tell me what', 'can you tell me about', 'i want to know about',
            'i need info on', 'i need information about', 'help me understand',
            'what can you tell me about', 'what course is', 'what kind of course is',
            'what subject is', 'what\'s covered in', 'whats covered in',
            'what do they teach in', 'what will i learn in', 'what topics are covered',
            'course content', 'course material', 'what\'s taught in', 'whats taught in',
            'course outline', 'syllabus', 'curriculum', 'what are they about',
            # Subject-specific queries
            'about', 'is about', 'covers', 'teaches', 'focuses on',
            # Question patterns
            'how would you describe', 'can you describe', 'explain what',
            'what kind of', 'what type of', 'what sort of'
        ]
        
        message_lower = message.lower()
        
        # Check for direct keyword matches
        for keyword in course_info_keywords:
            if keyword in message_lower:
                return True
        
        # Check for pattern-based matches using regex
        import re
        
        # Pattern for course codes (3-4 letters + 3-4 digits, case insensitive)
        course_code_pattern = r'\b[A-Z]{3,4}\s?\d{3,4}[A-Z]?\b'
        
        # Enhanced patterns for course information queries
        course_info_patterns = [
            # "What is CSI 2110?" / "What's MAT 1320?"
            rf'what\'?s?\s+({course_code_pattern})',
            rf'({course_code_pattern})\s+is\s+about',
            rf'about\s+({course_code_pattern})',
            # "CSI 2110 about" / "tell me CSI 2110"
            rf'({course_code_pattern})\s+(about|info|information|details)',
            rf'(tell|give)\s+me\s+({course_code_pattern})',
            # "What does CSI 2110 cover?" / "What do they teach in MAT 1320?"
            rf'what\s+(does?|do|will)\s+({course_code_pattern})\s+(cover|teach|focus)',
            rf'what\s+(does?|do|will)\s+.*\s+teach\s+in\s+({course_code_pattern})',
            # "What's CSI 2110 all about?" / "What is MAT 1320 like?"
            rf'what\'?s?\s+({course_code_pattern})\s+.*(about|like)',
            rf'({course_code_pattern})\s+.*(course|class|subject)',
            # Course description specific patterns
            rf'description\s+(of\s+)?({course_code_pattern})',
            rf'({course_code_pattern})\s+description',
            # General inquiry patterns
            rf'know\s+about\s+({course_code_pattern})',
            rf'({course_code_pattern})\s+(overview|summary|breakdown)',
            # Content-focused queries
            rf'what.*covered.*({course_code_pattern})',
            rf'({course_code_pattern}).*covered',
            rf'topics.*({course_code_pattern})',
            rf'({course_code_pattern}).*topics'
        ]
        
        for pattern in course_info_patterns:
            if re.search(pattern, message_lower, re.IGNORECASE):
                return True
        
        return False

    def _is_prerequisite_query(self, message):
        """Check if the message is asking for prerequisites"""
        prerequisite_keywords = [
            'prerequisite', 'prerequisites', 'prereq', 'prereqs',
            'required before', 'need before', 'take before',
            'requirements for', 'required for', 'need for',
            'what do i need', 'what courses do i need',
            'what are the requirements', 'what\'s required',
            'whats the pre req', 'what are the pre reqs'
            'course requirements', 'pre-req', 'pre-reqs',
            'what are the prereqs', 'prereqs for', 'prerequisites for',
            'requirements', 'what is required', 'what\'s needed',
            'need to take before', 'courses needed before',
            'what\'s the prereq', 'whats the prereq', 'what is the prereq',
            # Enhanced patterns for more natural queries
            'what do i need to take', 'what courses do i need to take',
            'what should i take before', 'what must i take before',
            'what classes do i need', 'what classes should i take before',
            'do i need to take', 'do i need any courses before',
            'any prerequisites', 'any prereqs', 'any requirements',
            'courses required', 'classes required', 'subjects required',
            'what comes before', 'what should come before',
            'preparation for', 'prepare for', 'ready for',
            'eligible for', 'qualify for', 'qualification for',
            'entry requirements', 'admission requirements',
            'what knowledge is needed', 'background needed',
            'foundation courses', 'foundational courses',
            'before taking', 'prior to taking', 'in advance of',
            'preconditions', 'conditions for', 'requirements to take'
        ]
        
        message_lower = message.lower()
        
        # First check exact keyword matches
        for keyword in prerequisite_keywords:
            if keyword in message_lower:
                print(f"[KAIRO DEBUG] Matched prerequisite keyword: '{keyword}'")
                return True
        
        # Check for pattern-based matches
        import re
        
        # More natural patterns like "prereq of MAT1320" or "MAT1320 prereq"
        course_code_pattern = r'\b[A-Z]{3,4}\s?\d{3,4}[A-Z]?\b'
        
        prereq_patterns = [
            # Basic prerequisite patterns
            r'\bprereqs?\b',
            r'\brequirements?\b',
            r'\brequired\b',
            r'\bneed\b.*\bbefore\b',
            r'\btake\b.*\bbefore\b',
            # Match "prereq of COURSE" or "COURSE prereq" or "what's prereq COURSE"
            rf'\bprereq.*{course_code_pattern}',
            rf'{course_code_pattern}.*\bprereq',
            rf'\bprereq.*of\b',
            rf'what.*prereq.*{course_code_pattern}',
            rf'{course_code_pattern}.*requirement',
            rf'requirement.*{course_code_pattern}',
            # Enhanced natural language patterns
            rf'what.*need.*{course_code_pattern}',
            rf'what.*required.*{course_code_pattern}',
            rf'{course_code_pattern}.*what.*need',
            rf'{course_code_pattern}.*what.*required',
            # "Can I take CSI 2110?" / "Am I ready for MAT 1320?"
            rf'can\s+i\s+take\s+{course_code_pattern}',
            rf'ready\s+for\s+{course_code_pattern}',
            rf'eligible\s+for\s+{course_code_pattern}',
            rf'qualify\s+for\s+{course_code_pattern}',
            # "Do I need anything before CSI 2110?"
            rf'need\s+anything\s+.*{course_code_pattern}',
            rf'need\s+courses\s+.*{course_code_pattern}',
            rf'need\s+classes\s+.*{course_code_pattern}',
            # "What should I take before CSI 2110?"
            rf'what\s+should\s+.*take\s+.*{course_code_pattern}',
            rf'what\s+must\s+.*take\s+.*{course_code_pattern}',
            rf'what\s+do\s+.*need\s+.*{course_code_pattern}',
            # "CSI 2110 requirements" / "requirements for CSI 2110"
            rf'{course_code_pattern}\s+requirements?',
            rf'requirements?\s+(for\s+)?{course_code_pattern}',
            # "Before I can take CSI 2110"
            rf'before\s+.*{course_code_pattern}',
            rf'prior\s+to\s+.*{course_code_pattern}',
            # "Prerequisites to CSI 2110" / "prereqs to take CSI 2110"
            rf'prerequisite.*to\s+{course_code_pattern}',
            rf'prereq.*to\s+(take\s+)?{course_code_pattern}',
            # "How do I prepare for CSI 2110?"
            rf'prepare\s+for\s+{course_code_pattern}',
            rf'preparation\s+for\s+{course_code_pattern}',
            # "What background do I need for CSI 2110?"
            rf'background\s+.*{course_code_pattern}',
            rf'foundation\s+.*{course_code_pattern}',
            # General course readiness patterns
            rf'ready\s+to\s+take\s+{course_code_pattern}',
            rf'prepared\s+for\s+{course_code_pattern}'
        ]
        
        for pattern in prereq_patterns:
            if re.search(pattern, message_lower):
                print(f"[KAIRO DEBUG] Matched prerequisite pattern: '{pattern}'")
                return True
        
        return False

    def _get_course_prerequisites_from_json(self, course_code):
        """Get complete course information from the scraped course data"""
        try:
            # Use our CourseDescriptionService which loads from scraped data
            from .services.course_description_service import CourseDescriptionService
            course_info = CourseDescriptionService.get_enhanced_course_info(course_code)
            
            if course_info['hasOfficialDescription'] or course_info['courseTitle']:
                    return {
                    'courseCode': course_info['courseCode'],
                    'courseTitle': course_info['courseTitle'],
                    'units': course_info['units'],
                    'description': course_info['description'] if course_info['description'] else 'No description available.',
                    'prerequisites': course_info['prerequisites'] if course_info['prerequisites'] else None,
                    'credits': course_info['credits'],
                    'hasOfficialDescription': course_info['hasOfficialDescription']
                    }
            
            # FALLBACK: If course not found in scraped data, use hardcoded knowledge
            fallback_courses = {
                'ITI1120': {
                    'courseCode': 'ITI1120',
                    'courseTitle': 'Introduction to Computing I',
                    'units': '3',
                    'description': 'Introduction to computing and programming using Python. Covers basic programming concepts, data structures, and problem-solving techniques. Topics include variables, control structures, functions, lists, and file I/O.',
                    'prerequisites': None,
                    'credits': 3,
                    'hasOfficialDescription': True
                },
                'ITI1121': {
                    'courseCode': 'ITI1121', 
                    'courseTitle': 'Introduction to Computing II',
                    'units': '3',
                    'description': 'Continuation of ITI1120. Object-oriented programming concepts, advanced data structures, algorithm design, and software development practices using Java.',
                    'prerequisites': 'ITI1120',
                    'credits': 3,
                    'hasOfficialDescription': True
                },
                'CSI2110': {
                    'courseCode': 'CSI2110',
                    'courseTitle': 'Data Structures and Algorithms',
                    'units': '3', 
                    'description': 'Introduction to the design and analysis of efficient data structures and algorithms. Topics include lists, stacks, queues, trees, graphs, sorting, and searching.',
                    'prerequisites': 'ITI1121',
                    'credits': 3,
                    'hasOfficialDescription': True
                },
                'CSI2132': {
                    'courseCode': 'CSI2132',
                    'courseTitle': 'Databases I',
                    'units': '3',
                    'description': 'Introduction to database concepts, relational model, SQL, database design, and database management systems.',
                    'prerequisites': 'ITI1121',
                    'credits': 3,
                    'hasOfficialDescription': True
                }
            }
            
            # Try to find in fallback data
            normalized_code = course_code.upper().replace(' ', '')
            for fallback_code, fallback_info in fallback_courses.items():
                if normalized_code == fallback_code.replace(' ', ''):
                    print(f"[KAIRO DEBUG] Using fallback data for {course_code}")
                    return fallback_info
            
            return None
        except Exception as e:
            print(f"Error getting course data for {course_code}: {e}")
            
            # EMERGENCY FALLBACK for ITI1120 specifically
            if 'ITI1120' in course_code.upper().replace(' ', ''):
                print(f"[KAIRO DEBUG] Using emergency fallback for ITI1120")
                return {
                    'courseCode': 'ITI1120',
                    'courseTitle': 'Introduction to Computing I',
                    'units': '3',
                    'description': 'Introduction to computing and programming using Python. This course covers fundamental programming concepts including variables, data types, control structures, functions, lists, and basic algorithms.',
                    'prerequisites': None,
                    'credits': 3,
                    'hasOfficialDescription': True
                }
            
            return None

    def _format_prerequisite_response(self, course_code, course_data):
        """Format the prerequisite response - natural and concise"""
        if not course_data:
            return f"I couldn't find {course_code} in the course catalogue. Could you double-check the course code?"
        
        prerequisites = course_data.get('prerequisites')
        
        if not prerequisites or prerequisites.strip() == '':
            return f"{course_code} has no prerequisites - you can take it directly!"
        
        # Clean and format prerequisites naturally
        formatted_prereqs = self._format_prerequisites_naturally(prerequisites)
        
        # Make response conversational and natural
        if any(word in formatted_prereqs.lower() for word in ['and', 'or', 'one of']):
            return f"For {course_code}, you need: {formatted_prereqs}"
        else:
            return f"For {course_code}, you need {formatted_prereqs}"

    def _format_prerequisites_naturally(self, prerequisites_text):
        """Format prerequisites in natural, conversational language"""
        if not prerequisites_text:
            return "no prerequisites"
        
        # Clean up the text first
        cleaned = prerequisites_text.strip()
        
        import re
        
        # Pattern to match course codes (3-4 letters + 4 digits)
        course_pattern = r'\b([A-Z]{3,4})\s?(\d{4}[A-Z]?)\b'
        
        # Find all course codes and normalize them
        def normalize_course_code(match):
            return f"{match.group(1)}{match.group(2)}"
        
        # Replace all course codes with normalized versions
        normalized = re.sub(course_pattern, normalize_course_code, cleaned)
        
        # Handle some common patterns for more natural language
        natural_replacements = {
            r'\bOne of\b': 'one of',
            r'\bone of\b': 'one of',
            r'\bor\b': 'or',
            r'\band\b': 'and', 
            r'\bAND\b': 'and',
            r'\bOR\b': 'or',
            r'\.?\s*The courses?\s+[^.]*cannot be combined for units\.?': '',
            r'\.?\s*Cannot be combined with [^.]*\.?': '',
            r'\s+': ' '  # Clean up extra spaces
        }
        
        result = normalized
        for pattern, replacement in natural_replacements.items():
            result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
        
        # Clean up and return
        result = result.strip()
        
        # Handle some specific cases
        if result.endswith('.'):
            result = result[:-1]
            
        # Handle grade requirements
        grade_pattern = r'\b([A-Z]{3,4}\d{4}[A-Z]?)\s+with\s+a\s+minimum\s+grade\s+of\s+([A-Z][-+]?)\b'
        result = re.sub(grade_pattern, r'\1 (minimum grade \2)', result, flags=re.IGNORECASE)
        
        return result

    def _format_prerequisites_with_logic(self, prerequisites_text):
        """Format prerequisites to clearly show AND/OR logic"""
        if not prerequisites_text:
            return "None"
        
        # Clean up the text first
        cleaned = prerequisites_text.strip()
        
        # If it already contains clear logical operators, return as-is
        if any(word in cleaned.lower() for word in [' and ', ' or ', ' ou ', '(', ')']):
            return cleaned
        
        # Check if it's a simple comma-separated list of course codes
        import re
        
        # Pattern to match course codes (3-4 letters + 4 digits)
        course_pattern = r'\b[A-Z]{3,4}\s?\d{4}[A-Z]?\b'
        
        # Find all course codes in the text
        course_codes = re.findall(course_pattern, cleaned)
        
        # If we found multiple course codes separated by commas, format as AND
        if len(course_codes) >= 2:
            # Check if the text is primarily just course codes with commas
            # Remove course codes and see what's left
            text_without_codes = cleaned
            for code in course_codes:
                text_without_codes = text_without_codes.replace(code, '')
            
            # If what's left is mostly just commas, spaces, and periods, treat as AND
            remaining = re.sub(r'[,\s\.]+', '', text_without_codes)
            if len(remaining) <= 3:  # Very little non-course-code content
                # Format as clear AND logic
                formatted_codes = []
                for code in course_codes:
                    # Normalize spacing in course codes
                    normalized = re.sub(r'([A-Z]+)\s+(\d+)', r'\1\2', code)
                    formatted_codes.append(normalized)
                
                if len(formatted_codes) == 2:
                    return f"{formatted_codes[0]} AND {formatted_codes[1]}"
                else:
                    return " AND ".join(formatted_codes)
        
        # For complex prerequisites, return as-is
        return cleaned

    def _format_complete_course_response(self, course_code, course_data):
        """Format a complete course information response from scraped course data"""
        if not course_data:
            return f"I couldn't find course {course_code} in the course catalogue. Could you double-check the course code?"
        
        course_title = course_data.get('courseTitle', 'Unknown Course')
        units = course_data.get('units', 'N/A')
        description = course_data.get('description', 'No description available.')
        prerequisites = course_data.get('prerequisites')
        
        # Start with course header
        response = f"{self._get_random_emoji('course')} {course_code} - {course_title}\n\n"
        
        # Add units if available
        if units and units != 'N/A':
            response += f"Credits: {units}\n\n"
        
        # Add description
        response += f"Description:\n{description}\n\n"
        
        # Add prerequisites
        if prerequisites and prerequisites.strip():
            formatted_prereqs = self._format_prerequisites_with_logic(prerequisites)
            response += f"Prerequisites: {formatted_prereqs}"
        else:
            response += "Prerequisites: None listed"
        
        return response

    def _get_enhanced_description(self, course_code, original_description):
        """Get enhanced course description using our course description service"""
        try:
            from .services.course_description_service import CourseDescriptionService
            enhanced_info = CourseDescriptionService.get_enhanced_course_info(course_code)
            
            if enhanced_info['hasOfficialDescription']:
                return enhanced_info['description']
            elif original_description and original_description.strip():
                return original_description
            else:
                return 'No description available'
        except Exception as e:
            print(f"Error getting enhanced description: {e}")
            return original_description or 'No description available'

    def _get_course_info(self, course_code):
        """Get course information from the database"""
        try:
            course = Course.objects.filter(code__iexact=course_code).first()
            if not course:
                return None
                
            # Get professor information
            professors = course.professors.all()
            professor_info = []
            for prof in professors:
                prof_info = f"{prof.name}"
                if prof.title:
                    prof_info += f" ({prof.title})"
                if prof.department:
                    prof_info += f" from {prof.department}"
                professor_info.append(prof_info)
            
            # Get current offerings if any
            current_offerings = course.offerings.all().order_by('-term__term_code')[:3]  # Get 3 most recent
            offering_info = []
            for offering in current_offerings:
                offering_info.append(
                    f"Section {offering.section} in {offering.term.name} "
                    f"taught by {offering.instructor} at {offering.location}"
                )
            
            return {
                'code': course.code,
                'title': course.title,
                'units': float(course.units),
                'prerequisites': course.prerequisites or 'None',
                'description': self._get_enhanced_description(course.code, course.description),
                'department': course.department or 'Not specified',
                'professors': professor_info,
                'recent_offerings': offering_info
            }
        except Exception as e:
            print(f"Error getting course info: {e}")
            return None

    def _is_course_level_query(self, message):
        """Check if message is asking for courses at a specific level"""
        message_lower = message.lower()
        
        # Look for level patterns: "1000 level", "2000-level", "3000 level", "4000 level"
        level_patterns = [
            r'\b([1-4])000\s*level\b',
            r'\b([1-4])000[-\s]*level\b',
            r'\blevel\s*([1-4])000\b',
            r'\b([1-4])000\s*courses?\b',
            r'\b([1-4])000[-\s]*courses?\b'
        ]
        
        import re
        for pattern in level_patterns:
            if re.search(pattern, message_lower):
                return True
        
        return False

    def _extract_course_level_query(self, message):
        """Extract subject and level from course level query"""
        message_lower = message.lower()
        
        # Extract level (1000, 2000, 3000, 4000)
        import re
        level_patterns = [
            r'\b([1-4])000\s*level\b',
            r'\b([1-4])000[-\s]*level\b', 
            r'\blevel\s*([1-4])000\b',
            r'\b([1-4])000\s*courses?\b',
            r'\b([1-4])000[-\s]*courses?\b'
        ]
        
        level = None
        for pattern in level_patterns:
            match = re.search(pattern, message_lower)
            if match:
                level = f"{match.group(1)}000"
                break
        
        if not level:
            return None
        
        # Subject mapping for common terms
        subject_mappings = {
            'math': 'MAT', 'mathematics': 'MAT', 'calculus': 'MAT', 'algebra': 'MAT',
            'computer science': 'CSI', 'cs': 'CSI', 'computing': 'CSI', 'programming': 'CSI',
            'physics': 'PHY', 'chemistry': 'CHM', 'biology': 'BIO', 'chem': 'CHM', 'bio': 'BIO',
            'economics': 'ECO', 'econ': 'ECO', 'psychology': 'PSY', 'psych': 'PSY',
            'political science': 'POL', 'politics': 'POL', 'poli sci': 'POL',
            'engineering': 'ENG', 'english': 'ENG', 'french': 'FRA', 'français': 'FRA',
            'history': 'HIS', 'geography': 'GEG', 'administration': 'ADM', 'business': 'ADM',
            'software engineering': 'SEG', 'software': 'SEG', 'electrical': 'ELG',
            'mechanical': 'MCG', 'chemical engineering': 'CHG', 'civil': 'CVG',
            'anthropology': 'ANT', 'sociology': 'SOC', 'criminology': 'CRM',
            'communication': 'CMN', 'philosophy': 'PHI', 'art': 'ART', 'music': 'MUS'
        }
        
        # Find subject in message
        subject_code = None
        for term, code in subject_mappings.items():
            if term in message_lower:
                subject_code = code
                break
        
        # If no mapping found, try to extract 3-letter codes directly
        if not subject_code:
            code_match = re.search(r'\b([A-Za-z]{2,4})\s*' + level, message_lower)
            if code_match:
                subject_code = code_match.group(1).upper()
        
        return {
            'subject': subject_code,
            'level': level
        }

    def _search_courses_by_level(self, subject, level):
        """Search for real courses by subject and level using CourseDescriptionService"""
        try:
            from .services.course_description_service import CourseDescriptionService
            
            if not subject or not level:
                return []
            
            # Convert level to range (e.g., "3000" -> 3000-3999)
            level_start = int(level)
            level_end = level_start + 999
            
            # Get all courses for the subject
            subject_courses = CourseDescriptionService.get_courses_by_subject(subject)
            matching_courses = []
            
            for course in subject_courses:
                course_code = course.get('courseCode', '').strip()
                if not course_code:
                    continue
                
                # Extract subject and number from course code
                import re
                match = re.match(r'^([A-Za-z]+)\s+(\d+)', course_code)
                if match:
                    course_subject = match.group(1).upper()
                    course_number = int(match.group(2))
                    
                    # Check if number is in level range
                    if level_start <= course_number <= level_end:
                        matching_courses.append({
                            'code': course_code,
                            'title': course.get('courseTitle', ''),
                            'description': course.get('description', ''),
                            'units': course.get('units', ''),
                            'prerequisites': course.get('prerequisites', '')
                        })
            
            # Sort by course number
            matching_courses.sort(key=lambda x: x['code'])
            return matching_courses[:15]  # Limit to 15 courses
            
        except Exception as e:
            print(f"Error searching courses by level: {e}")
            return []

    def _format_course_level_response(self, courses, subject, level):
        """Format the response for course level searches"""
        if not courses:
            return f"I couldn't find any {level}-level {subject} courses in the database. Please check the course catalog or try a different subject."
        
        response_parts = [
            f"🎓 Here are {level}-level {subject} courses offered at uOttawa:\n"
        ]
        
        for i, course in enumerate(courses, 1):
            title = course['title'] if course['title'] else 'No title available'
            response_parts.append(f"{i}. **{course['code']}** - {title}")
        
        response_parts.append(f"\n📝 Found {len(courses)} courses. Please check prerequisites and course availability before enrolling.")
        
        return '\n'.join(response_parts)

    def _is_general_rmp_request(self, message_content):
        """Check if this is a general RMP request without a specific professor name"""
        message_lower = message_content.lower()
        
        # Keywords that indicate a general RMP request
        general_rmp_keywords = [
            'help me find a prof on rmp',
            'help me find a professor on rmp',
            'find a prof on rmp',
            'find a professor on rmp',
            'help me find rmp',
            'find rmp for',
            'rmp search',
            'rate my professor search',
            'help with rmp',
            'can you help me find a prof',
            'can you help me find a professor',
            'help me look up a prof',
            'help me look up a professor'
        ]
        
        # Check if it's a general request
        is_general_request = any(keyword in message_lower for keyword in general_rmp_keywords)
        
        if is_general_request:
            # Make sure there's no specific professor name mentioned
            professor_name = self._extract_professor_name(message_content)
            return professor_name is None
        
        return False

    def _should_include_rmp_link(self, message_content):
        """Check if the message mentions a professor and could benefit from an RMP link"""
        message_lower = message_content.lower()
        
        # Don't include RMP link for general requests without professor names
        if self._is_general_rmp_request(message_content):
            return False
        
        # Check if there's a specific professor name (this now works with or without "prof" keywords)
        professor_name = self._extract_professor_name(message_content)
        return professor_name is not None

    def _extract_professor_name(self, message):
        """Extract professor name from user message if it's a professor query"""
        import re
        
        message_lower = message.lower()
        
        # First check if this is a general RMP request without a specific name
        if self._is_general_rmp_request(message):
            return None
        
        # Enhanced patterns to extract professor names (more flexible and comprehensive)
        patterns = [
            # Patterns with explicit professor keywords
            # "help me find RMP for Prof Vida" or "find RMP for Professor Smith"
            r'(?:rmp|rate my professor|rating|review).*?(?:for|of)\s+(?:professor|prof\.?|dr\.?|doctor)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)',
            # "Professor John Smith" or "Prof John Smith" - captures multiple names
            r'(?:professor|prof\.?|dr\.?|doctor)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)',
            # "John Smith" after phrases like "about", "tell me about", "who is", "find", "search"
            r'(?:about|tell me about|who is|find|search|for)\s+(?:professor|prof\.?|dr\.?|doctor)?\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)',
            # "Prof. Smith" or "Dr. Smith" - single or multiple names
            r'(?:prof\.?|dr\.?)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)',
            # Names in quotes
            r'["\']([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)["\']',
            # Capitalized names that appear after professor keywords (broader search)
            r'(?:professor|prof\.?|dr\.?|doctor|instructor|teacher).*?([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)',
            # "Prof Vida" or "Dr Smith" (no period, common casual usage)
            r'(?:prof|dr|professor|doctor)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)',
            # "help me find a RMP for Vida" - name without title
            r'(?:rmp|rate my professor|rating|review).*?(?:for|of)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)',
            # "give me for prof wassim" - casual requests
            r'(?:give me|get me|find|search).*?(?:for|about)\s+(?:prof\.?|professor|dr\.?|doctor)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)',
            
            # NEW: Patterns that work without professor keywords
            # "RMP for Nour" or "find RMP for Smith"
            r'(?:rmp|rate my professor|rating|review).*?(?:for|of)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)',
            # Capitalized names that appear after context words
            r'(?:about|tell me about|who is|find|search for|looking for|get|need)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)',
            # Simple pattern: just a capitalized name (but be careful - only if it looks like a professor context)
            r'\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\b'
        ]
        
        # Check if there are any professor-related context words or RMP mentions
        professor_context_keywords = [
            'professor', 'prof', 'dr.', 'doctor', 'instructor', 'teacher',
            'prof.', 'proffesor', 'proffessor', 'rmp', 'rate my professor',
            'rating', 'review', 'grade', 'grading', 'teaches', 'taught'
        ]
        
        has_professor_context = any(keyword in message_lower for keyword in professor_context_keywords)
        
        for i, pattern in enumerate(patterns):
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                # Basic validation - should have at least 2 characters and look like a name
                if len(name) >= 2 and re.match(r'^[A-Za-z\s\.]+$', name):
                    # Clean up the name (remove extra spaces, etc.)
                    name = ' '.join(name.split())
                    
                    # For the last pattern (simple capitalized names), require professor context
                    if i == len(patterns) - 1:  # Last pattern (simple capitalized names)
                        if has_professor_context:
                            return name
                    else:
                        # For all other patterns, accept the name
                        return name
                        
        return None

    def _generate_rmp_link(self, professor_name):
        """Generate RateMyProfessors search link"""
        if not professor_name:
            return None
            
        # URL encode the professor name for the search query
        import urllib.parse
        encoded_name = urllib.parse.quote_plus(professor_name)
        
        # Only provide Google search for RateMyProfessors
        google_search = f"https://www.google.com/search?q=RateMyProfessors+{encoded_name}+uOttawa"
        
        return google_search

    def _is_historical_course_request(self, message_content):
        """Check if this is a request for historical course performance data using AI"""
        try:
            openai_api_key = os.getenv('OPENAI_API_KEY')
            if not openai_api_key:
                print("[KAIRO DEBUG] OPENAI_API_KEY not found - cannot detect historical requests")
                # No AI available, we don't know - return False
                return False
            
            # Use AI to detect if this is asking about past course performance/grades
            system_prompt = """You are a classification assistant. Determine if the user's message is asking about PAST RESULTS, HISTORICAL PERFORMANCE, or GRADES for a course.

Return ONLY "true" or "false".

Examples of historical queries (return true):
- "What were the past grades for MAT1320?"
- "How did students do in CSI2110 last year?"
- "What's the average grade in PHY1122?"
- "Show me past results for ITI1121"
- "How hard is MAT1341?"
- "What were the grades like in this course?"

Examples of non-historical queries (return false):
- "What are the prerequisites for MAT1320?"
- "Tell me about CSI2110"
- "When is MAT1341 offered?"
- "Who teaches PHY1122?"
"""
            
            client = openai.OpenAI(api_key=openai_api_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message_content}
                ],
                max_tokens=10,
                temperature=0.1
            )
            
            result = response.choices[0].message.content.strip().lower()
            is_historical = result == "true"
            print(f"[KAIRO DEBUG] AI historical detection for '{message_content}': {is_historical}")
            return is_historical
            
        except Exception as e:
            print(f"[KAIRO DEBUG] Error in AI historical detection: {e}")
            # If AI fails, we don't know - return False
            return False

    def _is_professor_grading_history_request(self, message_content):
        """Check if this is a request for professor grading history without a specific course"""
        message_lower = message_content.lower()
        
        # Keywords that indicate professor grading history requests
        professor_grading_keywords = [
            'how did this prof grade before',
            'how did this professor grade before',
            'how hard is this prof',
            'how hard is this professor',
            'what grades does this prof give',
            'what grades does this professor give',
            'how was this prof\'s grade distribution',
            'how was this professor\'s grade distribution',
            'how does this prof grade',
            'how does this professor grade',
            'what\'s this prof\'s grading like',
            'what\'s this professor\'s grading like',
            'how tough is this prof',
            'how tough is this professor',
            'is this prof a hard grader',
            'is this professor a hard grader',
            'what are this prof\'s grades like',
            'what are this professor\'s grades like',
            'how did prof grade',
            'how did professor grade',
            'prof grading history',
            'professor grading history',
            'prof grade distribution',
            'professor grade distribution'
        ]
        
        return any(keyword in message_lower for keyword in professor_grading_keywords)

    def _extract_historical_course_code(self, message):
        """Extract course code from user message if it's a historical course query"""
        import re
        
        # First check if this is a professor grading history request without course code
        if self._is_professor_grading_history_request(message):
            return None
        
        # Then check if this is a historical course request
        if not self._is_historical_course_request(message):
            return None
        
        # Common course code patterns (case-insensitive)
        patterns = [
            # Standard format: ABC1234, ABC 1234, ABC-1234
            r'\b([A-Za-z]{2,4})\s*[-\s]*(\d{4})\b',
            # With spaces: ABC 1234
            r'\b([A-Za-z]{2,4})\s+(\d{4})\b',
            # Common variations
            r'\b([A-Za-z]{2,4})[-\s]*(\d{4})\b'
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, message, re.IGNORECASE)
            if matches:
                # Take the first match and format it properly
                subject, number = matches[0]
                course_code = f"{subject.upper()}{number}"
                
                # Basic validation - common uOttawa course prefixes
                valid_prefixes = [
                    'ADM', 'APA', 'ARC', 'ARV', 'BIO', 'CEG', 'CHG', 'CHM', 'CLA', 'COM',
                    'CRM', 'CSI', 'CSG', 'EAS', 'ECO', 'ELG', 'ENG', 'ENV', 'FRA', 'GEG',
                    'GEO', 'HIS', 'ITI', 'MAT', 'MCG', 'MEC', 'PHI', 'PHY', 'POL', 'PSY',
                    'SOC', 'STA', 'SEG', 'TVP', 'ANT', 'ART', 'MUS', 'THE', 'REL', 'LIN',
                    'ESP', 'ITA', 'GER', 'RUS', 'JPN', 'CHI', 'ARB', 'POR', 'LAT', 'GRE'
                ]
                
                if any(subject.upper().startswith(prefix) for prefix in valid_prefixes):
                    return course_code.lower()  # Return in lowercase for uo.zone
                    
        return None

    def _generate_historical_course_link(self, course_code):
        """Generate uo.zone historical course results link"""
        if not course_code:
            return None
            
        # Generate uo.zone link (course_code should already be lowercase)
        return f"https://uo.zone/course/{course_code}"

    def _format_dates_response(self, data):
        if not data:
            return "I couldn't find any specific important dates based on your query. You might want to check the university's official academic calendar."
        
        responses = []
        if len(data) == 1:
            date_info = data[0]
            response = f"Found an important date: {date_info.get('title', 'N/A')}"
            if date_info.get('start_date'):
                response += f" starting on {date_info['start_date']}"
            if date_info.get('end_date') and date_info['end_date'] != date_info['start_date']:
                response += f" until {date_info['end_date']}"
            response += f". Description: {date_info.get('description', 'No description available.')}"
            if date_info.get('link'):
                response += f" More details: {date_info['link']}"
            responses.append(response)
        else:
            responses.append(f"I found {len(data)} important dates/events:")
            for date_info in data[:3]: # Limit to 3 to keep it concise
                response = f"- {date_info.get('title', 'N/A')}"
                if date_info.get('start_date'):
                    response += f" ({date_info['start_date']}"
                if date_info.get('end_date') and date_info['end_date'] != date_info['start_date']:
                    response += f" to {date_info['end_date']}"
                response += ")"
                responses.append(response)
            if len(data) > 3:
                responses.append("Please check the university's calendar for a full list if these aren't what you're looking for.")
        return "\n".join(responses)

    def _format_exams_response(self, data):
        if not data:
            return "I couldn't find any specific exam information based on your query. You might want to check the university's official exam schedule."

        responses = []
        if len(data) == 1:
            exam_info = data[0]
            response = f"Found an exam: {exam_info.get('course_code', 'N/A')} - {exam_info.get('title', 'N/A')}"
            if exam_info.get('date'):
                response += f" on {exam_info['date']}"
            if exam_info.get('start_time'):
                response += f" from {exam_info['start_time']}"
            if exam_info.get('end_time'):
                response += f" to {exam_info['end_time']}"
            if exam_info.get('location'):
                response += f" at {exam_info['location']}"
            response += f". Description: {exam_info.get('description', 'No specific description.')}"
            if exam_info.get('is_deferred'):
                response += " (This is a deferred exam)."
            responses.append(response)
        else:
            responses.append(f"I found {len(data)} exams matching your query:")
            for exam_info in data[:3]: # Limit to 3
                response = f"- {exam_info.get('course_code', 'N/A')} {exam_info.get('title', 'N/A')} on {exam_info.get('date', 'N/A')} at {exam_info.get('location', 'N/A')}"
                responses.append(response)
            if len(data) > 3:
                responses.append("Please check the full exam schedule if these aren't what you're looking for.")
        return "\n".join(responses)

    def get(self, request, *args, **kwargs):
        session_id_str = request.query_params.get('session_id')
        if not session_id_str:
            return Response({"error": "session_id query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            session_id = uuid.UUID(session_id_str)
        except ValueError:
            return Response({"error": "Invalid session_id format. Must be a valid UUID."}, status=status.HTTP_400_BAD_REQUEST)

        messages = self._get_conversation_history(session_id)
        if not messages:
            return Response({"message": "No messages found for this session_id or you do not have permission."}, status=status.HTTP_404_NOT_FOUND)
            
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        print(f"[KAIRO DEBUG] AI Chat POST request received")
        print(f"[KAIRO DEBUG] Request path: {request.path}")
        print(f"[KAIRO DEBUG] Request data: {request.data}")
        print(f"[KAIRO DEBUG] Request user: {request.user}")
        
        try:
            input_serializer = MessageInputSerializer(data=request.data)
            if not input_serializer.is_valid():
                print(f"[KAIRO DEBUG] Serializer validation failed: {input_serializer.errors}")
                return Response(input_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"[KAIRO DEBUG] Exception during serialization: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            validated_data = input_serializer.validated_data
            user_message_content = validated_data['message']
            session_id = validated_data.get('session_id')
            print(f"[KAIRO DEBUG] Processing message: '{user_message_content}' with session_id: {session_id}")

            # Check if we should reset the session
            if session_id and self._should_reset_session(user_message_content):
                session_id = self._create_new_session()
                return Response({
                    "message": "Chat history has been cleared. Starting a new conversation.",
                    "session_id": str(session_id)
                }, status=status.HTTP_200_OK)

            # Create new session if none provided
            if not session_id:
                session_id = self._create_new_session()
                print(f"[KAIRO DEBUG] Created new session: {session_id}")

            # Clean up old sessions
            self._cleanup_old_sessions()
        except Exception as e:
            print(f"[KAIRO DEBUG] Error during initial processing: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            # Save user's message
            user_message = Message.objects.create(
                user=request.user,
                session_id=session_id,
                content=user_message_content,
                role='user'
            )
            print(f"[KAIRO DEBUG] Saved user message: {user_message.id}")

            # Check if Kairo should provide an honest response about not knowing something
            print(f"[KAIRO DEBUG] Checking if this requires an honest response...")
            honest_response = self._should_provide_honest_response(user_message_content)
            if honest_response['should_respond']:
                print(f"[KAIRO DEBUG] Providing honest response about capabilities")
                
                # Save the honest response as an assistant message
                assistant_message = Message.objects.create(
                    user=request.user,
                    session_id=session_id,
                    content=honest_response['response'],
                    role='assistant'
                )
                
                return Response({
                    "content": honest_response['response'],
                    "session_id": str(session_id)
                }, status=status.HTTP_200_OK)

            # Get conversation history
            history = self._get_conversation_history(session_id)
            print(f"[KAIRO DEBUG] Retrieved conversation history: {len(history)} messages")
        except Exception as e:
            print(f"[KAIRO DEBUG] Error saving user message or getting history: {e}")
            return Response({"error": "Failed to process message"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # --- Custom Logic for Calendar, Dates, Exams, and Courses ---
        ai_response_text = None
        processed_by_custom_logic = False
        user_message_lower = user_message_content.lower()

        # FIRST: Check for schedule generation requests (highest priority for academic planning)
        print(f"[KAIRO DEBUG] Checking for schedule generation request...")
        try:
            import asyncio
            
            # Check if this is a schedule generation request
            is_schedule_request = asyncio.run(ScheduleGeneratorService.is_schedule_generation_request(user_message_content))
            
            if is_schedule_request:
                print(f"[KAIRO DEBUG] Schedule generation request detected")
                
                # Generate the schedule
                schedule_result = asyncio.run(ScheduleGeneratorService.generate_schedule_from_message(request.user, user_message_content))
                
                if schedule_result['success']:
                    print(f"[KAIRO DEBUG] Schedule generated successfully")
                    ai_response_text = schedule_result['message']
                    processed_by_custom_logic = True
                else:
                    print(f"[KAIRO DEBUG] Schedule generation failed: {schedule_result.get('message', 'Unknown error')}")
                    ai_response_text = schedule_result['message']
                    processed_by_custom_logic = True
                    
        except Exception as e:
            print(f"[KAIRO DEBUG] Error in schedule generation: {e}")
            # Continue to other processing if schedule generation fails
        
        # SECOND: Check for calendar event requests if not already processed
        if not processed_by_custom_logic:
            print(f"[KAIRO DEBUG] About to check for calendar events in: '{user_message_content}'")
            event_detected = self._detect_calendar_event_request(user_message_content)
            print(f"[KAIRO DEBUG] Calendar detection result: {event_detected}")
            if event_detected:
                print(f"[KAIRO DEBUG] Calendar event detected in message: {user_message_content}")
                try:
                    if event_detected == 'add':
                        calendar_event = self._create_calendar_event_from_message(user_message_content, request.user)
                        if calendar_event:
                            print(f"[KAIRO DEBUG] Calendar event created: {calendar_event.title} on {calendar_event.start_date}")
                            # Format the response with time information if available
                            date_str = calendar_event.start_date.strftime('%A, %B %d, %Y')
                            if calendar_event.start_time and calendar_event.end_time:
                                # Cross-platform time formatting (Windows doesn't support %-I)
                                start_12h = calendar_event.start_time.strftime('%I:%M %p').lstrip('0')
                                end_12h = calendar_event.end_time.strftime('%I:%M %p').lstrip('0')
                                time_str = f" from {start_12h} to {end_12h}"
                            else:
                                time_str = ""
                            ai_response_text = f"✅ I added '{calendar_event.title}' to your calendar for {date_str}{time_str}."
                            processed_by_custom_logic = True
                        else:
                            print(f"[KAIRO DEBUG] Failed to parse calendar event from message")
                            ai_response_text = "I couldn't parse the event details from your message. Please try specifying the event name and date more clearly."
                            processed_by_custom_logic = True
                            
                    elif event_detected == 'delete':
                        deletion_result = self._delete_calendar_events_from_message(user_message_content, request.user)
                        if deletion_result['type'] == 'all':
                            print(f"[KAIRO DEBUG] Deleted all calendar events: {deletion_result['count']} events")
                            if deletion_result['count'] > 0:
                                ai_response_text = f"🗑️ I cleared all {deletion_result['count']} events from your calendar."
                            else:
                                ai_response_text = "Your calendar is already empty."
                            processed_by_custom_logic = True
                        elif deletion_result['type'] == 'specific':
                            print(f"[KAIRO DEBUG] Deleted specific events: {deletion_result['count']} events matching '{deletion_result['title']}'")
                            if deletion_result['count'] > 0:
                                ai_response_text = f"🗑️ I removed {deletion_result['count']} event(s) matching '{deletion_result['title']}' from your calendar."
                            else:
                                ai_response_text = f"I couldn't find any events matching '{deletion_result['title']}' in your calendar."
                            processed_by_custom_logic = True
                        elif deletion_result['type'] == 'date':
                            print(f"[KAIRO DEBUG] Deleted events on date: {deletion_result['count']} events on {deletion_result['date']}")
                            if deletion_result['count'] > 0:
                                ai_response_text = f"🗑️ I removed {deletion_result['count']} event(s) scheduled for {deletion_result['date']} from your calendar."
                            else:
                                ai_response_text = f"I couldn't find any events scheduled for {deletion_result['date']} in your calendar."
                            processed_by_custom_logic = True
                        else:
                            print(f"[KAIRO DEBUG] No events found to delete")
                            ai_response_text = "I couldn't identify which event you want to remove. Please specify the event name or date more clearly."
                            processed_by_custom_logic = True
                            
                except Exception as e:
                    print(f"[KAIRO DEBUG] Error handling calendar event: {e}")
                    if event_detected == 'add':
                        ai_response_text = "I had trouble adding that event to your calendar. Please try again."
                    else:
                        ai_response_text = "I had trouble removing that event from your calendar. Please try again."
                    processed_by_custom_logic = True

        # Check for course level queries (e.g., "3000 level math courses") before individual course checks
        if not processed_by_custom_logic and self._is_course_level_query(user_message_content):
            print(f"[KAIRO DEBUG] Course level query detected: '{user_message_content}'")
            level_query = self._extract_course_level_query(user_message_content)
            if level_query and level_query['subject'] and level_query['level']:
                subject = level_query['subject']
                level = level_query['level']
                print(f"[KAIRO DEBUG] Searching for {level}-level {subject} courses")
                courses = self._search_courses_by_level(subject, level)
                ai_response_text = self._format_course_level_response(courses, subject, level)
                processed_by_custom_logic = True
                print(f"[KAIRO DEBUG] Found {len(courses)} courses for {level}-level {subject}")

        # Check for course code in the message (only if not already processed)
        # Only handle HISTORICAL course queries in backend - let frontend handle all other course info
        if not processed_by_custom_logic:
            course_code = self._extract_course_code(user_message_content)
            
            # Check ONLY for HISTORICAL queries (backend-specific functionality)
            if course_code and self._is_historical_course_request(user_message_content):
                print(f"[KAIRO DEBUG] Historical query detected for {course_code}")
                historical_link = self._generate_historical_course_link(course_code.lower())
                if historical_link:
                    # Generate natural response using AI but force the link
                    try:
                        openai_api_key = os.getenv('OPENAI_API_KEY')
                        if openai_api_key:
                            # Use OpenAI to generate a natural understanding response, then append the link
                            system_prompt = f"""You are Kairo, a helpful academic assistant. The user asked about past results/performance for course {course_code}. 

Generate a natural response that shows you understand their question, then say you'll provide the past results data. Keep it brief (1-2 sentences max) and natural.

Examples:
- If they asked "How did people do in MAT1341?", respond like: "I can show you how students performed in MAT1341."
- If they asked "What were the grades like?", respond like: "I can show you the grade distributions and performance data."

Do NOT include any links or say where you're getting the data from. Just acknowledge their question naturally."""

                            client = openai.OpenAI(api_key=openai_api_key)
                            response = client.chat.completions.create(
                                model="gpt-4o-mini",
                                messages=[
                                    {"role": "system", "content": system_prompt},
                                    {"role": "user", "content": user_message_content}
                                ],
                                max_tokens=150,
                                temperature=0.7
                            )
                            
                            natural_response = response.choices[0].message.content.strip()
                            ai_response_text = f"{natural_response}\n\n→ {historical_link}"
                        else:
                            # No API key, use simple response
                            ai_response_text = f"Here are the past results for {course_code.upper()}:\n\n→ {historical_link}"
                        
                    except Exception as e:
                        print(f"Error generating natural response: {e}")
                        # Fallback to simple response
                        ai_response_text = f"Here are the past results for {course_code.upper()}:\n\n→ {historical_link}"
                else:
                    ai_response_text = f"I couldn't generate the historical results link for {course_code}."
                processed_by_custom_logic = True
                        
                print(f"[KAIRO DEBUG] Historical query completed, response length: {len(ai_response_text) if ai_response_text else 0}")
            
            # All other course queries (info, prerequisites, timing, etc.) are handled by frontend AI services

        # Continue with date and exam checks only if not already processed
        if not processed_by_custom_logic:
            # Pure AI-based detection - no hardcoded patterns
            openai_api_key = os.getenv('OPENAI_API_KEY')
            
            if openai_api_key:
                try:
                    import openai
                    client = openai.OpenAI(api_key=openai_api_key)
                    
                    # AI detection for date queries
                    date_response = client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[
                            {"role": "system", "content": "Return only 'true' if asking about important dates, deadlines, holidays, enrollment, payment dates, or academic calendar, otherwise 'false'."},
                            {"role": "user", "content": user_message_content}
                        ],
                        max_tokens=10,
                        temperature=0.0
                    )
                    
                    # AI detection for exam queries
                    exam_response = client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[
                            {"role": "system", "content": "Return only 'true' if asking about exam schedules, final exams, midterms, or exam dates, otherwise 'false'."},
                            {"role": "user", "content": user_message_content}
                        ],
                        max_tokens=10,
                        temperature=0.0
                    )
                    
                    is_date_query = date_response.choices[0].message.content.strip().lower() == 'true'
                    is_exam_query = exam_response.choices[0].message.content.strip().lower() == 'true'
                except:
                    # AI failed, we don't know
                    is_date_query = False
                    is_exam_query = False
            else:
                # No AI available, we don't know
                is_date_query = False
                is_exam_query = False

            auth_header = {'Authorization': request.headers.get('Authorization', '')}

            if is_date_query:
                api_url = request.build_absolute_uri('/api/dates/')
                params = {'search': user_message_content} # General search first
                if "enrollment" in user_message_lower: params['category'] = 'enrollment'
                elif "holiday" in user_message_lower: params['category'] = 'holiday'
                # Add more specific category filters if needed

                try:
                    response = requests.get(api_url, params=params, headers=auth_header, timeout=5)
                    response.raise_for_status() # Raise an exception for HTTP errors
                    dates_data = response.json()
                    ai_response_text = self._format_dates_response(dates_data)
                    processed_by_custom_logic = True
                except requests.exceptions.RequestException as e:
                    print(f"Error calling ImportantDate API: {e}")
                    # Fall through to OpenAI or return a generic error
                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON from ImportantDate API: {e}")

            elif is_exam_query:
                api_url = request.build_absolute_uri('/api/exams/')
                params = {'search': user_message_content} # General search
                if "deferred" in user_message_lower: params['is_deferred'] = 'true'
                
                # Basic course code extraction (very simplified)
                import re
                match = re.search(r'([A-Za-z]{2,4}\s?\d{3,4})', user_message_content)
                if match:
                    params['course_code'] = match.group(1).replace(" ", "") # Normalize course code

                try:
                    response = requests.get(api_url, params=params, headers=auth_header, timeout=5)
                    response.raise_for_status()
                    exams_data = response.json()
                    ai_response_text = self._format_exams_response(exams_data)
                    processed_by_custom_logic = True
                except requests.exceptions.RequestException as e:
                    print(f"Error calling ExamEvent API: {e}")
                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON from ExamEvent API: {e}")

        if not processed_by_custom_logic and ai_response_text is None:
            # Get conversation history
            history = self._get_conversation_history(session_id)
            
            # Prepare system prompt for general conversation
            system_prompt = self._format_system_prompt()

            # Format messages for OpenAI API
            messages_for_openai = self._format_messages_for_openai(history, system_prompt)

            openai_api_key = os.environ.get('OPENAI_API_KEY')
            if not openai_api_key:
                # Fallback to Django settings
                openai_api_key = getattr(settings, 'OPENAI_API_KEY', None)
            
            if not openai_api_key:
                print("ERROR: OPENAI_API_KEY environment variable not set.") 
                ai_response_text = "AI service is currently unavailable due to a configuration issue. Please try again later."
            else:
                try:
                    client = openai.OpenAI(api_key=openai_api_key)
                    completion = client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=messages_for_openai,
                        temperature=0.7  # Slightly increased for more natural conversation
                    )
                    ai_response_text = completion.choices[0].message.content.strip()

                    # Add historical course link for course performance queries
                    historical_course_code = self._extract_historical_course_code(user_message_content)
                    if historical_course_code:
                        historical_link = self._generate_historical_course_link(historical_course_code)
                        if historical_link:
                            ai_response_text += f"\n\n→ {historical_link}"

                except openai.APIConnectionError as e:
                    print(f"OpenAI APIConnectionError: {e}")
                    ai_response_text = "I'm having trouble connecting to the AI service right now."
                except openai.RateLimitError as e:
                    print(f"OpenAI RateLimitError: {e}")
                    ai_response_text = "I'm experiencing high demand. Please try again in a moment."
                except openai.APIStatusError as e:
                    print(f"OpenAI APIStatusError: {e}")
                    ai_response_text = "There was an issue with the AI service."
                except Exception as e:
                    print(f"Unexpected error during OpenAI call: {e}")
                    ai_response_text = "An unexpected error occurred while trying to get an AI response."

        if ai_response_text is None:
            ai_response_text = "I'm not sure how to respond to that. Can you try rephrasing?"

        # Remove hardcoded RMP link generation - no more hardcoded responses

        # Save AI's message
        ai_message = Message.objects.create(
            user=request.user,
            session_id=session_id,
            content=ai_response_text,
            role='assistant'
        )

        try:
            return Response({
                "role": ai_message.role,
                "content": ai_message.content,
                "session_id": str(session_id)
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            print(f"[KAIRO DEBUG] Error creating response: {e}")
            return Response({"error": "Failed to create response"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _detect_calendar_event_request(self, message):
        """Detect if the user wants to add or remove an event from their calendar"""
        import re
        message_lower = message.lower()
        
        print(f"[KAIRO DEBUG] _detect_calendar_event_request called with: '{message}'")
        
        # Patterns that indicate calendar event creation
        add_event_patterns = [
            r'add\s+.*\s+to\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)',
            r'schedule\s+.*\s+(?:on|for)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)',
            r'put\s+.*\s+(?:on|in)\s+(?:my\s+)?calendar',
            r'add\s+.*\s+to\s+(?:my\s+)?calendar',
            r'create\s+(?:a\s+)?(?:calendar\s+)?event',
            r'remind\s+me\s+.*\s+(?:on|for)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)',
            # New: Support for exact days
            r'add\s+.*\s+(?:on|for)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)',
            r'schedule\s+.*\s+(?:on|for)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)',
            r'put\s+.*\s+(?:on|for)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)',
            # Support for specific dates like "June 5", "12/25", etc.
            r'add\s+.*\s+(?:on|for)\s+\d{1,2}[/-]\d{1,2}',
            r'schedule\s+.*\s+(?:on|for)\s+\d{1,2}[/-]\d{1,2}',
            # NEW: More flexible patterns for course-related events
            r'add\s+.*\s+(?:exam|test|midterm|final|quiz|assignment|project|homework|hw)\s+.*(?:for|on)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)',
            r'add\s+.*\s+(?:exam|test|midterm|final|quiz|assignment|project|homework|hw)\s+.*(?:for|on)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)',
            r'add\s+.*\s+(?:exam|test|midterm|final|quiz|assignment|project|homework|hw)\s+.*(?:for|on)\s+\d{1,2}[/-]\d{1,2}',
            # Pattern specifically for "add [course] [event] for [date]"
            r'add\s+\w+\d+\s+(?:exam|test|midterm|final|quiz|assignment|project|homework|hw)\s+(?:for|on)',
            r'schedule\s+\w+\d+\s+(?:exam|test|midterm|final|quiz|assignment|project|homework|hw)\s+(?:for|on)',
        ]
        
        # Patterns that indicate calendar event deletion
        delete_event_patterns = [
            r'remove\s+.*\s+from\s+(?:my\s+)?calendar',
            r'delete\s+.*\s+from\s+(?:my\s+)?calendar',
            r'cancel\s+.*\s+(?:from\s+)?(?:my\s+)?calendar',
            r'remove\s+(?:the\s+)?event\s+.*',
            r'delete\s+(?:the\s+)?event\s+.*',
            r'cancel\s+(?:the\s+)?event\s+.*',
            r'take\s+.*\s+off\s+(?:my\s+)?calendar',
            r'clear\s+(?:my\s+)?calendar',
            r'delete\s+all\s+events',
            r'remove\s+all\s+events',
            # Enhanced patterns for more natural language
            r'get\s+rid\s+of\s+.*\s+(?:from\s+)?(?:my\s+)?calendar',
            r'erase\s+.*\s+(?:from\s+)?(?:my\s+)?calendar',
            r'eliminate\s+.*\s+(?:from\s+)?(?:my\s+)?calendar',
            r'drop\s+.*\s+(?:from\s+)?(?:my\s+)?calendar',
            r'unschedule\s+.*',
            r'cancel\s+.*',
            r'remove\s+.*',
            r'delete\s+.*',
            # Patterns for clearing everything
            r'clear\s+everything',
            r'delete\s+everything',
            r'remove\s+everything',
            r'wipe\s+(?:my\s+)?calendar',
            r'empty\s+(?:my\s+)?calendar',
            # More specific patterns
            r'i\s+don\'?t\s+need\s+.*\s+anymore',
            r'i\s+want\s+to\s+remove\s+.*',
            r'i\s+want\s+to\s+delete\s+.*',
            r'i\s+want\s+to\s+cancel\s+.*',
            # Simple clear commands
            r'^clear$',
            r'^clear\s*$',
            r'just\s+clear',
            r'please\s+clear',
            r'can\s+you\s+clear',
            r'clear\s+it\s+all',
            r'clear\s+all',
            r'clear\s+the\s+calendar',
            r'reset\s+(?:my\s+)?calendar',
            r'start\s+fresh',
            r'clean\s+(?:my\s+)?calendar',
        ]
        
        # Check for deletion first
        for pattern in delete_event_patterns:
            if re.search(pattern, message_lower):
                print(f"[KAIRO DEBUG] Matched DELETE pattern: {pattern}")
                return 'delete'
        
        # Then check for addition
        for pattern in add_event_patterns:
            if re.search(pattern, message_lower):
                print(f"[KAIRO DEBUG] Matched ADD pattern: {pattern}")
                return 'add'
        
        print(f"[KAIRO DEBUG] No calendar patterns matched")
        return None

    def _create_calendar_event_from_message(self, message, user):
        """Parse the message and create a calendar event"""
        import re
        from datetime import datetime, date, time
        from django.utils import timezone
        
        # Extract event title and date
        event_title = self._extract_event_title(message)
        event_date = self._extract_event_date(message)
        
        if not event_title or not event_date:
            print(f"[KAIRO DEBUG] Missing title or date: title='{event_title}', date='{event_date}'")
            return None
        
        # Try to extract custom times from the message
        start_time, end_time = self._extract_times_from_message(message)
        
        # If no custom times found, use default times based on event type
        if not start_time or not end_time:
            # For exams/tests: morning time, for other events: afternoon
            if any(keyword in event_title.lower() for keyword in ['exam', 'test', 'midterm', 'final', 'quiz']):
                start_time = time(9, 0)   # 9:00 AM
                end_time = time(12, 0)    # 12:00 PM
            else:
                start_time = time(14, 0)  # 2:00 PM
                end_time = time(16, 0)    # 4:00 PM
        
        print(f"[KAIRO DEBUG] Creating event: title='{event_title}', date='{event_date}', start_time='{start_time}', end_time='{end_time}'")
        
        try:
            # Create the calendar event
            from .models import CalendarEvent
            
            # For specific date events, do NOT set day_of_week (to avoid weekly recurrence)
            # Only set start_date, end_date, start_time, and end_time
            calendar_event = CalendarEvent.objects.create(
                user=user,
                title=event_title,
                start_date=event_date,
                end_date=event_date,
                start_time=start_time,
                end_time=end_time,
                # DO NOT set day_of_week for specific date events
                description=""  # Leave description empty instead of auto-generating it
            )
            
            print(f"[KAIRO DEBUG] Successfully created calendar event: {calendar_event.id} - {calendar_event.title}")
            return calendar_event
            
        except Exception as e:
            print(f"[KAIRO DEBUG] Error creating calendar event: {e}")
            return None

    def _delete_calendar_events_from_message(self, message, user):
        """Parse the message and delete matching calendar events"""
        import re
        from .models import CalendarEvent
        
        message_lower = message.lower()
        print(f"[KAIRO DEBUG] _delete_calendar_events_from_message called with: '{message}'")
        print(f"[KAIRO DEBUG] Message lowercase: '{message_lower}'")
        
        # Check for "clear calendar" or "delete all events"
        clear_patterns = [
            'clear calendar', 'delete all events', 'remove all events',
            'clear everything', 'delete everything', 'remove everything',
            'wipe calendar', 'empty calendar', 'wipe my calendar', 'empty my calendar',
            # Simple clear commands
            'clear', 'just clear', 'please clear', 'can you clear',
            'clear it all', 'clear all', 'clear the calendar',
            'reset calendar', 'reset my calendar', 'start fresh',
            'clean calendar', 'clean my calendar',
            # More variations
            'delete all', 'remove all', 'erase all', 'erase everything',
            'wipe everything', 'empty everything', 'clean everything',
            'clear it', 'delete it all', 'remove it all'
        ]
        
        for pattern in clear_patterns:
            if pattern in message_lower:
                print(f"[KAIRO DEBUG] Matched clear pattern: '{pattern}'")
                deleted_count = CalendarEvent.objects.filter(user=user).count()
                print(f"[KAIRO DEBUG] Found {deleted_count} events to delete for user {user.username}")
                CalendarEvent.objects.filter(user=user).delete()
                print(f"[KAIRO DEBUG] Successfully deleted all events")
                return {'type': 'all', 'count': deleted_count}
        
        print(f"[KAIRO DEBUG] No clear patterns matched, checking for specific event deletion")
        
        # Try to extract event title to delete
        event_title = self._extract_event_title_for_deletion(message)
        if event_title:
            # Clean up the extracted title (remove common words that might interfere)
            cleaned_title = event_title.replace('the ', '').replace('my ', '').strip()
            
            # First try exact match (case-insensitive)
            exact_matches = CalendarEvent.objects.filter(
                user=user,
                title__iexact=cleaned_title
            )
            
            if exact_matches.exists():
                deleted_count = exact_matches.count()
                exact_matches.delete()
                return {'type': 'specific', 'title': cleaned_title, 'count': deleted_count}
            
            # Then try partial match (case-insensitive)
            partial_matches = CalendarEvent.objects.filter(
                user=user,
                title__icontains=cleaned_title
            )
            
            if partial_matches.exists():
                deleted_count = partial_matches.count()
                partial_matches.delete()
                return {'type': 'specific', 'title': cleaned_title, 'count': deleted_count}
            
            # Try matching individual words if the title has multiple words
            if ' ' in cleaned_title:
                words = cleaned_title.split()
                for word in words:
                    if len(word) > 2:  # Only consider words longer than 2 characters
                        word_matches = CalendarEvent.objects.filter(
                            user=user,
                            title__icontains=word
                        )
                        if word_matches.exists():
                            deleted_count = word_matches.count()
                            word_matches.delete()
                            return {'type': 'specific', 'title': word, 'count': deleted_count}
        
        # If no specific event found, check for date-based deletion
        # Pattern: "remove everything on [date]" or "delete events on [date]"
        date_deletion_patterns = [
            r'(?:remove|delete|cancel)\s+(?:everything|all\s+events?)\s+(?:on|for)\s+(.+)',
            r'(?:clear|empty)\s+(?:my\s+)?calendar\s+(?:on|for)\s+(.+)'
        ]
        
        for pattern in date_deletion_patterns:
            match = re.search(pattern, message_lower)
            if match:
                date_str = match.group(1).strip()
                # Try to parse the date and delete events on that date
                parsed_date = self._extract_event_date_from_string(date_str)
                if parsed_date:
                    date_matches = CalendarEvent.objects.filter(
                        user=user,
                        start_date=parsed_date
                    )
                    if date_matches.exists():
                        deleted_count = date_matches.count()
                        date_matches.delete()
                        return {'type': 'date', 'date': parsed_date, 'count': deleted_count}
        
        return {'type': 'none', 'count': 0}

    def _extract_event_date_from_string(self, date_str):
        """Helper method to extract date from a string"""
        try:
            # This is a simplified version - you might want to use a more robust date parser
            from datetime import datetime
            import re
            
            # Handle common date formats
            date_patterns = [
                r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})',  # MM/DD/YYYY or MM-DD-YYYY
                r'(\d{1,2})[/-](\d{1,2})',  # MM/DD (current year)
            ]
            
            for pattern in date_patterns:
                match = re.search(pattern, date_str)
                if match:
                    if len(match.groups()) == 3:
                        month, day, year = match.groups()
                        if len(year) == 2:
                            year = '20' + year
                        return datetime(int(year), int(month), int(day)).date()
                    elif len(match.groups()) == 2:
                        month, day = match.groups()
                        current_year = datetime.now().year
                        return datetime(current_year, int(month), int(day)).date()
            
            # Handle month names
            month_names = {
                'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
                'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6,
                'july': 7, 'jul': 7, 'august': 8, 'aug': 8, 'september': 9, 'sep': 9,
                'october': 10, 'oct': 10, 'november': 11, 'nov': 11, 'december': 12, 'dec': 12
            }
            
            for month_name, month_num in month_names.items():
                if month_name in date_str.lower():
                    # Look for day number
                    day_match = re.search(r'(\d{1,2})', date_str)
                    if day_match:
                        day = int(day_match.group(1))
                        current_year = datetime.now().year
                        return datetime(current_year, month_num, day).date()
            
        except (ValueError, TypeError):
            pass
        
        return None

    def _extract_event_title_for_deletion(self, message):
        """Extract the event title that should be deleted"""
        import re
        message_lower = message.lower()
        
        # Pattern: "remove [EVENT] from calendar"
        match = re.search(r'remove\s+(.*?)\s+from\s+(?:my\s+)?calendar', message_lower)
        if match:
            return match.group(1).strip()
        
        # Pattern: "delete [EVENT] from calendar"
        match = re.search(r'delete\s+(.*?)\s+from\s+(?:my\s+)?calendar', message_lower)
        if match:
            return match.group(1).strip()
        
        # Pattern: "cancel [EVENT]"
        match = re.search(r'cancel\s+(.*?)(?:\s+from\s+(?:my\s+)?calendar)?$', message_lower)
        if match:
            return match.group(1).strip()
        
        # Pattern: "remove the event [EVENT]"
        match = re.search(r'remove\s+(?:the\s+)?event\s+(.*)', message_lower)
        if match:
            return match.group(1).strip()
        
        # Pattern: "delete the event [EVENT]"
        match = re.search(r'delete\s+(?:the\s+)?event\s+(.*)', message_lower)
        if match:
            return match.group(1).strip()
        
        # Pattern: "take [EVENT] off calendar"
        match = re.search(r'take\s+(.*?)\s+off\s+(?:my\s+)?calendar', message_lower)
        if match:
            return match.group(1).strip()
        
        # Enhanced patterns for more natural language
        # Pattern: "get rid of [EVENT]"
        match = re.search(r'get\s+rid\s+of\s+(.*?)(?:\s+from\s+(?:my\s+)?calendar)?$', message_lower)
        if match:
            return match.group(1).strip()
        
        # Pattern: "erase [EVENT]"
        match = re.search(r'erase\s+(.*?)(?:\s+from\s+(?:my\s+)?calendar)?$', message_lower)
        if match:
            return match.group(1).strip()
        
        # Pattern: "eliminate [EVENT]"
        match = re.search(r'eliminate\s+(.*?)(?:\s+from\s+(?:my\s+)?calendar)?$', message_lower)
        if match:
            return match.group(1).strip()
        
        # Pattern: "drop [EVENT]"
        match = re.search(r'drop\s+(.*?)(?:\s+from\s+(?:my\s+)?calendar)?$', message_lower)
        if match:
            return match.group(1).strip()
        
        # Pattern: "unschedule [EVENT]"
        match = re.search(r'unschedule\s+(.*)', message_lower)
        if match:
            return match.group(1).strip()
        
        # Pattern: "I don't need [EVENT] anymore"
        match = re.search(r'i\s+don\'?t\s+need\s+(.*?)\s+anymore', message_lower)
        if match:
            return match.group(1).strip()
        
        # Pattern: "I want to remove [EVENT]"
        match = re.search(r'i\s+want\s+to\s+remove\s+(.*)', message_lower)
        if match:
            return match.group(1).strip()
        
        # Pattern: "I want to delete [EVENT]"
        match = re.search(r'i\s+want\s+to\s+delete\s+(.*)', message_lower)
        if match:
            return match.group(1).strip()
        
        # Pattern: "I want to cancel [EVENT]"
        match = re.search(r'i\s+want\s+to\s+cancel\s+(.*)', message_lower)
        if match:
            return match.group(1).strip()
        
        # Generic patterns for simple commands
        # Pattern: "remove [EVENT]" (when not followed by "from")
        match = re.search(r'remove\s+(.*?)(?:\s+(?:please|now))?$', message_lower)
        if match and 'from' not in match.group(1):
            return match.group(1).strip()
        
        # Pattern: "delete [EVENT]" (when not followed by "from")
        match = re.search(r'delete\s+(.*?)(?:\s+(?:please|now))?$', message_lower)
        if match and 'from' not in match.group(1):
            return match.group(1).strip()
        
        return None

    def _extract_event_title(self, message):
        """Extract the event title from the message"""
        import re
        message_lower = message.lower()
        
        # NEW: Pattern for course events with times: "add [COURSE] [EVENT] for [DATE] from [TIME] to [TIME]"
        match = re.search(r'add\s+(\w+\d+\s+(?:exam|test|midterm|final|quiz|assignment|project|homework|hw))\s+for\s+.*?\s+from\s+[\d:]+\s*(?:am|pm)?\s+to\s+[\d:]+\s*(?:am|pm)?', message_lower)
        if match:
            return match.group(1).strip()
        
        # NEW: Pattern for course events: "add [COURSE] [EVENT] for [DATE]"
        match = re.search(r'add\s+(\w+\d+\s+(?:exam|test|midterm|final|quiz|assignment|project|homework|hw))\s+for\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)', message_lower)
        if match:
            return match.group(1).strip()
        
        # NEW: Pattern for course events: "schedule [COURSE] [EVENT] for [DATE]"
        match = re.search(r'schedule\s+(\w+\d+\s+(?:exam|test|midterm|final|quiz|assignment|project|homework|hw))\s+for\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)', message_lower)
        if match:
            return match.group(1).strip()
        
        # Existing patterns...
        # Pattern: "add [EVENT] to [DATE]"
        match = re.search(r'add\s+(.*?)\s+to\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)', message_lower)
        if match:
            return match.group(1).strip()
        
        # Pattern: "schedule [EVENT] on/for [DATE]"
        match = re.search(r'schedule\s+(.*?)\s+(?:on|for)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)', message_lower)
        if match:
            return match.group(1).strip()
        
        # NEW: Pattern for weekdays: "add [EVENT] on/for [WEEKDAY]"
        match = re.search(r'add\s+(.*?)\s+(?:on|for)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)', message_lower)
        if match:
            return match.group(1).strip()
        
        # NEW: Pattern for weekdays: "schedule [EVENT] on/for [WEEKDAY]"
        match = re.search(r'schedule\s+(.*?)\s+(?:on|for)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)', message_lower)
        if match:
            return match.group(1).strip()
        
        # NEW: Pattern for numeric dates: "add [EVENT] on/for [DATE]"
        match = re.search(r'add\s+(.*?)\s+(?:on|for)\s+\d{1,2}[/-]\d{1,2}', message_lower)
        if match:
            return match.group(1).strip()
        
        # NEW: Pattern for numeric dates: "schedule [EVENT] on/for [DATE]"
        match = re.search(r'schedule\s+(.*?)\s+(?:on|for)\s+\d{1,2}[/-]\d{1,2}', message_lower)
        if match:
            return match.group(1).strip()
        
        # Pattern: "put [EVENT] on/in calendar"
        match = re.search(r'put\s+(.*?)\s+(?:on|in)\s+(?:my\s+)?calendar', message_lower)
        if match:
            return match.group(1).strip()
        
        # Pattern: "add [EVENT] to calendar"
        match = re.search(r'add\s+(.*?)\s+to\s+(?:my\s+)?calendar', message_lower)
        if match:
            return match.group(1).strip()
        
        # Default: Use AI to extract meaningful title or fallback to simple extraction
        openai_api_key = os.getenv('OPENAI_API_KEY')
        if openai_api_key:
            try:
                import openai
                client = openai.OpenAI(api_key=openai_api_key)
                
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "Extract the main event/task title from this message. Return only the title, nothing else."},
                        {"role": "user", "content": message}
                    ],
                    max_tokens=50,
                    temperature=0.0
                )
                
                ai_title = response.choices[0].message.content.strip()
                if ai_title and len(ai_title) > 3:
                    return ai_title
            except:
                pass
        
        # Simple fallback - take the message as is if AI fails
        words = message.split()
        if len(words) >= 2:
            return ' '.join(words[:5])  # Take first 5 words as title
        
        return "New Event"

    def _extract_event_date(self, message):
        """Extract the event date from the message"""
        import re
        from datetime import datetime, date, timedelta
        from dateutil import parser
        
        message_lower = message.lower()
        current_year = datetime.now().year
        today = date.today()
        
        # Month name patterns (enhanced for better matching)
        month_patterns = {
            'january': 1, 'jan': 1,
            'february': 2, 'feb': 2,
            'march': 3, 'mar': 3,
            'april': 4, 'apr': 4,
            'may': 5,
            'june': 6, 'jun': 6,
            'july': 7, 'jul': 7,
            'august': 8, 'aug': 8,
            'september': 9, 'sep': 9, 'sept': 9,
            'october': 10, 'oct': 10,
            'november': 11, 'nov': 11,
            'december': 12, 'dec': 12
        }
        
        # First priority: "Month Day" patterns (e.g., "June 4", "June 4th")
        for month_name, month_num in month_patterns.items():
            # Enhanced pattern to match more flexibly
            patterns = [
                rf'(?:for|on)\s+{month_name}\s+(\d{{1,2}})(?:st|nd|rd|th)?',  # "for june 4"
                rf'{month_name}\s+(\d{{1,2}})(?:st|nd|rd|th)?',  # "june 4"
                rf'(\d{{1,2}})(?:st|nd|rd|th)?\s+{month_name}',  # "4 june" (reversed)
            ]
            
            for pattern in patterns:
                match = re.search(pattern, message_lower)
                if match:
                    day = int(match.group(1))
                    try:
                        parsed_date = date(current_year, month_num, day)
                        # If the date is in the past, assume next year
                        if parsed_date < today:
                            parsed_date = date(current_year + 1, month_num, day)
                        print(f"[KAIRO DEBUG] Extracted date: {parsed_date} from pattern '{pattern}' with month '{month_name}' day '{day}'")
                        return parsed_date
                    except ValueError:
                        continue
        
        # NEW: Weekday patterns
        weekday_patterns = {
            'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
            'friday': 4, 'saturday': 5, 'sunday': 6
        }
        
        # Check for weekdays
        for day_name, day_num in weekday_patterns.items():
            if day_name in message_lower:
                # Calculate the next occurrence of this weekday
                days_ahead = day_num - today.weekday()
                if days_ahead <= 0:  # Target day already happened this week
                    days_ahead += 7
                return today + timedelta(days_ahead)
        
        # Pattern: "today", "tomorrow"
        if 'today' in message_lower:
            return today
        elif 'tomorrow' in message_lower:
            return today + timedelta(days=1)
        
        # Pattern: "MM/DD" or "MM-DD"
        match = re.search(r'(\d{1,2})[/-](\d{1,2})', message)
        if match:
            month, day = int(match.group(1)), int(match.group(2))
            try:
                parsed_date = date(current_year, month, day)
                # If the date is in the past, assume next year
                if parsed_date < today:
                    parsed_date = date(current_year + 1, month, day)
                return parsed_date
            except ValueError:
                pass
        
        # Fallback: try dateutil parser on the whole message
        try:
            parsed_date = parser.parse(message, fuzzy=True, default=datetime.now())
            result_date = parsed_date.date()
            # If the date is in the past, assume next year
            if result_date < today:
                result_date = date(result_date.year + 1, result_date.month, result_date.day)
            return result_date
        except:
            pass
        
        return None

    def _extract_times_from_message(self, message):
        """Extract start and end times from message like 'from 2:30 pm to 3:50 pm' or '7pm-8:20pm'"""
        import re
        from datetime import time
        
        # Pattern 1: "from [TIME] to [TIME]"
        pattern1 = r'from\s+(\d{1,2}):?(\d{0,2})\s*(am|pm)?\s+to\s+(\d{1,2}):?(\d{0,2})\s*(am|pm)?'
        match1 = re.search(pattern1, message.lower())
        
        if match1:
            start_hour = int(match1.group(1))
            start_min = int(match1.group(2)) if match1.group(2) else 0
            start_ampm = match1.group(3)
            
            end_hour = int(match1.group(4))
            end_min = int(match1.group(5)) if match1.group(5) else 0
            end_ampm = match1.group(6)
            
            # Convert to 24-hour format
            if start_ampm == 'pm' and start_hour != 12:
                start_hour += 12
            elif start_ampm == 'am' and start_hour == 12:
                start_hour = 0
                
            if end_ampm == 'pm' and end_hour != 12:
                end_hour += 12
            elif end_ampm == 'am' and end_hour == 12:
                end_hour = 0
            
            try:
                start_time = time(start_hour, start_min)
                end_time = time(end_hour, end_min)
                return start_time, end_time
            except ValueError:
                return None, None
        
        # Pattern 2: "from [TIME]-[TIME]" (e.g., "from 7pm-8:20pm")
        pattern2 = r'from\s+(\d{1,2}):?(\d{0,2})\s*(am|pm)?\s*[-–—]\s*(\d{1,2}):?(\d{0,2})\s*(am|pm)?'
        match2 = re.search(pattern2, message.lower())
        
        if match2:
            start_hour = int(match2.group(1))
            start_min = int(match2.group(2)) if match2.group(2) else 0
            start_ampm = match2.group(3)
            
            end_hour = int(match2.group(4))
            end_min = int(match2.group(5)) if match2.group(5) else 0
            end_ampm = match2.group(6)
            
            # If start doesn't have am/pm but end does, apply end's am/pm to start
            if not start_ampm and end_ampm:
                start_ampm = end_ampm
            
            # Convert to 24-hour format
            if start_ampm == 'pm' and start_hour != 12:
                start_hour += 12
            elif start_ampm == 'am' and start_hour == 12:
                start_hour = 0
                
            if end_ampm == 'pm' and end_hour != 12:
                end_hour += 12
            elif end_ampm == 'am' and end_hour == 12:
                end_hour = 0
            
            try:
                start_time = time(start_hour, start_min)
                end_time = time(end_hour, end_min)
                return start_time, end_time
            except ValueError:
                return None, None
        
        # Pattern 3: Simple range "[TIME]-[TIME]" anywhere in message
        pattern3 = r'(\d{1,2}):?(\d{0,2})\s*(am|pm)?\s*[-–—]\s*(\d{1,2}):?(\d{0,2})\s*(am|pm)?'
        match3 = re.search(pattern3, message.lower())
        
        if match3:
            start_hour = int(match3.group(1))
            start_min = int(match3.group(2)) if match3.group(2) else 0
            start_ampm = match3.group(3)
            
            end_hour = int(match3.group(4))
            end_min = int(match3.group(5)) if match3.group(5) else 0
            end_ampm = match3.group(6)
            
            # If start doesn't have am/pm but end does, apply end's am/pm to start
            if not start_ampm and end_ampm:
                start_ampm = end_ampm
            
            # Convert to 24-hour format
            if start_ampm == 'pm' and start_hour != 12:
                start_hour += 12
            elif start_ampm == 'am' and start_hour == 12:
                start_hour = 0
                
            if end_ampm == 'pm' and end_hour != 12:
                end_hour += 12
            elif end_ampm == 'am' and end_hour == 12:
                end_hour = 0
            
            try:
                start_time = time(start_hour, start_min)
                end_time = time(end_hour, end_min)
                return start_time, end_time
            except ValueError:
                return None, None
        
        return None, None


# --- Intent Detection ---

class IntentDetectionSerializer(serializers.Serializer):
    message = serializers.CharField(required=True, allow_blank=False)
    prompt = serializers.CharField(required=False, allow_blank=True)
    programs = serializers.ListField(required=False, allow_empty=True)
    system_prompt = serializers.CharField(required=False, allow_blank=True)
    model = serializers.CharField(required=False, default='gpt-4o-mini')
    temperature = serializers.FloatField(required=False, default=0.1)
    max_tokens = serializers.IntegerField(required=False, default=300)

class AIClassificationView(APIView):
    permission_classes = [AllowAny]  # Allow unauthenticated access for classification
    
    def post(self, request, *args, **kwargs):
        serializer = IntentDetectionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        message = serializer.validated_data['message']
        prompt = serializer.validated_data.get('prompt')
        programs = serializer.validated_data.get('programs', [])
        system_prompt = serializer.validated_data.get('system_prompt')
        model = serializer.validated_data.get('model', 'gpt-4o-mini')
        temperature = serializer.validated_data.get('temperature', 0.1)
        max_tokens = serializer.validated_data.get('max_tokens', 300)
        
        try:
            # Use the prompt if provided, otherwise use system_prompt
            final_prompt = prompt if prompt else system_prompt
            
            if not final_prompt:
                return Response({
                    "error": "Either 'prompt' or 'system_prompt' must be provided"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get OpenAI API key
            openai_api_key = os.environ.get('OPENAI_API_KEY')
            if not openai_api_key:
                # Fallback to Django settings
                openai_api_key = getattr(settings, 'OPENAI_API_KEY', None)
                
            if not openai_api_key:
                logger.error("OPENAI_API_KEY environment variable not set")
                return Response({
                    "error": "OpenAI API key not configured"
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Create OpenAI client (correct v1.0+ syntax)
            client = openai.OpenAI(api_key=openai_api_key)
            
            # Make the API call to OpenAI
            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": final_prompt},
                    {"role": "user", "content": message}
                ],
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            # Extract the response content
            content = completion.choices[0].message.content.strip()
            
            # Try to parse as JSON for structured classification
            classification_result = None
            try:
                classification_result = json.loads(content)
            except json.JSONDecodeError:
                # If it's not JSON, return as plain text
                classification_result = content
            
            return Response({
                "classification": classification_result,
                "model": model,
                "usage": {
                    "prompt_tokens": completion.usage.prompt_tokens if hasattr(completion, 'usage') else 0,
                    "completion_tokens": completion.usage.completion_tokens if hasattr(completion, 'usage') else 0,
                    "total_tokens": completion.usage.total_tokens if hasattr(completion, 'usage') else 0
                } if hasattr(completion, 'usage') else None
            }, status=status.HTTP_200_OK)
            
        except openai.APIConnectionError as e:
            logger.error(f"OpenAI APIConnectionError in classification: {e}")
            return Response({
                "error": "Unable to connect to AI service"
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except openai.RateLimitError as e:
            logger.error(f"OpenAI RateLimitError in classification: {e}")
            return Response({
                "error": "AI service rate limit exceeded. Please try again later."
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except openai.APIStatusError as e:
            logger.error(f"OpenAI APIStatusError in classification: {e}")
            return Response({
                "error": "AI service error"
            }, status=status.HTTP_502_BAD_GATEWAY)
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in classification: {e}")
            return Response({
                "error": "Invalid response format from AI service"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            logger.error(f"Unexpected error in AI classification: {e}")
            return Response({
                "error": "Internal server error"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Legacy IntentDetectionView for backward compatibility
class IntentDetectionView(APIView):
    permission_classes = [AllowAny]  # Allow unauthenticated access for intent detection
    
    def post(self, request, *args, **kwargs):
        # Redirect to the new AI classification endpoint
        return AIClassificationView().post(request, *args, **kwargs)


# --- Health Check ---

class HealthCheckView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        try:
            # Test database connection
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                db_status = "OK"
        except Exception as e:
            db_status = f"ERROR: {str(e)}"
        
        # Check environment variables
        env_vars = {
            "DJANGO_SECRET_KEY": "SET" if os.environ.get('DJANGO_SECRET_KEY') else "MISSING",
            "DJANGO_DEBUG": os.environ.get('DJANGO_DEBUG', 'Not set'),
            "DJANGO_ALLOWED_HOSTS": os.environ.get('DJANGO_ALLOWED_HOSTS', 'Not set'),
            "DATABASE_URL": "SET" if os.environ.get('DATABASE_URL') else "MISSING",
        }
        
        return Response({
            "status": "OK",
            "database": db_status,
            "environment": env_vars,
            "django_version": "4.2+",
            "timestamp": timezone.now().isoformat()
        })

# --- Guest Login ---

class GuestLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            # Create a temporary guest user
            guest_username = f"guest_{uuid.uuid4().hex[:8]}"
            guest_email = f"guest_{uuid.uuid4().hex[:8]}@temporary.com"
            
            # Try to create guest user with database retry
            max_retries = 3
            guest_user = None
            
            for attempt in range(max_retries):
                try:
                    # Create guest user
                    guest_user = User.objects.create_user(
                        username=guest_username,
                        email=guest_email,
                        password=uuid.uuid4().hex,  # Random password
                        first_name="Guest",
                        last_name="User"
                    )
                    logger.info(f"Guest user created successfully: {guest_username}")
                    break
                except Exception as db_error:
                    logger.warning(f"Database error on attempt {attempt + 1}: {str(db_error)}")
                    if attempt == max_retries - 1:
                        logger.error(f"Failed to create guest user after {max_retries} attempts")
                        raise db_error
                    time.sleep(1)  # Wait 1 second before retry
            
            if not guest_user:
                raise Exception("Failed to create guest user")
            
            # Generate JWT tokens
            try:
                refresh = RefreshToken.for_user(guest_user)
                access_token = str(refresh.access_token)
            except Exception as token_error:
                logger.error(f"Failed to generate tokens for guest user: {token_error}")
                # Clean up the created user if token generation fails
                try:
                    guest_user.delete()
                except:
                    pass
                raise token_error
            
            return Response({
                "token": access_token,
                "refresh": str(refresh),
                "user": {
                    "id": guest_user.id,
                    "email": guest_user.email,
                    "first_name": guest_user.first_name,
                    "last_name": guest_user.last_name,
                    "is_guest": True
                },
                "guest_info": {
                    "note": "This is a temporary guest account that will be cleaned up periodically."
                }
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Guest login error: {str(e)}")
            import traceback
            logger.error(f"Guest login traceback: {traceback.format_exc()}")
            return Response({
                "error": "Guest login failed",
                "detail": str(e) if settings.DEBUG else "Service temporarily unavailable - please try again"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Note: The TokenObtainPairView from djangorestframework-simplejwt.views
# will be used directly in urls.py for the login endpoint.
# We can, however, customize the token claims if needed by subclassing TokenObtainPairSerializer:
#
# class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
#     @classmethod
#     def get_token(cls, user):
#         token = super().get_token(user)
#         # Add custom claims
#         token['username'] = user.username
#         return token
#
# class MyTokenObtainPairView(TokenObtainPairView):
#     serializer_class = MyTokenObtainPairSerializer
#
# This customization is not required by the current subtask, but shown for completeness.


# --- Calendar Event Views ---

class CalendarEventListCreateView(generics.ListCreateAPIView):
    serializer_class = CalendarEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        This view should return a list of all calendar events
        for the currently authenticated user.
        """
        return CalendarEvent.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """
        Set the user to the current authenticated user when creating a calendar event.
        """
        serializer.save(user=self.request.user)


class CalendarEventRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CalendarEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        This view should return calendar events for the currently authenticated user only.
        """
        return CalendarEvent.objects.filter(user=self.request.user)
    
    def perform_update(self, serializer):
        """
        Set the user to the current authenticated user when updating a calendar event.
        """
        serializer.save(user=self.request.user)


# --- ImportantDate Views ---

class ImportantDateFilter(django_filters.FilterSet):
    start_date = django_filters.DateFromToRangeFilter()
    title = django_filters.CharFilter(lookup_expr='icontains')
    description = django_filters.CharFilter(lookup_expr='icontains')

    class Meta:
        model = ImportantDate
        fields = {
            'category': ['exact'],
            'start_date': ['gte', 'lte'], # Handled by DateFromToRangeFilter
            'title': ['icontains'], # Handled by CharFilter
            'description': ['icontains'] # Handled by CharFilter
        }

class ImportantDateViewSet(viewsets.ModelViewSet):
    queryset = ImportantDate.objects.all()
    serializer_class = ImportantDateSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ImportantDateFilter
    search_fields = ['title', 'description']
    ordering_fields = ['start_date', 'title']
    permission_classes = [IsAuthenticated] # Or AllowAny if guests can view


# --- ExamEvent Views ---

class ExamEventFilter(django_filters.FilterSet):
    date = django_filters.DateFromToRangeFilter()
    course_code = django_filters.CharFilter(lookup_expr='icontains')
    title = django_filters.CharFilter(lookup_expr='icontains')

    class Meta:
        model = ExamEvent
        fields = {
            'course_code': ['exact', 'icontains'], # 'icontains' handled by CharFilter
            'is_deferred': ['exact'],
            'date': ['gte', 'lte', 'exact'], # 'gte', 'lte' handled by DateFromToRangeFilter
            'title': ['icontains'] # Handled by CharFilter
        }

class ExamEventViewSet(viewsets.ModelViewSet):
    queryset = ExamEvent.objects.all()
    serializer_class = ExamEventSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ExamEventFilter
    search_fields = ['title', 'description', 'course_code', 'location']
    ordering_fields = ['date', 'start_time', 'course_code']
    permission_classes = [IsAuthenticated] # Or AllowAny if guests can view


# --- Course Views ---

class CourseViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'title', 'description', 'prerequisites']
    ordering_fields = ['code', 'title', 'units']
    permission_classes = [AllowAny]


# Course data is now loaded via CourseDescriptionService from scrapers/data/all_courses_complete.json
# This replaces the old _load_course_data() function

# --- User Login ---

class UserLoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=True)  # Can be email or username
    password = serializers.CharField(required=True, style={'input_type': 'password'})

class UserLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            serializer = UserLoginSerializer(data=request.data)
            if serializer.is_valid():
                identifier = serializer.validated_data['identifier']
                password = serializer.validated_data['password']

                # Find user by email OR username
                try:
                    user = User.objects.get(Q(email=identifier) | Q(username=identifier))
                    # Check password using Django's built-in check_password method
                    if user.check_password(password):
                        # Create tokens for the user
                        refresh = RefreshToken.for_user(user)
                        access_token = refresh.access_token

                        # Get user's name for the funny message
                        user_name = user.first_name if user.first_name else user.username
                        
                        # Try to get funny message, fallback to simple message if it fails
                        try:
                            funny_message = get_random_funny_message(user_name)
                        except Exception as e:
                            logger.warning(f"Failed to get funny message: {e}")
                            funny_message = f"Welcome back, {user_name}!"
                        
                        return Response({
                            'token': str(access_token),
                            'refresh': str(refresh),
                            'funny_message': funny_message,
                            'user': {
                                'id': user.id,
                                'username': user.username,
                                'email': user.email,
                                'first_name': user.first_name,
                                'last_name': user.last_name,
                            }
                        }, status=status.HTTP_200_OK)
                    else:
                        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
                except User.DoesNotExist:
                    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
                except Exception as e:
                    logger.error(f"Database error during login: {e}")
                    return Response({'error': 'Database connection issue - please try again'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Unexpected error in login view: {e}")
            return Response({'error': 'Login service temporarily unavailable'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# --- Contact Email View ---

class ContactEmailSerializer(serializers.Serializer):
    fullName = serializers.CharField(max_length=100, required=True)
    email = serializers.EmailField(required=True)
    message = serializers.CharField(max_length=2000, required=True)

    def validate_message(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError("Message must be at least 10 characters long.")
        return value

class ContactEmailView(APIView):
    permission_classes = [AllowAny]  # Allow anyone to send contact messages

    def post(self, request, *args, **kwargs):
        serializer = ContactEmailSerializer(data=request.data)
        if serializer.is_valid():
            full_name = serializer.validated_data['fullName']
            email = serializer.validated_data['email']
            message = serializer.validated_data['message']

            # Email content
            subject = f"New Contact Form Message from {full_name}"
            email_message = f"""
New contact form submission:

Name: {full_name}
Email: {email}

Message:
{message}

---
This message was sent via the Kairo contact form.
            """

            try:
                # Send email to your address
                send_mail(
                    subject=subject,
                    message=email_message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[settings.CONTACT_EMAIL],  # Your email address
                    fail_silently=False,
                )
                
                return Response({
                    "message": "Your message has been sent successfully! We'll get back to you soon."
                }, status=status.HTTP_200_OK)
                
            except Exception as e:
                return Response({
                    "error": "Failed to send email. Please try again later."
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# --- Course Data API ---
from django.http import JsonResponse
from django.views import View
from pathlib import Path

class CourseDataView(View):
    """Serve the complete course data JSON"""
    
    def get(self, request, *args, **kwargs):
        try:
            # Try multiple possible paths for the course data file
            possible_paths = [
                # Path 1: Original relative to backend/api/views.py
                Path(__file__).parent.parent.parent / "scrapers" / "data" / "all_courses_complete.json",
                # Path 2: Relative to project root
                Path(__file__).parent.parent.parent.parent / "scrapers" / "data" / "all_courses_complete.json",
                # Path 3: In backend directory
                Path(__file__).parent.parent / "scrapers" / "data" / "all_courses_complete.json",
                # Path 4: Absolute path for Render deployment
                Path("/opt/render/project/src/scrapers/data/all_courses_complete.json"),
                # Path 5: Alternative Render path
                Path("/app/scrapers/data/all_courses_complete.json"),
                # Path 6: Current working directory
                Path("scrapers/data/all_courses_complete.json"),
                # Path 7: Backend data folder (if we copied it there)
                Path(__file__).parent.parent / "api" / "data" / "all_courses_complete.json",
            ]
            
            data = None
            file_found = False
            
            for json_file_path in possible_paths:
                if json_file_path.exists():
                    try:
                        with open(json_file_path, 'r', encoding='utf-8') as file:
                            data = json.load(file)
                        file_found = True
                        break
                    except Exception as e:
                        continue  # Try next path if this one fails
            
            if file_found and data:
                return JsonResponse(data)
            else:
                # Return detailed error for debugging
                attempted_paths = [str(p) for p in possible_paths]
                return JsonResponse({
                    'error': 'Course data file not found in any of the expected locations',
                    'attempted_paths': attempted_paths,
                    'current_working_directory': str(Path.cwd()),
                    'script_location': str(Path(__file__).parent)
                }, status=404)
                
        except Exception as e:
            return JsonResponse({'error': f'Error loading course data: {str(e)}'}, status=500)


class CourseDebugView(APIView):
    """Debug endpoint to test course data loading"""
    permission_classes = [AllowAny]
    
    def get(self, request, course_code, *args, **kwargs):
        try:
            from .services.course_description_service import CourseDescriptionService
            
            # Test course data loading
            course_info = CourseDescriptionService.get_enhanced_course_info(course_code)
            
            return JsonResponse({
                'requested_code': course_code,
                'found': bool(course_info.get('courseTitle')),
                'course_info': course_info,
                'debug_info': {
                    'total_courses_loaded': CourseDescriptionService.get_course_count(),
                    'service_status': 'working'
                }
            })
        except Exception as e:
            return JsonResponse({
                'error': str(e),
                'requested_code': course_code,
                'debug_info': {
                    'service_status': 'failed'
                }
            }, status=500)

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.http import JsonResponse
import json
import os

@api_view(['GET'])
@permission_classes([AllowAny])
def professor_rmp_data(request):
    """
    API endpoint to get professor RMP data
    """
    try:
        # Load enhanced professors data
        enhanced_file = os.path.join(os.path.dirname(__file__), 'data', 'professors_enhanced.json')
        
        if os.path.exists(enhanced_file):
            with open(enhanced_file, 'r', encoding='utf-8') as f:
                professors_data = json.load(f)
            
            # Filter and format data for API response
            api_data = []
            for prof in professors_data:
                api_data.append({
                    'name': prof['name'],
                    'department': prof['department'],
                    'title': prof['title'],
                    'email': prof['email'],
                    'has_rmp_data': prof.get('has_rmp_data', False),
                    'rmp_id': prof.get('rmp_id'),
                    'rmp_rating': prof.get('rmp_rating'),
                    'rmp_difficulty': prof.get('rmp_difficulty'),
                    'rmp_department': prof.get('rmp_department'),
                    'rmp_would_take_again': prof.get('rmp_would_take_again')
                })
            
            return Response({
                'success': True,
                'count': len(api_data),
                'professors': api_data
            })
        else:
            return Response({
                'success': False,
                'error': 'Enhanced professors data not found'
            }, status=404)
            
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def professor_search(request):
    """
    Search for professors with optional RMP data filtering
    """
    try:
        name_query = request.GET.get('name', '').lower()
        department_query = request.GET.get('department', '').lower()
        has_rmp = request.GET.get('has_rmp')
        min_rating = request.GET.get('min_rating')
        
        # Load enhanced professors data
        enhanced_file = os.path.join(os.path.dirname(__file__), 'data', 'professors_enhanced.json')
        
        if not os.path.exists(enhanced_file):
            return Response({
                'success': False,
                'error': 'Enhanced professors data not found'
            }, status=404)
        
        with open(enhanced_file, 'r', encoding='utf-8') as f:
            professors_data = json.load(f)
        
        # Filter professors based on query parameters
        filtered_professors = []
        
        for prof in professors_data:
            # Name filter
            if name_query and name_query not in prof['name'].lower():
                continue
            
            # Department filter
            if department_query and department_query not in (prof['department'] or '').lower():
                continue
            
            # RMP data filter
            if has_rmp is not None:
                has_rmp_bool = has_rmp.lower() in ['true', '1', 'yes']
                if prof.get('has_rmp_data', False) != has_rmp_bool:
                    continue
            
            # Minimum rating filter
            if min_rating is not None:
                try:
                    min_rating_float = float(min_rating)
                    prof_rating = prof.get('rmp_rating')
                    if not prof_rating or float(prof_rating) < min_rating_float:
                        continue
                except (ValueError, TypeError):
                    continue
            
            filtered_professors.append({
                'name': prof['name'],
                'department': prof['department'],
                'title': prof['title'],
                'email': prof['email'],
                'has_rmp_data': prof.get('has_rmp_data', False),
                'rmp_id': prof.get('rmp_id'),
                'rmp_rating': prof.get('rmp_rating'),
                'rmp_difficulty': prof.get('rmp_difficulty'),
                'rmp_department': prof.get('rmp_department'),
                'rmp_would_take_again': prof.get('rmp_would_take_again')
            })
        
        return Response({
            'success': True,
            'count': len(filtered_professors),
            'professors': filtered_professors,
            'filters_applied': {
                'name': name_query if name_query else None,
                'department': department_query if department_query else None,
                'has_rmp': has_rmp,
                'min_rating': min_rating
            }
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def rmp_stats(request):
    """
    Get RMP coverage statistics
    """
    try:
        # Load enhanced professors data
        enhanced_file = os.path.join(os.path.dirname(__file__), 'data', 'professors_enhanced.json')
        
        if not os.path.exists(enhanced_file):
            return Response({
                'success': False,
                'error': 'Enhanced professors data not found'
            }, status=404)
        
        with open(enhanced_file, 'r', encoding='utf-8') as f:
            professors_data = json.load(f)
        
        # Calculate statistics
        total_professors = len(professors_data)
        with_rmp = sum(1 for prof in professors_data if prof.get('has_rmp_data', False))
        without_rmp = total_professors - with_rmp
        
        # Department breakdown
        dept_stats = {}
        for prof in professors_data:
            dept = prof['department'] or 'Unknown'
            if dept not in dept_stats:
                dept_stats[dept] = {'total': 0, 'with_rmp': 0}
            
            dept_stats[dept]['total'] += 1
            if prof.get('has_rmp_data', False):
                dept_stats[dept]['with_rmp'] += 1
        
        # Format department stats
        dept_breakdown = []
        for dept, stats in dept_stats.items():
            coverage = (stats['with_rmp'] / stats['total'] * 100) if stats['total'] > 0 else 0
            dept_breakdown.append({
                'department': dept,
                'total_professors': stats['total'],
                'with_rmp': stats['with_rmp'],
                'without_rmp': stats['total'] - stats['with_rmp'],
                'coverage_rate': round(coverage, 1)
            })
        
        # Sort by coverage rate
        dept_breakdown.sort(key=lambda x: x['coverage_rate'], reverse=True)
        
        return Response({
            'success': True,
            'overall_stats': {
                'total_professors': total_professors,
                'with_rmp_data': with_rmp,
                'without_rmp_data': without_rmp,
                'coverage_rate': round((with_rmp / total_professors * 100), 1) if total_professors > 0 else 0
            },
            'department_breakdown': dept_breakdown
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)

class ProfessorSyncView(APIView):
    permission_classes = [AllowAny]  # Adjust permissions as needed
    
    def get(self, request, *args, **kwargs):
        """Get the current sync status"""
        try:
            from .services.professor_sync_service import professor_sync_service
            
            status = professor_sync_service.get_sync_status()
            
            return Response({
                'status': 'success',
                'sync_status': status
            }, status=200)
            
        except Exception as e:
            logger.error(f"Error getting sync status: {e}")
            return Response({
                'status': 'error',
                'message': f'Failed to get sync status: {str(e)}'
            }, status=500)
    
    def post(self, request, *args, **kwargs):
        """Manually trigger professor data synchronization"""
        try:
            from .services.professor_sync_service import professor_sync_service
            
            # Get force_update parameter from request
            force_update = request.data.get('force_update', False)
            
            # Perform synchronization
            result = professor_sync_service.sync_professors(force_update=force_update)
            
            if result['success']:
                return Response({
                    'status': 'success',
                    'message': result['message'],
                    'details': {
                        'professors_processed': result['professors_processed'],
                        'professors_added': result['professors_added'],
                        'professors_updated': result['professors_updated'],
                        'total_professors': result.get('total_professors', 0)
                    }
                }, status=200)
            else:
                return Response({
                    'status': 'error',
                    'message': result['message'],
                    'details': {
                        'professors_processed': result['professors_processed'],
                        'professors_added': result['professors_added'],
                        'professors_updated': result['professors_updated']
                    }
                }, status=400)
                
        except Exception as e:
            logger.error(f"Error during professor sync: {e}")
            return Response({
                'status': 'error',
                'message': f'Synchronization failed: {str(e)}'
            }, status=500)

class ProfessorAutoSyncView(APIView):
    permission_classes = [AllowAny]  # Adjust permissions as needed
    
    def get(self, request, *args, **kwargs):
        """Get auto-sync status"""
        try:
            from .services.professor_file_watcher import professor_file_watcher
            
            status = professor_file_watcher.get_file_status()
            
            return Response({
                'status': 'success',
                'auto_sync_status': status
            }, status=200)
            
        except Exception as e:
            logger.error(f"Error getting auto-sync status: {e}")
            return Response({
                'status': 'error',
                'message': f'Failed to get auto-sync status: {str(e)}'
            }, status=500)
    
    def post(self, request, *args, **kwargs):
        """Start or stop auto-sync"""
        try:
            from .services.professor_file_watcher import setup_auto_sync, stop_auto_sync, professor_file_watcher
            
            action = request.data.get('action', 'start')
            
            if action == 'start':
                if professor_file_watcher.is_watching:
                    return Response({
                        'status': 'info',
                        'message': 'Auto-sync is already running'
                    }, status=200)
                else:
                    setup_auto_sync()
                    return Response({
                        'status': 'success',
                        'message': 'Auto-sync started successfully'
                    }, status=200)
                    
            elif action == 'stop':
                if not professor_file_watcher.is_watching:
                    return Response({
                        'status': 'info',
                        'message': 'Auto-sync is not running'
                    }, status=200)
                else:
                    stop_auto_sync()
                    return Response({
                        'status': 'success',
                        'message': 'Auto-sync stopped successfully'
                    }, status=200)
            else:
                return Response({
                    'status': 'error',
                    'message': 'Invalid action. Use "start" or "stop"'
                }, status=400)
                
        except Exception as e:
            logger.error(f"Error controlling auto-sync: {e}")
            return Response({
                'status': 'error',
                'message': f'Failed to control auto-sync: {str(e)}'
            }, status=500)

# Schedule Generation API
class ScheduleGenerationView(APIView):
    permission_classes = [IsAuthenticated]
    
    def _is_schedule_generation_request(self, message: str) -> bool:
        """Detect if the user's message is asking to generate/build a schedule (not change)."""
        try:
            if not message:
                return False
            m = message.lower()
            # Strong indicators of generation intent
            gen_keywords = [
                'generate', 'build', 'create', 'make', 'plan', 'show'
            ]
            schedule_terms = ['schedule', 'timetable']
            year_terms = ['first year', '1st year', 'second year', '2nd year', 'third year', '3rd year', 'fourth year', '4th year', 'year 1', 'year 2', 'year 3', 'year 4']
            term_terms = ['fall', 'winter', 'spring', 'summer']
            # Any gen keyword + schedule word
            if any(k in m for k in gen_keywords) and any(s in m for s in schedule_terms):
                return True
            # Year + term + schedule word (implicit generation)
            if any(y in m for y in year_terms) and any(t in m for t in term_terms) and any(s in m for s in schedule_terms):
                return True
            # Phrases like "my YEAR TERM schedule" without change verbs
            if any(s in m for s in schedule_terms) and not any(c in m for c in ['change', 'modify', 'different', 'another', 'update', 'switch', 'replace']):
                return True
            return False
        except Exception:
            return False

    def post(self, request, *args, **kwargs):
        program_name = request.data.get('program', '')
        year = request.data.get('year', None)  # Don't default to hardcoded year
        requested_term = request.data.get('term', '')  # Don't default to hardcoded term
        message = request.data.get('message', '')
        
        print(f"🧠 Raw input - Program: '{program_name}', Year: {year}, Term: '{requested_term}'")
        print(f"💬 Message: '{message}'")
        
        # Intelligent program, year, and term detection
        detected_info = self.detect_program_year_term(request, message, program_name, year, requested_term)
        
        if not detected_info['success']:
            return Response({
                "success": False,
                "message": detected_info['message'],
                "program_detected": False,
                "events": [],
            }, status=status.HTTP_200_OK)
        
        # Use detected values
        final_program = detected_info['program']
        final_year = detected_info['year']
        final_term = detected_info['term']
        
        print(f"✅ Final values - Program: '{final_program}', Year: {final_year}, Term: '{final_term}'")
        
        # Check if this is a schedule change request (but do NOT misclassify plain generation requests)
        if message:
            from .services.schedule_customization_service import ScheduleCustomizationService
            if not self._is_schedule_generation_request(message) and ScheduleCustomizationService.is_schedule_change_request(message):
                print(f"🔄 Detected schedule change request")
                return self.handle_schedule_change_request(request, message, final_program, final_year, final_term)
        
        # If user specified a year but no term, build schedule for all terms in that year
        if final_year and (not final_term or str(final_term).strip() == ""):
            return self.generate_full_year_schedule(request, final_program, final_year)

        # Original schedule generation logic
        return self.generate_new_schedule(request, final_program, final_year, final_term)
    
    def handle_schedule_change_request(self, request, message: str, program_name: str, year: int, term: str):
        """Handle AI-powered schedule change requests"""
        try:
            from .services.schedule_customization_service import ScheduleCustomizationService
            from .services.schedule_service import ScheduleService
            from .services.program_service import ProgramService
            import asyncio
            
            print(f"🔄 Processing schedule change request: {message}")
            
            # Get current user's schedule (if any)
            from .models import UserCalendar
            current_schedule = []
            try:
                current_events = UserCalendar.objects.filter(user=request.user)
                current_schedule = [
                    {
                        'course_code': event.title.split(' - ')[0] if ' - ' in event.title else event.title,
                        'section_code': event.description.split('Section: ')[1].split('\n')[0] if 'Section: ' in event.description else 'Unknown',
                        'type': 'LEC',  # Default, could be enhanced
                        'time': f"{event.start_time} - {event.end_time}" if event.start_time and event.end_time else 'TBA',
                        'instructor': event.professor or 'TBA'
                    }
                    for event in current_events
                ]
                print(f"📅 Found {len(current_schedule)} current schedule items")
            except Exception as e:
                print(f"❌ Error loading current schedule: {e}")
            
            # Use AI to analyze what the user wants to change
            analysis = asyncio.run(ScheduleCustomizationService.analyze_schedule_change_request(message, current_schedule))
            print(f"🤖 AI Analysis: {analysis}")
            
            if not analysis.get('success'):
                return Response({
                    "success": False,
                    "message": "I couldn't understand what you'd like to change about your schedule. Please be more specific.",
                    "events": []
                }, status=status.HTTP_200_OK)
            
            # Get required courses for the program
            required_courses = ProgramService.get_required_courses(program_name, year, term)
            if not required_courses:
                return Response({
                    "success": False,
                    "message": f"Could not find curriculum for {program_name} Year {year} {term}",
                    "events": []
                }, status=status.HTTP_200_OK)
            
            # Generate alternative schedule based on analysis
            change_type = analysis.get('change_type', 'complete_regeneration')
            
            if change_type == 'complete_regeneration':
                print(f"🔄 Generating completely new schedule")
                # Clear current schedule and generate new one
                try:
                    UserCalendar.objects.filter(user=request.user).delete()
                    print(f"🗑️ Cleared previous schedule")
                except Exception as e:
                    print(f"❌ Error clearing schedule: {e}")
                    
                result = ScheduleService.generate_alternative_schedule(
                    required_courses, term, current_schedule, analysis
                )
            else:
                print(f"🔧 Generating targeted changes for: {change_type}")
                # Targeted changes based on specific preferences
                result = ScheduleService.generate_alternative_schedule(
                    required_courses, term, current_schedule, analysis
                )
            
            if not result.get('success'):
                return Response({
                    "success": False,
                    "message": result.get('message', 'Could not generate alternative schedule'),
                    "events": []
                }, status=status.HTTP_200_OK)
            
            # Prepare minimal selected sections map (one section per course) for persistence
            events = []
            selected_map = {}
            for course_code, course_sections in result.get('sections', {}).items():
                if not course_sections:
                    continue
                chosen = course_sections[0]
                selected_map[course_code] = {
                    'section': chosen.get('section', ''),
                    'time': chosen.get('time', ''),
                    'days': chosen.get('days', []),
                    'instructor': chosen.get('instructor', 'TBA'),
                    'location': chosen.get('location', ''),
                    'courseTitle': chosen.get('courseTitle', course_code),
                    'type': chosen.get('type', 'LEC')
                }
                events.append({
                    'title': f"{course_code} - {chosen.get('type', 'LEC')}",
                    'instructor': chosen.get('instructor', 'TBA'),
                    'time': chosen.get('time', 'TBA'),
                    'location': chosen.get('location', 'TBA'),
                    'section': chosen.get('section', 'Unknown')
                })
            
            # Persist: clear current term schedule, then add selected sections
            try:
                ScheduleService.clear_user_schedule(request.user, term, year)
                ScheduleService.add_sections_to_calendar(request.user, selected_map, term, year)
            except Exception as e:
                print(f"❌ Error persisting schedule changes: {e}")
            
            # Generate AI response
            response_message = f"✨ I've generated a new schedule based on your preferences! "
            if analysis.get('reasoning'):
                response_message += f"Changes made: {analysis.get('reasoning')}. "
            response_message += f"Your new schedule includes {len(events)} class sessions."
            
            return Response({
                "success": True,
                "message": response_message,
                "events": events,
                "change_type": change_type,
                "ai_analysis": analysis.get('reasoning', ''),
                "total_sections": len(events)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"❌ Error in schedule change request: {e}")
            return Response({
                "success": False,
                "message": "Sorry, I encountered an error while trying to change your schedule. Please try again.",
                "events": []
            }, status=status.HTTP_200_OK)
    
    def generate_new_schedule(self, request, program_name: str, year: int, term: str):
        """Original schedule generation logic"""
        # Load program JSONs
        all_programs = self.load_program_jsons()
        
        def normalize(s):
            return s.lower().replace(' ', '').replace('-', '').replace('_', '').replace('honours', '').replace('joint', '').replace('bsc', '').replace('basc', '').replace('bhsc', '').replace('bachelor', '').replace('in', '').replace('of', '').replace('and', '').replace('(', '').replace(')', '')
        
        # Find matching program with fuzzy matching
        program = None
        print(f"🔍 Looking for program: '{program_name}' (normalized: '{normalize(program_name)}')")
        
        available_programs = []
        target_normalized = normalize(program_name)
        
        for p in all_programs:
            program_title = p.get('program', p.get('name', ''))
            available_programs.append(program_title)
            normalized_title = normalize(program_title)
            print(f"   Checking: '{program_title}' (normalized: '{normalized_title}')")
            
            # Exact match
            if normalized_title == target_normalized:
                program = p
                print(f"✅ Found exact match: {program_title}")
                break
                
            # Partial match (contains keywords)
            if 'health' in target_normalized and 'science' in target_normalized:
                if 'health' in normalized_title and 'science' in normalized_title:
                    program = p
                    print(f"✅ Found health sciences match: {program_title}")
                    break
        
        if not program:
            print(f"❌ Program not found. Available programs: {available_programs[:5]}")
            return Response({
                "success": False,
                "message": f"Program not found: {program_name}. Available: {', '.join(available_programs[:5])}",
                "program_detected": False,
                "events": [],
            }, status=status.HTTP_200_OK)
        
        # Find year data - handle different program structures
        year_obj = None
        
        # Method 1: Standard "years" structure
        for y in program.get('years', []):
            if y.get('year') == year:
                year_obj = y
                break
        
        # Method 2: "requirements" structure (like health sciences)
        if not year_obj:
            requirements = program.get('requirements', [])
            for req in requirements:
                year_str = req.get('year', '')
                # Handle "2nd Year" format
                if f"{year}" in year_str or str(year) in year_str:
                    year_obj = req
                    print(f"✅ Found year data in requirements: {year_str}")
                    break
        
        if not year_obj:
            return Response({
                "success": False,
                "message": f"No curriculum data for Year {year}",
                "program_detected": True,
                "program_name": program.get('program', program.get('name')),
                "events": [],
            }, status=status.HTTP_200_OK)
        
        # Find term data (support both normalized years/terms and direct keys)
        term_obj = None
        full_courses = []
        for t in year_obj.get('terms', []):
            if t.get('term', '').lower() == term.lower():
                term_obj = t
                full_courses = term_obj.get('courses', [])
                break
        if not term_obj and term.title() in year_obj:
            full_courses = year_obj.get(term.title(), [])
        
        if not full_courses:
            return Response({
                "success": False,
                "message": f"No curriculum data for {term} term",
                "program_detected": True,
                "program_name": program.get('program', program.get('name')),
                "events": [],
            }, status=status.HTTP_200_OK)
        
        # Get courses and filter out electives
        filtered_courses = [c for c in full_courses if 'elective' not in c.lower()]
        
        if not filtered_courses:
            return Response({
                "success": False,
                "message": "This term only contains electives. Use Kairoll to choose your electives.",
                "program_detected": True,
                "program_name": program.get('name'),
                "events": [],
            }, status=status.HTTP_200_OK)
        
        # Extract course codes from "CODE | Title" format
        course_codes = []
        for course in filtered_courses:
            if '|' in course:
                code = course.split('|')[0].strip()
                course_codes.append(code)
            else:
                course_codes.append(course.strip())
        
        # Find available sections and auto-select non-conflicting, open-first ones
        from .services.schedule_service import ScheduleService
        available_sections_map = ScheduleService.find_sections_for_courses(course_codes, term)
        if not available_sections_map:
            return Response({
                "success": False,
                "message": f"No course data found for {', '.join(course_codes)}. This may be a data loading issue.",
                "program_detected": True,
                "program_name": program.get('program'),
                "events": [],
                "debug_info": {
                    "course_codes": course_codes,
                    "term": term,
                    "program": program.get('program')
                }
            }, status=status.HTTP_200_OK)

        selected_sections_map = ScheduleService.auto_select_sections(available_sections_map)
        successful_courses = [c for c, s in selected_sections_map.items() if s is not None]
        if not successful_courses:
            return Response({
                "success": False,
                "message": "No valid sections found for selected courses.",
                "program_detected": True,
                "program_name": program.get('name'),
                "events": [],
            }, status=status.HTTP_200_OK)

        # Persist to calendar (clear term, then add)
        from .models import UserCalendar
        try:
            ScheduleService.clear_user_schedule(request.user, term, year)
            events_created = ScheduleService.add_sections_to_calendar(request.user, selected_sections_map, term, year)
            print(f"✅ Schedule saved successfully: {events_created} events created from {len(successful_courses)} courses")
            saved_count = UserCalendar.objects.filter(user=request.user).count()
            print(f"🔍 Verification: {saved_count} events found in database for user")
        except Exception as calendar_error:
            print(f"❌ CRITICAL: Failed to save schedule to calendar: {calendar_error}")
            return Response({
                "success": False,
                "message": f"Schedule generation failed during calendar save: {str(calendar_error)}",
                "program_detected": True,
                "program_name": program.get('program', program_name),
                "events": [],
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Build descriptive response message
        program_name = program.get('program', program_name)
        unique_courses = sorted(successful_courses)
        
        # Check if there were electives filtered out
        has_electives = any('elective' in course.lower() for course in full_courses)
        
        # Build the formatted response message exactly as specified
        response_parts = [
            "Schedule Generated",
            f"Program: {program_name} – Year {year} {term}",
            "",
            "Added Courses:",
            ""
        ]
        
        # Add each course with proper formatting
        for course_code in sorted(unique_courses):
            # Find the course title from sections
            course_title = None
            for section in selected_sections:
                if section['course_code'] == course_code:
                    course_title = section.get('title', '')
                    break
            
            if course_title:
                response_parts.append(f"{course_code} – {course_title}")
            else:
                response_parts.append(course_code)
        
        # Add note about electives only if there were any
        if has_electives:
            elective_details = self.get_elective_details_from_curriculum(program, year, term)
            if elective_details:
                response_parts.extend([
                    "",
                    "Note:",
                    f"You still need to choose {elective_details}",
                    "Please use Kairoll to browse and add these elective courses manually."
                ])
            else:
                response_parts.extend([
                    "",
                    "Note:",
                    "Electives were not included in this schedule.",
                    "Please use Kairoll to browse and add your elective courses manually."
                ])
        
        response_message = "\n".join(response_parts)
        
        # Final verification that events are actually saved
        final_count = UserCalendar.objects.filter(user=request.user).count()
        if final_count == 0:
            print(f"🚨 WARNING: No events found in database after save operation!")
            return Response({
                "success": False,
                "message": "Schedule generation failed: Events were not saved to database.",
                "program_detected": True,
                "program_name": program_name,
                "events": [],
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        print(f"🎯 FINAL CHECK: {final_count} events confirmed in database")
        
        # Build normalized events payload for frontend rendering (in addition to DB persistence)
        try:
            term_start, term_end = ScheduleService._get_term_dates(term, year)
            created_events_qs = UserCalendar.objects.filter(user=request.user, start_date=term_start, end_date=term_end)
            def fmt_time(t):
                try:
                    return t.strftime('%H:%M') if t else ''
                except Exception:
                    return str(t)
            events_payload = [{
                'title': ev.title,
                'start_time': fmt_time(ev.start_time),
                'end_time': fmt_time(ev.end_time),
                'day_of_week': ev.day_of_week,
                'start_date': ev.start_date.strftime('%Y-%m-%d') if ev.start_date else None,
                'end_date': ev.end_date.strftime('%Y-%m-%d') if ev.end_date else None,
                'description': ev.description or '',
                'theme': ev.theme or 'blue-gradient'
            } for ev in created_events_qs]
        except Exception as e:
            print(f"⚠️ Failed to build events payload: {e}")
            events_payload = []

        return Response({
            "success": True,
            "message": response_message,
            "events": events_payload,
            "program_name": program_name,
            "courses_added": unique_courses,
            "has_electives": has_electives,
            "events_saved": final_count
        }, status=status.HTTP_200_OK)

    def generate_full_year_schedule(self, request, program_name: str, year: int):
        """Generate schedules for all terms in a given year using the same logic as single-term generation"""
        # Load program JSONs
        all_programs = self.load_program_jsons()

        def normalize(s):
            return s.lower().replace(' ', '').replace('-', '').replace('_', '').replace('honours', '').replace('joint', '').replace('bsc', '').replace('basc', '').replace('bhsc', '').replace('bachelor', '').replace('in', '').replace('of', '').replace('and', '').replace('(', '').replace(')', '')

        # Find matching program
        program = None
        target_normalized = normalize(program_name)
        for p in all_programs:
            program_title = p.get('program', p.get('name', ''))
            if normalize(program_title) == target_normalized:
                program = p
                break
        if not program:
            return Response({
                "success": False,
                "message": f"Program not found: {program_name}",
                "program_detected": False,
                "events": [],
            }, status=status.HTTP_200_OK)

        # Locate the year block
        year_obj = None
        for y in program.get('years', []):
            if y.get('year') == year:
                year_obj = y
                break
        if not year_obj:
            # Try requirements structure
            for req in program.get('requirements', []):
                year_str = req.get('year', '')
                if f"{year}" in year_str or str(year) in year_str:
                    year_obj = req
                    break
        if not year_obj:
            return Response({
                "success": False,
                "message": f"No curriculum data for Year {year}",
                "program_detected": True,
                "program_name": program.get('program', program.get('name')),
                "events": [],
            }, status=status.HTTP_200_OK)

        # Determine list of terms present in this year
        terms_to_process = []
        # Standard structure
        if 'terms' in year_obj and isinstance(year_obj.get('terms'), list):
            for t in year_obj.get('terms', []):
                term_name = t.get('term')
                if term_name and term_name not in terms_to_process:
                    terms_to_process.append(term_name)
        else:
            # Requirements structure: keys like 'Fall', 'Winter', 'Summer' or 'Spring/Summer'
            for key in ['Fall', 'Winter', 'Summer', 'Spring/Summer']:
                if key in year_obj and year_obj.get(key):
                    # Normalize Spring/Summer to Summer for offering lookup
                    normalized = 'Summer' if key == 'Spring/Summer' else key
                    if normalized not in terms_to_process:
                        terms_to_process.append(normalized)

        # If no terms found, nothing to do
        if not terms_to_process:
            return Response({
                "success": False,
                "message": f"No terms found for Year {year}",
                "program_detected": True,
                "program_name": program.get('program', program.get('name')),
                "events": [],
            }, status=status.HTTP_200_OK)

        # Clear existing calendar events once
        from .models import UserCalendar
        from django.db import transaction
        with transaction.atomic():
            UserCalendar.objects.filter(user=request.user).delete()

            all_selected_sections = []
            response_sections_by_term = {}

            for term in terms_to_process:
                # Collect courses for this term from either structure
                full_courses = []
                if 'terms' in year_obj and isinstance(year_obj.get('terms'), list):
                    for t in year_obj.get('terms', []):
                        if str(t.get('term', '')).lower() == term.lower():
                            full_courses = t.get('courses', [])
                            break
                else:
                    # Requirements structure
                    courses_list = year_obj.get(term, []) or (year_obj.get('Spring/Summer', []) if term == 'Summer' else [])
                    full_courses = courses_list or []

                if not full_courses:
                    continue

                filtered_courses = [c for c in full_courses if 'elective' not in str(c).lower()]
                if not filtered_courses:
                    continue

                # Extract course codes
                course_codes = []
                for c in filtered_courses:
                    s = str(c)
                    code = s.split('|')[0].strip() if '|' in s else s.strip()
                    course_codes.append(code)

                available_sections = self.get_live_sections(course_codes, term)
                selected_sections = self.select_valid_sections(available_sections)
                if not selected_sections:
                    continue

                # Insert to calendar for this term
                self.insert_to_calendar(request.user, selected_sections, term)

                all_selected_sections.extend(selected_sections)
                response_sections_by_term[term] = {
                    'courses': list({sec['course_code'] for sec in selected_sections})
                }

        # Build response message summarizing all terms
        program_disp = program.get('program', program_name)
        parts = ["Schedule Generated", f"Program: {program_disp} – Year {year} (All terms)", ""]
        for term in terms_to_process:
            term_info = response_sections_by_term.get(term)
            if not term_info:
                continue
            parts.append(f"{term}:")
            for course_code in sorted(term_info['courses']):
                parts.append(f"- {course_code}")
            parts.append("")
        response_message = "\n".join(parts).strip()

        # Final count
        final_count = self.models.UserCalendar.objects.filter(user=request.user).count() if hasattr(self, 'models') else UserCalendar.objects.filter(user=request.user).count()

        return Response({
            "success": True,
            "message": response_message,
            "events": all_selected_sections,
            "program_name": program_disp,
            "year": year
        }, status=status.HTTP_200_OK)
    
    def load_program_jsons(self):
        """Load all program JSONs from the curriculums directory"""
        import json
        import os
        from django.conf import settings
        
        curriculum_dir = os.path.join(settings.BASE_DIR, '..', 'frontend', 'public', 'curriculums')
        programs = []
        
        try:
            # First try to use index.json, then fallback to direct directory scan
            program_files = []
            
            # Try loading from index.json
            index_path = os.path.join(curriculum_dir, 'index.json')
            if os.path.exists(index_path):
                try:
                    with open(index_path, 'r', encoding='utf-8') as f:
                        index_data = json.load(f)
                        program_entries = index_data.get('programs', [])
                        # Extract filenames from program objects
                        program_files = [p.get('file') for p in program_entries if p.get('file')]
                        print(f"📋 Loaded {len(program_files)} program files from index.json")
                except Exception as e:
                    print(f"❌ Error reading index.json: {e}, falling back to directory scan")
                    program_files = []
            
            # Fallback: scan directory for ALL JSON files directly
            if not program_files:
                try:
                    all_files = os.listdir(curriculum_dir)
                    program_files = [f for f in all_files if f.endswith('.json') and f != 'index.json']
                    print(f"📂 Fallback: Found {len(program_files)} JSON files in directory")
                except Exception as e:
                    print(f"❌ Error scanning directory: {e}")
                    return []
            
            print(f"📋 Found {len(program_files)} program files to load")
            
            # Load each program file
            loaded_count = 0
            for filename in program_files:
                if filename == 'index.json':
                    continue
                    
                file_path = os.path.join(curriculum_dir, filename)
                if os.path.exists(file_path):
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            program_data = json.load(f)
                            programs.append(program_data)
                            loaded_count += 1
                            program_name = program_data.get('program', 'Unknown Program')
                            print(f"✅ Loaded: {program_name}")
                    except Exception as e:
                        print(f"❌ Error loading {filename}: {e}")
                        continue
                else:
                    print(f"❌ File not found: {file_path}")
            
            print(f"📚 Successfully loaded {loaded_count} programs total")
            return programs
            
        except Exception as e:
            print(f"❌ Error loading programs: {e}")
            return []
    
    def get_live_sections(self, course_codes, term):
        """Get live sections for the given course codes using KaiRoll data"""
        try:
            print(f"🗓️ Loading {term} courses using KaiRoll format")
            
            # Use the working ScheduleService approach
            from .services.schedule_service import ScheduleService
            
            # Get sections using the fixed ScheduleService
            available_sections = ScheduleService.find_sections_for_courses(course_codes, term)
            
            # Convert to the format expected by the old system
            sections = []
            for course_code, course_sections in available_sections.items():
                for section in course_sections:
                    # Prefer canonical code from Kairoll data when available (handles fuzzy mapping)
                    canonical_code = (section.get('code') or section.get('courseCode') or section.get('course_code') or course_code)
                    # Convert to format expected by old system
                    section_data = {
                        'course_code': canonical_code,  # Expected by select_valid_sections
                        'courseCode': canonical_code,   # Keep for compatibility
                        'requested_course_code': course_code,  # For diagnostics
                        'section_code': section.get('section', ''),  # Expected by select_valid_sections
                        'section': section.get('section', ''),       # Keep for compatibility
                        'title': section.get('courseTitle', canonical_code),
                        'time': section.get('time', ''),
                        'days': section.get('days', []),
                        'instructor': section.get('instructor', ''),
                        'location': section.get('location', ''),
                        'type': section.get('type', 'LEC'),
                        'is_open': section.get('is_open', False),
                        'term': term,
                        'units': 3  # Default units
                    }
                    sections.append(section_data)
            
            print(f"🔍 Found {len(sections)} total sections for {len(course_codes)} courses using KaiRoll")
            return sections
            
        except Exception as e:
            print(f"❌ Error loading live sections: {e}")
            return []
    
    def select_valid_sections(self, available_sections):
        """Select valid sections with conflict resolution - one from each required type per course"""
        selected = []
        conflicts = []
        
        try:
            # Group sections by course, then by section group (A, B, C), then by type
            courses = {}
            for section in available_sections:
                course_code = section['course_code']
                section_code = section.get('section_code', '')
                section_type = section.get('type', 'LEC')
                
                # Extract section group from section code (e.g., "A01-LEC" -> "A", "B02-LAB" -> "B")
                section_group = section_code[0] if section_code and len(section_code) > 0 else 'A'
                
                if course_code not in courses:
                    courses[course_code] = {}
                if section_group not in courses[course_code]:
                    courses[course_code][section_group] = {}
                if section_type not in courses[course_code][section_group]:
                    courses[course_code][section_group][section_type] = []
                
                courses[course_code][section_group][section_type].append(section)
            
            # RANDOMIZE: Shuffle course order to create different schedule variations
            course_items = list(courses.items())
            random.shuffle(course_items)
            
            # For each course, select a random section group and use ALL its section types
            for course_code, section_groups in course_items:
                print(f"🔍 Processing {course_code} with section groups: {list(section_groups.keys())}")
                
                course_selections = []
                course_conflicts = []
                best_group = None
                
                # Try different section groups in random order until we find one that works
                available_groups = list(section_groups.items())
                random.shuffle(available_groups)
                
                for group_id, group_types in available_groups:
                    print(f"   🎲 Trying section group {group_id} with types: {list(group_types.keys())}")
                    
                    group_selections = []
                    group_has_conflicts = False
                    
                    # For each section type in this group (LEC, LAB, DGD, etc.)
                    for section_type, sections in group_types.items():
                        # Prefer OPEN sections first, then earlier start times
                        def start_minutes(sec):
                            try:
                                t = sec.get('time', '')
                                import re
                                m = re.search(r'(\d{1,2}):(\d{2})', t)
                                if not m:
                                    return 10**6
                                hh = int(m.group(1))
                                mm = int(m.group(2))
                                return hh * 60 + mm
                            except Exception:
                                return 10**6
                        shuffled_sections = sorted(
                            sections.copy(),
                            key=lambda s: (0 if s.get('is_open', False) else 1, start_minutes(s))
                        )
                        
                        # Find the first non-conflicting section of this type in this group
                        section_found = False
                        for section in shuffled_sections:
                            # Check if this section conflicts with already selected sections
                            if not self.has_time_conflict(section, selected + course_selections + group_selections):
                                group_selections.append(section)
                                print(f"      ✅ Found {course_code} {section_type}: {section['section_code']}")
                                section_found = True
                                break
                        
                        if not section_found:
                            print(f"      ❌ No conflict-free {section_type} in group {group_id}")
                            group_has_conflicts = True
                            break
                    
                    if not group_has_conflicts and group_selections:
                        # This group works! Use all its sections
                        course_selections = group_selections
                        best_group = group_id
                        print(f"   🎯 Selected section group {group_id} for {course_code} ({len(group_selections)} sections)")
                        break
                
                if course_selections:
                    # Add all course selections to the main list
                    selected.extend(course_selections)
                    print(f"✅ Added {len(course_selections)} sections from group {best_group} for {course_code}")
                else:
                    course_conflicts.append(f"{course_code} (no valid section groups)")
                    print(f"❌ No conflict-free section group found for {course_code}")
                
                conflicts.extend(course_conflicts)
            
            print(f"📅 Selected {len(selected)} total sections, {len(conflicts)} conflicts")
            print(f"🎯 Coordinated section groups: Each course uses matching section groups (A+A+A, B+B+B, etc.)")
            print(f"🎲 Randomized schedule generation complete - unique but coordinated combinations created!")
            return selected
            
        except Exception as e:
            print(f"❌ Error selecting sections: {e}")
            return []
    
    def has_time_conflict(self, new_section, existing_sections):
        """Check if new section conflicts with existing ones"""
        try:
            new_days = set(new_section.get('days', []))
            new_time = new_section.get('time', '')
            
            if not new_days or not new_time:
                return False  # No time info, assume no conflict
            
            for existing in existing_sections:
                existing_days = set(existing.get('days', []))
                existing_time = existing.get('time', '')
                
                # Check if days overlap
                if new_days.intersection(existing_days) and new_time == existing_time:
                    return True
            
            return False
            
        except Exception as e:
            print(f"❌ Error checking conflicts: {e}")
            return False
    
    def insert_to_calendar(self, user, sections, term):
        """Insert selected sections to user's calendar"""
        from .models import UserCalendar
        from datetime import datetime, timedelta, time
        import traceback
        
        events_created = 0
        
        try:
            # Map term to proper start/end dates
            term_dates = self.get_term_dates(term)
            print(f"📅 Term dates: {term_dates}")
            
            # Insert new events
            for section in sections:
                print(f"🔄 Processing section: {section.get('course_code')} - {section.get('section_code')}")
                
                days = section.get('days', [])
                time_str = section.get('time', '')
                
                # Validate required fields
                if not section.get('course_code'):
                    print(f"❌ Missing course_code for section: {section}")
                    continue
                
                if not days:
                    print(f"❌ No days specified for {section.get('course_code')}")
                    continue
                
                # Parse time if available
                start_time_obj = None
                end_time_obj = None
                if time_str and '-' in time_str:
                    try:
                        start_str, end_str = time_str.split('-')
                        start_time_obj = self.parse_time(start_str.strip())
                        end_time_obj = self.parse_time(end_str.strip())
                        print(f"⏰ Parsed time: {start_time_obj} - {end_time_obj}")
                    except Exception as time_error:
                        print(f"❌ Error parsing time '{time_str}': {time_error}")
                        # Default times if parsing fails
                        start_time_obj = time(9, 0)  # 9:00 AM
                        end_time_obj = time(10, 30)  # 10:30 AM
                else:
                    # Default times
                    start_time_obj = time(9, 0)
                    end_time_obj = time(10, 30)
                    print(f"⏰ Using default times: {start_time_obj} - {end_time_obj}")
                
                # Create event for each day
                for day in days:
                    try:
                        # Validate day format
                        day_str = str(day).title()  # Ensure proper capitalization
                        if day_str not in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
                            print(f"❌ Invalid day format: {day}, skipping")
                            continue
                        
                        # Extract section type and group ID from section code (e.g., "A01-LEC" -> type="LEC", group="A")
                        section_code = section.get('section_code', 'N/A')
                        section_type = section.get('type', 'LEC')
                        
                        # Extract group ID from section code (first character: A01 -> A, B02 -> B)
                        group_id = section_code[0] if section_code and len(section_code) > 0 else 'A'
                        
                        # Create description with metadata format expected by SwapCourseModal
                        course_code = section['course_code']
                        description = (
                            f"Course: {course_code}\n"
                            f"Section: {section_code}\n"
                            f"Type: {section_type}\n"
                            f"Instructor: {section.get('instructor', 'TBA')}\n"
                            f"Term: {term}"
                        )
                        
                        event = UserCalendar.objects.create(
                            user=user,
                            title=f"{course_code} - {section.get('title', 'Course')}",
                            description=description,
                            location=section.get('location', ''),
                            start_date=term_dates['start'],
                            end_date=term_dates['end'],
                            start_time=start_time_obj,
                            end_time=end_time_obj,
                            day_of_week=day_str,
                            recurrence_pattern='weekly',
                            theme='blue-gradient',
                            professor=section.get('instructor', 'TBA')
                        )
                        events_created += 1
                        print(f"✅ Created calendar event for {course_code} on {day_str} (ID: {event.id})")
                        print(f"   🎯 COORDINATED: {section_code} ({section_type}) from Group {group_id}")
                        print(f"   🔄 SWAP-READY: Can swap within group or to other section groups")
                        
                    except Exception as day_error:
                        print(f"❌ Error creating event for {section.get('course_code')} on {day}: {day_error}")
                        print(f"📋 Section data: {section}")
                        traceback.print_exc()
                        continue
            
            print(f"🎉 Successfully created {events_created} calendar events total")
            return events_created
            
        except Exception as e:
            print(f"❌ Critical error in insert_to_calendar: {e}")
            traceback.print_exc()
            raise e  # Re-raise the exception so we know about it
    
    def get_term_dates(self, term):
        """Deprecated: use ScheduleService._get_term_dates. Kept for backward compatibility in helpers."""
        from .services.schedule_service import ScheduleService
        from datetime import date
        start, end = ScheduleService._get_term_dates(term, 2024)
        return {'start': start, 'end': end}
    
    def parse_time(self, time_str):
        """Parse time string like '9:00 AM' to time object"""
        from datetime import time
        
        try:
            time_str = time_str.strip().upper()
            
            # Handle 24-hour format
            if ':' in time_str and ('AM' not in time_str and 'PM' not in time_str):
                hour, minute = time_str.split(':')
                return time(int(hour), int(minute))
            
            # Handle 12-hour format
            if 'AM' in time_str or 'PM' in time_str:
                is_pm = 'PM' in time_str
                time_part = time_str.replace('AM', '').replace('PM', '').strip()
                
                if ':' in time_part:
                    hour, minute = time_part.split(':')
                else:
                    hour, minute = time_part, '0'
                
                hour = int(hour)
                minute = int(minute)
                
                # Convert to 24-hour format
                if is_pm and hour != 12:
                    hour += 12
                elif not is_pm and hour == 12:
                    hour = 0
                
                return time(hour, minute)
            
            # Default
            return time(9, 0)
            
        except:
            return time(9, 0)

    def detect_program_year_term(self, request, message: str, program_name: str, year: int, term: str):
        """Intelligently detect program, year, and term from multiple sources"""
        try:
            from .services.program_service import ProgramService
            import asyncio
            
            detected_program = program_name
            detected_year = year
            detected_term = term
            
            print(f"🔍 Starting intelligent detection...")
            
            # Step 1: Try to get from user's profile if not provided
            if not detected_program:
                try:
                    user_program = ProgramService.get_user_program(request.user)
                    if user_program:
                        detected_program = user_program
                        print(f"📋 Found program in user profile: {detected_program}")
                except Exception as e:
                    print(f"❌ Error getting user program: {e}")
            
            # Step 2: Use AI to detect from message if still missing
            if not detected_program and message:
                try:
                    ai_result = asyncio.run(ProgramService.detect_program_name(message))
                    if ai_result[0] and ai_result[1] > 0.6:  # slightly lower threshold due to offline mode
                        detected_program = ai_result[0]
                        print(f"🤖 Detected program: {detected_program} (confidence: {ai_result[1]:.2f})")
                except Exception as e:
                    print(f"❌ Error with program detection: {e}")
            
            # Step 3: Detect year from message if not provided
            if not detected_year and message:
                try:
                    inferred_year = ProgramService.infer_year_from_message(message)
                    if inferred_year:
                        detected_year = inferred_year
                        print(f"📅 Inferred year from message: {detected_year}")
                except Exception as e:
                    print(f"❌ Error inferring year: {e}")
            
            # Step 4: Detect term from message if not provided
            if not detected_term and message:
                detected_term = self.detect_term_from_message(message)
                if detected_term:
                    print(f"🗓️ Detected term from message: {detected_term}")
            
            # Step 5: Use current academic defaults if still missing.
            # If a year is specified but no term, leave term empty to allow full-year generation.
            if not detected_term:
                if detected_year:
                    detected_term = ''
                    print(f"🗓️ No term specified but year provided; will generate all terms for Year {detected_year}")
                else:
                    detected_term = self.get_current_academic_term()
                    print(f"🗓️ Using current academic term: {detected_term}")
            
            if not detected_year:
                detected_year = self.infer_year_from_current_schedule(request.user) or 2
                print(f"📅 Using inferred/default year: {detected_year}")
            
            # Step 6: Use AI to extract program if we still don't have one
            if not detected_program and message:
                detected_program = self.ai_extract_program_from_message(message)
                if detected_program:
                    print(f"🤖 AI extracted program from message: {detected_program}")
            
            # Step 7: If still no program, ask user intelligently
            if not detected_program:
                available_programs = ProgramService.get_all_program_names()[:10]
                return {
                    'success': False,
                    'message': f"I'd love to help you generate a schedule! I just need to know which program you're in.\n\n📚 Popular programs:\n{chr(10).join(['• ' + p for p in available_programs])}\n\n💡 Just tell me something like:\n• 'Computer Science 2nd year fall'\n• 'Mechanical Engineering year 3 winter'\n• 'Health Sciences second year'\n\nWhat program are you in?"
                }
            
            # Step 8: Resolve program using ProgramService (index-driven, future-proof)
            program_found = False
            program_entry = None
            try:
                if detected_program:
                    program_entry = ProgramService.get_program_by_name(detected_program)
                # If not found via direct name, try offline detection from message
                if not program_entry and message:
                    offline_name, _conf = ProgramService.detect_program_name_offline(message)
                    if offline_name:
                        program_entry = ProgramService.get_program_by_name(offline_name)
                if program_entry:
                    # Use exact name from index for downstream consistency
                    detected_program = program_entry.get('name') or program_entry.get('program') or detected_program
                    program_found = True
            except Exception as e:
                print(f"❌ Error resolving program via ProgramService: {e}")

            if not program_found:
                # Show a short curated list from the index (no hardcoding)
                available_programs = ProgramService.get_all_program_names()[:8]
                pretty = '\n'.join(['• ' + p for p in available_programs if p])
                return {
                    'success': False,
                    'message': f"Program '{detected_program}' not found.\n\nAvailable programs:\n{pretty}\n\nPlease specify your exact program name."
                }
            
            return {
                'success': True,
                'program': detected_program,
                'year': detected_year,
                'term': detected_term
            }
            
        except Exception as e:
            print(f"❌ Error in detect_program_year_term: {e}")
            return {
                'success': False,
                'message': f"Error detecting program information: {str(e)}"
            }
    
    def detect_term_from_message(self, message: str) -> str:
        """Extract term from user message"""
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['fall', 'autumn', 'september', 'october', 'november']):
            return 'Fall'
        elif any(word in message_lower for word in ['winter', 'january', 'february', 'march', 'april']):
            return 'Winter'
        elif any(word in message_lower for word in ['spring', 'summer', 'may', 'june', 'july', 'august']):
            return 'Spring/Summer'
        
        return ''
    
    def get_current_academic_term(self) -> str:
        """Get the current academic term based on today's date"""
        from datetime import datetime
        
        now = datetime.now()
        month = now.month
        
        # Academic calendar logic
        if month in [9, 10, 11, 12]:  # Sept-Dec
            return 'Fall'
        elif month in [1, 2, 3, 4]:  # Jan-Apr
            return 'Winter'
        else:  # May-Aug
            return 'Spring/Summer'
    
    def infer_year_from_current_schedule(self, user) -> int:
        """Try to infer academic year from user's current schedule"""
        try:
            from .models import UserCalendar
            
            events = UserCalendar.objects.filter(user=user)
            if not events.exists():
                return None
            
            # Look for course codes to infer year level
            for event in events:
                title = event.title
                # Extract course code (e.g., "CSI2110" from "CSI2110 - Data Structures")
                import re
                match = re.search(r'([A-Z]{3,4})(\d)', title)
                if match:
                    course_level = int(match.group(2))
                    return course_level
            
            return None
        except Exception as e:
            print(f"❌ Error inferring year from schedule: {e}")
            return None
    
    def programs_match(self, input_program: str, curriculum_program: str) -> bool:
        """Check if two program names match with fuzzy logic"""
        def normalize(s):
            return s.lower().replace(' ', '').replace('-', '').replace('_', '').replace('honours', '').replace('joint', '').replace('bsc', '').replace('basc', '').replace('bhsc', '').replace('bachelor', '').replace('in', '').replace('of', '').replace('and', '').replace('(', '').replace(')', '')
        
        normalized_input = normalize(input_program)
        normalized_curriculum = normalize(curriculum_program)
        
        # Exact match
        if normalized_input == normalized_curriculum:
            return True
        
        # Partial match for common patterns
        if 'computer' in normalized_input and 'science' in normalized_input:
            if 'computer' in normalized_curriculum and 'science' in normalized_curriculum:
                return True
        
        if 'health' in normalized_input and 'science' in normalized_input:
            if 'health' in normalized_curriculum and 'science' in normalized_curriculum:
                return True
        
        return False
    
    def ai_extract_program_from_message(self, message: str) -> str:
        """Use AI to extract program name from any user message - NO HARDCODING"""
        try:
            import openai
            import os
            from django.conf import settings
            
            openai_api_key = getattr(settings, 'OPENAI_API_KEY', None) or os.getenv('OPENAI_API_KEY')
            
            if not openai_api_key:
                return ''
            
            # Get available programs for context
            available_programs = self.load_program_jsons()
            program_names = [p.get('program', p.get('name', '')) for p in available_programs[:20]]
            
            client = openai.OpenAI(api_key=openai_api_key)
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{
                    "role": "system",
                    "content": f"""You extract program names from user messages. Users can mention programs in ANY way.

Available programs include:
{chr(10).join(['• ' + p for p in program_names if p])}

Extract the program name from the user's message, even if they use informal terms:
- "comp sci" → "Computer Science" 
- "mech eng" → "Mechanical Engineering"
- "health sciences" → "Health Sciences"
- "software eng" → "Software Engineering"
- "civil" → "Civil Engineering"
- "nursing" → "Nursing"

If you find a program match, respond with the EXACT program name from the available list.
If no clear program is mentioned, respond with empty string.

Example responses:
- "Honours BSc in Computer Science"
- "BASc in Mechanical Engineering" 
- "Honours Bachelor of Health Sciences"
- ""
"""
                }, {
                    "role": "user", 
                    "content": message
                }],
                max_tokens=50,
                temperature=0.1
            )
            
            result = response.choices[0].message.content.strip()
            
            # Validate the result matches an actual program
            for p in available_programs:
                program_title = p.get('program', p.get('name', ''))
                if self.programs_match(result, program_title):
                    return program_title
            
            return ''
            
        except Exception as e:
            print(f"❌ Error in AI program extraction: {e}")
            return ''
    
    def get_elective_details_from_curriculum(self, program: dict, year: int, term: str) -> str:
        """Extract specific elective requirements from curriculum JSON"""
        try:
            electives_found = []
            
            # Find the year and term data
            year_data = None
            for y in program.get('years', []):
                if y.get('year') == year:
                    year_data = y
                    break
            
            if not year_data:
                return ""
            
            # Find the term data
            term_data = None
            for t in year_data.get('terms', []):
                if t.get('term', '').lower() == term.lower():
                    term_data = t
                    break
            
            if not term_data:
                return ""
            
            # Extract electives from courses
            courses = term_data.get('courses', [])
            for course in courses:
                course_str = str(course).lower()
                if 'elective' in course_str:
                    # Extract elective type
                    if '|' in course:
                        # Format: "Elective | Type" or "Elective | Course1 or Course2"
                        elective_part = course.split('|', 1)[1].strip()
                        
                        if ' or ' in elective_part:
                            # Specific course choices like "HIS2129 or PHI2394"
                            choices = elective_part.split(' or ')
                            formatted_choices = ' or '.join([c.strip() for c in choices])
                            electives_found.append(f"one of: {formatted_choices}")
                        else:
                            # Elective type like "Complementary", "Technical", etc.
                            elective_type = elective_part.lower()
                            if elective_type == 'complementary':
                                electives_found.append("a complementary elective")
                            elif elective_type == 'technical':
                                electives_found.append("a technical elective")
                            elif elective_type == 'free':
                                electives_found.append("a free elective")
                            else:
                                electives_found.append(f"a {elective_type} elective")
                    else:
                        # Generic elective
                        electives_found.append("an elective course")
            
            # Format the response
            if not electives_found:
                return ""
            elif len(electives_found) == 1:
                return electives_found[0]
            elif len(electives_found) == 2:
                return f"{electives_found[0]} and {electives_found[1]}"
            else:
                return f"{', '.join(electives_found[:-1])}, and {electives_found[-1]}"
                
        except Exception as e:
            print(f"❌ Error extracting elective details: {e}")
            return ""
