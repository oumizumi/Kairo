"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, parseISO, addWeeks } from 'date-fns';
import WeeklyCalendar from '@/components/DailyCalendar';
import { isAuthenticated, getCalendarEvents, createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from '@/lib/api';
import { persistentCalendarService } from '@/services/persistentCalendarService';
import { EVENT_THEMES } from '@/config/eventThemes';
import { extractTermFromEvent } from '@/utils/chatHelpers';
import { CalendarComponentProps, DailyCalendarEvent } from '@/types/chat';

function CalendarComponent({ refreshKey, initialDate, onEventAdded, showDeleteButton = true, onStatsChange, courseCount = 0, conflictsCount = 0, isKairollView = false, selectedTerm = 'All Terms' }: CalendarComponentProps) {
    const [currentDate, setCurrentDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
    const [events, setEvents] = useState<DailyCalendarEvent[]>([]);
    const [isManuallyRemoved, setIsManuallyRemoved] = useState(false);
    const [isLoadingFromDB, setIsLoadingFromDB] = useState(false);
    const [isLargeScreen, setIsLargeScreen] = useState<boolean>(true);
    const [isClient, setIsClient] = useState<boolean>(false);

    // Get theme for event
    const getEventTheme = (event: DailyCalendarEvent) => {
        return EVENT_THEMES[event.theme as keyof typeof EVENT_THEMES] || EVENT_THEMES['lavender-peach'];
    };

    // Filter events based on selected term
    const filteredEvents = useMemo(() => {
        if (selectedTerm === 'All Terms') {
            return events;
        }

        return events.filter(event => {
            const eventTerm = extractTermFromEvent(event);
            return eventTerm === selectedTerm;
        });
    }, [events, selectedTerm]);

    const fetchEvents = useCallback(async () => {
        if (isManuallyRemoved || isLoadingFromDB) {
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

        // Map the API events to the format expected by WeeklyCalendar
        const mappedEvents = fetchedEvents.map(event => ({
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
        if (isAuthenticated()) {
            fetchEvents();
        } else {
            setEvents([]);
        }
    }, [currentDate, refreshKey, fetchEvents]);

    useEffect(() => {
        setIsManuallyRemoved(false);
    }, [refreshKey]);

    // Screen size detection for responsive calendar
    useEffect(() => {
        setIsClient(true);

        const checkScreenSize = () => {
            setIsLargeScreen(window.innerWidth >= 1024);
        };

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
            const { eventIds } = event.detail;

            setIsManuallyRemoved(true);

            setEvents(prevEvents => {
                const filteredEvents = prevEvents.filter(e => !eventIds.includes(e.id));
                return filteredEvents;
            });

            setTimeout(() => {
                setIsManuallyRemoved(false);
                if (isAuthenticated()) {
                    fetchEvents();
                }
            }, 50);
        };

        const handleForceAddEvents = (event: any) => {
            const { events: newlyCreatedEvents } = event.detail || {};
            if (!Array.isArray(newlyCreatedEvents) || newlyCreatedEvents.length === 0) return;

            setEvents(prev => {
                const existingIds = new Set(prev.filter(e => e.id != null).map(e => e.id));
                const toAppend = newlyCreatedEvents.filter((e: any) => e && (e.id == null || !existingIds.has(e.id)));
                return [...prev, ...toAppend];
            });
        };

        const handleReplaceTempEvents = (event: any) => {
            const { tempKey, createdEvents } = event.detail || {};
            if (!tempKey || !Array.isArray(createdEvents)) return;

            setEvents(prev => {
                const filtered = prev.filter((e: any) => e && (e as any).tempKey !== tempKey);
                return [...filtered, ...createdEvents];
            });
        };

        const handleCalendarEventDeleted = (event: any) => {
            const { eventId } = event.detail;
            setEvents(prevEvents => prevEvents.filter(e => e.id !== eventId));
        };

        const handleCalendarEventUpdated = (event: any) => {
            if (isAuthenticated()) {
                fetchEvents();
            }
        };

        const handleAICalendarDeletion = (event: any) => {
            const { count } = event.detail;
            if (count > 0) {
                setTimeout(() => {
                    handleAutoRefreshWithVisualFeedback();
                }, 100);
            }
        };

        const handleKairollDeletion = (event: any) => {
            const { count, action } = event.detail;

            if (count > 0) {
                if (action === 'RESET_ALL') {
                    setTimeout(() => {
                        handleAutoRefreshWithVisualFeedback();
                    }, 50);
                } else {
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

    const handleDeleteEvent = async (eventId: number) => {
        try {
            setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));
            await deleteCalendarEvent(eventId);

            try {
                await persistentCalendarService.deleteCalendarEvent(eventId);
            } catch (persistentError) {
                console.warn('⚠️ Failed to delete from persistent storage:', persistentError);
            }

            window.dispatchEvent(new CustomEvent('calendarEventDeleted', {
                detail: { eventId }
            }));

            setTimeout(() => {
                handleAutoRefreshWithVisualFeedback();
            }, 100);

        } catch (error) {
            console.error('❌ Error deleting event:', error);
            if (isAuthenticated()) {
                fetchEvents();
            }
            alert(`Failed to delete event: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleEditEvent = async (eventId: number, updatedEvent: DailyCalendarEvent) => {
        try {
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
            const updatedEventFromApi = await updateCalendarEvent(eventId, { theme: updatedEvent.theme });

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

            if (courseCode && updatedEvent.theme) {
                setEvents(prevEvents =>
                    prevEvents.map(e => (extractCourseCode(e) === courseCode)
                        ? { ...e, theme: updatedEvent.theme as string }
                        : e
                    )
                );
            }

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
                } catch { }
            }

            window.dispatchEvent(new CustomEvent('calendarEventUpdated', {
                detail: { eventId, updatedEvent: updatedEventFromApi }
            }));

        } catch (error) {
            console.error('Error updating event:', error);
            alert('Failed to update event. Please try again.');
        }
    };

    const handleAddEvent = async (newEvent: DailyCalendarEvent) => {
        try {
            if (!newEvent.title?.trim()) {
                alert('Event title is required');
                return;
            }
            if (!newEvent.startTime || !newEvent.endTime) {
                alert('Start time and end time are required');
                return;
            }

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

            const createdEventFromApi = await createCalendarEvent(eventData);

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
                theme: createdEventFromApi.theme || 'lavender-peach',
            };

            setEvents(prevEvents => [...prevEvents, newEventForState]);

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

            window.dispatchEvent(new CustomEvent('forceCalendarRefresh'));

            window.dispatchEvent(new CustomEvent('calendarEventCreated', {
                detail: { newEvent: createdEventFromApi }
            }));

            if (onEventAdded) {
                onEventAdded();
            }

            setTimeout(() => {
                if (isAuthenticated()) {
                    fetchEvents();
                }
            }, 100);

        } catch (error) {
            console.error('Error creating event:', error);
            let errorMessage = 'Failed to create event. Please try again.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            alert(`❌ ${errorMessage}`);
        }
    };

    const handleManualRefresh = () => {
        if (isAuthenticated()) {
            fetchEvents();
        }
    };

    const handleAutoRefreshWithVisualFeedback = async () => {
        setIsManuallyRemoved(false);

        const currentDateFormatted = currentDate;
        const nextWeek = format(addWeeks(parseISO(currentDate), 1), 'yyyy-MM-dd');

        setCurrentDate(nextWeek);

        setTimeout(async () => {
            setCurrentDate(currentDateFormatted);

            setTimeout(async () => {
                if (isAuthenticated()) {
                    await fetchEvents();
                }
            }, 150);
        }, 250);
    };

    if (!isClient) {
        return (
            <div className="h-full w-full bg-white dark:bg-[#121212] transition-colors duration-300 flex items-center justify-center">
                <div className="text-gray-500">Loading calendar...</div>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-white dark:bg-[#121212] transition-colors duration-300 flex flex-col">
            {isLargeScreen && (
                <WeeklyCalendar
                    date={currentDate}
                    events={filteredEvents}
                    onDateChange={(date) => {
                        if (typeof date === 'string') {
                            setCurrentDate(date);
                        } else {
                            setCurrentDate(format(date, 'yyyy-MM-dd'));
                        }
                    }}
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

export default CalendarComponent;

