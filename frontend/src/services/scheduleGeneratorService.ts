import { curriculumService, MatchResult, WhenIsCourseResult } from '@/lib/curriculumService';
import { dynamicClassificationService } from '@/lib/dynamicClassificationService';
import { loadCoursesForTerm } from './courseDataService';
import { CourseGrouped } from '@/types/course';
import { COURSE_CODE_PATTERNS } from '@/config/program.config';
import { EVENT_THEME_KEYS } from '@/config/eventThemes';
// import { dynamicMessageService, ScheduleMessageData } from './dynamicMessageService';
// import conversationContext from './conversationContext';

export interface ScheduleEvent {
    title: string;
    start_time: string;
    end_time: string;
    day_of_week: string;
    start_date: string;
    end_date: string;
    description: string;
    theme?: string;
}

export interface TimePreference {
    no_early_classes?: boolean; // No classes before 9:00 AM
    no_late_classes?: boolean;  // No classes after 6:00 PM
    avoid_times?: string[];     // Specific times to avoid like "8:30", "17:00"
    preferred_days?: string[];  // Preferred days like ["Monday", "Wednesday", "Friday"]
    avoid_days?: string[];      // Days to avoid like ["Friday"]
    max_gap_hours?: number;     // Maximum gap between classes in hours
    prefer_compact?: boolean;   // Prefer classes close together
}

export interface ScheduleGenerationResult {
    success: boolean;
    message: string;
    events: ScheduleEvent[];
    matched_courses: string[];
    unmatched_courses: string[];
    errors: string[];
    can_regenerate?: boolean;
    alternatives_available?: boolean;
    schedule_id?: string;
}

// Get academic program course codes from existing config
const getAcademicProgramCodes = () => COURSE_CODE_PATTERNS.map(pattern => pattern.prefix);

/**
 * Filter courses to only include academic program-relevant courses
 * Excludes language electives and other non-core subjects
 */
function filterAcademicProgramCourses(courses: CourseGrouped[]): CourseGrouped[] {
    return courses.filter(course => {
        const coursePrefix = course.courseCode.substring(0, 3);
        return getAcademicProgramCodes().includes(coursePrefix);
    });
}

/**
 * Check if a course code belongs to an academic program
 */
function isAcademicProgramCourse(courseCode: string): boolean {
    const coursePrefix = courseCode.substring(0, 3);
    return getAcademicProgramCodes().includes(coursePrefix);
}

export interface TimeSlot {
    day: string;
    startTime: string;
    endTime: string;
    dayOfWeek: string; // Full name
}

export interface WhenIsCourseUsedResult {
    success: boolean;
    message: string;
    courseResults: WhenIsCourseResult[];
}

class ScheduleGeneratorService {
    [x: string]: any;
    // Term dates configuration with proper formatting
    private readonly termDates = {
        Fall: {
            start: '2024-09-03',
            end: '2024-12-02',
            displayStart: 'Sept 3',
            displayEnd: 'Dec 2',
            breaks: [{ start: '2024-10-12', end: '2024-10-18', display: 'Oct 12–18' }]
        },
        Winter: {
            start: '2025-01-12',
            end: '2025-04-15',
            displayStart: 'Jan 12',
            displayEnd: 'Apr 15',
            breaks: [{ start: '2025-02-15', end: '2025-02-21', display: 'Feb 15–21' }]
        },
        Summer: {
            start: '2025-05-05',
            end: '2025-07-29',
            displayStart: 'May 5',
            displayEnd: 'Jul 29',
            breaks: []
        }
    };

    // Unique theme assignment per generation
    private courseThemeMap: Map<string, string> = new Map();
    private usedThemes: Set<string> = new Set();
    // Source themes from centralized config to avoid duplicates and keep in sync
    private readonly allThemes: string[] = EVENT_THEME_KEYS;

    private resetThemeAssignment(): void {
        this.courseThemeMap.clear();
        this.usedThemes.clear();
    }

    private getCourseTheme(courseCode: string): string {
        if (this.courseThemeMap.has(courseCode)) return this.courseThemeMap.get(courseCode)!;
        const available = this.allThemes.filter(t => !this.usedThemes.has(t));
        const hash = Array.from(`${courseCode}:${this.currentScheduleIteration}`)
            .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 0);
        const chosen = (available.length > 0)
            ? available[hash % available.length]
            : this.allThemes[hash % this.allThemes.length];
        this.courseThemeMap.set(courseCode, chosen);
        this.usedThemes.add(chosen);
        return chosen;
    }

    private scheduleAttempts: Map<string, number> = new Map(); // Track schedule attempts
    private lastScheduleContext: {
        program?: string;
        year?: number;
        term?: string;
        input?: string;
    } | null = null; // Remember last schedule context

    // Store current course sections for individual changes
    private currentCourseSections: Map<string, any> = new Map(); // Track current sections for each course
    private currentCourseData: Map<string, any> = new Map(); // Store live course data for section switching

    // Track previously selected sections to avoid repeating them
    private previouslySelectedSections: Map<string, Set<string>> = new Map(); // courseCode -> Set of section IDs used before
    private currentScheduleIteration: number = 0; // Track how many schedules generated for same request

    // Handle "when is course taken" queries
    async handleWhenIsCourseQuery(message: string): Promise<WhenIsCourseUsedResult> {
        try {
            // Use GPT to classify the message and extract course and program
            const classification = await dynamicClassificationService.classifyMessage(message);

            if (classification.intent !== 'when_is_course_taken') {
                return {
                    success: false,
                    message: "This doesn't appear to be a 'when is course taken' query.",
                    courseResults: []
                };
            }

            if (!classification.course || !classification.program) {
                return {
                    success: false,
                    message: "I couldn't identify the course code or program from your message. Please try something like 'When do I take CSI2110 in Software Engineering?'",
                    courseResults: []
                };
            }

            // Look up when the course is taken
            const result = await curriculumService.findWhenCourseIsTaken(
                classification.course,
                classification.program
            );

            return {
                success: result.found,
                message: result.message,
                courseResults: [result]
            };
        } catch (error) {
            console.error('Error handling when is course query:', error);
            return {
                success: false,
                message: "Sorry, I encountered an error while processing your query. Please try again.",
                courseResults: []
            };
        }
    }

    // Generate schedule with GPT classification and term inference
    async generateSchedule(
        message: string,
        timePreferences?: TimePreference
    ): Promise<ScheduleGenerationResult> {
        
        // Reset per-run theme assignment so colors are unique within this generation
        this.resetThemeAssignment();

        try {
            // Use dynamic AI to classify the message
            const classification = await dynamicClassificationService.classifyMessage(message);

            if (classification.intent !== 'build_schedule' && classification.intent !== 'generate_schedule') {
                
                return {
                    success: false,
                    message: "This doesn't appear to be a schedule generation request.",
                    events: [],
                    matched_courses: [],
                    unmatched_courses: [],
                    errors: ["Invalid intent for schedule generation"]
                };
            }

            // If program wasn't detected, do NOT stop here. The backend has intelligent
            // detection that can infer program/year/term from the full message and user profile.
            // We proceed and pass the raw message so the server can handle detection.

            // Resolve program: use classifier result or infer from message via curriculum index
            let program = classification.program;
            if (!program) {
                try {
                    const inferred = await curriculumService.findBestProgramMatch(message);
                    if (inferred) program = inferred;
                } catch (infErr) {
                    console.warn('[SCHEDULE_GEN] Program inference failed:', infErr);
                }
            }
            const year = typeof classification.year === 'number' ? classification.year : undefined;
            const requestedTerm = classification.term || '';

            

            // Call backend schedule generation endpoint
            const api = (await import('@/lib/api')).default;

            const response = await api.post('/api/schedule/generate/', {
                message: message,
                program: program,
                year: year,
                term: requestedTerm,
                time_preferences: timePreferences
            });

            

            if (response.data.success && response.data.events) {
                // Ensure unique themes across backend-provided events by course code token
                const postProcessed = (response.data.events as ScheduleEvent[]).map(ev => {
                    // Attempt to extract course code from title prefix "XXX1234"
                    const match = ev.title?.match(/\b([A-Z]{3,4}\d{4})\b/);
                    const courseCode = match ? match[1] : ev.title || Math.random().toString(36);
                    return {
                        ...ev,
                        theme: this.getCourseTheme(courseCode)
                    };
                });
                
                return {
                    success: true,
                    message: response.data.message,
                    events: postProcessed,
                    matched_courses: response.data.matched_courses || [],
                    unmatched_courses: response.data.unmatched_courses || [],
                    errors: response.data.errors || []
                };
            } else {
                
                // Fallback: Use curriculum JSON directly (no classifier dependency)
                try {
                    // Infer program if still missing
                    let inferredProgram = program;
                    if (!inferredProgram) {
                        inferredProgram = await curriculumService.findBestProgramMatch(message) || undefined;
                    }
                    if (!inferredProgram) {
                        throw new Error('Program not identified');
                    }

                    // Load curriculum and normalize
                    const index = await curriculumService.getProgramIndex();
                    const entry = index.programs.find(p => p.name === inferredProgram);
                    if (!entry || !entry.hasContent) throw new Error('Program curriculum not available');
                    const curriculum = await curriculumService.loadCurriculumData(entry.file);
                    const normalized = curriculumService.normalizeCurriculumPublic(curriculum);

                    const targetYear = typeof year === 'number' ? year : 1;
                    const yearData = normalized.years.find(y => y.year === targetYear);
                    if (!yearData) throw new Error(`Year ${targetYear} not found`);

                    // Determine terms to generate
                    const termsToGenerate = requestedTerm
                        ? [requestedTerm]
                        : yearData.terms.map(t => t.term);

                    const events: ScheduleEvent[] = [];
                    const matchedCourses: string[] = [];
                    const unmatchedCourses: string[] = [];
                    const errors: string[] = [];

                    for (const t of termsToGenerate) {
                        const termData = yearData.terms.find(x => x.term === t);
                        if (!termData) continue;
                        // Extract just codes (handle "CODE | Title" and Elective tokens)
                        const courseCodes = termData.courses.map(c => {
                            const code = c.split(' | ')[0].trim();
                            return code === 'Elective' ? 'Elective' : code;
                        });
                        const gen = await this.generateTermSchedule(courseCodes, t, timePreferences);
                        for (const e of gen.events) events.push(e);
                        matchedCourses.push(...gen.matched_courses);
                        unmatchedCourses.push(...gen.unmatched_courses);
                        errors.push(...gen.errors);
                    }

                    const ok = events.length > 0;
                    return {
                        success: ok,
                        message: ok ? 'Generated schedule from curriculum data' : (response.data.message || 'Failed to generate schedule'),
                        events,
                        matched_courses: matchedCourses,
                        unmatched_courses: unmatchedCourses,
                        errors: errors.length ? errors : (response.data.errors || ['Backend schedule generation failed'])
                    };
                } catch (fbErr) {
            console.error('[SCHEDULE_GEN] Fallback generation failed:', fbErr);
                    return {
                        success: false,
                        message: response.data.message || 'Failed to generate schedule',
                        events: [],
                        matched_courses: response.data.matched_courses || [],
                        unmatched_courses: response.data.unmatched_courses || [],
                        errors: response.data.errors || ['Backend schedule generation failed']
                    };
                }
            }

        } catch (error) {
            console.error('[SCHEDULE_GEN] Error in generateSchedule:', error);
            return {
                success: false,
                message: "I encountered an error while generating your schedule. Please try again.",
                events: [],
                matched_courses: [],
                unmatched_courses: [],
                errors: [error instanceof Error ? error.message : "Unknown error"]
            };
        }
    }

    private async generateTermSchedule(
        courses: string[],
        term: string,
        timePreferences?: TimePreference
    ): Promise<ScheduleGenerationResult> {
        try {
            // Load course data for the term
            const courseData = await loadCoursesForTerm(term);
            const events: ScheduleEvent[] = [];
            const matchedCourses: string[] = [];
            const unmatchedCourses: string[] = [];
            const errors: string[] = [];

            // Get term dates
            const termDates = this.termDates[term as keyof typeof this.termDates];
            if (!termDates) {
                throw new Error(`Invalid term: ${term}`);
            }

            // Enhanced course filtering and intelligent substitution
            const { filteredCourses, missingCourses, suggestions } = await this.filterAndSuggestCourses(
                courses, courseData, term
            );

            

            // Add missing courses to unmatched_courses and errors
            unmatchedCourses.push(...missingCourses);
            errors.push(...missingCourses.map(code => `Course ${code} not found in ${term} offerings`));

            // Add suggestions for missing courses
            if (suggestions.length > 0) {
                errors.push(`💡 Suggestions: ${suggestions.join(', ')}`);
            }

            // Process only filteredCourses in the for loop:
            for (const courseCode of filteredCourses) {
                const course = courseData.find((c: CourseGrouped) =>
                    c.courseCode.toUpperCase() === courseCode.toUpperCase()
                );

                if (!course) {
                    unmatchedCourses.push(courseCode);
                    errors.push(`Course ${courseCode} not found in ${term} offerings`);
                    continue;
                }

                // Intelligent section GROUP selection based on preferences and conflicts
                const selectedSectionGroup = await this.selectOptimalSection(
                    course,
                    courseCode,
                    events,
                    timePreferences
                );

                if (!selectedSectionGroup) {
                    unmatchedCourses.push(courseCode);
                    errors.push(`No suitable section group found for ${courseCode} with current constraints`);
                    continue;
                }

                // Track all sections from this group selection
                if (!this.previouslySelectedSections.has(courseCode)) {
                    this.previouslySelectedSections.set(courseCode, new Set());
                }

                // Add all component sections from the selected group to tracking
                selectedSectionGroup.components.forEach((component: any) => {
                    this.previouslySelectedSections.get(courseCode)!.add(component.section);
                });

                // Store section group for potential individual changes
                this.currentCourseSections.set(courseCode, selectedSectionGroup);
                this.currentCourseData.set(courseCode, course);

                // Create events for ALL components in this section group
                const newEvents = this.createCourseEventsFromGroup(courseCode, course, selectedSectionGroup);
                events.push(...newEvents);

                matchedCourses.push(courseCode);
            }

            return {
                success: matchedCourses.length > 0,
                message: `Generated ${term} schedule`,
                events,
                matched_courses: matchedCourses,
                unmatched_courses: unmatchedCourses,
                errors,
                can_regenerate: true,
                alternatives_available: true
            };

        } catch (error) {
            console.error(`Error generating ${term} schedule:`, error);
            return {
                success: false,
                message: `Failed to generate ${term} schedule`,
                events: [],
                matched_courses: [],
                unmatched_courses: courses,
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }

    // Detect if user is requesting a new/alternative schedule
    private detectNewScheduleRequest(message: string): boolean {
        const newSchedulePatterns = [
            /new\s+(?:one|schedule)/i,
            /different\s+(?:one|schedule)/i,
            /another\s+(?:one|schedule)/i,
            /alternative\s+schedule/i,
            /regenerate/i,
            /try\s+again/i,
            /make\s+(?:a\s+)?new/i,
            /generate\s+(?:a\s+)?new/i,
            /create\s+(?:a\s+)?new/i
        ];

        return newSchedulePatterns.some(pattern => pattern.test(message));
    }

    // Regenerate the last schedule with different sections
    async regenerateLastSchedule(): Promise<ScheduleGenerationResult> {
        if (!this.lastScheduleContext) {
            return {
                success: false,
                message: "No previous schedule to regenerate.",
                events: [],
                matched_courses: [],
                unmatched_courses: [],
                errors: ["No previous schedule context"]
            };
        }

        // Increment iteration counter and regenerate
        this.currentScheduleIteration++;

        return this.generateSchedule(
            this.lastScheduleContext.input || `Generate Year ${this.lastScheduleContext.year} schedule for ${this.lastScheduleContext.program}`
        );
    }

    // Check if a message is asking when a course is taken
    isWhenIsCourseQuery(message: string): boolean {
        const patterns = [
            /when\s+(?:do\s+(?:i|we)\s+)?take\s+([A-Z]{3}\d{4})/i,
            /when\s+is\s+([A-Z]{3}\d{4})\s+taken/i,
            /what\s+(?:year|term|semester)\s+(?:do\s+(?:i|we)\s+)?(?:take\s+)?([A-Z]{3}\d{4})/i,
            /([A-Z]{3}\d{4})\s+(?:is\s+)?(?:in\s+)?(?:what\s+)?(?:year|term|semester)/i
        ];

        return patterns.some(pattern => pattern.test(message));
    }

    // Check if a message is asking for schedule generation
    isScheduleGenerationQuery(message: string): boolean {
        const patterns = [
            /(?:create|make|generate|build)\s+(?:my\s+)?(?:schedule|timetable)/i,
            /(?:schedule|timetable)\s+for\s+(?:year\s+)?\d/i,
            /(?:year\s+)?\d\s+(?:schedule|timetable)/i,
            /(?:show\s+me\s+)?(?:my\s+)?(?:courses?\s+)?for\s+(?:year\s+)?\d/i
        ];

        return patterns.some(pattern => pattern.test(message));
    }

    // Legacy method aliases for compatibility
    isScheduleGenerationRequest(message: string): boolean {
        return this.isScheduleGenerationQuery(message);
    }

    isRequestingNewSchedule(message: string): boolean {
        return this.detectNewScheduleRequest(message);
    }

    // Placeholder methods for individual course changes (not implemented yet)
    isRequestingIndividualChange(message: string): { isChange: boolean; courseCode?: string; component?: string } {
        const patterns = [
            /change\s+(?:the\s+)?section\s+for\s+([A-Z]{3}\d{4})/i,
            /different\s+section\s+for\s+([A-Z]{3}\d{4})/i,
            /new\s+section\s+for\s+([A-Z]{3}\d{4})/i
        ];

        for (const pattern of patterns) {
            const match = pattern.exec(message);
            if (match) {
                return {
                    isChange: true,
                    courseCode: match[1],
                    component: 'course'
                };
            }
        }

        return { isChange: false };
    }

    async changeIndividualCourse(courseCode: string, component?: string, preferences?: any): Promise<ScheduleGenerationResult> {
        // Placeholder - not implemented yet
        return {
            success: false,
            message: "Individual course changes are not implemented yet.",
            events: [],
            matched_courses: [],
            unmatched_courses: [],
            errors: ["Feature not implemented"]
        };
    }

    parseTimePreferences(message: string): TimePreference {
        // Enhanced intelligent time preference parsing
        const preferences: TimePreference = {};

        // Early morning preferences - expanded patterns
        if (/no\s+early|avoid\s+early|not\s+early|sleep\s+in|late\s+riser|hate\s+mornings?|not\s+a\s+morning\s+person|after\s+9|start\s+later|no\s+8am|avoid\s+8am/i.test(message)) {
            preferences.no_early_classes = true;
        }

        // Late class preferences - expanded patterns
        if (/no\s+late|avoid\s+late|not\s+late|finish\s+early|leave\s+early|before\s+6|before\s+5|home\s+early|done\s+by|finish\s+by/i.test(message)) {
            preferences.no_late_classes = true;
        }

        // Enhanced day preferences with multiple avoidance patterns
        const avoidDays: string[] = [];

        // Friday avoidance
        if (/avoid\s+friday|no\s+friday|hate\s+friday|skip\s+friday|free\s+friday|friday\s+off/i.test(message)) {
            avoidDays.push('Friday');
        }

        // Monday avoidance
        if (/avoid\s+monday|no\s+monday|hate\s+monday|skip\s+monday|monday\s+blues/i.test(message)) {
            avoidDays.push('Monday');
        }

        // Tuesday avoidance
        if (/avoid\s+tuesday|no\s+tuesday|hate\s+tuesday|skip\s+tuesday/i.test(message)) {
            avoidDays.push('Tuesday');
        }

        // Wednesday avoidance
        if (/avoid\s+wednesday|no\s+wednesday|hate\s+wednesday|skip\s+wednesday/i.test(message)) {
            avoidDays.push('Wednesday');
        }

        // Thursday avoidance
        if (/avoid\s+thursday|no\s+thursday|hate\s+thursday|skip\s+thursday/i.test(message)) {
            avoidDays.push('Thursday');
        }

        if (avoidDays.length > 0) {
            preferences.avoid_days = avoidDays;
        }

        // Enhanced preferred days with more flexible patterns
        const preferredDays: string[] = [];
        const dayPreferenceMatch = message.match(/prefer\s+((?:monday|tuesday|wednesday|thursday|friday)(?:\s*,?\s*(?:and\s+)?(?:monday|tuesday|wednesday|thursday|friday))*)/gi);

        if (dayPreferenceMatch) {
            dayPreferenceMatch.forEach(match => {
                const days = match.replace(/prefer\s+/i, '').split(/\s*,?\s*(?:and\s+)?/);
                days.forEach(day => {
                    const cleanDay = day.trim().replace(/^\w/, c => c.toUpperCase());
                    if (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(cleanDay)) {
                        preferredDays.push(cleanDay);
                    }
                });
            });
        }

        // Also check for patterns like "only on" or "just on"
        const onlyDaysMatch = message.match(/(?:only\s+on|just\s+on)\s+((?:monday|tuesday|wednesday|thursday|friday)(?:\s*,?\s*(?:and\s+)?(?:monday|tuesday|wednesday|thursday|friday))*)/gi);
        if (onlyDaysMatch) {
            onlyDaysMatch.forEach(match => {
                const days = match.replace(/(?:only\s+on|just\s+on)\s+/i, '').split(/\s*,?\s*(?:and\s+)?/);
                days.forEach(day => {
                    const cleanDay = day.trim().replace(/^\w/, c => c.toUpperCase());
                    if (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(cleanDay)) {
                        preferredDays.push(cleanDay);
                    }
                });
            });
        }

        if (preferredDays.length > 0) {
            preferences.preferred_days = [...new Set(preferredDays)]; // Remove duplicates
        }

        // Enhanced compact schedule preferences
        if (/compact|close\s+together|back\s+to\s+back|minimize\s+gaps|no\s+gaps|tight\s+schedule|clustered|bunched/i.test(message)) {
            preferences.prefer_compact = true;
            preferences.max_gap_hours = 2;
        }

        // Spread out schedule preferences
        if (/spread\s+out|spaced\s+out|gaps\s+between|time\s+between|breaks\s+between/i.test(message)) {
            preferences.prefer_compact = false;
            preferences.max_gap_hours = 4;
        }

        // Enhanced specific time avoidance with more formats
        const timeAvoidances: string[] = [];

        // Match various time formats
        const timePatterns = [
            /avoid\s+(\d{1,2}:\d{2})/gi,
            /avoid\s+(\d{1,2}\s*(?:am|pm))/gi,
            /not\s+at\s+(\d{1,2}:\d{2})/gi,
            /not\s+at\s+(\d{1,2}\s*(?:am|pm))/gi,
            /no\s+(\d{1,2}:\d{2})/gi,
            /no\s+(\d{1,2}\s*(?:am|pm))/gi
        ];

        timePatterns.forEach(pattern => {
            const matches = message.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const time = match.replace(/(?:avoid|not\s+at|no)\s+/i, '').trim();
                    timeAvoidances.push(time);
                });
            }
        });

        // Parse time ranges like "avoid 8-10am" or "not between 2-4pm"
        const rangePatterns = [
            /avoid\s+(\d{1,2})\s*-\s*(\d{1,2})\s*(am|pm)?/gi,
            /not\s+between\s+(\d{1,2})\s*-\s*(\d{1,2})\s*(am|pm)?/gi,
            /no\s+classes\s+between\s+(\d{1,2})\s*-\s*(\d{1,2})\s*(am|pm)?/gi
        ];

        rangePatterns.forEach(pattern => {
            const matches = [...message.matchAll(pattern)];
            matches.forEach(match => {
                const startHour = parseInt(match[1]);
                const endHour = parseInt(match[2]);
                const period = match[3] || '';

                for (let hour = startHour; hour <= endHour; hour++) {
                    timeAvoidances.push(`${hour}:00${period}`);
                }
            });
        });

        if (timeAvoidances.length > 0) {
            preferences.avoid_times = [...new Set(timeAvoidances)]; // Remove duplicates
        }

        // Parse maximum gap preferences
        const gapMatch = message.match(/(?:max|maximum)\s+(?:gap|break)\s+(?:of\s+)?(\d+)\s*(?:hours?|hrs?)/i);
        if (gapMatch) {
            preferences.max_gap_hours = parseInt(gapMatch[1]);
        }

        // Parse specific hour preferences like "start at 9" or "finish by 4"
        const startTimeMatch = message.match(/start\s+(?:at\s+)?(\d{1,2})\s*(?::\d{2})?\s*(am|pm)?/i);
        if (startTimeMatch) {
            const hour = parseInt(startTimeMatch[1]);
            const period = startTimeMatch[2] || '';
            if (hour < 9 || (period.toLowerCase() === 'am' && hour < 9)) {
                preferences.no_early_classes = false; // Override if they specifically want early starts
            }
        }

        const finishTimeMatch = message.match(/finish\s+(?:by\s+)?(\d{1,2})\s*(?::\d{2})?\s*(am|pm)?/i);
        if (finishTimeMatch) {
            const hour = parseInt(finishTimeMatch[1]);
            const period = finishTimeMatch[2] || '';
            if ((period.toLowerCase() === 'pm' && hour < 6) || (!period && hour < 18)) {
                preferences.no_late_classes = true;
            }
        }

        return preferences;
    }

    // Enhanced course filtering with intelligent suggestions
    private async filterAndSuggestCourses(
        courses: string[],
        courseData: CourseGrouped[],
        term: string
    ): Promise<{ filteredCourses: string[], missingCourses: string[], suggestions: string[] }> {
        const availableCourseCodes = new Set(courseData.map((c: CourseGrouped) => c.courseCode.toUpperCase()));
        const filteredCourses: string[] = [];
        const missingCourses: string[] = [];
        const suggestions: string[] = [];

        for (const courseInput of courses) {
            // Handle electives intelligently
            if (/elective/i.test(courseInput)) {
                // For electives, suggest popular courses from the same level/subject if possible
                const elective = this.suggestElective(courseInput, courseData, term);
                if (elective) {
                    filteredCourses.push(elective);
                    suggestions.push(`Selected ${elective} as ${courseInput}`);
                } else {
                    missingCourses.push(courseInput);
                    suggestions.push(`Please select an elective from Kairoll for: ${courseInput}`);
                }
                continue;
            }

            // Extract just the course code (e.g., "CSI2110" from "CSI2110 | Data Structures")
            const courseCode = courseInput.split('|')[0].trim();

            if (availableCourseCodes.has(courseCode.toUpperCase())) {
                filteredCourses.push(courseCode);
            } else {
                missingCourses.push(courseCode);

                // Try to find similar courses
                const similar = this.findSimilarCourses(courseCode, courseData);
                if (similar.length > 0) {
                    suggestions.push(`${courseCode} not available. Similar: ${similar.slice(0, 3).join(', ')}`);
                }
            }
        }

        return { filteredCourses, missingCourses, suggestions };
    }

    // Suggest an appropriate elective course
    private suggestElective(electiveDescription: string, courseData: CourseGrouped[], term: string): string | null {
        // Policy: do not auto-pick electives. Inform caller to ask user to choose in Kairoll.
        
        return null;
    }

    // Find courses with similar codes
    private findSimilarCourses(targetCode: string, courseData: CourseGrouped[]): string[] {

        const subject = targetCode.substring(0, 3);
        const number = targetCode.substring(3);

        return courseData
            .filter(course => {
                const courseSubject = course.courseCode.substring(0, 3);
                const courseNumber = course.courseCode.substring(3);

                // FIRST: Only consider academic program courses
                if (!getAcademicProgramCodes().includes(courseSubject)) {
                    return false;
                }

                // Same subject, different number
                if (courseSubject === subject && courseNumber !== number) {
                    return true;
                }

                // Similar subject (same category courses)
                const subjectCategory = COURSE_CODE_PATTERNS.find(p => p.prefix === subject)?.category;
                const courseCategory = COURSE_CODE_PATTERNS.find(p => p.prefix === courseSubject)?.category;
                if (subjectCategory && courseCategory && subjectCategory === courseCategory) {
                    return courseNumber === number;
                }

                return false;
            })
            .map(course => course.courseCode)
            .slice(0, 5);
    }

    // Intelligent section GROUP selection - selects complete section groups (lecture + labs + tutorials)
    private async selectOptimalSection(
        course: CourseGrouped,
        courseCode: string,
        existingEvents: ScheduleEvent[],
        timePreferences?: TimePreference
    ): Promise<any> {
        // Get all section groups and score them as complete units
        const sectionGroups = Object.entries(course.sectionGroups);

        // Filter out previously used section groups
        const availableGroups = sectionGroups.filter(([groupId, group]) => {
            const previousSections = this.previouslySelectedSections.get(courseCode) || new Set();
            // Check if any component from this group was previously used
            const groupSections = [];
            if (group.lecture) groupSections.push(group.lecture.section);
            if (group.labs) groupSections.push(...group.labs.map(lab => lab.section));
            if (group.tutorials) groupSections.push(...group.tutorials.map(tut => tut.section));

            return !groupSections.some(section => previousSections.has(section));
        });

        const groupsToConsider = availableGroups.length > 0 ? availableGroups : sectionGroups;

        // Score each complete section group
        const scoredGroups = groupsToConsider.map(([groupId, group]) => {
            let totalScore = 0;
            let componentCount = 0;
            const groupComponents = [];

            // Collect all components from this group
            if (group.lecture) {
                groupComponents.push({ ...group.lecture, type: 'lecture' });
            }
            if (group.labs) {
                // For labs, select the best available lab section
                const bestLab = this.selectBestComponentFromGroup(group.labs, existingEvents, timePreferences);
                if (bestLab) {
                    groupComponents.push({ ...bestLab, type: 'lab' });
                }
            }
            if (group.tutorials) {
                // For tutorials/DGDs, select the best available tutorial section
                const bestTutorial = this.selectBestComponentFromGroup(group.tutorials, existingEvents, timePreferences);
                if (bestTutorial) {
                    groupComponents.push({ ...bestTutorial, type: 'tutorial' });
                }
            }

            // Score all components in this group
            for (const component of groupComponents) {
                const componentScore = this.scoreSectionFitness(component, existingEvents, timePreferences);
                totalScore += componentScore;
                componentCount++;
            }

            // Average score for the group, with bonus for having all required components
            const averageScore = componentCount > 0 ? totalScore / componentCount : 0;
            const completenessBonus = componentCount * 10; // Bonus for more complete groups

            return {
                groupId,
                group,
                components: groupComponents,
                score: averageScore + completenessBonus
            };
        });

        // Sort by score (higher is better)
        scoredGroups.sort((a, b) => b.score - a.score);

        // Strict no-conflict: filter out groups that conflict with existing events
        const groupConflictsWithExisting = (grp: any): boolean => {
            return grp.components.some((component: any) => {
                const tr = parseTimeRange(component.time);
                if (!tr) return true; // treat unparsable time as unusable
                return existingEvents.some(event => {
                    if (!component.days.some((d: string) => d === event.day_of_week)) return false;
                    const compDateRange = parseDateRange(component.meetingDates);
                    if (compDateRange && event.start_date && event.end_date) {
                        const cStart = Date.parse(compDateRange.start);
                        const cEnd = Date.parse(compDateRange.end);
                        const eStart = Date.parse(event.start_date);
                        const eEnd = Date.parse(event.end_date);
                        const overlapsDates = !(cEnd < eStart || eEnd < cStart);
                        if (!overlapsDates) return false;
                    }
                    const cStartMin = this.timeToMinutes(tr.start);
                    const cEndMin = this.timeToMinutes(tr.end);
                    const eStartMin = this.timeToMinutes(event.start_time);
                    const eEndMin = this.timeToMinutes(event.end_time);
                    return !(cEndMin <= eStartMin || cStartMin >= eEndMin);
                });
            });
        };

        const nonConflicting = scoredGroups.filter(g => !groupConflictsWithExisting(g));
        if (nonConflicting.length > 0) {
            return nonConflicting[0];
        }

        // If all conflict, return null to indicate no suitable group without conflict
        return null;
    }

    // Helper to select the best component (lab or tutorial) from multiple options in a group
    private selectBestComponentFromGroup(
        components: any[],
        existingEvents: ScheduleEvent[],
        timePreferences?: TimePreference
    ): any | null {
        if (!components || components.length === 0) return null;

        // Score each component and return the best one
        const scoredComponents = components.map(component => ({
            component,
            score: this.scoreSectionFitness(component, existingEvents, timePreferences)
        }));

        scoredComponents.sort((a, b) => b.score - a.score);
        return scoredComponents[0]?.component || null;
    }

    // Score how well a section fits with preferences and existing schedule
    private scoreSectionFitness(
        section: any,
        existingEvents: ScheduleEvent[],
        timePreferences?: TimePreference
    ): number {
        let score = 100; // Start with perfect score

        const timeRange = parseTimeRange(section.time);
        if (!timeRange) return 0; // Can't parse time, not suitable

        // Check for time conflicts (consider date range overlap)
        const sectionDateRange = parseDateRange(section.meetingDates);
        const hasConflict = existingEvents.some(event => {
            if (!section.days.some((day: string) => event.day_of_week === day)) {
                return false; // Different days, no conflict
            }

            if (sectionDateRange && event.start_date && event.end_date) {
                const sStart = Date.parse(sectionDateRange.start);
                const sEnd = Date.parse(sectionDateRange.end);
                const eStart = Date.parse(event.start_date);
                const eEnd = Date.parse(event.end_date);
                const overlapsDates = !(sEnd < eStart || eEnd < sStart);
                if (!overlapsDates) return false;
            }

            // Convert times to minutes for easier comparison
            const sectionStart = this.timeToMinutes(timeRange.start);
            const sectionEnd = this.timeToMinutes(timeRange.end);
            const eventStart = this.timeToMinutes(event.start_time);
            const eventEnd = this.timeToMinutes(event.end_time);

            // Check overlap
            return !(sectionEnd <= eventStart || sectionStart >= eventEnd);
        });

        if (hasConflict) {
            score -= 1000; // Heavy penalty for conflicts
        }

        // Apply time preferences
        if (timePreferences) {
            const startTime = this.timeToMinutes(timeRange.start);
            const endTime = this.timeToMinutes(timeRange.end);

            // No early classes preference (before 9 AM)
            if (timePreferences.no_early_classes && startTime < 540) { // 9:00 = 540 minutes
                score -= 50;
            }

            // No late classes preference (after 6 PM)
            if (timePreferences.no_late_classes && endTime > 1080) { // 18:00 = 1080 minutes
                score -= 50;
            }

            // Avoid specific days
            if (timePreferences.avoid_days) {
                const hasAvoidedDay = section.days.some((day: string) =>
                    timePreferences.avoid_days!.includes(day)
                );
                if (hasAvoidedDay) {
                    score -= 30;
                }
            }

            // Prefer specific days
            if (timePreferences.preferred_days) {
                const hasPreferredDay = section.days.some((day: string) =>
                    timePreferences.preferred_days!.includes(day)
                );
                if (hasPreferredDay) {
                    score += 20;
                }
            }
        }

        // Prefer sections with known instructors (not TBA)
        if (section.instructor && section.instructor !== 'TBA' && section.instructor !== 'Staff') {
            score += 10;
        }

        // Prefer lectures over labs/tutorials for conflicts
        if (section.type === 'lecture') {
            score += 5;
        }

        return score;
    }

    // Helper to convert time string to minutes since midnight
    private timeToMinutes(timeStr: string): number {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // Create calendar events for ALL components in a selected section group
    private createCourseEventsFromGroup(courseCode: string, course: CourseGrouped, sectionGroup: any): ScheduleEvent[] {
        const events: ScheduleEvent[] = [];

        // Create events for each component in the section group
        for (const component of sectionGroup.components) {
            const componentEvents = this.createCourseEvents(courseCode, course, component);
            events.push(...componentEvents);
        }

        return events;
    }

    // Create calendar events for a single course component (lecture, lab, or tutorial)
    private createCourseEvents(courseCode: string, course: CourseGrouped, section: any): ScheduleEvent[] {
        const events: ScheduleEvent[] = [];
        const timeRange = parseTimeRange(section.time);
        const dateRange = parseDateRange(section.meetingDates);

        if (timeRange && dateRange) {
            // If meeting date range looks too short (e.g., ~3 weeks), extend to full term end
            const start = new Date(dateRange.start);
            const end = new Date(dateRange.end);
            const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

            let adjustedEnd = dateRange.end;
            if (diffDays < 60) {
                // Avoid hardcoded term dates; extend to a typical full term length (~14 weeks)
                const extended = addWeeks(start, 14);
                if (Date.parse(extended) > Date.parse(dateRange.end)) {
                    adjustedEnd = extended;
                }
            }

            for (const day of section.days) {
                // Enhanced title to show component type
                const componentType = section.type ? ` (${section.type.toUpperCase()})` : '';
                const event: ScheduleEvent = {
                    title: `${courseCode}${componentType} - ${course.courseTitle}`,
                    start_time: timeRange.start,
                    end_time: timeRange.end,
                    day_of_week: day,
                    start_date: dateRange.start,
                    end_date: adjustedEnd,
                    description: `${courseCode} - ${section.section}\nType: ${section.type?.toUpperCase() || 'LECTURE'}\nInstructor: ${section.instructor || 'TBA'}\nLocation: ${section.location || 'TBA'}`,
                    theme: this.getCourseTheme(courseCode)
                };
                events.push(event);
            }
        }

        return events;
    }
}

// Helper to extract start and end time from a time string like "Tu 13:00 - 14:20, Th 11:30 - 12:50"
function parseTimeRange(timeStr: string): { start: string, end: string } | null {
    // Try to extract the first time range
    const match = timeStr.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (match) {
        return { start: match[1], end: match[2] };
    }
    return null;
}
// Helper to extract start and end date from meetingDates string like "2025-09-03 - 2025-12-02"
function parseDateRange(dateStr: string): { start: string, end: string } | null {
    const match = dateStr.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
    if (match) {
        return { start: match[1], end: match[2] };
    }
    return null;
}

// Infer academic term from a start date
function inferTermFromDate(startDate: Date): 'Fall' | 'Winter' | 'Summer' | null {
    const month = startDate.getMonth() + 1; // 1-12
    if (month >= 9 && month <= 12) return 'Fall';
    if (month >= 1 && month <= 4) return 'Winter';
    if (month >= 5 && month <= 8) return 'Summer';
    return null;
}

function addWeeks(date: Date, weeks: number): string {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() + weeks * 7);
    const yyyy = result.getFullYear();
    const mm = String(result.getMonth() + 1).padStart(2, '0');
    const dd = String(result.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export const scheduleGeneratorService = new ScheduleGeneratorService();