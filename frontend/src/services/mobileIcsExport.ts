import { APP_CONFIG } from '@/config/app.config';

// Interface for calendar events
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
    location?: string;
    recurrence_pattern?: 'weekly' | 'biweekly' | 'none';
    reference_date?: string;
    theme?: string;
}

/**
 * Generate RFC 5545 compliant ICS file content directly in the browser
 * This is optimized for mobile devices (iOS and Android)
 */
export async function generateICSContent(events: CalendarEvent[], currentTerm: string = 'Fall'): Promise<string> {

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

    // Start building ICS content
    let icsContent = [
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
    ];

    // Process each event
    for (const event of events) {
        // Skip events without required data
        if (!event.title || !event.startTime || !event.endTime) {
            continue;
        }

        // Generate a unique ID for the event
        const eventUid = generateUUID();

        // Handle recurring weekly events
        if (event.day_of_week && event.recurrence_pattern === 'weekly') {
            const dayCode = dayMapping[event.day_of_week];
            if (!dayCode) continue;

            // Use the proper term start and end dates
            const startDate = termConfig.startDate; // Use term start date
            const endDate = termConfig.endDate;     // Use term end date

            // Format dates for ICS
            const startDateObj = new Date(`${startDate}T${event.startTime}`);
            const endDateObj = new Date(`${startDate}T${event.endTime}`);

            // Format to UTC time
            const dtstart = formatDateToUTC(startDateObj);
            const dtend = formatDateToUTC(endDateObj);

            // Format until date (end of term)
            const untilDate = new Date(endDate);
            // For UNTIL parameter in RRULE, we need the full datetime in UTC format
            const until = formatDateToUTC(untilDate);

            // Create event
            icsContent.push(
                "BEGIN:VEVENT",
                `UID:${eventUid}`,
                `DTSTART:${dtstart}`,
                `DTEND:${dtend}`,
                `SUMMARY:${escapeIcsValue(event.title)}`,
                `DESCRIPTION:${escapeIcsValue(event.description || '')}${event.professor ? '\\nInstructor: ' + escapeIcsValue(event.professor) : ''}`,
                `LOCATION:${escapeIcsValue(event.location || '')}`,
                `RRULE:FREQ=WEEKLY;BYDAY=${dayCode};UNTIL=${until}`,
                "END:VEVENT"
            );
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

            // Format dates for ICS
            const startDateObj = new Date(`${validReferenceDate}T${event.startTime}`);
            const endDateObj = new Date(`${validReferenceDate}T${event.endTime}`);

            // Format to UTC time
            const dtstart = formatDateToUTC(startDateObj);
            const dtend = formatDateToUTC(endDateObj);

            // Format until date (end of term)
            const untilDate = new Date(endDate);
            // For UNTIL parameter in RRULE, we need the full datetime in UTC format
            const until = formatDateToUTC(untilDate);

            // Create event
            icsContent.push(
                "BEGIN:VEVENT",
                `UID:${eventUid}`,
                `DTSTART:${dtstart}`,
                `DTEND:${dtend}`,
                `SUMMARY:${escapeIcsValue(event.title)}`,
                `DESCRIPTION:${escapeIcsValue(event.description || '')}${event.professor ? '\\nInstructor: ' + escapeIcsValue(event.professor) : ''}`,
                `LOCATION:${escapeIcsValue(event.location || '')}`,
                `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${dayCode};UNTIL=${until}`,
                "END:VEVENT"
            );
        }
        // Handle one-time events
        else if (event.start_date && event.end_date) {
            // Format dates for ICS
            const startDateObj = new Date(`${event.start_date}T${event.startTime}`);
            const endDateObj = new Date(`${event.end_date}T${event.endTime}`);

            // Format to UTC time
            const dtstart = formatDateToUTC(startDateObj);
            const dtend = formatDateToUTC(endDateObj);

            // Create event
            icsContent.push(
                "BEGIN:VEVENT",
                `UID:${eventUid}`,
                `DTSTART:${dtstart}`,
                `DTEND:${dtend}`,
                `SUMMARY:${escapeIcsValue(event.title)}`,
                `DESCRIPTION:${escapeIcsValue(event.description || '')}${event.professor ? '\\nInstructor: ' + escapeIcsValue(event.professor) : ''}`,
                `LOCATION:${escapeIcsValue(event.location || '')}`,
                "END:VEVENT"
            );
        }
    }

    // Close calendar
    icsContent.push("END:VCALENDAR");

    // Join with CRLF as required by RFC 5545
    return icsContent.join('\r\n');
}

/**
 * Format a date to UTC format for ICS files (YYYYMMDDTHHMMSSZ)
 * Ensures proper RFC 5545 compliance
 */
function formatDateToUTC(date: Date): string {
    try {
        // Ensure we have a valid date
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            console.error('❌ Invalid date provided to formatDateToUTC:', date);
            // Return a fallback date (current time) to prevent errors
            return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z';
        }

        // Format according to RFC 5545
        // For ICS files, we need the format: YYYYMMDDTHHMMSSZ
        const year = date.getUTCFullYear();
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = date.getUTCDate().toString().padStart(2, '0');
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        const seconds = date.getUTCSeconds().toString().padStart(2, '0');

        return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
    } catch (error) {
        console.error('❌ Error formatting date to UTC:', error);
        // Return a fallback date (current time) to prevent errors
        const now = new Date();
        return `${now.getUTCFullYear()}${(now.getUTCMonth() + 1).toString().padStart(2, '0')}${now.getUTCDate().toString().padStart(2, '0')}T${now.getUTCHours().toString().padStart(2, '0')}${now.getUTCMinutes().toString().padStart(2, '0')}${now.getUTCSeconds().toString().padStart(2, '0')}Z`;
    }
}

/**
 * Escape special characters in ICS values according to RFC 5545
 * This ensures proper formatting of text fields in calendar events
 */
function escapeIcsValue(value: string): string {
    if (!value) return '';
    return value
        .replace(/\\/g, '\\\\') // Escape backslashes first
        .replace(/;/g, '\\;')   // Escape semicolons
        .replace(/,/g, '\\,')   // Escape commas
        .replace(/\n/g, '\\n'); // Escape newlines
}

/**
 * Export calendar directly as ICS file for mobile devices
 * Optimized for iOS and Android browsers
 */
export async function exportCalendarForMobile(events: CalendarEvent[], filename: string = 'kairoschedule', currentTerm: string = 'Fall'): Promise<void> {
    // Ensure we have a valid filename
    filename = filename || 'kairoschedule';

    // Ensure we have a valid term
    currentTerm = currentTerm || 'Fall';
    try {
        

        // Validate term parameter
        const validTerm = currentTerm && typeof currentTerm === 'string' ? currentTerm : 'Fall';

        // Check if we have any events
        if (!events || events.length === 0) {
            console.error('❌ No events provided for export');
            throw new Error('No events available to export');
        }

        // Log events for debugging
        

        // Create a fallback event if no valid events are found
        let hasValidEvents = false;
        for (const event of events) {
            if (event.title && event.startTime && event.endTime) {
                hasValidEvents = true;
                break;
            }
        }

        if (!hasValidEvents) {
            console.warn('⚠️ No valid events found, creating a fallback event');
            // Add a fallback event to ensure something is exported
            const today = new Date();
            const tomorrow = new Date();
            tomorrow.setDate(today.getDate() + 1);

            events.push({
                title: "Your Course Schedule",
                startTime: "09:00",
                endTime: "10:00",
                start_date: today.toISOString().split('T')[0],
                end_date: tomorrow.toISOString().split('T')[0],
                description: "Exported from Kairoll"
            });
        }

        // Generate ICS content directly in the browser
        
        const icsContent = await generateICSContent(events, validTerm);
        

        // Create blob with the correct MIME type
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });

        // Create object URL
        const url = URL.createObjectURL(blob);

        try {
            // Different approaches for different mobile browsers
            if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
                

                // iOS Safari approach - using data URL works better for iOS
                const reader = new FileReader();

                reader.onload = function () {
                    try {
                        // Create a data URL from the blob
                        const dataUrl = reader.result as string;

                        // Create a link with the data URL
                        const link = document.createElement('a');
                        link.href = dataUrl;
                        link.download = `${filename}.ics`;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.setAttribute('download', `${filename}.ics`);

                        // For iOS, we need to make the link visible to ensure it works
                        link.style.position = 'fixed';
                        link.style.top = '10px';
                        link.style.left = '10px';
                        link.style.width = '80%';
                        link.style.maxWidth = '300px';
                        link.style.padding = '15px';
                        link.style.background = 'linear-gradient(to right, #4a90e2, #5f6bff)';
                        link.style.color = 'white';
                        link.style.textAlign = 'center';
                        link.style.borderRadius = '10px';
                        link.style.zIndex = '9999';
                        link.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
                        link.style.fontWeight = 'bold';
                        link.style.fontSize = '16px';
                        link.style.textDecoration = 'none';
                        link.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
                        link.textContent = '📅 Tap to Download Calendar';

                        // Append to body
                        document.body.appendChild(link);

                        // Auto-click doesn't work reliably on iOS, so we'll show a message

                        // Remove the link after 10 seconds
                        setTimeout(() => {
                            try {
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                                
                            } catch (cleanupError) {
                                console.warn('⚠️ Cleanup error:', cleanupError);
                            }
                        }, 10000);
                    } catch (error) {
                        console.error('❌ Error with iOS download approach:', error);
                        alert('Download failed. Please try again or use a desktop browser.');
                    }
                };

                reader.onerror = function () {
                    console.error('❌ FileReader error:', reader.error);
                    alert('Download failed. Please try again or use a desktop browser.');
                };

                // Read the blob as data URL
                reader.readAsDataURL(blob);
            } else {
                
                // Standard approach for Android and other browsers
                const link = document.createElement('a');
                link.href = url;
                link.download = `${filename}.ics`;
                link.style.display = 'none';

                // Append to body and trigger click
                document.body.appendChild(link);
                link.click();

                // Clean up
                setTimeout(() => {
                    try {
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                    } catch (cleanupError) {
                        console.warn('⚠️ Cleanup error:', cleanupError);
                    }
                }, 100);
            }

            
            return Promise.resolve();
        } catch (downloadError) {
            console.error('❌ Error during download process:', downloadError);
            throw downloadError;
        }
    } catch (error) {
        console.error('❌ Error exporting calendar for mobile:', error);
        throw error;
    }
}

/**
 * Check if there are events available for export
 */
export function hasEventsToExport(events: CalendarEvent[]): boolean {
        // Count events that can be exported
        let validEventCount = 0;

    // Check events for export

    for (const event of events) {
        // Skip events without required data
            if (!event.title || !event.startTime || !event.endTime) {
            continue;
        }

        // Check if it's a valid event type
        if (
            // Weekly events
            (event.day_of_week && event.recurrence_pattern === 'weekly') ||
            // Bi-weekly events
            (event.day_of_week && event.recurrence_pattern === 'biweekly' && event.reference_date) ||
            // One-time events
            (event.start_date && event.end_date)
        ) {
            validEventCount++;
        } else {
            
        }
    }

        
    return validEventCount > 0;
}

/**
 * Check if the current device is mobile
 */
export function isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Generate a UUID v4 compatible string
 * This is a simple implementation that doesn't require external dependencies
 */
function generateUUID(): string {
    // Use crypto API if available for better randomness
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => {
            const n = Number(c);
            return (n ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (n / 4)))).toString(16);
        });
    }

    // Fallback to Math.random() if crypto API is not available
    let d = new Date().getTime();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}