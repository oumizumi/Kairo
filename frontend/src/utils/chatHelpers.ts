/**
 * Chat Helper Utilities
 * Helper functions for chat and course management
 */

import { DailyCalendarEvent } from '@/types/chat';

/**
 * Simple debounce utility for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout;
    return ((...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(null, args), wait);
    }) as T;
}

/**
 * Helper function to extract term from event
 */
export const extractTermFromEvent = (event: DailyCalendarEvent): string => {
    // Debug logging
    console.log('🔍 Extracting term from event:', {
        title: event.title,
        description: event.description,
        term: event.term,
        start_date: event.start_date,
        day_of_week: event.day_of_week
    });

    // First try to get term from event.term property
    if (event.term) {
        return event.term;
    }

    // Try to extract from description
    if (event.description) {
        const termMatch = event.description.match(/(Fall|Winter|Spring|Summer)\s+(\d{4})/i);
        if (termMatch) {
            const term = `${termMatch[1]} ${termMatch[2]}`;
            console.log('✅ Found term in description:', term);
            return term;
        }
    }

    // Try to extract from title
    if (event.title) {
        const termMatch = event.title.match(/(Fall|Winter|Spring|Summer)\s+(\d{4})/i);
        if (termMatch) {
            const term = `${termMatch[1]} ${termMatch[2]}`;
            console.log('✅ Found term in title:', term);
            return term;
        }
    }

    // Improved date-based term detection
    if (event.start_date) {
        const eventDate = new Date(event.start_date);
        const year = eventDate.getFullYear();
        const month = eventDate.getMonth(); // 0-based (0 = January)

        let term;
        // Academic year logic:
        // Fall: September (8) - December (11)
        // Winter: January (0) - April (3) 
        // Spring/Summer: May (4) - August (7)
        if (month >= 8 && month <= 11) { // Sep-Dec
            term = `Fall ${year}`;
        } else if (month >= 0 && month <= 3) { // Jan-Apr
            term = `Winter ${year}`;
        } else if (month >= 4 && month <= 5) { // May-Jun
            term = `Spring ${year}`;
        } else { // Jul-Aug
            term = `Summer ${year}`;
        }
        console.log('📅 Guessed term from date:', term, 'for month:', month);
        return term;
    }

    // For events without dates, try to create variety based on course code
    if (event.title) {
        const courseMatch = event.title.match(/([A-Z]{3}\s*\d{4})/);
        if (courseMatch) {
            const courseCode = courseMatch[1];
            // Use course code hash to distribute across terms
            const hash = courseCode.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);

            const terms = ['Fall 2025', 'Winter 2026', 'Spring 2026', 'Summer 2026'];
            const selectedTerm = terms[Math.abs(hash) % terms.length];
            console.log('🎲 Assigned term based on course hash:', selectedTerm, 'for', courseCode);
            return selectedTerm;
        }
    }

    // Final fallback - return Fall 2025 as default
    const fallbackTerm = 'Fall 2025';
    console.log('🎯 Using fallback term:', fallbackTerm);
    return fallbackTerm;
};

/**
 * Helper function to extract course code from event title
 */
export const extractCourseCodeFromEvent = (event: DailyCalendarEvent): string => {
    const courseMatch = event.title?.match(/([A-Z]{3}\s*\d{4})/);
    return courseMatch ? courseMatch[1].replace(/\s+/g, ' ').trim() : event.title || 'Unknown Course';
};

/**
 * Extract course codes from text
 */
export function extractCourseCodesFromText(text: string): string[] {
    const coursePatterns = [
        /\b([A-Z]{3})\s*(\d{4})\b/g, // CSI 2110 or CSI2110
        /\b([A-Z]{3})(\d{4})\b/g     // CSI2110
    ];

    const courseCodes: string[] = [];

    coursePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const courseCode = `${match[1]} ${match[2]}`; // Always format with space
            if (!courseCodes.includes(courseCode)) {
                courseCodes.push(courseCode);
            }
        }
    });

    return courseCodes;
}

/**
 * Check if input is a professor comparison question
 */
export function isProfessorComparisonQuestion(userInput: string): boolean {
    const patterns = [
        /who('?s| is) the best professor for ([a-z]{3}\d{4})/i,
        /which prof(essor)? is better for ([a-z]{3}\d{4})/i,
        /who should i take for ([a-z]{3}\d{4})/i,
        /best prof(essor)? for ([a-z]{3}\d{4})/i,
        /professor recommendation for ([a-z]{3}\d{4})/i,
    ];
    return patterns.some(pattern => pattern.test(userInput));
}

/**
 * Extract course code from input
 */
export function extractCourseCode(userInput: string): string | null {
    const match = userInput.match(/([a-z]{3}\d{4})/i);
    return match ? match[1].toLowerCase() : null;
}

/**
 * Check if input is a curriculum question
 */
export function isCurriculumQuestion(userInput: string): boolean {
    const normalizedInput = userInput.toLowerCase();

    // EXPLICIT curriculum sequence keywords that indicate user wants course sequence info
    const explicitCurriculumKeywords = [
        'course sequence', 'curriculum', 'what courses should i take', 'what should i take',
        'course requirements', 'required courses', 'program requirements', 'course list',
        'what classes should i take', 'what are the courses', 'courses for', 'sequence for',
        'course plan', 'academic plan', 'degree requirements', 'program requirements',
        'what courses', 'which courses', 'course structure', 'program structure'
    ];

    // Check for explicit curriculum questions FIRST (highest priority)
    const hasExplicitCurriculumKeyword = explicitCurriculumKeywords.some(keyword =>
        normalizedInput.includes(keyword)
    );

    if (hasExplicitCurriculumKeyword) {
        return true;
    }

    // Enhanced pattern detection for curriculum requests
    const yearSequencePattern = /\b(first|second|third|fourth|1st|2nd|3rd|4th|year \d+)\s+(year\s+)?course\s+sequence\s+for/i;
    if (yearSequencePattern.test(normalizedInput)) {
        return true;
    }

    const sequenceForYearPattern = /course\s+sequence\s+for\s+\b(first|second|third|fourth|1st|2nd|3rd|4th|year \d+)\s+year/i;
    if (sequenceForYearPattern.test(normalizedInput)) {
        return true;
    }

    const whatsTheSequencePattern = /(what'?s?\s+the|show\s+me\s+the|give\s+me\s+the).*\b(first|second|third|fourth|1st|2nd|3rd|4th|year \d+)\s+(year\s+)?course\s+sequence/i;
    if (whatsTheSequencePattern.test(normalizedInput)) {
        return true;
    }

    const hasYearKeywords = /\b(first|second|third|fourth|1st|2nd|3rd|4th|year \d+)\s+year/i.test(normalizedInput);
    const hasSequenceKeywords = /(course\s+sequence|curriculum|courses|requirements)/i.test(normalizedInput);

    if (hasYearKeywords && hasSequenceKeywords) {
        const hasProgramKeywords = /(seg|cs|csi|ceg|elg|mcg|cvg|chg|dsi|engineering|computer|software|mechanical|electrical|civil|chemical|data\s+science|management|mgmt|honours|major|minor|joint|bhk|bhsc|nursing|psychology|criminology|anthropology|sociology|economics|political\s+science|poli\s+sci|biology|physics|chemistry|mathematics|math|philosophy|history|english|geography|geology|kinesiology|human\s+kinetics|social\s+work|public\s+administration|communication|journalism|law|business|finance|accounting|marketing|science|studies|bachelor|degree|program)/i.test(normalizedInput);

        if (hasProgramKeywords) {
            return true;
        }
    }

    const hasGeneralProgramPattern = /(engineering|computer|software|mechanical|electrical|civil|chemical|data|nursing|psychology|criminology|anthropology|sociology|economics|political|biology|physics|chemistry|mathematics|math|philosophy|history|english|kinesiology|social|public|communication|business|science|studies).*(courses|curriculum|sequence|requirements|schedule)/i.test(normalizedInput);
    if (hasGeneralProgramPattern) {
        return true;
    }

    const scheduleGenerationPattern = /(create|generate|build|make|plan|show).*(schedule|timetable).*(first|second|third|fourth|1st|2nd|3rd|4th|year \d+)\s+(year\s+)?(fall|winter|spring|summer)?/i.test(normalizedInput) ||
        /(create|generate|build|make|plan|show).*(first|second|third|fourth|1st|2nd|3rd|4th|year \d+)\s+(year\s+)?(fall|winter|spring|summer)?\s+(schedule|timetable)/i.test(normalizedInput) ||
        /(first|second|third|fourth|1st|2nd|3rd|4th|year \d+)\s+(year\s+)?(fall|winter|spring|summer)?\s+(schedule|timetable)/i.test(normalizedInput);
    if (scheduleGenerationPattern) {
        return true;
    }

    const curriculumPatterns = [
        /\b(first|second|third|fourth|1st|2nd|3rd|4th|year \d)\s+year\s+.*(courses|curriculum|requirements)/i,
        /what.*courses.*\b(first|second|third|fourth|1st|2nd|3rd|4th|year \d)\s+year/i,
        /(courses|curriculum|requirements).*\b(first|second|third|fourth|1st|2nd|3rd|4th|year \d)\s+year/i,
        /(fall|winter|summer|spring).*\b(first|second|third|fourth|1st|2nd|3rd|4th|year \d)\s+year.*(courses|curriculum)/i
    ];

    const matchesCurriculumPattern = curriculumPatterns.some(pattern => pattern.test(userInput));

    return matchesCurriculumPattern;
}

/**
 * Check if input is an individual course deletion request
 */
export function isIndividualCourseDeletionRequest(userInput: string): boolean {
    const deletionKeywords = [
        'remove', 'delete', 'clear', 'drop', 'cancel', 'unschedule'
    ];

    const coursePatterns = [
        /\b[A-Z]{3}\s*\d{4}\b/g, // CSI 2110 or CSI2110
        /\b[A-Z]{3}\d{4}\b/g     // CSI2110
    ];

    const normalizedInput = userInput.toLowerCase();

    const hasDeletionKeyword = deletionKeywords.some(keyword => normalizedInput.includes(keyword));
    const hasCourseCode = coursePatterns.some(pattern => pattern.exec(userInput));

    return hasDeletionKeyword && hasCourseCode;
}

/**
 * Check if input is a course availability question
 */
export function isCourseAvailabilityQuestion(userInput: string): boolean {
    const normalizedInput = userInput.toLowerCase();

    const availabilityKeywords = [
        'is available', 'available', 'offered', 'is offered', 'can i take',
        'does', 'do they have', 'do you have', 'is there', 'are there',
        'when is', 'what term', 'which term', 'which semester', 'what semester'
    ];

    const termKeywords = [
        'fall', 'winter', 'summer', 'spring', 'term', 'semester',
        '2025', '2026', 'next term', 'this term'
    ];

    const hasCourseCode = /\b[A-Z]{3}\s*\d{4}\b/i.test(userInput);
    const hasAvailabilityKeyword = availabilityKeywords.some(keyword =>
        normalizedInput.includes(keyword)
    );
    const hasTermKeyword = termKeywords.some(keyword =>
        normalizedInput.includes(keyword)
    );

    return hasCourseCode && (hasAvailabilityKeyword || hasTermKeyword);
}

/**
 * Check course availability using scraped data
 */
export async function checkCourseAvailability(courseCode: string, term?: string): Promise<{
    available: boolean;
    availableTerms: string[];
    message: string;
}> {
    try {
        const termFiles = [
            '/all_courses_fall_2025.json',
            '/all_courses_winter_2026.json',
            '/all_courses_spring_summer_2025.json'
        ];

        const availableTerms: string[] = [];
        let courseFound = false;

        for (const file of termFiles) {
            try {
                const response = await fetch(file);
                if (response.ok) {
                    const data = await response.json();
                    const courses = data.courses || data;

                    const found = courses.some((course: any) => {
                        const normalizedCourseCode = course.courseCode?.replace(/\s+/g, '').toLowerCase();
                        const normalizedSearchCode = courseCode.replace(/\s+/g, '').toLowerCase();
                        return normalizedCourseCode === normalizedSearchCode;
                    });

                    if (found) {
                        courseFound = true;
                        if (file.includes('fall')) availableTerms.push('Fall 2025');
                        if (file.includes('winter')) availableTerms.push('Winter 2026');
                        if (file.includes('spring_summer')) availableTerms.push('Spring/Summer 2025');
                    }
                }
            } catch (error) {
                console.error(`Error loading ${file}:`, error);
            }
        }

        if (courseFound) {
            const termsList = availableTerms.join(', ');
            return {
                available: true,
                availableTerms,
                message: `**${courseCode}** is available in: **${termsList}**. Check Kairoll for sections and schedules.`
            };
        } else {
            return {
                available: false,
                availableTerms: [],
                message: `**${courseCode}** not found in current offerings (Fall 2025, Winter 2026, Spring/Summer 2025). Check Kairoll for updated listings.`
            };
        }
    } catch (error) {
        console.error('Error checking course availability:', error);
        return {
            available: false,
            availableTerms: [],
            message: `Unable to access course database. Check Kairoll directly.`
        };
    }
}

/**
 * Determine if Kairo should provide an honest "I don't know" response
 */
export function shouldProvideHonestResponse(userInput: string): { shouldRespond: boolean; response?: string } {
    const normalizedInput = userInput.toLowerCase().trim();

    // Handle basic conversational/identity questions
    const basicConversationalQuestions = [
        /(?:what|whats|what's).*(?:your|yo|ur).*name/i,
        /(?:who|what).*are.*you/i,
        /(?:introduce.*yourself|tell.*about.*yourself)/i,
        /^(hi|hello|hey|howdy|good morning|good afternoon|good evening)$/i,
        /^(thanks|thank you|thx|ty)$/i,
        /^(bye|goodbye|see you|talk later)$/i,
        /^(ok|okay|alright|sure|cool)$/i,
        /(?:what.*can.*you.*do|how.*can.*you.*help|what.*are.*you.*for)/i,
        /(?:what.*is.*kairo|tell.*about.*kairo)/i,
    ];

    for (const pattern of basicConversationalQuestions) {
        if (pattern.test(normalizedInput)) {
            if (/(?:what|whats|what's).*(?:your|yo|ur).*name/i.test(normalizedInput) ||
                /(?:who|what).*are.*you/i.test(normalizedInput)) {
                return {
                    shouldRespond: true,
                    response: "I'm Kairo. I help with course scheduling and academic planning."
                };
            }

            if (/(?:what.*can.*you.*do|how.*can.*you.*help|what.*are.*you.*for)/i.test(normalizedInput)) {
                return {
                    shouldRespond: true,
                    response: "I can help with scheduling, course info, prerequisites, and academic planning."
                };
            }

            return {
                shouldRespond: true,
                response: "Hey! How can I help you with your schedule?"
            };
        }
    }

    // Define what Kairo CAN help with
    const kairosCapabilities = [
        'course', 'class', 'schedule', 'timetable', 'curriculum', 'program',
        'semester', 'term', 'fall', 'winter', 'summer', 'spring',
        'professor', 'instructor', 'teacher', 'section', 'enrollment',
        'calendar', 'event', 'appointment', 'meeting', 'time', 'date',
        'reminder', 'deadline', 'exam', 'assignment',
        'uottawa', 'university of ottawa', 'ottawa u', 'gee gees',
        'engineering', 'computer science', 'cs', 'math', 'mathematics',
        'political science', 'economics', 'psychology', 'criminology',
        'degree', 'major', 'minor', 'honours', 'joint', 'elective',
        'prerequisite', 'corequisite', 'credit', 'unit', 'gpa',
        'generate', 'create', 'make', 'build', 'plan', 'organize', 'do', 'help', 'assist'
    ];

    // Topics outside Kairo's scope
    const outsideScope = [
        /what is|what are|define|explain.*(?:concept|theory|principle)/i,
        /how does.*work/i,
        /why is|why are|why do|why does/i,
        /when was|when did|when will/i,
        /where is|where are|where can/i,
        /who is|who are|who was/i,
        /weather|climate|temperature/i,
        /news|politics|current events/i,
        /sports|games|entertainment/i,
        /health|medical|doctor|medicine/i,
        /cooking|recipe|food/i,
        /travel|vacation|trip/i,
        /shopping|buy|purchase|price/i,
        /technology.*(?:general|how to|tutorial)/i,
        /should i|what should|advice|recommend.*(?:life|career|personal)/i,
        /relationship|dating|friendship/i,
        /financial|money|investment|loan/i,
        /solve.*(?:equation|problem|math)/i,
        /write.*(?:essay|paper|report)/i,
        /research.*(?:topic|paper|thesis)/i,
        /homework|assignment.*help/i,
        /computer.*(?:problem|issue|error)/i,
        /software.*(?:install|download|fix)/i,
        /internet|wifi|connection/i,
        /legal|law|lawyer|attorney/i,
        /immigration|visa|permit/i,
        /tax|taxes|filing/i
    ];

    const isOutsideScope = outsideScope.some(pattern => pattern.test(normalizedInput));

    if (isOutsideScope) {
        return { shouldRespond: false };
    }

    const hasAcademicKeywords = kairosCapabilities.some(keyword =>
        normalizedInput.includes(keyword)
    );

    if (hasAcademicKeywords) {
        return { shouldRespond: false };
    }

    const complexQuestionPatterns = [
        /\?$/,
        /tell me|show me|help me|explain/i
    ];

    const seemsLikeComplexQuestion = complexQuestionPatterns.some(pattern => pattern.test(normalizedInput)) && normalizedInput.length > 10;

    if (seemsLikeComplexQuestion) {
        return {
            shouldRespond: true,
            response: "I can't help with that. I'm focused on course scheduling and academic planning."
        };
    }

    return { shouldRespond: false };
}

/**
 * Parse event description for mobile modal
 */
export function parseEventDescription(description: string | undefined) {
    if (!description) {
        return { courseTitle: '', section: '', instructor: '' };
    }
    const lines = description.split('\n');
    const courseTitle = lines.find(l => l.startsWith('Title:'))?.replace('Title: ', '') || '';
    const section = lines.find(l => l.startsWith('Section:'))?.replace('Section: ', '') || '';
    const instructor = lines.find(l => l.startsWith('Instructor:'))?.replace('Instructor: ', '') || '';
    return { courseTitle, section, instructor };
}

