/**
 * Natural Conversation Service
 * Handles course queries and conversational responses in a natural, non-robotic way
 */

import { loadCoursesForTerm, getCourseDetails } from './courseDataService';
import { CourseGrouped, CourseLegacy, isCourseGrouped } from '@/types/course';
import { APP_CONFIG } from '@/config/app.config';
import { normalizeCourseCode } from '@/config/course.config';

// Complete course data interface from the JSON
interface CompleteCourseData {
    courseCode: string;
    courseTitle: string;
    units: string;
    description: string;
    prerequisites: string;
}

export interface ConversationResponse {
    type: 'course_info' | 'terms' | 'prerequisites' | 'description' | 'schedule' | 'general' | 'not_found';
    message: string;
    data?: any;
    followUp?: string[];
}

export interface CourseInfo {
    code: string;
    title: string;
    description?: string;
    prerequisites?: string[];
    credits?: number;
    terms: string[];
    sections: {
        lectures: number;
        labs: number;
        tutorials: number;
    };
}

class ConversationService {
    private courseCache = new Map<string, (CourseGrouped | CourseLegacy)[]>();
    private completeCourseData: Map<string, CompleteCourseData> = new Map();
    private completeCourseDataLoaded = false;

    // Load complete course data with descriptions and prerequisites
    private async loadCompleteCourseData(): Promise<void> {
        if (this.completeCourseDataLoaded) return;

        try {
            // Note: This would need to be served from the backend API
            // For now, we'll handle the case where it's not available
            const response = await fetch('/api/data/courses-complete/');
            if (!response.ok) {
                console.warn('Complete course data not available via API');
                return;
            }

            const data: Record<string, CompleteCourseData[]> = await response.json();

            // Flatten the data and index by course code
            for (const subject of Object.keys(data)) {
                for (const course of data[subject]) {
                    // Normalize course code for consistent lookup
                    const normalizedCode = this.normalizeForLookup(course.courseCode);
                    this.completeCourseData.set(normalizedCode, course);
                }
            }

            this.completeCourseDataLoaded = true;
            console.log(`Loaded ${this.completeCourseData.size} complete course records`);
        } catch (error) {
            console.error('Failed to load complete course data:', error);
        }
    }

    // Normalize course code for consistent lookup
    private normalizeForLookup(courseCode: string): string {
        return courseCode.toUpperCase().replace(/\s+/g, '');
    }

    // Extract term from user input
    private extractTerm(termText: string): string | null {
        const normalizedTerm = termText.toLowerCase().trim();

        // Map user input to our term data keys
        if (normalizedTerm.includes('fall') || normalizedTerm.includes('autumn')) {
            return '2025 Fall Term';
        } else if (normalizedTerm.includes('winter')) {
            return '2026 Winter Term';
        } else if (normalizedTerm.includes('spring') || normalizedTerm.includes('summer')) {
            return '2025 Spring/Summer Term';
        }

        return null;
    }

    // Check if course is available in specific term
    private async checkCourseInTerm(courseCode: string, termKey: string): Promise<boolean> {
        try {
            if (!this.courseCache.has(termKey)) {
                const courses = await loadCoursesForTerm(termKey);
                this.courseCache.set(termKey, courses);
            }

            const courses = this.courseCache.get(termKey) || [];
            const normalizedCode = normalizeCourseCode(courseCode);

            return courses.some(course => {
                if (isCourseGrouped(course)) {
                    return course.courseCode.toLowerCase() === normalizedCode.toLowerCase();
                } else {
                    return course.code.toLowerCase() === normalizedCode.toLowerCase();
                }
            });
        } catch (error) {
            console.error(`Error checking course ${courseCode} in ${termKey}:`, error);
            return false;
        }
    }

    // Natural language patterns for different query types (only what we actually have data for)
    private patterns = {
        prerequisites: [
            /(?:what\s+(?:are\s+)?(?:the\s+)?)?(?:pre-?req|prerequisite)s?\s+(?:for|of)\s+(.+)/i,
            /(.+?)\s+(?:pre-?req|prerequisite)s?/i,
            /what\s+do\s+i\s+need\s+(?:to\s+take\s+)?(?:before|for)\s+(.+)/i,
            /what\s+courses?\s+do\s+i\s+need\s+for\s+(.+)/i
        ],
        description: [
            /what\s+is\s+(.+?)\s+(?:about|course)/i,
            /(?:tell\s+me\s+about|describe)\s+(.+)/i,
            /(.+?)\s+(?:description|details?|info)/i,
            /what\s+does\s+(.+?)\s+cover/i,
            /(?:course\s+)?(.+?)\s+(?:about|description)/i
        ],
        terms: [
            /what\s+terms?\s+is\s+(.+?)\s+(?:offered|available)/i,
            /when\s+is\s+(.+?)\s+(?:offered|available)/i,
            /is\s+(.+?)\s+(?:offered|available)/i
        ],
        specific_term: [
            /is\s+(.+?)\s+(?:offered|available)\s+(?:in|for|during)\s+(.+)/i,
            /(.+?)\s+(?:offered|available)\s+(?:in|for|during)\s+(.+)/i,
            /can\s+i\s+take\s+(.+?)\s+(?:in|for|during)\s+(.+)/i,
            /is\s+(.+?)\s+(?:in|for|during)\s+(.+)/i
        ]
    };

    // Extract course code from natural language
    private extractCourseCode(text: string): string | null {
        const normalized = text.toUpperCase().trim();
        console.log('🔍 [extractCourseCode] Input:', text, '-> Normalized:', normalized);

        // Enhanced patterns to handle all variations including csi2110, CSI2110, etc.
        const patterns = [
            // Standard format: CSI 2110, CSI2110
            /\b([A-Z]{2,4})(\d{3,4})\b/,
            // With spaces: CSI 2110
            /\b([A-Z]{2,4})\s+(\d{3,4})\b/,
            // With optional letters: CSI2110A, CSI 2110A
            /\b([A-Z]{2,4})\s*(\d{3,4})[A-Z]?\b/,
            // Generic course patterns
            /\b([A-Z]{3,4})\s*(\d{3,4})\b/,
            // Handle edge cases
            /([A-Z]{2,4})\s*(\d{3,4})/
        ];

        for (const pattern of patterns) {
            const match = normalized.match(pattern);
            if (match) {
                const subject = match[1];
                const number = match[2];

                // Validate it looks like a real course code
                if (subject.length >= 2 && subject.length <= 4 &&
                    number.length >= 3 && number.length <= 4) {
                    const courseCode = `${subject} ${number}`;
                    console.log(`✅ [extractCourseCode] Extracted: "${courseCode}" from pattern: ${pattern}`);
                    return courseCode;
                }
            }
        }

        // Fallback: try to find any alphanumeric sequence that looks like a course
        const fallbackPattern = /([A-Z]{2,4})(\d{3,4})/;
        const fallbackMatch = normalized.match(fallbackPattern);
        if (fallbackMatch) {
            const courseCode = `${fallbackMatch[1]} ${fallbackMatch[2]}`;
            console.log(`⚡ [extractCourseCode] Fallback extracted: "${courseCode}"`);
            return courseCode;
        }

        console.log('❌ [extractCourseCode] No course code found');
        return null;
    }

    // Get course data across all terms
    private async getCourseAcrossTerms(courseCode: string): Promise<{
        course: CourseGrouped | CourseLegacy | null;
        availableTerms: string[];
        allCourseData: (CourseGrouped | CourseLegacy)[];
    }> {
        const normalizedCode = normalizeCourseCode(courseCode);
        const availableTerms: string[] = [];
        const allCourseData: (CourseGrouped | CourseLegacy)[] = [];
        let bestMatch: CourseGrouped | CourseLegacy | null = null;

        // Check all available terms
        for (const term of Object.values(APP_CONFIG.ACADEMIC.TERMS)) {
            try {
                if (!this.courseCache.has(term.dataKey)) {
                    const courses = await loadCoursesForTerm(term.dataKey);
                    this.courseCache.set(term.dataKey, courses);
                }

                const courses = this.courseCache.get(term.dataKey) || [];
                const foundCourse = courses.find(course => {
                    if (isCourseGrouped(course)) {
                        return course.courseCode.toLowerCase() === normalizedCode.toLowerCase();
                    } else {
                        return course.code.toLowerCase() === normalizedCode.toLowerCase();
                    }
                });

                if (foundCourse) {
                    availableTerms.push(term.displayName);
                    allCourseData.push(foundCourse);
                    if (!bestMatch) {
                        bestMatch = foundCourse;
                    }
                }
            } catch (error) {
                console.warn(`Could not load courses for ${term.dataKey}:`, error);
            }
        }

        return { course: bestMatch, availableTerms, allCourseData };
    }

    // Generate natural, varied responses like human conversation
    private generateNaturalResponse(type: string, courseCode: string, data: any): string {
        const termsResponses = [
            (terms: string[]) => `${courseCode} has been offered in ${terms.join(' and ')}.`,
            (terms: string[]) => `I see ${courseCode} listed for ${terms.join(' and ')}.`,
            (terms: string[]) => `${courseCode} appears in ${terms.join(terms.length > 2 ? ', and ' : ' and ')}.`,
            (terms: string[]) => `Found ${courseCode} scheduled for ${terms.join(' and ')}.`
        ];

        const notFoundResponses = [
            `I can't find ${courseCode} in my course database. Could you double-check the course code?`,
            `${courseCode} isn't in my records. Maybe it's offered under a different code?`,
            `I don't have ${courseCode} in my system. Are you sure that's the right course code?`,
            `Can't locate ${courseCode}. It might not exist or could have a different code.`,
            `${courseCode} doesn't seem to be in the university's course catalog.`
        ];

        const noTermsResponses = [
            `I don't have current scheduling info for ${courseCode}. You'll need to check with the registrar or department.`,
            `${courseCode} exists but I can't tell you when it's offered. Best to check the official timetable.`,
            `I have ${courseCode} in my database but no scheduling details. Contact the department for current offerings.`,
            `${courseCode} is a real course, but I don't have info on when it runs. Check the university's course schedule.`
        ];

        const specificTermYesResponses = [
            (course: string, term: string) => `Yes! ${course} is offered in ${term}. You can find it in Kairoll to add to your schedule.`,
            (course: string, term: string) => `${course} is available in ${term}. Check Kairoll to see the sections and times.`,
            (course: string, term: string) => `Yep, ${course} runs in ${term}. Head to Kairoll to see the details and add it.`,
            (course: string, term: string) => `${course} is offered during ${term}. You can browse sections in Kairoll.`
        ];

        const specificTermNoResponses = [
            (course: string, term: string) => `No, ${course} isn't offered in ${term}.`,
            (course: string, term: string) => `${course} isn't available during ${term}.`,
            (course: string, term: string) => `Nope, ${course} doesn't run in ${term}.`,
            (course: string, term: string) => `${course} isn't scheduled for ${term}.`
        ];

        const prerequisiteResponses = [
            (prereqs: string) => `To take ${courseCode}, you'll need: ${prereqs}`,
            (prereqs: string) => `${courseCode} requires: ${prereqs}`,
            (prereqs: string) => `Before enrolling in ${courseCode}, make sure you've completed: ${prereqs}`,
            (prereqs: string) => `The prerequisites for ${courseCode} are: ${prereqs}`,
            (prereqs: string) => `You'll need these courses first: ${prereqs}`
        ];

        const noPrereqResponses = [
            `Great news! ${courseCode} has no prerequisites.`,
            `${courseCode} is open to everyone - no prerequisites needed.`,
            `You can jump right into ${courseCode}, no prior courses required.`,
            `No prerequisites for ${courseCode}!`,
            `${courseCode} doesn't require any previous courses.`
        ];

        const descriptionResponses = [
            (title: string, desc: string) => `${courseCode} (${title}): ${desc}`,
            (title: string, desc: string) => `${title} covers: ${desc}`,
            (title: string, desc: string) => `Here's what ${courseCode} is about: ${desc}`,
            (title: string, desc: string) => `${title}: ${desc}`
        ];

        const noDescResponses = [
            `I don't have the full description for ${courseCode} right now. You might want to check the official course calendar.`,
            `The detailed description for ${courseCode} isn't in my database. Try the university's course catalog.`,
            `I'm missing the description for ${courseCode}. The department website would have more details.`,
            `No description available for ${courseCode} at the moment.`
        ];

        switch (type) {
            case 'terms':
                if (data.terms && data.terms.length > 0) {
                    const termsFunc = this.randomChoice(termsResponses);
                    return termsFunc(data.terms);
                } else {
                    return this.randomChoice(noTermsResponses);
                }

            case 'specific_term_yes':
                const yesFunc = this.randomChoice(specificTermYesResponses);
                return yesFunc(courseCode, data.term);

            case 'specific_term_no':
                const noFunc = this.randomChoice(specificTermNoResponses);
                return noFunc(courseCode, data.term);

            case 'not_found':
                return this.randomChoice(notFoundResponses);

            case 'prerequisites':
                if (!data.prerequisites || data.prerequisites.trim() === '') {
                    return this.randomChoice(noPrereqResponses);
                }
                const prereqFunc = this.randomChoice(prerequisiteResponses);
                return prereqFunc(data.prerequisites);

            case 'description':
                if (!data.description || data.description.trim() === '') {
                    return this.randomChoice(noDescResponses);
                }
                const descFunc = this.randomChoice(descriptionResponses);
                return descFunc(data.title, data.description);

            case 'no_info':
                return `I don't have detailed info on ${courseCode} right now. Want me to check something specific about it?`;

            default:
                return `Found ${courseCode}! What would you like to know about it?`;
        }
    }

    // Helper to pick random response for natural variation
    private randomChoice<T>(items: T[]): T {
        return items[Math.floor(Math.random() * items.length)];
    }

    // Main conversation handler
    public async handleQuery(input: string): Promise<ConversationResponse> {
        await this.loadCompleteCourseData();
        const normalizedInput = input.toLowerCase().trim();

        // Try to identify query type and extract course code
        for (const [type, patterns] of Object.entries(this.patterns)) {
            for (const pattern of patterns) {
                const match = normalizedInput.match(pattern);
                if (match && match[1]) {
                    const courseCode = this.extractCourseCode(match[1]);
                    if (courseCode) {
                        // Special handling for specific term queries
                        if (type === 'specific_term' && match[2]) {
                            const termKey = this.extractTerm(match[2]);
                            if (termKey) {
                                return await this.handleSpecificTermQuery(courseCode, termKey);
                            }
                        }
                        return await this.handleCourseQuery(type, courseCode, match[2]);
                    }
                }
            }
        }

        // Fallback: try to extract any course code from the input
        const courseCode = this.extractCourseCode(input);
        if (courseCode) {
            return await this.handleCourseQuery('general', courseCode);
        }

        // Be honest about not understanding
        return {
            type: 'not_found',
            message: "I'm not sure what you're asking about. Could you ask about a specific course? For example, you could ask 'Is CSI 2110 available in Fall?' or 'What are the prerequisites for MAT 1341?'",
            followUp: [
                "Ask about course availability",
                "Check prerequisites for a course",
                "Get course descriptions",
                "See course schedules"
            ]
        };
    }

    // Handle specific term availability queries
    private async handleSpecificTermQuery(courseCode: string, termKey: string): Promise<ConversationResponse> {
        const isAvailable = await this.checkCourseInTerm(courseCode, termKey);

        // Get friendly term name
        const termName = termKey.replace('2025 ', '').replace('2026 ', '').replace(' Term', '');

        if (isAvailable) {
            return {
                type: 'terms',
                message: this.generateNaturalResponse('specific_term_yes', courseCode, { term: termName }),
                data: { available: true, term: termName },
                followUp: [`What are the prerequisites for ${courseCode}?`, `Tell me about ${courseCode}`]
            };
        } else {
            return {
                type: 'terms',
                message: this.generateNaturalResponse('specific_term_no', courseCode, { term: termName }),
                data: { available: false, term: termName },
                followUp: [`What terms is ${courseCode} offered?`, `Find similar courses`]
            };
        }
    }

    // Handle specific course queries
    private async handleCourseQuery(type: string, courseCode: string, termHint?: string): Promise<ConversationResponse> {
        console.log(`🔍 Handling course query for ${courseCode}, type: ${type}`);

        // Use the new getCourseDetails service for prerequisites and descriptions
        const courseDetails = await getCourseDetails(courseCode);

        if (!courseDetails) {
            return {
                type: 'not_found',
                message: `I couldn't find information about ${courseCode.toUpperCase()}. Could you double-check the course code? Make sure it's in the format like CSI 2110 or MAT 1341.`,
                followUp: [`Try a different course code`, `Browse available courses`]
            };
        }

        console.log(`✅ Found course details for ${courseCode}:`, courseDetails);

        switch (type) {
            case 'prerequisites':
                // Use AI course info service for intelligent prerequisite explanations
                const { aiCourseInfoService } = await import('@/services/aiCourseInfoService');
                const prereqResponse = await aiCourseInfoService.getCourseInfo(courseCode, `What are the prerequisites for ${courseCode}?`);

                return {
                    type: 'prerequisites',
                    message: prereqResponse.success ? prereqResponse.message : `Prerequisites for ${courseCode}: ${courseDetails.prerequisites || 'None'}`,
                    data: courseDetails,
                    followUp: [`What is ${courseCode} about?`, `When is ${courseCode} offered?`]
                };

            case 'description':
                // Use AI course info service for intelligent course descriptions
                const { aiCourseInfoService: descService } = await import('@/services/aiCourseInfoService');
                const descResponse = await descService.getCourseInfo(courseCode, `What is ${courseCode} about?`);

                return {
                    type: 'description',
                    message: descResponse.success ? descResponse.message : `${courseDetails.courseCode} - ${courseDetails.courseTitle}: ${courseDetails.description}`,
                    data: courseDetails,
                    followUp: [`What are the prerequisites for ${courseCode}?`, `When is ${courseCode} offered?`]
                };

            default:
                // Use AI course info service for general course information
                const { aiCourseInfoService: generalService } = await import('@/services/aiCourseInfoService');
                const generalResponse = await generalService.getCourseInfo(courseCode, `Tell me about ${courseCode}`);

                return {
                    type: 'course_info',
                    message: generalResponse.success ? generalResponse.message : `${courseDetails.courseCode} - ${courseDetails.courseTitle}: ${courseDetails.description}. Prerequisites: ${courseDetails.prerequisites || 'None'}`,
                    data: courseDetails,
                    followUp: [`When is ${courseCode} offered?`, `Find similar courses`]
                };
        }
    }

    // Extract comprehensive course information
    private extractCourseInfo(course: CourseGrouped | CourseLegacy | null, allData: (CourseGrouped | CourseLegacy)[], completeData?: CompleteCourseData): CourseInfo {
        let info: CourseInfo;

        if (course && isCourseGrouped(course)) {
            info = {
                code: course.courseCode,
                title: course.courseTitle,
                terms: allData.map(c => isCourseGrouped(c) ? c.term : c.term),
                sections: {
                    lectures: Object.values(course.sectionGroups).reduce((acc, group) =>
                        acc + (group.lecture ? 1 : 0), 0),
                    labs: Object.values(course.sectionGroups).reduce((acc, group) =>
                        acc + (group.labs?.length || 0), 0),
                    tutorials: Object.values(course.sectionGroups).reduce((acc, group) =>
                        acc + (group.tutorials?.length || 0), 0)
                }
            };
        } else if (course) {
            const legacyCourse = course as CourseLegacy;
            info = {
                code: legacyCourse.code,
                title: legacyCourse.name,
                description: legacyCourse.description,
                prerequisites: legacyCourse.prerequisites,
                credits: legacyCourse.credits,
                terms: allData.map(c => isCourseGrouped(c) ? c.term : (c as CourseLegacy).term),
                sections: {
                    lectures: legacyCourse.sections.filter(s => s.sectionType === 'LEC').length,
                    labs: legacyCourse.sections.filter(s => s.sectionType === 'LAB').length,
                    tutorials: legacyCourse.sections.filter(s => s.sectionType === 'TUT').length
                }
            };
        } else {
            // Use complete data if course is null
            info = {
                code: completeData?.courseCode || 'Unknown',
                title: completeData?.courseTitle || 'Unknown Course',
                description: completeData?.description,
                prerequisites: completeData?.prerequisites ? [completeData.prerequisites] : [],
                credits: completeData?.units ? parseInt(completeData.units) || 3 : 3,
                terms: [],
                sections: {
                    lectures: 0,
                    labs: 0,
                    tutorials: 0
                }
            };
        }

        // Override with complete data if available
        if (completeData) {
            info.description = completeData.description || info.description;
            info.prerequisites = completeData.prerequisites ? [completeData.prerequisites] : info.prerequisites;
            info.credits = completeData.units ? parseInt(completeData.units) || 3 : info.credits;
        }

        return info;
    }
}

export const conversationService = new ConversationService();