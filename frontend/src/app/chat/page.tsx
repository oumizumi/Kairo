"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, addWeeks } from 'date-fns';
import { isMobileDevice as isDeviceMobile } from '@/utils/deviceDetection';
import WeeklyCalendar from '@/components/DailyCalendar';
import TypewriterText from '@/components/TypewriterText';

import ThemeToggle from '@/components/ThemeToggle';
import Logo from '@/components/Logo';
import AccountDropdown from '@/components/AccountDropdown';
import { ArrowRight, Download } from "lucide-react";
import ChatEmailButton from '@/components/ChatEmailButton';
import { exportCalendarForMobile, hasEventsToExport } from "@/services/mobileIcsExport";
import { exportCalendarAsICS } from "@/services/icsExportService";
import { isAuthenticated, isGuest, logout, getCalendarEvents, CalendarEvent as ApiCalendarEvent, parseAndCreateCalendarEvents, createCalendarEvent, deleteCalendarEvent, updateCalendarEvent, getFunnyMessage, getUserName } from '@/lib/api';

import { Course, CourseGrouped, CourseLegacy, isCourseGrouped, isCourseLegacy, Section, terms, courses, setCourses } from '@/types/course';
import { loadCoursesForTerm, startAutoRefresh, getCacheStatus, refreshAllCourseData } from '@/services/courseDataService';
import api from '@/lib/api';
import MessageContent from '@/components/MessageContent';
import { parseNaturalLanguage, isNaturalLanguage } from '@/lib/naturalLanguageParser';

import { scheduleGeneratorService } from '@/services/scheduleGeneratorService';
import { EVENT_THEMES } from '@/config/eventThemes';
import { aiCourseService, AICourseService } from '@/services/aiCourseService';

import { conversationService } from '@/services/conversationService';
import { persistentCalendarService, CalendarEvent as PersistentCalendarEvent } from '@/services/persistentCalendarService';
import { handle_kairo_query, routeToLogic, legacyKeywordBasedRouting } from '@/lib/kairoIntentRouter';
import CurriculumDisplay from '@/components/CurriculumDisplay';

// Simple debounce utility for performance optimization
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout;
    return ((...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(null, args), wait);
    }) as T;
}
import RMPRating from '@/components/RMPRating';
import CounterBadge from '@/components/CounterBadge';
import { ClipboardList } from "lucide-react";

import { X } from "lucide-react";
import { motion, useAnimation } from "framer-motion";
import { gptClassificationService } from '@/lib/gptClassificationService';


// Interface for chat messages
interface ChatMessage {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: Date;
    curriculumData?: any; // For special curriculum display
    yearRequested?: number; // Specific year requested
    termRequested?: string; // Specific term requested
    isFullSequence?: boolean; // Whether to show full sequence
}

interface CalendarComponentProps {
    refreshKey: number;
    initialDate?: string;
    onEventAdded?: () => void;
    showDeleteButton?: boolean; // Controls whether to show the delete events button
    onStatsChange?: (courseCount: number, conflictsCount: number) => void; // Add callback for stats
    courseCount?: number; // Current course count for mobile badges
    conflictsCount?: number; // Current conflicts count for mobile badges
    isKairollView?: boolean; // Whether this is being used in Kairoll view for special styling
}

// Interface for the DailyCalendar component's expected event format
interface DailyCalendarEvent {
    id?: number;
    title: string;
    startTime: string;
    endTime: string;
    day_of_week?: string; // For recurring weekly events
    start_date?: string;  // For specific date events
    end_date?: string;    // For specific date events
    description?: string;
    professor?: string;   // Professor name field
    recurrence_pattern?: 'weekly' | 'biweekly' | 'none'; // Recurrence pattern
    reference_date?: string; // Reference date for bi-weekly calculation
    theme?: string; // Event color theme
}

// Add interface for backend message format
interface BackendMessage {
    id: number;
    content: string;
    role: 'user' | 'assistant';
    timestamp: string;
}

function CalendarComponent({ refreshKey, initialDate, onEventAdded, showDeleteButton = true, onStatsChange, courseCount = 0, conflictsCount = 0, isKairollView = false }: CalendarComponentProps) {
    const [currentDate, setCurrentDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
    const [events, setEvents] = useState<DailyCalendarEvent[]>([]); // Use DailyCalendarEvent instead of ApiCalendarEvent
    const [isManuallyRemoved, setIsManuallyRemoved] = useState(false); // Flag to prevent server overrides
    const [isLoadingFromDB, setIsLoadingFromDB] = useState(false); // Flag for persistent storage loading
    const [isLargeScreen, setIsLargeScreen] = useState<boolean>(true);
    const [isClient, setIsClient] = useState<boolean>(false);
    // Unified EVENT_THEMES imported from config
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _importedThemes = EVENT_THEMES;

    // Get theme for event
    const getEventTheme = (event: DailyCalendarEvent) => {
        return EVENT_THEMES[event.theme as keyof typeof EVENT_THEMES] || EVENT_THEMES['lavender-peach'];
    };

    const fetchEvents = useCallback(async () => {
        if (isManuallyRemoved) {
            return;
        }

        // Try to load from persistent storage first if available
        if (isLoadingFromDB) {
            return;
        }

        let fetchedEvents: any[] = [];
        let loadedFromPersistent = false;

        // Try persistent database first
        try {
            setIsLoadingFromDB(true);
            const persistentEvents = await persistentCalendarService.loadUserCalendar();

            if (persistentEvents && persistentEvents.length > 0) {
                loadedFromPersistent = true;
                fetchedEvents = persistentEvents.map(event => ({
                    id: event.id,
                    title: event.title,
                    start_time: event.startTime,
                    end_time: event.endTime,
                    day_of_week: event.day_of_week,
                    start_date: event.start_date,
                    end_date: event.end_date,
                    description: event.description,
                    professor: event.professor,
                    recurrence_pattern: event.recurrence_pattern,
                    reference_date: event.reference_date,
                    theme: event.theme
                }));
            } else {
                fetchedEvents = await getCalendarEvents();
            }
        } catch (persistentError) {
            console.warn('Failed to load from persistent storage, falling back to legacy API:', persistentError);
            fetchedEvents = await getCalendarEvents();
        } finally {
            setIsLoadingFromDB(false);
        }

        // For weekly calendar, we need ALL events, not just current day
        // Map the API events to the format expected by WeeklyCalendar
        const mappedEvents = fetchedEvents.map(event => ({
            id: event.id,
            title: event.title,
            startTime: event.start_time, // Map start_time to startTime
            endTime: event.end_time,    // Map end_time to endTime
            day_of_week: event.day_of_week, // For recurring weekly events
            start_date: event.start_date,   // For specific date events
            end_date: event.end_date,       // For specific date events
            description: event.description,
            professor: event.professor,     // Professor field
            recurrence_pattern: event.recurrence_pattern, // Recurrence pattern
            reference_date: event.reference_date, // Reference date for bi-weekly events
            theme: event.theme // Event theme
        }));
        setEvents(mappedEvents);

        // Migrate legacy events into persistent storage ONLY if we didn't load from it
        if (!loadedFromPersistent && mappedEvents.length > 0) {
            try {
                await persistentCalendarService.saveMultipleEvents(mappedEvents.map(event => ({
                    title: event.title,
                    startTime: event.startTime,
                    endTime: event.endTime,
                    day_of_week: event.day_of_week,
                    start_date: event.start_date,
                    end_date: event.end_date,
                    description: event.description,
                    professor: event.professor,
                    recurrence_pattern: event.recurrence_pattern,
                    reference_date: event.reference_date,
                    theme: event.theme
                })));
            } catch (syncError) {
                // Silent fail for migration errors
            }
        }
    }, [isManuallyRemoved, isLoadingFromDB]);

    useEffect(() => {
        if (isAuthenticated()) { // Only fetch if authenticated
            fetchEvents();
        } else {
            // No demo events - start with empty calendar for unauthenticated users
            setEvents([]);
        }
    }, [currentDate, refreshKey]); // Re-fetch if currentDate or refreshKey changes

    // Reset the manual removal flag when refreshKey changes (new events added)
    useEffect(() => {
        setIsManuallyRemoved(false);
    }, [refreshKey]);

    // Screen size detection for responsive calendar
    useEffect(() => {
        setIsClient(true);

        const checkScreenSize = () => {
            setIsLargeScreen(window.innerWidth >= 1024); // lg breakpoint
        };

        // Check initial screen size
        if (typeof window !== 'undefined') {
            checkScreenSize();
            window.addEventListener('resize', checkScreenSize);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('resize', checkScreenSize);
            }
        };
    }, []);

    // Listen for custom refresh events from course selection
    useEffect(() => {
        const handleCustomRefresh = () => {
            // Allow server fetch to run even if we just did manual removals
            setIsManuallyRemoved(false);
            fetchEvents();
        };

        const handleCalendarNavigation = (event: any) => {
            const newDate = event.detail?.date;
            if (newDate) {
                setCurrentDate(newDate);
            }
        };

        const handleForceRemoveEvents = (event: any) => {
            const { eventIds, resetFlag } = event.detail;



            // Temporarily block server overrides while we optimistically update UI
            setIsManuallyRemoved(true);

            // Immediately remove events from local state for instant UI feedback
            setEvents(prevEvents => {
                const filteredEvents = prevEvents.filter(e => !eventIds.includes(e.id));
                return filteredEvents;
            });


            // After a very brief delay, re-enable server refresh and optionally refresh now
            setTimeout(() => {
                setIsManuallyRemoved(false);
                if (isAuthenticated()) {
                    fetchEvents();
                }
            }, 50); // Even faster refresh for maximum responsiveness
        };

        // Optimistic add: immediately append newly created events to the calendar UI
        const handleForceAddEvents = (event: any) => {
            const { events: newlyCreatedEvents } = event.detail || {};
            if (!Array.isArray(newlyCreatedEvents) || newlyCreatedEvents.length === 0) return;

            setEvents(prev => {
                // Deduplicate by id if present
                const existingIds = new Set(prev.filter(e => e.id != null).map(e => e.id));
                const toAppend = newlyCreatedEvents.filter((e: any) => e && (e.id == null || !existingIds.has(e.id)));
                return [...prev, ...toAppend];
            });
        };

        // Replace temporary events (added optimistically) with server-created ones
        const handleReplaceTempEvents = (event: any) => {
            const { tempKey, createdEvents } = event.detail || {};
            if (!tempKey || !Array.isArray(createdEvents)) return;

            setEvents(prev => {
                const filtered = prev.filter((e: any) => e && (e as any).tempKey !== tempKey);
                return [...filtered, ...createdEvents];
            });
        };

        // Listen for individual event deletions from other components
        const handleCalendarEventDeleted = (event: any) => {
            const { eventId } = event.detail;

            setEvents(prevEvents => {
                const filteredEvents = prevEvents.filter(e => e.id !== eventId);
                return filteredEvents;
            });
        };

        // Listen for individual event updates from other components
        const handleCalendarEventUpdated = (event: any) => {
            const { eventId, updatedEvent } = event.detail;

            // Refresh from server to get the latest data
            if (isAuthenticated()) {
                fetchEvents();
            }
        };

        // Listen for AI natural language deletions that need visual feedback
        const handleAICalendarDeletion = (event: any) => {
            const { type, count } = event.detail;

            if (count > 0) {
                // Add a small delay to let the AI response finish typing
                setTimeout(() => {
                    handleAutoRefreshWithVisualFeedback();
                }, 100); // Faster - users want immediate feedback
            }
        };

        // Listen for Kairoll deletions (RESET ALL, unchecking sections)
        const handleKairollDeletion = (event: any) => {
            const { type, count, action, sectionCode } = event.detail;

            if (count > 0) {
                // For individual course unchecking, don't do the visual feedback animation
                // Only do it for RESET ALL actions
                if (action === 'RESET_ALL') {
                    setTimeout(() => {
                        handleAutoRefreshWithVisualFeedback();
                    }, 50);
                } else {
                    // For regular unchecking, just refresh without the jumping animation
                    setIsManuallyRemoved(false);
                    if (isAuthenticated()) {
                        fetchEvents();
                    }
                }
            }
        };

        window.addEventListener('refreshCalendar', handleCustomRefresh);
        window.addEventListener('navigateCalendar', handleCalendarNavigation);
        window.addEventListener('forceRemoveEvents', handleForceRemoveEvents);
        window.addEventListener('forceAddEvents', handleForceAddEvents);
        window.addEventListener('replaceTempEvents', handleReplaceTempEvents);
        window.addEventListener('calendarEventDeleted', handleCalendarEventDeleted);
        window.addEventListener('calendarEventUpdated', handleCalendarEventUpdated);
        window.addEventListener('aiCalendarDeletion', handleAICalendarDeletion);
        window.addEventListener('kairollDeletion', handleKairollDeletion);

        return () => {
            window.removeEventListener('refreshCalendar', handleCustomRefresh);
            window.removeEventListener('navigateCalendar', handleCalendarNavigation);
            window.removeEventListener('forceRemoveEvents', handleForceRemoveEvents);
            window.removeEventListener('forceAddEvents', handleForceAddEvents);
            window.removeEventListener('replaceTempEvents', handleReplaceTempEvents);
            window.removeEventListener('calendarEventDeleted', handleCalendarEventDeleted);
            window.removeEventListener('calendarEventUpdated', handleCalendarEventUpdated);
            window.removeEventListener('aiCalendarDeletion', handleAICalendarDeletion);
            window.removeEventListener('kairollDeletion', handleKairollDeletion);
        };
    }, []);

    // Handler for deleting events
    const handleDeleteEvent = async (eventId: number) => {
        try {

            // Remove the event from the local state immediately for instant UI feedback
            setEvents(prevEvents => {
                const filteredEvents = prevEvents.filter(event => event.id !== eventId);
                return filteredEvents;
            });

            // Delete from server
            await deleteCalendarEvent(eventId);

            // Also delete from persistent storage if the event has an ID
            try {
                await persistentCalendarService.deleteCalendarEvent(eventId);
            } catch (persistentError) {
                console.warn('⚠️ Failed to delete from persistent storage:', persistentError);
            }

            // Dispatch global refresh event for other components that might need to know
            window.dispatchEvent(new CustomEvent('calendarEventDeleted', {
                detail: { eventId }
            }));

            // Trigger fast visual feedback for individual event deletion too
            setTimeout(() => {
                handleAutoRefreshWithVisualFeedback();
            }, 100);

        } catch (error) {
            console.error('❌ Error deleting event:', error);

            // If deletion failed, revert the UI change by re-fetching from server
            if (isAuthenticated()) {
                fetchEvents();
            }

            alert(`Failed to delete event: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleEditEvent = async (eventId: number, updatedEvent: DailyCalendarEvent) => {
        try {
            // Helper to extract course code like "CSI 2110" from title/description
            const extractCourseCode = (event: { title?: string; description?: string }): string | null => {
                const titleMatch = event.title?.match(/([A-Z]{3}\s*\d{4})/);
                if (titleMatch) {
                    return titleMatch[1].replace(/\s+/g, ' ').trim();
                }
                if (event.description) {
                    const descMatch = event.description.match(/Course:\s*([A-Z]{3}\s*\d{4})/i);
                    if (descMatch) {
                        return descMatch[1].replace(/\s+/g, ' ').trim();
                    }
                }
                return null;
            };

            const courseCode = extractCourseCode(updatedEvent);

            // Only patch the theme when editing color to avoid altering recurrence/date fields
            const updatedEventFromApi = await updateCalendarEvent(eventId, { theme: updatedEvent.theme });

            // Optimistic local update: update the edited event
            setEvents(prevEvents =>
                prevEvents.map(event =>
                    event.id === eventId
                        ? {
                            id: updatedEventFromApi.id,
                            title: updatedEventFromApi.title,
                            startTime: updatedEventFromApi.start_time,
                            endTime: updatedEventFromApi.end_time,
                            day_of_week: updatedEventFromApi.day_of_week,
                            start_date: updatedEventFromApi.start_date,
                            end_date: updatedEventFromApi.end_date,
                            description: updatedEventFromApi.description,
                            professor: updatedEventFromApi.professor,
                            recurrence_pattern: updatedEventFromApi.recurrence_pattern,
                            reference_date: updatedEventFromApi.reference_date,
                            theme: updatedEventFromApi.theme,
                        }
                        : event
                )
            );

            // Optimistic bulk recolor: recolor all blocks of the same course (lec/lab/tut)
            if (courseCode && updatedEvent.theme) {
                setEvents(prevEvents =>
                    prevEvents.map(e => (extractCourseCode(e) === courseCode)
                        ? { ...e, theme: updatedEvent.theme as string }
                        : e
                    )
                );
            }

            // Persist bulk recolor in backend if possible
            if (courseCode && updatedEvent.theme) {
                try {
                    const allEvents = await getCalendarEvents();
                    const relatedEvents = allEvents.filter(e => {
                        const cc = extractCourseCode({ title: e.title, description: e.description });
                        return cc === courseCode && e.id !== updatedEventFromApi.id;
                    });
                    for (const related of relatedEvents) {
                        if (related.id) {
                            await updateCalendarEvent(related.id, { theme: updatedEvent.theme });
                        }
                    }
                } catch {}
            }

            // Dispatch update event for global state sync
            window.dispatchEvent(new CustomEvent('calendarEventUpdate', {
                detail: { eventId, updatedEvent: updatedEventFromApi }
            }));

        } catch (error) {
            console.error('Error updating event:', error);
            alert('Failed to update event. Please try again.');
        }
    };

    const handleAddEvent = async (newEvent: DailyCalendarEvent) => {
        try {

            // Validate event data before sending
            if (!newEvent.title?.trim()) {
                alert('Event title is required');
                return;
            }
            if (!newEvent.startTime || !newEvent.endTime) {
                alert('Start time and end time are required');
                return;
            }

            // Prepare the data for the API
            const eventData = {
                title: newEvent.title.trim(),
                start_time: newEvent.startTime,
                end_time: newEvent.endTime,
                day_of_week: newEvent.day_of_week,
                start_date: newEvent.start_date,
                end_date: newEvent.end_date,
                description: newEvent.description || '',
                professor: newEvent.professor || '',
                recurrence_pattern: newEvent.recurrence_pattern || 'weekly',
                reference_date: newEvent.reference_date,
                theme: newEvent.theme || 'lavender-peach',
            };


            // Use the proper API function instead of direct fetch
            const createdEventFromApi = await createCalendarEvent(eventData);

            // Add the new event to local state with proper theme fallback
            const newEventForState: DailyCalendarEvent = {
                id: createdEventFromApi.id,
                title: createdEventFromApi.title,
                startTime: createdEventFromApi.start_time,
                endTime: createdEventFromApi.end_time,
                day_of_week: createdEventFromApi.day_of_week,
                start_date: createdEventFromApi.start_date,
                end_date: createdEventFromApi.end_date,
                description: createdEventFromApi.description,
                professor: createdEventFromApi.professor,
                recurrence_pattern: createdEventFromApi.recurrence_pattern,
                reference_date: createdEventFromApi.reference_date,
                theme: createdEventFromApi.theme || 'lavender-peach', // Ensure theme is set
            };

            setEvents(prevEvents => {
                const updatedEvents = [...prevEvents, newEventForState];
                return updatedEvents;
            });

            // Also save to persistent storage
            try {
                await persistentCalendarService.saveCalendarEvent({
                    title: newEventForState.title,
                    startTime: newEventForState.startTime,
                    endTime: newEventForState.endTime,
                    day_of_week: newEventForState.day_of_week,
                    start_date: newEventForState.start_date,
                    end_date: newEventForState.end_date,
                    description: newEventForState.description,
                    professor: newEventForState.professor,
                    recurrence_pattern: newEventForState.recurrence_pattern,
                    reference_date: newEventForState.reference_date,
                    theme: newEventForState.theme
                });
            } catch (persistentError) {
                console.warn('⚠️ Failed to save new event to persistent storage:', persistentError);
            }

            // Trigger global calendar refresh
            window.dispatchEvent(new CustomEvent('forceCalendarRefresh'));

            // Dispatch creation event for global state sync
            window.dispatchEvent(new CustomEvent('calendarEventCreated', {
                detail: { newEvent: createdEventFromApi }
            }));

            // Trigger parent component refresh
            if (onEventAdded) {
                onEventAdded();
            }

            // Additional refresh to ensure calendar updates
            setTimeout(() => {
                if (isAuthenticated()) {
                    fetchEvents();
                }
            }, 100);

            // Show success message
            alert(`✅ Event "${newEvent.title}" created successfully!`);

        } catch (error) {
            console.error('Error creating event:', error);

            // Provide specific error message to user
            let errorMessage = 'Failed to create event. Please try again.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            alert(`❌ ${errorMessage}`);
        }
    };

    // Manual refresh handler
    const handleManualRefresh = () => {
        if (isAuthenticated()) {
            fetchEvents();
        }
    };

    // Auto-refresh with visual feedback when events are deleted via natural language

    const handleAutoRefreshWithVisualFeedback = async () => {
        // IMPORTANT: Reset the manual removal flag to allow server fetches
        setIsManuallyRemoved(false);

        // FAST navigation animation (go to next week and back quickly)
        const currentDateFormatted = currentDate;
        const nextWeek = format(addWeeks(parseISO(currentDate), 1), 'yyyy-MM-dd');

        setCurrentDate(nextWeek);

        // Step 2: VERY brief delay, then come back and refresh FAST
        setTimeout(async () => {
            setCurrentDate(currentDateFormatted);

            // Step 3: Quick refresh events from server 
            setTimeout(async () => {
                if (isAuthenticated()) {
                    await fetchEvents();
                }
            }, 150); // Much faster - just enough to let navigation settle
        }, 250); // Much faster forward time for snappy feel
    };

    // Show different calendar based on screen size
    if (!isClient) {
        // Prevent hydration issues - show loading state
        return (
            <div className="h-full w-full bg-white dark:bg-[#121212] transition-colors duration-300 flex items-center justify-center">
                <div className="text-gray-500">Loading calendar...</div>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-white dark:bg-[#121212] transition-colors duration-300 flex flex-col">
            {/* Desktop Calendar for Large Screens */}
            {isLargeScreen && (
                <WeeklyCalendar
                    date={currentDate}
                    events={events}
                    onDateChange={setCurrentDate}
                    onDeleteEvent={handleDeleteEvent}
                    onEditEvent={handleEditEvent}
                    onAddEvent={handleAddEvent}
                    onRefresh={handleManualRefresh}
                    onStatsChange={onStatsChange}
                    isKairollView={isKairollView}
                    courseCount={courseCount}
                    conflictsCount={conflictsCount}
                />
            )}
        </div>
    );
}

// Simple Animated Placeholder Hook
function useAnimatedPlaceholder() {
    const exampleQuestions = [
        'Generate my Fall schedule for first year CS.',
        'Create a schedule for second year winter mechanical engineering.',
        'whats are the pre reqs for CSI2110?',
        'what is ITI1121 about?',
        'Generate schedule for first year fall computer science without 8:30 am classes.'
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
    }, []);

    return {
        displayText: exampleQuestions[currentIndex],
        isVisible
    };
}

interface AssistantComponentProps {
    onEventAdded?: () => void;
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
    // Pattern 1: "[year] course sequence for [program]" 
    const yearSequencePattern = /\b(first|second|third|fourth|1st|2nd|3rd|4th|year \d+)\s+(year\s+)?course\s+sequence\s+for/i;
    if (yearSequencePattern.test(normalizedInput)) {
        return true;
    }

    // Pattern 2: "course sequence for [year] [program]"
    const sequenceForYearPattern = /course\s+sequence\s+for\s+\b(first|second|third|fourth|1st|2nd|3rd|4th|year \d+)\s+year/i;
    if (sequenceForYearPattern.test(normalizedInput)) {
        return true;
    }

    // Pattern 3: "whats the [year] course sequence for [program]" or similar
    const whatsTheSequencePattern = /(what'?s?\s+the|show\s+me\s+the|give\s+me\s+the).*\b(first|second|third|fourth|1st|2nd|3rd|4th|year \d+)\s+(year\s+)?course\s+sequence/i;
    if (whatsTheSequencePattern.test(normalizedInput)) {
        return true;
    }

    // Pattern 4: Check if input contains program keywords using universal detection
    // Use a more universal approach that can detect any program
    const hasYearKeywords = /\b(first|second|third|fourth|1st|2nd|3rd|4th|year \d+)\s+year/i.test(normalizedInput);
    const hasSequenceKeywords = /(course\s+sequence|curriculum|courses|requirements)/i.test(normalizedInput);

    if (hasYearKeywords && hasSequenceKeywords) {
        // Check if it contains any program-related keywords using a broader pattern
        const hasProgramKeywords = /(seg|cs|csi|ceg|elg|mcg|cvg|chg|dsi|engineering|computer|software|mechanical|electrical|civil|chemical|data\s+science|management|mgmt|honours|major|minor|joint|bhk|bhsc|nursing|psychology|criminology|anthropology|sociology|economics|political\s+science|poli\s+sci|biology|physics|chemistry|mathematics|math|philosophy|history|english|geography|geology|kinesiology|human\s+kinetics|social\s+work|public\s+administration|communication|journalism|law|business|finance|accounting|marketing|science|studies|bachelor|degree|program)/i.test(normalizedInput);

        if (hasProgramKeywords) {
            return true;
        }
    }

    // Pattern 5: General program + course pattern detection
    const hasGeneralProgramPattern = /(engineering|computer|software|mechanical|electrical|civil|chemical|data|nursing|psychology|criminology|anthropology|sociology|economics|political|biology|physics|chemistry|mathematics|math|philosophy|history|english|kinesiology|social|public|communication|business|science|studies).*(courses|curriculum|sequence|requirements|schedule)/i.test(normalizedInput);
    if (hasGeneralProgramPattern) {
        return true;
    }

    // Pattern 6: Schedule generation requests with program + year (e.g., "Create my computer science first year schedule")
    const scheduleGenerationPattern = /(create|generate|build|make|plan|show).*(schedule|timetable).*(first|second|third|fourth|1st|2nd|3rd|4th|year \d+)\s+(year\s+)?(fall|winter|spring|summer)?/i.test(normalizedInput) ||
        /(create|generate|build|make|plan|show).*(first|second|third|fourth|1st|2nd|3rd|4th|year \d+)\s+(year\s+)?(fall|winter|spring|summer)?\s+(schedule|timetable)/i.test(normalizedInput) ||
        /(first|second|third|fourth|1st|2nd|3rd|4th|year \d+)\s+(year\s+)?(fall|winter|spring|summer)?\s+(schedule|timetable)/i.test(normalizedInput);
    if (scheduleGenerationPattern) {
        return true;
    }

    // SECOND: Skip if it's a schedule generation request (handled separately)
    // Only check this AFTER we've confirmed it's not a curriculum sequence request
    // Note: We can't await here since this is a sync function, but schedule detection happens first in the call flow

    // Check for patterns like "2nd year computer science courses" (asking for curriculum info)
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
        /\b[A-Z]{3}\s*\d{4}\b/g, // CSI 2110 or CSI2110
        /\b[A-Z]{3}\d{4}\b/g     // CSI2110
    ];

    const normalizedInput = userInput.toLowerCase();

    // Check if it contains deletion keywords
    const hasDeletionKeyword = deletionKeywords.some(keyword => normalizedInput.includes(keyword));

    // Check if it contains course codes
    const hasCourseCode = coursePatterns.some(pattern => pattern.exec(userInput));

    return hasDeletionKeyword && hasCourseCode;
}

function extractCourseCodesFromText(text: string): string[] {
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

// Function to detect course availability questions
function isCourseAvailabilityQuestion(userInput: string): boolean {
    const normalizedInput = userInput.toLowerCase();

    // Look for course availability keywords
    const availabilityKeywords = [
        'is available', 'available', 'offered', 'is offered', 'can i take',
        'does', 'do they have', 'do you have', 'is there', 'are there',
        'when is', 'what term', 'which term', 'which semester', 'what semester'
    ];

    // Look for term keywords
    const termKeywords = [
        'fall', 'winter', 'summer', 'spring', 'term', 'semester',
        '2025', '2026', 'next term', 'this term'
    ];

    // Check for course code pattern
    const hasCourseCode = /\b[A-Z]{3}\s*\d{4}\b/i.test(userInput);

    // Check for availability keywords
    const hasAvailabilityKeyword = availabilityKeywords.some(keyword =>
        normalizedInput.includes(keyword)
    );

    // Check for term keywords  
    const hasTermKeyword = termKeywords.some(keyword =>
        normalizedInput.includes(keyword)
    );

    return hasCourseCode && (hasAvailabilityKeyword || hasTermKeyword);
}

// Function to check course availability using scraped data
async function checkCourseAvailability(courseCode: string, term?: string): Promise<{
    available: boolean;
    availableTerms: string[];
    message: string;
}> {
    try {
        // Load course data from the scraped files
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

                    // Handle the data structure with "courses" array wrapper
                    const courses = data.courses || data;

                    // Search through the course data
                    const found = courses.some((course: any) => {
                        const normalizedCourseCode = course.courseCode?.replace(/\s+/g, '').toLowerCase();
                        const normalizedSearchCode = courseCode.replace(/\s+/g, '').toLowerCase();
                        return normalizedCourseCode === normalizedSearchCode;
                    });

                    if (found) {
                        courseFound = true;
                        // Extract term name from file name
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

// Function to detect when Kairo should be honest about not knowing something
function shouldProvideHonestResponse(userInput: string): { shouldRespond: boolean; response?: string } {
    const normalizedInput = userInput.toLowerCase().trim();

    // FIRST: Handle basic conversational/identity questions that should get direct answers
    const basicConversationalQuestions = [
        // Name questions
        /(?:what|whats|what's).*(?:your|yo|ur).*name/i,
        /(?:who|what).*are.*you/i,
        /(?:introduce.*yourself|tell.*about.*yourself)/i,

        // Basic greetings and politeness
        /^(hi|hello|hey|howdy|good morning|good afternoon|good evening)$/i,
        /^(thanks|thank you|thx|ty)$/i,
        /^(bye|goodbye|see you|talk later)$/i,
        /^(ok|okay|alright|sure|cool)$/i,

        // Basic capability questions
        /(?:what.*can.*you.*do|how.*can.*you.*help|what.*are.*you.*for)/i,
        /(?:what.*is.*kairo|tell.*about.*kairo)/i,
    ];

    // Check for basic conversational questions first
    for (const pattern of basicConversationalQuestions) {
        if (pattern.test(normalizedInput)) {
            // Handle name questions specifically
            if (/(?:what|whats|what's).*(?:your|yo|ur).*name/i.test(normalizedInput) ||
                /(?:who|what).*are.*you/i.test(normalizedInput)) {
                return {
                    shouldRespond: true,
                    response: "I'm Kairo! 🎓 I'm your AI academic assistant here to help you navigate your uOttawa journey. Whether you need help with course scheduling, finding the perfect program, or planning your degree, I'm here to make your academic life easier and more organized! ✨\n\nWhat can I help you with today?"
                };
            }

            // Handle capability questions
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

            // Handle basic greetings
            return {
                shouldRespond: true,
                response: "Hey there! I'm Kairo, your friendly academic assistant! 🎓 Ready to help you with course planning, scheduling, or anything else related to your uOttawa journey. What's on your mind?"
            };
        }
    }

    // Define what Kairo CAN help with
    const kairosCapabilities = [
        // Course and schedule related
        'course', 'class', 'schedule', 'timetable', 'curriculum', 'program',
        'semester', 'term', 'fall', 'winter', 'summer', 'spring',
        'professor', 'instructor', 'teacher', 'section', 'enrollment',

        // Calendar and time management
        'calendar', 'event', 'appointment', 'meeting', 'time', 'date',
        'reminder', 'deadline', 'exam', 'assignment',

        // University of Ottawa specific
        'uottawa', 'university of ottawa', 'ottawa u', 'gee gees',
        'engineering', 'computer science', 'cs', 'math', 'mathematics',
        'political science', 'economics', 'psychology', 'criminology',

        // Academic planning
        'degree', 'major', 'minor', 'honours', 'joint', 'elective',
        'prerequisite', 'corequisite', 'credit', 'unit', 'gpa',

        // Schedule generation and management
        'generate', 'create', 'make', 'build', 'plan', 'organize', 'do', 'help', 'assist'
    ];

    // Topics Kairo should NOT attempt to answer (but exclude basic conversational patterns)
    const outsideScope = [
        // General knowledge questions (but not about Kairo itself)
        /what is|what are|define|explain.*(?:concept|theory|principle)/i,
        /how does.*work/i,
        /why is|why are|why do|why does/i,
        /when was|when did|when will/i,
        /where is|where are|where can/i,
        /who is|who are|who was/i,

        // Non-academic topics
        /weather|climate|temperature/i,
        /news|politics|current events/i,
        /sports|games|entertainment/i,
        /health|medical|doctor|medicine/i,
        /cooking|recipe|food/i,
        /travel|vacation|trip/i,
        /shopping|buy|purchase|price/i,
        /technology.*(?:general|how to|tutorial)/i,

        // Personal advice
        /should i|what should|advice|recommend.*(?:life|career|personal)/i,
        /relationship|dating|friendship/i,
        /financial|money|investment|loan/i,

        // Complex academic content (not course planning)
        /solve.*(?:equation|problem|math)/i,
        /write.*(?:essay|paper|report)/i,
        /research.*(?:topic|paper|thesis)/i,
        /homework|assignment.*help/i,

        // Technical support (non-Kairo)
        /computer.*(?:problem|issue|error)/i,
        /software.*(?:install|download|fix)/i,
        /internet|wifi|connection/i,

        // Legal or official advice
        /legal|law|lawyer|attorney/i,
        /immigration|visa|permit/i,
        /tax|taxes|filing/i
    ];

    // Check if the question is clearly outside Kairo's scope
    const isOutsideScope = outsideScope.some(pattern => pattern.test(normalizedInput));

    if (isOutsideScope) {
        return {
            shouldRespond: false  // Let backend handle everything instead of giving generic response
        };
    }

    // Check if it contains academic keywords - if so, let it proceed to normal processing
    const hasAcademicKeywords = kairosCapabilities.some(keyword =>
        normalizedInput.includes(keyword)
    );

    if (hasAcademicKeywords) {
        return { shouldRespond: false }; // Let normal processing handle it
    }

    // Only give the generic response for complex questions that seem academic but aren't clear
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

    return { shouldRespond: false }; // Let normal processing handle it
}

function AssistantComponent({ onEventAdded }: AssistantComponentProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hasStartedConversation, setHasStartedConversation] = useState(false);
    const [typingMessage, setTypingMessage] = useState<string>('');
    const [isTyping, setIsTyping] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isSmallScreen, setIsSmallScreen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

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
            // Try to get existing session from sessionStorage (resets when browser closes)
            const savedSessionId = sessionStorage.getItem('kairo_session_id');

            if (savedSessionId) {
                setIsLoadingHistory(true);
                try {
                    // Load conversation history for this session
                    const response = await api.get(`/api/ai/chat/?session_id=${savedSessionId}`);

                    if (response.data && response.data.length > 0) {
                        // Convert backend messages to frontend format
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
                        // Session exists but no messages, keep the session
                        setSessionId(savedSessionId);
                    }
                } catch (error) {
                    console.error('Error loading conversation history:', error);
                    // If there's an error loading history, start fresh
                    sessionStorage.removeItem('kairo_session_id');
                    setSessionId(null);
                }
                setIsLoadingHistory(false);
            }
        };

        loadSession();

        // Session persists until user closes browser tab/window, resets on new browser session
    }, []);

    // Auto-scroll to bottom when new messages arrive (only if near bottom)
    const scrollToBottom = () => {
        if (!isAutoScrollEnabled) return;
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, typingMessage, isAutoScrollEnabled]);

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

        // Clear all conversation context
        aiCourseService.clearContext();

    };

    // Function to handle individual course deletion requests
    const handleIndividualCourseDeletion = async (userInput: string): Promise<{ message: string }> => {
        const courseCodes = extractCourseCodesFromText(userInput);

        if (courseCodes.length === 0) {
            // Use AI to understand natural language deletion requests
            const { deletionService } = await import('@/services/deletionService');

            const result = await deletionService.handleDeletionRequest({
                type: 'course', // Default to course deletion for natural language
                message: userInput
            });

            if (result.success) {
                // Trigger calendar refresh
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
            // Use centralized deletion service for bulk course deletion
            const { deletionService } = await import('@/services/deletionService');

            const result = await deletionService.handleDeletionRequest({
                type: 'course',
                target: courseCodes[0] // For single course
            });

            // If multiple courses, handle them as a batch
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

            // Trigger calendar refresh
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

        // Split message into words for more natural typing
        const words = fullMessage.split(' ');
        let currentWordIndex = 0;
        let currentText = '';

        const typeNextWord = () => {
            if (currentWordIndex < words.length) {
                currentText += (currentWordIndex > 0 ? ' ' : '') + words[currentWordIndex];
                setTypingMessage(currentText);
                currentWordIndex++;

                // Variable delays for more natural feel
                let delay = 50; // Base delay

                // Longer pause after punctuation
                if (currentText.endsWith('.') || currentText.endsWith('!') || currentText.endsWith('?')) {
                    delay = 300;
                } else if (currentText.endsWith(',') || currentText.endsWith(';')) {
                    delay = 150;
                } else if (currentText.endsWith('\n')) {
                    delay = 200;
                } else {
                    // Random variation for natural feel
                    delay = 30 + Math.random() * 40;
                }

                setTimeout(typeNextWord, delay);
            } else {
                // Typing complete
                setTimeout(() => {
                    setIsTyping(false);
                    setTypingMessage('');

                    // Add the complete message to the messages array
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

        // Start typing with a small initial delay
        setTimeout(typeNextWord, 200);
    };

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
            // Check if Kairo should provide an honest response about not knowing something
            const honestResponse = shouldProvideHonestResponse(userMessage.content);
            if (honestResponse.shouldRespond && honestResponse.response) {
                const assistantMessageId = (Date.now() + 1).toString();
                typeMessage(honestResponse.response, assistantMessageId);
                setIsLoading(false);
                return; // Exit early, don't send to AI
            }

            // NEW: Intent-based routing system
            const USE_INTENT_ROUTER = true;

            if (USE_INTENT_ROUTER) {
                try {
                    const { intent, course_codes } = await handle_kairo_query(userMessage.content);

                    if (intent !== 'unknown') {
                        const intentResult = await routeToLogic(intent, course_codes, userMessage.content);

                        // Handle different actions
                        if (intentResult.action === 'reset_chat') {
                            clearConversation();
                        } else if (intentResult.action === 'create_schedule_events' && intentResult.events && intentResult.events.length > 0) {
                            try {
                                // Create calendar events for the generated schedule
                                const createdEvents = [];
                                for (const event of intentResult.events) {
                                    try {
                                        const apiEvent = await createCalendarEvent(event);
                                        createdEvents.push(apiEvent);
                                    } catch (error) {
                                        console.error('Failed to create calendar event:', error);
                                    }
                                }

                                // Trigger calendar refresh if events were created
                                if (onEventAdded && createdEvents.length > 0) {
                                    onEventAdded();
                                }
                            } catch (error) {
                                console.error('Error creating schedule events:', error);
                            }
                        } else if (intentResult.action === 'display_program_sequence' && intentResult.programSequence) {
                            // Create a special message with program sequence data
                            const assistantMessageId = (Date.now() + 1).toString();
                            const messageWithData: ChatMessage = {
                                id: assistantMessageId,
                                content: '', // No text content when using UI component
                                role: 'assistant',
                                timestamp: new Date(),
                                curriculumData: intentResult.programSequence,
                                yearRequested: intentResult.yearRequested,
                                termRequested: intentResult.termRequested,
                                isFullSequence: intentResult.isFullSequence
                            };
                            
                            setMessages(prev => [...prev, messageWithData]);
                            setIsLoading(false);
                            return; // Exit early, program sequence was handled
                        }

                        const assistantMessageId = (Date.now() + 1).toString();
                        typeMessage(intentResult.message, assistantMessageId);
                        setIsLoading(false);
                        return; // Exit early, intent was handled
                    } else {
                        // Don't fall back to legacy routing for schedule requests
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
                // Legacy routing fallback
                const legacyResult = await legacyKeywordBasedRouting(userMessage.content);
                if (legacyResult) {
                    const assistantMessageId = (Date.now() + 1).toString();
                    typeMessage(legacyResult.message, assistantMessageId);
                    setIsLoading(false);
                    return; // Exit early, legacy routing handled it
                }
            }

            // Check for course availability questions first  
            if (isCourseAvailabilityQuestion(userMessage.content)) {

                try {
                    const courseCodes = extractCourseCodesFromText(userMessage.content);
                    if (courseCodes.length > 0) {
                        const courseCode = courseCodes[0]; // Handle first course found
                        const availabilityResult = await checkCourseAvailability(courseCode);
                        const assistantMessageId = (Date.now() + 1).toString();
                        typeMessage(availabilityResult.message, assistantMessageId);
                        setIsLoading(false);
                        return; // Exit early, don't send to AI
                    }
                } catch (availabilityError) {
                    console.error('❌ Course availability check failed:', availabilityError);
                    // Fall through to normal AI processing if check fails
                }
            }

            // Check for individual course deletion requests  
            if (isIndividualCourseDeletionRequest(userMessage.content)) {

                try {
                    const deletionResult = await handleIndividualCourseDeletion(userMessage.content);
                    const assistantMessageId = (Date.now() + 1).toString();
                    typeMessage(deletionResult.message, assistantMessageId);
                    setIsLoading(false);
                    return; // Exit early, don't send to AI
                } catch (deletionError) {
                    console.error('❌ Individual course deletion failed:', deletionError);
                    // Fall through to normal AI processing if deletion fails
                }
            }

            // NEW: Check for individual course changes BEFORE course info queries
            const changeRequest = scheduleGeneratorService.isRequestingIndividualChange(userMessage.content);
            if (changeRequest.isChange && changeRequest.courseCode) {

                try {
                    const changeResult = await scheduleGeneratorService.changeIndividualCourse(
                        changeRequest.courseCode,
                        changeRequest.component || 'course',
                        scheduleGeneratorService.parseTimePreferences(userMessage.content)
                    );


                    if (changeResult.success && changeResult.events.length > 0) {
                        // Remove old events for this course from calendar
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

                        // Create new calendar events for the changed course using persistent storage
                        try {
                            const result = await persistentCalendarService.saveMultipleEvents(
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
                            // Fallback to legacy API if persistent storage fails
                            for (const event of changeResult.events) {
                                try {
                                    const apiEvent = await createCalendarEvent(event);
                                } catch (legacyError) {
                                    console.error('❌ Failed to create calendar event via legacy API:', legacyError);
                                }
                            }
                        }

                        // Trigger calendar refresh
                        if (onEventAdded) {
                            onEventAdded();
                        }
                    }

                    // Send change response
                    const assistantMessageId = (Date.now() + 1).toString();
                    typeMessage(changeResult.message, assistantMessageId);
                    setIsLoading(false);
                    return; // Exit early, change complete

                } catch (changeError) {
                    console.error('❌ Individual course change failed:', changeError);
                    const errorMessage = `I had trouble changing that course section. Please try again or generate a new schedule instead.`;
                    const assistantMessageId = (Date.now() + 1).toString();
                    typeMessage(errorMessage, assistantMessageId);
                    setIsLoading(false);
                    return;
                }
            }

            // Check for curriculum questions FIRST (before course info queries)
            const isCurriculumQ = isCurriculumQuestion(userMessage.content);

            if (isCurriculumQ) {
                try {
                    // Curriculum service removed - using new schedule generation system
                    const curriculumResult = null;
                    if (curriculumResult) {

                        // Store curriculum data for special rendering
                        const assistantMessageId = (Date.now() + 1).toString();

                        // Add curriculum message to state with special type
                        const curriculumMessage: ChatMessage & { curriculumData?: any } = {
                            id: assistantMessageId,
                            content: '', // Empty content since we'll render the component
                            role: 'assistant',
                            timestamp: new Date(),
                            curriculumData: curriculumResult
                        };

                        setMessages(prevMessages => [...prevMessages, curriculumMessage]);
                        setIsLoading(false);
                        return; // Exit early, don't send to AI
                    } else {
                        // No curriculum match found - provide honest response
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
                        return; // Exit early, don't send to AI
                    }
                } catch (curriculumError) {
                    // Provide honest response about the error
                    const errorResponse = "I'm having trouble accessing my curriculum database right now. Please try again in a moment, or ask me about something else I can help with like schedule generation or course information.";
                    const assistantMessageId = (Date.now() + 1).toString();
                    typeMessage(errorResponse, assistantMessageId);
                    setIsLoading(false);
                    return; // Exit early, don't send to AI
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
                        return; // Exit early, don't send to AI
                    } else {
                        // Provide helpful error message
                        const errorMessage = whenResult.message + "\n\n💡 Try asking like: 'When do I take CSI2110 in Software Engineering?' or 'What year is MAT1341 in Computer Science?'";
                        const assistantMessageId = (Date.now() + 1).toString();
                        typeMessage(errorMessage, assistantMessageId);
                        setIsLoading(false);
                        return; // Exit early, don't send to AI
                    }
                } catch (whenError) {
                    console.error('❌ When is course query failed:', whenError);
                    // Fall through to normal AI processing if query fails
                }
            }

            // Check for course information queries (AFTER curriculum questions)
            const isCourseQuery = aiCourseService.isCourseInfoQuery(userMessage.content);

            if (isCourseQuery) {

                try {
                    // Extract course code from the message
                    const courseCodeMatch = userMessage.content.match(/\b([A-Z]{3,4})\s*(\d{3,4})\b/i);

                    if (courseCodeMatch) {
                        const courseCode = `${courseCodeMatch[1]}${courseCodeMatch[2]}`.toUpperCase();

                        // Use AI elaboration service for intelligent explanations
                        const { aiCourseInfoService } = await import('@/services/aiCourseInfoService');
                        const courseResponse = await aiCourseInfoService.getCourseInfo(courseCode, userMessage.content);

                        if (courseResponse.success) {
                            const assistantMessageId = (Date.now() + 1).toString();
                            typeMessage(courseResponse.message, assistantMessageId);
                            setIsLoading(false);
                            return; // Exit early, don't send to AI
                        } else {
                            // Course not found, provide helpful response
                            const notFoundMessage = `${courseResponse.message}\n\n💡 **Here are some things I can help you with:**\n\n📚 Ask about course descriptions: "What is CSI 2110 about?"\n📋 Check prerequisites: "What are the prerequisites for MAT 1341?"\n💳 Get credit information: "How many credits is ITI 1120?"\n\n🎯 Make sure to use the correct course code format (e.g., CSI 2110, not CSI2110).`;

                            const assistantMessageId = (Date.now() + 1).toString();
                            typeMessage(notFoundMessage, assistantMessageId);
                            setIsLoading(false);
                            return; // Exit early, don't send to AI
                        }
                    } else {
                        // No course code found, let it fall through to normal AI processing
                    }
                } catch (courseError) {
                    console.error('❌ Course query failed:', courseError);
                    // Provide helpful error message
                    const errorMessage = "I'm having trouble accessing course information right now. Please try again in a moment.\n\n💡 In the meantime, you can:\n\n📅 Generate your course schedule\n🗓️ Add events to your calendar\n📋 Ask about curriculum requirements";
                    const assistantMessageId = (Date.now() + 1).toString();
                    typeMessage(errorMessage, assistantMessageId);
                    setIsLoading(false);
                    return; // Exit early, don't send to AI
                }
            }

            // Check for schedule generation requests
            const isScheduleGenRequest = await scheduleGeneratorService.isScheduleGenerationRequest(userMessage.content);

            if (isScheduleGenRequest) {

                // Check if this is a request to replace an existing schedule
                const isReplacement = scheduleGeneratorService.isRequestingNewSchedule(userMessage.content);
                if (isReplacement) {

                    // Show replacement message
                    const replacementMessage = "🔄 Replacing your current schedule with a new one...";
                    const replacementMessageId = Date.now().toString();
                    typeMessage(replacementMessage, replacementMessageId);

                    // Clear existing calendar events
                    try {
                        // Get current events to delete them
                        const currentEvents = await getCalendarEvents();
                        if (currentEvents && currentEvents.length > 0) {
                            for (const event of currentEvents) {
                                if (event.id) {
                                    await deleteCalendarEvent(event.id);
                                }
                            }
                        }

                        // Also clear persistent storage
                        try {
                            await persistentCalendarService.clearUserCalendar();
                        } catch (persistentError) {
                            console.warn('⚠️ Failed to clear persistent storage:', persistentError);
                        }

                        // Trigger calendar refresh to show cleared state
                        if (onEventAdded) {
                            onEventAdded();
                        }

                    } catch (clearError) {
                        console.error('❌ Failed to clear existing events:', clearError);
                        // Show a brief error message but continue with schedule generation
                        const errorMessage = "⚠️ Had trouble clearing some old events, but creating your new schedule...";
                        const errorMessageId = Date.now().toString();
                        typeMessage(errorMessage, errorMessageId);
                    }
                }

                try {
                    const scheduleResult = await scheduleGeneratorService.generateSchedule(userMessage.content);



                    if (scheduleResult.success && scheduleResult.events.length > 0) {
                        // Create calendar events using persistent storage
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
                            // Fallback to legacy API if persistent storage fails
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

                        // Trigger calendar refresh after schedule generation
                        if (onEventAdded) {
                            onEventAdded();
                        }
                    }

                    // Generate GPT-powered confirmation message
                    let confirmationMessage = '';
                    if (scheduleResult.success && scheduleResult.events.length > 0) {
                        try {
                            // Extract program and year from user message using dynamic AI
                            const { dynamicClassificationService } = await import('@/lib/dynamicClassificationService');
                            const classification = await dynamicClassificationService.classifyMessage(userMessage.content);
                            const program = classification.program || 'Unknown Program';
                            const year = typeof classification.year === 'number' ? classification.year : 1;
                            // Call the new backend endpoint for dynamic response generation
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
                            // If electives are unmatched, append elective count and nudge to use Kairoll
                            const electiveCount = (scheduleResult.unmatched_courses || []).filter(c => /Elective/i.test(c)).length;
                            if (electiveCount > 0) {
                                const variants = [
                                    (n: number) => `You're missing ${n} elective${n>1?'s':''}. Use Kairoll to choose non-conflicting times and add them.`,
                                    (n: number) => `${n} elective${n>1?'s are':' is'} still open — pick a section in Kairoll that doesn't clash and add it.`,
                                    (n: number) => `Reminder: add ${n} elective${n>1?'s':''}. Browse in Kairoll and pick times that don't overlap.`,
                                ];
                                const variant = variants[Math.floor(Math.random() * variants.length)](electiveCount);
                                confirmationMessage = `${confirmationMessage}\n\n${variant}`;
                            }
                        } catch (error) {
                            console.error('❌ Failed to generate GPT response, using fallback:', error);
                            // Fallback to simple message without emojis
                            confirmationMessage = `Generated your schedule with ${scheduleResult.events.length} classes added to your calendar.`;
                            if (scheduleResult.unmatched_courses.length > 0) {
                                confirmationMessage += ` Couldn't schedule: ${scheduleResult.unmatched_courses.join(', ')}.`;
                            }
                            // Add a varied, LLM-style nudge about electives and Kairoll
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

                    // Send schedule generation response
                    const assistantMessageId = (Date.now() + 1).toString();
                    typeMessage(confirmationMessage, assistantMessageId);
                    setIsLoading(false);
                    return; // Exit early, don't send to AI

                } catch (scheduleError) {
                    console.error('❌ Schedule generation failed:', scheduleError);
                    // Fall through to normal AI processing if schedule generation fails
                }
            }



            // Prepare the request payload with session_id if available (normal AI flow)
            const requestPayload: { message: string; session_id?: string } = {
                message: userMessage.content
            };

            if (sessionId) {
                requestPayload.session_id = sessionId;
            }

            const response = await api.post('/api/ai/chat/', requestPayload);

            // Handle session_id from response (for new sessions or session updates)
            if (response.data.session_id) {
                const newSessionId = response.data.session_id;
                if (newSessionId !== sessionId) {
                    setSessionId(newSessionId);
                    sessionStorage.setItem('kairo_session_id', newSessionId);
                }
            }

            // Handle session reset response (has 'message' instead of 'content')
            if (response.data.message && !response.data.content) {
                // This is a session reset response
                clearConversation();
                setSessionId(response.data.session_id);
                sessionStorage.setItem('kairo_session_id', response.data.session_id);

                const resetMessageId = (Date.now() + 1).toString();
                typeMessage(response.data.message, resetMessageId);
                return;
            }

            // Check if the response contains JSON for calendar event creation
            let displayContent = response.data.content;
            let createdEvents: ApiCalendarEvent[] = [];

            // Also check if the USER's message contains calendar event JSON
            const userMessageContent = userMessage.content;

            // Try to parse and create events from the user's message
            try {

                // First check if it's natural language
                if (isNaturalLanguage(userMessageContent)) {
                    const parseResult = parseNaturalLanguage(userMessageContent);


                    if (parseResult.success && parseResult.events.length > 0) {

                        // Create events using the API
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
                                // Continue with other events even if one fails
                            }
                        }

                        // Override the display content with the natural language confirmation
                        if (parseResult.confirmation) {
                            displayContent = parseResult.confirmation;
                        }
                    } else if (!parseResult.success && parseResult.error) {
                        // Add helpful error message to the AI response
                        displayContent = response.data.content;
                    }
                } else {
                    // Try JSON parsing
                    const events = await parseAndCreateCalendarEvents(userMessageContent);
                    if (events.length > 0) {
                        createdEvents.push(...events);
                    }
                }
            } catch (error) {
                // Add helpful message if there was an authentication or API error
                if (error instanceof Error && error.message.includes('401')) {
                    displayContent = `${response.data.content}\n\n❌ **Authentication Error:** Please try logging out and logging back in.`;
                } else if (error instanceof Error && error.message.includes('403')) {
                    displayContent = `${response.data.content}\n\n❌ **Permission Error:** You don't have permission to add calendar events.`;
                }
            }

            // Check if the AI response contains JSON for calendar event creation
            const jsonPattern = /```json\s*([\s\S]*?)\s*```/g;
            let match;

            // Process all JSON blocks in the response
            while ((match = jsonPattern.exec(response.data.content)) !== null) {
                try {
                    const jsonData = JSON.parse(match[1]);
                    if (jsonData.action === 'create_calendar_event' && jsonData.params) {
                        // Remove the JSON block from the displayed content
                        displayContent = displayContent.replace(match[0], '').trim();

                        // Create the calendar event using parseAndCreateCalendarEvents
                        const jsonString = JSON.stringify(jsonData);
                        const events = await parseAndCreateCalendarEvents(jsonString);
                        createdEvents.push(...events);
                    } else if (jsonData.action === 'remove_calendar_event' && jsonData.params) {
                        // Remove the JSON block from the displayed content
                        displayContent = displayContent.replace(match[0], '').trim();

                        // For remove events, trigger calendar refresh
                        if (onEventAdded) {
                            onEventAdded();
                        }
                    } else if (jsonData.action === 'remove_all_calendar_events') {
                        // Remove the JSON block from the displayed content
                        displayContent = displayContent.replace(match[0], '').trim();

                        // For remove all events, trigger calendar refresh
                        if (onEventAdded) {
                            onEventAdded();
                        }
                    }
                } catch (parseError) {
                    console.warn('Failed to parse JSON from AI response:', parseError);
                }
            }

            // If no code blocks found, look for plain JSON objects (multiple)
            if (createdEvents.length === 0) {
                const plainJsonPattern = /\{[^}]*"action"\s*:\s*"create_calendar_event"[^}]*\}/g;
                let plainMatch;

                while ((plainMatch = plainJsonPattern.exec(response.data.content)) !== null) {
                    try {
                        const jsonData = JSON.parse(plainMatch[0]);
                        if (jsonData.action === 'create_calendar_event' && jsonData.params) {
                            // Remove the JSON object from the displayed content
                            displayContent = displayContent.replace(plainMatch[0], '').trim();

                            // Create the calendar event using parseAndCreateCalendarEvents
                            const jsonString = JSON.stringify(jsonData);
                            const events = await parseAndCreateCalendarEvents(jsonString);
                            createdEvents.push(...events);
                        }
                    } catch (parseError) {
                        console.warn('Failed to parse plain JSON from AI response:', parseError);
                    }
                }
            }

            // Fallback: try to parse the entire response as JSON if it looks like one
            if (createdEvents.length === 0) {
                const trimmedContent = response.data.content.trim();
                if (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) {
                    try {
                        const jsonData = JSON.parse(trimmedContent);
                        if (jsonData.action === 'create_calendar_event' && jsonData.params) {
                            // For pure JSON responses, provide a friendly message
                            displayContent = `I've added "${jsonData.params.title}" to your calendar for ${jsonData.params.day_of_week} from ${jsonData.params.start_time} to ${jsonData.params.end_time}.`;

                            // Create the calendar event using parseAndCreateCalendarEvents
                            const events = await parseAndCreateCalendarEvents(trimmedContent);
                            createdEvents.push(...events);
                        } else if (jsonData.action === 'remove_all_calendar_events') {
                            // For pure JSON responses for remove all, provide a friendly message
                            displayContent = "I'll remove all events from your calendar.";

                            // Trigger calendar refresh to show all events removed
                            if (onEventAdded) {
                                onEventAdded();
                            }
                        }
                    } catch (parseError) {
                        console.warn('Failed to parse entire response as JSON:', parseError);
                    }
                }
            }

            // If events were created, create a success message
            if (createdEvents.length > 0) {

                // If we already have a natural language confirmation, use it
                if (!displayContent.includes('Added') && !displayContent.includes('added')) {
                    const eventSummary = createdEvents.map(event =>
                        `"${event.title}" on ${event.day_of_week} from ${event.start_time} to ${event.end_time}`
                    ).join(' and ');

                    displayContent = `I've added ${eventSummary} to your calendar.`;
                }

                // Trigger calendar refresh - IMPORTANT!
                if (onEventAdded) {
                    onEventAdded();
                }
            } else {
            }

            // Append uOZone link for professor comparison questions
            // Disabled automatic link appending to avoid spam
            // if (isProfessorComparisonQuestion(userMessage.content)) {
            //     const courseCode = extractCourseCode(userMessage.content);
            //     if (courseCode) {
            //         displayContent = `${displayContent}\nYou can also check uOZone for the latest professor and section info:\nhttps://uo.zone/course/${courseCode}`;
            //     }
            // }

            // Check if the AI response indicates calendar deletion for visual feedback
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

                // Extract number of deleted events if possible
                const countMatch = displayContent.match(/(\d+)\s+events?/i);
                const deletedCount = countMatch ? parseInt(countMatch[1]) : 1;

                // Dispatch event to trigger visual feedback and immediate refresh
                window.dispatchEvent(new CustomEvent('aiCalendarDeletion', {
                    detail: { type: 'ai_response', count: deletedCount }
                }));

                // ALSO trigger an immediate calendar refresh to show the changes
                if (onEventAdded) {
                    onEventAdded(); // This increments refreshKey which forces a full refresh
                }
            }

            // Final check: if the AI response seems to be answering something outside Kairo's scope, provide an honest response instead
            const finalHonestCheck = shouldProvideHonestResponse(userMessage.content);
            if (finalHonestCheck.shouldRespond && finalHonestCheck.response) {
                // Check if the AI response contains generic knowledge or non-academic content
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

            // Start typing animation for the assistant's message
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

    // Show welcome screen when conversation hasn't started
    if (!hasStartedConversation && !isLoadingHistory) {
        return (
            <div className="font-mono h-full w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-white dark:bg-[rgb(var(--secondary-bg))] transition-colors duration-300">
                {/* Centered Content */}
                <div className="flex flex-col items-center justify-center flex-1 max-w-2xl w-full">
                    {/* Typewriter Text */}
                    <div className="mb-6 sm:mb-8 text-center px-4">
                        <h2 className="text-gray-900 dark:text-neutral-300 text-lg sm:text-xl font-medium transition-colors duration-300">
                            <TypewriterText
                                text={getFunnyMessage() || "Kairo's awake after 5. Unlike your prof."}
                                speed={70}
                            />
                        </h2>
                    </div>

                    {/* Input Form with Simple Animation */}
                    <div className="w-full max-w-lg px-4">
                        <form onSubmit={sendMessage} className="w-full">
                            <div className="bg-gray-50 dark:bg-[rgb(var(--card-bg))] border border-gray-200 dark:border-[rgb(var(--border-color))] rounded-xl p-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-300 relative overflow-hidden">
                                <div className="flex-1 relative flex items-center">
                                    <input
                                        type="text"
                                        value={inputMessage}
                                        onChange={(e) => setInputMessage(e.target.value)}
                                        // allow typing while generating
                                        className="w-full bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-neutral-500 text-gray-900 dark:text-white disabled:opacity-50 relative z-10 transition-colors duration-300 h-7 leading-7 pr-2"
                                    />
                                    {!inputMessage && (
                                        <div className="absolute inset-0 flex items-center overflow-hidden">
                                            <div
                                                className={`text-gray-500 dark:text-neutral-500 transition-all duration-500 ${isVisible
                                                    ? 'opacity-100'
                                                    : 'opacity-0'
                                                    }`}
                                            >
                                                {displayText}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <ChatEmailButton currentMessage={inputMessage} />
                                <button
                                    type="submit"
                                    disabled={!inputMessage.trim() || isLoading}
                                    className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white shadow-sm transition-colors duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    <ArrowRight className="w-4.5 h-4.5" />
                                </button>
                            </div>
                        </form>


                    </div>
                </div>
            </div>
        );
    }

    // Show full chat interface when conversation has started
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
                        {/* Central Dot */}
                        <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-blue-600 dark:bg-[rgb(var(--accent-color))] rounded-full -translate-x-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_6px_rgba(59,130,246,0.6)]" />

                        {/* Orbiting Dots */}
                        <div className="absolute w-full h-full animate-spin-slow">
                            {/* Cyan dot at 0° */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: 'translate(-50%, -50%) rotate(0deg) translateX(10px)' }}>
                                <div className="w-1 h-1 bg-cyan-500 dark:bg-cyan-400 rounded-full animate-bob" />
                            </div>

                            {/* Indigo dot at 90° */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: 'translate(-50%, -50%) rotate(90deg) translateX(10px)' }}>
                                <div className="w-1 h-1 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bob" style={{ animationDelay: '0.375s' }} />
                            </div>

                            {/* Purple dot at 180° */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: 'translate(-50%, -50%) rotate(180deg) translateX(10px)' }}>
                                <div className="w-1 h-1 bg-purple-500 dark:bg-purple-400 rounded-full animate-bob" style={{ animationDelay: '0.75s' }} />
                            </div>

                            {/* Blue dot at 270° */}
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
                                // New program sequence rendering
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
                                </div>
                            ) : message.curriculumData ? (
                                // Legacy curriculum display (for backward compatibility)
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
                                </div>
                            ) : (
                                // Regular message rendering
                                <div
                                    className={`${message.role === 'user'
                                        ? 'bg-gray-100 dark:bg-white/10 rounded-lg p-2 text-gray-900 dark:text-white max-w-[85%] sm:max-w-xs ml-auto mb-2 transition-colors duration-300'
                                        : 'bg-gray-50 dark:bg-[rgb(var(--card-bg))] border border-gray-200 dark:border-[rgb(var(--border-color))] text-gray-900 dark:text-neutral-300 self-start p-3 rounded-lg max-w-[90%] sm:max-w-[70%] transition-colors duration-300'
                                        }`}
                                >
                                    <MessageContent
                                        content={message.content}
                                        className="text-sm leading-relaxed"
                                    />
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

                    {/* Floating star thinking indicator */}
                    {isLoading && !isTyping && (
                        <div className="flex justify-start">
                    <div className="relative w-6 h-6">
                                {/* Central Dot */}
                        <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-blue-600 dark:bg-[rgb(var(--accent-color))] rounded-full -translate-x-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_6px_rgba(59,130,246,0.6)]" />

                                {/* Orbiting Dots */}
                                <div className="absolute w-full h-full animate-spin-slow">
                                    {/* Cyan dot at 0° */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: 'translate(-50%, -50%) rotate(0deg) translateX(10px)' }}>
                                        <div className="w-1 h-1 bg-cyan-500 dark:bg-cyan-400 rounded-full animate-bob" />
                                    </div>

                                    {/* Indigo dot at 90° */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: 'translate(-50%, -50%) rotate(90deg) translateX(10px)' }}>
                                        <div className="w-1 h-1 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bob" style={{ animationDelay: '0.375s' }} />
                                    </div>

                                    {/* Purple dot at 180° */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: 'translate(-50%, -50%) rotate(180deg) translateX(10px)' }}>
                                        <div className="w-1 h-1 bg-purple-500 dark:bg-purple-400 rounded-full animate-bob" style={{ animationDelay: '0.75s' }} />
                                    </div>

                                    {/* Blue dot at 270° */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: 'translate(-50%, -50%) rotate(270deg) translateX(10px)' }}>
                                        <div className="w-1 h-1 bg-blue-400 dark:bg-blue-300 rounded-full animate-bob" style={{ animationDelay: '1.125s' }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div ref={messagesEndRef} />
            </div>

            {/* Input Form with Simple Animation */}
            <div className="w-full">
                <form onSubmit={sendMessage} className="w-full">
                    <div className="bg-gray-50 dark:bg-[rgb(var(--card-bg))] border border-gray-200 dark:border-[rgb(var(--border-color))] rounded-2xl p-3 sm:p-4 flex flex-col gap-2 relative overflow-hidden transition-colors duration-300 hover:bg-gray-100 dark:hover:bg-white/5">
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                // allow typing while generating
                                className="w-full bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-neutral-500 text-gray-900 dark:text-white disabled:opacity-50 relative z-10 transition-colors duration-300 h-10 leading-10 pr-2"
                            />
                            {!inputMessage && (
                                <div className="absolute inset-0 flex items-center overflow-hidden">
                                    <div
                                        className={`text-gray-500 dark:text-neutral-500 italic transition-all duration-500 ${isVisible
                                            ? 'opacity-100'
                                            : 'opacity-0'
                                            }`}
                                    >
                                        {displayText}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ChatEmailButton currentMessage={inputMessage} />
                                <span className="text-[11px] text-gray-500 dark:text-neutral-400">Email</span>
                            </div>
                            <button
                                type="submit"
                                disabled={!inputMessage.trim() || isLoading}
                                className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white shadow-sm transition-colors duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <ArrowRight className="w-4.5 h-4.5" />
                            </button>
                        </div>
                    </div>
                </form>


            </div>
        </div>
    );
}

// Course Card Component with expandable sections
interface MultiSelectSectionDropdownProps {
    course: Course;
    onSelectionChange: (selectedSections: string[]) => void;
}

function MultiSelectSectionDropdown({ course, onSelectionChange }: MultiSelectSectionDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedSections, setSelectedSections] = useState<string[]>([]);

    // Get the course code for creating unique section IDs
    const courseCode = isCourseLegacy(course) ? course.code : course.courseCode;

    // Process sections from either legacy format or new format
    const sectionOptions = useMemo(() => {
        if (isCourseLegacy(course)) {
            // Handle legacy format
            const groupedSections = course.sections.reduce((groups: { [key: string]: Section[] }, section) => {
                const sectionCode = section.sectionCode;
                if (!groups[sectionCode]) {
                    groups[sectionCode] = [];
                }
                groups[sectionCode].push(section);
                return groups;
            }, {});

            return Object.entries(groupedSections).map(([sectionCode, sections]) => ({
                value: `${courseCode}-${sectionCode}`,
                displayValue: sectionCode,
                label: `Section ${sectionCode}`,
                details: sections[0].instructor,
                time: sections[0].schedule?.time || '',
                days: '',
                status: sections[0].status,
                sections: sections
            }));
        } else {
            // Handle new format with sectionGroups
            return Object.entries(course.sectionGroups || {}).map(([groupId, group]: [string, any]) => {
                const lecture = group.lecture;
                // Get the actual section code from lecture, or from any available section in the group
                const actualSectionCode = lecture?.section?.split('-')[0] ||
                    group.labs?.[0]?.section?.split('-')[0] ||
                    group.tutorials?.[0]?.section?.split('-')[0] ||
                    `${groupId}00`;
                return {
                    value: `${courseCode}-${actualSectionCode}`,
                    displayValue: actualSectionCode,
                    label: `Section ${actualSectionCode}`,
                    details: lecture?.instructor || 'TBA',
                    time: lecture?.time || '',
                    days: '',
                    status: lecture?.status || 'Unknown',
                    sections: [lecture, ...(group.labs || []), ...(group.tutorials || [])]
                };
            });
        }
    }, [course, courseCode]);

    // Use ref to track pending toggles to prevent race conditions
    const pendingToggles = useRef<Set<string>>(new Set());

    const handleSectionToggle = useCallback((sectionValue: string) => {
        // Prevent rapid clicking on the same section
        if (pendingToggles.current.has(sectionValue)) {
            return;
        }
        
        pendingToggles.current.add(sectionValue);
        
        // Use setTimeout to batch updates and prevent UI flicker
        setTimeout(() => {
            const newSelection = selectedSections.includes(sectionValue)
                ? selectedSections.filter(s => s !== sectionValue)
                : [...selectedSections, sectionValue];

            setSelectedSections(newSelection);
            onSelectionChange(newSelection);
            
            // Remove from pending after a short delay
            setTimeout(() => {
                pendingToggles.current.delete(sectionValue);
            }, 100);
        }, 0);
    }, [selectedSections, onSelectionChange]);

    const displayText = selectedSections.length === 0
        ? "Select sections..."
        : selectedSections.map(s => {
            const sectionCode = s.split('-').pop();
            return `Section ${sectionCode}`;
        }).join(", ");

    function formatStackedTime(time: any): React.ReactNode {
        if (!time) return null;
        const parts = String(time).split(',').map((p: string) => p.trim());
        return (
            <div>
                {parts.map((p, idx) => (
                    <div key={idx}>{p}</div>
                ))}
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Dropdown Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-white/5 rounded px-3 py-2 text-black dark:text-[#e0e0e0] text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-300 text-left flex items-center justify-between"
            >
                <span className={selectedSections.length === 0 ? "text-gray-500 dark:text-gray-400" : ""}>
                    {displayText}
                </span>
                <span className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-64 overflow-y-auto">
                    {sectionOptions.map((option) => (
                        <div
                            key={option.value}
                            className={`px-3 py-2 border-b border-gray-100 dark:border-gray-600 last:border-b-0 transition-colors duration-150 ${
                                pendingToggles.current.has(option.value) 
                                    ? 'bg-orange-50 dark:bg-orange-900/20 cursor-wait' 
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'
                            }`}
                            onClick={() => handleSectionToggle(option.value)}
                        >
                            <div className="flex items-center gap-3">
                                {/* Checkbox */}
                                <input
                                    type="checkbox"
                                    checked={selectedSections.includes(option.value)}
                                    onChange={(e) => { 
                                        e.stopPropagation(); 
                                        e.preventDefault();
                                        handleSectionToggle(option.value); 
                                    }}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded pointer-events-none"
                                    readOnly
                                />

                                {/* Section Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-black dark:text-white">
                                            {option.label}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                        <div>{option.details}</div>
                                        {option.time && (
                                            <div className="mt-0.5">
                                                {formatStackedTime(option.time)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {sectionOptions.length === 0 && (
                        <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                            No sections available
                        </div>
                    )}
                </div>
            )}

            {/* Click outside to close */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}

interface CourseCardProps {
    course: Course;
    onAddCourse: (course: Course) => void;
    onSectionToggle?: (section: any, isSelected: boolean) => void;
    selectedSectionEvents?: Map<string, number[]>; // Add the global state
    pendingAdditions?: Map<string, string>; // Add pending state for loading indicators
}

const CourseCard = React.memo(function CourseCard({ course, onAddCourse, onSectionToggle, selectedSectionEvents, pendingAdditions }: CourseCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    // Use the global selection state with unique course-section identifiers
    const isSelected = (sectionCode: string) => {
        // Create unique identifier: courseCode-sectionCode
        const courseCode = isCourseGrouped(course) ? course.courseCode : course.code;
        const uniqueKey = `${courseCode}-${sectionCode}`;
        // Check both selected events and pending additions for accurate state
        return (selectedSectionEvents ? selectedSectionEvents.has(uniqueKey) : false) || 
               (pendingAdditions ? pendingAdditions.has(uniqueKey) : false);
    };

    // Check if section is currently being processed
    const isPending = (sectionCode: string) => {
        const courseCode = isCourseGrouped(course) ? course.courseCode : course.code;
        const uniqueKey = `${courseCode}-${sectionCode}`;
        return pendingAdditions ? pendingAdditions.has(uniqueKey) : false;
    };

    const toggleSectionExpansion = (sectionCode: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionCode)) {
                newSet.delete(sectionCode);
            } else {
                newSet.add(sectionCode);
            }
            return newSet;
        });
    };

    const handleSectionClick = (sectionCode: string, sectionData: any) => {
        const isCurrentlySelected = isSelected(sectionCode);

        // Create unique identifier for the section data
        const courseCode = isCourseGrouped(course) ? course.courseCode : course.code;
        const uniqueSectionData = {
            ...sectionData,
            uniqueKey: `${courseCode}-${sectionCode}`, // Add unique identifier
            courseCode: courseCode // Ensure courseCode is always available
        };

        // Call the toggle callback if provided
        if (onSectionToggle) {
            onSectionToggle(uniqueSectionData, !isCurrentlySelected);
        }
    };


    // Helper function to format time with stacked days
    const formatStackedTime = (timeString: string | undefined) => {
        if (!timeString) return null;

        // Split by comma to separate different day/time combinations
        const timeParts = timeString.split(', ').map(part => part.trim());

        return (
            <div>
                {timeParts.map((part, index) => (
                    <div key={index}>{part}</div>
                ))}
            </div>
        );
    };

    // Type guard check and render appropriate format
    if (isCourseGrouped(course)) {
        return (
            <div className="bg-gray-100 dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 rounded-lg transition-colors">
                {/* Course Header - Grouped Format */}
                <div
                    className="p-3 sm:p-4 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/[0.12] transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <h3 className="font-semibold text-black dark:text-white text-sm sm:text-base">{course.courseCode}</h3>
                            {isExpanded && (
                                <a
                                    href={`https://uo.zone/course/${course.courseCode.replace(/\s+/g, '').toLowerCase()}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 dark:text-blue-400 underline text-xs hover:opacity-80 font-bold animate-in slide-in-from-left-3 fade-in duration-300"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Best Profs for {course.courseCode}
                                </a>
                            )}
                        </div>
                        <span className="text-gray-500 dark:text-gray-400 text-sm">
                            {isExpanded ? '▼' : '▶'}
                        </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm mb-1">{course.courseTitle}</p>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {course.subjectCode} • {course.term}
                    </div>
                </div>

                {/* Sections (expandable) - Group by prefix */}
                {isExpanded && course.sectionGroups && (() => {
                    // Group all sections by their letter prefix (A, B, C, D, etc.)
                    const groupedByPrefix = new Map<string, {
                        lecture?: any;
                        labs: any[];
                        tutorials: any[];
                    }>();

                    // Collect all sections from sectionGroups
                    Object.entries(course.sectionGroups).forEach(([groupId, sectionGroup]: [string, any]) => {
                        // Get prefix from lecture section (e.g., "B0000-LEC" -> "B")
                        const lecturePrefix = sectionGroup.lecture?.section?.charAt(0) || groupId.charAt(0);

                        if (!groupedByPrefix.has(lecturePrefix)) {
                            groupedByPrefix.set(lecturePrefix, { labs: [], tutorials: [] });
                        }

                        const group = groupedByPrefix.get(lecturePrefix)!;

                        // Add lecture
                        if (sectionGroup.lecture) {
                            group.lecture = sectionGroup.lecture;
                        }

                        // Add labs
                        if (sectionGroup.labs) {
                            group.labs.push(...sectionGroup.labs);
                        }

                        // Add tutorials
                        if (sectionGroup.tutorials) {
                            group.tutorials.push(...sectionGroup.tutorials);
                        }
                    });

                    // Sort prefixes alphabetically
                    const sortedPrefixes = Array.from(groupedByPrefix.keys()).sort();

                    return (
                        <div className="border-t border-gray-200 dark:border-white/10">
                            {sortedPrefixes.map((prefix) => {
                                const group = groupedByPrefix.get(prefix)!;
                                const isDetailExpanded = expandedSections.has(prefix);
                                // Get the actual section code from lecture, or from any available section in the group
                                const baseSectionCode = group.lecture?.section?.split('-')[0] ||
                                    group.labs[0]?.section?.split('-')[0] ||
                                    group.tutorials[0]?.section?.split('-')[0] ||
                                    `${prefix}00`;

                                return (
                                    <div key={prefix} className="border-b border-gray-200 dark:border-white/10 last:border-b-0">
                                        {/* Main section header */}
                                        <div
                                            className="p-2 sm:p-3 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer touch-manipulation"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleSectionExpansion(prefix);
                                            }}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                                                            {isDetailExpanded ? '▼' : '▶'}
                                                        </span>
                                                        <span className="font-medium text-black dark:text-white text-xs sm:text-sm">
                                                            Section {baseSectionCode}
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* RMP Rating - only show when section is expanded */}
                                                {isDetailExpanded && group.lecture?.instructor && (
                                                    <div className="flex items-center">
                                                        <RMPRating
                                                            professorName={group.lecture.instructor}
                                                            compact={true}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            {group.lecture && (
                                                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span>{group.lecture.instructor}</span>
                                                    </div>
                                                    <div>{group.lecture.time}</div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Detailed sections (expandable) */}
                                        {isDetailExpanded && (
                                            <div className="bg-gray-50 dark:bg-white/[0.02] border-t border-gray-200 dark:border-white/5">
                                                {/* Lecture Section */}
                                                {group.lecture && (
                                                    <>
                                                        {/* Lecture Header */}
                                                        <div className="px-6 pt-3 pb-1">
                                                            <span className="text-base text-neutral-600 dark:text-white font-bold">Lecture</span>
                                                        </div>
                                                        <div className="px-6 py-2.5 border-b border-gray-200 dark:border-white/5">
                                                            <div className="flex justify-between items-center">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="font-medium text-black dark:text-white text-xs">
                                                                            {group.lecture.section.split('-')[0]}-{group.lecture.section.split('-')[1] || 'LEC'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-xs text-gray-600 dark:text-gray-400">
                                                                        {formatStackedTime(group.lecture.time)}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 min-w-[70px] justify-center"
                                                                        style={{
                                                                            backgroundColor: group.lecture.status === 'Open' ? '#bbf7d0' : '#fecaca',
                                                                            color: group.lecture.status === 'Open' ? '#15803d' : '#dc2626'
                                                                        }}>
                                                                        <span>{group.lecture.status === 'Open' ? '🟩' : '🟥'}</span>
                                                                        {group.lecture.status === 'Open' ? 'Open' : 'Closed'}
                                                                    </span>
                                                                    <div
                                                                        className={`w-5 h-5 border-2 transition-all duration-200 touch-manipulation rounded-sm ${
                                                                            isPending(group.lecture.section)
                                                                                ? 'border-orange-400 bg-orange-100 animate-pulse cursor-wait'
                                                                                : isSelected(group.lecture.section)
                                                                                    ? 'bg-blue-600 border-blue-600 shadow-lg transform scale-110 cursor-pointer'
                                                                                    : 'border-gray-400 dark:border-gray-500 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                                                        }`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            e.preventDefault();
                                                                            
                                                                            // Prevent multiple clicks while pending
                                                                            if (isPending(group.lecture.section)) {
                                                                                return;
                                                                            }
                                                                            
                                                                            handleSectionClick(group.lecture.section, {
                                                                                ...group.lecture,
                                                                                code: group.lecture.section,
                                                                                courseCode: course.courseCode,
                                                                                courseTitle: course.courseTitle,
                                                                                type: group.lecture.section.split('-')[1] || 'LEC'
                                                                            });
                                                                        }}
                                                                    >
                                                                        {isPending(group.lecture.section) ? (
                                                                            <div className="w-full h-full flex items-center justify-center">
                                                                                <div className="w-2.5 h-2.5 border border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                                                                            </div>
                                                                        ) : isSelected(group.lecture.section) && (
                                                                            <div className="w-full h-full flex items-center justify-center">
                                                                                <span className="text-white text-xs sm:text-xs font-bold">✓</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                {/* Labs Section */}
                                                {group.labs && group.labs.length > 0 && (
                                                    <>
                                                        {/* Extra spacing before Labs */}
                                                        <div className="py-1"></div>
                                                        {/* Labs Header */}
                                                        <div className="px-6 pt-3 pb-1 flex justify-between items-center">
                                                            <span className="text-base text-neutral-600 dark:text-white font-bold">Labs</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">Choose 1 of {group.labs.length}</span>
                                                        </div>
                                                        {group.labs.sort((a, b) => a.section.localeCompare(b.section)).map((lab: any, idx: number) => (
                                                            <div key={idx} className="px-6 py-2.5 border-b border-gray-200 dark:border-white/5">
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className="font-medium text-black dark:text-white text-xs">
                                                                                {lab.section.split('-')[0]}-{lab.section.split('-')[1] || 'LAB'}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                                                            {formatStackedTime(lab.time)}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 min-w-[70px] justify-center"
                                                                            style={{
                                                                                backgroundColor: lab.status === 'Open' ? '#bbf7d0' : '#fecaca',
                                                                                color: lab.status === 'Open' ? '#15803d' : '#dc2626'
                                                                            }}>
                                                                            <span>{lab.status === 'Open' ? '🟩' : '🟥'}</span>
                                                                            {lab.status === 'Open' ? 'Open' : 'Closed'}
                                                                        </span>
                                                                        <div
                                                                            className={`w-5 h-5 border-2 transition-all duration-200 touch-manipulation rounded-sm ${
                                                                                isPending(lab.section)
                                                                                    ? 'border-orange-400 bg-orange-100 animate-pulse cursor-wait'
                                                                                    : isSelected(lab.section)
                                                                                        ? 'bg-blue-600 border-blue-600 shadow-lg transform scale-110 cursor-pointer'
                                                                                        : 'border-gray-400 dark:border-gray-500 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                                                            }`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                e.preventDefault();
                                                                                
                                                                                // Prevent multiple clicks while pending
                                                                                if (isPending(lab.section)) {
                                                                                    return;
                                                                                }
                                                                                
                                                                                handleSectionClick(lab.section, {
                                                                                    ...lab,
                                                                                    code: lab.section,
                                                                                    courseCode: course.courseCode,
                                                                                    courseTitle: course.courseTitle,
                                                                                    type: lab.section.split('-')[1] || 'LAB'
                                                                                });
                                                                            }}
                                                                        >
                                                                            {isPending(lab.section) ? (
                                                                                <div className="w-full h-full flex items-center justify-center">
                                                                                    <div className="w-2.5 h-2.5 border border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                                                                                </div>
                                                                            ) : isSelected(lab.section) && (
                                                                                <div className="w-full h-full flex items-center justify-center">
                                                                                    <span className="text-white text-xs">✓</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </>
                                                )}

                                                {/* Tutorials Section */}
                                                {group.tutorials && group.tutorials.length > 0 && (
                                                    <>
                                                        {/* Extra spacing before Tutorials */}
                                                        <div className="py-1"></div>
                                                        {/* Tutorials Header */}
                                                        <div className="px-6 pt-3 pb-1 flex justify-between items-center">
                                                            <span className="text-base text-neutral-600 dark:text-white font-bold">Tutorials</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">Choose 1 of {group.tutorials.length}</span>
                                                        </div>
                                                        {group.tutorials.sort((a, b) => a.section.localeCompare(b.section)).map((tutorial: any, idx: number) => {
                                                            // Extract actual section type from section code (e.g., "A06-DGD" -> "DGD")
                                                            const sectionType = tutorial.section.split('-')[1] || 'TUT';

                                                            return (
                                                                <div key={idx} className="px-6 py-2.5 border-b border-gray-200 dark:border-white/5 last:border-b-0">
                                                                    <div className="flex justify-between items-center">
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                <span className="font-medium text-black dark:text-white text-xs">
                                                                                    {tutorial.section.split('-')[0]}-{sectionType}
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-xs text-gray-600 dark:text-gray-400">
                                                                                {formatStackedTime(tutorial.time)}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 min-w-[70px] justify-center"
                                                                                style={{
                                                                                    backgroundColor: tutorial.status === 'Open' ? '#bbf7d0' : '#fecaca',
                                                                                    color: tutorial.status === 'Open' ? '#15803d' : '#dc2626'
                                                                                }}>
                                                                                <span>{tutorial.status === 'Open' ? '🟩' : '🟥'}</span>
                                                                                {tutorial.status === 'Open' ? 'Open' : 'Closed'}
                                                                            </span>
                                                                            <div
                                                                                className={`w-5 h-5 border-2 transition-all duration-200 touch-manipulation rounded-sm ${
                                                                                    isPending(tutorial.section)
                                                                                        ? 'border-orange-400 bg-orange-100 animate-pulse cursor-wait'
                                                                                        : isSelected(tutorial.section)
                                                                                            ? 'bg-blue-600 border-blue-600 shadow-lg transform scale-110 cursor-pointer'
                                                                                            : 'border-gray-400 dark:border-gray-500 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                                                                }`}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    e.preventDefault();
                                                                                    
                                                                                    // Prevent multiple clicks while pending
                                                                                    if (isPending(tutorial.section)) {
                                                                                        return;
                                                                                    }
                                                                                    
                                                                                    handleSectionClick(tutorial.section, {
                                                                                        ...tutorial,
                                                                                        code: tutorial.section,
                                                                                        courseCode: course.courseCode,
                                                                                        courseTitle: course.courseTitle,
                                                                                        type: sectionType
                                                                                    });
                                                                                }}
                                                                            >
                                                                                {isPending(tutorial.section) ? (
                                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                                        <div className="w-2.5 h-2.5 border border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                                                                                    </div>
                                                                                ) : isSelected(tutorial.section) && (
                                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                                        <span className="text-white text-xs">✓</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div >
        );
    } else {
        // Legacy format - fallback for old course structure
        return (
            <div className="bg-gray-100 dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 rounded-lg transition-colors">
                <div
                    className="p-4 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/[0.12] transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-black dark:text-white">{isCourseGrouped(course) ? course.courseCode : course.code}</h3>
                        <span className="text-gray-500 dark:text-gray-400 text-sm">
                            {isExpanded ? '▼' : '▶'}
                        </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm mb-1">{isCourseGrouped(course) ? course.courseTitle : course.name}</p>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {isCourseGrouped(course) ? 'N/A' : course.credits} credits • {isCourseGrouped(course) ? 'N/A' : course.faculty}
                    </div>
                </div>
                {/* Legacy sections implementation would go here */}
            </div>
        );
    }
});

function SocialComponent() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    // No token - treat as guest user
                    setUser({ id: null, isGuest: true });
                    setLoading(false);
                    return;
                }

                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/profile/`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    const userData = await response.json();
                    setUser(userData);
                } else {
                    // Invalid token - treat as guest user
                    setUser({ id: null, isGuest: true });
                }
            } catch (error) {
                console.error('Failed to fetch user info:', error);
                // On error, treat as guest user
                setUser({ id: null, isGuest: true });
            } finally {
                setLoading(false);
            }
        };

        fetchUserInfo();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-[#121212] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    const isGuest = !user || user.isGuest || !user.id;

    return (
        <div className="min-h-screen bg-white dark:bg-[#121212]">
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold mb-4">Feature Removed</h1>
                <p>This feature has been removed from the application.</p>
            </div>
        </div>
    );
}

interface FeatureCarouselProps {
    isOpen: boolean;
    onClose: () => void;
    onSignup: () => void;
    onLogin: () => void;
    isMobile: boolean;
}

function FeatureCarousel({ isOpen, onClose, onSignup, onLogin, isMobile }: FeatureCarouselProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const features = [
        {
            title: "Smart Course Scheduling",
            description: "Build your perfect class schedule in minutes with intelligent course search and interactive calendar visualization.",
            icon: (
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
            gradient: "from-purple-600 to-indigo-600",
            bgGradient: "from-purple-600/10 to-indigo-600/10"
        },
        {
            title: "Course Intelligence",
            description: "Access comprehensive course descriptions, prerequisites, and professor ratings for  University of Ottawa courses.",
            icon: (
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            ),
            gradient: "from-violet-600 to-purple-600",
            bgGradient: "from-violet-600/10 to-purple-600/10"
        },
        {
            title: "AI Academic Assistant",
            description: "Get instant answers about courses, prerequisites, professors, and academic planning from your personal AI companion.",
            icon: (
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
            ),
            gradient: "from-indigo-600 to-blue-600",
            bgGradient: "from-indigo-600/10 to-blue-600/10"
        }
    ];

    const totalSlides = features.length + 1; // +1 for the CTA slide

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % totalSlides);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
    };

    const goToSlide = (index: number) => {
        setCurrentSlide(index);
    };

    // Touch handlers for mobile swipe
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;

        if (isLeftSwipe) {
            nextSlide();
        } else if (isRightSwipe) {
            prevSlide();
        }
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleOverlayClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
        >
            <motion.div
                className="relative bg-white dark:bg-gradient-to-b dark:from-[#111111] dark:to-[#0f0f0f] rounded-xl shadow-xl w-full max-w-sm h-[480px] overflow-hidden border border-gray-200 dark:border-white/5"
                initial={{ scale: 0.9, y: 50, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 50, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Close Button */}
                <button
                    className="absolute top-3 right-3 w-8 h-8 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-lg font-bold focus:outline-none z-20 transition-all duration-200"
                    onClick={onClose}
                    aria-label="Close"
                >
                    ×
                </button>

                {/* Navigation Arrows */}
                <button
                    onClick={prevSlide}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 text-lg font-bold focus:outline-none z-20 transition-all duration-200"
                    aria-label="Previous slide"
                >
                    ‹
                </button>
                <button
                    onClick={nextSlide}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 text-lg font-bold focus:outline-none z-20 transition-all duration-200"
                    aria-label="Next slide"
                >
                    ›
                </button>

                {/* Carousel Container */}
                <div className="relative h-full">
                    <div
                        className="flex transition-transform duration-500 ease-in-out h-full"
                        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                    >
                        {features.map((feature, index) => (
                            <div key={index} className="w-full flex-shrink-0 h-full">
                                <div className="h-full flex flex-col justify-center items-center text-center p-6">
                                    {/* Feature Icon */}
                                    <motion.div
                                        className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-6 shadow-lg`}
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                                        key={`icon-${currentSlide}`}
                                    >
                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            {feature.icon.props.children}
                                        </svg>
                                    </motion.div>

                                    {/* Feature Content */}
                                    <motion.div
                                        className="max-w-xs"
                                        initial={{ y: 30, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.4, duration: 0.6 }}
                                        key={`content-${currentSlide}`}
                                    >
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                                            {feature.title}
                                        </h2>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                            {feature.description}
                                        </p>
                                    </motion.div>
                                </div>
                            </div>
                        ))}

                        {/* Final Slide - Call to Action */}
                        <div className="w-full flex-shrink-0 h-full">
                            <div className="h-full flex flex-col justify-center items-center text-center p-6">
                                <motion.div
                                    className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center mb-6 shadow-lg"
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                                    key={`cta-icon-${currentSlide}`}
                                >
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </motion.div>

                                <motion.div
                                    className="max-w-xs"
                                    initial={{ y: 30, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.4, duration: 0.6 }}
                                    key={`cta-content-${currentSlide}`}
                                >
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                                        Ready to Get Started?
                                    </h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                                        Sign up or login to save your schedule and preferences!
                                    </p>

                                    <div className="space-y-3">
                                        <button
                                            onClick={onSignup}
                                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium px-6 py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                                        >
                                            Sign Up Free
                                        </button>
                                        <button
                                            onClick={onLogin}
                                            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium px-6 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                                        >
                                            Login
                                        </button>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">or</div>
                                        <button
                                            onClick={onClose}
                                            className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-medium underline underline-offset-2 decoration-gray-400/30 dark:decoration-gray-500/30 hover:text-gray-700 dark:hover:text-gray-200 hover:decoration-gray-500/50 dark:hover:decoration-gray-400/50 transition-colors duration-200"
                                        >
                                            Try Kairo first
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pagination Dots */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
                    {[...features, { title: "Get Started" }].map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-300 ${currentSlide === index
                                ? 'bg-black dark:bg-white scale-110 shadow-lg'
                                : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                                }`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>


            </motion.div>
        </motion.div>
    );
}

function KairollComponent() {
    const [selectedTerm, setSelectedTerm] = useState<string>(terms[0]);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [addedCourses, setAddedCourses] = useState<Course[]>([]);
    const [isLoadingCourses, setIsLoadingCourses] = useState<boolean>(true);
    const [selectedSectionEvents, setSelectedSectionEvents] = useState<Map<string, number[]>>(new Map());
    const [selectedSectionEventsByTerm, setSelectedSectionEventsByTerm] = useState<Map<string, Map<string, number[]>>>(new Map());
    const [pendingAdditions, setPendingAdditions] = useState<Map<string, string>>(new Map());

    // Additional state variables
    const [isComponentMounted, setIsComponentMounted] = useState<boolean>(false);
    const [localCourses, setLocalCourses] = useState<CourseGrouped[]>([]);
    const [cacheStatus, setCacheStatus] = useState<{ [term: string]: { age: number; valid: boolean; courseCount: number } }>({});
    const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(false);
    const [isMobile, setIsMobile] = useState<boolean>(false);
    const [coursesLoaded, setCoursesLoaded] = useState<boolean>(false);
    const [calendarEvents, setCalendarEvents] = useState<DailyCalendarEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<DailyCalendarEvent | null>(null);
    const [showEventModal, setShowEventModal] = useState(false);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
    const modalControls = useAnimation();
    const [isManualTermChange, setIsManualTermChange] = useState(false);

    // Load selected sections from localStorage on mount only
    useEffect(() => {
        const loadSelectedSections = () => {
            try {
                const guestSessionId = localStorage.getItem('guest_session_id') || 'default';
                // Load per-term selections
                const savedSelectionsByTerm = localStorage.getItem(`kairoll-selected-sections-by-term:${guestSessionId}`);
                if (savedSelectionsByTerm) {
                    const parsedData = JSON.parse(savedSelectionsByTerm);
                    const loadedMap = new Map<string, Map<string, number[]>>();

                    // Convert the parsed data back to nested Maps
                    Object.entries(parsedData).forEach(([term, sections]: [string, any]) => {
                        loadedMap.set(term, new Map<string, number[]>(Object.entries(sections)));
                    });

                    setSelectedSectionEventsByTerm(loadedMap);

                    // Set the current term's selections as the active ones
                    const currentTermSelections = loadedMap.get(selectedTerm) || new Map();
                    setSelectedSectionEvents(currentTermSelections);

                    return;
                }

                // Legacy: Load old format for backward compatibility
                const savedSelections = localStorage.getItem(`kairoll-selected-sections:${guestSessionId}`);
                if (savedSelections) {
                    const parsedData = JSON.parse(savedSelections);
                    const loadedMap = new Map<string, number[]>(parsedData);
                    setSelectedSectionEvents(loadedMap);

                    // Migrate to new format
                    const termMap = new Map<string, Map<string, number[]>>();
                    termMap.set(selectedTerm, loadedMap);
                    setSelectedSectionEventsByTerm(termMap);
                }
            } catch (error) {
                console.error('❌ Error loading selected sections:', error);
            }
        };

        loadSelectedSections();
    }, []); // Removed selectedTerm dependency - only load on mount

    // Save selected sections to localStorage whenever they change (debounced)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            try {
                const guestSessionId = localStorage.getItem('guest_session_id') || 'default';
                const serializedData: { [term: string]: { [section: string]: number[] } } = {};
                selectedSectionEventsByTerm.forEach((termSections, term) => {
                    serializedData[term] = {};
                    termSections.forEach((eventIds, section) => {
                        serializedData[term][section] = eventIds;
                    });
                });

                localStorage.setItem(`kairoll-selected-sections-by-term:${guestSessionId}`, JSON.stringify(serializedData));
            } catch (error) {
                console.error('❌ Error saving selected sections:', error);
            }
        }, 500); // Debounce localStorage writes

        return () => clearTimeout(timeoutId);
    }, [selectedSectionEventsByTerm]);

    // Welcome modal handlers
    const handleCloseWelcomeModal = () => {
        setShowWelcomeModal(false);
    };

    const handleSwipeDown = (info: any) => {
        if (info.offset.y > 150) { // Swiped down
            modalControls.start({ y: "100vh", opacity: 0 }).then(() => {
                handleCloseWelcomeModal();
            });
        } else {
            modalControls.start({ y: 0, opacity: 1 });
        }
    };

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) handleCloseWelcomeModal();
    };

    // Correctly calculate the number of unique courses from selected sections
    const uniqueCourseCount = useMemo(() => {
        if (!selectedSectionEvents.size) return 0;

        const courseCodes = new Set<string>();
        for (const sectionKey of selectedSectionEvents.keys()) {
            const dashIndex = sectionKey.indexOf('-');
            if (dashIndex > 0) {
                courseCodes.add(sectionKey.substring(0, dashIndex).trim());
            }
        }
        return courseCodes.size;
    }, [selectedSectionEvents]);

    const handleMobileEventClick = useCallback((event: DailyCalendarEvent, clickEvent: React.MouseEvent | React.TouchEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        
        setSelectedEvent(event);
        const rect = clickEvent.currentTarget.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        // Calculate position with better viewport handling
        let top = rect.top + scrollTop + rect.height + 5; // Position below the event
        let left = rect.left + scrollLeft;

        // Ensure modal stays within viewport bounds
        const modalWidth = 256; // w-64 = 256px
        const modalHeight = 200; // Approximate height with new content
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Adjust horizontal position if too far right
        if (left + modalWidth > viewportWidth) {
            left = viewportWidth - modalWidth - 10;
        }

        // Adjust vertical position if too far down
        if (top + modalHeight > scrollTop + viewportHeight) {
            top = rect.top + scrollTop - modalHeight - 5; // Position above the event
        }

        setPopupPosition({ x: Math.max(10, left), y: Math.max(10, top) });
        setShowEventModal(true);
    }, []);

    const handleCloseEventModal = () => {
        setShowEventModal(false);
        setSelectedEvent(null);
    };

    const handleSignupLogin = (type: 'signup' | 'login') => {
        setShowWelcomeModal(false);
        if (typeof window !== 'undefined') {
            window.open(`/${type}?redirect=${encodeURIComponent('/chat/?view=kairoll')}`, '_blank');
        }
    };

    useEffect(() => {
        if (showEventModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }

        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [showEventModal]);

    // Debounced version for better performance - reduced debounce time for faster removal
    const fetchCalendarEventsForMobileDebounced = useCallback(
        debounce(async () => {
            if (!isMobile) return;
            if (isAuthenticated()) {
                try {
                    const fetchedEvents = await getCalendarEvents();
                    let mappedEvents = fetchedEvents.map(event => ({
                        id: event.id,
                        title: event.title,
                        startTime: event.start_time,
                        endTime: event.end_time,
                        day_of_week: event.day_of_week
                    }));
                    
                    // Only update if we actually have different data to prevent unnecessary re-renders
                    setCalendarEvents(prev => {
                        const prevIds = new Set(prev.map(e => e.id));
                        const newIds = new Set(mappedEvents.map(e => e.id));
                        
                        // If the event sets are the same, don't update
                        if (prevIds.size === newIds.size && 
                            [...prevIds].every(id => newIds.has(id))) {
                            return prev;
                        }
                        
                        return mappedEvents;
                    });
                } catch (error) {
                    console.error('Failed to fetch calendar events for mobile:', error);
                }
            }
        }, 100), // Reduced from 150ms to 100ms for faster response
        [isMobile]
    );

    const fetchCalendarEventsForMobile = useCallback(async () => {
        if (!isMobile) return;
        if (isAuthenticated()) {
            try {
                const fetchedEvents = await getCalendarEvents();
                let mappedEvents = fetchedEvents.map(event => ({
                    id: event.id,
                    title: event.title,
                    startTime: event.start_time,
                    endTime: event.end_time,
                    day_of_week: event.day_of_week,
                    start_date: event.start_date,
                    end_date: event.end_date,
                    description: event.description,
                    professor: event.professor,
                    recurrence_pattern: event.recurrence_pattern,
                    reference_date: event.reference_date,
                    theme: event.theme
                }));

                // MOBILE ONLY: Filter events by selected term's date range
                if (isMobile) {
                    const getTermDateRange = (term: string): { start: string, end: string } => {
                        const termMap: { [key: string]: { start: string, end: string } } = {
                            "2025 Fall Term": { start: "2025-09-03", end: "2025-12-02" },
                            "2026 Winter Term": { start: "2026-01-12", end: "2026-04-15" },
                            "2025 Spring/Summer Term": { start: "2025-05-05", end: "2025-07-25" }
                        };
                        return termMap[term] || { start: "2025-09-03", end: "2025-12-02" };
                    };

                    const termRange = getTermDateRange(selectedTerm);
                    const originalCount = mappedEvents.length;

                    mappedEvents = mappedEvents.filter(event => {
                        // If event has date range, check if it overlaps with selected term
                        if (event.start_date && event.end_date) {
                            return event.start_date <= termRange.end && event.end_date >= termRange.start;
                        }
                        // For events without date range, keep them (they might be manually created)
                        return true;
                    });


                }

                setCalendarEvents(mappedEvents);

                // Sync the UI state (checkboxes and course list) with the fetched events
                const newSelectedSectionEvents = new Map<string, number[]>();
                const addedCourseCodes = new Set<string>();

                mappedEvents.forEach(event => {
                    if (!event.id || !event.description) return;

                    const courseCodeMatch = event.title.match(/([A-Z]{3}\s*\d{4})/);
                    const sectionMatch = event.description.match(/Section: ([\w-]+)/);

                    if (courseCodeMatch && sectionMatch) {
                        const courseCode = courseCodeMatch[0].replace(/\s+/g, ' ');
                        const sectionIdentifier = sectionMatch[1];
                        const sectionKey = `${courseCode}-${sectionIdentifier}`;

                        // Add event ID to the map for the corresponding section
                        if (!newSelectedSectionEvents.has(sectionKey)) {
                            newSelectedSectionEvents.set(sectionKey, []);
                        }
                        newSelectedSectionEvents.get(sectionKey)?.push(event.id);

                        // Track unique course codes to display in the "added courses" list
                        addedCourseCodes.add(courseCode);
                    }
                });

                setSelectedSectionEvents(newSelectedSectionEvents);

                const newAddedCourses = localCourses.filter(course =>
                    addedCourseCodes.has(course.courseCode.replace(/\s+/g, ' '))
                );
                setAddedCourses(newAddedCourses);

            } catch (error) {
                console.error("❌ Failed to fetch events for mobile calendar", error);
                setCalendarEvents([]);
            }
        } else {
            setCalendarEvents([]);
        }
    }, [isMobile, selectedTerm, selectedSectionEventsByTerm, localCourses]);

    // Unified EVENT_THEMES imported from config for mobile as well
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _importedThemesMobile = EVENT_THEMES;

    const courseColors = Object.keys(EVENT_THEMES);
    const courseColorMap = useRef(new Map<string, string>());
    const colorIndex = useRef(0);

    const shuffledColors = useMemo(() => {
        const colors = Object.keys(EVENT_THEMES);
        // Fisher-Yates (aka Knuth) Shuffle for randomization
        for (let i = colors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [colors[i], colors[j]] = [colors[j], colors[i]];
        }
        return colors;
    }, []); // Empty dependency array ensures this runs only once

    const getCourseColor = (courseCode: string): string => {
        if (!courseColorMap.current.has(courseCode)) {
            // Assign a color from the shuffled list
            const color = shuffledColors[colorIndex.current % shuffledColors.length];
            courseColorMap.current.set(courseCode, color);
            colorIndex.current++;
        }
        return courseColorMap.current.get(courseCode)!;
    };

    const dayShorthandMap: { [key: string]: string } = { 'Mo': 'Mon', 'Tu': 'Tue', 'We': 'Wed', 'Th': 'Thu', 'Fr': 'Fri', 'Sa': 'Sat' };
    const dayToIndex = (day: string) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day);
    const timeToPosition = (time: string) => {
        if (!time) return 0;
        const [hours, minutes] = time.split(':').map(Number);
        const minutesFrom8AM = (hours - 8) * 60 + minutes;
        return (minutesFrom8AM / 60) * 48;
    };

    const formatTime12Hour = (timeString: string) => {
        if (!timeString) return '';
        const [hour, minute] = timeString.split(':');
        const hourNum = parseInt(hour, 10);
        const ampm = hourNum >= 12 ? 'PM' : 'AM';
        const formattedHour = hourNum % 12 || 12;
        return `${formattedHour}:${minute} ${ampm}`;
    };

    const getSectionType = (sectionCode: string) => {
        if (!sectionCode) return '';
        const parts = sectionCode.split('-');
        if (parts.length > 1) {
            const type = parts.pop()?.toUpperCase();
            if (type === 'LEC') return 'Lecture';
            if (type === 'TUT') return 'Tutorial';
            if (type === 'LAB') return 'Lab';
            return type;
        }
        return sectionCode;
    };

    // Build lightweight temp events for instant UI feedback (no network)
    const buildTempEventsFromSection = useCallback((section: any, tempKey: string) => {
        const parseAllTimeSlots = (timeStr: string) => {
            const timeSlots = (timeStr || '').split(',').map((slot: string) => slot.trim());
            const parsedSlots: Array<{ day: string; startTime: string; endTime: string }> = [];
            for (const slot of timeSlots) {
                const timeMatch = slot.match(/(\w+)\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
                if (timeMatch) parsedSlots.push({ day: timeMatch[1], startTime: timeMatch[2], endTime: timeMatch[3] });
            }
            return parsedSlots;
        };

        const dayMap: { [key: string]: string } = { Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday' };
        const courseCodeRaw = section.courseCode || section.code;
        const formattedCourseCode = courseCodeRaw.replace(/([A-Z]{3})(\d{4})/, '$1 $2');
        const sectionType = section.type || (section.code ? section.code.split('-')[1] : 'UNKNOWN');
        const courseColor = getCourseColor(section.courseCode || section.code);
        const semesterMap: { [key: string]: { start: string; end: string } } = {
            '2025 Fall Term': { start: '2025-09-03', end: '2025-12-03' },
            '2026 Winter Term': { start: '2026-01-12', end: '2026-04-15' },
            '2025 Spring/Summer Term': { start: '2025-05-06', end: '2025-08-15' },
        };
        const courseDates = {
            start: section.meetingStartDate || semesterMap[selectedTerm]?.start || '2025-09-03',
            end: section.meetingEndDate || semesterMap[selectedTerm]?.end || '2025-12-03',
        };
        const slots = parseAllTimeSlots(section.time || '');

        return slots.map((slot) => ({
            title: `${formattedCourseCode} (${sectionType}) - ${section.instructor || ''}`,
            startTime: slot.startTime,
            endTime: slot.endTime,
            day_of_week: dayMap[slot.day],
            start_date: courseDates.start,
            end_date: courseDates.end,
            description: `Course: ${formattedCourseCode}\nTitle: ${section.courseTitle || ''}\nSection: ${section.code}\nType: ${sectionType}\nInstructor: ${section.instructor || ''}\nTime: ${slot.day} ${slot.startTime} - ${slot.endTime}\nLocation: TBD`,
            recurrence_pattern: 'weekly' as const,
            theme: courseColor,
            tempKey,
        }));
    }, []);

    // Function to get start date for a term
    const getTermStartDate = (term: string): string => {
        const termMap: { [key: string]: string } = {
            "2025 Fall Term": "2025-09-03",
            "2026 Winter Term": "2026-01-12",
            "2025 Spring/Summer Term": "2025-05-06"
        };
        return termMap[term] || "2025-09-03"; // Default to Fall 2025
    };

    // Effect to handle term changes and update calendar
    useEffect(() => {
        if (!isComponentMounted) return; // Don't trigger on initial mount

        // Debounce term changes to prevent rapid updates
        const timeoutId = setTimeout(() => {
            // Switch to the selected term's courses
            const termSelections = selectedSectionEventsByTerm.get(selectedTerm) || new Map();
            setSelectedSectionEvents(termSelections);

            // Update mobile calendar events if on mobile (with additional delay)
            if (isMobile && coursesLoaded) {
                setTimeout(() => {
                    fetchCalendarEventsForMobile();
                }, 300);
            }

            // Only dispatch navigation event if this was a manual term change
            if (isManualTermChange) {
                const newDate = getTermStartDate(selectedTerm);
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('navigateCalendar', {
                        detail: { date: newDate }
                    }));
                }, 150);
                setIsManualTermChange(false); // Reset the flag
            }
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [selectedTerm, isComponentMounted, isManualTermChange]);

    // Mobile detection effect
    useEffect(() => {
        const isMob = isDeviceMobile();
        setIsMobile(isMob);

        if (isMob) {
            fetchCalendarEventsForMobile();
        }

        // Handle window resize for mobile detection
        const handleResize = () => {
            const isMob = isDeviceMobile();
            setIsMobile(isMob);
            if (isMob) {
                fetchCalendarEventsForMobile();
            }
        };
        window.addEventListener('resize', handleResize);

        // Cleanup function to remove event listener
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // Component mount effect
    useEffect(() => {
        setIsComponentMounted(true);

        // Show welcome modal for unauthenticated users every time
        if (!isAuthenticated()) {
            setTimeout(() => setShowWelcomeModal(true), 500);
        }
    }, []);

    // Calendar navigation effect - only on mount, not on selectedTerm changes
    useEffect(() => {
        // Trigger initial calendar navigation only once on mount
        const initialDate = getTermStartDate(selectedTerm);

        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('navigateCalendar', {
                detail: { date: initialDate }
            }));
        }, 200);
    }, []); // Removed selectedTerm dependency to prevent jumping on course changes

    // Load course data on component mount and when term changes
    useEffect(() => {
        const loadCourses = async () => {
            try {
                setIsLoadingCourses(true);
                setCoursesLoaded(false);
                const courseData = await loadCoursesForTerm(selectedTerm);
                setLocalCourses(courseData);
                setCourses(courseData); // Also set global courses for backward compatibility

                // Update cache status
                setCacheStatus(getCacheStatus());

                // Clear added courses when switching terms to avoid conflicts
                setAddedCourses([]);
            } catch (error) {
                console.error(`❌ Failed to load courses for ${selectedTerm}:`, error);
            } finally {
                setIsLoadingCourses(false);
                setCoursesLoaded(true);
            }
        };

        loadCourses();
    }, [selectedTerm]);

    useEffect(() => {
        if (isMobile && coursesLoaded) {
            fetchCalendarEventsForMobile();
        }
    }, [isMobile, coursesLoaded]);

    // Initialize auto-refresh on component mount
    useEffect(() => {
        startAutoRefresh();

        // Update cache status initially
        setCacheStatus(getCacheStatus());

        // Set up periodic cache status updates
        const statusInterval = setInterval(() => {
            setCacheStatus(getCacheStatus());
        }, 5 * 60 * 1000); // Update every 5 minutes

        return () => {
            clearInterval(statusInterval);
        };
    }, []);

    // Add event listener for mobile calendar to respond to forceRemoveEvents
    useEffect(() => {
        const handleMobileForceRemoveEvents = (event: any) => {
            if (!isMobile) return;
            
            const { eventIds } = event.detail;
            if (!eventIds || eventIds.length === 0) return;

            // Immediately remove events from mobile calendar state with improved filtering
            setCalendarEvents(prev => {
                const beforeCount = prev.length;
                const filteredEvents = prev.filter(e => e.id && !eventIds.includes(e.id));
                const afterCount = filteredEvents.length;
                
                // Only log if events were actually removed for debugging
                if (beforeCount !== afterCount) {
                    console.log(`📱 Mobile: Removed ${beforeCount - afterCount} events from calendar`);
                }
                
                return filteredEvents;
            });
        };

        // Listen for force remove events
        window.addEventListener('forceRemoveEvents', handleMobileForceRemoveEvents);

        return () => {
            window.removeEventListener('forceRemoveEvents', handleMobileForceRemoveEvents);
        };
    }, [isMobile]);



    // Helper function to check if a course belongs to the selected term based on meeting dates
    const isWithinSelectedTerm = (course: CourseGrouped): boolean => {
        return !isMobile || true; // Desktop: show all, Mobile: show all (term filtering handled by course loading)
    };

    // ENHANCED search filter - real-time filtering with comprehensive search
    const filteredCourses = useMemo(() => {
        if (!searchQuery.trim()) return [];

        const query = searchQuery.toLowerCase().trim();
        const queryNoSpaces = query.replace(/\s+/g, '');

        // Pre-filter for performance - only check courses that might match
        const results = localCourses.filter((course: CourseGrouped) => {
            const code = course.courseCode.toLowerCase();
            const codeNoSpaces = code.replace(/\s+/g, '');

            // Quick code check first (most common search)
            if (codeNoSpaces.includes(queryNoSpaces) || code.includes(query)) return true;

            // Title check
            if (course.courseTitle.toLowerCase().includes(query)) return true;

            // Faculty check (more expensive, do last)
            return Object.values(course.sectionGroups).some((sectionGroup: any) => {
                return sectionGroup.lecture?.instructor?.toLowerCase().includes(query) ||
                    sectionGroup.labs?.some((lab: any) => lab.instructor?.toLowerCase().includes(query)) ||
                    sectionGroup.tutorials?.some((tut: any) => tut.instructor?.toLowerCase().includes(query));
            });
        });

        // Sort by relevance - exact matches first
        results.sort((a, b) => {
            const aCode = a.courseCode.toLowerCase().replace(/\s+/g, '');
            const bCode = b.courseCode.toLowerCase().replace(/\s+/g, '');

            // Exact matches first
            if (aCode === queryNoSpaces && bCode !== queryNoSpaces) return -1;
            if (bCode === queryNoSpaces && aCode !== queryNoSpaces) return 1;

            // Starts with query
            if (aCode.startsWith(queryNoSpaces) && !bCode.startsWith(queryNoSpaces)) return -1;
            if (bCode.startsWith(queryNoSpaces) && !aCode.startsWith(queryNoSpaces)) return 1;

            return aCode.localeCompare(bCode);
        });

        // Limit results for mobile
        return isMobile ? results.slice(0, 5) : results;
    }, [searchQuery, localCourses, isMobile]);

    const handleAddCourse = useCallback((course: Course) => {
        const courseId = isCourseGrouped(course) ? course.courseCode : (course as CourseLegacy).id;
        if (!addedCourses.find(c => (isCourseGrouped(c) ? c.courseCode : (c as CourseLegacy).id) === courseId)) {
            setAddedCourses(prev => [...prev, course]);
        }
    }, [addedCourses]);

    const handleRemoveCourse = useCallback((courseId: string) => {
        setAddedCourses(prev => prev.filter(course => (isCourseGrouped(course) ? course.courseCode : (course as CourseLegacy).id) !== courseId));
    }, []);

    const handleResetCourses = useCallback(async () => {


        // Clear all calendar events first
        const allEventIds: number[] = [];
        selectedSectionEvents.forEach((eventIds) => {
            allEventIds.push(...eventIds);
        });

        if (allEventIds.length > 0) {

            // IMMEDIATELY remove events from calendar state for instant visual feedback
            window.dispatchEvent(new CustomEvent('forceRemoveEvents', {
                detail: { eventIds: allEventIds, resetFlag: true }
            }));

            // Delete all events from the server
            for (const eventId of allEventIds) {
                try {
                    await deleteCalendarEvent(eventId);

                    // Emit deletion event for each successful deletion
                    window.dispatchEvent(new CustomEvent('calendarEventDeleted', {
                        detail: { eventId }
                    }));
                } catch (error) {
                    console.error(`❌ Failed to delete event ID ${eventId}:`, error);
                }
            }
        } else {
            // Even if no events to delete, we still need to reset the flag
            window.dispatchEvent(new CustomEvent('forceRemoveEvents', {
                detail: { eventIds: [], resetFlag: true }
            }));
        }

        // Clear state based on device type
        if (isMobile) {
            // Mobile: only clear current term
            setSelectedSectionEvents(new Map());
            const updatedByTerm = new Map(selectedSectionEventsByTerm);
            updatedByTerm.set(selectedTerm, new Map());
            setSelectedSectionEventsByTerm(updatedByTerm);
        } else {
            // Desktop: clear all terms
            setSelectedSectionEvents(new Map());
            setSelectedSectionEventsByTerm(new Map());
        }

        setAddedCourses([]);
        setSearchQuery(''); // Clear search when resetting

        // IMPORTANT: Reset the manually removed flag so calendar can refresh properly

        // Dispatch visual feedback event for RESET ALL
        if (allEventIds.length > 0) {
            window.dispatchEvent(new CustomEvent('kairollDeletion', {
                detail: { action: 'RESET_ALL', type: 'all', count: allEventIds.length }
            }));
        }

        // Force a refresh key increment to trigger calendar remount and reset
        window.dispatchEvent(new CustomEvent('forceCalendarRefresh'));

        fetchCalendarEventsForMobile();
    }, [isMobile, selectedSectionEvents, selectedSectionEventsByTerm, selectedTerm, fetchCalendarEventsForMobile]);

    // Function to create calendar events from course section (handles multiple time slots)
    const createCalendarEventFromSection = useCallback(async (section: any, tempKey?: string): Promise<{ eventIds: number[]; createdEvents: any[] }> => {
        try {
            const eventIds: number[] = [];
            const createdEventsForUi: any[] = [];
            const courseCode = section.courseCode;
            const courseColor = getCourseColor(courseCode); // Get the course color

            const parseAllTimeSlots = (timeStr: string) => {
                // Handle formats like "Tu 13:00 - 14:20, Th 11:30 - 12:50" or "Mo 10:00 - 11:20"
                const timeSlots = timeStr.split(',').map(slot => slot.trim());
                const parsedSlots = [];

                for (const slot of timeSlots) {
                    const timeMatch = slot.match(/(\w+)\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
                    if (timeMatch) {
                        parsedSlots.push({
                            day: timeMatch[1],
                            startTime: timeMatch[2],
                            endTime: timeMatch[3]
                        });
                    }
                }
                return parsedSlots;
            };

            const timeSlots = parseAllTimeSlots(section.time);
            if (timeSlots.length === 0) {
                console.error('Could not parse any time slots from:', section.time);
                return { eventIds: [], createdEvents: [] };
            }


            // Map day abbreviations to full day names
            const dayMap: { [key: string]: string } = {
                'Mo': 'Monday',
                'Tu': 'Tuesday',
                'We': 'Wednesday',
                'Th': 'Thursday',
                'Fr': 'Friday',
                'Sa': 'Saturday',
                'Su': 'Sunday'
            };

            // Use actual course meeting dates if available, otherwise fall back to semester dates
            const getSemesterDates = (term: string) => {
                const semesterMap: { [key: string]: { start: string, end: string } } = {
                    "2025 Fall Term": { start: "2025-09-03", end: "2025-12-03" },
                    "2026 Winter Term": { start: "2026-01-12", end: "2026-04-15" },
                    "2025 Spring/Summer Term": { start: "2025-05-06", end: "2025-08-15" }
                };
                return semesterMap[term] || { start: "2025-09-03", end: "2025-12-03" };
            };

            // Use course-specific meeting dates if available, otherwise use semester dates
            const semesterFallback = getSemesterDates(selectedTerm);
            const courseDates = {
                start: section.meetingStartDate || semesterFallback.start,
                end: section.meetingEndDate || semesterFallback.end
            };

            // Load existing events to prevent conflicts
            let existingEvents: any[] = [];
            try {
                existingEvents = await persistentCalendarService.loadUserCalendar();
                if (!hasEventsToExport(existingEvents)) {
                    const apiEvents = await getCalendarEvents();
                    existingEvents = apiEvents.map(e => ({
                        title: e.title,
                        startTime: e.start_time,
                        endTime: e.end_time,
                        day_of_week: e.day_of_week,
                        start_date: e.start_date,
                        end_date: e.end_date,
                        description: e.description,
                        theme: e.theme
                    }));
                }
            } catch {}

            const timesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
                const toMin = (t: string) => {
                    const [h, m] = t.split(':').map(Number);
                    return h * 60 + m;
                };
                const aS = toMin(aStart), aE = toMin(aEnd), bS = toMin(bStart), bE = toMin(bEnd);
                return !(aE <= bS || aS >= bE);
            };

            // Build payloads first and run creation concurrently for snappier UX
            const payloads = timeSlots.map((timeSlot) => {
                const dayOfWeek = dayMap[timeSlot.day];
                if (!dayOfWeek) return null;
                const codeForDisplay = (section.courseCode || section.code).replace(/([A-Z]{3})(\d{4})/, '$1 $2');
                const sectionType = section.type || (section.code ? section.code.split('-')[1] : 'UNKNOWN');
                return {
                    dayOfWeek,
                    rawDay: timeSlot.day,
                    eventData: {
                        title: `${codeForDisplay} (${sectionType}) - ${section.instructor}`,
                        start_time: timeSlot.startTime,
                        end_time: timeSlot.endTime,
                        day_of_week: dayOfWeek,
                        start_date: courseDates.start,
                        end_date: courseDates.end,
                        recurrence_pattern: 'weekly' as const,
                        description: `Course: ${codeForDisplay}\nTitle: ${section.courseTitle || ''}\nSection: ${section.code}\nType: ${sectionType}\nInstructor: ${section.instructor}\nTime: ${timeSlot.day} ${timeSlot.startTime} - ${timeSlot.endTime}\nLocation: TBD`,
                        theme: courseColor,
                    }
                };
            }).filter(Boolean) as Array<{ dayOfWeek: string; rawDay: string; eventData: any }>;

            // Conflict check once for all slots; if any conflict, abort quickly
            const hasAnyConflict = payloads.some(({ dayOfWeek, eventData }) => {
                return existingEvents.some(ev => {
                    if (ev.day_of_week && ev.day_of_week !== dayOfWeek) return false;
                    if (ev.start_date && ev.end_date) {
                        const eStart = Date.parse(ev.start_date);
                        const eEnd = Date.parse(ev.end_date);
                        const cStart = Date.parse(eventData.start_date);
                        const cEnd = Date.parse(eventData.end_date);
                        const overlapsDates = !(eEnd < cStart || cEnd < eStart);
                        if (!overlapsDates) return false;
                    }
                    return timesOverlap(ev.startTime, ev.endTime, eventData.start_time, eventData.end_time);
                });
            });
            if (hasAnyConflict) {
                alert('Selected section time conflicts with your current schedule. Please pick a different section in Kairoll.');
                return { eventIds: [], createdEvents: [] };
            }

            const results = await Promise.allSettled(payloads.map(p => createCalendarEvent(p.eventData)));
            for (let i = 0; i < results.length; i++) {
                const res = results[i];
                const pl = payloads[i];
                if (res.status === 'fulfilled' && res.value?.id) {
                    eventIds.push(res.value.id);
                    // Build UI-friendly event to replace temp immediately
                    createdEventsForUi.push({
                        id: res.value.id,
                        title: pl.eventData.title,
                        startTime: pl.eventData.start_time,
                        endTime: pl.eventData.end_time,
                        day_of_week: pl.eventData.day_of_week,
                        start_date: pl.eventData.start_date,
                        end_date: pl.eventData.end_date,
                        description: pl.eventData.description,
                        professor: pl.eventData.professor,
                        recurrence_pattern: pl.eventData.recurrence_pattern,
                        reference_date: pl.eventData.reference_date,
                        theme: pl.eventData.theme,
                    });
                }
            }

            return { eventIds, createdEvents: createdEventsForUi };
        } catch (error) {
            console.error('❌ Error creating calendar events:', error);
            return { eventIds: [], createdEvents: [] };
        }
    }, [selectedTerm]);

    // Function to handle section toggle (add/remove from calendar)
    const handleSectionToggle = useCallback(async (section: any, isSelected: boolean) => {
        // Use unique key if available, otherwise fall back to section.code for backwards compatibility
        const sectionKey = section.uniqueKey || section.code;

        if (isSelected) {
            // If this section is already pending creation, ignore duplicate toggles
            if (pendingAdditions.has(sectionKey)) {
                return;
            }
            
            // If already selected, ignore duplicate requests
            if (selectedSectionEvents.has(sectionKey)) {
                return;
            }
            // Optimistic: add temporary events immediately
            const tempKey = `temp-${sectionKey}-${Date.now()}`;
            const tempEvents = buildTempEventsFromSection(section, tempKey);
            if (tempEvents.length > 0) {
                window.dispatchEvent(new CustomEvent('forceAddEvents', { detail: { events: tempEvents } }));
                // mark checkbox as pending-add so UI stays in-sync immediately
                setPendingAdditions(prev => {
                    const next = new Map(prev);
                    next.set(sectionKey, tempKey);
                    return next;
                });
                // Batch state updates for better performance
                React.startTransition(() => {
                    setSelectedSectionEvents(prev => new Map(prev).set(sectionKey, []));
                    const updatedByTerm = new Map(selectedSectionEventsByTerm);
                    const currentTermMap = updatedByTerm.get(selectedTerm) || new Map();
                    currentTermMap.set(sectionKey, []);
                    updatedByTerm.set(selectedTerm, currentTermMap);
                    setSelectedSectionEventsByTerm(updatedByTerm);
                });
            }

            // Proceed with creating real events (bulk) and replace temp when done
            const { eventIds, createdEvents } = await createCalendarEventFromSection(section, tempKey);
            if (eventIds.length > 0) {
                // Replace temp events with real ones (avoid flicker)
                window.dispatchEvent(new CustomEvent('replaceTempEvents', { detail: { tempKey, createdEvents } }));
                // Batch state updates for better performance
                React.startTransition(() => {
                    setSelectedSectionEvents(prev => new Map(prev).set(sectionKey, eventIds));
                    const updatedByTerm = new Map(selectedSectionEventsByTerm);
                    const currentTermMap = updatedByTerm.get(selectedTerm) || new Map();
                    currentTermMap.set(sectionKey, eventIds);
                    updatedByTerm.set(selectedTerm, currentTermMap);
                    setSelectedSectionEventsByTerm(updatedByTerm);
                    setPendingAdditions(prev => { const next = new Map(prev); next.delete(sectionKey); return next; });
                });
                // Optimized refresh: only refresh desktop calendar, mobile will update via state
                if (!isMobile) {
                    window.dispatchEvent(new CustomEvent('refreshCalendar'));
                }
                // Debounced mobile refresh to avoid excessive API calls
                if (isMobile) {
                    fetchCalendarEventsForMobileDebounced();
                }
            } else {
                // Rollback: remove temp UI and pending flag, and unselect the checkbox
                window.dispatchEvent(new CustomEvent('replaceTempEvents', { detail: { tempKey, createdEvents: [] } }));
                setPendingAdditions(prev => { const next = new Map(prev); next.delete(sectionKey); return next; });
                setSelectedSectionEvents(prev => { const next = new Map(prev); next.delete(sectionKey); return next; });
                const updatedByTerm = new Map(selectedSectionEventsByTerm);
                const currentTermMap = updatedByTerm.get(selectedTerm) || new Map();
                currentTermMap.delete(sectionKey);
                updatedByTerm.set(selectedTerm, currentTermMap);
                setSelectedSectionEventsByTerm(updatedByTerm);
            }
        } else {
            // Remove from calendar
            const eventIds = selectedSectionEvents.get(sectionKey);
            const pendingKey = pendingAdditions.get(sectionKey);
            
            // If neither selected nor pending, ignore the request
            if (!eventIds && !pendingKey) {
                return;
            }

            if (eventIds && eventIds.length > 0) {
                // STEP 1: INSTANT UI updates - do these first for immediate feedback
                // Update state immediately for instant visual feedback
                setSelectedSectionEvents(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(sectionKey);
                    return newMap;
                });

                // Update per-term storage immediately
                const updatedByTerm = new Map(selectedSectionEventsByTerm);
                const currentTermMap = updatedByTerm.get(selectedTerm) || new Map();
                currentTermMap.delete(sectionKey);
                updatedByTerm.set(selectedTerm, currentTermMap);
                setSelectedSectionEventsByTerm(updatedByTerm);

                // STEP 2: INSTANT visual feedback - remove from calendar immediately
                window.dispatchEvent(new CustomEvent('forceRemoveEvents', {
                    detail: { eventIds }
                }));

                // MOBILE SPECIFIC: Force immediate mobile calendar update and clear pending state
                if (isMobile) {
                    setCalendarEvents(prev => {
                        const filteredEvents = prev.filter(e => e.id && !eventIds.includes(e.id));
                        return filteredEvents;
                    });
                    
                    // Clear pending state immediately for better mobile responsiveness
                    setPendingAdditions(prev => {
                        const next = new Map(prev);
                        next.delete(sectionKey);
                        return next;
                    });
                }

                // STEP 3: Background deletion - don't await this, let it happen async
                const performBackgroundDeletion = async () => {
                    const successfulDeletions: number[] = [];
                    const failedDeletions: number[] = [];

                    // Delete all events in parallel (faster than sequential) with retry logic
                    await Promise.all(eventIds.map(async (eventId) => {
                        let attempts = 0;
                        const maxAttempts = 2; // Try twice for mobile reliability
                        
                        while (attempts < maxAttempts) {
                            try {
                                await deleteCalendarEvent(eventId);
                                successfulDeletions.push(eventId);
                                break; // Success, exit retry loop
                            } catch (error) {
                                attempts++;
                                if (attempts >= maxAttempts) {
                                    console.error(`❌ Failed to delete event ID ${eventId} after ${maxAttempts} attempts:`, error);
                                    failedDeletions.push(eventId);
                                } else {
                                    // Brief delay before retry
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                }
                            }
                        }
                    }));

                    // Handle failed deletions for mobile
                    if (failedDeletions.length > 0) {
                        console.warn(`⚠️ ${failedDeletions.length} event(s) failed to delete: ${failedDeletions.join(', ')}`);
                        
                        // On mobile, if some events failed to delete, restore them to the UI
                        if (isMobile && failedDeletions.length > 0) {
                            // We need to restore the failed events back to the calendar
                            // But only do this after a delay to avoid conflicts
                            setTimeout(() => {
                                fetchCalendarEventsForMobileDebounced();
                            }, 500);
                        }
                    }
                };

                // Fire the background deletion immediately but don't await it
                performBackgroundDeletion().then(() => {
                    // Only refresh mobile calendar after successful deletion to avoid conflicts
                    if (isMobile) {
                        // Delay the refresh slightly to allow instant UI updates to settle
                        setTimeout(() => {
                            fetchCalendarEventsForMobileDebounced();
                        }, 200);
                    }
                });
            }
            // Also handle the case where user unchecks quickly before creation finishes
            const pendingTempKey = pendingAdditions.get(sectionKey);
            if (pendingTempKey) {
                // remove any temp events associated with this section
                window.dispatchEvent(new CustomEvent('replaceTempEvents', { detail: { tempKey: pendingTempKey, createdEvents: [] } }));
                setPendingAdditions(prev => { const next = new Map(prev); next.delete(sectionKey); return next; });
                setSelectedSectionEvents(prev => { const next = new Map(prev); next.delete(sectionKey); return next; });
                const updatedByTerm = new Map(selectedSectionEventsByTerm);
                const currentTermMap = updatedByTerm.get(selectedTerm) || new Map();
                currentTermMap.delete(sectionKey);
                updatedByTerm.set(selectedTerm, currentTermMap);
                setSelectedSectionEventsByTerm(updatedByTerm);
                window.dispatchEvent(new CustomEvent('refreshCalendar'));
            }
        }
    }, [selectedSectionEvents, selectedSectionEventsByTerm, selectedTerm, createCalendarEventFromSection, fetchCalendarEventsForMobile]);

    // Add a manual refresh handler
    const handleManualRefresh = async () => {
        await refreshAllCourseData();
        setCacheStatus(getCacheStatus());
    };

    return (
        <div className="font-mono bg-white dark:bg-[rgb(var(--secondary-bg))] text-black dark:text-[rgb(var(--text-primary))] flex flex-col h-full transition-colors duration-300">
            {/* Header */}
            <div className={`p-4 sm:p-5 lg:p-6 border-b border-gray-200 dark:border-[rgb(var(--border-color))] transition-colors duration-300 ${isDeviceMobile() ? 'overflow-hidden' : ''}`}>
                <h1 className="text-base sm:text-lg lg:text-xl font-bold text-black dark:text-[rgb(var(--text-primary))] mb-3 sm:mb-4 transition-colors duration-300">Course Enrollment</h1>

                {/* Stats Marquee removed on chat page per request */}

                {/* Term Selector */}
                <div className="mb-3 sm:mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Academic Term
                    </label>
                    <select
                        value={selectedTerm}
                        onChange={(e) => {
                            setIsManualTermChange(true); // Mark this as a manual term change
                            setSelectedTerm(e.target.value);
                        }}
                        className="w-full bg-gray-100 dark:bg-[rgb(var(--card-bg))] border border-gray-200 dark:border-[rgb(var(--border-color))] rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-black dark:text-[rgb(var(--text-primary))] focus:ring-2 focus:ring-[rgb(var(--accent-color))] focus:border-[rgb(var(--accent-color))] appearance-none transition-colors duration-300"
                    >
                        {terms.map(term => (
                            <option key={term} value={term} className="bg-white dark:bg-gray-800 text-black dark:text-white">{term}</option>
                        ))}
                    </select>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <div className="sm:hidden">
                            📅 {getTermStartDate(selectedTerm)}
                        </div>
                        <div className="hidden sm:block">
                            Calendar will navigate to: {getTermStartDate(selectedTerm)}
                            {cacheStatus[selectedTerm] && (
                                <span className="ml-2">
                                    | {cacheStatus[selectedTerm].courseCount} courses available
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="mb-4 sm:mb-6">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search for courses, professors, and course codes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 rounded-lg px-3 sm:px-4 py-2 sm:py-3 pr-10 text-sm sm:text-base text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-300"
                        />
                        {/* Clear Search Button */}
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                                title="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Search Result Count */}
                    {searchQuery && (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {isLoadingCourses ? (
                                'Searching...'
                            ) : (
                                <>
                                    {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} found
                                    {isMobile && filteredCourses.length > 5 && (
                                        <span className="text-orange-500 dark:text-orange-400 ml-2">
                                            (showing first 5 on mobile)
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    )}


                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                        onClick={() => setSearchQuery('')}
                        disabled={!searchQuery}
                        className="flex-1 bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/[0.12] border border-gray-200 dark:border-white/10 text-black dark:text-white px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Clear Search
                    </button>
                    <button
                        onClick={handleResetCourses}
                        className="flex-1 bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 hover:from-gray-400 hover:via-gray-300 hover:to-gray-400 dark:hover:from-slate-700 dark:hover:via-slate-600 dark:hover:to-slate-700 text-black dark:text-white px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm sm:text-base relative overflow-hidden group border border-gray-400/30 dark:border-slate-600/30"
                    >
                        {/* Simplified effects for mobile */}
                        <div className="absolute inset-0 bg-gradient-to-r from-gray-500/0 via-gray-400/20 to-gray-500/0 dark:from-slate-600/0 dark:via-slate-400/20 dark:to-slate-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        {/* Button content */}
                        <div className="relative flex items-center gap-2">
                            <span className="font-medium">RESET ALL</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* Course List */}
            <div className={`flex flex-col ${isMobile ? '' : 'flex-1 min-h-0 course-list-container'}`}>
                {/* Course List */}
                <div className={`p-4 sm:p-5 lg:p-6 ${isMobile ? 'border-b border-gray-200 dark:border-white/10 transition-colors duration-300' : ''}`}>
                    <div className="space-y-4">
                        {searchQuery.trim() !== '' && (
                            <>
                                {(isMobile ? filteredCourses.slice(0, 5) : filteredCourses).map((course: CourseGrouped) => (
                                    <CourseCard
                                        key={course.courseCode}
                                        course={course}
                                        onAddCourse={handleAddCourse}
                                        onSectionToggle={handleSectionToggle}
                                        selectedSectionEvents={selectedSectionEvents}
                                        pendingAdditions={pendingAdditions}
                                    />
                                ))}
                                {filteredCourses.length === 0 && !isLoadingCourses && (
                                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                        <div className="mb-2 text-sm sm:text-base">No courses found matching "{searchQuery}"</div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500">
                                            Try searching by course code (e.g., "ITI1120"), title, or instructor name
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        {searchQuery.trim() === '' && (
                            <div className="text-center py-12 flex flex-col items-center justify-center h-full opacity-70">
                                <ClipboardList className="w-8 h-8 sm:w-12 sm:h-12 mb-3 text-gray-300 dark:text-gray-600" strokeWidth={1} />
                                <h3 className="text-base sm:text-lg font-medium text-gray-600 dark:text-gray-300">Plan Your Semester</h3>
                                <p className="mt-2 max-w-sm sm:max-w-md text-sm sm:text-base text-gray-500 dark:text-gray-400">
                                    Search for courses by code, title, or professor to add them to your schedule.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Weekly Schedule */}
                <div className="flex-1 p-4 sm:p-5 lg:p-6">
                    {isMobile && (
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-gray-900 dark:text-gray-400">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M16 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M8 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span className="text-sm sm:text-base">My Schedule</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-1">
                                    {uniqueCourseCount} courses
                                </div>
                                {uniqueCourseCount > 0 && (
                                    <button
                                        onClick={async () => {
                                            try {
                                                // Always load user's current calendar events
                                                let allEvents = await persistentCalendarService.loadUserCalendar();

                                                // Fallback to legacy API if DB export endpoint is empty/unavailable
                                                if (!hasEventsToExport(allEvents)) {
                                                    try {
                                                        const apiEvents = await getCalendarEvents();
                                                        allEvents = apiEvents.map(e => ({
                                                            id: e.id,
                                                            title: e.title,
                                                            startTime: e.start_time,
                                                            endTime: e.end_time,
                                                            day_of_week: e.day_of_week,
                                                            start_date: e.start_date,
                                                            end_date: e.end_date,
                                                            description: e.description,
                                                            professor: e.professor,
                                                            recurrence_pattern: e.recurrence_pattern,
                                                            reference_date: e.reference_date,
                                                            theme: e.theme
                                                        }));
                                                    } catch {}
                                                }

                                                if (!hasEventsToExport(allEvents)) {
                                                    alert('No events available to export');
                                                    return;
                                                }

                                                // Prefer optimized mobile export; fall back to server-based if needed
                                                try {
                                                    await exportCalendarForMobile(allEvents, 'kairoschedule');
                                                } catch (mobileErr) {
                                                    console.warn('Mobile export failed, falling back to server ICS:', mobileErr);
                                                    await exportCalendarAsICS(allEvents, 'kairoschedule');
                                                }
                                            } catch (error) {
                                                alert(`Failed to export calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                            }
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 active:from-blue-800 active:to-purple-800 rounded-xl transition-all duration-300 text-white text-xs font-medium shadow-lg hover:shadow-xl"
                                        title="Export schedule to your calendar app"
                                    >
                                        <Download className="w-3 h-3" />
                                        <span>Export</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    {isMobile && (
                        <div className="bg-white dark:bg-gradient-to-b dark:from-[#111111] dark:to-[#0f0f0f] rounded-lg border border-gray-200 dark:border-white/5 dark:shadow-[0_0_4px_rgba(255,255,255,0.05)]">
                            {/* Mobile Time Grid Calendar: Outer container for vertical scroll (scrollbar hidden) */}
                            <div className="no-scrollbar">
                                {/* Inner container for horizontal scroll (scrollbar visible) */}
                                <div className="overflow-x-auto">
                                    {/* Day Headers */}
                                    <div className="bg-gray-50 dark:bg-gradient-to-b dark:from-[#1e1e1e] dark:to-[#1a1a1a] border-b border-gray-200 dark:border-white/5">
                                        <div className="flex gap-0 min-w-[600px]">
                                            {/* Time column header */}
                                            <div className="p-2 text-xs font-medium text-gray-500 dark:text-[#aaaaaa] bg-gray-50 dark:bg-[#1e1e1e] border-r border-gray-200 dark:border-white/5 flex-shrink-0" style={{ width: '60px' }}>
                                                Time
                                            </div>
                                            {/* Day headers */}
                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                                <div
                                                    key={day}
                                                    className="p-2 text-sm font-medium text-center text-gray-700 dark:text-[#e0e0e0] bg-gray-50 dark:bg-[#1e1e1e] border-r border-gray-200 dark:border-white/5 last:border-r-0"
                                                    style={{ width: `${(600 - 60) / 6}px` }}
                                                >
                                                    {day}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Time Grid */}
                                    <div className="relative">
                                        {/* Background Grid */}
                                        {Array.from({ length: 15 }, (_, i) => {
                                            const hour = i + 8; // Start from 8 AM
                                            const timeStr = hour > 12 ? `${hour - 12}:00` : `${hour}:00`;
                                            const period = hour >= 12 ? 'PM' : 'AM';

                                            return (
                                                <div key={hour} className="flex border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#121212] min-w-[600px]" style={{ height: '48px' }}>
                                                    {/* Time label */}
                                                    <div
                                                        className="p-1 text-xs text-black dark:text-[#aaaaaa] bg-white dark:bg-[#121212] border-r border-gray-200 dark:border-white/5 flex items-center justify-center flex-shrink-0"
                                                        style={{ width: '60px' }}
                                                    >
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-xs font-medium">{timeStr}</span>
                                                            <span className="text-[10px] text-gray-700 dark:text-gray-500">{period}</span>
                                                        </div>
                                                    </div>
                                                    {/* Day columns */}
                                                    {[0, 1, 2, 3, 4, 5].map((dayIndex) => (
                                                        <div
                                                            key={dayIndex}
                                                            className="flex-1 border-r border-gray-200 dark:border-gray-800 last:border-r-0"
                                                            style={{ width: `${(600 - 60) / 6}px` }}
                                                        />
                                                    ))}
                                                </div>
                                            );
                                        })}

                                        {/* Events would be positioned absolutely here */}
                                        {calendarEvents.map((event, index) => {
                                            if (!event.day_of_week || !event.startTime || !event.endTime) return null;

                                            const top = timeToPosition(event.startTime);
                                            const bottom = timeToPosition(event.endTime);
                                            const height = bottom - top;

                                            const dayShorthand = event.day_of_week.substring(0, 3);
                                            const colIndex = dayToIndex(dayShorthand);
                                            if (colIndex === -1) return null;

                                            const theme = EVENT_THEMES[event.theme as keyof typeof EVENT_THEMES] || EVENT_THEMES['lavender-peach'];
                                            if (!theme) return null; // Defensive check

                                            const timeColWidth = 60;
                                            const dayColWidth = (600 - timeColWidth) / 6;
                                            const left = timeColWidth + colIndex * dayColWidth + 2;

                                            const titleMatch = event.title.match(/([A-Z]{3}\s\d{4})\s\((.*?)\)/);
                                            const courseCode = titleMatch ? titleMatch[1] : event.title.split('(')[0].trim();
                                            const sectionType = titleMatch ? titleMatch[2] : '';
                                            const professor = event.professor || '';

                                            return (
                                                <div
                                                    key={event.id || index}
                                                    className="absolute rounded-md p-1.5 text-white overflow-hidden leading-tight cursor-pointer transition-all duration-200 lg:hover:scale-105 lg:hover:shadow-xl lg:hover:brightness-110"
                                                    style={{
                                                        top: `${top}px`,
                                                        left: `${left}px`,
                                                        height: `${height}px`,
                                                        width: `${dayColWidth - 4}px`,
                                                        backgroundColor: theme.cssGradient,
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                                        border: '1px solid rgba(255,255,255,0.15)',
                                                    }}
                                                    onClick={(e) => handleMobileEventClick(event, e)}
                                                    onTouchEnd={(e) => {
                                                        e.preventDefault();
                                                        handleMobileEventClick(event, e);
                                                    }}
                                                >
                                                    <p className="font-bold text-xs truncate">{courseCode}</p>
                                                    <p className="text-[11px] opacity-90 truncate">{sectionType}</p>
                                                    <p className="text-[10px] opacity-80 truncate">{professor}</p>
                                                    <p className="text-[10px] opacity-80 truncate">{`${formatTime12Hour(event.startTime)} - ${formatTime12Hour(event.endTime)}`}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showEventModal && selectedEvent && (
                <MobileEventInfoModal
                    event={selectedEvent}
                    onClose={handleCloseEventModal}
                    position={popupPosition}
                />
            )}

            {/* Feature Carousel - Mobile Only */}
            {showWelcomeModal && isMobile && (
                <FeatureCarousel
                    isOpen={showWelcomeModal}
                    onClose={handleCloseWelcomeModal}
                    onSignup={() => handleSignupLogin('signup')}
                    onLogin={() => handleSignupLogin('login')}
                    isMobile={isMobile}
                />
            )}
        </div>
    );
}

interface MobileEventInfoModalProps {
    event: DailyCalendarEvent;
    onClose: () => void;
    position: { x: number, y: number };
}

function parseEventDescription(description: string | undefined) {
    if (!description) {
        return { courseTitle: '', section: '', instructor: '' };
    }
    const lines = description.split('\n');
    const courseTitle = lines.find(l => l.startsWith('Title:'))?.replace('Title: ', '') || '';
    const section = lines.find(l => l.startsWith('Section:'))?.replace('Section: ', '') || '';
    const instructor = lines.find(l => l.startsWith('Instructor:'))?.replace('Instructor: ', '') || '';
    return { courseTitle, section, instructor };
}

const MobileEventInfoModal: React.FC<MobileEventInfoModalProps> = ({ event, onClose, position }) => {
    const { courseTitle, section, instructor } = parseEventDescription(event.description);
    const courseCodeMatch = event.title.match(/([A-Z]{3}\s*\d{4})/);
    const courseCode = courseCodeMatch ? courseCodeMatch[0] : '';
    const sectionTypeMatch = event.title.match(/\(([^)]+)\)/);
    const sectionType = sectionTypeMatch ? sectionTypeMatch[1] : 'LEC';

    const formatTime12Hour = (timeString: string) => {
        if (!timeString) return '';
        const [hour, minute] = timeString.split(':');
        const hourNum = parseInt(hour, 10);
        const ampm = hourNum >= 12 ? 'PM' : 'AM';
        const formattedHour = hourNum % 12 || 12;
        return `${formattedHour}:${minute} ${ampm}`;
    };

    return (
        <>
            <div className="fixed inset-0 z-[59] bg-black/10" onClick={onClose} />
            <div
                className="fixed z-[60] bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl shadow-2xl p-4 w-64 border border-gray-200 dark:border-gray-600 animate-in fade-in-0 zoom-in-95 duration-200"
                style={{ left: position.x, top: position.y }}
                onClick={(e) => e.stopPropagation()}
            >
                <button 
                    onClick={onClose} 
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                    <X size={16} />
                </button>
                
                <div className="pr-8">
                    <h3 className="font-bold text-lg mb-2 text-blue-600 dark:text-blue-400">{courseCode}</h3>
                    <h4 className="font-medium text-sm mb-3 text-gray-700 dark:text-gray-300">{courseTitle}</h4>
                    
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium text-green-600 dark:text-green-400">
                                {formatTime12Hour(event.startTime)} - {formatTime12Hour(event.endTime)}
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span>Section {section} ({sectionType})</span>
                        </div>
                        
                        {instructor && (
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span>{instructor}</span>
                            </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{event.day_of_week}</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default function ChatDashboard() {
    // Get initial view from URL parameter or default to calendar
    const getInitialView = (): 'split' | 'calendar' | 'assistant' | 'kairoll' => {
        if (typeof window !== 'undefined') {
            const lastView = localStorage.getItem('lastView');
            if (window.innerWidth <= 768) {
                // On mobile, only allow 'assistant' or 'kairoll'
                if (lastView === 'assistant' || lastView === 'kairoll') {
                    return lastView;
                }
                return 'kairoll'; // Default for mobile
            }
            // For desktop, allow any valid view
            if (lastView && ['split', 'calendar', 'assistant', 'kairoll'].includes(lastView)) {
                return lastView as 'split' | 'calendar' | 'assistant' | 'kairoll';
            }
        }
        return 'split'; // Default for desktop
    };

    useEffect(() => {
        setView(getInitialView());
    }, []);

    const handleSetView = (newView: 'split' | 'calendar' | 'assistant' | 'kairoll') => {
        if (typeof window !== 'undefined') {
            // Prevent mobile users from switching to 'calendar' or 'split'
            if (window.innerWidth <= 768 && (newView === 'calendar' || newView === 'split')) {
                return;
            }
        }
        setView(newView);
        localStorage.setItem('lastView', newView);
    };

    const [mounted, setMounted] = useState(false);
    const [view, setView] = useState<'split' | 'calendar' | 'assistant' | 'kairoll'>('split');
    const [calendarRefreshKey, setCalendarRefreshKey] = useState(0); // Added state for refresh key
    const [showGuestPopup, setShowGuestPopup] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [userLoading, setUserLoading] = useState(true);
    // Removed visible countdown; keep only auto-dismiss timer

    // Calendar stats state
    const [courseCount, setCourseCount] = useState(0);
    const [conflictsCount, setConflictsCount] = useState(0);

    // Persistent calendar state
    const [isCalendarAccessible, setIsCalendarAccessible] = useState(false);
    const [isLoadingFromDatabase, setIsLoadingFromDatabase] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const router = useRouter();

    // Function to get initial date for kairoll view based on current term
    const getKairollInitialDate = (): string => {
        // Default to Fall 2025 for kairoll view
        return "2025-09-03";
    };

    const handleCalendarRefresh = () => setCalendarRefreshKey(prevKey => prevKey + 1); // Added refresh handler

    // Handle calendar stats updates
    const handleStatsChange = (newCourseCount: number, newConflictsCount: number) => {
        setCourseCount(newCourseCount);
        setConflictsCount(newConflictsCount);
    };

    // Fetch user data
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setUser({ id: null, isGuest: true });
                    setUserLoading(false);
                    return;
                }

                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/profile/`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    const userData = await response.json();
                    setUser(userData);
                } else {
                    setUser({ id: null, isGuest: true });
                }
            } catch (error) {
                console.error('Failed to fetch user info:', error);
                setUser({ id: null, isGuest: true });
            } finally {
                setUserLoading(false);
            }
        };

        fetchUserData();
        // Listen for profile updates (e.g., username change) to refresh header immediately
        const handleProfileUpdated = (e: Event) => {
            const custom = e as CustomEvent<any>;
            if (custom.detail) {
                setUser((prev: any) => ({ ...(prev || {}), ...custom.detail }));
            } else {
                // Fallback: refetch profile
                fetchUserData();
            }
        };
        window.addEventListener('userProfileUpdated', handleProfileUpdated as EventListener);
        return () => {
            window.removeEventListener('userProfileUpdated', handleProfileUpdated as EventListener);
        };
    }, []);

    // Check calendar accessibility on mount
    useEffect(() => {
        setMounted(true);
        // Set initial view from URL after mount
        setView(getInitialView());

        const checkCalendarAccess = async () => {
            try {
                const accessible = await persistentCalendarService.isCalendarAccessible();
                setIsCalendarAccessible(accessible);
            } catch (error) {
                console.error('❌ Error checking calendar accessibility:', error);
                setIsCalendarAccessible(false);
            }
        };

        checkCalendarAccess();
    }, []);

    // Show guest popup when user arrives on split view, but only once every 2 days
    useEffect(() => {
        if (view === 'split' && mounted && !isAuthenticated()) {
            // Check when the popup was last shown
            const lastShownKey = 'guestPopupLastShown';
            const lastShown = localStorage.getItem(lastShownKey);
            const now = Date.now();
            const twoDaysInMs = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
            
            if (!lastShown || (now - parseInt(lastShown)) > twoDaysInMs) {
                setShowGuestPopup(true);
                localStorage.setItem(lastShownKey, now.toString());
                const timer = setTimeout(() => setShowGuestPopup(false), 5000);
                return () => clearTimeout(timer);
            }
        }
    }, [view, mounted]);

    useEffect(() => {
        // Check URL for kairoll view directly to avoid race condition
        const urlParams = new URLSearchParams(window.location.search);
        const viewParam = urlParams.get('view');

        // Check if user is authenticated, redirect to login if not (except for kairoll view)
        if (!isAuthenticated() && viewParam !== 'kairoll') {
            router.push('/login');
        }

        // Listen for force calendar refresh events
        const handleForceCalendarRefresh = () => {
            setCalendarRefreshKey(prevKey => prevKey + 1);
        };

        window.addEventListener('forceCalendarRefresh', handleForceCalendarRefresh);

        return () => {
            window.removeEventListener('forceCalendarRefresh', handleForceCalendarRefresh);
        };
    }, [router]);

    const handleLogout = () => {
        logout();
        setUser({ id: null, isGuest: true });
        router.push('/');
    };

    return (
        <div className="font-mono min-h-screen bg-white dark:bg-[rgb(var(--background-rgb))] text-black dark:text-[rgb(var(--text-primary))] transition-colors duration-300">
            {/* Navigation Bar */}
            <div className="bg-white dark:bg-[rgb(var(--secondary-bg))] border-b border-gray-200 dark:border-[rgb(var(--border-color))] transition-colors duration-300 sticky top-0 z-50">
                {/* Mobile Navigation - Clean Top Nav Bar (MOBILE ONLY) */}
                <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-[rgb(var(--secondary-bg))] border-b border-gray-200 dark:border-[rgb(var(--border-color))]">
                    <div className="flex items-center gap-3">
<Logo size={36} />
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={view}
                            onChange={(e) => handleSetView(e.target.value as 'assistant' | 'kairoll')}
                            className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="assistant">Assistant</option>
                            <option value="kairoll">Kairoll</option>
                        </select>
                        {mounted && !userLoading && (
                            <AccountDropdown 
                                user={user}
                                isAuthenticated={isAuthenticated()}
                                onLogout={handleLogout}
                            />
                        )}
                    </div>
                </div>

                {/* Desktop Navigation (DESKTOP ONLY) */}
                <div className="hidden lg:flex items-center justify-between px-6 py-4">
                    {/* Counter Badges - Center (Only on large screens where desktop calendar is used) */}
                    <div className="flex items-center gap-3">
                        <CounterBadge count={courseCount} label="courses" />
                        <CounterBadge count={conflictsCount} label="conflicts" variant="warning" />
                    </div>

                    {/* Right side - Split, Calendar, Assistant, Kairoll, Social, Logout */}
                    <div className="flex items-center gap-6">
                        {['split', 'calendar', 'assistant', 'kairoll'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setView(tab as typeof view)}
                                className={`text-sm font-medium transition-colors border-b border-transparent hover:border-b hover:border-gray-900 dark:hover:border-white transition duration-200
                                    ${view === tab
                                        ? 'text-gray-900 dark:text-white border-b border-gray-900 dark:border-white'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}

                        {/* Account Dropdown */}
                        {mounted && !userLoading && (
                            <AccountDropdown 
                                user={user}
                                isAuthenticated={isAuthenticated()}
                                onLogout={handleLogout}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Theme Toggle - only show for assistant view */}
            {view === 'assistant' && <ThemeToggle />}

            {/* Main Content */}
            {view === 'split' && (
                <div className="hidden sm:flex sm:flex-row h-[calc(100vh-64px)]">{/* subtract desktop header ~64px */}
                    {/* Calendar Panel - 60% width on desktop only */}
                    <div className="w-3/5 h-full bg-white dark:bg-[rgb(var(--background-rgb))] border-r border-gray-200 dark:border-[rgb(var(--border-color))] transition-colors duration-300 overflow-hidden">
                        <CalendarComponent refreshKey={calendarRefreshKey} onEventAdded={handleCalendarRefresh} showDeleteButton={false} onStatsChange={handleStatsChange} courseCount={courseCount} conflictsCount={conflictsCount} />
                    </div>

                    {/* Assistant Panel - 40% width on desktop only */}
                    <div className="w-2/5 h-full bg-white dark:bg-[rgb(var(--secondary-bg))] border-l border-gray-200 dark:border-[rgb(var(--border-color))] shadow-none transition-colors duration-300 overflow-auto">
                        <AssistantComponent onEventAdded={handleCalendarRefresh} />
                    </div>
                </div>
            )}

            {view === 'calendar' && (
                <div className="h-[calc(100vh-64px)] bg-white dark:bg-[rgb(var(--background-rgb))] transition-colors duration-300 overflow-hidden">{/* subtract header */}
                    {/* CALENDAR ONLY - No assistant content should show here */}
                    <CalendarComponent refreshKey={calendarRefreshKey} onEventAdded={handleCalendarRefresh} showDeleteButton={true} onStatsChange={handleStatsChange} courseCount={courseCount} conflictsCount={conflictsCount} />
                </div>
            )}
            {view === 'assistant' && (
                <div className="h-screen bg-white dark:bg-[rgb(var(--secondary-bg))] transition-colors duration-300">
                    <AssistantComponent onEventAdded={handleCalendarRefresh} />
                </div>
            )}
            {view === 'kairoll' && (
                <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-64px)]">{/* subtract header */}
                    {/* Course Selection Panel - Full screen on mobile, 35% on desktop */}
                    <div className="w-full lg:w-[35%] lg:h-full bg-white dark:bg-[rgb(var(--secondary-bg))] text-black dark:text-[rgb(var(--text-primary))] transition-colors duration-300 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-[rgb(var(--border-color))]">
                        <KairollComponent />
                    </div>

                    {/* Calendar Panel - Show on desktop, full-screen calendar view on mobile will be separate */}
                    <div className="hidden lg:block w-full lg:w-[65%] lg:h-full bg-white dark:bg-[rgb(var(--background-rgb))] transition-colors duration-300 overflow-hidden">
                        <CalendarComponent refreshKey={calendarRefreshKey} initialDate={getKairollInitialDate()} onEventAdded={handleCalendarRefresh} showDeleteButton={false} onStatsChange={handleStatsChange} courseCount={courseCount} conflictsCount={conflictsCount} />
                    </div>
                </div>
            )}

                                {/* Guest Mode Welcome Popup */}
                    {showGuestPopup && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                            <div className="bg-white dark:bg-[#121212] rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center border border-gray-200/20 dark:border-white/10 animate-in slide-in-from-bottom-4 duration-300">
                                {/* Close button */}
                                <button
                                    onClick={() => setShowGuestPopup(false)}
                                    className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 group"
                                >
                                    <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                                
                                {/* Icon */}
                                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                                    <svg className="w-9 h-9 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <circle cx="12" cy="8.5" r="3.25"/>
                                        <path d="M4.5 19.5c1.6-3.4 4.6-5 7.5-5s5.9 1.6 7.5 5"/>
                                    </svg>
                                </div>
                                
                                {/* Content */}
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                                    Welcome to Kairo!
                                </h2>
                                <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm leading-relaxed">
                                    You're now in <span className="font-semibold text-emerald-600 dark:text-emerald-400">guest mode</span>. Explore all features freely. To save your schedule, <a href="/signup" className="underline text-emerald-700 dark:text-emerald-400 hover:opacity-80">sign up</a> or <a href="/login" className="underline text-emerald-700 dark:text-emerald-400 hover:opacity-80">log in</a>.
                                </p>
                                
                                {/* Subtle 5s auto-dismiss hint (no live timer) */}
                                <div className="relative w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-2 overflow-hidden">
                                    <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full animate-[grow_5s_linear_forwards]"></div>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Auto-dismiss in 5 seconds…</p>
                                
                                
                                
                                {/* Action buttons */}
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => setShowGuestPopup(false)}
                                        className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-2 px-3 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 text-sm"
                                    >
                                        Got it
                                    </button>
                                    <button
                                        onClick={() => router.push('/signup')}
                                        className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-2 px-3 rounded-lg font-medium hover:from-emerald-700 hover:to-teal-700 transform hover:-translate-y-0.5 transition-all duration-200 shadow-lg text-sm"
                                    >
                                        Sign up
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
        </div>
    );
} 