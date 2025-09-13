/**
 * AI-Driven Course Information Service
 * Provides instant answers to course queries using the all_courses data
 */

import { loadCoursesForTerm } from './courseDataService';
import { CourseGrouped, isCourseGrouped } from '@/types/course';
import { APP_CONFIG } from '@/config/app.config';
import conversationContext from './conversationContext';

interface CourseDetails {
    code: string;
    title: string;
    description?: string;
    prerequisites?: string;
    credits?: string;
    terms: string[];
    sections: {
        lectures: number;
        labs: number;
        tutorials: number;
    };
}

interface CourseQueryResponse {
    success: boolean;
    message: string;
    data?: CourseDetails;
}

class AICourseService {
    private courseCache = new Map<string, CourseGrouped[]>();
    private completeCourseCache: any = null;

    // Load complete course data with descriptions and prerequisites
    private async loadCompleteCourseData(): Promise<any> {
        if (this.completeCourseCache) {
            return this.completeCourseCache;
        }

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL ||
                (typeof window !== 'undefined' && window.location.hostname === 'localhost'
                    ? 'http://localhost:8000'
                    : 'https://kairopublic-production.up.railway.app');
            const response = await fetch(`${apiUrl}/api/data/courses-complete/`);

            if (!response.ok) {
                throw new Error(`Failed to load complete course data: ${response.status}`);
            }

            this.completeCourseCache = await response.json();
            return this.completeCourseCache;
        } catch (error) {
            console.error('❌ API failed, trying fallback local file:', error);

            // Fallback: try to load from local JSON file
            try {
                const fallbackResponse = await fetch('/all_courses_complete.json');

                if (!fallbackResponse.ok) {
                    throw new Error(`Fallback file not found: ${fallbackResponse.status}`);
                }

                this.completeCourseCache = await fallbackResponse.json();
                return this.completeCourseCache;
            } catch (fallbackError) {
                console.error('❌ Both API and fallback failed:', fallbackError);
                // Try the scrapers data format as final fallback
                try {
                    this.completeCourseCache = {}; // Return empty cache to avoid infinite loops
                    return null;
                } catch (finalError) {
                    console.error('❌ All fallback attempts failed:', finalError);
                    return null;
                }
            }
        }
    }

    // Normalize course code for searching (standardize format)
    private normalizeCourseCode(code: string): string {
        // Remove all non-alphanumeric characters and normalize to no spaces
        const cleaned = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return cleaned;
    }

    // No hardcoded term discovery - rely on external term info or fail gracefully  
    private async getAvailableTerms(): Promise<string[]> {
        // If we don't know what terms are available, return empty
        // The calling code should handle the empty case gracefully
        return [];
    }

    // Find course in complete data with descriptions and prerequisites
    private async findCourseComplete(courseCode: string): Promise<any | null> {
        const completeData = await this.loadCompleteCourseData();
        if (!completeData) {
            return null;
        }

        const normalizedCode = this.normalizeCourseCode(courseCode);

        // Search through all departments
        for (const department in completeData) {
            const courses = completeData[department];
            if (Array.isArray(courses)) {
                for (const course of courses) {
                    const normalizedCourseCode = this.normalizeCourseCode(course.courseCode || '');

                    if (normalizedCourseCode === normalizedCode) {
                        return course;
                    }
                }
            }
        }

        return null;
    }

    // Find course across all terms (original method for scheduling)
    private async findCourse(courseCode: string): Promise<CourseGrouped | null> {
        const normalizedCode = this.normalizeCourseCode(courseCode);

        // Dynamically discover available terms from course data
        const availableTerms = await this.getAvailableTerms();
        for (const term of availableTerms) {
            try {
                const courses = await loadCoursesForTerm(term);
                const found = courses.find(course => {
                    if (isCourseGrouped(course)) {
                        return this.normalizeCourseCode(course.courseCode) === normalizedCode;
                    }
                    return false;
                });

                if (found && isCourseGrouped(found)) {
                    return found;
                }
            } catch (error) {
                console.warn(`Failed to search in ${term} term:`, error);
            }
        }

        return null;
    }

    // Use AI to extract course code from natural language
    private async extractCourseCodeAI(text: string): Promise<string | null> {
        try {
            const response = await fetch('/api/ai/classify/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    prompt: `Extract and normalize any course code from this text. Handle all variations like "csi2372", "CSI 2110", "math-1341", etc. Return in format "CSI 2372" or null if none found.`,
                    context: { type: 'course_code_extraction' }
                })
            });

            if (response.ok) {
                const result = await response.json();
                return result.classification?.course || null;
            }
        } catch (error) {
            console.error('AI course code extraction failed:', error);
        }

        return null;
    }

    // Check what type of query this is with expanded patterns
    private getQueryType(text: string): 'prerequisites' | 'description' | 'credits' | 'general' {
        const lower = text.toLowerCase();

        // More comprehensive prerequisite patterns including context references
        if (lower.includes('prerequisite') || lower.includes('prereq') || lower.includes('pre req') ||
            lower.includes('require') || lower.includes('pre-req') || lower.includes('need to take') ||
            lower.includes('what do i need') || lower.includes('requirements for') ||
            lower.includes('pre reqs') || lower.includes('prereqs') || lower.includes('requirement') ||
            lower.includes('needed before') || lower.includes('take before') ||
            lower.includes('what are the pre') || lower.includes('whats the pre') ||
            lower.includes('what is the pre') || lower.includes('what pre') ||
            lower.includes('the prereq') || lower.includes('the pre req')) {
            return 'prerequisites';
        }
        // More comprehensive description patterns
        else if (lower.includes('description') || lower.includes('about') || lower.includes('what is') ||
            lower.includes('tell me about') || lower.includes('course content') || lower.includes('covers') ||
            lower.includes('what does') || lower.includes('overview')) {
            return 'description';
        }
        // Credit/units patterns
        else if (lower.includes('credit') || lower.includes('units') || lower.includes('hours') ||
            lower.includes('how many credits') || lower.includes('worth')) {
            return 'credits';
        }

        return 'general';
    }

    // Generate dynamic response variations
    private generateResponse(course: CourseGrouped, queryType: string): string {
        const responses = {
            prerequisites: [
                `📚 **${course.courseCode}** prerequisites:\n`,
                `📋 To take **${course.courseCode}**, you need:\n`,
                `⚡ **${course.courseCode}** requirements:\n`,
                `🎯 Prerequisites for **${course.courseCode}**:\n`
            ],
            description: [
                `📖 **${course.courseCode} - ${course.courseTitle}**\n`,
                `💡 About **${course.courseCode}**:\n`,
                `📚 **${course.courseCode}** overview:\n`,
                `🎓 **${course.courseCode} - ${course.courseTitle}**\n`
            ],
            credits: [
                `💳 **${course.courseCode}** credit information:\n`,
                `📊 **${course.courseCode}** units:\n`,
                `⚖️ **${course.courseCode}** credits:\n`,
                `🏆 **${course.courseCode}** academic value:\n`],
            general: [
                `📋 **${course.courseCode} - ${course.courseTitle}**\n`,
                `🎓 Course information for **${course.courseCode}**:\n`,
                `📚 **${course.courseCode}** details:\n`,
                `💡 Everything about **${course.courseCode}**:\n`
            ]
        };

        const endings = [
            `\n💬 Ask me about other courses anytime!`,
            `\n🚀 Need info on another course? Just ask!`,
            `\n✨ Got questions about other courses? I'm here!`,
            `\n🎯 Want to know about more courses? Fire away!`,
            `\n📚 Curious about other courses? Let me know!`
        ];

        const responseArray = responses[queryType as keyof typeof responses] || responses.general;
        const randomResponse = responseArray[Math.floor(Math.random() * responseArray.length)];
        const randomEnding = endings[Math.floor(Math.random() * endings.length)];

        return randomResponse + randomEnding;
    }

    // Generate response for complete course data
    private generateResponseComplete(course: any, queryType: string): string {
        const courseHeader = `${course.courseCode} - ${course.courseTitle}`;

        if (queryType === 'prerequisites') {
            const prereqs = course.prerequisites && course.prerequisites.trim();
            if (!prereqs || prereqs.toLowerCase() === 'none' || prereqs === '') {
                return `${courseHeader}\n\nPrerequisites: None - This course has no prerequisites!\n\nThis means you can take this course without completing any other courses first.`;
            } else {
                const formattedPrereqs = prereqs.includes(',')
                    ? prereqs.split(',').map((p: string) => p.trim()).join(' and ')
                    : prereqs;
                return `${courseHeader}\n\nTo take this course, you'll need to complete ${formattedPrereqs} first. Make sure you've successfully passed these prerequisite courses before enrolling.`;
            }
        } else if (queryType === 'description') {
            const description = course.description && course.description.trim();
            if (!description) {
                return `${courseHeader}\n\nI don't have a detailed description for this course in my database right now.\n\nYou might want to check the official uOttawa course catalog or ask your academic advisor for more details.`;
            } else {
                return `${courseHeader}\n\nCourse Description:\n${description}\n\nCredits: ${course.units || 'Not specified'} units`;
            }
        } else if (queryType === 'credits') {
            const units = course.units && course.units.trim();
            return `${courseHeader}\n\nCredits: ${units || 'Credit information not specified'} units\n\nMost courses at uOttawa are typically 3 units unless otherwise specified.`;
        } else {
            // General info - show all available information
            let response = courseHeader;

            if (course.description && course.description.trim()) {
                response += `\n\nCourse Description:\n${course.description}`;
            }

            const prereqs = course.prerequisites && course.prerequisites.trim();
            if (!prereqs || prereqs.toLowerCase() === 'none' || prereqs === '') {
                response += `\n\nPrerequisites: None`;
            } else {
                response += `\n\nPrerequisites: ${prereqs}`;
            }

            if (course.units && course.units.trim()) {
                response += `\n\nCredits: ${course.units} units`;
            }

            return response;
        }
    }

    // Main method to handle course information queries using AI
    async handleCourseQuery(query: string): Promise<CourseQueryResponse> {
        // Use AI to extract and normalize course code
        let courseCode = await conversationContext.extractCourseWithContextAI(query);

        if (!courseCode) {
            // Try AI classification to get course from context
            try {
                const response = await fetch('/api/ai/classify/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: query,
                        prompt: `Extract any course code mentioned in this text. Handle variations like "csi2372", "CSI 2110", "tell me about math 1341", etc. Return the normalized course code or null if none found.`,
                        context: { type: 'course_extraction', recentCourses: conversationContext.getRecentCourses() }
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    courseCode = result.classification?.course;
                }
            } catch (error) {
                console.error('AI course extraction failed:', error);
            }
        }

        if (!courseCode) {
            return {
                success: false,
                message: "I didn't catch a course code in your question. Try asking about a specific course like CSI2110, mat1341, or any course you're interested in!"
            };
        }

        const course = await this.findCourseComplete(courseCode);

        if (!course) {
            return {
                success: false,
                message: `Sorry, I couldn't find **${courseCode}** in our course database. The course code might be spelled differently or not be offered this term.`
            };
        }

        // Course context is already updated by extractCourseWithContextAI

        const queryType = this.getQueryType(query);
        const response = this.generateResponseComplete(course, queryType);

        return {
            success: true,
            message: response,
            data: {
                code: course.courseCode,
                title: course.courseTitle,
                description: course.description,
                prerequisites: course.prerequisites,
                credits: course.units,
                terms: ['Available'], // Complete data doesn't have term info
                sections: {
                    lectures: 0, // This info not available in complete data
                    labs: 0,
                    tutorials: 0
                }
            }
        };
    }

    // Use AI to intelligently determine if this is a course info query
    public async isCourseInfoQueryAI(text: string): Promise<boolean> {
        try {
            const response = await fetch('/api/ai/classify/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    prompt: `Determine if this is a course information query. Return true if asking about a specific course (like "csi2372", "tell me about CSI2110", "what are prerequisites for math courses", etc.) but false if asking about curriculum sequences or program requirements.`,
                    context: { type: 'course_info_detection' }
                })
            });

            if (response.ok) {
                const result = await response.json();
                return result.classification?.intent === 'course_info' ||
                    result.classification?.intent === 'course_query' ||
                    !!result.classification?.course;
            }
        } catch (error) {
            console.error('AI course info detection failed:', error);
        }

        // Fallback: if context references and has recent course
        return conversationContext.hasContextReferences(text) && !!conversationContext.getLastMentionedCourse();
    }

    // Use AI classification to determine if this is a course info query
    public isCourseInfoQuery(text: string): boolean {
        // Enhanced course code detection patterns
        const courseCodePatterns = [
            /\b[A-Z]{3,4}\s*\d{3,4}[A-Z]?\b/i,  // CSI 2110, CSI2110, ITI1120A
            /\b[a-z]{3,4}\s*\d{3,4}[a-z]?\b/i   // csi 2110, iti1120 (lowercase)
        ];
        
        const hasCourseCode = courseCodePatterns.some(pattern => pattern.test(text));
        
        if (!hasCourseCode) {
            return false; // No course code = definitely not a course info query
        }
        
        // Simple heuristics to quickly exclude obvious non-course queries
        const normalizedText = text.toLowerCase();
        
        // Exclude program/curriculum/schedule queries (but be less restrictive)
        if (/program.*requirement|curriculum.*sequence|build.*schedule|generate.*schedule|what.*courses.*should.*take|show.*me.*program/i.test(text)) {
            return false;
        }
        
        // Exclude availability/when queries (but allow "when do I take" for timing info)
        if (/when.*offered|available.*term|offered.*semester/i.test(text) && !/when.*take|what.*year/i.test(text)) {
            return false;
        }
        
        // If it has a course code and isn't clearly excluded, assume it's a course info query
        console.log(`🔍 [isCourseInfoQuery] Detected course info query: "${text}"`);
        return true;
    }

    // Clear conversation context (call when conversation is cleared)
    public clearContext(): void {
        conversationContext.clearAll();
    }
}

export const aiCourseService = new AICourseService();
export { AICourseService };
export default aiCourseService;
