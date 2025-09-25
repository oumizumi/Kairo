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
    "build_schedule": "auto_schedule_builder",
    "generate_schedule": "auto_schedule_builder",
    "schedule_generation": "auto_schedule_builder",
    "auto_schedule": "auto_schedule_builder",
    "schedule_adjustment": "schedule_adjustment",
    "modify_schedule": "schedule_adjustment",
    "adjust_schedule": "schedule_adjustment",
    "reset_chat": "reset_chat",
    "schedule_builder": "auto_schedule_builder", // Future-proof example
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
        case 'auto_schedule_builder':
            return handleAutoScheduleBuilder(userMessage);
        case 'schedule_adjustment':
            return handleScheduleAdjustment(userMessage);
        case 'program_sequence':
            return handleProgramSequence(userMessage);
        case 'reset_chat':
            return handleResetChat(userMessage);
        default:
            return handleUnknownIntent(userMessage);
    }
}

// Auto Schedule Builder handlers
async function handleAutoScheduleBuilder(userMessage: string) {
    try {
        const { autoScheduleBuilderService } = await import('@/services/autoScheduleBuilderService');
        
        // Parse time preferences from the message
        const preferences = autoScheduleBuilderService.parseTimePreferences(userMessage);
        
        // Build the schedule
        const result = await autoScheduleBuilderService.buildSchedule({
            message: userMessage,
            preferences
        });
        
        if (result.success) {
            const totalCourses = result.schedules.reduce((total, schedule) => total + schedule.total_courses, 0);
            const termsList = result.schedules.map(s => s.term_display).join(' and ');
            
            return {
                type: 'auto_schedule_success',
                message: `✅ ${result.message}\n\nBuilt schedules for ${termsList} with ${totalCourses} total courses.\n\nYou can view your schedule in the calendar or make adjustments by saying things like:\n• "Remove CSI 2110"\n• "No Friday classes"\n• "Avoid 8am classes"\n• "Prefer Prof. Smith"`,
                schedules: result.schedules,
                events: autoScheduleBuilderService.convertToCalendarEvents(result.schedules)
            };
        } else {
            return {
                type: 'auto_schedule_error',
                message: `❌ ${result.message}\n\nTry being more specific, like:\n• "Build my Fall schedule"\n• "Generate Winter schedule for Software Engineering Year 2"\n• "Create my schedule with no 8am classes"`
            };
        }
    } catch (error) {
        console.error('Error in auto schedule builder:', error);
        return {
            type: 'error',
            message: 'Sorry, I encountered an error while building your schedule. Please try again.'
        };
    }
}

async function handleScheduleAdjustment(userMessage: string) {
    try {
        const { autoScheduleBuilderService } = await import('@/services/autoScheduleBuilderService');
        
        // Get current schedules first
        const currentSchedules = await autoScheduleBuilderService.getCurrentSchedules();
        
        if (!currentSchedules.success || currentSchedules.schedules.length === 0) {
            return {
                type: 'schedule_adjustment_error',
                message: "❌ No active schedules found to adjust. Please build a schedule first by saying something like 'Build my Fall schedule'."
            };
        }
        
        // For now, apply adjustment to the first schedule
        // TODO: Could be enhanced to detect which schedule to adjust
        const scheduleId = currentSchedules.schedules[0].id;
        
        const result = await autoScheduleBuilderService.adjustSchedule(scheduleId, userMessage);
        
        if (result.success) {
            // Get updated schedules
            const updatedSchedules = await autoScheduleBuilderService.getCurrentSchedules();
            
            return {
                type: 'schedule_adjustment_success',
                message: `✅ ${result.message}\n\nYour schedule has been updated. You can make more adjustments or view the changes in your calendar.`,
                schedules: updatedSchedules.success ? updatedSchedules.schedules : [],
                events: updatedSchedules.success ? autoScheduleBuilderService.convertToCalendarEvents(updatedSchedules.schedules) : []
            };
        } else {
            return {
                type: 'schedule_adjustment_error',
                message: `❌ ${result.message}\n\nTry adjustments like:\n• "Remove CSI 2110"\n• "No Friday labs"\n• "Avoid 8am classes"`
            };
        }
    } catch (error) {
        console.error('Error in schedule adjustment:', error);
        return {
            type: 'error',
            message: 'Sorry, I encountered an error while adjusting your schedule. Please try again.'
        };
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

// Legacy schedule builder - deprecated, redirects to new auto schedule builder
async function handleBuildSchedule(userMessage: string) {
    console.warn('[DEPRECATED] handleBuildSchedule called - redirecting to auto schedule builder');
    return await handleAutoScheduleBuilder(userMessage);
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