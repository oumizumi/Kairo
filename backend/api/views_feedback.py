from rest_framework import status, generics, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Avg, Count, Q
from django.utils import timezone
from django.http import JsonResponse
from datetime import datetime, timedelta
import json

from .models import AIResponseFeedback, EmailFeedback, FeedbackAnalytics
from .serializers import (
    AIResponseFeedbackSerializer, 
    EmailFeedbackSerializer,
    FeedbackAnalyticsSerializer,
    AIResponseFeedbackCreateSerializer,
    EmailFeedbackCreateSerializer
)


class AIResponseFeedbackCreateView(APIView):
    """Create feedback for AI responses"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            # Get client IP and user agent
            ip_address = self.get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')
            
            # Prepare data
            data = request.data.copy()
            data['user'] = request.user.id
            data['ip_address'] = ip_address
            data['user_agent'] = user_agent
            
            serializer = AIResponseFeedbackCreateSerializer(data=data)
            if serializer.is_valid():
                feedback = serializer.save()
                
                # If this is email feedback, create EmailFeedback record
                if feedback.feedback_type == 'email' and 'email_details' in request.data:
                    email_data = request.data['email_details'].copy()
                    email_data['ai_feedback'] = feedback.id
                    
                    email_serializer = EmailFeedbackCreateSerializer(data=email_data)
                    if email_serializer.is_valid():
                        email_serializer.save()
                    else:
                        # If email feedback fails, still return success for main feedback
                        print(f"Email feedback creation failed: {email_serializer.errors}")
                
                return Response({
                    'id': feedback.id,
                    'message': 'Feedback submitted successfully',
                    'feedback_type': feedback.feedback_type,
                    'rating': feedback.rating
                }, status=status.HTTP_201_CREATED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            return Response({
                'error': 'Failed to submit feedback',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def get_client_ip(self, request):
        """Get client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class FeedbackAnalyticsView(APIView):
    """Get feedback analytics and insights"""
    permission_classes = [IsAuthenticated]  # Only authenticated users can view analytics
    
    def get(self, request):
        try:
            # Get date range from query params
            days = int(request.query_params.get('days', 30))
            end_date = timezone.now().date()
            start_date = end_date - timedelta(days=days)
            
            # Overall statistics
            total_feedback = AIResponseFeedback.objects.filter(
                created_at__date__gte=start_date,
                created_at__date__lte=end_date
            )
            
            # Basic metrics
            total_count = total_feedback.count()
            if total_count == 0:
                return Response({
                    'message': 'No feedback data available for the selected period',
                    'total_feedback': 0,
                    'date_range': {'start': start_date, 'end': end_date}
                })
            
            # Calculate metrics
            avg_rating = total_feedback.aggregate(Avg('rating'))['rating__avg'] or 0
            positive_count = total_feedback.filter(rating__gte=4, is_helpful=True).count()
            negative_count = total_feedback.filter(Q(rating__lte=2) | Q(is_helpful=False)).count()
            
            # By feedback type
            by_type = total_feedback.values('feedback_type').annotate(
                count=Count('id'),
                avg_rating=Avg('rating')
            ).order_by('-count')
            
            # Email-specific metrics
            email_feedback = total_feedback.filter(feedback_type='email')
            email_count = email_feedback.count()
            email_avg_rating = email_feedback.aggregate(Avg('rating'))['rating__avg'] or 0
            
            # Get email modification rate
            email_details = EmailFeedback.objects.filter(
                ai_feedback__in=email_feedback
            )
            modified_emails = email_details.filter(
                Q(user_modified_subject=True) | Q(user_modified_body=True)
            ).count()
            modification_rate = (modified_emails / email_count * 100) if email_count > 0 else 0
            
            # Common issues for emails
            email_issues = {}
            if email_count > 0:
                email_issues = {
                    'too_formal': email_details.filter(too_formal=True).count(),
                    'too_casual': email_details.filter(too_casual=True).count(),
                    'wrong_tone': email_details.filter(wrong_tone=True).count(),
                    'missing_context': email_details.filter(missing_context=True).count(),
                    'grammatical_errors': email_details.filter(grammatical_errors=True).count(),
                }
            
            # Daily breakdown
            daily_stats = []
            for i in range(days):
                date = start_date + timedelta(days=i)
                day_feedback = total_feedback.filter(created_at__date=date)
                daily_stats.append({
                    'date': date,
                    'count': day_feedback.count(),
                    'avg_rating': day_feedback.aggregate(Avg('rating'))['rating__avg'] or 0,
                    'positive': day_feedback.filter(rating__gte=4, is_helpful=True).count(),
                    'negative': day_feedback.filter(Q(rating__lte=2) | Q(is_helpful=False)).count(),
                })
            
            # Recent feedback samples
            recent_positive = total_feedback.filter(
                rating__gte=4, 
                is_helpful=True,
                feedback_text__isnull=False
            ).exclude(feedback_text='').order_by('-created_at')[:5]
            
            recent_negative = total_feedback.filter(
                Q(rating__lte=2) | Q(is_helpful=False),
                feedback_text__isnull=False
            ).exclude(feedback_text='').order_by('-created_at')[:5]
            
            return Response({
                'summary': {
                    'total_feedback': total_count,
                    'average_rating': round(avg_rating, 2),
                    'positive_feedback': positive_count,
                    'negative_feedback': negative_count,
                    'feedback_rate': round((total_count / (total_count + 100)) * 100, 1),  # Rough estimate
                },
                'by_type': by_type,
                'email_metrics': {
                    'total_email_feedback': email_count,
                    'average_rating': round(email_avg_rating, 2),
                    'modification_rate': round(modification_rate, 1),
                    'common_issues': email_issues,
                },
                'daily_stats': daily_stats,
                'recent_samples': {
                    'positive': [
                        {
                            'rating': f.rating,
                            'feedback': f.feedback_text[:200] + '...' if len(f.feedback_text) > 200 else f.feedback_text,
                            'type': f.feedback_type,
                            'date': f.created_at.date()
                        } for f in recent_positive
                    ],
                    'negative': [
                        {
                            'rating': f.rating,
                            'feedback': f.feedback_text[:200] + '...' if len(f.feedback_text) > 200 else f.feedback_text,
                            'type': f.feedback_type,
                            'date': f.created_at.date()
                        } for f in recent_negative
                    ]
                },
                'date_range': {
                    'start': start_date,
                    'end': end_date,
                    'days': days
                }
            })
            
        except Exception as e:
            return Response({
                'error': 'Failed to retrieve analytics',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FeedbackExportView(APIView):
    """Export feedback data for analysis"""
    permission_classes = [IsAuthenticated]  # Restrict to authenticated users
    
    def get(self, request):
        try:
            # Get filters from query params
            feedback_type = request.query_params.get('type', None)
            days = int(request.query_params.get('days', 30))
            rating_filter = request.query_params.get('rating', None)
            
            end_date = timezone.now().date()
            start_date = end_date - timedelta(days=days)
            
            # Build query
            queryset = AIResponseFeedback.objects.filter(
                created_at__date__gte=start_date,
                created_at__date__lte=end_date
            )
            
            if feedback_type:
                queryset = queryset.filter(feedback_type=feedback_type)
            
            if rating_filter:
                if rating_filter == 'positive':
                    queryset = queryset.filter(rating__gte=4, is_helpful=True)
                elif rating_filter == 'negative':
                    queryset = queryset.filter(Q(rating__lte=2) | Q(is_helpful=False))
            
            # Serialize data
            serializer = AIResponseFeedbackSerializer(queryset, many=True)
            
            return Response({
                'feedback_data': serializer.data,
                'total_records': queryset.count(),
                'filters_applied': {
                    'type': feedback_type,
                    'days': days,
                    'rating': rating_filter,
                    'date_range': {'start': start_date, 'end': end_date}
                }
            })
            
        except Exception as e:
            return Response({
                'error': 'Failed to export feedback data',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quick_feedback(request):
    """Quick feedback endpoint for thumbs up/down"""
    try:
        data = request.data
        
        # Create minimal feedback record
        feedback = AIResponseFeedback.objects.create(
            user=request.user,
            feedback_type=data.get('type', 'chat'),
            user_input=data.get('user_input', ''),
            ai_response=data.get('ai_response', ''),
            rating=5 if data.get('thumbs_up') else 1,
            is_helpful=data.get('thumbs_up', False),
            session_id=data.get('session_id'),
            model_used=data.get('model', 'gpt-4o-mini'),
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        return Response({
            'message': 'Quick feedback recorded',
            'feedback_id': feedback.id
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({
            'error': 'Failed to record quick feedback',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def feedback_stats_public(request):
    """Public endpoint for basic feedback statistics"""
    try:
        # Only show aggregated, non-sensitive stats
        total_feedback = AIResponseFeedback.objects.count()
        avg_rating = AIResponseFeedback.objects.aggregate(Avg('rating'))['rating__avg'] or 0
        
        # Last 30 days
        thirty_days_ago = timezone.now() - timedelta(days=30)
        recent_feedback = AIResponseFeedback.objects.filter(created_at__gte=thirty_days_ago)
        recent_count = recent_feedback.count()
        recent_avg = recent_feedback.aggregate(Avg('rating'))['rating__avg'] or 0
        
        return Response({
            'total_feedback_received': total_feedback,
            'overall_rating': round(avg_rating, 1),
            'last_30_days': {
                'feedback_count': recent_count,
                'average_rating': round(recent_avg, 1)
            },
            'message': 'AI responses are continuously improved based on user feedback'
        })
        
    except Exception as e:
        return Response({
            'error': 'Failed to retrieve public stats'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)