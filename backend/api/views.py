import os
import uuid
import asyncio
import time
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
from .models import UserProfile, UserPreferences
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import viewsets, filters
import django_filters
from django_filters.rest_framework import DjangoFilterBackend
import logging
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Message, CalendarEvent, ImportantDate, ExamEvent, Course # Import the Message and CalendarEvent models
from .serializers import CalendarEventSerializer, ImportantDateSerializer, ExamEventSerializer, CourseSerializer

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
                    "username": guest_user.username,
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

@method_decorator(cache_page(90), name='list')
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
                        # User exists but password is incorrect - return clear error message
                        return Response({'error': 'Incorrect password'}, status=status.HTTP_401_UNAUTHORIZED)
                except User.DoesNotExist:
                    # No account matches the provided identifier - return clear error message
                    return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)
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

@method_decorator(cache_page(120), name='dispatch')
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
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.views.decorators.csrf import csrf_exempt
try:
    from ratelimit.decorators import ratelimit
except Exception:  # pragma: no cover
    def ratelimit(*args, **kwargs):
        def _wrap(fn):
            return fn
        return _wrap
from celery.result import AsyncResult

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
# --- Intent Detection ---

class IntentDetectionSerializer(serializers.Serializer):
    message = serializers.CharField(required=True, allow_blank=False)
    prompt = serializers.CharField(required=False, allow_blank=True)
    programs = serializers.ListField(required=False, allow_empty=True)
    system_prompt = serializers.CharField(required=False, allow_blank=True)
    model = serializers.CharField(required=False, default='gpt-4o-mini')
    temperature = serializers.FloatField(required=False, default=0.1)
    max_tokens = serializers.IntegerField(required=False, default=200)  # Optimized for faster classification

class AIClassificationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        """AI classification is currently disabled"""
        return Response({
            "error": "AI classification service is currently disabled"
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


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
                    "username": guest_user.username,
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

@method_decorator(cache_page(90), name='list')
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
                        # User exists but password is incorrect - return clear error message
                        return Response({'error': 'Incorrect password'}, status=status.HTTP_401_UNAUTHORIZED)
                except User.DoesNotExist:
                    # No account matches the provided identifier - return clear error message
                    return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)
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

@method_decorator(cache_page(120), name='dispatch')
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
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.views.decorators.csrf import csrf_exempt
try:
    from ratelimit.decorators import ratelimit
except Exception:  # pragma: no cover
    def ratelimit(*args, **kwargs):
        def _wrap(fn):
            return fn
        return _wrap
from celery.result import AsyncResult

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

try:
    from celery.result import AsyncResult
except Exception:  # pragma: no cover
    class AsyncResult:  # type: ignore
        def __init__(self, task_id: str):
            self.id = task_id
            self.state = 'PENDING'
            self.result = None
            self.info = None

try:
    from .tasks import run_ai
except Exception:  # pragma: no cover
    class _Dummy:
        def delay(self, payload):
            class _Task:
                id = 'dev-no-worker'
            return _Task()
    run_ai = _Dummy()

@csrf_exempt
@ratelimit(key='ip', rate='60/m', block=True)
@api_view(['POST'])
@permission_classes([AllowAny])
def ai_enqueue(request):
    try:
        payload = {}
        try:
            payload = json.loads(request.body.decode('utf-8') or '{}')
        except Exception:
            payload = {}

        task = run_ai.delay(payload)
        return JsonResponse({"task_id": str(task.id)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
def ai_status(request, task_id: str):
    res = AsyncResult(task_id)
    data = {"state": res.state}
    if res.state == 'SUCCESS':
        data["result"] = res.result
    elif res.state in ('FAILURE', 'REVOKED'):
        data["error"] = str(res.info)
    return JsonResponse(data)

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

# Auto Schedule Builder API
class AutoScheduleBuilderView(APIView):
    """New auto schedule builder that works with any program and uses scraper data"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Build a new auto-generated schedule"""
        try:
            from .services.auto_schedule_builder_service import auto_schedule_service
            
            # Extract request data
            request_text = request.data.get('message', request.data.get('request', ''))
            term = request.data.get('term')
            preferences = request.data.get('preferences', {})
            
            if not request_text:
                return Response({
                    'success': False,
                    'message': 'Please provide a schedule request message'
                }, status=400)
            
            # Build the schedule
            result = auto_schedule_service.build_schedule(
                user=request.user,
                request_text=request_text,
                term=term,
                preferences=preferences
            )
            
            return Response(result)
            
        except Exception as e:
            logger.error(f"[AUTO_SCHEDULE] Error in schedule builder API: {e}")
            return Response({
                'success': False,
                'message': f'Error building schedule: {str(e)}',
                'error': str(e)
            }, status=500)
    
    def get(self, request):
        """Get user's current schedules"""
        try:
            from .models import Schedule, ScheduleEntry
            
            # Get user's active schedules
            schedules = Schedule.objects.filter(
                user=request.user,
                is_active=True
            ).prefetch_related('entries')
            
            schedule_data = []
            for schedule in schedules:
                entries = []
                for entry in schedule.entries.all():
                    entries.append({
                        'id': str(entry.id),
                        'course_code': entry.course_code,
                        'course_title': entry.course_title,
                        'section_code': entry.section_code,
                        'component': entry.component,
                        'day_of_week': entry.day_of_week,
                        'start_time': entry.start_time.strftime('%H:%M'),
                        'end_time': entry.end_time.strftime('%H:%M'),
                        'instructor': entry.instructor,
                        'location': entry.location,
                        'theme': entry.color,  # Using color field for theme
                        'start_date': entry.start_date.isoformat(),
                        'end_date': entry.end_date.isoformat()
                    })
                
                schedule_data.append({
                    'id': str(schedule.id),
                    'term': schedule.term,
                    'term_display': schedule.term_display,
                    'created_at': schedule.created_at.isoformat(),
                    'entries': entries,
                    'total_courses': len(set(entry.course_code for entry in schedule.entries.all()))
                })
            
            return Response({
                'success': True,
                'schedules': schedule_data,
                'count': len(schedule_data)
            })
            
        except Exception as e:
            logger.error(f"[AUTO_SCHEDULE] Error getting schedules: {e}")
            return Response({
                'success': False,
                'message': f'Error retrieving schedules: {str(e)}'
            }, status=500)


class ScheduleAdjustmentView(APIView):
    """Handle natural language schedule adjustments"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, schedule_id):
        """Apply natural language adjustments to a schedule"""
        try:
            from .services.nlp_schedule_adjustments_service import nlp_adjustments_service
            
            adjustment_request = request.data.get('adjustment', request.data.get('message', ''))
            
            if not adjustment_request:
                return Response({
                    'success': False,
                    'message': 'Please provide an adjustment request'
                }, status=400)
            
            # Process the adjustment
            result = nlp_adjustments_service.process_adjustment(
                user=request.user,
                schedule_id=schedule_id,
                adjustment_request=adjustment_request
            )
            
            return Response(result)
            
        except Exception as e:
            logger.error(f"[SCHEDULE_ADJUST] Error processing adjustment: {e}")
            return Response({
                'success': False,
                'message': f'Error processing adjustment: {str(e)}',
                'error': str(e)
            }, status=500)


class ScheduleDataVersionView(APIView):
    """Check scraper data version and invalidate cache if needed"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get current dataset version"""
        try:
            from .services.scraper_integration_service import scraper_service
            
            current_version = scraper_service.check_dataset_version()
            cache_invalidated = scraper_service.invalidate_cache_if_stale(current_version)
            
            return Response({
                'success': True,
                'dataset_version': current_version,
                'cache_invalidated': cache_invalidated
            })
            
        except Exception as e:
            logger.error(f"[DATA_VERSION] Error checking version: {e}")
            return Response({
                'success': False,
                'message': f'Error checking data version: {str(e)}'
            }, status=500)


# Legacy Schedule Generation API (keep for backward compatibility)
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
            for section in selected_sections_map.values():
                if section and section.get('course_code') == course_code:
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

# Auto Schedule Builder API
class UserPreferencesView(APIView):
    """API to manage user-specific preferences"""
    permission_classes = [IsAuthenticated]

    def get(self, request, key=None):
        """Get user preferences - either all or by specific key"""
        try:
            if key:
                # Get specific preference
                try:
                    preference = UserPreferences.objects.get(user=request.user, key=key)
                    return Response({
                        'key': preference.key,
                        'value': preference.value
                    })
                except UserPreferences.DoesNotExist:
                    return Response({
                        'key': key,
                        'value': None
                    })
            else:
                # Get all preferences for user
                preferences = UserPreferences.objects.filter(user=request.user)
                data = {pref.key: pref.value for pref in preferences}
                return Response(data)
                
        except Exception as e:
            logger.error(f"Error getting user preferences: {e}")
            return Response(
                {'error': 'Failed to get preferences'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request):
        """Create or update user preference"""
        try:
            key = request.data.get('key')
            value = request.data.get('value')
            
            if not key:
                return Response(
                    {'error': 'Key is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create or update preference
            preference, created = UserPreferences.objects.update_or_create(
                user=request.user,
                key=key,
                defaults={'value': value}
            )
            
            return Response({
                'key': preference.key,
                'value': preference.value,
                'created': created
            })
            
        except Exception as e:
            logger.error(f"Error saving user preference: {e}")
            return Response(
                {'error': 'Failed to save preference'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request, key=None):
        """Delete a specific user preference"""
        try:
            if not key:
                return Response(
                    {'error': 'Key is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                preference = UserPreferences.objects.get(user=request.user, key=key)
                preference.delete()
                return Response({'message': 'Preference deleted successfully'})
            except UserPreferences.DoesNotExist:
                return Response(
                    {'error': 'Preference not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
                
        except Exception as e:
            logger.error(f"Error deleting user preference: {e}")
            return Response(
                {'error': 'Failed to delete preference'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
