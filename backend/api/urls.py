from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (
    UserRegistrationView,
    UserLoginView,  # Add UserLoginView import
    UserProfileView,
    UserProfileUpdateView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    MessageView, # Add MessageView import
    IntentDetectionView, # Add IntentDetectionView import
    AIClassificationView, # Add AI Classification import
    ProfessorSyncView, # Add Professor Sync import
    ProfessorAutoSyncView, # Add Professor Auto Sync import
    HealthCheckView, # Add this import
    GuestLoginView, # Add GuestLoginView import
    CalendarEventListCreateView, # Changed from CalendarEventListView
    CalendarEventRetrieveUpdateDestroyView, # Add this import
    ImportantDateViewSet,
    ExamEventViewSet,
    CourseViewSet, # Add CourseViewSet import
    ContactEmailView, # Add ContactEmailView import
    CourseDataView, # Add CourseDataView import
    professor_rmp_data, # Add RMP endpoints
    professor_search,
    rmp_stats,
    ScheduleGenerationView, # Add ScheduleGenerationView import (legacy)
    AutoScheduleBuilderView, # Add new auto schedule builder
    ScheduleAdjustmentView, # Add schedule adjustment view
    ScheduleDataVersionView, # Add data version check view
    UserPreferencesView, # Add UserPreferencesView import
)
from .views_feedback import (
    AIResponseFeedbackCreateView,
    FeedbackAnalyticsView,
    FeedbackExportView,
    quick_feedback,
    feedback_stats_public
)
from .calendar_views import UserCalendarViewSet, export_ics, SharedScheduleViewSet, get_shared_schedule
from .views import ai_enqueue, ai_status
from .views_ai import ai_router

app_name = 'api'

# Initialize the router
router = DefaultRouter()

# Register viewsets with the router
router.register(r'dates', ImportantDateViewSet, basename='importantdate')
router.register(r'exams', ExamEventViewSet, basename='examevent')
router.register(r'courses', CourseViewSet, basename='course')
router.register(r'user-calendar', UserCalendarViewSet, basename='user-calendar')
router.register(r'shared-schedules', SharedScheduleViewSet, basename='shared-schedule')


urlpatterns = [
    path('auth/register/', UserRegistrationView.as_view(), name='user-register'),
    path('auth/login/', UserLoginView.as_view(), name='user-login'), # Custom login view
    # Slashless aliases to avoid 405 when client omits trailing slash
    path('auth/login', UserLoginView.as_view(), name='user-login-no-slash'),
    path('auth/guest-login/', GuestLoginView.as_view(), name='guest-login'), # Guest login
    path('auth/guest-login', GuestLoginView.as_view(), name='guest-login-no-slash'),
    path('health/', HealthCheckView.as_view(), name='health-check'), # Health check
    path('health', HealthCheckView.as_view(), name='health-check-no-slash'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('auth/profile/update/', UserProfileUpdateView.as_view(), name='profile-update'),
    path('auth/password-reset/request/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('auth/password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    # AI Chat URL - handle both with and without ID
    path('ai/chat/', MessageView.as_view(), name='ai-chat'),
    path('ai/chat/<int:id>/', MessageView.as_view(), name='ai-chat-with-id'),
    # AI Intent Detection URL
    path('ai/intent/', IntentDetectionView.as_view(), name='ai-intent'),
    # AI Classification URL
    path('ai/classify/', AIClassificationView.as_view(), name='ai-classify'),
    # Auto Schedule Builder URLs (new system)
    path('auto-schedule/', AutoScheduleBuilderView.as_view(), name='auto-schedule-builder'),
    path('auto-schedule/adjust/<uuid:schedule_id>/', ScheduleAdjustmentView.as_view(), name='schedule-adjustment'),
    path('auto-schedule/version/', ScheduleDataVersionView.as_view(), name='schedule-data-version'),
    
    # Legacy Schedule Generation URL (backward compatibility)
    path('schedule/generate/', ScheduleGenerationView.as_view(), name='schedule-generate'),
    path('health-check/', HealthCheckView.as_view(), name='health-check-dup'), # Add this line
    path('health-check', HealthCheckView.as_view(), name='health-check-no-slash'),
    # Calendar Events URL
    path('calendar/events/', CalendarEventListCreateView.as_view(), name='calendar-events'),
    path('calendar/events/<int:pk>/', CalendarEventRetrieveUpdateDestroyView.as_view(), name='calendar-event-detail'),
    # Calendar Export URL
    path('calendar/export_ics/', export_ics, name='calendar-export-ics'),
    # Shared Schedule URL (public endpoint)
    path('schedule/<uuid:schedule_id>/', get_shared_schedule, name='shared-schedule-view'),
    # Contact Email URL
    path('contact/send/', ContactEmailView.as_view(), name='contact-send'),
    # Course Data API
    path('data/courses-complete/', CourseDataView.as_view(), name='courses-complete'),
    # Unified AI Router (fast path + background upgrade + limits)
    path('ai/router', ai_router, name='ai-router'),
    # AI async endpoints
    path('ai/enqueue', ai_enqueue, name='ai-enqueue-no-slash'),
    path('ai/enqueue/', ai_enqueue, name='ai-enqueue'),
    path('ai/status/<str:task_id>/', ai_status, name='ai-status'),
    
    # RMP Data APIs
    path('professors/rmp/', professor_rmp_data, name='professor-rmp-data'),
    path('professors/search/', professor_search, name='professor-search'),
    path('rmp/stats/', rmp_stats, name='rmp-stats'),

    # Professor Sync URL
    path('professors/sync/', ProfessorSyncView.as_view(), name='professor-sync'),
    path('professors/auto-sync/', ProfessorAutoSyncView.as_view(), name='professor-auto-sync'),

    # User Preferences URLs
    path('user-preferences/', UserPreferencesView.as_view(), name='user-preferences'),
    path('user-preferences/<str:key>/', UserPreferencesView.as_view(), name='user-preferences-key'),

    # Feedback URLs
    path('feedback/submit/', AIResponseFeedbackCreateView.as_view(), name='feedback-submit'),
    path('feedback/quick/', quick_feedback, name='feedback-quick'),
    path('feedback/analytics/', FeedbackAnalyticsView.as_view(), name='feedback-analytics'),
    path('feedback/export/', FeedbackExportView.as_view(), name='feedback-export'),
    path('feedback/stats/', feedback_stats_public, name='feedback-stats-public'),

    # Add the router URLs to the urlpatterns
    path('', include(router.urls)),
]
