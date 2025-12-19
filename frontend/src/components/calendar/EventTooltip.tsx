import React from 'react';
import { Event, EventTooltipProps } from './types';

const EventTooltip: React.FC<EventTooltipProps> = ({ event, visible, position }) => {
    if (!visible || !event) return null;

    // Helper function to normalize event properties for backward compatibility
    const normalizeEventProperties = (event: any): Event => {
        return {
            ...event,
            startTime: event.startTime || event.start_time,  // Handle both formats
            endTime: event.endTime || event.end_time,        // Handle both formats
        };
    };

    // Extract section code from event description (format: "Section: A00-LEC")
    let sectionCode = '';
    let instructor = event.professor || ''; // Use professor field first, empty if not set
    let mainCourseCode = '';
    let courseName = '';

    // Parse the description to extract information
    if (event.description) {
        // Extract section code from description
        const sectionMatch = event.description.match(/Section:\s*([^\n\r]+)/i);
        if (sectionMatch) {
            sectionCode = sectionMatch[1].trim();
        }

        // Extract instructor from description only if we don't have professor field
        if (!instructor) {
            const instructorMatch = event.description.match(/Instructor:\s*([^\n\r]+)/i);
            if (instructorMatch) {
                instructor = instructorMatch[1].trim();
            }
        }

        // Extract course title from description
        const titleMatch = event.description.match(/Title:\s*([^\n\r]+)/i);
        if (titleMatch) {
            courseName = titleMatch[1].trim();
        }

        // Try different patterns to extract course code
        const patterns = [
            /Course:\s*([A-Z]{3}\s*\d{4})/i,  // "Course: CSI 2110"
            /([A-Z]{3}\s*\d{4})/,              // Just "CSI 2110" anywhere
            /([A-Z]{3}\d{4})/                  // "CSI2110" without space
        ];

        for (const pattern of patterns) {
            const match = event.description.match(pattern);
            if (match) {
                mainCourseCode = match[1].replace(/\s+/g, ' ').trim(); // Normalize spacing
                break;
            }
        }
    }

    // If we still don't have instructor, try to extract from title
    if (!instructor) {
        const titleParts = event.title.split(' - ');
        if (titleParts.length > 1) {
            // Get the last part as instructor (handle cases like "CSI 2110 (LEC) - John Smith")
            instructor = titleParts[titleParts.length - 1].trim();
        }
    }

    // If we still don't have course code, check if the title contains it
    if (!mainCourseCode) {
        const titleParts = event.title.split(' - ');
        if (titleParts.length > 0) {
            const firstPart = titleParts[0].trim();
            // Check if it matches course code pattern
            if (firstPart.match(/^[A-Z]{3}\s*\d{4}$/)) {
                mainCourseCode = firstPart;
            }
        }
    }

    // Use the course name extracted from the description (no hardcoded dictionary needed)
    const fullCourseTitle = courseName ? `${mainCourseCode} - ${courseName}` : mainCourseCode;

    // Parse section type - first try to get it from the "Type:" field in description
    let sectionType = '';
    if (event.description) {
        const typeMatch = event.description.match(/Type:\s*([^\n\r]+)/i);
        if (typeMatch) {
            sectionType = typeMatch[1].trim();
        }
    }

    // If no "Type:" field found, fallback to parsing from section code (e.g., "A00-LEC" -> "LEC")
    if (!sectionType && sectionCode) {
        const sectionMatch = sectionCode.match(/[A-Z]\d+-(\w+)/);
        sectionType = sectionMatch ? sectionMatch[1] : '';
    }

    const sectionTypeMap: { [key: string]: string } = {
        'LEC': 'Lecture',
        'LAB': 'Laboratory',
        'TUT': 'Tutorial',
        'SEM': 'Seminar',
        'DGD': 'Discussion Group'
    };
    const fullSectionType = sectionTypeMap[sectionType] || sectionType;

    // Format time range
    const formatTime12Hour = (timeString: string): string => {
        const [hours, minutes] = timeString.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        const displayMinutes = minutes.toString().padStart(2, '0');
        return `${displayHours}:${displayMinutes} ${ampm}`;
    };

    const normalizedEvent = normalizeEventProperties(event);
    const timeRange = `${formatTime12Hour(normalizedEvent.startTime)} - ${formatTime12Hour(normalizedEvent.endTime)}`;

    return (
        <div
            className="fixed pointer-events-none"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: 'translate(-50%, -120%)',
                zIndex: 9999
            }}
        >
            <div className="bg-slate-700 border border-slate-600 rounded-lg shadow-xl p-4 max-w-xs min-w-48">
                {/* Course code and title */}
                <div className="mb-3 pb-3 border-b border-slate-600">
                    <h3 className="text-white font-medium text-sm leading-tight">
                        {mainCourseCode || event.title.split(' - ')[0]}{courseName ? ` - ${courseName}` : ''}
                    </h3>
                </div>

                {/* Time */}
                <div className="mb-2">
                    <p className="text-blue-400 text-sm font-medium">
                        {timeRange}
                    </p>
                </div>

                {/* Section code */}
                {sectionCode && (
                    <div className="mb-2">
                        <p className="text-slate-300 text-sm">
                            Section: {sectionCode}{sectionType && fullSectionType ? ` (${fullSectionType})` : ''}
                        </p>
                    </div>
                )}

                {/* Instructor - only show if we have one */}
                {instructor && (
                    <div className="mb-2">
                        <p className="text-slate-300 text-sm">
                            Instructor: {instructor}
                        </p>
                    </div>
                )}

                {/* Day */}
                <div>
                    <p className="text-slate-300 text-sm">
                        Day: {event.day_of_week || 'Friday'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default EventTooltip;