import { getAcademicTermDates, shouldDisplayCourseOnDate } from './dateValidation';

export interface CalendarEventData {
    title: string;
    start_time: string;
    end_time: string;
    day_of_week: string;
    start_date: string;
    end_date: string;
    description: string;
}

/**
 * Creates a calendar event with proper Fall term date validation
 * Ensures events only appear within academic term dates (Sept 3 - Dec 2)
 * and excludes reading week (Oct 12-18) for Fall courses
 */
export function createValidatedCalendarEvent(eventData: CalendarEventData, term: string): CalendarEventData {
    // Get proper academic term dates
    const termDates = getAcademicTermDates(term);

    // For Fall term, ensure we use the correct academic dates
    const validatedEventData = {
        ...eventData,
        start_date: termDates.start,
        end_date: termDates.end
    };

    return validatedEventData;
}

/**
 * Validates if a calendar event should be displayed on a specific date
 * This is used by the calendar component to filter events
 */
export function shouldDisplayEventOnDate(eventData: CalendarEventData, dateString: string, term: string): boolean {
    // For Fall and Winter courses, check against academic term validation (excludes reading week)
    if (term === '2025 Fall Term' || term === '2026 Winter Term') {
        return shouldDisplayCourseOnDate(dateString, term);
    }

    // For other terms, use standard date validation
    return shouldDisplayCourseOnDate(dateString, term);
}

/**
 * Gets the appropriate term string from various term formats
 */
export function normalizeTermString(term: string): string {
    const termMap: { [key: string]: string } = {
        'Fall': '2025 Fall Term',
        'Winter': '2026 Winter Term',
        'Spring': '2025 Spring/Summer Term',
        'Summer': '2025 Spring/Summer Term',
        '2025 Fall Term': '2025 Fall Term',
        '2026 Winter Term': '2026 Winter Term',
        '2025 Spring/Summer Term': '2025 Spring/Summer Term'
    };

    return termMap[term] || '2025 Fall Term'; // Default to Fall
}

/**
 * Creates a description for calendar events with proper formatting
 */
export function createEventDescription(courseData: {
    courseCode: string;
    courseTitle: string;
    sectionCode: string;
    sectionType: string;
    instructor: string;
    timeSlot: { day: string; startTime: string; endTime: string };
}): string {
    return `Course: ${courseData.courseCode}
Title: ${courseData.courseTitle}
Section: ${courseData.sectionCode}
Type: ${courseData.sectionType}
Instructor: ${courseData.instructor}
Time: ${courseData.timeSlot.day} ${courseData.timeSlot.startTime} - ${courseData.timeSlot.endTime}
Location: TBD`;
} 