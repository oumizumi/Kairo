import { parseISO, isAfter, isBefore, isEqual, format } from 'date-fns';

// Fall 2025 academic term dates
export const FALL_2025_DATES = {
    TERM_START: '2025-09-03',
    TERM_END: '2025-12-02',
    READING_WEEK_START: '2025-10-12',
    READING_WEEK_END: '2025-10-18'
};

// Winter 2026 academic term dates
export const WINTER_2026_DATES = {
    TERM_START: '2026-01-12',
    TERM_END: '2026-04-15',
    READING_WEEK_START: '2026-02-15',
    READING_WEEK_END: '2026-02-21'
};

// Spring/Summer 2025 academic term dates
export const SPRING_SUMMER_2025_DATES = {
    TERM_START: '2025-05-06',
    TERM_END: '2025-08-15'
};

/**
 * Validates if a date falls within the Fall 2025 academic term
 * Excludes reading week (Oct 12-18, 2025)
 */
export function isValidFallDate(dateString: string): boolean {
    const date = parseISO(dateString);
    const termStart = parseISO(FALL_2025_DATES.TERM_START);
    const termEnd = parseISO(FALL_2025_DATES.TERM_END);
    const readingWeekStart = parseISO(FALL_2025_DATES.READING_WEEK_START);
    const readingWeekEnd = parseISO(FALL_2025_DATES.READING_WEEK_END);

    // Check if date is within term bounds
    const isWithinTerm = (isEqual(date, termStart) || isAfter(date, termStart)) &&
        (isEqual(date, termEnd) || isBefore(date, termEnd));

    // Check if date is NOT during reading week
    const isNotReadingWeek = isBefore(date, readingWeekStart) || isAfter(date, readingWeekEnd);

    return isWithinTerm && isNotReadingWeek;
}

/**
 * Validates if a date falls within the Winter 2026 academic term
 * Excludes reading week (Feb 15-21, 2026)
 */
export function isValidWinterDate(dateString: string): boolean {
    const date = parseISO(dateString);
    const termStart = parseISO(WINTER_2026_DATES.TERM_START);
    const termEnd = parseISO(WINTER_2026_DATES.TERM_END);
    const readingWeekStart = parseISO(WINTER_2026_DATES.READING_WEEK_START);
    const readingWeekEnd = parseISO(WINTER_2026_DATES.READING_WEEK_END);

    // Check if date is within term bounds
    const isWithinTerm = (isEqual(date, termStart) || isAfter(date, termStart)) &&
        (isEqual(date, termEnd) || isBefore(date, termEnd));

    // Check if date is NOT during reading week
    const isNotReadingWeek = isBefore(date, readingWeekStart) || isAfter(date, readingWeekEnd);

    return isWithinTerm && isNotReadingWeek;
}

/**
 * Validates if a date falls within the Spring/Summer 2025 academic term
 */
export function isValidSpringSummerDate(dateString: string): boolean {
    const date = parseISO(dateString);
    const termStart = parseISO(SPRING_SUMMER_2025_DATES.TERM_START);
    const termEnd = parseISO(SPRING_SUMMER_2025_DATES.TERM_END);

    return (isEqual(date, termStart) || isAfter(date, termStart)) &&
        (isEqual(date, termEnd) || isBefore(date, termEnd));
}

/**
 * Gets the proper academic term dates for a given term
 */
export function getAcademicTermDates(term: string): { start: string; end: string } {
    const termMap: { [key: string]: { start: string; end: string } } = {
        "2025 Fall Term": { start: FALL_2025_DATES.TERM_START, end: FALL_2025_DATES.TERM_END },
        "2026 Winter Term": { start: WINTER_2026_DATES.TERM_START, end: WINTER_2026_DATES.TERM_END },
        "2025 Spring/Summer Term": { start: SPRING_SUMMER_2025_DATES.TERM_START, end: SPRING_SUMMER_2025_DATES.TERM_END }
    };
    return termMap[term] || { start: FALL_2025_DATES.TERM_START, end: FALL_2025_DATES.TERM_END };
}

/**
 * Validates if a date is valid for the given academic term
 */
export function isValidDateForTerm(dateString: string, term: string): boolean {
    switch (term) {
        case "2025 Fall Term":
            return isValidFallDate(dateString);
        case "2026 Winter Term":
            return isValidWinterDate(dateString);
        case "2025 Spring/Summer Term":
            return isValidSpringSummerDate(dateString);
        default:
            return isValidFallDate(dateString); // Default to Fall validation
    }
}

/**
 * Gets a list of all valid dates for a term (excluding reading week for Fall)
 * Useful for generating recurring events
 */
export function getValidDatesForTerm(term: string): string[] {
    const { start, end } = getAcademicTermDates(term);
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    const validDates: string[] = [];

    let currentDate = startDate;
    while (isBefore(currentDate, endDate) || isEqual(currentDate, endDate)) {
        const dateString = format(currentDate, 'yyyy-MM-dd');
        if (isValidDateForTerm(dateString, term)) {
            validDates.push(dateString);
        }
        // Move to next day
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    }

    return validDates;
}

/**
 * Checks if a course should be displayed on a specific date
 * This is the main function to use when filtering calendar events
 */
export function shouldDisplayCourseOnDate(dateString: string, term: string): boolean {
    return isValidDateForTerm(dateString, term);
} 