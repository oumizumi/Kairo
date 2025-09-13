from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from datetime import datetime, timedelta
import pytz
from .models import UserCalendar, SharedSchedule
from .serializers import UserCalendarSerializer, CreateUserCalendarSerializer, SharedScheduleSerializer, CreateSharedScheduleSerializer


class UserCalendarViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user calendar events
    Provides CRUD operations for persistent calendar storage
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Only return calendar events for the current user
        return UserCalendar.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        if self.action in ['create']:
            return CreateUserCalendarSerializer
        return UserCalendarSerializer
    
    def create(self, request, *args, **kwargs):
        """Create a new calendar event for the user"""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            calendar_event = serializer.save()
            response_serializer = UserCalendarSerializer(calendar_event)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def update(self, request, *args, **kwargs):
        """Update an existing calendar event"""
        # Treat PUT as PATCH to avoid wiping fields when frontend only changes theme
        partial = True
        instance = self.get_object()
        
        # Ensure user can only update their own events
        if instance.user != request.user:
            return Response(
                {'error': 'You can only update your own calendar events'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            calendar_event = serializer.save()
            response_serializer = UserCalendarSerializer(calendar_event)
            return Response(response_serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, *args, **kwargs):
        """Delete a calendar event"""
        instance = self.get_object()
        
        # Ensure user can only delete their own events
        if instance.user != request.user:
            return Response(
                {'error': 'You can only delete your own calendar events'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """
        Create multiple calendar events at once
        Useful for importing entire schedules
        """
        events_data = request.data.get('events', [])
        
        if not isinstance(events_data, list):
            return Response(
                {'error': 'events must be a list'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created_events = []
        errors = []
        
        for event_data in events_data:
            serializer = CreateUserCalendarSerializer(
                data=event_data, 
                context={'request': request}
            )
            if serializer.is_valid():
                calendar_event = serializer.save()
                created_events.append(UserCalendarSerializer(calendar_event).data)
            else:
                errors.append({
                    'event_data': event_data,
                    'errors': serializer.errors
                })
        
        return Response({
            'created_events': created_events,
            'errors': errors,
            'total_created': len(created_events),
            'total_errors': len(errors)
        }, status=status.HTTP_201_CREATED if created_events else status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['delete'])
    def clear_calendar(self, request):
        """
        Delete all calendar events for the user
        Useful for resetting/clearing the schedule
        """
        deleted_count = self.get_queryset().delete()[0]
        return Response({
            'message': f'Deleted {deleted_count} calendar events',
            'deleted_count': deleted_count
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def export_calendar(self, request):
        """
        Export user's calendar in a format suitable for frontend
        Returns the same format the frontend expects
        """
        events = self.get_queryset()
        serializer = UserCalendarSerializer(events, many=True)
        
        # Convert to the format expected by DailyCalendar component
        calendar_events = []
        for event_data in serializer.data:
            calendar_events.append({
                'id': event_data['id'],
                'title': event_data['title'],
                'startTime': event_data['start_time'],
                'endTime': event_data['end_time'],
                'day_of_week': event_data['day_of_week'],
                'start_date': event_data['start_date'],
                'end_date': event_data['end_date'],
                'description': event_data['description'],
                'professor': event_data['professor'],
                'location': event_data['location'],
                'recurrence_pattern': event_data['recurrence_pattern'],
                'reference_date': event_data['reference_date'],
                'theme': event_data['theme']
            })
        
        return Response({
            'events': calendar_events,
            'total_events': len(calendar_events),
            'user': request.user.username
        }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def export_ics(request):
    """
    Export course schedule as .ics file
    No authentication required - uses only submitted data
    """
    try:
        events_data = request.data
        
        if not isinstance(events_data, list):
            return Response(
                {'error': 'Request body must be an array of course events'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Toronto timezone
        toronto_tz = pytz.timezone("America/Toronto")
        
        # Reading week dates
        reading_weeks = [
            # Fall 2025 Reading Week
            (datetime(2025, 10, 12), datetime(2025, 10, 18)),
            # Winter 2026 Reading Week  
            (datetime(2026, 2, 15), datetime(2026, 2, 21))
        ]
        
        # Start building .ics content manually
        ics_lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Kairo//Kairo Schedule//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "BEGIN:VTIMEZONE",
            "TZID:America/Toronto",
            "BEGIN:DAYLIGHT",
            "TZOFFSETFROM:-0500",
            "TZOFFSETTO:-0400",
            "TZNAME:EDT",
            "DTSTART:20070311T020000",
            "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
            "END:DAYLIGHT",
            "BEGIN:STANDARD",
            "TZOFFSETFROM:-0400",
            "TZOFFSETTO:-0500",
            "TZNAME:EST",
            "DTSTART:20071104T020000",
            "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
            "END:STANDARD",
            "END:VTIMEZONE"
        ]
        
        for course_data in events_data:
            try:
                # Extract course information
                summary = course_data.get('summary', '')
                start_time_str = course_data.get('start', '')
                end_time_str = course_data.get('end', '')
                days = course_data.get('days', [])
                end_date_str = course_data.get('endDate', '')
                professor = course_data.get('professor', '')
                
                if not all([summary, start_time_str, end_time_str, days, end_date_str]):
                    continue  # Skip incomplete events
                
                # Parse start and end times
                start_dt = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
                
                # Convert to Toronto timezone
                if start_dt.tzinfo is None:
                    start_dt = toronto_tz.localize(start_dt)
                else:
                    start_dt = start_dt.astimezone(toronto_tz)
                    
                if end_dt.tzinfo is None:
                    end_dt = toronto_tz.localize(end_dt)
                else:
                    end_dt = end_dt.astimezone(toronto_tz)
                
                # Generate unique ID for event
                import uuid
                event_uid = str(uuid.uuid4())
                
                # Format datetime for .ics (YYYYMMDDTHHMMSS)
                dtstart = start_dt.strftime('%Y%m%dT%H%M%S')
                dtend = end_dt.strftime('%Y%m%dT%H%M%S')
                
                # Create event
                ics_lines.extend([
                    "BEGIN:VEVENT",
                    f"UID:{event_uid}",
                    f"DTSTART;TZID=America/Toronto:{dtstart}",
                    f"DTEND;TZID=America/Toronto:{dtend}",
                    f"SUMMARY:{summary}",
                ])
                
                # Add description with professor info
                if professor:
                    ics_lines.append(f"DESCRIPTION:Instructor: {professor}")
                
                # Build recurrence rule for recurring events
                if len(days) > 0:
                    # Convert days to RRULE format
                    day_mapping = {
                        'MO': 'MO', 'TU': 'TU', 'WE': 'WE', 
                        'TH': 'TH', 'FR': 'FR', 'SA': 'SA', 'SU': 'SU'
                    }
                    
                    rrule_days = [day_mapping.get(day, day) for day in days if day in day_mapping]
                    
                    if rrule_days:
                        # Format end date for RRULE (YYYYMMDD format)
                        until_date = end_date.strftime('%Y%m%d')
                        rrule = f"FREQ=WEEKLY;BYDAY={','.join(rrule_days)};UNTIL={until_date}"
                        ics_lines.append(f"RRULE:{rrule}")
                        
                        # Add exclusions for reading weeks
                        exdates = []
                        for reading_start, reading_end in reading_weeks:
                            current_date = reading_start
                            while current_date <= reading_end:
                                # Check if this date matches one of the course days
                                weekday_map = {0: 'MO', 1: 'TU', 2: 'WE', 3: 'TH', 4: 'FR', 5: 'SA', 6: 'SU'}
                                current_weekday = weekday_map[current_date.weekday()]
                                
                                if current_weekday in days:
                                    # Create exclusion datetime with course start time
                                    exclusion_dt = datetime.combine(
                                        current_date.date(), 
                                        start_dt.time()
                                    )
                                    exclusion_dt = toronto_tz.localize(exclusion_dt)
                                    exdate_str = exclusion_dt.strftime('%Y%m%dT%H%M%S')
                                    exdates.append(exdate_str)
                                
                                current_date += timedelta(days=1)
                        
                        # Add all exclusion dates
                        for exdate in exdates:
                            ics_lines.append(f"EXDATE;TZID=America/Toronto:{exdate}")
                
                ics_lines.append("END:VEVENT")
                
            except (ValueError, KeyError, TypeError) as e:
                # Skip malformed events and continue processing
                # Silenced debug output
                continue
        
        # Close calendar
        ics_lines.append("END:VCALENDAR")
        
        # Join all lines with CRLF (required by .ics format)
        ics_content = '\r\n'.join(ics_lines)
        
        # Create HTTP response
        response = HttpResponse(ics_content, content_type='text/calendar')
        response['Content-Disposition'] = 'attachment; filename="kairo_schedule.ics"'
        
        return response
        
    except Exception as e:
        return Response(
            {'error': f'Failed to generate calendar: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class SharedScheduleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing shared schedule snapshots
    Allows users to share their schedules with others
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Only return shared schedules for the current user
        return SharedSchedule.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        if self.action in ['create']:
            return CreateSharedScheduleSerializer
        return SharedScheduleSerializer
    
    def create(self, request, *args, **kwargs):
        """Create a new shared schedule snapshot"""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            shared_schedule = serializer.save()
            response_serializer = SharedScheduleSerializer(shared_schedule)
            return Response({
                'shared_schedule': response_serializer.data,
                'share_url': f"https://kairoo.ca/schedule/{shared_schedule.id}"
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_shared_schedule(request, schedule_id):
    """
    Get a shared schedule by ID (public endpoint)
    No authentication required - anyone with the link can view
    """
    try:
        shared_schedule = get_object_or_404(SharedSchedule, id=schedule_id)
        
        # Increment view count
        shared_schedule.view_count += 1
        shared_schedule.save(update_fields=['view_count'])
        
        serializer = SharedScheduleSerializer(shared_schedule)
        return Response({
            'shared_schedule': serializer.data,
            'owner': shared_schedule.user.username
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {'error': f'Failed to retrieve shared schedule: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )