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
from .models import UserProfile
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
