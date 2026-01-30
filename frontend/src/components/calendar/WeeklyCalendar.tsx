import React, { useState, useEffect, useMemo } from 'react';
import { format, addWeeks, subWeeks, parseISO, startOfWeek, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Trash2, Calendar, Edit3, Sparkles, Plus, Download, Share2, Clipboard } from 'lucide-react';
import { APP_CONFIG } from '@/config/app.config';
import { useTheme } from '@/components/ThemeProvider';
import { getCalendarEvents, CalendarEvent as APICalendarEvent } from '@/lib/api';
import CounterBadge from '../CounterBadge';
import TermFilterBadge from '../TermFilterBadge';
import { exportCalendarAsICS, hasEventsToExport } from '@/services/icsExportService';
import DownloadScheduleModal from '../DownloadScheduleModal';
import { shareSchedule, generateShareableSchedule, copyToClipboard, hasScheduleContent, getSharedSchedule } from '@/services/scheduleShareService';
import { EVENT_THEMES } from '@/config/eventThemes';
import { getGridConfig, getGridTemplateColumns } from '@/config/calendar.grid.config';
import { Event, WeeklyCalendarProps } from './types';
import EditEventModal from './EditEventModal';
import SwapCourseModal from './SwapCourseModal';
import EventTooltip from './EventTooltip';
import './calendar.css';

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({ 
    date, 
    events, 
    onDateChange, 
    onEventChange,
    onEventEdit, 
    onEventDelete, 
    onEventAdd, 
    onRefresh,
    // Legacy props
    onDeleteEvent,
    onAddEvent,
    onEditEvent,
    selectedTerm = 'All Terms',
    onTermChange, 
    loadFromBackend = false, 
    readOnly = false,
    isKairollView = false,
    onStatsChange,
    courseCount = 0,
    conflictsCount = 0,
    currentTerm = 'Fall'
}) => {
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const [showAddEventModal, setShowAddEventModal] = useState(false);
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [showSwapModal, setShowSwapModal] = useState(false);
    const [swapEvent, setSwapEvent] = useState<Event | null>(null);
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
    const [showDeleteEventsModal, setShowDeleteEventsModal] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [animationDirection, setAnimationDirection] = useState<'prev' | 'next'>('next');
    const [tooltipEvent, setTooltipEvent] = useState<Event | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [tooltipVisible, setTooltipVisible] = useState(false);
    const [showConflictsModal, setShowConflictsModal] = useState(false);
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pasteUrl, setPasteUrl] = useState('');
    const [pasteLoading, setPasteLoading] = useState(false);
    const [pasteError, setPasteError] = useState<string | null>(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [shareLoading, setShareLoading] = useState(false);
    const [backendEvents, setBackendEvents] = useState<Event[]>([]);
    const [showWeekdaysOnly, setShowWeekdaysOnly] = useState(false);

    // Get theme from ThemeProvider
    const { actualTheme } = useTheme();

    // Parse the date string to Date object
    const currentDate = useMemo(() => {
        if (typeof date === 'string') {
            // Handle both ISO date strings and other formats
            return date.includes('T') ? parseISO(date) : parseISO(date + 'T00:00:00');
        }
        return date;
    }, [date]);

    // Calculate week start (Monday)
    const weekStart = useMemo(() => {
        return startOfWeek(currentDate, { weekStartsOn: 1 });
    }, [currentDate]);

    // Combine passed events with backend events (avoiding duplicates)
    const allEvents = useMemo(() => {
        if (loadFromBackend && backendEvents.length > 0) {
            // Combine events, avoiding duplicates based on title and time
            const eventMap = new Map();
            
            [...events, ...backendEvents].forEach(event => {
                const key = `${event.title}-${event.startTime}-${event.endTime}-${event.day_of_week || event.start_date}`;
                if (!eventMap.has(key)) {
                    eventMap.set(key, event);
                }
            });
            
            return Array.from(eventMap.values());
        }
        return events;
    }, [events, backendEvents, loadFromBackend]);

    // Filter events by selected term
    const filteredEvents = useMemo(() => {
        if (selectedTerm === 'All Terms') {
            return allEvents;
        }
        return allEvents.filter(event => 
            event.term === selectedTerm || !event.term
        );
    }, [allEvents, selectedTerm]);

    // Function to count unique courses from events
    const getUniqueCourseCount = () => {
        const allEvents = [...events, ...(loadFromBackend ? backendEvents : [])];
        const uniqueCourses = new Set();
        
        allEvents.forEach(event => {
            if (event.description) {
                const courseMatch = event.description.match(/Course:\s*([A-Z]{3}\s*\d{4})/i);
                if (courseMatch) {
                    uniqueCourses.add(courseMatch[1].trim());
                }
            } else if (event.title) {
                const titleMatch = event.title.match(/([A-Z]{3}\s*\d{4})/);
                if (titleMatch) {
                    uniqueCourses.add(titleMatch[1].trim());
                }
            }
        });
        
        return uniqueCourses.size;
    };

    // Function to count scheduling conflicts
    const getConflictsCount = () => {
        const allEvents = [...events, ...(loadFromBackend ? backendEvents : [])];
        
        const conflicts = new Set();
        
        for (let i = 0; i < allEvents.length; i++) {
            for (let j = i + 1; j < allEvents.length; j++) {
                const event1 = allEvents[i];
                const event2 = allEvents[j];
                
                // Check if events are on the same day
                const sameDay = event1.day_of_week === event2.day_of_week || 
                               event1.start_date === event2.start_date;
                
                if (sameDay) {
                    // Check for time overlap
                    const start1 = parseInt(event1.startTime.replace(':', ''));
                    const end1 = parseInt(event1.endTime.replace(':', ''));
                    const start2 = parseInt(event2.startTime.replace(':', ''));
                    const end2 = parseInt(event2.endTime.replace(':', ''));
                    
                    if ((start1 < end2 && end1 > start2)) {
                        conflicts.add(`${Math.min(i, j)}-${Math.max(i, j)}`);
                    }
                }
            }
        }
        
        return conflicts.size;
    };

    // Update stats when events change
    useEffect(() => {
        if (onStatsChange) {
            const courseCount = getUniqueCourseCount();
            const conflictsCount = getConflictsCount();
            onStatsChange(courseCount, conflictsCount, allEvents);
        }
    }, [allEvents, onStatsChange]);

    // Generate the days of the week (7 days or 5 weekdays only)
    const weekDays = useMemo(() => {
        const allDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        if (showWeekdaysOnly) {
            // Filter out Saturday (index 5) and Sunday (index 6)
            return allDays.filter((_, index) => index < 5);
        }
        return allDays;
    }, [weekStart, showWeekdaysOnly]);

    // Track screen width for responsive positioning with debouncing
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        
        const updateScreenWidth = () => {
            // Clear any pending timeout
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            // Set a new timeout
            timeoutId = setTimeout(() => {
                setScreenWidth(window.innerWidth);
            }, 100); // 100ms debounce
        };

        updateScreenWidth(); // Set initial value
        window.addEventListener('resize', updateScreenWidth);
        
        return () => {
            window.removeEventListener('resize', updateScreenWidth);
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, []);

    // Load backend events if needed
    useEffect(() => {
        const shouldLoadFromBackend = loadFromBackend;
        
        if (shouldLoadFromBackend) {
            const loadBackendEvents = async () => {
                try {
                    const apiEvents = await getCalendarEvents();
                    const convertedEvents: Event[] = apiEvents.map((apiEvent: APICalendarEvent) => ({
                        id: apiEvent.id,
                        title: apiEvent.title,
                        startTime: apiEvent.start_time,
                        endTime: apiEvent.end_time,
                        day_of_week: apiEvent.day_of_week,
                        start_date: apiEvent.start_date,
                        end_date: apiEvent.end_date,
                        description: apiEvent.description,
                        professor: apiEvent.professor,
                        recurrence_pattern: apiEvent.recurrence_pattern as 'weekly' | 'biweekly' | 'none',
                        reference_date: apiEvent.reference_date,
                        theme: apiEvent.theme,
                        term: apiEvent.term
                    }));
                    setBackendEvents(convertedEvents);
                } catch (error) {
                    console.error('Failed to load backend events:', error);
                }
            };

            loadBackendEvents();
        }
    }, [loadFromBackend]);

    // Navigation handlers
    const goToPreviousWeek = () => {
        if (onDateChange && !isAnimating) {
            setAnimationDirection('prev');
            setIsAnimating(true);
            const newDate = subWeeks(currentDate, 1);
            // Convert back to string if original was string
            const dateToPass = typeof date === 'string' ? format(newDate, 'yyyy-MM-dd') : newDate;
            onDateChange(dateToPass);
            setTimeout(() => setIsAnimating(false), 300);
        }
    };

    const goToNextWeek = () => {
        if (onDateChange && !isAnimating) {
            setAnimationDirection('next');
            setIsAnimating(true);
            const newDate = addWeeks(currentDate, 1);
            // Convert back to string if original was string
            const dateToPass = typeof date === 'string' ? format(newDate, 'yyyy-MM-dd') : newDate;
            onDateChange(dateToPass);
            setTimeout(() => setIsAnimating(false), 300);
        }
    };

    const goToToday = () => {
        if (onDateChange) {
            const today = new Date();
            // Convert back to string if original was string
            const dateToPass = typeof date === 'string' ? format(today, 'yyyy-MM-dd') : today;
            onDateChange(dateToPass);
        }
    };

    // Event handlers
    const handleEditEvent = (event: Event) => {
        setEditingEvent(event);
    };

    const handleCloseEditModal = () => {
        setEditingEvent(null);
    };

    const handleSaveEvent = async (updatedEvent: Event) => {
        if (onEventEdit && updatedEvent.id) {
            onEventEdit(updatedEvent.id, updatedEvent);
        }
        if (onEventChange) {
            const updatedEvents = allEvents.map(event => 
                event.id === updatedEvent.id ? updatedEvent : event
            );
            onEventChange(updatedEvents);
        }
    };

    const handleAddEvent = () => {
        setShowAddEventModal(true);
    };

    const handleCloseAddEventModal = () => {
        setShowAddEventModal(false);
    };

    const handleSaveNewEvent = async (newEvent: Event) => {
        // Use legacy prop if available, otherwise use new prop
        if (onAddEvent) {
            onAddEvent(newEvent);
        } else if (onEventAdd) {
            onEventAdd(newEvent);
        }
        if (onEventChange) {
            onEventChange([...allEvents, { ...newEvent, id: Date.now() }]);
        }
    };

    const handleDeleteEvent = (eventId: number) => {
        // Use legacy prop if available, otherwise use new prop
        if (onDeleteEvent) {
            onDeleteEvent(eventId);
        } else if (onEventDelete) {
            onEventDelete(eventId);
        }
        if (onEventChange) {
            const updatedEvents = allEvents.filter(event => event.id !== eventId);
            onEventChange(updatedEvents);
        }
    };

    // Tooltip handlers
    const handleMouseEnter = (event: Event, e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipEvent(event);
        setTooltipPosition({
            x: rect.left + rect.width / 2,
            y: rect.top
        });
        setTooltipVisible(true);
    };

    const handleMouseLeave = () => {
        setTooltipVisible(false);
        setTooltipEvent(null);
    };

    // Swap course handlers
    const handleSwapCourse = (event: Event) => {
        setSwapEvent(event);
        setShowSwapModal(true);
    };

    const handleCloseSwapModal = () => {
        setShowSwapModal(false);
        setSwapEvent(null);
    };

    const handleSwapEvent = (newEvent: Event) => {
        // Use legacy prop if available, otherwise use new prop
        if (onAddEvent) {
            onAddEvent(newEvent);
        } else if (onEventAdd) {
            onEventAdd(newEvent);
        }
        if (onEventChange) {
            onEventChange([...allEvents, { ...newEvent, id: Date.now() }]);
        }
    };

    // Get events for a specific day
    const getEventsForDay = (dayName: string, dayDate: Date) => {
        const dayDateString = format(dayDate, 'yyyy-MM-dd');
        
        return filteredEvents.filter(event => {
            // Handle recurring events (weekly/biweekly)
            if (event.day_of_week) {
                const eventDayName = event.day_of_week;
                if (eventDayName !== dayName) return false;
                
                // Handle biweekly events
                if (event.recurrence_pattern === 'biweekly' && event.reference_date) {
                    const referenceDate = parseISO(event.reference_date);
                    const daysDiff = Math.floor((dayDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
                    const weeksDiff = Math.floor(daysDiff / 7);
                    return weeksDiff % 2 === 0;
                }
                
                return true;
            }
            
            // Handle specific date events
            if (event.start_date) {
                return event.start_date === dayDateString;
            }
            
            return false;
        });
    };

    // Generate time slots (7 AM to 10 PM)
    const timeSlots = Array.from({ length: 15 }, (_, i) => {
        const hour = i + 7;
        return {
            hour,
            display: hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`
        };
    });

    return (
        <div className="weekly-calendar">
            {/* Header */}
            <div className="calendar-header">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={goToPreviousWeek}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            disabled={isAnimating}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        
                        <h2 className="text-xl font-semibold">
                            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, showWeekdaysOnly ? 4 : 6), 'MMM d, yyyy')}
                        </h2>
                        
                        <button
                            onClick={goToNextWeek}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            disabled={isAnimating}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                        
                        <button
                            onClick={goToToday}
                            className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                            Today
                        </button>

                        <button
                            onClick={() => setShowWeekdaysOnly(!showWeekdaysOnly)}
                            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                                showWeekdaysOnly
                                    ? 'bg-purple-500 text-white hover:bg-purple-600'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                        >
                            {showWeekdaysOnly ? 'Weekdays' : 'All Days'}
                        </button>
                    </div>
                    
                    {!readOnly && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleAddEvent}
                                className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Add Event
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="weekly-grid-container">
                {/* Days Header */}
                <div className={`days-header ${showWeekdaysOnly ? 'grid-cols-6-weekdays' : 'grid-cols-8-narrow'}`}>
                    <div className="time-label">Time</div>
                    {weekDays.map((day, index) => (
                        <div key={index} className="text-center font-medium p-4">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                {format(day, 'EEE')}
                            </div>
                            <div className="text-lg">
                                {format(day, 'd')}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Time Grid */}
                <div className="time-grid">
                    {timeSlots.map((timeSlot) => (
                        <div key={timeSlot.hour} className={`time-slot ${showWeekdaysOnly ? 'grid-cols-6-weekdays' : 'grid-cols-8-narrow'}`}>
                            <div className="time-label">
                                {timeSlot.display}
                            </div>
                            {weekDays.map((day, dayIndex) => {
                                const dayName = format(day, 'EEEE');
                                const dayEvents = getEventsForDay(dayName, day);
                                
                                return (
                                    <div key={dayIndex} className="day-column">
                                        <div className="events-overlay">
                                            {dayEvents.map((event, eventIndex) => {
                                                const startHour = parseInt(event.startTime.split(':')[0]);
                                                const startMinute = parseInt(event.startTime.split(':')[1]);
                                                const endHour = parseInt(event.endTime.split(':')[0]);
                                                const endMinute = parseInt(event.endTime.split(':')[1]);
                                                
                                                // Calculate position within the time grid
                                                const startPosition = ((startHour - 7) * 60 + startMinute) / 60;
                                                const duration = ((endHour - 7) * 60 + endMinute - (startHour - 7) * 60 - startMinute) / 60;
                                                
                                                // Only show events that fall within our time range (7 AM - 10 PM)
                                                if (startHour < 7 || startHour >= 22) return null;
                                                
                                                const theme = EVENT_THEMES[event.theme || 'lavender-peach'] || EVENT_THEMES['lavender-peach'];
                                                
                                                return (
                                                    <div
                                                        key={`${event.id}-${eventIndex}`}
                                                        className={`event-block ${theme.preview}`}
                                                        style={{
                                                            top: `${startPosition * 60}px`,
                                                            height: `${Math.max(duration * 60, 30)}px`,
                                                            left: '2px',
                                                            right: '2px',
                                                            zIndex: 5
                                                        }}
                                                        onMouseEnter={(e) => handleMouseEnter(event, e)}
                                                        onMouseLeave={handleMouseLeave}
                                                        onClick={() => !readOnly && handleEditEvent(event)}
                                                    >
                                                        <div className="text-xs font-medium truncate">
                                                            {event.title}
                                                        </div>
                                                        <div className="text-xs opacity-90 truncate">
                                                            {event.startTime} - {event.endTime}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Modals */}
            <EditEventModal
                event={editingEvent}
                isOpen={!!editingEvent}
                onClose={handleCloseEditModal}
                onSave={handleSaveEvent}
                isCreating={false}
                allEvents={allEvents}
                onDeleteEvent={handleDeleteEvent}
                onAddEvent={handleSaveNewEvent}
            />

            <EditEventModal
                event={null}
                isOpen={showAddEventModal}
                onClose={handleCloseAddEventModal}
                onSave={handleSaveNewEvent}
                isCreating={true}
                allEvents={allEvents}
                onDeleteEvent={handleDeleteEvent}
                onAddEvent={handleSaveNewEvent}
            />

            <SwapCourseModal
                event={swapEvent}
                isOpen={showSwapModal}
                onClose={handleCloseSwapModal}
                onSwap={handleSwapEvent}
                allEvents={allEvents}
                onDeleteEvent={handleDeleteEvent}
                onAddEvent={handleSaveNewEvent}
            />

            <EventTooltip
                event={tooltipEvent}
                visible={tooltipVisible}
                position={tooltipPosition}
            />
        </div>
    );
};

export default WeeklyCalendar;