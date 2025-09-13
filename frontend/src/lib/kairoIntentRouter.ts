interface IntentResponse {
    intent: string;
    course_codes: string[];
}

interface GPTResponse {
    intent: string;
}

// Declarative intent mapping - easily maintainable and scalable
const INTENT_MAP: Record<string, string> = {
    "when_is_course_taken": "course_timing_query",
    "course_info": "course_info",
    "build_schedule": "build_schedule",
    "generate_schedule": "build_schedule",
    "reset_chat": "reset_chat",
    "schedule_builder": "build_schedule", // Future-proof example
    "course_timing": "course_timing_query",
    "course_details": "course_info",
    "program_sequence": "program_sequence",
    "course_sequence": "program_sequence",
    "curriculum": "program_sequence",
    "program_info": "program_sequence",
};

// Reset chat detection patterns - also configurable
const RESET_CHAT_PATTERNS = ["reset", "clear", "start over", "new conversation"];

function getRouterIntent(classificationIntent: string, message: string): string {
    console.log('🔧 [getRouterIntent] Input intent:', classificationIntent);

    // Handle general chat with sub-intent detection
    if (classificationIntent === "general_chat") {
        const lower = message.toLowerCase();
        if (RESET_CHAT_PATTERNS.some(pattern => lower.includes(pattern))) {
            console.log('🔧 [getRouterIntent] Mapped general_chat to reset_chat');
            return "reset_chat";
        }
        console.log('🔧 [getRouterIntent] Mapped general_chat to unknown');
        return "unknown";
    }

    // Use declarative mapping for all other intents
    const mapped = INTENT_MAP[classificationIntent] || "unknown";
    console.log('🔧 [getRouterIntent] Mapped', classificationIntent, 'to', mapped);
    return mapped;
}

function extractJSON(text: string): string {
    // Try to find JSON within code blocks first
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
        return codeBlockMatch[1].trim();
    }

    // Try to find JSON object directly
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
        return jsonMatch[0].trim();
    }

    // If nothing found, return the original text trimmed
    return text.trim();
}

export async function handle_kairo_query(message: string): Promise<IntentResponse> {
    console.log(' Enhanced AI: Analyzing message with GPT classification:', message);

    try {
        // Import the dynamic classification service  
        const { dynamicClassificationService } = await import('./dynamicClassificationService');

        // Use dynamic classification (no longer hardcoded)
        const classification = await dynamicClassificationService.classifyMessage(message);

        console.log('Enhanced classification result:', classification);

        // Extract course codes using regex as fallback
        const courseCodeRegex = /\b[A-Z]{3,4}\s?[0-9]{3,4}\b/g;
        const matches = message.match(courseCodeRegex) || [];
        const extractedCourses = matches.map(code => code.replace(/\s+/g, ''));

        // Use the course from classification or extracted courses
        const course_codes = classification.course ? [classification.course] : [...new Set(extractedCourses)];

        // Use data-driven intent mapping
        const routerIntent = getRouterIntent(classification.intent, message);

        console.log('🎯 Mapped to router intent:', routerIntent, 'with courses:', course_codes);

        return {
            intent: routerIntent,
            course_codes
        };
    } catch (error) {
        console.error('❌ Error in enhanced handle_kairo_query:', error);

        // Fallback to basic extraction
        const courseCodeRegex = /\b[A-Z]{3,4}\s?[0-9]{3,4}\b/g;
        const matches = message.match(courseCodeRegex) || [];
        const course_codes = [...new Set(matches.map(code => code.replace(/\s+/g, '')))];

        return {
            intent: 'unknown',
            course_codes
        };
    }
}

export function routeToLogic(intent: string, course_codes: string[], userMessage: string): Promise<any> {
    // This function will route to the appropriate logic handler based on intent
    // For now, we'll return a placeholder that can be expanded

    switch (intent) {
        case 'course_info':
            return handleCourseInfo(course_codes, userMessage);
        case 'course_timing_query':
            return handleCourseTimingQuery(course_codes, userMessage);
        case 'skip_consequence':
            return handleSkipConsequence(course_codes, userMessage);
        case 'prereq_check':
            return handlePrereqCheck(course_codes, userMessage);
        case 'coreq_check':
            return handleCoreqCheck(course_codes, userMessage);
        case 'course_list':
            return handleCourseList(course_codes, userMessage);
        case 'build_schedule':
            return handleBuildSchedule(userMessage);
        case 'program_sequence':
            return handleProgramSequence(userMessage);
        case 'reset_chat':
            return handleResetChat(userMessage);
        default:
            return handleUnknownIntent(userMessage);
    }
}

// Placeholder handler functions - these will be implemented later
async function handleCourseInfo(course_codes: string[], userMessage: string) {
    try {
        // Import the AI course info service
        const { aiCourseInfoService } = await import('../services/aiCourseInfoService');

        // If we have course codes from classification, use the first one
        if (course_codes.length > 0) {
            const courseCode = course_codes[0];
            const result = await aiCourseInfoService.getCourseInfo(courseCode, userMessage);

            return {
                message: result.message,
                success: result.success
            };
        }

        // If no course codes were detected, try to extract from the message with enhanced patterns
        const courseCodePatterns = [
            /\b([A-Z]{3,4})\s*(\d{3,4}[A-Z]?)\b/gi,  // CSI 2110, CSI2110, ITI1120A
            /\b([A-Z]{3,4})(\d{3,4}[A-Z]?)\b/gi,     // CSI2110, ITI1120
            /([a-z]{3,4})\s*(\d{3,4}[a-z]?)/gi,      // csi 2110, iti1120 (lowercase)
            /([a-z]{3,4})(\d{3,4}[a-z]?)/gi          // csi2110, iti1120 (lowercase)
        ];

        let courseCode = null;

        for (const pattern of courseCodePatterns) {
            const matches = [...userMessage.matchAll(pattern)];
            if (matches.length > 0) {
                const match = matches[0];
                courseCode = (match[1] + match[2]).toUpperCase().replace(/\s+/g, '');
                break;
            }
        }

        if (courseCode) {
            console.log(`🔍 [handleCourseInfo] Extracted course code: ${courseCode} from message: "${userMessage}"`);
            const result = await aiCourseInfoService.getCourseInfo(courseCode, userMessage);

            return {
                message: result.message,
                success: result.success
            };
        }

        // No course code found
        return {
            message: "I'd be happy to tell you about a course! Please include a course code in your question, like 'What is CSI 2110 about?' or 'Tell me about MAT 1341'.",
            success: false
        };

    } catch (error) {
        console.error('Error in handleCourseInfo:', error);
        return {
            message: "Sorry, I encountered an error while looking up course information. Please try again.",
            success: false
        };
    }
}

async function handleCourseTimingQuery(course_codes: string[], userMessage: string) {
    try {
        // Import the schedule generator service
        const { scheduleGeneratorService } = await import('../services/scheduleGeneratorService');

        // Use the enhanced "when is course taken" query handler
        const result = await scheduleGeneratorService.handleWhenIsCourseQuery(userMessage);

        return {
            message: result.message,
            success: result.success
        };
    } catch (error) {
        console.error('Error in handleCourseTimingQuery:', error);
        return {
            message: `Sorry, I encountered an error while looking up course timing information. Please try again.`,
            success: false
        };
    }
}

async function handleSkipConsequence(course_codes: string[], userMessage: string) {
    return { message: `Skip consequence query detected for: ${course_codes.join(', ')}` };
}

async function handlePrereqCheck(course_codes: string[], userMessage: string) {
    return { message: `Prerequisites check requested for: ${course_codes.join(', ')}` };
}

async function handleCoreqCheck(course_codes: string[], userMessage: string) {
    return { message: `Corequisites check requested for: ${course_codes.join(', ')}` };
}

async function handleCourseList(course_codes: string[], userMessage: string) {
    return { message: `Course list query detected for: ${course_codes.join(', ')}` };
}

async function handleBuildSchedule(userMessage: string) {
    console.log('[BUILD_SCHEDULE] Starting schedule generation for:', userMessage);

    try {
        // Import the schedule generator service
        const { scheduleGeneratorService } = await import('../services/scheduleGeneratorService');

        console.log('[BUILD_SCHEDULE] Calling scheduleGeneratorService.generateSchedule');
        // Use the existing schedule generation logic
        const result = await scheduleGeneratorService.generateSchedule(userMessage);

        console.log('[BUILD_SCHEDULE] Schedule generation result:', {
            success: result.success,
            eventsCount: result.events?.length || 0,
            matchedCourses: result.matched_courses?.length || 0,
            unmatchedCourses: result.unmatched_courses?.length || 0,
            errors: result.errors?.length || 0
        });

        if (result.success && result.events && result.events.length > 0) {
            console.log('[BUILD_SCHEDULE] Generated events for calendar insertion:', result.events);
            return {
                message: result.message,
                success: result.success,
                events: result.events,
                action: 'create_schedule_events'
            };
        } else {
            console.log('[BUILD_SCHEDULE] No events generated. Error details:', result.errors);
            return {
                message: result.message || "I couldn't generate a schedule. Please check your program and year details.",
                success: false
            };
        }
    } catch (error) {
        console.error('[BUILD_SCHEDULE] Error in handleBuildSchedule:', error);
        return {
            message: "Sorry, I encountered an error while generating your schedule. Please try again.",
            success: false
        };
    }
}

async function handleProgramSequence(userMessage: string) {
    try {
        // Import the program sequence service
        const { programSequenceService } = await import('../services/programSequenceService');

        console.log('[PROGRAM_SEQUENCE] Processing query:', userMessage);
        const result = await programSequenceService.processQuery(userMessage);

        if (result.success) {
            return {
                message: result.message,
                success: true,
                programSequence: result.programSequence,
                yearRequested: result.yearRequested,
                termRequested: result.termRequested,
                isFullSequence: result.isFullSequence,
                action: 'display_program_sequence'
            };
        } else {
            return {
                message: result.message,
                success: false
            };
        }
    } catch (error) {
        console.error('[PROGRAM_SEQUENCE] Error:', error);
        return {
            message: "Sorry, I encountered an error while looking up that program. Please try again.",
            success: false
        };
    }
}

async function handleResetChat(userMessage: string) {
    return {
        message: "Chat has been reset. We're starting fresh! How can I help you today?",
        action: 'reset_chat'
    };
}

async function handleUnknownIntent(userMessage: string) {
    return { message: "I didn't understand your request. Could you please rephrase?" };
}

// Legacy routing function for fallback
export async function legacyKeywordBasedRouting(userMessage: string): Promise<any> {
    // This function serves as a fallback when the intent router doesn't handle the message
    // It returns null to indicate that the legacy routing should continue in the main chat handler
    return null;
} 