import { parseAndCreateCalendarEvents, CalendarEvent } from './api';

// Function to process calendar event JSON objects
export const processCalendarEvents = async (eventObjects: any[]): Promise<CalendarEvent[]> => {
    try {
        const createdEvents: CalendarEvent[] = [];

        for (const eventObj of eventObjects) {
            // Convert the event object to a JSON string that parseAndCreateCalendarEvents expects
            const jsonString = JSON.stringify(eventObj);

            // Use the existing parsing function to create the event
            const events = await parseAndCreateCalendarEvents(jsonString);
            createdEvents.push(...events);
        }
        
        return createdEvents;
    } catch (error) {
        console.error('Error processing calendar events:', error);
        throw error;
    }
};

// Helper function to create a calendar event object
export const createCalendarEventObject = (
    title: string,
    dayOfWeek: string,
    startTime: string,
    endTime: string
) => {
    return {
        action: "create_calendar_event",
        params: {
            title,
            day_of_week: dayOfWeek,
            start_time: startTime,
            end_time: endTime
        }
    };
}; 