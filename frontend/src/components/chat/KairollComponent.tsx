'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ClipboardList, Download, X } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';
import { 
    isAuthenticated,
    getCalendarEvents, 
    deleteCalendarEvent, 
    createCalendarEvent 
} from '@/lib/api';
import { persistentCalendarService } from '@/services/persistentCalendarService';
import { 
    loadCoursesForTerm, 
    startAutoRefresh, 
    getCacheStatus, 
    refreshAllCourseData 
} from '@/services/courseDataService';
import { setCourses, CourseGrouped as CourseGroupedType, CourseLegacy, isCourseGrouped as isCourseGroupedFn, terms as courseTerms } from '@/types/course';
import { exportCalendarAsICS } from '@/services/icsExportService';
import { exportCalendarForMobile, hasEventsToExport } from '@/services/mobileIcsExport';
import { isMobileDevice as isDeviceMobileFn } from '@/utils/deviceDetection';
import { EVENT_THEMES } from '@/config/eventThemes';
import CourseCard from './CourseCard';
import MobileEventInfoModal from '@/components/MobileEventInfoModal';

// Types
interface DailyCalendarEvent {
    id?: number;
    title: string;
    startTime: string;
    endTime: string;
    day_of_week?: string;
    start_date?: string;
    end_date?: string;
    description?: string;
    professor?: string;
    recurrence_pattern?: 'weekly' | 'biweekly' | 'none';
    reference_date?: string;
    theme?: string;
    tempKey?: string;
    term?: string;
}

type Course = CourseGroupedType | CourseLegacy;

// Helper functions
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T & { cancel: () => void } {
    let timeout: NodeJS.Timeout | null = null;
    const debounced = (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
    debounced.cancel = () => {
        if (timeout) clearTimeout(timeout);
    };
    return debounced as T & { cancel: () => void };
}

const terms = courseTerms;

export function KairollComponent() {
    const [selectedTerm, setSelectedTerm] = useState<string>(terms[0]);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [addedCourses, setAddedCourses] = useState<Course[]>([]);
    const [isLoadingCourses, setIsLoadingCourses] = useState<boolean>(true);
    const [selectedSectionEvents, setSelectedSectionEvents] = useState<Map<string, number[]>>(new Map());
    const [selectedSectionEventsByTerm, setSelectedSectionEventsByTerm] = useState<Map<string, Map<string, number[]>>>(new Map());
    const [pendingAdditions, setPendingAdditions] = useState<Map<string, string>>(new Map());

    const [isComponentMounted, setIsComponentMounted] = useState<boolean>(false);
    const [localCourses, setLocalCourses] = useState<CourseGroupedType[]>([]);
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

    const courseColorMap = useRef(new Map<string, string>());
    const colorIndex = useRef(0);

    // Load selected sections from localStorage on mount
    useEffect(() => {
        const loadSelectedSections = async () => {
            try {
                const { getUserStorageItem } = await import('@/lib/userStorage');
                const savedSelectionsByTerm = getUserStorageItem('kairoll-selected-sections-by-term');
                if (savedSelectionsByTerm) {
                    const parsedData = JSON.parse(savedSelectionsByTerm);
                    const loadedMap = new Map<string, Map<string, number[]>>();
                    Object.entries(parsedData).forEach(([term, sections]: [string, any]) => {
                        loadedMap.set(term, new Map<string, number[]>(Object.entries(sections)));
                    });
                    setSelectedSectionEventsByTerm(loadedMap);
                    const currentTermSelections = loadedMap.get(selectedTerm) || new Map();
                    setSelectedSectionEvents(currentTermSelections);
                    return;
                }
                const savedSelections = getUserStorageItem('kairoll-selected-sections');
                if (savedSelections) {
                    const parsedData = JSON.parse(savedSelections);
                    const loadedMap = new Map<string, number[]>(parsedData);
                    setSelectedSectionEvents(loadedMap);
                    const termMap = new Map<string, Map<string, number[]>>();
                    termMap.set(selectedTerm, loadedMap);
                    setSelectedSectionEventsByTerm(termMap);
                }
            } catch (error) {
                console.error('Error loading selected sections:', error);
            }
        };
        loadSelectedSections();
    }, []);

    // Save selected sections to localStorage
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            try {
                const { setUserStorageItem } = await import('@/lib/userStorage');
                const serializedData: { [term: string]: { [section: string]: number[] } } = {};
                selectedSectionEventsByTerm.forEach((termSections, term) => {
                    serializedData[term] = {};
                    termSections.forEach((eventIds, section) => {
                        serializedData[term][section] = eventIds;
                    });
                });
                setUserStorageItem('kairoll-selected-sections-by-term', JSON.stringify(serializedData));
            } catch (error) {
                console.error('Error saving selected sections:', error);
            }
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [selectedSectionEventsByTerm]);

    const handleCloseWelcomeModal = () => setShowWelcomeModal(false);

    const handleSwipeDown = (info: any) => {
        if (info.offset.y > 150) {
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
        let top = rect.top + scrollTop + rect.height + 5;
        let left = rect.left + scrollLeft;
        const modalWidth = 256;
        const modalHeight = 200;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        if (left + modalWidth > viewportWidth) {
            left = viewportWidth - modalWidth - 10;
        }
        if (top + modalHeight > scrollTop + viewportHeight) {
            top = rect.top + scrollTop - modalHeight - 5;
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
        return () => { document.body.style.overflow = 'auto'; };
    }, [showEventModal]);

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
                    setCalendarEvents(prev => {
                        const prevIds = new Set(prev.map(e => e.id));
                        const newIds = new Set(mappedEvents.map(e => e.id));
                        if (prevIds.size === newIds.size && [...prevIds].every(id => newIds.has(id))) {
                            return prev;
                        }
                        return mappedEvents;
                    });
                } catch (error) {
                    console.error('Failed to fetch calendar events for mobile:', error);
                }
            }
        }, 100),
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
                    mappedEvents = mappedEvents.filter(event => {
                        if (event.start_date && event.end_date) {
                            return event.start_date <= termRange.end && event.end_date >= termRange.start;
                        }
                        return true;
                    });
                }

                setCalendarEvents(mappedEvents);

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
                        if (!newSelectedSectionEvents.has(sectionKey)) {
                            newSelectedSectionEvents.set(sectionKey, []);
                        }
                        newSelectedSectionEvents.get(sectionKey)?.push(event.id);
                        addedCourseCodes.add(courseCode);
                    }
                });

                setSelectedSectionEvents(newSelectedSectionEvents);
                const newAddedCourses = localCourses.filter(course =>
                    addedCourseCodes.has(course.courseCode.replace(/\s+/g, ' '))
                );
                setAddedCourses(newAddedCourses);

            } catch (error) {
                console.error("Failed to fetch events for mobile calendar", error);
                setCalendarEvents([]);
            }
        } else {
            setCalendarEvents([]);
        }
    }, [isMobile, selectedTerm, localCourses]);

    const shuffledColors = useMemo(() => {
        const colors = Object.keys(EVENT_THEMES);
        for (let i = colors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [colors[i], colors[j]] = [colors[j], colors[i]];
        }
        return colors;
    }, []);

    const getCourseColor = (courseCode: string): string => {
        if (!courseColorMap.current.has(courseCode)) {
            const color = shuffledColors[colorIndex.current % shuffledColors.length];
            courseColorMap.current.set(courseCode, color);
            colorIndex.current++;
        }
        return courseColorMap.current.get(courseCode)!;
    };

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
            professor: section.instructor || '',
            recurrence_pattern: 'weekly' as const,
            theme: courseColor,
            term: selectedTerm,
            tempKey,
        }));
    }, [selectedTerm]);

    const getTermStartDate = (term: string): string => {
        const termMap: { [key: string]: string } = {
            "2025 Fall Term": "2025-09-03",
            "2026 Winter Term": "2026-01-12",
            "2025 Spring/Summer Term": "2025-05-06"
        };
        return termMap[term] || "2025-09-03";
    };

    useEffect(() => {
        if (!isComponentMounted) return;
        const timeoutId = setTimeout(() => {
            const termSelections = selectedSectionEventsByTerm.get(selectedTerm) || new Map();
            setSelectedSectionEvents(termSelections);
            if (isMobile && coursesLoaded) {
                setTimeout(() => fetchCalendarEventsForMobile(), 300);
            }
            if (isManualTermChange) {
                const newDate = getTermStartDate(selectedTerm);
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('navigateCalendar', { detail: { date: newDate } }));
                }, 150);
                setIsManualTermChange(false);
            }
        }, 100);
        return () => clearTimeout(timeoutId);
    }, [selectedTerm, isComponentMounted, isManualTermChange]);

    useEffect(() => {
        const isMob = isDeviceMobileFn();
        setIsMobile(isMob);
        if (isMob) fetchCalendarEventsForMobile();
        const handleResize = () => {
            const isMob = isDeviceMobileFn();
            setIsMobile(isMob);
            if (isMob) fetchCalendarEventsForMobile();
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        setIsComponentMounted(true);
        if (!isAuthenticated()) {
            setTimeout(() => setShowWelcomeModal(true), 500);
        }
    }, []);

    useEffect(() => {
        const initialDate = getTermStartDate(selectedTerm);
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('navigateCalendar', { detail: { date: initialDate } }));
        }, 200);
    }, []);

    useEffect(() => {
        const loadCourses = async () => {
            try {
                setIsLoadingCourses(true);
                setCoursesLoaded(false);
                const courseData = await loadCoursesForTerm(selectedTerm);
                setLocalCourses(courseData);
                setCourses(courseData);
                setCacheStatus(getCacheStatus());
                setAddedCourses([]);
            } catch (error) {
                console.error(`Failed to load courses for ${selectedTerm}:`, error);
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

    useEffect(() => {
        startAutoRefresh();
        setCacheStatus(getCacheStatus());
        const statusInterval = setInterval(() => {
            setCacheStatus(getCacheStatus());
        }, 5 * 60 * 1000);
        return () => clearInterval(statusInterval);
    }, []);

    useEffect(() => {
        const handleMobileForceRemoveEvents = (event: any) => {
            if (!isMobile) return;
            const { eventIds } = event.detail;
            if (!eventIds || eventIds.length === 0) return;
            setCalendarEvents(prev => prev.filter(e => e.id && !eventIds.includes(e.id)));
        };
        window.addEventListener('forceRemoveEvents', handleMobileForceRemoveEvents);
        return () => window.removeEventListener('forceRemoveEvents', handleMobileForceRemoveEvents);
    }, [isMobile]);

    // Listen for bulk calendar deletions and uncheck Kairoll checkboxes
    useEffect(() => {
        const handleBulkDeletion = (event: any) => {
            const { courseCode, deletedCount } = event.detail;
            
            if (deletedCount > 0) {
                // Clear the course from pendingAdditions to uncheck its checkbox
                if (courseCode && courseCode !== 'ALL') {
                    setPendingAdditions(prev => {
                        const newMap = new Map(prev);
                        // Remove any key that includes this course code
                        for (const [key] of newMap) {
                            if (key.includes(courseCode)) {
                                newMap.delete(key);
                            }
                        }
                        return newMap;
                    });
                } else if (courseCode === 'ALL') {
                    // Clear all checkboxes if all courses were deleted
                    setPendingAdditions(new Map());
                    setSelectedSectionEvents(new Map());
                    setSelectedSectionEventsByTerm(new Map());
                }
            }
        };
        
        window.addEventListener('bulkCalendarDeletion', handleBulkDeletion);
        return () => window.removeEventListener('bulkCalendarDeletion', handleBulkDeletion);
    }, []);

    const filteredCourses = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase().trim();
        const queryNoSpaces = query.replace(/\s+/g, '');
        const results = localCourses.filter((course: CourseGroupedType) => {
            const code = course.courseCode.toLowerCase();
            const codeNoSpaces = code.replace(/\s+/g, '');
            if (codeNoSpaces.includes(queryNoSpaces) || code.includes(query)) return true;
            if (course.courseTitle.toLowerCase().includes(query)) return true;
            return Object.values(course.sectionGroups).some((sectionGroup: any) => {
                return sectionGroup.lecture?.instructor?.toLowerCase().includes(query) ||
                    sectionGroup.labs?.some((lab: any) => lab.instructor?.toLowerCase().includes(query)) ||
                    sectionGroup.tutorials?.some((tut: any) => tut.instructor?.toLowerCase().includes(query));
            });
        });
        results.sort((a, b) => {
            const aCode = a.courseCode.toLowerCase().replace(/\s+/g, '');
            const bCode = b.courseCode.toLowerCase().replace(/\s+/g, '');
            if (aCode === queryNoSpaces && bCode !== queryNoSpaces) return -1;
            if (bCode === queryNoSpaces && aCode !== queryNoSpaces) return 1;
            if (aCode.startsWith(queryNoSpaces) && !bCode.startsWith(queryNoSpaces)) return -1;
            if (bCode.startsWith(queryNoSpaces) && !aCode.startsWith(queryNoSpaces)) return 1;
            return aCode.localeCompare(bCode);
        });
        return isMobile ? results.slice(0, 5) : results;
    }, [searchQuery, localCourses, isMobile]);

    const handleAddCourse = useCallback((course: Course) => {
        const courseId = isCourseGroupedFn(course) ? course.courseCode : (course as CourseLegacy).id;
        if (!addedCourses.find(c => (isCourseGroupedFn(c) ? c.courseCode : (c as CourseLegacy).id) === courseId)) {
            setAddedCourses(prev => [...prev, course]);
        }
    }, [addedCourses]);

    const handleRemoveCourse = useCallback((courseId: string) => {
        setAddedCourses(prev => prev.filter(course => (isCourseGroupedFn(course) ? course.courseCode : (course as CourseLegacy).id) !== courseId));
    }, []);

    const handleResetCourses = useCallback(async () => {
        const confirmed = window.confirm('Are you sure you want to remove all courses from your calendar? This action cannot be undone.');
        if (!confirmed) return;

        let allServerEvents: any[] = [];
        try {
            allServerEvents = await getCalendarEvents();
        } catch (error) {
            console.error('Error fetching calendar events:', error);
        }

        const allEventIds: number[] = [];
        selectedSectionEvents.forEach((eventIds) => {
            allEventIds.push(...eventIds);
        });
        const localIds = new Set(allEventIds);
        allServerEvents.forEach((event) => {
            if (event.id && !localIds.has(event.id)) {
                allEventIds.push(event.id);
            }
        });

        if (allEventIds.length > 0) {
            window.dispatchEvent(new CustomEvent('forceRemoveEvents', {
                detail: { eventIds: allEventIds, resetFlag: true }
            }));

            for (const eventId of allEventIds) {
                try {
                    await deleteCalendarEvent(eventId);
                    window.dispatchEvent(new CustomEvent('calendarEventDeleted', { detail: { eventId } }));
                } catch (error) {
                    console.error(`Failed to delete event ID ${eventId}:`, error);
                }
            }
        } else {
            window.dispatchEvent(new CustomEvent('forceRemoveEvents', { detail: { eventIds: [], resetFlag: true } }));
        }

        if (isMobile) {
            setSelectedSectionEvents(new Map());
            const updatedByTerm = new Map(selectedSectionEventsByTerm);
            updatedByTerm.set(selectedTerm, new Map());
            setSelectedSectionEventsByTerm(updatedByTerm);
        } else {
            setSelectedSectionEvents(new Map());
            setSelectedSectionEventsByTerm(new Map());
        }

        setAddedCourses([]);
        setPendingAdditions(new Map());
        setSearchQuery('');

        if (allEventIds.length > 0) {
            window.dispatchEvent(new CustomEvent('kairollDeletion', {
                detail: { action: 'RESET_ALL', type: 'all', count: allEventIds.length }
            }));
        }
        window.dispatchEvent(new CustomEvent('forceCalendarRefresh'));
        fetchCalendarEventsForMobile();
    }, [isMobile, selectedSectionEvents, selectedSectionEventsByTerm, selectedTerm, fetchCalendarEventsForMobile]);

    const createCalendarEventFromSection = useCallback(async (section: any, tempKey?: string): Promise<{ eventIds: number[]; createdEvents: any[] }> => {
        try {
            const eventIds: number[] = [];
            const createdEventsForUi: any[] = [];
            const courseCode = section.courseCode;
            const courseColor = getCourseColor(courseCode);

            const parseAllTimeSlots = (timeStr: string) => {
                const timeSlots = timeStr.split(',').map(slot => slot.trim());
                const parsedSlots = [];
                for (const slot of timeSlots) {
                    const timeMatch = slot.match(/(\w+)\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
                    if (timeMatch) {
                        parsedSlots.push({ day: timeMatch[1], startTime: timeMatch[2], endTime: timeMatch[3] });
                    }
                }
                return parsedSlots;
            };

            const timeSlots = parseAllTimeSlots(section.time);
            if (timeSlots.length === 0) return { eventIds: [], createdEvents: [] };

            const dayMap: { [key: string]: string } = {
                'Mo': 'Monday', 'Tu': 'Tuesday', 'We': 'Wednesday', 'Th': 'Thursday', 'Fr': 'Friday', 'Sa': 'Saturday', 'Su': 'Sunday'
            };

            const getSemesterDates = (term: string) => {
                const semesterMap: { [key: string]: { start: string, end: string } } = {
                    "2025 Fall Term": { start: "2025-09-03", end: "2025-12-03" },
                    "2026 Winter Term": { start: "2026-01-12", end: "2026-04-15" },
                    "2025 Spring/Summer Term": { start: "2025-05-06", end: "2025-08-15" }
                };
                return semesterMap[term] || { start: "2025-09-03", end: "2025-12-03" };
            };

            const semesterFallback = getSemesterDates(selectedTerm);
            const courseDates = {
                start: section.meetingStartDate || semesterFallback.start,
                end: section.meetingEndDate || semesterFallback.end
            };

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
            } catch { }

            const timesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
                const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
                const aS = toMin(aStart), aE = toMin(aEnd), bS = toMin(bStart), bE = toMin(bEnd);
                return !(aE <= bS || aS >= bE);
            };

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
                        professor: section.instructor,
                        theme: courseColor,
                        term: selectedTerm,
                    }
                };
            }).filter(Boolean) as Array<{ dayOfWeek: string; rawDay: string; eventData: any }>;

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
                        theme: pl.eventData.theme,
                        term: selectedTerm,
                    });
                }
            }

            return { eventIds, createdEvents: createdEventsForUi };
        } catch (error) {
            console.error('Error creating calendar events:', error);
            return { eventIds: [], createdEvents: [] };
        }
    }, [selectedTerm]);

    const handleSectionToggle = useCallback(async (section: any, isSelected: boolean) => {
        const sectionKey = section.uniqueKey || section.code;

        if (isSelected) {
            if (pendingAdditions.has(sectionKey)) return;
            if (selectedSectionEvents.has(sectionKey)) return;

            const tempKey = `temp-${sectionKey}-${Date.now()}`;
            const tempEvents = buildTempEventsFromSection(section, tempKey);
            if (tempEvents.length > 0) {
                window.dispatchEvent(new CustomEvent('forceAddEvents', { detail: { events: tempEvents } }));
                setPendingAdditions(prev => {
                    const next = new Map(prev);
                    next.set(sectionKey, tempKey);
                    return next;
                });
                React.startTransition(() => {
                    setSelectedSectionEvents(prev => new Map(prev).set(sectionKey, []));
                    const updatedByTerm = new Map(selectedSectionEventsByTerm);
                    const currentTermMap = updatedByTerm.get(selectedTerm) || new Map();
                    currentTermMap.set(sectionKey, []);
                    updatedByTerm.set(selectedTerm, currentTermMap);
                    setSelectedSectionEventsByTerm(updatedByTerm);
                });
            }

            const { eventIds, createdEvents } = await createCalendarEventFromSection(section, tempKey);
            if (eventIds.length > 0) {
                window.dispatchEvent(new CustomEvent('replaceTempEvents', { detail: { tempKey, createdEvents } }));
                React.startTransition(() => {
                    setSelectedSectionEvents(prev => new Map(prev).set(sectionKey, eventIds));
                    const updatedByTerm = new Map(selectedSectionEventsByTerm);
                    const currentTermMap = updatedByTerm.get(selectedTerm) || new Map();
                    currentTermMap.set(sectionKey, eventIds);
                    updatedByTerm.set(selectedTerm, currentTermMap);
                    setSelectedSectionEventsByTerm(updatedByTerm);
                    setPendingAdditions(prev => { const next = new Map(prev); next.delete(sectionKey); return next; });
                });
                if (!isMobile) {
                    window.dispatchEvent(new CustomEvent('refreshCalendar'));
                }
                if (isMobile) {
                    fetchCalendarEventsForMobileDebounced();
                }
            } else {
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
            const eventIds = selectedSectionEvents.get(sectionKey);
            const pendingKey = pendingAdditions.get(sectionKey);

            if (!eventIds && !pendingKey) return;

            if (eventIds && eventIds.length > 0) {
                setSelectedSectionEvents(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(sectionKey);
                    return newMap;
                });

                const updatedByTerm = new Map(selectedSectionEventsByTerm);
                const currentTermMap = updatedByTerm.get(selectedTerm) || new Map();
                currentTermMap.delete(sectionKey);
                updatedByTerm.set(selectedTerm, currentTermMap);
                setSelectedSectionEventsByTerm(updatedByTerm);

                window.dispatchEvent(new CustomEvent('forceRemoveEvents', { detail: { eventIds } }));

                if (isMobile) {
                    setCalendarEvents(prev => prev.filter(e => e.id && !eventIds.includes(e.id)));
                    setPendingAdditions(prev => { const next = new Map(prev); next.delete(sectionKey); return next; });
                }

                const performBackgroundDeletion = async () => {
                    await Promise.all(eventIds.map(async (eventId) => {
                        let attempts = 0;
                        const maxAttempts = 2;
                        while (attempts < maxAttempts) {
                            try {
                                await deleteCalendarEvent(eventId);
                                break;
                            } catch (error) {
                                attempts++;
                                if (attempts < maxAttempts) {
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                }
                            }
                        }
                    }));
                };

                performBackgroundDeletion().then(() => {
                    if (isMobile) {
                        setTimeout(() => fetchCalendarEventsForMobileDebounced(), 200);
                    }
                });
            }

            const pendingTempKey = pendingAdditions.get(sectionKey);
            if (pendingTempKey) {
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
    }, [selectedSectionEvents, selectedSectionEventsByTerm, selectedTerm, createCalendarEventFromSection, fetchCalendarEventsForMobile, isMobile, pendingAdditions, buildTempEventsFromSection, fetchCalendarEventsForMobileDebounced]);

    const handleManualRefresh = async () => {
        await refreshAllCourseData();
        setCacheStatus(getCacheStatus());
    };

    return (
        <div className="font-mono w-full bg-cream dark:bg-[rgb(var(--secondary-bg))] text-black dark:text-[rgb(var(--text-primary))] flex flex-col h-full transition-colors duration-300">
            {/* Header */}
            <div className={`w-full p-4 sm:p-5 lg:p-6 border-b border-gray-200 dark:border-[rgb(var(--border-color))] transition-colors duration-300 ${isDeviceMobileFn() ? 'overflow-hidden' : ''}`}>
                <h1 className="text-base sm:text-lg lg:text-xl font-bold text-black dark:text-[rgb(var(--text-primary))] mb-3 sm:mb-4 transition-colors duration-300">Course Enrollment</h1>

                {/* Term Selector */}
                <div className="w-full mb-3 sm:mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Academic Term</label>
                    <select
                        value={selectedTerm}
                        onChange={(e) => {
                            setIsManualTermChange(true);
                            setSelectedTerm(e.target.value);
                        }}
                        className="w-full bg-gray-100 dark:bg-[rgb(var(--card-bg))] border border-gray-200 dark:border-[rgb(var(--border-color))] rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-black dark:text-[rgb(var(--text-primary))] focus:ring-2 focus:ring-[rgb(var(--accent-color))] focus:border-[rgb(var(--accent-color))] appearance-none transition-colors duration-300"
                    >
                        {terms.map(term => (
                            <option key={term} value={term} className="bg-cream dark:bg-gray-800 text-black dark:text-white">{term}</option>
                        ))}
                    </select>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <div className="sm:hidden">📅 {getTermStartDate(selectedTerm)}</div>
                        <div className="hidden sm:block">
                            Calendar will navigate to: {getTermStartDate(selectedTerm)}
                            {cacheStatus[selectedTerm] && <span className="ml-2">| {cacheStatus[selectedTerm].courseCount} courses available</span>}
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="w-full mb-4 sm:mb-6">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search for courses, professors, and course codes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-cream/[0.06] border border-gray-200 dark:border-white/10 rounded-lg px-3 sm:px-4 py-2 sm:py-3 pr-10 text-sm sm:text-base text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-300"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                                title="Clear search"
                            >✕</button>
                        )}
                    </div>
                    {searchQuery && (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {isLoadingCourses ? 'Searching...' : (
                                <>
                                    {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} found
                                    {isMobile && filteredCourses.length > 5 && <span className="text-orange-500 dark:text-orange-400 ml-2">(showing first 5 on mobile)</span>}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="w-full flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                        onClick={() => setSearchQuery('')}
                        disabled={!searchQuery}
                        className="flex-1 bg-gray-100 dark:bg-cream/[0.06] hover:bg-gray-200 dark:hover:bg-cream/[0.12] border border-gray-200 dark:border-white/10 text-black dark:text-white px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >Clear Search</button>
                    <button
                        onClick={handleResetCourses}
                        className="flex-1 bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 hover:from-gray-400 hover:via-gray-300 hover:to-gray-400 dark:hover:from-slate-700 dark:hover:via-slate-600 dark:hover:to-slate-700 text-black dark:text-white px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm sm:text-base relative overflow-hidden group border border-gray-400/30 dark:border-slate-600/30"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-gray-500/0 via-gray-400/20 to-gray-500/0 dark:from-slate-600/0 dark:via-slate-400/20 dark:to-slate-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative flex items-center gap-2"><span className="font-medium">RESET ALL</span></div>
                    </button>
                </div>
            </div>

            {/* Course List */}
            <div className={`flex flex-col w-full ${isMobile ? '' : 'flex-1 min-h-0 course-list-container'}`}>
                <div className={`w-full p-4 sm:p-5 lg:p-6 ${isMobile ? 'border-b border-gray-200 dark:border-white/10 transition-colors duration-300' : ''}`}>
                    <div className="w-full space-y-4">
                        {searchQuery.trim() !== '' && (
                            <>
                                {(isMobile ? filteredCourses.slice(0, 5) : filteredCourses).map((course: CourseGroupedType) => (
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
                                        <div className="mb-2 text-sm sm:text-base">No courses found matching &quot;{searchQuery}&quot;</div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500">Try searching by course code (e.g., &quot;ITI1120&quot;), title, or instructor name</div>
                                    </div>
                                )}
                            </>
                        )}
                        {searchQuery.trim() === '' && (
                            <div className="text-center py-12 flex flex-col items-center justify-center h-full opacity-70">
                                <ClipboardList className="w-8 h-8 sm:w-12 sm:h-12 mb-3 text-gray-300 dark:text-gray-600" strokeWidth={1} />
                                <h3 className="text-base sm:text-lg font-medium text-gray-600 dark:text-gray-300">Plan Your Semester</h3>
                                <p className="mt-2 max-w-sm sm:max-w-md text-sm sm:text-base text-gray-500 dark:text-gray-400">Search for courses by code, title, or professor to add them to your schedule.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Weekly Schedule - Mobile Only */}
                <div className="flex-1 w-full p-4 sm:p-5 lg:p-6">
                    {isMobile && (
                        <div className="w-full flex items-center justify-between mb-4">
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
                                <div className="flex items-center text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-1">{uniqueCourseCount} courses</div>
                                {uniqueCourseCount > 0 && (
                                    <button
                                        onClick={async () => {
                                            try {
                                                let allEvents = await persistentCalendarService.loadUserCalendar();
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
                                                    } catch { }
                                                }
                                                if (!hasEventsToExport(allEvents)) {
                                                    alert('No events available to export');
                                                    return;
                                                }
                                                try {
                                                    await exportCalendarForMobile(allEvents, 'kairoschedule', selectedTerm);
                                                } catch (mobileErr) {
                                                    console.warn('Mobile export failed, falling back to server ICS:', mobileErr);
                                                    await exportCalendarAsICS(allEvents, 'kairoschedule', selectedTerm);
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
                        <div className="w-full bg-cream dark:bg-gradient-to-b dark:from-[#111111] dark:to-[#0f0f0f] rounded-lg border border-gray-200 dark:border-white/5 dark:shadow-[0_0_4px_rgba(255,255,255,0.05)]">
                            <div className="no-scrollbar">
                                <div className="overflow-x-auto">
                                    {/* Day Headers */}
                                    <div className="bg-gray-50 dark:bg-gradient-to-b dark:from-[#1e1e1e] dark:to-[#1a1a1a] border-b border-gray-200 dark:border-white/5">
                                        <div className="flex gap-0 w-full">
                                            <div className="p-2 text-xs font-medium text-gray-500 dark:text-[#aaaaaa] bg-gray-50 dark:bg-[#1e1e1e] border-r border-gray-200 dark:border-white/5 flex-shrink-0 w-[60px]">Time</div>
                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                                <div key={day} className="flex-1 p-2 text-sm font-medium text-center text-gray-700 dark:text-[#e0e0e0] bg-gray-50 dark:bg-[#1e1e1e] border-r border-gray-200 dark:border-white/5 last:border-r-0">{day}</div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Time Grid */}
                                    <div className="relative">
                                        {Array.from({ length: 15 }, (_, i) => {
                                            const hour = i + 8;
                                            const timeStr = hour > 12 ? `${hour - 12}:00` : `${hour}:00`;
                                            const period = hour >= 12 ? 'PM' : 'AM';
                                            return (
                                                <div key={hour} className="flex border-b border-gray-200 dark:border-white/5 bg-cream dark:bg-[#121212] w-full" style={{ height: '48px' }}>
                                                    <div className="p-1 text-xs text-black dark:text-[#aaaaaa] bg-cream dark:bg-[#121212] border-r border-gray-200 dark:border-white/5 flex items-center justify-center flex-shrink-0 w-[60px]">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-xs font-medium">{timeStr}</span>
                                                            <span className="text-[10px] text-gray-700 dark:text-gray-500">{period}</span>
                                                        </div>
                                                    </div>
                                                    {[0, 1, 2, 3, 4, 5].map((dayIndex) => (
                                                        <div key={dayIndex} className="flex-1 border-r border-gray-200 dark:border-gray-800 last:border-r-0" />
                                                    ))}
                                                </div>
                                            );
                                        })}

                                        {/* Events */}
                                        {calendarEvents.map((event, index) => {
                                            if (!event.day_of_week || !event.startTime || !event.endTime) return null;
                                            const top = timeToPosition(event.startTime);
                                            const bottom = timeToPosition(event.endTime);
                                            const height = bottom - top;
                                            const dayShorthand = event.day_of_week.substring(0, 3);
                                            const colIndex = dayToIndex(dayShorthand);
                                            if (colIndex === -1) return null;
                                            const theme = EVENT_THEMES[event.theme as keyof typeof EVENT_THEMES] || EVENT_THEMES['blue-gradient'];
                                            if (!theme) return null;
                                            const titleMatch = event.title.match(/([A-Z]{3}\s\d{4})\s\((.*?)\)/);
                                            const courseCode = titleMatch ? titleMatch[1] : event.title.split('(')[0].trim();
                                            const sectionType = titleMatch ? titleMatch[2] : '';
                                            const professor = event.professor || '';

                                            return (
                                                <div
                                                    key={event.id || index}
                                                    className={`absolute rounded-md p-1.5 text-white overflow-hidden leading-tight cursor-pointer transition-all duration-200 bg-gradient-to-r ${theme.bg}`}
                                                    style={{
                                                        top: `${top}px`,
                                                        left: `calc(60px + ${colIndex * 16.666}%)`,
                                                        height: `${height}px`,
                                                        width: `calc(16.666% - 4px)`,
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                                        border: '1px solid rgba(255,255,255,0.15)',
                                                    }}
                                                    onClick={(e) => handleMobileEventClick(event, e)}
                                                    onTouchEnd={(e) => { e.preventDefault(); handleMobileEventClick(event, e); }}
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
        </div>
    );
}

export default KairollComponent;

