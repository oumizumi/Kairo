// Natural language parser for calendar events
export interface ParsedEvent {
    title: string;
    // For recurring weekly events
    day_of_week?: string;
    // For specific date events
    start_date?: string; // YYYY-MM-DD format
    end_date?: string;   // YYYY-MM-DD format
    start_time: string;
    end_time: string;
    confidence: number; // 0-1 how confident we are in the parse
}

export interface ParseResult {
    success: boolean;
    events: ParsedEvent[];
    confirmation?: string;
    error?: string;
}

import { COURSE_CODE_PATTERNS } from '@/config/course.config';

// Use dynamic course code patterns from configuration

// Day name mappings with variations
const DAY_MAPPINGS: { [key: string]: string } = {
    // Monday
    'monday': 'Monday', 'mondays': 'Monday', 'mon': 'Monday', 'mo': 'Monday',
    // Tuesday  
    'tuesday': 'Tuesday', 'tuesdays': 'Tuesday', 'tue': 'Tuesday', 'tues': 'Tuesday', 'tu': 'Tuesday',
    // Wednesday
    'wednesday': 'Wednesday', 'wednesdays': 'Wednesday', 'wed': 'Wednesday', 'we': 'Wednesday',
    // Thursday
    'thursday': 'Thursday', 'thursdays': 'Thursday', 'thu': 'Thursday', 'thur': 'Thursday', 'th': 'Thursday',
    // Friday
    'friday': 'Friday', 'fridays': 'Friday', 'fri': 'Friday', 'fr': 'Friday',
    // Saturday
    'saturday': 'Saturday', 'saturdays': 'Saturday', 'sat': 'Saturday', 'sa': 'Saturday',
    // Sunday
    'sunday': 'Sunday', 'sundays': 'Sunday', 'sun': 'Sunday', 'su': 'Sunday'
};

// Month name mappings
const MONTH_MAPPINGS: { [key: string]: number } = {
    'january': 1, 'jan': 1,
    'february': 2, 'feb': 2,
    'march': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'may': 5,
    'june': 6, 'jun': 6,
    'july': 7, 'jul': 7,
    'august': 8, 'aug': 8,
    'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10,
    'november': 11, 'nov': 11,
    'december': 12, 'dec': 12
};

// Time parsing patterns - keep original format but extract times
const TIME_PATTERNS = [
    // 7pm, 9:50pm, 2-4pm, 19:00-21:50
    /(\d{1,2}):?(\d{0,2})\s*(am|pm|AM|PM)?\s*[-–—to]*\s*(\d{1,2}):?(\d{0,2})\s*(am|pm|AM|PM)?/g,
    // Single time: 7pm, 19:00
    /(\d{1,2}):?(\d{0,2})\s*(am|pm|AM|PM)?/g,
    // Time ranges with "from...to": from 2pm to 4pm
    /from\s+(\d{1,2}):?(\d{0,2})\s*(am|pm|AM|PM)?\s+to\s+(\d{1,2}):?(\d{0,2})\s*(am|pm|AM|PM)?/gi,
    // Time ranges with "at": at 2-4pm
    /at\s+(\d{1,2}):?(\d{0,2})\s*(am|pm|AM|PM)?\s*[-–—]\s*(\d{1,2}):?(\d{0,2})\s*(am|pm|AM|PM)?/gi,
];

// Subject/class keywords that help identify course titles
const CLASS_KEYWORDS = [
    'lecture', 'class', 'lab', 'tutorial', 'seminar', 'workshop', 'course',
    'calculus', 'physics', 'chemistry', 'biology', 'math', 'english', 'history',
    'programming', 'computer science', 'philosophy', 'psychology', 'economics',
    'midterm', 'final', 'exam', 'test', 'quiz', 'assignment', 'project', 'homework', 'hw'
];

function extractCourseCode(text: string): string | null {
    for (const pattern of COURSE_CODE_PATTERNS) {
        pattern.lastIndex = 0; // Reset regex state
        const match = pattern.exec(text);
        if (match) {
            // Normalize the course code format
            if (match.length >= 3) {
                // Pattern with captured groups: letters and numbers
                const letters = match[1];
                const numbers = match[2];
                return `${letters} ${numbers}`.toUpperCase();
            } else {
                // Fallback for full match
                return match[0].replace(/(\D+)(\d+)/, '$1 $2').toUpperCase();
            }
        }
    }
    return null;
}

function extractDays(text: string): string[] {
    const days: string[] = [];
    const lowerText = text.toLowerCase();

    // Look for day names in the text
    for (const [key, value] of Object.entries(DAY_MAPPINGS)) {
        const regex = new RegExp(`\\b${key}\\b`, 'i');
        if (regex.test(lowerText)) {
            if (!days.includes(value)) {
                days.push(value);
            }
        }
    }

    return days;
}

function extractDate(text: string): string | null {
    const lowerText = text.toLowerCase();
    const currentYear = new Date().getFullYear();

    // Try different date patterns

    // Pattern 1: "Month Day" (e.g., "June 18", "December 25")
    const monthDayPattern = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})\b/i;
    const monthDayMatch = lowerText.match(monthDayPattern);
    if (monthDayMatch) {
        const monthStr = monthDayMatch[1].toLowerCase();
        const day = parseInt(monthDayMatch[2]);
        const month = MONTH_MAPPINGS[monthStr];

        if (month && day >= 1 && day <= 31) {
            // Check if date has passed this year, if so assume next year
            const targetDate = new Date(currentYear, month - 1, day);
            const today = new Date();
            const year = targetDate < today ? currentYear + 1 : currentYear;

            return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
    }

    // Pattern 2: "MM/DD" or "MM-DD"
    const numericPattern = /\b(\d{1,2})[\/\-](\d{1,2})\b/;
    const numericMatch = text.match(numericPattern);
    if (numericMatch) {
        const month = parseInt(numericMatch[1]);
        const day = parseInt(numericMatch[2]);

        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            // Check if date has passed this year, if so assume next year
            const targetDate = new Date(currentYear, month - 1, day);
            const today = new Date();
            const year = targetDate < today ? currentYear + 1 : currentYear;

            return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
    }

    // Pattern 3: "MM/DD/YYYY" or "MM-DD-YYYY"
    const fullDatePattern = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/;
    const fullDateMatch = text.match(fullDatePattern);
    if (fullDateMatch) {
        const month = parseInt(fullDateMatch[1]);
        const day = parseInt(fullDateMatch[2]);
        let year = parseInt(fullDateMatch[3]);

        // Handle 2-digit years
        if (year < 100) {
            year = year < 50 ? 2000 + year : 1900 + year;
        }

        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020) {
            return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
    }

    return null;
}

function parseTime(timeStr: string): { start: string, end: string } | null {
    // Handle "from X to Y" format
    const fromToMatch = timeStr.match(/from\s+(\d{1,2}):?(\d{0,2})\s*(am|pm|AM|PM)?\s+to\s+(\d{1,2}):?(\d{0,2})\s*(am|pm|AM|PM)?/i);
    if (fromToMatch) {
        const [, startHour, startMin = '', startAmPm = '', endHour, endMin = '', endAmPm = ''] = fromToMatch;
        const startTime = convertTo24Hour(startHour, startMin, startAmPm || endAmPm);
        const endTime = convertTo24Hour(endHour, endMin, endAmPm || startAmPm);
        return { start: startTime, end: endTime };
    }

    // Handle "at X-Y" format
    const atMatch = timeStr.match(/at\s+(\d{1,2}):?(\d{0,2})\s*(am|pm|AM|PM)?\s*[-–—]\s*(\d{1,2}):?(\d{0,2})\s*(am|pm|AM|PM)?/i);
    if (atMatch) {
        const [, startHour, startMin = '', startAmPm = '', endHour, endMin = '', endAmPm = ''] = atMatch;
        const startTime = convertTo24Hour(startHour, startMin, startAmPm || endAmPm);
        const endTime = convertTo24Hour(endHour, endMin, endAmPm || startAmPm);
        return { start: startTime, end: endTime };
    }

    // Handle ranges like "2-4pm", "7pm-9:50pm", "19:00-21:50"
    const rangeMatch = timeStr.match(/(\d{1,2}):?(\d{0,2})\s*(am|pm|AM|PM)?\s*[-–—to]+\s*(\d{1,2}):?(\d{0,2})\s*(am|pm|AM|PM)?/i);
    if (rangeMatch) {
        const [, startHour, startMin = '', startAmPm = '', endHour, endMin = '', endAmPm = ''] = rangeMatch;
        const startTime = convertTo24Hour(startHour, startMin, startAmPm || endAmPm);
        const endTime = convertTo24Hour(endHour, endMin, endAmPm || startAmPm);
        return { start: startTime, end: endTime };
    }

    return null;
}

function convertTo24Hour(hour: string, minute: string = '', ampm: string = ''): string {
    let h = parseInt(hour);
    const m = minute ? parseInt(minute) : 0;

    if (ampm.toLowerCase().includes('pm') && h !== 12) {
        h += 12;
    } else if (ampm.toLowerCase().includes('am') && h === 12) {
        h = 0;
    }

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatTime12Hour(timeString: string): string {
    const [hours, minutes] = timeString.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
}

function generateTitle(courseCode: string | null, text: string): string {
    if (courseCode) {
        // Check if it already says "lecture", "lab", etc.
        const lowerText = text.toLowerCase();
        const hasType = CLASS_KEYWORDS.some(keyword => lowerText.includes(keyword));

        if (hasType) {
            // Extract the type
            for (const keyword of CLASS_KEYWORDS) {
                if (lowerText.includes(keyword)) {
                    return `${courseCode} ${keyword.charAt(0).toUpperCase() + keyword.slice(1)}`;
                }
            }
        }

        return `${courseCode} Lecture`; // Default to lecture
    }

    // Try to extract a meaningful title from the text
    const lowerText = text.toLowerCase();
    for (const keyword of CLASS_KEYWORDS) {
        if (lowerText.includes(keyword)) {
            return keyword.charAt(0).toUpperCase() + keyword.slice(1);
        }
    }

    return 'Class'; // Generic fallback
}

export function parseNaturalLanguage(input: string): ParseResult {
    try {
  

        const courseCode = extractCourseCode(input);
        const days = extractDays(input);
        const specificDate = extractDate(input);
        const title = generateTitle(courseCode, input);

  

        // Find time ranges in the input using all patterns
        let timeMatches: RegExpMatchArray[] = [];

        // Try each time pattern
        for (const pattern of TIME_PATTERNS) {
            pattern.lastIndex = 0; // Reset regex state
            const matches = Array.from(input.matchAll(pattern));
            timeMatches.push(...matches);
        }

  

        // If no time matches found, try to extract a single time and assume duration
        if (timeMatches.length === 0) {
            const singleTimeMatch = input.match(/(\d{1,2}):?(\d{0,2})\s*(am|pm|AM|PM)?/i);
            if (singleTimeMatch) {
                const [, hour, minute = '', ampm = ''] = singleTimeMatch;
                const startTime = convertTo24Hour(hour, minute, ampm);

                // Smart duration: if it's a common class time, use appropriate duration
                let duration = 1; // Default 1 hour
                const hourNum = parseInt(hour);
                if (ampm.toLowerCase().includes('pm') || hourNum >= 14) {
                    duration = 2; // Evening classes are often 2+ hours
                }

                const endHour = (parseInt(startTime.split(':')[0]) + duration).toString().padStart(2, '0');
                const endTime = `${endHour}:${startTime.split(':')[1]}`;

                // Create events based on whether we have a specific date or days
                const events: ParsedEvent[] = [];

                if (specificDate) {
                    // Specific date event
                    events.push({
                        title,
                        start_date: specificDate,
                        end_date: specificDate,
                        start_time: startTime,
                        end_time: endTime,
                        confidence: 0.8
                    });
                } else if (days.length > 0) {
                    // Recurring weekly events
                    for (const day of days) {
                        events.push({
                            title,
                            day_of_week: day,
                            start_time: startTime,
                            end_time: endTime,
                            confidence: 0.7
                        });
                    }
                }

                if (events.length > 0) {
                    const timeStr = specificDate ?
                        `${specificDate} from ${formatTime12Hour(startTime)} to ${formatTime12Hour(endTime)}` :
                        `${days.join(' and ')} from ${formatTime12Hour(startTime)} to ${formatTime12Hour(endTime)}`;

                    return {
                        success: true,
                        events,
                        confirmation: `Added ${title} on ${timeStr} (assumed ${duration} hour duration)`
                    };
                }
            }

            return {
                success: false,
                events: [],
                error: 'Could not parse time from input. Try formats like:\n• "7pm-8:20pm" or "19:00-20:20"\n• "from 7pm to 8:20pm"\n• "at 7-8pm"\n• "June 18 7pm" (will assume duration)'
            };
        }

        // If we don't have either days or a specific date, return error
        if (days.length === 0 && !specificDate) {
            return {
                success: false,
                events: [],
                error: 'Could not identify when this event should occur. Try specifying:\n• Specific dates: "June 18", "12/25", "6/18"\n• Recurring days: "Mondays", "Wed", "Tuesdays and Thursdays"\n• Multiple days: "Mondays and Wednesdays"'
            };
        }

        const events: ParsedEvent[] = [];

        for (const timeMatch of timeMatches) {
            const timeRange = parseTime(timeMatch[0]);
            if (timeRange) {
                if (specificDate) {
                    // Create specific date event
                    events.push({
                        title,
                        start_date: specificDate,
                        end_date: specificDate,
                        start_time: timeRange.start,
                        end_time: timeRange.end,
                        confidence: 0.9
                    });
                } else {
                    // Create recurring weekly events for each day
                    for (const day of days) {
                        events.push({
                            title,
                            day_of_week: day,
                            start_time: timeRange.start,
                            end_time: timeRange.end,
                            confidence: 0.9
                        });
                    }
                }
            }
        }

        if (events.length === 0) {
            return {
                success: false,
                events: [],
                error: 'Could not parse time range. Try format like "7pm-8:20pm" or "19:00-20:20"'
            };
        }

        // Generate confirmation message
        const timeExample = events[0];
        let whenStr = '';

        if (specificDate) {
            const dateObj = new Date(specificDate + 'T00:00:00');
            const dateStr = dateObj.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            whenStr = dateStr;
        } else {
            const daysList = [...new Set(events.map(e => e.day_of_week))];
            whenStr = daysList.join(' and ');
        }

        return {
            success: true,
            events,
            confirmation: `Added ${title} on ${whenStr} from ${formatTime12Hour(timeExample.start_time)} to ${formatTime12Hour(timeExample.end_time)}`
        };

    } catch (error) {
        console.error('Error parsing natural language:', error);
        return {
            success: false,
            events: [],
            error: 'Failed to parse input. Try format like "add ITI 1121 midterm June 18 7pm-8:20pm"'
        };
    }
}

// Check if input looks like natural language (vs JSON)
export function isNaturalLanguage(input: string): boolean {
    const trimmed = input.trim();

    // If it starts with { and ends with }, it's probably JSON
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return false;
    }

    // If it contains "action" and "create_calendar_event", it's JSON
    if (trimmed.includes('"action"') && trimmed.includes('create_calendar_event')) {
        return false;
    }

    // If it contains common natural language words, it's natural language
    const naturalLanguageIndicators = [
        'add', 'schedule', 'create', 'put', 'my', 'class', 'lecture', 'course',
        'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
        'pm', 'am', 'to', 'from', 'june', 'july', 'august', 'september', 'october',
        'november', 'december', 'january', 'february', 'march', 'april', 'may'
    ];

    const lowerInput = trimmed.toLowerCase();
    return naturalLanguageIndicators.some(indicator => lowerInput.includes(indicator));
} 