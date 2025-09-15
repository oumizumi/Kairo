import React, { useState, useMemo, useEffect } from 'react';
import { format, addWeeks, subWeeks, startOfWeek, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { EVENT_THEMES } from '@/config/eventThemes';

// Using unified event themes from config

interface Event {
    id?: number;
    startTime: string;
    endTime: string;
    title: string;
    day_of_week?: string;
    start_date?: string;
    end_date?: string;
    description?: string;
    professor?: string;
    theme?: string;
}

interface MobileCalendarProps {
    date: string;
    events: Event[];
    onDateChange?: (newDate: string) => void;
}

const MobileCalendar: React.FC<MobileCalendarProps> = ({
    date,
    events,
    onDateChange
}) => {
    const [currentDate, setCurrentDate] = useState(date);
    const [courseCache, setCourseCache] = useState<Map<string, string>>(new Map());
    
    // Course visibility state - tracks which courses should be visible (same as desktop)
    const [visibleCourses, setVisibleCourses] = useState<Set<string>>(new Set());

    // Load course visibility from backend/localStorage on mount (same as desktop)
    useEffect(() => {
        const loadVisibility = async () => {
            if (typeof window !== 'undefined') {
                const token = localStorage.getItem('token');
                
                // Try to load from backend first if authenticated
                if (token) {
                    try {
                        const response = await fetch('/api/user-preferences/course-visibility/', {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            if (data.value && Array.isArray(data.value)) {
                                const savedSet = new Set<string>(data.value.map((item: any) => String(item)));
                                setVisibleCourses(savedSet);
                                return;
                            }
                        }
                    } catch (error) {
                        console.warn('Mobile: Failed to load course visibility from backend:', error);
                    }
                }
                
                // Fallback to user-specific localStorage
                try {
                    const { getUserStorageItem } = await import('@/lib/userStorage');
                    const saved = getUserStorageItem('course-visibility');
                    if (saved) {
                        const savedSet = new Set<string>(JSON.parse(saved));
                        setVisibleCourses(savedSet);
                    }
                } catch (error) {
                    console.warn('Mobile: Failed to load course visibility from localStorage:', error);
                }
            }
        };
        
        loadVisibility();
    }, []);

    // Save course visibility to localStorage and backend when it changes (same as desktop)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saveVisibility = async () => {
                try {
                    // Save to user-specific localStorage
                    const { setUserStorageItem } = await import('@/lib/userStorage');
                    setUserStorageItem('course-visibility', JSON.stringify(Array.from(visibleCourses)));

                    // Save to backend if user is authenticated
                    const token = localStorage.getItem('token');
                    if (token && visibleCourses.size > 0) {
                        try {
                            await fetch('/api/user-preferences/', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    key: 'course-visibility',
                                    value: Array.from(visibleCourses)
                                })
                            });
                        } catch (error) {
                            console.warn('Mobile: Failed to save course visibility to backend:', error);
                        }
                    }
                } catch (error) {
                    console.warn('Mobile: Failed to save course visibility:', error);
                }
            };

            saveVisibility();
        }
    }, [visibleCourses]);

    // Auto-add new courses to visible list when they're detected (same as desktop)
    useEffect(() => {
        const newCourses = new Set<string>();
        
        events.forEach(event => {
            const displayInfo = getEventDisplayInfo(event);
            const courseCode = displayInfo.courseCode;
            
            if (courseCode && !visibleCourses.has(courseCode)) {
                newCourses.add(courseCode);
            }
        });
        
        if (newCourses.size > 0) {
                setVisibleCourses(prev => {
                const updated = new Set([...prev, ...newCourses]);
                return updated;
            });
        }
    }, [events, visibleCourses]);

    // Load course data and cache course names
    useEffect(() => {
        const loadCourseData = async () => {
            try {
                // Try API first
                const apiUrl = process.env.NEXT_PUBLIC_API_URL ||
                    (typeof window !== 'undefined' && window.location.hostname === 'localhost'
                        ? 'http://localhost:8000'
                        : 'https://kairopublic-production.up.railway.app');

                const response = await fetch(`${apiUrl}/api/data/courses-complete/`);
                let courseData;

                if (response.ok) {
                    courseData = await response.json();
                } else {
                    // Fallback to local file
                    const fallbackResponse = await fetch('/all_courses_complete.json');
                    courseData = await fallbackResponse.json();
                }

                // Build cache of course code -> course name
                const cache = new Map<string, string>();
                for (const department in courseData) {
                    const courses = courseData[department];
                    if (Array.isArray(courses)) {
                        for (const course of courses) {
                            if (course.courseCode && course.courseTitle) {
                                // Store multiple formats for course codes
                                const originalCode = course.courseCode.trim();
                                const withSpace = originalCode.replace(/([A-Z]+)(\d+)/, '$1 $2'); // Add space: HSS2305 -> HSS 2305
                                const withoutSpace = originalCode.replace(/\s+/g, ''); // Remove space: HSS 2305 -> HSS2305

                                // Store all possible formats
                                cache.set(originalCode, course.courseTitle);
                                cache.set(withSpace, course.courseTitle);
                                cache.set(withoutSpace, course.courseTitle);

                                
                            }
                        }
                    }
                }
                setCourseCache(cache);
            } catch (error) {
                console.error('❌ Failed to load course data:', error);
            }
        };

        loadCourseData();
    }, []);

    // Get the week days starting from Monday
    const weekDays = useMemo(() => {
        const startDate = startOfWeek(new Date(currentDate), { weekStartsOn: 1 });
        return Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
    }, [currentDate]);

    // Time slots for mobile (showing only main hours)
    const timeSlots = useMemo(() => {
        const slots = [];
        for (let hour = 8; hour <= 21; hour++) {
            slots.push({
                hour,
                display: `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'PM' : 'AM'}`
            });
        }
        return slots;
    }, []);

    const timeToMinutes = (timeString: string): number => {
        if (!timeString || typeof timeString !== 'string') {
            console.warn('Invalid time string in mobile calendar:', timeString);
            return 0;
        }
        try {
            const [hours, minutes] = timeString.split(':').map(Number);
            if (isNaN(hours) || isNaN(minutes)) {
                console.warn('Invalid time format in mobile calendar:', timeString);
                return 0;
            }
            return hours * 60 + minutes;
        } catch (error) {
            console.warn('Error parsing time in mobile calendar:', timeString, error);
            return 0;
        }
    };

    const formatTime12Hour = (timeString: string): string => {
        if (!timeString || typeof timeString !== 'string') {
            return 'Invalid Time';
        }
        try {
            const [hours, minutes] = timeString.split(':').map(Number);
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
            return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
        } catch (error) {
            console.warn('Error formatting time in mobile calendar:', timeString, error);
            return timeString;
        }
    };

    const getEventsForDay = (dayDate: Date) => {
        const dayName = format(dayDate, 'EEEE');
        const dayDateString = format(dayDate, 'yyyy-MM-dd');

        return events.filter(event => {
            // Skip events without valid time properties
            if (!event.startTime || !event.endTime) {
                console.warn('📱 Mobile: Skipping event without time properties:', event.title);
                return false;
            }

            // Filter by course visibility (same as desktop)
            if (visibleCourses.size > 0) {
                const displayInfo = getEventDisplayInfo(event);
                const courseCode = displayInfo.courseCode;
                
                if (courseCode && !visibleCourses.has(courseCode)) {
                    return false;
                }
            }

            if (event.day_of_week) {
                return event.day_of_week === dayName;
            }
            if (event.start_date) {
                return event.start_date === dayDateString;
            }
            return false;
        }).sort((a, b) => {
            const timeA = timeToMinutes(a.startTime);
            const timeB = timeToMinutes(b.startTime);
            return timeA - timeB;
        });
    };

    const getEventThemeStyle = (event: Event) => {
        const theme = EVENT_THEMES[event.theme as keyof typeof EVENT_THEMES] || EVENT_THEMES['lavender-peach'];
        return {
            background: theme.cssGradient,
            color: 'white'
        };
    };

    // GET FULL COURSE NAME LIKE "HSS 2305 - Molecular Mechanisms of Disease"
    const getEventDisplayInfo = (event: Event) => {
        let courseCode = '';
        let sectionType = '';
        let professor = event.professor || '';

        // Try to extract course code from title (format: "CSI 2110 - Instructor", "HSS 2305 LAB", etc.)
        const titleMatch = event.title.match(/([A-Z]{2,4}\s*\d{3,4})/);
            if (titleMatch) {
                courseCode = titleMatch[1].replace(/\s+/g, ' ').trim(); // Normalize spacing
            }

        // Try to extract section type from description or title
        if (event.description) {
            const sectionMatch = event.description.match(/(LEC|LAB|TUT|SEM|DGD|WRK|THÉ|DIS|PRA|DRO|STG|REC|CNF|FLD)/i);
            if (sectionMatch) {
                sectionType = sectionMatch[1].toUpperCase();
            }

            // Try to extract instructor from description if not already available
            if (!professor) {
                const instructorMatch = event.description.match(/Instructor:\s*([^\n\r]+)/i);
                if (instructorMatch) {
                    professor = instructorMatch[1].trim();
                }
            }
        }

        // If no section type found in description, try to extract from title
        if (!sectionType) {
            const titleSectionMatch = event.title.match(/(LEC|LAB|TUT|SEM|DGD|WRK|THÉ|DIS|PRA|DRO|STG|REC|CNF|FLD)/i);
            if (titleSectionMatch) {
                sectionType = titleSectionMatch[1].toUpperCase();
            }
        }

        // If no professor found, try to extract from title after the dash
        if (!professor && event.title.includes(' - ')) {
            const titleParts = event.title.split(' - ');
            if (titleParts.length > 1) {
                professor = titleParts[1].trim();
            }
        }

        // Look up the full course name from cache
        let displayTitle = courseCode || event.title.split(' - ')[0] || event.title;
        if (courseCode) {
            // Try multiple course code formats for lookup
            const formats = [
                courseCode,                                    // Original: "HSS 2305"
                courseCode.replace(/\s+/g, ''),              // No space: "HSS2305"  
                courseCode.replace(/([A-Z]+)(\d+)/, '$1 $2')  // With space: "HSS 2305"
            ];

            let courseName = null;
            for (const format of formats) {
                    if (courseCache.has(format)) {
                        courseName = courseCache.get(format);
                        break;
                    }
            }

            if (courseName) {
                displayTitle = `${courseCode} - ${courseName}`;
            }
        }

        return {
            title: displayTitle,
            courseCode: courseCode,
            sectionType: sectionType || 'LEC',
            professor: professor
        };
    };

    const goToPreviousWeek = () => {
        const newDate = format(subWeeks(new Date(currentDate), 1), 'yyyy-MM-dd');
        setCurrentDate(newDate);
        onDateChange?.(newDate);
    };

    const goToNextWeek = () => {
        const newDate = format(addWeeks(new Date(currentDate), 1), 'yyyy-MM-dd');
        setCurrentDate(newDate);
        onDateChange?.(newDate);
    };

    const goToToday = () => {
        const today = format(new Date(), 'yyyy-MM-dd');
        setCurrentDate(today);
        onDateChange?.(today);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-white" />
                        <h3 className="text-lg font-semibold text-white">
                            Weekly Schedule
                        </h3>
                    </div>
                    <button
                        onClick={goToToday}
                        className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition-colors"
                    >
                        Today
                    </button>
                </div>

                {/* Week Navigation */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={goToPreviousWeek}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-white" />
                    </button>

                    <span className="text-white font-medium text-sm">
                        {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}
                    </span>

                    <button
                        onClick={goToNextWeek}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <ChevronRight className="w-5 h-5 text-white" />
                    </button>
                </div>
            </div>

            {/* Mobile Calendar Grid */}
            <div className="p-2">
                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map((day, index) => {
                        const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                        return (
                            <div key={index} className="text-center py-1">
                                <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                    {format(day, 'EEE')}
                                </div>
                                <div className={`text-sm font-semibold mt-1 w-6 h-6 rounded-full flex items-center justify-center mx-auto ${isToday
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-900 dark:text-white'
                                    }`}>
                                    {format(day, 'd')}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Scrollable Events Area */}
                <div className="max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-7 gap-1">
                        {weekDays.map((day, dayIndex) => {
                            const dayEvents = getEventsForDay(day);
                            return (
                                <div key={dayIndex} className="min-h-24 space-y-1">
                                    {dayEvents.map((event, eventIndex) => (
                                        <div
                                            key={`${dayIndex}-${eventIndex}`}
                                            className="p-1 rounded text-xs font-medium shadow-sm border border-white/20"
                                            style={getEventThemeStyle(event)}
                                        >
                                            <div className="font-semibold overflow-hidden"
                                                 style={{ wordBreak: 'break-word' }}>
                                                {getEventDisplayInfo(event).title}
                                            </div>
                                            <div className="text-xs opacity-90 mt-0.5">
                                                {formatTime12Hour(event.startTime)}
                                            </div>
                                            {event.professor && (
                                                <div className="text-xs opacity-75 overflow-hidden"
                                                     style={{ wordBreak: 'break-word' }}>
                                                    {event.professor}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Events Summary */}
                <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                        {events.length} event{events.length !== 1 ? 's' : ''} this week
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MobileCalendar; 