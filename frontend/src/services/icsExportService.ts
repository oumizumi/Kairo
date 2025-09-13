import { APP_CONFIG } from '@/config/app.config';

// Interface for the calendar event data expected by the backend
interface ICSExportEvent {
    summary: string;
    start: string;
    end: string;
    days: string[];
    endDate: string;
    professor?: string;
}

// Interface for the calendar events from the frontend
interface CalendarEvent {
    id?: number;
    title: string;
    startTime: string;
    endTime: string;
    day_of_week?: string;
    start_date?: string;
    end_date?: string;
    description?: string;
    professor?: string;
    recurrence_pattern?: 'weekly' | 'biweekly' | 'none';
    reference_date?: string;
    theme?: string;
}

/**
 * Transform frontend calendar events to the format expected by the backend ICS export
 */
function transformEventsForICS(events: CalendarEvent[], currentTerm: string = 'Fall'): ICSExportEvent[] {
    const transformedEvents: ICSExportEvent[] = [];
    
    // Day mapping for conversion
    const dayMapping: { [key: string]: string } = {
        'Monday': 'MO',
        'Tuesday': 'TU', 
        'Wednesday': 'WE',
        'Thursday': 'TH',
        'Friday': 'FR',
        'Saturday': 'SA',
        'Sunday': 'SU'
    };

    for (const event of events) {
        // Skip events without required data
        if (!event.title || !event.startTime || !event.endTime) {
            continue;
        }

        // Get the correct term configuration
        const getTermConfig = (term: string) => {
            switch (term.toLowerCase()) {
                case 'fall':
                    return APP_CONFIG.ACADEMIC.TERMS.FALL;
                case 'winter':
                    return APP_CONFIG.ACADEMIC.TERMS.WINTER;
                case 'spring/summer':
                    return APP_CONFIG.ACADEMIC.TERMS.SPRING_SUMMER;
                default:
                    return APP_CONFIG.ACADEMIC.TERMS.FALL; // Default fallback
            }
        };

        const termConfig = getTermConfig(currentTerm);

        // Handle recurring weekly events
        if (event.day_of_week && event.recurrence_pattern === 'weekly') {
            const dayCode = dayMapping[event.day_of_week];
            if (!dayCode) continue;

            // Use the proper term start and end dates
            const startDate = termConfig.startDate; // Use term start date
            const endDate = termConfig.endDate;     // Use term end date

            // Create start and end datetime strings
            const startDateTime = `${startDate}T${event.startTime}`;
            const endDateTime = `${startDate}T${event.endTime}`;

            transformedEvents.push({
                summary: event.title,
                start: startDateTime,
                end: endDateTime,
                days: [dayCode],
                endDate: endDate,
                professor: event.professor || ''
            });
        }
        // Handle bi-weekly events
        else if (event.day_of_week && event.recurrence_pattern === 'biweekly' && event.reference_date) {
            const dayCode = dayMapping[event.day_of_week];
            if (!dayCode) continue;

            const endDate = termConfig.endDate;

            // Ensure reference date is within term boundaries
            const referenceDate = new Date(event.reference_date);
            const termStart = new Date(termConfig.startDate);
            const termEnd = new Date(termConfig.endDate);

            // If reference date is outside term boundaries, use term start date
            const validReferenceDate = referenceDate < termStart || referenceDate > termEnd 
                ? termConfig.startDate 
                : event.reference_date;

            // Use reference date for bi-weekly events
            const startDateTime = `${validReferenceDate}T${event.startTime}`;
            const endDateTime = `${validReferenceDate}T${event.endTime}`;

            transformedEvents.push({
                summary: event.title,
                start: startDateTime,
                end: endDateTime,
                days: [dayCode],
                endDate: endDate,
                professor: event.professor || ''
            });
        }
        // Handle one-time events
        else if (event.start_date && event.end_date) {
            const startDateTime = `${event.start_date}T${event.startTime}`;
            const endDateTime = `${event.end_date}T${event.endTime}`;

            transformedEvents.push({
                summary: event.title,
                start: startDateTime,
                end: endDateTime,
                days: [], // No recurring days for one-time events
                endDate: event.end_date,
                professor: event.professor || ''
            });
        }
    }

    return transformedEvents;
}

/**
 * Export calendar events as .ics file
 */
export async function exportCalendarAsICS(events: CalendarEvent[], filename: string = 'kairo_schedule', currentTerm: string = 'Fall'): Promise<void> {
    try {
        // Transform events to the format expected by the backend
        const transformedEvents = transformEventsForICS(events, currentTerm);
        
        if (transformedEvents.length === 0) {
            throw new Error('No valid events to export');
        }

        // Get API base URL
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ||
            (typeof window !== 'undefined' && window.location.hostname === 'localhost'
                ? 'http://localhost:8000'
                : 'https://kairopublic-production.up.railway.app');

        // Make POST request to export endpoint
        const response = await fetch(`${API_BASE_URL}/api/calendar/export_ics/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(transformedEvents)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        // Get the .ics file content
        const icsContent = await response.text();
        
        // Create and trigger download
        const blob = new Blob([icsContent], { type: 'text/calendar' });
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.ics`;
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        
    } catch (error) {
        console.error('❌ Error exporting calendar:', error);
        throw error;
    }
}

/**
 * Check if there are events available for export
 */
export function hasEventsToExport(events: CalendarEvent[]): boolean {
    return transformEventsForICS(events).length > 0;
}