/**
 * Universal Conversation Context Service
 * Tracks mentioned entities across all Kairo features for seamless context awareness
 */

import { COURSE_CODE_PATTERNS } from '../config/program.config';

interface ConversationContext {
    lastMentionedCourse?: string;
    lastMentionedProgram?: string;
    lastMentionedTerm?: string;
    lastMentionedYear?: string;
    recentCourses: string[];
    recentPrograms: string[];
}

class ConversationContextService {
    private context: ConversationContext = {
        recentCourses: [],
        recentPrograms: []
    };

    // Course context methods
    public setLastMentionedCourse(courseCode: string): void {
        this.context.lastMentionedCourse = courseCode.toUpperCase();

        // Add to recent courses (keep last 5)
        const normalizedCode = courseCode.toUpperCase();
        this.context.recentCourses = [
            normalizedCode,
            ...this.context.recentCourses.filter(c => c !== normalizedCode)
        ].slice(0, 5);

        console.log('💾 Updated course context:', this.context.lastMentionedCourse);
        console.log('📚 Recent courses:', this.context.recentCourses);
    }

    public getLastMentionedCourse(): string | undefined {
        return this.context.lastMentionedCourse;
    }

    public getRecentCourses(): string[] {
        return [...this.context.recentCourses];
    }

    // Program context methods
    public setLastMentionedProgram(programName: string): void {
        this.context.lastMentionedProgram = programName;

        // Add to recent programs (keep last 3)
        this.context.recentPrograms = [
            programName,
            ...this.context.recentPrograms.filter(p => p !== programName)
        ].slice(0, 3);

        console.log('💾 Updated program context:', this.context.lastMentionedProgram);
        console.log('🎓 Recent programs:', this.context.recentPrograms);
    }

    public getLastMentionedProgram(): string | undefined {
        return this.context.lastMentionedProgram;
    }

    public getRecentPrograms(): string[] {
        return [...this.context.recentPrograms];
    }

    // Term/Year context methods
    public setLastMentionedTerm(term: string): void {
        this.context.lastMentionedTerm = term;
        console.log('💾 Updated term context:', this.context.lastMentionedTerm);
    }

    public getLastMentionedTerm(): string | undefined {
        return this.context.lastMentionedTerm;
    }

    public setLastMentionedYear(year: string): void {
        this.context.lastMentionedYear = year;
        console.log('💾 Updated year context:', this.context.lastMentionedYear);
    }

    public getLastMentionedYear(): string | undefined {
        return this.context.lastMentionedYear;
    }

    // Context detection methods
    public hasContextReferences(text: string): boolean {
        const contextReferences = [
            'it', 'this course', 'that course', 'this class', 'that class',
            'the course', 'the class', 'that one', 'this one',
            'this program', 'that program', 'the program',
            'this schedule', 'that schedule', 'the schedule',
            'this curriculum', 'that curriculum', 'the curriculum'
        ];

        const textLower = text.toLowerCase();
        return contextReferences.some(ref => textLower.includes(ref));
    }

    // Extract course code from text or return context course using AI intelligence
    public async extractCourseWithContextAI(text: string): Promise<string | null> {
        // First try simple pattern matching for common formats
        const simplePattern = /\b([a-zA-Z]{2,4})\s*(\d{3,4})\b/i;
        const match = text.match(simplePattern);
        if (match) {
            const courseCode = `${match[1].toUpperCase()} ${match[2]}`;
            console.log(`🎯 [extractCourseWithContextAI] Quick pattern match: "${courseCode}"`);
            this.setLastMentionedCourse(courseCode);
            return courseCode;
        }

        // Use AI to intelligently extract and normalize course codes
        try {
            const response = await fetch('/api/ai/classify/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    prompt: `Extract any course code from this text and normalize it to standard format with space (e.g., "CSI 2110"). Handle ALL variations including:
- "csi2372" -> "CSI 2372"
- "CSI2110" -> "CSI 2110" 
- "math1341" -> "MATH 1341"
- "iti 1120" -> "ITI 1120"

IMPORTANT: Focus on academic program courses for Computer Science, Engineering, Mathematics, Sciences, etc. 
Avoid suggesting language electives (like ITA, ESP) unless explicitly mentioned.

Academic program codes include: ${COURSE_CODE_PATTERNS.map(p => p.prefix).join(', ')}, etc.

Only return the normalized course code or null if none found. Do not include any other text.`,
                    context: {
                        type: 'course_extraction',
                        program_focus: 'academic_programs_only'
                    }
                })
            });

            if (response.ok) {
                const result = await response.json();
                const courseCode = result.classification?.course;

                if (courseCode) {
                    console.log(`🤖 [extractCourseWithContextAI] AI extracted: "${courseCode}"`);
                    this.setLastMentionedCourse(courseCode);
                    return courseCode;
                }
            }
        } catch (error) {
            console.error('AI course extraction failed:', error);
        }

        // Context fallback
        const contextCourse = this.getLastMentionedCourse();
        if (contextCourse && this.hasContextReferences(text)) {
            console.log(`🔄 [extractCourseWithContextAI] Using context course: "${contextCourse}"`);
            return contextCourse;
        }

        console.log(`❌ [extractCourseWithContextAI] No course code found in: "${text}"`);
        return null;
    }

    // Legacy sync method for backward compatibility - delegates to AI
    public extractCourseWithContext(text: string): string | null {
        // For sync calls, try simple pattern as fallback but prefer AI
        this.extractCourseWithContextAI(text).then(result => {
            if (result) this.setLastMentionedCourse(result);
        }).catch(() => { });

        // If no explicit course code but has context references, use last mentioned course
        if (this.hasContextReferences(text) && this.context.lastMentionedCourse) {
            console.log('🔍 Using context course:', this.context.lastMentionedCourse);
            return this.context.lastMentionedCourse;
        }

        return null;
    }

    // Extract program with context
    public extractProgramWithContext(text: string, programMappings: any[]): string | null {
        // Try to find explicit program mention
        const textLower = text.toLowerCase();

        for (const mapping of programMappings) {
            for (const keyword of mapping.keywords) {
                if (textLower.includes(keyword.toLowerCase())) {
                    this.setLastMentionedProgram(mapping.programId);
                    return mapping.programId;
                }
            }
        }

        // If no explicit program but has context references, use last mentioned program
        if (this.hasContextReferences(text) && this.context.lastMentionedProgram) {
            console.log('🔍 Using context program:', this.context.lastMentionedProgram);
            return this.context.lastMentionedProgram;
        }

        return null;
    }

    // Clear all context (when conversation is reset)
    public clearAll(): void {
        this.context = {
            recentCourses: [],
            recentPrograms: []
        };
        console.log('🧹 Cleared all conversation context');
    }

    // Get full context for debugging
    public getFullContext(): ConversationContext {
        return { ...this.context };
    }
}

// Export singleton instance
export const conversationContext = new ConversationContextService();
export default conversationContext; 