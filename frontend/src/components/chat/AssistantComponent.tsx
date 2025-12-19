'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUp, ArrowRight, ThumbsUp, ThumbsDown, Copy, Check } from 'lucide-react';
import api, { 
    getCalendarEvents, 
    createCalendarEvent, 
    deleteCalendarEvent, 
    parseAndCreateCalendarEvents,
    getFunnyMessage 
} from '@/lib/api';
import { parseNaturalLanguage, isNaturalLanguage } from '@/lib/naturalLanguageParser';
import { aiCourseService } from '@/services/aiCourseService';
import { scheduleGeneratorService } from '@/services/scheduleGeneratorService';
import { persistentCalendarService } from '@/services/persistentCalendarService';
import { handle_kairo_query, routeToLogic, legacyKeywordBasedRouting } from '@/lib/kairoIntentRouter';
import TypewriterText from '@/components/TypewriterText';
import MessageContent from '@/components/MessageContent';
import CurriculumDisplay from '@/components/CurriculumDisplay';
import ChatEmailButton from '@/components/ChatEmailButton';

// Types
interface ChatMessage {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: Date;
    curriculumData?: any;
    yearRequested?: number;
    termRequested?: string;
    isFullSequence?: boolean;
}

interface BackendMessage {
    id: number;
    content: string;
    role: string;
    timestamp: string;
}

interface ApiCalendarEvent {
    id?: number;
    title: string;
    day_of_week?: string;
    start_time: string;
    end_time: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    professor?: string;
    recurrence_pattern?: string;
    theme?: string;
}

export interface AssistantComponentProps {
    onEventAdded?: () => void;
}

// Simple Animated Placeholder Hook
function useAnimatedPlaceholder() {
    const exampleQuestions = [
        'Ask Kairo about courses or scheduling… or tap the envelope to write an email',
        'Generate my Winter 2026 schedule for first year CS...',
        'Create a schedule for second year winter mechanical engineering...',
        'What are the prerequisites for CSI2110?',
        'What is ITI1121 about?',
        'Generate schedule for first year fall computer science without 8:30 am classes...',
        'Help me plan my course sequence for graduation',
        'Ask Kairo about courses or scheduling… or tap the envelope to write an email'
    ];

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setIsVisible(false);
            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % exampleQuestions.length);
                setIsVisible(true);
            }, 500);
        }, 3000);

        return () => clearInterval(interval);
    }, [exampleQuestions.length]);

    return {
        displayText: exampleQuestions[currentIndex],
        isVisible
    };
}

function isProfessorComparisonQuestion(userInput: string): boolean {
    const patterns = [
        /who('?s| is) the best professor for ([a-z]{3}\d{4})/i,
        /which prof(essor)? is better for ([a-z]{3}\d{4})/i,
        /who should i take for ([a-z]{3}\d{4})/i,
        /best prof(essor)? for ([a-z]{3}\d{4})/i,
        /professor recommendation for ([a-z]{3}\d{4})/i,
    ];
    return patterns.some(pattern => pattern.test(userInput));
}

function extractCourseCode(userInput: string): string | null {
    const match = userInput.match(/([a-z]{3}\d{4})/i);
    return match ? match[1].toLowerCase() : null;
}

function isCurriculumQuestion(userInput: string): boolean {
    const normalizedInput = userInput.toLowerCase();

    const explicitCurriculumKeywords = [
        'course sequence', 'curriculum', 'what courses should i take', 'what should i take',
        'course requirements', 'required courses', 'program requirements', 'course list',
        'what classes should i take', 'what are the courses', 'courses for', 'sequence for',
        'course plan', 'academic plan', 'degree requirements', 'program requirements',
        'what courses', 'which courses', 'course structure', 'program structure'
    ];

    const hasExplicitCurriculumKeyword = explicitCurriculumKeywords.some(keyword =>
        normalizedInput.includes(keyword)
    );

    if (hasExplicitCurriculumKeyword) {
        return true;
    }

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

function isIndividualCourseDeletionRequest(userInput: string): boolean {
    const deletionKeywords = [
        'remove', 'delete', 'clear', 'drop', 'cancel', 'unschedule'
    ];

    const coursePatterns = [
        /\b[A-Z]{3}\s*\d{4}\b/g,
        /\b[A-Z]{3}\d{4}\b/g
    ];

    const normalizedInput = userInput.toLowerCase();
    const hasDeletionKeyword = deletionKeywords.some(keyword => normalizedInput.includes(keyword));
    const hasCourseCode = coursePatterns.some(pattern => pattern.exec(userInput));

    return hasDeletionKeyword && hasCourseCode;
}

function extractCourseCodesFromText(text: string): string[] {
    const coursePatterns = [
        /\b([A-Z]{3})\s*(\d{4})\b/g,
        /\b([A-Z]{3})(\d{4})\b/g
    ];

    const courseCodes: string[] = [];

    coursePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const courseCode = `${match[1]} ${match[2]}`;
            if (!courseCodes.includes(courseCode)) {
                courseCodes.push(courseCode);
            }
        }
    });

    return courseCodes;
}

function isCourseAvailabilityQuestion(userInput: string): boolean {
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

async function checkCourseAvailability(courseCode: string, term?: string): Promise<{
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
                message: `Yes! **${courseCode}** is available in: **${termsList}**.\n\n🎯 **Want to see sections and schedules?** Head over to **Kairoll** to explore detailed course information, check professor ratings, and add it to your schedule!\n\n*Click the "Kairoll" tab above to get started!*`
            };
        } else {
            return {
                available: false,
                availableTerms: [],
                message: `I couldn't find **${courseCode}** in our current course offerings. This could mean:\n\n• The course isn't offered in Fall 2025, Winter 2026, or Spring/Summer 2025\n• The course code might be incorrect\n• It might be a new course not yet in our database\n\n💡 **Try checking in Kairoll** for the most up-to-date course listings, or double-check the course code!`
            };
        }
    } catch (error) {
        console.error('Error checking course availability:', error);
        return {
            available: false,
            availableTerms: [],
            message: `I'm having trouble accessing the course database right now. Please try checking **Kairoll** directly for the most current course information!`
        };
    }
}

function shouldProvideHonestResponse(userInput: string): { shouldRespond: boolean; response?: string } {
    const normalizedInput = userInput.toLowerCase().trim();

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
                    response: "I'm Kairo! 🎓 I'm your AI academic assistant here to help you navigate your uOttawa journey. Whether you need help with course scheduling, finding the perfect program, or planning your degree, I'm here to make your academic life easier and more organized! ✨\n\nWhat can I help you with today?"
                };
            }

            if (/(?:what.*can.*you.*do|how.*can.*you.*help|what.*are.*you.*for)/i.test(normalizedInput)) {
                return {
                    shouldRespond: true,
                    response: "Hey! I'm Kairo, and I'm here to make your uOttawa academic experience amazing! 🎓✨\n\n" +
                        "Here's what I can help you with:\n" +
                        "• **Smart scheduling** - Create optimized schedules that work with your life\n" +
                        "• **Course discovery** - Find courses, check prerequisites, and read descriptions\n" +
                        "• **Program guidance** - Navigate degree requirements and curriculum sequences\n" +
                        "• **Calendar management** - Keep track of classes, exams, and important dates\n" +
                        "• **Academic planning** - Plan your entire degree pathway\n\n" +
                        "Just ask me anything about courses, schedules, or your academic journey!"
                };
            }

            return {
                shouldRespond: true,
                response: "Hey there! I'm Kairo, your friendly academic assistant! 🎓 Ready to help you with course planning, scheduling, or anything else related to your uOttawa journey. What's on your mind?"
            };
        }
    }

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
            response: "I'm not sure about that specific question - I'd recommend doing your own research to get the most accurate information.\n\n" +
                "We're actively working on adding more comprehensive data to help answer a wider range of questions. In the meantime, I can definitely help you with:\n\n" +
                "• Course scheduling and planning\n" +
                "• Degree requirements and curriculum sequences\n" +
                "• Course descriptions and prerequisites\n" +
                "• Building optimized schedules \n\n" +
                "For questions outside my current knowledge base, please consult official uOttawa resources, your academic advisor, or do independent research to ensure you get reliable information.\n\n" +
                "Is there anything related to academic planning or course selection I can help you with instead? 🎓"
        };
    }

    return { shouldRespond: false };
}

export function AssistantComponent({ onEventAdded }: AssistantComponentProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hasStartedConversation, setHasStartedConversation] = useState(false);
    const [typingMessage, setTypingMessage] = useState<string>('');
    const [isTyping, setIsTyping] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isSmallScreen, setIsSmallScreen] = useState(false);
    const [messageFeedback, setMessageFeedback] = useState<Record<string, 'up' | 'down' | null>>({});
    const [copiedMessages, setCopiedMessages] = useState<Record<string, boolean>>({});

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
    const [isInputFocused, setIsInputFocused] = useState(false);

    const { displayText, isVisible } = useAnimatedPlaceholder();

    // Track screen size for mobile navigation
    useEffect(() => {
        const checkScreenSize = () => {
            setIsSmallScreen(window.innerWidth < 640);
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    // Load session and conversation history on component mount
    useEffect(() => {
        const loadSession = async () => {
            const savedSessionId = sessionStorage.getItem('kairo_session_id');

            if (savedSessionId) {
                setIsLoadingHistory(true);
                try {
                    const response = await api.get(`/api/ai/chat/?session_id=${savedSessionId}`);

                    if (response.data && response.data.length > 0) {
                        const loadedMessages: ChatMessage[] = response.data.map((msg: BackendMessage) => ({
                            id: msg.id.toString(),
                            content: msg.content,
                            role: msg.role as 'user' | 'assistant',
                            timestamp: new Date(msg.timestamp)
                        }));

                        setMessages(loadedMessages);
                        setSessionId(savedSessionId);
                        setHasStartedConversation(true);
                    } else {
                        setSessionId(savedSessionId);
                    }
                } catch (error) {
                    console.error('Error loading conversation history:', error);
                    sessionStorage.removeItem('kairo_session_id');
                    setSessionId(null);
                }
                setIsLoadingHistory(false);
            }
        };

        loadSession();
    }, []);

    // Auto-scroll to bottom when new messages arrive
    const scrollToBottom = useCallback(() => {
        if (!isAutoScrollEnabled) return;
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [isAutoScrollEnabled]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, typingMessage, scrollToBottom]);

    const handleScroll = () => {
        const el = messagesContainerRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        setIsAutoScrollEnabled(distanceFromBottom < 100);
    };

    // Function to clear conversation and start fresh
    const clearConversation = () => {
        setMessages([]);
        setSessionId(null);
        setHasStartedConversation(false);
        sessionStorage.removeItem('kairo_session_id');
        aiCourseService.clearContext();
    };

    // Handle message feedback
    const handleMessageFeedback = (messageId: string, feedback: 'up' | 'down') => {
        setMessageFeedback(prev => ({
            ...prev,
            [messageId]: prev[messageId] === feedback ? null : feedback
        }));
        console.log(`Feedback for message ${messageId}: ${feedback}`);
    };

    // Handle copy message
    const handleCopyMessage = async (messageId: string, content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedMessages(prev => ({ ...prev, [messageId]: true }));
            setTimeout(() => {
                setCopiedMessages(prev => ({ ...prev, [messageId]: false }));
            }, 2000);
        } catch (error) {
            console.error('Failed to copy message:', error);
        }
    };

    // Function to handle individual course deletion requests
    const handleIndividualCourseDeletion = async (userInput: string): Promise<{ message: string }> => {
        const courseCodes = extractCourseCodesFromText(userInput);

        if (courseCodes.length === 0) {
            const { deletionService } = await import('@/services/deletionService');

            const result = await deletionService.handleDeletionRequest({
                type: 'course',
                message: userInput
            });

            if (result.success) {
                if (onEventAdded) {
                    onEventAdded();
                }
                return { message: result.message };
            } else {
                return {
                    message: result.message || "I couldn't find any course codes in your request. Please specify the course code (e.g., 'remove CSI 2110')."
                };
            }
        }

        try {
            const { deletionService } = await import('@/services/deletionService');

            const result = await deletionService.handleDeletionRequest({
                type: 'course',
                target: courseCodes[0]
            });

            if (courseCodes.length > 1) {
                const batchResult = await deletionService.handleDeletionRequest({
                    type: 'course',
                    message: `Remove courses: ${courseCodes.join(', ')}`
                });

                if (onEventAdded) {
                    onEventAdded();
                }

                return { message: batchResult.message };
            }

            if (onEventAdded) {
                onEventAdded();
            }

            return { message: result.message };

        } catch (error) {
            console.error('Error in course deletion:', error);
            return { message: `Failed to delete courses: ${error}` };
        }
    };

    // Natural typing animation function
    const typeMessage = (fullMessage: string, messageId: string) => {
        setIsTyping(true);
        setTypingMessage('');

        const words = fullMessage.split(' ');
        let currentWordIndex = 0;
        let currentText = '';

        const typeNextWord = () => {
            if (currentWordIndex < words.length) {
                currentText += (currentWordIndex > 0 ? ' ' : '') + words[currentWordIndex];
                setTypingMessage(currentText);
                currentWordIndex++;

                let delay = 15;

                if (currentText.endsWith('.') || currentText.endsWith('!') || currentText.endsWith('?')) {
                    delay = 80;
                } else if (currentText.endsWith(',') || currentText.endsWith(';')) {
                    delay = 40;
                } else if (currentText.endsWith('\n')) {
                    delay = 60;
                } else {
                    delay = 10 + Math.random() * 15;
                }

                setTimeout(typeNextWord, delay);
            } else {
                setTimeout(() => {
                    setIsTyping(false);
                    setTypingMessage('');

                    const assistantMessage: ChatMessage = {
                        id: messageId,
                        content: fullMessage,
                        role: 'assistant',
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, assistantMessage]);
                }, 100);
            }
        };

        setTimeout(typeNextWord, 200);
    };

    // CONTINUED IN NEXT PART - sendMessage function
    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            content: inputMessage.trim(),
            role: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);
        setHasStartedConversation(true);

        try {
            // Check if Kairo should provide an honest response
            const honestResponse = shouldProvideHonestResponse(userMessage.content);
            if (honestResponse.shouldRespond && honestResponse.response) {
                const assistantMessageId = (Date.now() + 1).toString();
                typeMessage(honestResponse.response, assistantMessageId);
                setIsLoading(false);
                return;
            }

            // Intent-based routing system
            const USE_INTENT_ROUTER = true;

            if (USE_INTENT_ROUTER) {
                try {
                    const { intent, course_codes } = await handle_kairo_query(userMessage.content);

                    if (intent !== 'unknown') {
                        const intentResult = await routeToLogic(intent, course_codes, userMessage.content);

                        if (intentResult.action === 'reset_chat') {
                            clearConversation();
                        } else if (intentResult.type === 'auto_schedule_success' && intentResult.events && intentResult.events.length > 0) {
                            try {
                                const createdEvents = [];
                                for (const event of intentResult.events) {
                                    try {
                                        const calendarEventData = {
                                            title: event.title,
                                            start_time: event.start_time,
                                            end_time: event.end_time,
                                            day_of_week: event.day_of_week,
                                            start_date: event.start_date,
                                            end_date: event.end_date,
                                            description: event.description,
                                            professor: event.instructor || '',
                                            recurrence_pattern: 'weekly' as const,
                                            theme: event.theme || 'blue-purple-magenta'
                                        };
                                        const apiEvent = await createCalendarEvent(calendarEventData);
                                        createdEvents.push(apiEvent);
                                    } catch (error) {
                                        console.error('Failed to create auto schedule calendar event:', error);
                                    }
                                }

                                if (onEventAdded && createdEvents.length > 0) {
                                    onEventAdded();
                                }
                            } catch (error) {
                                console.error('Error creating auto schedule events:', error);
                            }
                        } else if (intentResult.type === 'schedule_adjustment_success' && intentResult.events && intentResult.events.length > 0) {
                            try {
                                if (onEventAdded) {
                                    onEventAdded();
                                }
                            } catch (error) {
                                console.error('Error handling schedule adjustment:', error);
                            }
                        } else if (intentResult.action === 'create_schedule_events' && intentResult.events && intentResult.events.length > 0) {
                            try {
                                const createdEvents = [];
                                for (const event of intentResult.events) {
                                    try {
                                        const apiEvent = await createCalendarEvent(event);
                                        createdEvents.push(apiEvent);
                                    } catch (error) {
                                        console.error('Failed to create calendar event:', error);
                                    }
                                }

                                if (onEventAdded && createdEvents.length > 0) {
                                    onEventAdded();
                                }
                            } catch (error) {
                                console.error('Error creating schedule events:', error);
                            }
                        } else if (intentResult.action === 'display_program_sequence' && intentResult.programSequence) {
                            const assistantMessageId = (Date.now() + 1).toString();
                            const messageWithData: ChatMessage = {
                                id: assistantMessageId,
                                content: '',
                                role: 'assistant',
                                timestamp: new Date(),
                                curriculumData: intentResult.programSequence,
                                yearRequested: intentResult.yearRequested,
                                termRequested: intentResult.termRequested,
                                isFullSequence: intentResult.isFullSequence
                            };

                            setMessages(prev => [...prev, messageWithData]);
                            setIsLoading(false);
                            return;
                        }

                        const assistantMessageId = (Date.now() + 1).toString();
                        typeMessage(intentResult.message, assistantMessageId);
                        setIsLoading(false);
                        return;
                    } else {
                        if (userMessage.content.toLowerCase().includes('schedule') ||
                            userMessage.content.toLowerCase().includes('generate')) {
                            const errorMessage = "I couldn't understand that schedule request. Please be more specific about your program and year (e.g., 'Generate a 2nd year Computer Science fall schedule').";
                            const assistantMessageId = (Date.now() + 1).toString();
                            typeMessage(errorMessage, assistantMessageId);
                            setIsLoading(false);
                            return;
                        }
                    }
                } catch (error) {
                    console.error('❌ Error in intent routing, falling back to legacy:', error);
                }
            } else {
                const legacyResult = await legacyKeywordBasedRouting(userMessage.content);
                if (legacyResult) {
                    const assistantMessageId = (Date.now() + 1).toString();
                    typeMessage(legacyResult.message, assistantMessageId);
                    setIsLoading(false);
                    return;
                }
            }

            // Check for course availability questions
            if (isCourseAvailabilityQuestion(userMessage.content)) {
                try {
                    const courseCodes = extractCourseCodesFromText(userMessage.content);
                    if (courseCodes.length > 0) {
                        const courseCode = courseCodes[0];
                        const availabilityResult = await checkCourseAvailability(courseCode);
                        const assistantMessageId = (Date.now() + 1).toString();
                        typeMessage(availabilityResult.message, assistantMessageId);
                        setIsLoading(false);
                        return;
                    }
                } catch (availabilityError) {
                    console.error('❌ Course availability check failed:', availabilityError);
                }
            }

            // Check for individual course deletion requests
            if (isIndividualCourseDeletionRequest(userMessage.content)) {
                try {
                    const deletionResult = await handleIndividualCourseDeletion(userMessage.content);
                    const assistantMessageId = (Date.now() + 1).toString();
                    typeMessage(deletionResult.message, assistantMessageId);
                    setIsLoading(false);
                    return;
                } catch (deletionError) {
                    console.error('❌ Individual course deletion failed:', deletionError);
                }
            }

            // Check for individual course changes
            const changeRequest = scheduleGeneratorService.isRequestingIndividualChange(userMessage.content);
            if (changeRequest.isChange && changeRequest.courseCode) {
                try {
                    const changeResult = await scheduleGeneratorService.changeIndividualCourse(
                        changeRequest.courseCode,
                        changeRequest.component || 'course',
                        scheduleGeneratorService.parseTimePreferences(userMessage.content)
                    );

                    if (changeResult.success && changeResult.events.length > 0) {
                        try {
                            const currentEvents = await getCalendarEvents();
                            const coursePattern = new RegExp(`\\b${changeRequest.courseCode}\\b`, 'i');
                            const eventsToDelete = currentEvents.filter(event =>
                                coursePattern.test(event.title) || coursePattern.test(event.description || '')
                            );

                            for (const event of eventsToDelete) {
                                if (event.id) {
                                    await deleteCalendarEvent(event.id);
                                }
                            }
                        } catch (deleteError) {
                            console.warn('⚠️ Failed to delete old course events:', deleteError);
                        }

                        try {
                            await persistentCalendarService.saveMultipleEvents(
                                changeResult.events.map(event => ({
                                    title: event.title,
                                    startTime: event.start_time,
                                    endTime: event.end_time,
                                    day_of_week: event.day_of_week,
                                    start_date: event.start_date,
                                    end_date: event.end_date,
                                    description: event.description,
                                    theme: event.theme || 'blue-gradient'
                                }))
                            );
                        } catch (error) {
                            console.error('❌ Failed to save course change events:', error);
                            for (const event of changeResult.events) {
                                try {
                                    await createCalendarEvent(event);
                                } catch (legacyError) {
                                    console.error('❌ Failed to create calendar event via legacy API:', legacyError);
                                }
                            }
                        }

                        if (onEventAdded) {
                            onEventAdded();
                        }
                    }

                    const assistantMessageId = (Date.now() + 1).toString();
                    typeMessage(changeResult.message, assistantMessageId);
                    setIsLoading(false);
                    return;

                } catch (changeError) {
                    console.error('❌ Individual course change failed:', changeError);
                    const errorMessage = `I had trouble changing that course section. Please try again or generate a new schedule instead.`;
                    const assistantMessageId = (Date.now() + 1).toString();
                    typeMessage(errorMessage, assistantMessageId);
                    setIsLoading(false);
                    return;
                }
            }

            // Check for curriculum questions
            const isCurriculumQ = isCurriculumQuestion(userMessage.content);

            if (isCurriculumQ) {
                try {
                    const curriculumResult = null;
                    if (curriculumResult) {
                        const assistantMessageId = (Date.now() + 1).toString();

                        const curriculumMessage: ChatMessage & { curriculumData?: any } = {
                            id: assistantMessageId,
                            content: '',
                            role: 'assistant',
                            timestamp: new Date(),
                            curriculumData: curriculumResult
                        };

                        setMessages(prevMessages => [...prevMessages, curriculumMessage]);
                        setIsLoading(false);
                        return;
                    } else {
                        const honestCurriculumResponse = "I don't have information about that specific program or course sequence in my curriculum database. I can help you with:\n\n" +
                            "📚 **Available programs at uOttawa** that I have curriculum data for\n" +
                            "🔍 **Course sequences** for programs like Computer Science, Engineering, Political Science, Economics, Psychology, etc.\n" +
                            "📋 **Degree requirements** for specific programs I have data for\n\n" +
                            "Try asking about a specific program like:\n" +
                            "• \"Computer Science course sequence\"\n" +
                            "• \"2nd year Political Science courses\"\n" +
                            "• \"Engineering curriculum\"\n\n" +
                            "Or ask me to show you what programs I have information for!";

                        const assistantMessageId = (Date.now() + 1).toString();
                        typeMessage(honestCurriculumResponse, assistantMessageId);
                        setIsLoading(false);
                        return;
                    }
                } catch (curriculumError) {
                    const errorResponse = "I'm having trouble accessing my curriculum database right now. Please try again in a moment, or ask me about something else I can help with like schedule generation or course information.";
                    const assistantMessageId = (Date.now() + 1).toString();
                    typeMessage(errorResponse, assistantMessageId);
                    setIsLoading(false);
                    return;
                }
            }

            // Check for "when is course taken" queries
            if (scheduleGeneratorService.isWhenIsCourseQuery(userMessage.content)) {
                try {
                    const whenResult = await scheduleGeneratorService.handleWhenIsCourseQuery(userMessage.content);

                    if (whenResult.success) {
                        const assistantMessageId = (Date.now() + 1).toString();
                        typeMessage(whenResult.message, assistantMessageId);
                        setIsLoading(false);
                        return;
                    } else {
                        const errorMessage = whenResult.message + "\n\n💡 Try asking like: 'When do I take CSI2110 in Software Engineering?' or 'What year is MAT1341 in Computer Science?'";
                        const assistantMessageId = (Date.now() + 1).toString();
                        typeMessage(errorMessage, assistantMessageId);
                        setIsLoading(false);
                        return;
                    }
                } catch (whenError) {
                    console.error('❌ When is course query failed:', whenError);
                }
            }

            // Check for course information queries
            const isCourseQuery = aiCourseService.isCourseInfoQuery(userMessage.content);

            if (isCourseQuery) {
                try {
                    const courseCodeMatch = userMessage.content.match(/\b([A-Z]{3,4})\s*(\d{3,4})\b/i);

                    if (courseCodeMatch) {
                        const courseCode = `${courseCodeMatch[1]}${courseCodeMatch[2]}`.toUpperCase();

                        const { aiCourseInfoService } = await import('@/services/aiCourseInfoService');
                        const courseResponse = await aiCourseInfoService.getCourseInfo(courseCode, userMessage.content);

                        if (courseResponse.success) {
                            const assistantMessageId = (Date.now() + 1).toString();
                            typeMessage(courseResponse.message, assistantMessageId);
                            setIsLoading(false);
                            return;
                        } else {
                            const notFoundMessage = `${courseResponse.message}\n\n💡 **Here are some things I can help you with:**\n\n📚 Ask about course descriptions: "What is CSI 2110 about?"\n📋 Check prerequisites: "What are the prerequisites for MAT 1341?"\n💳 Get credit information: "How many credits is ITI 1120?"\n\n🎯 Make sure to use the correct course code format (e.g., CSI 2110, not CSI2110).`;

                            const assistantMessageId = (Date.now() + 1).toString();
                            typeMessage(notFoundMessage, assistantMessageId);
                            setIsLoading(false);
                            return;
                        }
                    }
                } catch (courseError) {
                    console.error('❌ Course query failed:', courseError);
                    const errorMessage = "I'm having trouble accessing course information right now. Please try again in a moment.\n\n💡 In the meantime, you can:\n\n📅 Generate your course schedule\n🗓️ Add events to your calendar\n📋 Ask about curriculum requirements";
                    const assistantMessageId = (Date.now() + 1).toString();
                    typeMessage(errorMessage, assistantMessageId);
                    setIsLoading(false);
                    return;
                }
            }

            // Check for schedule generation requests
            const isScheduleGenRequest = await scheduleGeneratorService.isScheduleGenerationRequest(userMessage.content);

            if (isScheduleGenRequest) {
                const isReplacement = scheduleGeneratorService.isRequestingNewSchedule(userMessage.content);
                if (isReplacement) {
                    const replacementMessage = "🔄 Replacing your current schedule with a new one...";
                    const replacementMessageId = Date.now().toString();
                    typeMessage(replacementMessage, replacementMessageId);

                    try {
                        const currentEvents = await getCalendarEvents();
                        if (currentEvents && currentEvents.length > 0) {
                            for (const event of currentEvents) {
                                if (event.id) {
                                    await deleteCalendarEvent(event.id);
                                }
                            }
                        }

                        try {
                            await persistentCalendarService.clearUserCalendar();
                        } catch (persistentError) {
                            console.warn('⚠️ Failed to clear persistent storage:', persistentError);
                        }

                        if (onEventAdded) {
                            onEventAdded();
                        }

                    } catch (clearError) {
                        console.error('❌ Failed to clear existing events:', clearError);
                        const errorMessage = "⚠️ Had trouble clearing some old events, but creating your new schedule...";
                        const errorMessageId = Date.now().toString();
                        typeMessage(errorMessage, errorMessageId);
                    }
                }

                try {
                    const scheduleResult = await scheduleGeneratorService.generateSchedule(userMessage.content);

                    if (scheduleResult.success && scheduleResult.events.length > 0) {
                        try {
                            const result = await persistentCalendarService.saveMultipleEvents(
                                scheduleResult.events.map(event => ({
                                    title: event.title,
                                    startTime: event.start_time,
                                    endTime: event.end_time,
                                    day_of_week: event.day_of_week,
                                    start_date: event.start_date,
                                    end_date: event.end_date,
                                    description: event.description,
                                    theme: event.theme || 'blue-gradient'
                                }))
                            );

                            if (result.total_errors > 0) {
                                console.warn('⚠️ Some events failed to save:', result.errors);
                            }
                        } catch (error) {
                            console.error('❌ Failed to save schedule events:', error);
                            const createdEvents = [];
                            for (const event of scheduleResult.events) {
                                try {
                                    const apiEvent = await createCalendarEvent(event);
                                    createdEvents.push(apiEvent);
                                } catch (legacyError) {
                                    console.error('❌ Failed to create calendar event via legacy API:', legacyError);
                                }
                            }
                        }

                        if (onEventAdded) {
                            onEventAdded();
                        }
                    }

                    let confirmationMessage = '';
                    if (scheduleResult.success && scheduleResult.events.length > 0) {
                        try {
                            const { dynamicClassificationService } = await import('@/lib/dynamicClassificationService');
                            const classification = await dynamicClassificationService.classifyMessage(userMessage.content);
                            const program = classification.program || 'Unknown Program';
                            const year = typeof classification.year === 'number' ? classification.year : 1;
                            const responseData = {
                                events: scheduleResult.events,
                                matched_courses: scheduleResult.matched_courses || [],
                                unmatched_courses: scheduleResult.unmatched_courses || [],
                                program,
                                year,
                                user_message: userMessage.content
                            };

                            const gptResponse = await api.post('/api/ai/schedule-response/', responseData);
                            confirmationMessage = gptResponse.data.response;
                            const electiveCount = (scheduleResult.unmatched_courses || []).filter(c => /Elective/i.test(c)).length;
                            if (electiveCount > 0) {
                                const variants = [
                                    (n: number) => `You're missing ${n} elective${n > 1 ? 's' : ''}. Use Kairoll to choose non-conflicting times and add them.`,
                                    (n: number) => `${n} elective${n > 1 ? 's are' : ' is'} still open — pick a section in Kairoll that doesn't clash and add it.`,
                                    (n: number) => `Reminder: add ${n} elective${n > 1 ? 's' : ''}. Browse in Kairoll and pick times that don't overlap.`,
                                ];
                                const variant = variants[Math.floor(Math.random() * variants.length)](electiveCount);
                                confirmationMessage = `${confirmationMessage}\n\n${variant}`;
                            }
                        } catch (error) {
                            console.error('❌ Failed to generate GPT response, using fallback:', error);
                            confirmationMessage = `Generated your schedule with ${scheduleResult.events.length} classes added to your calendar.`;
                            if (scheduleResult.unmatched_courses.length > 0) {
                                confirmationMessage += ` Couldn't schedule: ${scheduleResult.unmatched_courses.join(', ')}.`;
                            }
                            const variants = [
                                "You're still missing an elective. Use Kairoll to browse and add one.",
                                "Looks like an elective slot is open — hop into Kairoll to pick one.",
                                "You'll need to choose an elective. Kairoll can help you explore and add it.",
                                "Don't forget an elective to round it out. Search and add via Kairoll.",
                                "An elective is still pending. Use Kairoll to find and add the best fit."
                            ];
                            if (scheduleResult.unmatched_courses.some(c => /Elective/i.test(c))) {
                                const variant = variants[Math.floor(Math.random() * variants.length)];
                                confirmationMessage += ` ${variant}`;
                            }
                        }
                    } else {
                        confirmationMessage = scheduleResult.message;
                    }

                    const assistantMessageId = (Date.now() + 1).toString();
                    typeMessage(confirmationMessage, assistantMessageId);
                    setIsLoading(false);
                    return;

                } catch (scheduleError) {
                    console.error('❌ Schedule generation failed:', scheduleError);
                }
            }

            // Normal AI flow - prepare request payload
            const requestPayload: {
                message: string;
                session_id?: string;
                conversation_history?: Array<{ role: string; content: string; timestamp: string }>;
                context_summary?: string;
            } = {
                message: userMessage.content
            };

            if (sessionId) {
                requestPayload.session_id = sessionId;
            }

            const recentMessages = messages.slice(-10).map(msg => ({
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp.toISOString()
            }));

            recentMessages.push({
                role: userMessage.role,
                content: userMessage.content,
                timestamp: userMessage.timestamp.toISOString()
            });

            requestPayload.conversation_history = recentMessages;

            if (messages.length > 5) {
                const topics = messages.slice(-10)
                    .filter(msg => msg.role === 'user')
                    .map(msg => msg.content)
                    .join(' | ');

                requestPayload.context_summary = `Recent topics discussed: ${topics}`;
            }

            const response = await api.post('/api/ai/chat/', requestPayload);

            if (response.data.session_id) {
                const newSessionId = response.data.session_id;
                if (newSessionId !== sessionId) {
                    setSessionId(newSessionId);
                    sessionStorage.setItem('kairo_session_id', newSessionId);
                }
            }

            if (response.data.message && !response.data.content) {
                clearConversation();
                setSessionId(response.data.session_id);
                sessionStorage.setItem('kairo_session_id', response.data.session_id);

                const resetMessageId = (Date.now() + 1).toString();
                typeMessage(response.data.message, resetMessageId);
                return;
            }

            let displayContent = response.data.content;
            let createdEvents: ApiCalendarEvent[] = [];

            const userMessageContent = userMessage.content;

            try {
                if (isNaturalLanguage(userMessageContent)) {
                    const parseResult = parseNaturalLanguage(userMessageContent);

                    if (parseResult.success && parseResult.events.length > 0) {
                        for (const event of parseResult.events) {
                            try {
                                const apiEvent = await createCalendarEvent({
                                    title: event.title,
                                    day_of_week: event.day_of_week,
                                    start_time: event.start_time,
                                    end_time: event.end_time
                                });
                                createdEvents.push(apiEvent);
                            } catch (createError) {
                                console.error('✗ Failed to create event:', createError);
                            }
                        }

                        if (parseResult.confirmation) {
                            displayContent = parseResult.confirmation;
                        }
                    } else if (!parseResult.success && parseResult.error) {
                        displayContent = response.data.content;
                    }
                } else {
                    const events = await parseAndCreateCalendarEvents(userMessageContent);
                    if (events.length > 0) {
                        createdEvents.push(...events);
                    }
                }
            } catch (error) {
                if (error instanceof Error && error.message.includes('401')) {
                    displayContent = `${response.data.content}\n\n❌ **Authentication Error:** Please try logging out and logging back in.`;
                } else if (error instanceof Error && error.message.includes('403')) {
                    displayContent = `${response.data.content}\n\n❌ **Permission Error:** You don't have permission to add calendar events.`;
                }
            }

            const jsonPattern = /```json\s*([\s\S]*?)\s*```/g;
            let match;

            while ((match = jsonPattern.exec(response.data.content)) !== null) {
                try {
                    const jsonData = JSON.parse(match[1]);
                    if (jsonData.action === 'create_calendar_event' && jsonData.params) {
                        displayContent = displayContent.replace(match[0], '').trim();

                        const jsonString = JSON.stringify(jsonData);
                        const events = await parseAndCreateCalendarEvents(jsonString);
                        createdEvents.push(...events);
                    } else if (jsonData.action === 'remove_calendar_event' && jsonData.params) {
                        displayContent = displayContent.replace(match[0], '').trim();

                        if (onEventAdded) {
                            onEventAdded();
                        }
                    } else if (jsonData.action === 'remove_all_calendar_events') {
                        displayContent = displayContent.replace(match[0], '').trim();

                        if (onEventAdded) {
                            onEventAdded();
                        }
                    }
                } catch (parseError) {
                    console.warn('Failed to parse JSON from AI response:', parseError);
                }
            }

            if (createdEvents.length === 0) {
                const plainJsonPattern = /\{[^}]*"action"\s*:\s*"create_calendar_event"[^}]*\}/g;
                let plainMatch;

                while ((plainMatch = plainJsonPattern.exec(response.data.content)) !== null) {
                    try {
                        const jsonData = JSON.parse(plainMatch[0]);
                        if (jsonData.action === 'create_calendar_event' && jsonData.params) {
                            displayContent = displayContent.replace(plainMatch[0], '').trim();

                            const jsonString = JSON.stringify(jsonData);
                            const events = await parseAndCreateCalendarEvents(jsonString);
                            createdEvents.push(...events);
                        }
                    } catch (parseError) {
                        console.warn('Failed to parse plain JSON from AI response:', parseError);
                    }
                }
            }

            if (createdEvents.length === 0) {
                const trimmedContent = response.data.content.trim();
                if (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) {
                    try {
                        const jsonData = JSON.parse(trimmedContent);
                        if (jsonData.action === 'create_calendar_event' && jsonData.params) {
                            displayContent = `I've added "${jsonData.params.title}" to your calendar for ${jsonData.params.day_of_week} from ${jsonData.params.start_time} to ${jsonData.params.end_time}.`;

                            const events = await parseAndCreateCalendarEvents(trimmedContent);
                            createdEvents.push(...events);
                        } else if (jsonData.action === 'remove_all_calendar_events') {
                            displayContent = "I'll remove all events from your calendar.";

                            if (onEventAdded) {
                                onEventAdded();
                            }
                        }
                    } catch (parseError) {
                        console.warn('Failed to parse entire response as JSON:', parseError);
                    }
                }
            }

            if (createdEvents.length > 0) {
                if (!displayContent.includes('Added') && !displayContent.includes('added')) {
                    const eventSummary = createdEvents.map(event =>
                        `"${event.title}" on ${event.day_of_week} from ${event.start_time} to ${event.end_time}`
                    ).join(' and ');

                    displayContent = `I've added ${eventSummary} to your calendar.`;
                }

                if (onEventAdded) {
                    onEventAdded();
                }
            }

            const deletionPatterns = [
                /cleared all \d+ events/i,
                /removed \d+ events?/i,
                /deleted \d+ events?/i,
                /I cleared all/i,
                /I removed/i,
                /I deleted/i,
                /🗑️.*cleared/i,
                /🗑️.*removed/i,
                /🗑️.*deleted/i,
                /🗑️.*I cleared/i,
                /Your calendar is.*empty/i,
                /calendar.*cleared/i,
                /calendar.*empty/i,
                /all events.*removed/i,
                /everything.*cleared/i,
                /wiped.*calendar/i,
                /emptied.*calendar/i,
                /reset.*calendar/i,
                /cleaned.*calendar/i,
                /calendar.*already.*empty/i,
                /no events.*found/i,
                /calendar.*now.*empty/i
            ];

            const isDeletionResponse = deletionPatterns.some(pattern => pattern.test(displayContent));

            if (isDeletionResponse) {
                const countMatch = displayContent.match(/(\d+)\s+events?/i);
                const deletedCount = countMatch ? parseInt(countMatch[1]) : 1;

                window.dispatchEvent(new CustomEvent('aiCalendarDeletion', {
                    detail: { type: 'ai_response', count: deletedCount }
                }));

                if (onEventAdded) {
                    onEventAdded();
                }
            }

            const finalHonestCheck = shouldProvideHonestResponse(userMessage.content);
            if (finalHonestCheck.shouldRespond && finalHonestCheck.response) {
                const aiResponseLower = displayContent.toLowerCase();
                const nonAcademicIndicators = [
                    'i don\'t have access to', 'i cannot provide', 'i\'m not able to',
                    'as an ai', 'i\'m an ai', 'i don\'t know', 'i\'m not sure',
                    'general knowledge', 'outside my expertise', 'beyond my capabilities'
                ];

                const containsNonAcademicResponse = nonAcademicIndicators.some(indicator =>
                    aiResponseLower.includes(indicator)
                );

                if (containsNonAcademicResponse) {
                    const assistantMessageId = (Date.now() + 1).toString();
                    typeMessage(finalHonestCheck.response, assistantMessageId);
                    return;
                }
            }

            const assistantMessageId = (Date.now() + 1).toString();
            typeMessage(displayContent, assistantMessageId);

        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessageId = (Date.now() + 1).toString();
            typeMessage('Sorry, I encountered an error. Please try again.', errorMessageId);
        } finally {
            setIsLoading(false);
        }
    };

    // RENDER - Welcome screen
    if (!hasStartedConversation && !isLoadingHistory) {
        return (
            <div className="font-mono h-full w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-white dark:bg-[rgb(var(--secondary-bg))] transition-colors duration-300">
                <div className="flex flex-col items-center justify-center flex-1 max-w-2xl w-full">
                    <div className="mb-6 sm:mb-8 text-center px-4">
                        <h2 className="text-gray-900 dark:text-neutral-300 text-lg sm:text-xl font-medium transition-colors duration-300">
                            <TypewriterText
                                text={getFunnyMessage() || "Kairo's awake after 5. Unlike your prof."}
                                speed={70}
                            />
                        </h2>
                    </div>

                    <div className="w-full max-w-3xl px-4">
                        <form onSubmit={sendMessage} className="w-full">
                            <div className="bg-white dark:bg-[rgb(var(--card-bg))] border border-gray-200 dark:border-[rgb(var(--border-color))] rounded-2xl shadow-sm hover:shadow-md dark:hover:border-white/20 transition-all duration-300 relative overflow-hidden">
                                <div className="p-4 pb-0">
                                    <div className="flex-1 relative">
                                        <textarea
                                            value={inputMessage}
                                            onChange={(e) => setInputMessage(e.target.value)}
                                            onFocus={() => setIsInputFocused(true)}
                                            onBlur={() => setIsInputFocused(false)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    sendMessage(e);
                                                }
                                            }}
                                            rows={1}
                                            className="w-full bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-gray-900 dark:text-white disabled:opacity-50 relative z-10 transition-colors duration-300 resize-none min-h-[32px] leading-7 text-[15px]"
                                            style={{
                                                height: 'auto',
                                                minHeight: '32px',
                                                maxHeight: '120px'
                                            }}
                                            onInput={(e) => {
                                                const target = e.target as HTMLTextAreaElement;
                                                target.style.height = 'auto';
                                                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                                            }}
                                            placeholder=""
                                            autoFocus
                                        />
                                        {!inputMessage && !isInputFocused && (
                                            <div className="absolute inset-0 flex items-start pt-[8px] overflow-hidden pointer-events-none">
                                                <div
                                                    className={`text-gray-400 dark:text-neutral-500 transition-all duration-500 text-[15px] ${isVisible
                                                        ? 'opacity-100'
                                                        : 'opacity-0'
                                                        }`}
                                                >
                                                    {displayText}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-end px-4 py-3">
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className={`w-9 h-9 rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center group focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${inputMessage.trim()
                                            ? 'bg-gradient-to-r from-gray-900 to-gray-800 dark:from-white dark:to-gray-100 hover:from-gray-800 hover:to-gray-700 dark:hover:from-gray-100 dark:hover:to-white text-white dark:text-gray-900 shadow-md'
                                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                            }`}
                                        aria-label="Send message"
                                    >
                                        {inputMessage.trim() ? (
                                            <ArrowUp className="w-4 h-4 transition-transform duration-200 group-hover:-translate-y-0.5" />
                                        ) : (
                                            <ArrowRight className="w-4 h-4 rotate-90" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    // RENDER - Main chat interface
    return (
        <div className="font-mono h-full w-full flex flex-col p-4 sm:p-6 bg-white dark:bg-[rgb(var(--secondary-bg))] transition-colors duration-300">
            {/* Header */}
            <div className="mb-4 sm:mb-6 flex justify-between items-center">
                <div className="flex items-center gap-2 sm:gap-3">
                    <h2 className="text-gray-900 dark:text-neutral-300 text-lg sm:text-xl font-medium transition-colors duration-300">
                        Chat with Kairo
                    </h2>
                    {sessionId && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-500/20 rounded-full transition-colors duration-300">
                            <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"></div>
                            <span className="text-xs text-green-700 dark:text-green-400 transition-colors duration-300">Enhanced Memory</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Loading indicator for conversation history */}
            {isLoadingHistory && (
                <div className="flex justify-center items-center py-8">
                    <div className="relative w-6 h-6">
                        <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-blue-600 dark:bg-[rgb(var(--accent-color))] rounded-full -translate-x-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
                        <div className="absolute w-full h-full animate-spin-slow">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: 'translate(-50%, -50%) rotate(0deg) translateX(10px)' }}>
                                <div className="w-1 h-1 bg-cyan-500 dark:bg-cyan-400 rounded-full animate-bob" />
                            </div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: 'translate(-50%, -50%) rotate(90deg) translateX(10px)' }}>
                                <div className="w-1 h-1 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bob" style={{ animationDelay: '0.375s' }} />
                            </div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: 'translate(-50%, -50%) rotate(180deg) translateX(10px)' }}>
                                <div className="w-1 h-1 bg-purple-500 dark:bg-purple-400 rounded-full animate-bob" style={{ animationDelay: '0.75s' }} />
                            </div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: 'translate(-50%, -50%) rotate(270deg) translateX(10px)' }}>
                                <div className="w-1 h-1 bg-blue-400 dark:bg-blue-300 rounded-full animate-bob" style={{ animationDelay: '1.125s' }} />
                            </div>
                        </div>
                    </div>
                    <span className="ml-3 text-gray-600 dark:text-neutral-400 text-sm transition-colors duration-300">Loading conversation history...</span>
                </div>
            )}

            {/* Messages Container */}
            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto mb-4 space-y-3"
            >
                <div className="flex flex-col space-y-3">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {message.curriculumData && message.curriculumData.programName ? (
                                <div className="w-full max-w-4xl">
                                    <div className="bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-neutral-300 self-start p-3 rounded-lg transition-colors duration-300">
                                        <MessageContent
                                            content={message.content}
                                            className="text-sm leading-relaxed"
                                            curriculumData={message.curriculumData}
                                            yearRequested={message.yearRequested}
                                            termRequested={message.termRequested}
                                            isFullSequence={message.isFullSequence}
                                        />
                                    </div>

                                    {message.role === 'assistant' && (
                                        <div className="flex items-center gap-1 mt-2 ml-3">
                                            <button
                                                onClick={() => handleCopyMessage(message.id, message.content)}
                                                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                                                title="Copy message"
                                            >
                                                {copiedMessages[message.id] ? (
                                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleMessageFeedback(message.id, 'up')}
                                                className={`p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${messageFeedback[message.id] === 'up'
                                                        ? 'text-green-500'
                                                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                                    }`}
                                                title="Good response"
                                            >
                                                <ThumbsUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleMessageFeedback(message.id, 'down')}
                                                className={`p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${messageFeedback[message.id] === 'down'
                                                        ? 'text-red-500'
                                                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                                    }`}
                                                title="Bad response"
                                            >
                                                <ThumbsDown className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : message.curriculumData ? (
                                <div className="w-full max-w-4xl">
                                    <CurriculumDisplay
                                        program={message.curriculumData.program?.program || message.curriculumData.program}
                                        year={message.curriculumData.year}
                                        term={message.curriculumData.term}
                                        courses={message.curriculumData.fallCourses && message.curriculumData.winterCourses && message.curriculumData.isFullYear
                                            ? [...message.curriculumData.fallCourses, ...message.curriculumData.winterCourses]
                                            : message.curriculumData.courses}
                                        notes={message.curriculumData.notes}
                                        isFullYear={message.curriculumData.isFullYear}
                                        fallCourses={message.curriculumData.fallCourses}
                                        winterCourses={message.curriculumData.winterCourses}
                                        structuredData={message.curriculumData.structuredData}
                                    />

                                    {message.role === 'assistant' && (
                                        <div className="flex items-center gap-1 mt-2 ml-3">
                                            <button
                                                onClick={() => handleCopyMessage(message.id, message.content)}
                                                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                                                title="Copy message"
                                            >
                                                {copiedMessages[message.id] ? (
                                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleMessageFeedback(message.id, 'up')}
                                                className={`p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${messageFeedback[message.id] === 'up'
                                                        ? 'text-green-500'
                                                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                                    }`}
                                                title="Good response"
                                            >
                                                <ThumbsUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleMessageFeedback(message.id, 'down')}
                                                className={`p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${messageFeedback[message.id] === 'down'
                                                        ? 'text-red-500'
                                                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                                    }`}
                                                title="Bad response"
                                            >
                                                <ThumbsDown className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className={`${message.role === 'user' ? 'ml-auto' : 'mr-auto'} max-w-[90%] sm:max-w-[70%]`}>
                                    <div
                                        className={`${message.role === 'user'
                                            ? 'bg-gray-100 dark:bg-white/10 rounded-lg p-2 text-gray-900 dark:text-white mb-2 transition-colors duration-300'
                                            : 'bg-gray-50 dark:bg-[rgb(var(--card-bg))] border border-gray-200 dark:border-[rgb(var(--border-color))] text-gray-900 dark:text-neutral-300 p-3 rounded-lg transition-colors duration-300'
                                            }`}
                                    >
                                        <MessageContent
                                            content={message.content}
                                            className="text-sm leading-relaxed"
                                        />
                                    </div>

                                    {message.role === 'assistant' && (
                                        <div className="flex items-center gap-1 mt-2 ml-3">
                                            <button
                                                onClick={() => handleCopyMessage(message.id, message.content)}
                                                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                                                title="Copy message"
                                            >
                                                {copiedMessages[message.id] ? (
                                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleMessageFeedback(message.id, 'up')}
                                                className={`p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${messageFeedback[message.id] === 'up'
                                                        ? 'text-green-500'
                                                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                                    }`}
                                                title="Good response"
                                            >
                                                <ThumbsUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleMessageFeedback(message.id, 'down')}
                                                className={`p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${messageFeedback[message.id] === 'down'
                                                        ? 'text-red-500'
                                                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                                    }`}
                                                title="Bad response"
                                            >
                                                <ThumbsDown className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Typing message */}
                    {isTyping && typingMessage && (
                        <div className="flex justify-start">
                            <div className="bg-gray-50 dark:bg-[rgb(var(--card-bg))] border border-gray-200 dark:border-[rgb(var(--border-color))] text-gray-900 dark:text-neutral-300 self-start p-3 rounded-lg max-w-[90%] sm:max-w-[70%] transition-colors duration-300">
                                <MessageContent
                                    content={typingMessage}
                                    className="text-sm leading-relaxed"
                                />
                                <span className="inline-block w-0.5 h-4 bg-gray-900 dark:bg-neutral-300 ml-0.5 animate-pulse opacity-75"></span>
                            </div>
                        </div>
                    )}

                    {/* Typing indicator */}
                    {isLoading && !isTyping && (
                        <div className="flex justify-start px-4 py-2">
                            <div className="flex items-center space-x-1">
                                <div className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }}></div>
                                <div className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1s' }}></div>
                                <div className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1s' }}></div>
                            </div>
                        </div>
                    )}
                </div>

                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <div className="w-full">
                <form onSubmit={sendMessage} className="w-full">
                    <div className="bg-white dark:bg-[rgb(var(--card-bg))] border border-gray-200 dark:border-[rgb(var(--border-color))] rounded-2xl shadow-sm hover:shadow-md dark:hover:border-white/20 transition-all duration-300 relative overflow-hidden">
                        <div className="p-4 pb-0">
                            <div className="flex-1 relative">
                                <textarea
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onFocus={() => setIsInputFocused(true)}
                                    onBlur={() => setIsInputFocused(false)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage(e);
                                        }
                                    }}
                                    rows={1}
                                    className="w-full bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-gray-900 dark:text-white disabled:opacity-50 relative z-10 transition-colors duration-300 resize-none min-h-[32px] leading-7 text-[15px]"
                                    style={{
                                        height: 'auto',
                                        minHeight: '32px',
                                        maxHeight: '120px'
                                    }}
                                    onInput={(e) => {
                                        const target = e.target as HTMLTextAreaElement;
                                        target.style.height = 'auto';
                                        target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                                    }}
                                    placeholder=""
                                />
                                {!inputMessage && !isInputFocused && (
                                    <div className="absolute inset-0 flex items-start pt-[8px] overflow-hidden pointer-events-none">
                                        <div
                                            className={`text-gray-400 dark:text-neutral-500 transition-all duration-500 text-[15px] ${isVisible
                                                ? 'opacity-100'
                                                : 'opacity-0'
                                                }`}
                                        >
                                            {displayText}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end px-4 py-3">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-9 h-9 rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center group focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${inputMessage.trim()
                                    ? 'bg-gradient-to-r from-gray-900 to-gray-800 dark:from-white dark:to-gray-100 hover:from-gray-800 hover:to-gray-700 dark:hover:from-gray-100 dark:hover:to-white text-white dark:text-gray-900 shadow-md'
                                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                    }`}
                                aria-label="Send message"
                            >
                                {inputMessage.trim() ? (
                                    <ArrowUp className="w-5 h-5 transition-transform duration-200 group-hover:-translate-y-0.5" />
                                ) : (
                                    <ArrowRight className="w-5 h-5 rotate-90" />
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AssistantComponent;
