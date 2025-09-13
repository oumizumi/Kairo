import React, { useState, useEffect, useMemo } from 'react';
import { format, addWeeks, subWeeks, parseISO, startOfWeek, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Trash2, Calendar, Edit3, X, Sparkles, Plus, Palette, Download, Share2, Clipboard } from 'lucide-react';
import { APP_CONFIG } from '@/config/app.config';
import { useTheme } from '@/components/ThemeProvider';
import { getCalendarEvents, CalendarEvent as APICalendarEvent } from '@/lib/api';
import { loadCoursesForTerm } from '@/services/courseDataService';
import CounterBadge from './CounterBadge';
import { exportCalendarAsICS, hasEventsToExport } from '@/services/icsExportService';
import DownloadScheduleModal from './DownloadScheduleModal';
import { shareSchedule, generateShareableSchedule, copyToClipboard, hasScheduleContent, getSharedSchedule } from '@/services/scheduleShareService';
import { EVENT_THEMES } from '@/config/eventThemes';

// Using unified event themes from config

interface Event {
    id?: number;
    startTime: string; // e.g., "09:30"
    endTime: string;   // e.g., "10:45"
    title: string;
    day_of_week?: string; // e.g., "Monday" - for recurring weekly events
    start_date?: string;  // e.g., "2025-06-04" - for specific date events
    end_date?: string;    // e.g., "2025-06-04" - for specific date events
    description?: string;
    professor?: string;   // Professor name field
    recurrence_pattern?: 'weekly' | 'biweekly' | 'none'; // Recurrence pattern
    reference_date?: string; // Reference date for bi-weekly calculation
    theme?: string; // Event color theme
}

interface EditEventModalProps {
    event: Event | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedEvent: Event) => void;
    isCreating?: boolean;
    allEvents?: Event[];
    onDeleteEvent?: (eventId: number) => void;
    onAddEvent?: (newEvent: Event) => void;
}

interface SwapCourseModalProps {
    event: Event | null;
    isOpen: boolean;
    onClose: () => void;
    onSwap: (newEvent: Event) => void;
    allEvents?: Event[];
    onDeleteEvent?: (eventId: number) => void;
    onAddEvent?: (newEvent: Event) => void;
}

const EditEventModal: React.FC<EditEventModalProps> = ({ event, isOpen, onClose, onSave, isCreating = false, allEvents = [], onDeleteEvent, onAddEvent }: EditEventModalProps) => {
    const [title, setTitle] = useState(event?.title || '');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [dayOfWeek, setDayOfWeek] = useState(event?.day_of_week || 'Monday');
    const [description, setDescription] = useState(event?.description || '');
    const [professor, setProfessor] = useState(event?.professor || '');
    const [eventType, setEventType] = useState<'recurring' | 'biweekly' | 'specific'>('recurring');
    const [specificDate, setSpecificDate] = useState('');
    const [selectedTheme, setSelectedTheme] = useState(event?.theme || 'lavender-peach');


    useEffect(() => {
        if (event && isOpen) {
            setTitle(event.title);
            setDescription(event.description || '');
            setProfessor(event.professor || '');
            setDayOfWeek(event.day_of_week || 'Monday');
            setSelectedTheme(event.theme || 'lavender-peach');

            // Set start and end times directly in 24-hour format
            setStartTime(event.startTime);
            setEndTime(event.endTime);

            // Determine event type based on existing data
            if (event.start_date) {
                setEventType('specific');
                setSpecificDate(event.start_date);
            } else if (event.recurrence_pattern === 'biweekly') {
                setEventType('biweekly');
                setSpecificDate(event.reference_date || '');
            } else {
                setEventType('recurring');
            }
        } else if (isCreating && isOpen) {
            // Reset form for creating new event
            setTitle('');
            setDescription('');
            setProfessor('');
            setDayOfWeek('Monday');
            setEventType('recurring');
            // Only set date for specific event types
            setSpecificDate('');
            setStartTime('09:00');
            setEndTime('10:00');
            setSelectedTheme('lavender-peach');
        }
    }, [event, isOpen, isCreating]);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const updatedEvent: Event = {
            id: isCreating ? undefined : event?.id,
            title,
            startTime,
            endTime,
            description,
            professor,
            theme: selectedTheme,
        };

        // Set event type specific fields
        if (eventType === 'recurring') {
            updatedEvent.day_of_week = dayOfWeek;
            updatedEvent.recurrence_pattern = 'weekly';
        } else if (eventType === 'biweekly') {
            updatedEvent.day_of_week = dayOfWeek;
            updatedEvent.recurrence_pattern = 'biweekly';
            updatedEvent.reference_date = specificDate;
        } else {
            updatedEvent.start_date = specificDate;
            updatedEvent.end_date = specificDate;
            updatedEvent.recurrence_pattern = 'none';
        }

        onSave(updatedEvent);
        onClose();
    };



    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-1 sm:p-2 lg:p-3">
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-lg sm:rounded-xl lg:rounded-2xl shadow-2xl w-full max-w-[260px] sm:max-w-[320px] md:max-w-sm lg:max-w-md xl:max-w-lg max-h-[80vh] border-2 border-purple-300 dark:border-purple-600 animate-vibrant-glow overflow-y-auto">
                <form onSubmit={handleSubmit} className="p-1.5 sm:p-2.5 lg:p-3.5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2 sm:mb-3 lg:mb-4">
                        <h3 className="text-sm sm:text-base lg:text-lg font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
                            {isCreating ? 'Add New Event' : 'Edit Event'}
                        </h3>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 sm:p-1.5 lg:p-2 text-purple-400 hover:text-purple-600 dark:text-purple-300 dark:hover:text-purple-100 rounded hover:bg-purple-100 dark:hover:bg-purple-800/50 transition-all duration-300"
                        >
                            <X className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
                        </button>
                    </div>

                    {/* Main Content - Responsive Vertical Layout */}
                    <div className="space-y-1 sm:space-y-1.5 lg:space-y-2">
                        <div>
                            <label className="block text-xs sm:text-sm lg:text-base font-medium text-purple-700 dark:text-purple-300 mb-0.5 sm:mb-1">
                                Event Title
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                                className="w-full px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 border-2 border-purple-300 dark:border-purple-600 rounded sm:rounded-md lg:rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:focus:border-purple-400 bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white transition-all duration-300 backdrop-blur-sm text-xs sm:text-sm lg:text-base"
                                placeholder="Enter event title"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm lg:text-base font-medium text-purple-700 dark:text-purple-300 mb-0.5 sm:mb-1">
                                Professor (Optional)
                            </label>
                            <input
                                type="text"
                                value={professor}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfessor(e.target.value)}
                                className="w-full px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 border-2 border-purple-300 dark:border-purple-600 rounded sm:rounded-md lg:rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:focus:border-purple-400 bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white transition-all duration-300 backdrop-blur-sm text-xs sm:text-sm lg:text-base"
                                placeholder="Enter professor name"
                            />
                        </div>



                        <div>
                            <label className="block text-xs sm:text-sm lg:text-base font-medium text-purple-700 dark:text-purple-300 mb-0.5 sm:mb-1 flex items-center gap-1 sm:gap-2">
                                <Palette className="w-3 h-3 sm:w-4 sm:h-4" />
                                Event Theme
                            </label>
                            <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
                                {Object.entries(EVENT_THEMES).map(([themeKey, theme]) => (
                                    <button
                                        key={themeKey}
                                        type="button"
                                        onClick={() => setSelectedTheme(themeKey)}
                                        className={`
                                            group relative aspect-square rounded-full ${theme.preview} transition-all duration-200 ease-out overflow-hidden
                                            ${selectedTheme === themeKey
                                                ? 'ring-3 ring-purple-500 dark:ring-purple-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 scale-110 shadow-lg'
                                                : 'ring-2 ring-gray-200 dark:ring-gray-700 hover:ring-gray-300 dark:hover:ring-gray-600 hover:scale-105 shadow-sm'
                                            }
                                        `}
                                        title={theme.name}
                                    >
                                        {/* Gradient overlay for depth */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50"></div>

                                        {/* Selection indicator */}
                                        {selectedTheme === themeKey && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full shadow-md flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-500 rounded-full"></div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Hover effect */}
                                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm lg:text-base font-medium text-gray-700 dark:text-gray-300 mb-0.5 sm:mb-1">
                                Event Type
                            </label>
                            <select
                                value={eventType}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEventType(e.target.value as 'recurring' | 'biweekly' | 'specific')}
                                className="w-full px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 border-2 border-purple-300 dark:border-purple-600 rounded sm:rounded-md lg:rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:focus:border-purple-400 bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white transition-all duration-300 backdrop-blur-sm text-xs sm:text-sm lg:text-base"
                            >
                                <option value="recurring">Weekly (Every Week)</option>
                                <option value="biweekly">Bi-weekly (Every Other Week)</option>
                                <option value="specific">One-Time Event</option>
                            </select>
                        </div>

                        {(eventType === 'recurring' || eventType === 'biweekly') ? (
                            <div>
                                <label className="block text-xs sm:text-sm lg:text-base font-medium text-purple-700 dark:text-purple-300 mb-1 sm:mb-2">
                                    Day of Week
                                </label>
                                <select
                                    value={dayOfWeek}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDayOfWeek(e.target.value)}
                                    className="w-full px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 border-2 border-purple-300 dark:border-purple-600 rounded sm:rounded-md lg:rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:focus:border-purple-400 bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white transition-all duration-300 backdrop-blur-sm text-xs sm:text-sm lg:text-base"
                                >
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                                        <option key={day} value={day}>{day}</option>
                                    ))}
                                </select>
                            </div>
                        ) : null}

                        {eventType === 'biweekly' && (
                            <div>
                                <label className="block text-xs sm:text-sm lg:text-base font-medium text-purple-700 dark:text-purple-300 mb-1 sm:mb-2">
                                    Starting Date (Reference)
                                </label>
                                <input
                                    type="date"
                                    value={specificDate}
                                    onChange={(e) => setSpecificDate(e.target.value)}
                                    className="w-full px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 border-2 border-purple-300 dark:border-purple-600 rounded sm:rounded-md lg:rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:focus:border-purple-400 bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white transition-all duration-300 backdrop-blur-sm text-xs sm:text-sm lg:text-base"
                                    required
                                />
                                <p className="text-xs sm:text-sm text-purple-600 dark:text-purple-400 mt-0.5 sm:mt-1">
                                    Repeats every other week from this date
                                </p>
                            </div>
                        )}

                        {eventType === 'specific' && (
                            <div>
                                <label className="block text-xs sm:text-sm lg:text-base font-medium text-purple-700 dark:text-purple-300 mb-1 sm:mb-2">
                                    Specific Date
                                </label>
                                <input
                                    type="date"
                                    value={specificDate}
                                    onChange={(e) => setSpecificDate(e.target.value)}
                                    className="w-full px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 border-2 border-purple-300 dark:border-purple-600 rounded sm:rounded-md lg:rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 dark:focus:border-purple-400 bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white transition-all duration-300 backdrop-blur-sm text-xs sm:text-sm lg:text-base"
                                    required
                                />
                            </div>
                        )}

                        {/* Time Inputs */}
                        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
                            <div>
                                <label className="block text-xs sm:text-sm lg:text-base font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                                    Start Time
                                </label>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartTime(e.target.value)}
                                    className="w-full px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 border border-gray-300 dark:border-gray-600 rounded sm:rounded-md lg:rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white text-xs sm:text-sm lg:text-base"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm lg:text-base font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                                    End Time
                                </label>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndTime(e.target.value)}
                                    className="w-full px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 border border-gray-300 dark:border-gray-600 rounded sm:rounded-md lg:rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white text-xs sm:text-sm lg:text-base"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm lg:text-base font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                                Description (Optional)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                                className="w-full px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 border border-gray-300 dark:border-gray-600 rounded sm:rounded-md lg:rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white text-xs sm:text-sm lg:text-base"
                                placeholder="Add event description"
                                rows={2}
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 sm:gap-3 lg:gap-4 mt-2 sm:mt-3 lg:mt-4 pt-2 sm:pt-2 lg:pt-3 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 lg:py-2.5 text-purple-700 dark:text-purple-300 bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-800/50 dark:to-purple-700/50 rounded sm:rounded-md lg:rounded-lg hover:from-purple-200 hover:to-purple-300 dark:hover:from-purple-700/70 dark:hover:to-purple-600/70 transition-all duration-300 shadow-sm hover:shadow-md text-xs sm:text-sm lg:text-base"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 lg:py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded sm:rounded-md lg:rounded-lg transition-all duration-300 font-medium group relative overflow-hidden shadow-sm hover:shadow-md transform hover:scale-105 text-xs sm:text-sm lg:text-base"
                        >
                            {/* Animated background */}
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                            {/* Button content */}
                            <div className="relative flex items-center justify-center gap-1 sm:gap-2">
                                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 transition-transform duration-200 group-hover:scale-110" />
                                <span className="relative">{isCreating ? 'Create Event' : 'Save Changes'}</span>
                            </div>
                        </button>
                    </div>
                </form>
            </div>


        </div>
    );
};

// Swap Course Modal for selecting alternative sections
interface SwapCourseModalProps {
    event: Event | null;
    isOpen: boolean;
    onClose: () => void;
    onSwap: (newEvent: Event) => void;
    allEvents?: Event[];
    onDeleteEvent?: (eventId: number) => void;
    onAddEvent?: (newEvent: Event) => void;
}

const SwapCourseModal: React.FC<SwapCourseModalProps> = ({ event, isOpen, onClose, onSwap, allEvents = [], onDeleteEvent, onAddEvent }: SwapCourseModalProps) => {
    const [selectedAlternative, setSelectedAlternative] = useState<any>(null);
    const [alternatives, setAlternatives] = useState<{ [key: string]: any[] }>({});
    const [loading, setLoading] = useState(false);

    // Helper function to find related course events (labs, tutorials, DGDs)
    const findRelatedCourseEvents = (courseCode: string, currentGroupId: string): Event[] => {
        if (!allEvents || !onDeleteEvent) return [];

        const extractCourseCode = (event: Event): string | null => {
            if (event.description) {
                const courseMatch = event.description.match(/Course:\s*([A-Z]{3}\s*\d{4})/i);
                if (courseMatch) {
                    return courseMatch[1].trim();
                }
            }
            if (event.title) {
                const titleMatch = event.title.match(/([A-Z]{3}\s*\d{4})/);
                if (titleMatch) {
                    return titleMatch[1].trim();
                }
            }
            return null;
        };

        const extractSectionInfo = (event: Event) => {
            if (!event.description) return null;

            const sectionMatch = event.description.match(/Section:\s*([^\n\r]+)/i);
            const typeMatch = event.description.match(/Type:\s*([^\n\r]+)/i);

            if (sectionMatch) {
                const section = sectionMatch[1].trim();
                const groupMatch = section.match(/^([A-Z])/);
                const sectionType = typeMatch ? typeMatch[1].trim() : section.split('-')[1];

                return {
                    section,
                    groupId: groupMatch ? groupMatch[1] : null,
                    type: sectionType
                };
            }
            return null;
        };

        return allEvents.filter(event => {
            const eventCourseCode = extractCourseCode(event);
            if (!eventCourseCode || eventCourseCode !== courseCode) return false;

            const sectionInfo = extractSectionInfo(event);
            if (!sectionInfo) return false;

            // Find non-lecture sections from the same group
            return sectionInfo.groupId === currentGroupId &&
                sectionInfo.type !== 'LEC' &&
                ['LAB', 'TUT', 'DGD'].includes(sectionInfo.type);
        });
    };

    // Extract course information from event
    const extractCourseInfo = (event: Event) => {
        if (!event) return null;

        let courseCode = '';
        let currentSection = '';
        let currentSectionType = '';
        let currentGroupId = '';
        let term = '';

        // Try to extract course code from description
        if (event.description) {
            const courseMatch = event.description.match(/Course:\s*([A-Z]{3}\s*\d{4})/i);
            if (courseMatch) {
                courseCode = courseMatch[1].trim(); // Keep the space for matching
            }

            const sectionMatch = event.description.match(/Section:\s*([^\n\r]+)/i);
            if (sectionMatch) {
                currentSection = sectionMatch[1].trim();
            }

            const typeMatch = event.description.match(/Type:\s*([^\n\r]+)/i);
            if (typeMatch) {
                currentSectionType = typeMatch[1].trim();
            }
        }

        // Fallback: try to extract from title
        if (!courseCode) {
            const titleMatch = event.title.match(/([A-Z]{3}\s*\d{4})/);
            if (titleMatch) {
                courseCode = titleMatch[1].trim();
            }
        }

        // Extract group ID and section type from current section (e.g., "A00-LEC" -> "A" and "LEC")
        if (currentSection) {
            const groupMatch = currentSection.match(/^([A-Z])/);
            if (groupMatch) {
                currentGroupId = groupMatch[1];
            }

            // ALWAYS extract section type from section code 
            const typeMatch = currentSection.match(/-([A-Z]+)$/);
            if (typeMatch) {
                currentSectionType = typeMatch[1];
            }

            // If no type found in section, assume it's a lecture
            if (!currentSectionType && currentSection.match(/^[A-Z]\d+$/)) {
                currentSectionType = 'LEC';
            }
        }

        

        // For now, default to Fall 2025 - this could be made dynamic later
        term = "2025 Fall Term";
        

        return { courseCode, currentSection, currentSectionType, currentGroupId, term };
    };

    // Load alternative sections when modal opens
    useEffect(() => {
        if (isOpen && event) {
            loadAlternativeSections();
        }
    }, [isOpen, event]);

    const loadAlternativeSections = async () => {
        setLoading(true);
        setAlternatives({});

        try {
            if (!event) {
                
                setLoading(false);
                return;
            }

            const courseInfo = extractCourseInfo(event);

            if (!courseInfo?.courseCode) {
                
                setLoading(false);
                return;
            }

            

            // Load real course data using your existing pipeline
            const courses = await loadCoursesForTerm(courseInfo.term);
            

            // Find the specific course
            const targetCourse = courses.find(course =>
                course.courseCode === courseInfo.courseCode
            );

            if (!targetCourse) {
                
                setLoading(false);
                return;
            }

            

            // Extract alternative sections from sectionGroups
            const extractedAlternatives: any[] = [];

            Object.entries(targetCourse.sectionGroups).forEach(([groupId, sectionGroup]: [string, any]) => {
                // Add lecture sections
                if (sectionGroup.lecture) {
                    const lectureSection = {
                        sectionId: sectionGroup.lecture.section,
                        groupId: groupId,
                        instructor: sectionGroup.lecture.instructor,
                        type: 'LEC',
                        time: sectionGroup.lecture.time || 'TBA',
                        days: sectionGroup.lecture.days?.join(', ') || 'TBA',
                        meetingDates: sectionGroup.lecture.meetingDates || 'TBA',
                        status: sectionGroup.lecture.status || 'Unknown'
                    };
                    extractedAlternatives.push(lectureSection);
                }

                // Add lab sections if available
                if (sectionGroup.labs && sectionGroup.labs.length > 0) {
                    sectionGroup.labs.forEach((lab: any) => {
                        extractedAlternatives.push({
                            sectionId: lab.section,
                            groupId: groupId,
                            instructor: lab.instructor,
                            type: 'LAB',
                            time: lab.time || 'TBA',
                            days: lab.days?.join(', ') || 'TBA',
                            meetingDates: lab.meetingDates || 'TBA',
                            status: lab.status || 'Unknown'
                        });
                    });
                }

                // Add tutorial sections if available
                if (sectionGroup.tutorials && sectionGroup.tutorials.length > 0) {
                    sectionGroup.tutorials.forEach((tutorial: any) => {
                        // Extract actual section type from section code (e.g., "A06-DGD" -> "DGD")
                        const sectionType = tutorial.section.split('-')[1] || 'TUT';

                        extractedAlternatives.push({
                            sectionId: tutorial.section,
                            groupId: groupId,
                            instructor: tutorial.instructor,
                            type: sectionType,
                            time: tutorial.time || 'TBA',
                            days: tutorial.days?.join(', ') || 'TBA',
                            meetingDates: tutorial.meetingDates || 'TBA',
                            status: tutorial.status || 'Unknown'
                        });
                    });
                }
            });

            

            // Filter out current section
            let filteredAlternatives = extractedAlternatives.filter(
                alt => alt.sectionId !== courseInfo.currentSection
            );

            

            // Apply proper filtering based on section type
            if (courseInfo.currentSectionType === 'LEC') {
                // FOR LECTURES: Show all different section alternatives (A00-LEC, B00-LEC, C00-LEC, etc.)
                filteredAlternatives = filteredAlternatives.filter(alt => alt.type === 'LEC');
                
            } else {
                // FOR LAB/DGD/TUT: Show alternatives within the SAME section group only
                // Find which section group this component belongs to
                let currentGroupId = courseInfo.currentGroupId;

                // Double-check by finding the actual group that contains our section
                Object.entries(targetCourse.sectionGroups).forEach(([groupId, sectionGroup]: [string, any]) => {
                    let hasOurSection = false;

                    if (courseInfo.currentSectionType === 'LAB' && sectionGroup.labs) {
                        hasOurSection = sectionGroup.labs.some((lab: any) => lab.section === courseInfo.currentSection);
                    } else if (['DGD', 'TUT'].includes(courseInfo.currentSectionType) && sectionGroup.tutorials) {
                        hasOurSection = sectionGroup.tutorials.some((tutorial: any) => tutorial.section === courseInfo.currentSection);
                    }

                    if (hasOurSection) {
                        currentGroupId = groupId;
                    }
                });

                // Filter to show only the same type from the SAME section group
                filteredAlternatives = filteredAlternatives.filter(
                    alt => alt.groupId === currentGroupId && alt.type === courseInfo.currentSectionType
                );

                
            }

            // Group alternatives by section group (A, B, C, D)
            const groupedAlternatives = filteredAlternatives.reduce((groups, alt) => {
                const group = alt.groupId || 'Other';
                if (!groups[group]) {
                    groups[group] = [];
                }
                groups[group].push(alt);
                return groups;
            }, {} as { [key: string]: any[] });

            
            setAlternatives(groupedAlternatives);

        } catch (error) {
            
        } finally {
            setLoading(false);
        }
    };

    const handleSwap = async () => {
        if (!selectedAlternative || !event) return;

        const courseInfo = extractCourseInfo(event);
        if (!courseInfo) return;

        

        // STEP 1: Always delete the original event (the one we're swapping FROM)
        if (event.id && onDeleteEvent) {
            onDeleteEvent(event.id);
            
        }

        // STEP 2: Handle lecture section changes with automatic component addition
        let autoAddedComponents: Event[] = [];

        if (courseInfo.currentSectionType === 'LEC' &&
            courseInfo.currentGroupId && selectedAlternative.groupId &&
            courseInfo.currentGroupId !== selectedAlternative.groupId) {

            

            // Delete related LAB/DGD/TUT from old section
            const relatedEvents = findRelatedCourseEvents(courseInfo.courseCode, courseInfo.currentGroupId);
            

            if (relatedEvents.length > 0 && onDeleteEvent) {
                relatedEvents.forEach(relatedEvent => {
                    if (relatedEvent.id) {
                        onDeleteEvent(relatedEvent.id);
                        
                    }
                });
                
            } else {
                
            }

            // Automatically add random components from the NEW section
            try {
                const courses = await loadCoursesForTerm(courseInfo.term);
                const targetCourse = courses.find(course => course.courseCode === courseInfo.courseCode);

                if (targetCourse && targetCourse.sectionGroups[selectedAlternative.groupId]) {
                    const newSectionGroup = targetCourse.sectionGroups[selectedAlternative.groupId];

                    // Add random LAB if available (create multiple events for multiple time slots)
                    if (newSectionGroup.labs && newSectionGroup.labs.length > 0) {
                        const randomLab = newSectionGroup.labs[Math.floor(Math.random() * newSectionGroup.labs.length)];
                        const dummyLabEvent: Event = {
                            title: `${courseInfo.courseCode} LAB`,
                            startTime: '09:00',
                            endTime: '10:00',
                            day_of_week: 'Monday',
                            description: '',
                            recurrence_pattern: 'weekly'
                        };

                        const labAlternative = {
                            instructor: randomLab.instructor,
                            sectionId: randomLab.section,
                            type: 'LAB',
                            time: randomLab.time
                        };

                        const labEvents = createEventsFromTimeString(randomLab.time || '', dummyLabEvent, labAlternative);
                        for (const labEvent of labEvents) {
                            const finalLabEvent = {
                                ...labEvent,
                                description: `Course: ${courseInfo.courseCode}\nSection: ${randomLab.section}\nInstructor: ${randomLab.instructor}\nType: LAB\nTime: ${randomLab.time || 'TBA'}`,
                                theme: event.theme || 'default',  // INHERIT theme from original event
                                start_date: undefined,  // ENSURE weekly recurrence
                                end_date: undefined,    // ENSURE weekly recurrence  
                                recurrence_pattern: 'weekly' as const
                            };
                            if (onAddEvent) {
                                onAddEvent(finalLabEvent);
                                autoAddedComponents.push(finalLabEvent);
                                
                            }
                        }
                    }

                    // Add random DGD/TUT if available (create multiple events for multiple time slots)
                    if (newSectionGroup.tutorials && newSectionGroup.tutorials.length > 0) {
                        const randomTutorial = newSectionGroup.tutorials[Math.floor(Math.random() * newSectionGroup.tutorials.length)];
                        const sectionType = randomTutorial.section.split('-')[1] || 'TUT';
                        const dummyTutorialEvent: Event = {
                            title: `${courseInfo.courseCode} ${sectionType}`,
                            startTime: '09:00',
                            endTime: '10:00',
                            day_of_week: 'Monday',
                            description: '',
                            recurrence_pattern: 'weekly'
                        };

                        const tutorialAlternative = {
                            instructor: randomTutorial.instructor,
                            sectionId: randomTutorial.section,
                            type: sectionType,
                            time: randomTutorial.time
                        };

                        const tutorialEvents = createEventsFromTimeString(randomTutorial.time || '', dummyTutorialEvent, tutorialAlternative);
                        for (const tutorialEvent of tutorialEvents) {
                            const finalTutorialEvent = {
                                ...tutorialEvent,
                                description: `Course: ${courseInfo.courseCode}\nSection: ${randomTutorial.section}\nInstructor: ${randomTutorial.instructor}\nType: ${sectionType}\nTime: ${randomTutorial.time || 'TBA'}`,
                                theme: event.theme || 'default',  // INHERIT theme from original event
                                start_date: undefined,  // ENSURE weekly recurrence
                                end_date: undefined,    // ENSURE weekly recurrence
                                recurrence_pattern: 'weekly' as const
                            };
                            if (onAddEvent) {
                                onAddEvent(finalTutorialEvent);
                                autoAddedComponents.push(finalTutorialEvent);
                                
                            }
                        }
                    }
                }
            } catch (error) {
            }
        }

        // STEP 3: Parse time and create the swapped event(s)
                

        const newEvents = createEventsFromTimeString(
            selectedAlternative.time,
            event,
            selectedAlternative
        );

        // STEP 4: Add the new swapped event(s)
        for (const newEvent of newEvents) {
            onSwap(newEvent);
                
        }

        // STEP 5: Show completion message
        if (courseInfo.currentSectionType === 'LEC' && courseInfo.currentGroupId !== selectedAlternative.groupId) {
            setTimeout(() => {
                if (autoAddedComponents.length > 0) {
                    const componentList = autoAddedComponents.map(comp => {
                        const sectionMatch = comp.description?.match(/Section:\s*([^\n\r]+)/i);
                        const typeMatch = comp.description?.match(/Type:\s*([^\n\r]+)/i);
                        return `• ${sectionMatch?.[1] || 'Unknown'} (${typeMatch?.[1] || 'Unknown'})`;
                    }).join('\n');

                    alert(
                        `✅ LECTURE SECTION CHANGED!\n\n` +
                        `📚 Swapped to: ${selectedAlternative.sectionId} (${selectedAlternative.type})\n\n` +
                        `🗑️ REMOVED: All old LAB/DGD/TUT sections from previous group\n\n` +
                        `🎯 AUTO-ADDED NEW COMPONENTS:\n${componentList}\n\n` +
                        `🔄 CUSTOMIZE: Click on any auto-added component to swap it for different times/instructors!\n` +
                        `🎨 THEME: Auto-added components inherit your original color theme`
                    );
                } else {
                    alert(
                        `✅ LECTURE SECTION CHANGED!\n\n` +
                        `📚 Swapped to: ${selectedAlternative.sectionId} (${selectedAlternative.type})\n\n` +
                        `🗑️ REMOVED: All old LAB/DGD/TUT sections from previous group\n\n` +
                        `ℹ️ No LAB/DGD/TUT components available for the new section group\n\n` +
                        `✅ Lecture section change completed successfully!`
                    );
                }
            }, 100);
        }

        onClose();
    };

    // Helper function to create multiple events from time string (handles multiple time slots)
    const createEventsFromTimeString = (
        timeString: string,
        originalEvent: Event,
        selectedAlternative: any
    ): Event[] => {
        

        const events: Event[] = [];

        if (!timeString) {
            
            // Fallback to original event but update other properties
            events.push({
                ...originalEvent,
                id: undefined,
                title: originalEvent.title.replace(/- .*$/, `- ${selectedAlternative.instructor}`),
                professor: selectedAlternative.instructor,
                start_date: undefined,  // CLEAR start_date to ensure it uses day_of_week
                end_date: undefined,    // CLEAR end_date to ensure it uses day_of_week
                recurrence_pattern: 'weekly',  // ENSURE weekly recurrence
                description: originalEvent.description
                    ?.replace(/Section:\s*[^\n\r]+/i, `Section: ${selectedAlternative.sectionId}`)
                    ?.replace(/Instructor:\s*[^\n\r]+/i, `Instructor: ${selectedAlternative.instructor}`)
                    ?.replace(/Type:\s*[^\n\r]+/i, `Type: ${selectedAlternative.type}`) || ''
            });
            return events;
        }

        // Enhanced regex to capture multiple time slots
        // Handles formats like: "Tu 13:00 - 14:20, Th 11:30 - 12:50" or "MoWeFr 08:30 - 09:20"
        const timeSlotRegex = /(\w{2,6})\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g;
        const dayMap: { [key: string]: string } = {
            'Mo': 'Monday', 'Tu': 'Tuesday', 'We': 'Wednesday', 'Th': 'Thursday',
            'Fr': 'Friday', 'Sa': 'Saturday', 'Su': 'Sunday'
        };

        let match;
        let eventCount = 0;

        while ((match = timeSlotRegex.exec(timeString)) !== null) {
            const dayAbbr = match[1];
            const startTime = match[2];
            const endTime = match[3];

            

            // Handle combined days like "MoWeFr" or single days like "Tu"
            let daysToProcess: string[] = [];

            if (dayAbbr.length <= 2) {
                // Single day like "Tu"
                daysToProcess = [dayAbbr];
            } else {
                // Combined days like "MoWeFr" - split into individual days properly
                // Handle "MoWeFr" → ["Mo", "We", "Fr"]
                // Handle "TuTh" → ["Tu", "Th"] 
                const dayPattern = /Mo|Tu|We|Th|Fr|Sa|Su/g;
                daysToProcess = dayAbbr.match(dayPattern) || [dayAbbr];
            
            }

            for (const dayChunk of daysToProcess) {
                const dayOfWeek = dayMap[dayChunk];

                if (!dayOfWeek) {
            
                    continue;
                }

                const newEvent: Event = {
                    ...originalEvent,
                    id: undefined, // Generate new ID
                    title: originalEvent.title.replace(/- .*$/, `- ${selectedAlternative.instructor}`),
                    professor: selectedAlternative.instructor,
                    day_of_week: dayOfWeek,  // THIS IS THE KEY FIX
                    startTime: startTime,
                    endTime: endTime,
                    start_date: undefined,  // CLEAR start_date to ensure it uses day_of_week
                    end_date: undefined,    // CLEAR end_date to ensure it uses day_of_week
                    recurrence_pattern: 'weekly',  // ENSURE weekly recurrence
                    description: originalEvent.description
                        ?.replace(/Section:\s*[^\n\r]+/i, `Section: ${selectedAlternative.sectionId}`)
                        ?.replace(/Instructor:\s*[^\n\r]+/i, `Instructor: ${selectedAlternative.instructor}`)
                        ?.replace(/Type:\s*[^\n\r]+/i, `Type: ${selectedAlternative.type}`) || ''
                };

                events.push(newEvent);
                eventCount++;
            }
        }

        if (events.length === 0) {
            // Fallback to original event timing if parsing failed
            events.push({
                ...originalEvent,
                id: undefined,
                title: originalEvent.title.replace(/- .*$/, `- ${selectedAlternative.instructor}`),
                professor: selectedAlternative.instructor,
                start_date: undefined,  // CLEAR start_date to ensure it uses day_of_week
                end_date: undefined,    // CLEAR end_date to ensure it uses day_of_week
                recurrence_pattern: 'weekly',  // ENSURE weekly recurrence
                description: originalEvent.description
                    ?.replace(/Section:\s*[^\n\r]+/i, `Section: ${selectedAlternative.sectionId}`)
                    ?.replace(/Instructor:\s*[^\n\r]+/i, `Instructor: ${selectedAlternative.instructor}`)
                    ?.replace(/Type:\s*[^\n\r]+/i, `Type: ${selectedAlternative.type}`) || ''
            });
        }

        return events;
    };

    // Helper function to create event from section data
    const createEventFromSection = async (section: any, courseCode: string, sectionType: string): Promise<Event | null> => {
        try {
            // Use the improved time parsing
            const dummyEvent: Event = {
                title: `${courseCode} ${sectionType}`,
                startTime: '09:00',
                endTime: '10:00',
                day_of_week: 'Monday',
                description: '',
                recurrence_pattern: 'weekly'
            };

            const dummyAlternative = {
                instructor: section.instructor,
                sectionId: section.section,
                type: sectionType,
                time: section.time
            };

            const events = createEventsFromTimeString(section.time || '', dummyEvent, dummyAlternative);

            if (events.length > 0) {
                // Return the first event, but in practice we should handle multiple events
                const firstEvent = events[0];
                return {
                    ...firstEvent,
                    description: `Course: ${courseCode}\nSection: ${section.section}\nInstructor: ${section.instructor}\nType: ${sectionType}\nDays: ${section.days?.join(', ') || 'TBA'}\nTime: ${section.time || 'TBA'}`,
                    theme: 'default'
                };
            }

            return null;
        } catch (error) {
            
            return null;
        }
    };

    if (!isOpen) return null;

    const courseInfo = event ? extractCourseInfo(event) : null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[70vh] border border-gray-200 dark:border-gray-700 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        Swap Course Section
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="p-4 flex-1 overflow-y-auto">
                    {courseInfo ? (
                        <>
                            <div className="mb-3">
                                <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-1">
                                    {courseInfo.courseCode}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Current: {courseInfo.currentSection} ({courseInfo.currentSectionType})
                                </p>
                                {courseInfo.currentSectionType !== 'LEC' && (
                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                            ℹ️ Showing {courseInfo.currentSectionType === 'DGD' ? 'DGDs' :
                                                courseInfo.currentSectionType === 'LAB' ? 'Labs' :
                                                    courseInfo.currentSectionType === 'TUT' ? 'Tutorials' :
                                                        courseInfo.currentSectionType + 's'} from the same section group only
                                        </p>
                                    </div>
                                )}
                                {courseInfo.currentSectionType === 'LEC' && (
                                    <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                        <p className="text-xs text-green-700 dark:text-green-300">
                                            📚 Showing ALL available lecture sections from different section groups
                                        </p>
                                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                                            ⚠️ Switching lectures will automatically remove related labs/tutorials/DGDs
                                        </p>
                                    </div>
                                )}
                            </div>

                            {loading ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                                    <p className="text-gray-600 dark:text-gray-400 mt-2">Loading alternatives...</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Available Alternatives:</h4>

                                    {Object.keys(alternatives).length === 0 ? (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">
                                            No alternative sections found.
                                        </p>
                                    ) : (
                                        <div className="max-h-60 overflow-y-auto space-y-3">
                                            {Object.entries(alternatives).map(([groupId, groupSections]) => (
                                                <div key={groupId} className="space-y-1">
                                                    <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                                        Section Group {groupId}
                                                    </h5>
                                                    {groupSections.map((alt, index) => (
                                                        <div
                                                            key={`${groupId}-${index}`}
                                                            className={`p-3 border rounded-lg cursor-pointer transition-all ${selectedAlternative === alt
                                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                                : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                                                                }`}
                                                            onClick={() => setSelectedAlternative(alt)}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex-1">
                                                                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                                                                        {alt.sectionId} ({alt.type})
                                                                    </div>
                                                                    <div className="text-xs text-gray-600 dark:text-gray-400">
                                                                        {alt.instructor} • {alt.days}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                                                        {alt.time}
                                                                    </div>
                                                                    <div className="mt-1">
                                                                        <span className="text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 min-w-[70px] justify-center"
                                                                            style={{
                                                                                backgroundColor: alt.status === 'Open' ? '#bbf7d0' : '#fecaca',
                                                                                color: alt.status === 'Open' ? '#15803d' : '#dc2626'
                                                                            }}>
                                                                            <span>{alt.status === 'Open' ? '🟩' : '🟥'}</span>
                                                                            {alt.status === 'Open' ? 'Open' : 'Closed'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className={`w-4 h-4 rounded-full border-2 ${selectedAlternative === alt
                                                                    ? 'border-blue-500 bg-blue-500'
                                                                    : 'border-gray-300 dark:border-gray-600'
                                                                    }`}>
                                                                    {selectedAlternative === alt && (
                                                                        <div className="w-full h-full flex items-center justify-center">
                                                                            <div className="w-2 h-2 bg-white rounded-full"></div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                            Unable to extract course information from this event.
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSwap}
                        disabled={!selectedAlternative}
                        className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                    >
                        Swap Section
                    </button>
                </div>
            </div>
        </div>
    );
};

// Tooltip component for displaying event details on hover
interface EventTooltipProps {
    event: Event;
    visible: boolean;
    position: { x: number; y: number };
}

const EventTooltip: React.FC<EventTooltipProps> = ({ event, visible, position }) => {
    if (!visible) return null;

    // Helper function to normalize event properties for backward compatibility
    const normalizeEventProperties = (event: any): Event => {
        return {
            ...event,
            startTime: event.startTime || event.start_time,  // Handle both formats
            endTime: event.endTime || event.end_time,        // Handle both formats
        };
    };

    // Extract section code from event description (format: "Section: A00-LEC")
    let sectionCode = '';
    let instructor = event.professor || ''; // Use professor field first, empty if not set
    let mainCourseCode = '';
    let courseName = '';

    // Parse the description to extract information
    if (event.description) {
        // Extract section code from description
        const sectionMatch = event.description.match(/Section:\s*([^\n\r]+)/i);
        if (sectionMatch) {
            sectionCode = sectionMatch[1].trim();
        }

        // Extract instructor from description only if we don't have professor field
        if (!instructor) {
            const instructorMatch = event.description.match(/Instructor:\s*([^\n\r]+)/i);
            if (instructorMatch) {
                instructor = instructorMatch[1].trim();
            }
        }

        // Extract course title from description
        const titleMatch = event.description.match(/Title:\s*([^\n\r]+)/i);
        if (titleMatch) {
            courseName = titleMatch[1].trim();
        }

        // Try different patterns to extract course code
        const patterns = [
            /Course:\s*([A-Z]{3}\s*\d{4})/i,  // "Course: CSI 2110"
            /([A-Z]{3}\s*\d{4})/,              // Just "CSI 2110" anywhere
            /([A-Z]{3}\d{4})/                  // "CSI2110" without space
        ];

        for (const pattern of patterns) {
            const match = event.description.match(pattern);
            if (match) {
                mainCourseCode = match[1].replace(/\s+/g, ' ').trim(); // Normalize spacing
                break;
            }
        }
    }

    // If we still don't have instructor, try to extract from title
    if (!instructor) {
        const titleParts = event.title.split(' - ');
        if (titleParts.length > 1) {
            // Get the last part as instructor (handle cases like "CSI 2110 (LEC) - John Smith")
            instructor = titleParts[titleParts.length - 1].trim();
        }
    }

    // Keep "Staff" in tooltips - only filter during event creation, not display

    // If we still don't have course code, check if the title contains it
    if (!mainCourseCode) {
        const titleParts = event.title.split(' - ');
        if (titleParts.length > 0) {
            const firstPart = titleParts[0].trim();
            // Check if it matches course code pattern
            if (firstPart.match(/^[A-Z]{3}\s*\d{4}$/)) {
                mainCourseCode = firstPart;
            }
        }
    }

    // Use the course name extracted from the description (no hardcoded dictionary needed)
    const fullCourseTitle = courseName ? `${mainCourseCode} - ${courseName}` : mainCourseCode;

    // Parse section type - first try to get it from the "Type:" field in description
    let sectionType = '';
    if (event.description) {
        const typeMatch = event.description.match(/Type:\s*([^\n\r]+)/i);
        if (typeMatch) {
            sectionType = typeMatch[1].trim();
        }
    }

    // If no "Type:" field found, fallback to parsing from section code (e.g., "A00-LEC" -> "LEC")
    if (!sectionType && sectionCode) {
        const sectionMatch = sectionCode.match(/[A-Z]\d+-(\w+)/);
        sectionType = sectionMatch ? sectionMatch[1] : '';
    }

    const sectionTypeMap: { [key: string]: string } = {
        'LEC': 'Lecture',
        'LAB': 'Laboratory',
        'TUT': 'Tutorial',
        'SEM': 'Seminar',
        'DGD': 'Discussion Group'
    };
    const fullSectionType = sectionTypeMap[sectionType] || sectionType;

    // Format time range
    const formatTime12Hour = (timeString: string): string => {
        const [hours, minutes] = timeString.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        const displayMinutes = minutes.toString().padStart(2, '0');
        return `${displayHours}:${displayMinutes} ${ampm}`;
    };

    const normalizedEvent = normalizeEventProperties(event);
    const timeRange = `${formatTime12Hour(normalizedEvent.startTime)} - ${formatTime12Hour(normalizedEvent.endTime)}`;

    return (
        <div
            className="fixed pointer-events-none"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: 'translate(-50%, -120%)',
                zIndex: 9999
            }}
        >
            <div className="bg-slate-700 border border-slate-600 rounded-lg shadow-xl p-4 max-w-xs min-w-48">
                {/* Course code and title */}
                <div className="mb-3 pb-3 border-b border-slate-600">
                    <h3 className="text-white font-medium text-sm leading-tight">
                        {mainCourseCode || event.title.split(' - ')[0]}{courseName ? ` - ${courseName}` : ''}
                    </h3>
                </div>

                {/* Time */}
                <div className="mb-2">
                    <p className="text-blue-400 text-sm font-medium">
                        {timeRange}
                    </p>
                </div>

                {/* Section code */}
                {sectionCode && (
                    <div className="mb-2">
                        <p className="text-slate-300 text-sm">
                            Section: {sectionCode}{sectionType && fullSectionType ? ` (${fullSectionType})` : ''}
                        </p>
                    </div>
                )}

                {/* Instructor - only show if we have one */}
                {instructor && (
                    <div className="mb-2">
                        <p className="text-slate-300 text-sm">
                            Instructor: {instructor}
                        </p>
                    </div>
                )}

                {/* Day */}
                <div>
                    <p className="text-slate-300 text-sm">
                        Day: {event.day_of_week || 'Friday'}
                    </p>
                </div>
            </div>
        </div>
    );
};

// Mobile Event Details Modal Interface
interface MobileEventDetailsModalProps {
    event: Event;
    isOpen: boolean;
    onClose: () => void;
    onEdit: () => void;
    onDelete?: () => void;
}

// Mobile Event Details Modal Component
const MobileEventDetailsModal: React.FC<MobileEventDetailsModalProps> = ({ event, isOpen, onClose, onEdit, onDelete }) => {
    if (!isOpen) return null;

    // Helper function to normalize event properties for backward compatibility
    const normalizeEventProperties = (event: any): Event => {
        return {
            ...event,
            startTime: event.startTime || event.start_time,  // Handle both formats
            endTime: event.endTime || event.end_time,        // Handle both formats
        };
    };

    const formatTime12Hour = (timeString: string): string => {
        const [hours, minutes] = timeString.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const getEventDisplayInfo = (event: Event) => {
        let courseCode = '';
        let sectionType = '';
        let professor = event.professor || '';

        // Try to extract course code from title (format: "CSI 2110 - Instructor" or just "CSI 2110")
        const titleMatch = event.title.match(/([A-Z]{3}\s*\d{4})/);
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

        // Return just the course code for mobile modal - main mobile calendar has full lookup
        return {
            title: courseCode || event.title.split(' - ')[0] || event.title,
            instructor: professor,
            type: sectionType,
            isClass: !!courseCode
        };
    };

    const eventInfo = getEventDisplayInfo(event);
    const eventTheme = event.theme || 'lavender-peach';

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 lg:hidden">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
                {/* Header with gradient background */}
                <div className={`p-6 text-white relative overflow-hidden`} style={{
                    background: 'rgba(255, 255, 255, 0.6)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(163, 163, 163, 1)'
                }}>
                    <div className="relative z-10">
                        <h2 className="text-xl font-bold mb-1">{eventInfo.title}</h2>
                        <p className="text-sm opacity-90">
                            {(() => {
                                const normalizedEvent = normalizeEventProperties(event);
                                return `${formatTime12Hour(normalizedEvent.startTime)} - ${formatTime12Hour(normalizedEvent.endTime)}`;
                            })()}
                        </p>
                    </div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                </div>

                {/* Event Details */}
                <div className="p-6 space-y-4">
                    {eventInfo.instructor && (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                                <span className="text-sm">👨‍🏫</span>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Instructor</p>
                                <p className="font-medium text-gray-900 dark:text-white">{eventInfo.instructor}</p>
                            </div>
                        </div>
                    )}

                    {event.day_of_week && (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                                <span className="text-sm">📅</span>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Day</p>
                                <p className="font-medium text-gray-900 dark:text-white">{event.day_of_week}</p>
                            </div>
                        </div>
                    )}

                    {eventInfo.type && (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                                <span className="text-sm">📚</span>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
                                <p className="font-medium text-gray-900 dark:text-white">{eventInfo.type}</p>
                            </div>
                        </div>
                    )}

                    {event.description && (
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-sm">📝</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Details</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{event.description}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="p-6 pt-0 flex gap-3">
                    <button
                        onClick={onEdit}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                        <Edit3 className="w-4 h-4" />
                        Edit
                    </button>
                    {onDelete && (
                        <button
                            onClick={onDelete}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-4 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors duration-200"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

interface WeeklyCalendarProps {
    date: string; // e.g., "2025-05-23"
    events: Event[];
    onDateChange?: (newDate: string) => void;
    onDeleteEvent?: (eventId: number) => void;
    onEditEvent?: (eventId: number, updatedEvent: Event) => void;
    onAddEvent?: (newEvent: Event) => void;
    onRefresh?: () => void;
    onTermChange?: (term: string) => void;
    currentTerm?: string;
    loadFromBackend?: boolean;
    isKairollView?: boolean; // Whether this is being used in Kairoll view for special styling
    onStatsChange?: (courseCount: number, conflictsCount: number) => void; // Add callback for stats
    courseCount?: number; // Current course count for badges
    conflictsCount?: number; // Current conflicts count for badges
    readOnly?: boolean; // Whether the calendar is read-only (no editing/sharing/deleting)
}

// Define the type for time slots
interface TimeSlot {
    hour: number;
    display: string;
}

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({ 
    date, 
    events, 
    onDateChange, 
    onDeleteEvent, 
    onEditEvent, 
    onAddEvent, 
    onRefresh, 
    onTermChange, 
    currentTerm = 'Fall', 
    loadFromBackend = false, 
    isKairollView = false, 
    onStatsChange, 
    courseCount = 0, 
    conflictsCount = 0, 
    readOnly = false 
}: WeeklyCalendarProps) => {
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const [showAddEventModal, setShowAddEventModal] = useState(false);
    const [showDownloadModal, setShowDownloadModal] = useState(false);


    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
    const [showDeleteEventsModal, setShowDeleteEventsModal] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [animationDirection, setAnimationDirection] = useState<'prev' | 'next'>('next');
    const [tooltipEvent, setTooltipEvent] = useState<Event | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

    // 🌟 USE EXISTING THEME SYSTEM: Get theme from ThemeProvider
    const { actualTheme } = useTheme();

    // Tooltip state
    const [tooltipVisible, setTooltipVisible] = useState(false);

    // Mobile event details modal state
    const [mobileEventDetails, setMobileEventDetails] = useState<Event | null>(null);

    // Conflicts modal state
    const [showConflictsModal, setShowConflictsModal] = useState(false);

    // Paste schedule modal state
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pasteUrl, setPasteUrl] = useState('');
    const [pasteLoading, setPasteLoading] = useState(false);
    const [pasteError, setPasteError] = useState<string | null>(null);

    // Share schedule modal state
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [shareLoading, setShareLoading] = useState(false);

    // Backend events state
    const [backendEvents, setBackendEvents] = useState<Event[]>([]);

    // Combine passed events with backend events (avoiding duplicates)
    const allEvents = useMemo(() => {
        // Only use backend events when explicitly requested
        if (loadFromBackend && backendEvents.length > 0) {
            // Parent is the source of truth: filter backend events to only those still present in parent list
            const parentIds = new Set(events.filter(e => e.id != null).map(e => e.id as number));
            const filteredBackend = backendEvents.filter(ev => !ev.id || parentIds.has(ev.id));

            // Avoid duplicates: drop passed events that are already represented by backend
            const backendIds = new Set(filteredBackend.filter(e => e.id).map(e => e.id));
            const uniquePassedEvents = events.filter(e => !e.id || !backendIds.has(e.id));

            return [...filteredBackend, ...uniquePassedEvents];
        }

        // Default: use passed events only
        return events;
    }, [events, backendEvents, loadFromBackend]);

    

    // Parse the date and get the start of the week (Monday)
    const currentDate = parseISO(date);
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday = 1

    // Generate the 7 days of the week
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    // Track screen width for responsive positioning
    useEffect(() => {
    
        const updateScreenWidth = () => {
            const newWidth = window.innerWidth;
            
            setScreenWidth(newWidth);
        };

        window.addEventListener('resize', updateScreenWidth);
        return () => window.removeEventListener('resize', updateScreenWidth);
    }, []);

    // Listen for export calendar event from mobile view
    useEffect(() => {
        const handleTriggerExport = () => {
            // Make sure we're using the latest events when exporting
            const allEvents = [...events, ...(loadFromBackend ? backendEvents : [])];

            if (!hasEventsToExport(allEvents)) {
                alert('No events available to export');
                return;
            }

            setShowDownloadModal(true);
        };

        window.addEventListener('triggerCalendarExport', handleTriggerExport);
        return () => window.removeEventListener('triggerCalendarExport', handleTriggerExport);
    }, [events, backendEvents, loadFromBackend]);

    // Load backend events when requested OR when authenticated (auto-load)
    useEffect(() => {
        const shouldLoadFromBackend = loadFromBackend || (typeof window !== 'undefined' && localStorage.getItem('token'));

        if (shouldLoadFromBackend) {
            const loadBackendEvents = async () => {
                try {
                    const apiEvents = await getCalendarEvents();

                    // Convert API events to local Event format
                    const convertedEvents: Event[] = apiEvents.map(apiEvent => ({
                        id: apiEvent.id,
                        startTime: apiEvent.start_time,
                        endTime: apiEvent.end_time,
                        title: apiEvent.title,
                        day_of_week: apiEvent.day_of_week,
                        start_date: apiEvent.start_date,
                        end_date: apiEvent.end_date,
                        description: apiEvent.description,
                        professor: apiEvent.professor,
                        recurrence_pattern: apiEvent.recurrence_pattern,
                        reference_date: apiEvent.reference_date,
                        theme: apiEvent.theme
                    }));

                    
                    setBackendEvents(convertedEvents);
                } catch (error) {
                    setBackendEvents([]);
                }
            };

            loadBackendEvents();
        }
    }, [loadFromBackend, date]); // Also reload when date changes
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // 🌟 INTEGRATED: Get theme-based styles using existing theme system
    const getThemeStyles = () => {
        if (actualTheme === 'dark') {
            return {
                // Minimal dark palette using global CSS variables
                containerBg: 'bg-[rgb(var(--background-rgb))]',
                containerBorder: 'border-white/10',
                headerBg: 'bg-[rgb(var(--secondary-bg))]',
                headerText: 'text-[rgb(var(--text-primary))]',
                timeSlotBg: 'bg-[rgb(var(--background-rgb))]',
                timeSlotBorder: 'border-white/10',
                timeLabelBg: 'bg-[rgb(var(--secondary-bg))]',
                timeLabelText: 'text-[rgb(var(--text-primary))]',
                dayHeaderBg: 'bg-[rgb(var(--secondary-bg))]',
                dayHeaderText: 'text-[rgb(var(--text-primary))]',
                dayHeaderSubtext: 'text-[rgb(var(--text-secondary))]',
                // Navigation theme styles
                navBg: 'bg-[rgb(var(--secondary-bg))]',
                navBorder: 'border-[rgb(var(--border-color))]',
                navText: 'text-[rgb(var(--text-primary))]',
                navButtonBg: 'bg-white/5 hover:bg-white/10 transition-colors duration-300',
                navButtonText: 'text-[rgb(var(--text-primary))]'
            };
        } else {
            return {
                // Light mode (white theme)
                containerBg: 'bg-white',
                containerBorder: 'border-gray-300',
                headerBg: 'bg-white',
                headerText: 'text-gray-900',
                timeSlotBg: 'bg-white',
                timeSlotBorder: 'border-gray-300',
                timeLabelBg: 'bg-gray-100',
                timeLabelText: 'text-gray-900',
                dayHeaderBg: 'bg-white',
                dayHeaderText: 'text-gray-900',
                dayHeaderSubtext: 'text-gray-600',
                // Navigation theme styles
                navBg: 'bg-white',
                navBorder: 'border-gray-200',
                navText: 'text-gray-900',
                navButtonBg: 'bg-gray-100 hover:bg-gray-200',
                navButtonText: 'text-gray-900'
            };
        }
    };

    const themeStyles = getThemeStyles();

    

    // Generate HOURLY time slots to match your exact image - NO half-hour slots
    const timeSlots: TimeSlot[] = [];
    for (let hour = APP_CONFIG.ACADEMIC.CALENDAR.START_HOUR; hour <= APP_CONFIG.ACADEMIC.CALENDAR.END_HOUR; hour++) {
        const time12 = hour > 12 ? hour - 12 : hour;
        const ampm = hour < 12 ? 'AM' : 'PM';
        const displayTime = `${time12}:00 ${ampm}`;

        timeSlots.push({
            hour: hour,
            display: displayTime,
        });
    }

    // Function to convert time string to minutes from start of day
    const timeToMinutes = (timeString: string): number => {
        if (!timeString || typeof timeString !== 'string') {
            
            return 0;
        }

        try {
            const [hours, minutes] = timeString.split(':').map(Number);
            if (isNaN(hours) || isNaN(minutes)) {
            
                return 0;
            }
            return hours * 60 + minutes;
        } catch (error) {
            
            return 0;
        }
    };

    // Function to convert 24-hour time to 12-hour format for display
    const formatTime12Hour = (timeString: string): string => {
        const [hours, minutes] = timeString.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        const displayMinutes = minutes.toString().padStart(2, '0');
        return `${displayHours}:${displayMinutes} ${ampm}`;
    };

    // Helper function to normalize event properties for backward compatibility
    const normalizeEventProperties = (event: any): Event => {
        return {
            ...event,
            startTime: event.startTime || event.start_time,  // Handle both formats
            endTime: event.endTime || event.end_time,        // Handle both formats
        };
    };

    // Function to count unique courses from events
    const getUniqueCourseCount = () => {
        const allEvents = [...events, ...(loadFromBackend ? backendEvents : [])];
        const uniqueCourses = new Set();

        

        allEvents.forEach(event => {
            // More flexible regex to match course codes in various formats:
            // "CSI2110", "CSI 2110", "CSI2110 - Lecture", "Lecture - CSI2110", etc.
            const match = event.title.match(/([A-Z]{3,4}\s*\d{4})/);
            if (match) {
                // Normalize the course code by removing spaces
                const courseCode = match[1].replace(/\s+/g, '');
                uniqueCourses.add(courseCode);
                
            } else {
                
            }
        });

        
        return uniqueCourses.size;
    };

    // Function to count scheduling conflicts
    const getConflictsCount = () => {
        const allEvents = [...events, ...(loadFromBackend ? backendEvents : [])];
        let conflictCount = 0;
        const conflictPairs = new Set();

        

        for (let i = 0; i < allEvents.length; i++) {
            for (let j = i + 1; j < allEvents.length; j++) {
                const event1 = normalizeEventProperties(allEvents[i]);
                const event2 = normalizeEventProperties(allEvents[j]);

                // Only check conflicts for events on the same day
                if (event1.day_of_week === event2.day_of_week) {
                    const start1 = timeToMinutes(event1.startTime);
                    const end1 = timeToMinutes(event1.endTime);
                    const start2 = timeToMinutes(event2.startTime);
                    const end2 = timeToMinutes(event2.endTime);

                    // Check if times overlap (start of one is before end of other)
                    if (start1 < end2 && start2 < end1) {
                        const conflictKey = `${Math.min(i, j)}-${Math.max(i, j)}`;
                        if (!conflictPairs.has(conflictKey)) {
                            conflictPairs.add(conflictKey);
                    
                        }
                    }
                }
            }
        }

        conflictCount = conflictPairs.size;
        
        return conflictCount;
    };

    // Function to get actual conflicting events
    const getConflictingEvents = () => {
        const allEvents = [...events, ...(loadFromBackend ? backendEvents : [])];
        const conflicts: { event1: Event; event2: Event; day: string }[] = [];

        for (let i = 0; i < allEvents.length; i++) {
            for (let j = i + 1; j < allEvents.length; j++) {
                const event1 = normalizeEventProperties(allEvents[i]);
                const event2 = normalizeEventProperties(allEvents[j]);

                // Only check conflicts for events on the same day
                if (event1.day_of_week === event2.day_of_week) {
                    const start1 = timeToMinutes(event1.startTime);
                    const end1 = timeToMinutes(event1.endTime);
                    const start2 = timeToMinutes(event2.startTime);
                    const end2 = timeToMinutes(event2.endTime);

                    // Check if times overlap (start of one is before end of other)
                    if (start1 < end2 && start2 < end1) {
                        conflicts.push({
                            event1: allEvents[i],
                            event2: allEvents[j],
                            day: event1.day_of_week || 'Unknown'
                        });
                    }
                }
            }
        }

        return conflicts;
    };

    // Effect to notify parent component of stats changes
    useEffect(() => {
        if (onStatsChange) {
            const courseCount = getUniqueCourseCount();
            const conflictsCount = getConflictsCount();
            onStatsChange(courseCount, conflictsCount);
        }
    }, [allEvents, onStatsChange]);

    // Function to detect overlapping events in the same day
    const detectOverlaps = (dayEvents: Event[]) => {
        const overlaps: { [key: number]: number[] } = {};

        for (let i = 0; i < dayEvents.length; i++) {
            const event1 = normalizeEventProperties(dayEvents[i]);
            const start1 = timeToMinutes(event1.startTime);
            const end1 = timeToMinutes(event1.endTime);

            for (let j = i + 1; j < dayEvents.length; j++) {
                const event2 = normalizeEventProperties(dayEvents[j]);
                const start2 = timeToMinutes(event2.startTime);
                const end2 = timeToMinutes(event2.endTime);

                // Check if events overlap (start of one is before end of other)
                if (start1 < end2 && start2 < end1) {
                    if (!overlaps[i]) overlaps[i] = [];
                    if (!overlaps[j]) overlaps[j] = [];
                    overlaps[i].push(j);
                    overlaps[j].push(i);
                }
            }
        }

        return overlaps;
    };

    // Function to calculate EXACT event position alignment with new grid system

    const getEventPosition = (event: Event, dayEvents: Event[], eventIndex: number, currentScreenWidth: number = screenWidth) => {
        const normalizedEvent = normalizeEventProperties(event);

        // Validate that we have proper time properties
        if (!normalizedEvent.startTime || !normalizedEvent.endTime) {
            console.warn('Event missing time properties:', event);
            return {
                top: '0px',
                height: '80px',
                left: '0px',
                width: '100%',
                zIndex: 10,
                hasOverlaps: false
            };
        }

        const startMinutes = timeToMinutes(normalizedEvent.startTime);
        const endMinutes = timeToMinutes(normalizedEvent.endTime);

        // Validate time calculations
        if (isNaN(startMinutes) || isNaN(endMinutes)) {
            console.warn('Invalid time calculations for event:', normalizedEvent);
            return {
                top: '0px',
                height: '80px',
                left: '0px',
                width: '100%',
                zIndex: 10,
                hasOverlaps: false
            };
        }

        // Calendar starts at 8 AM (480 minutes from midnight) - using APP_CONFIG
        const CALENDAR_START_MINUTES = APP_CONFIG.ACADEMIC.CALENDAR.START_MINUTES; // 480 minutes

        // CONSISTENT SLOT HEIGHT - matches our grid system exactly
        const SLOT_HEIGHT = 80; // Both mobile and desktop use 80px for consistency

        // Calculate position from calendar start with PERFECT grid alignment
        const minutesFromStart = startMinutes - CALENDAR_START_MINUTES;
        const eventDurationMinutes = endMinutes - startMinutes;

        // PIXEL-PERFECT TIME ALIGNMENT - events align exactly with time grid lines
        // Ensure events stay within calendar bounds - no border offset for perfect alignment
        const topPosition = Math.max(0, (minutesFromStart / 60) * SLOT_HEIGHT);
        const height = Math.max((eventDurationMinutes / 60) * SLOT_HEIGHT, 30); // No border subtraction for perfect grid alignment

        

        // Handle overlapping events with improved spacing
        const overlaps = detectOverlaps(dayEvents);
        const hasOverlaps = overlaps[eventIndex];

        // RESPONSIVE POSITIONING - compact on desktop, full-width on mobile
        let leftOffset = '2px'; // Small margin from left edge for grid alignment
        let widthCalc = 'calc(100% - 4px)'; // Account for left/right margins
        let zIndex = 10;

        // Simplified responsive positioning - consistent across all screen sizes
        const isDesktop = currentScreenWidth >= 640;

        if (hasOverlaps && hasOverlaps.length > 0) {
            const overlapGroup = new Set([eventIndex, ...hasOverlaps]);
            const sortedGroup = Array.from(overlapGroup).sort((a, b) => {
                const normalizedA = normalizeEventProperties(dayEvents[a]);
                const normalizedB = normalizeEventProperties(dayEvents[b]);
                const timeA = timeToMinutes(normalizedA.startTime);
                const timeB = timeToMinutes(normalizedB.startTime);
                return timeA - timeB;
            });

            const positionInGroup = sortedGroup.indexOf(eventIndex);
            const totalInGroup = sortedGroup.length;

            if (isDesktop) {
                // Desktop: Side-by-side layout for overlapping events
                const eventWidth = Math.floor(100 / totalInGroup);
                leftOffset = `${positionInGroup * eventWidth + 0.5}%`;
                widthCalc = `${eventWidth - 1}%`;
                zIndex = 10 + positionInGroup;
            } else {
                // Mobile: Stacked layout for overlapping events
                leftOffset = '4px';
                widthCalc = 'calc(100% - 8px)';
                zIndex = 10 + positionInGroup;
            }
        } else {
            // No overlaps - consistent positioning for all screen sizes
            leftOffset = '4px';
            widthCalc = 'calc(100% - 8px)';
        }

        

        return {
            top: `${topPosition}px`,
            height: `${height}px`,
            left: leftOffset,
            width: widthCalc,
            zIndex: zIndex,
            hasOverlaps: hasOverlaps && hasOverlaps.length > 0
        };
    };

    // Function to validate and normalize time format
    const validateTimeFormat = (timeString: string): boolean => {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(timeString);
    };

    // Function to snap time to nearest 15-minute interval for better alignment
    const snapToGrid = (timeString: string): string => {
        if (!validateTimeFormat(timeString)) return timeString;

        const [hours, minutes] = timeString.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;

        // Round to nearest 15-minute interval
        const snappedMinutes = Math.round(totalMinutes / 15) * 15;
        const snappedHours = Math.floor(snappedMinutes / 60);
        const remainingMinutes = snappedMinutes % 60;

        return `${snappedHours.toString().padStart(2, '0')}:${remainingMinutes.toString().padStart(2, '0')}`;
    };

    // Helper function to convert Tailwind gradient classes to CSS values
    const getGradientCSS = (gradientClass: string): string => {
        const gradientMap: { [key: string]: string } = {
            'from-purple-500 to-indigo-600': 'linear-gradient(135deg, #a855f7 0%, #4f46e5 100%)',
            'from-blue-500 to-cyan-500': 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
            'from-green-500 to-emerald-500': 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
            'from-orange-500 to-red-500': 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
            'from-pink-500 to-rose-500': 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
            'from-teal-500 to-blue-500': 'linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%)',
            'from-yellow-400 to-orange-500': 'linear-gradient(135deg, #facc15 0%, #f97316 100%)',
            'from-indigo-600 to-purple-600': 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)'
        };
        return gradientMap[gradientClass] || 'linear-gradient(135deg, #a855f7 0%, #4f46e5 100%)';
    };

    // Function to get theme style for events - SEMI-TRANSPARENT BACKGROUNDS
    const getEventThemeStyle = (event: Event) => {
        // Use the selected theme from EVENT_THEMES if available
        const themeName = event.theme || 'lavender-peach';
        const themeConfig = EVENT_THEMES[themeName as keyof typeof EVENT_THEMES];

        if (themeConfig) {
            return {
                bg: themeConfig.bg,
                border: themeConfig.border,
                text: themeConfig.text,
                hover: themeConfig.hover,
                timeColor: themeConfig.text
            };
        }

        // Fallback to hash-based color if theme not found (for backward compatibility)
        const fallbackColors = [
            { bg: 'bg-purple-400/60', border: 'border-purple-400', text: 'text-black dark:text-white', hover: 'hover:bg-purple-400/80' }, // Sunset Vibes
            { bg: 'bg-blue-400/60', border: 'border-blue-400', text: 'text-black dark:text-white', hover: 'hover:bg-blue-400/80' }, // Ocean Depths
            { bg: 'bg-green-400/60', border: 'border-green-400', text: 'text-black dark:text-white', hover: 'hover:bg-green-400/80' }, // Tropical Paradise
            { bg: 'bg-red-400/60', border: 'border-red-400', text: 'text-black dark:text-white', hover: 'hover:bg-red-400/80' }, // Fire Storm
            { bg: 'bg-pink-400/60', border: 'border-pink-400', text: 'text-black dark:text-white', hover: 'hover:bg-pink-400/80' }, // Cotton Candy
            { bg: 'bg-cyan-400/60', border: 'border-cyan-400', text: 'text-black dark:text-white', hover: 'hover:bg-cyan-400/80' }, // Cyber Neon
            { bg: 'bg-emerald-400/60', border: 'border-emerald-400', text: 'text-black dark:text-white', hover: 'hover:bg-emerald-400/80' }, // Green Blue
            { bg: 'bg-orange-400/60', border: 'border-orange-400', text: 'text-black dark:text-white', hover: 'hover:bg-orange-400/80' }, // Warm Brown
            { bg: 'bg-lime-400/60', border: 'border-lime-400', text: 'text-black dark:text-white', hover: 'hover:bg-lime-400/80' }, // Lime Green
            { bg: 'bg-teal-400/60', border: 'border-teal-400', text: 'text-black dark:text-white', hover: 'hover:bg-teal-400/80' }, // Mint Teal
        ];

        const hash = event.title.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);

        const colorIndex = Math.abs(hash) % fallbackColors.length;
        const selectedColor = fallbackColors[colorIndex];

        return {
            bg: selectedColor.bg,
            border: selectedColor.border,
            text: selectedColor.text,
            hover: selectedColor.hover,
            timeColor: selectedColor.text
        };
    };

    // FIXED DATE FILTERING - Make events appear on correct days
    // Extract course info from event title and description
    const getEventDisplayInfo = (event: Event) => {
        let courseCode = '';
        let sectionType = '';
        let professor = event.professor || '';

        // Try to extract course code from title (format: "CSI 2110 - Instructor" or just "CSI 2110")
        const titleMatch = event.title.match(/([A-Z]{3}\s*\d{4})/);
        if (titleMatch) {
            courseCode = titleMatch[1];
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

        return {
            courseCode: courseCode || event.title.split(' - ')[0] || event.title,
            sectionType: sectionType || 'LEC', // Default to LEC if no section type found
            professor: professor
        };
    };

    const getEventsForDay = (dayName: string, dayDate: Date) => {
        const dayDateString = format(dayDate, 'yyyy-MM-dd');

        const filteredEvents = allEvents.filter(event => {
            // RULE 1: If event has day_of_week, show it on that day
            if (event.day_of_week) {
                // Handle different day formats: "Monday", "Mon", "MONDAY", etc.
                const eventDay = event.day_of_week.toLowerCase().trim();
                const targetDay = dayName.toLowerCase().trim();

                // Check for exact match first
                let dayMatches = eventDay === targetDay;

                // If no exact match, try abbreviated forms
                if (!dayMatches) {
                    const dayAbbreviations: { [key: string]: string[] } = {
                        'monday': ['mon', 'monday', 'm'],
                        'tuesday': ['tue', 'tues', 'tuesday', 't'],
                        'wednesday': ['wed', 'wednesday', 'w'],
                        'thursday': ['thu', 'thur', 'thurs', 'thursday', 'th'],
                        'friday': ['fri', 'friday', 'f'],
                        'saturday': ['sat', 'saturday', 's'],
                        'sunday': ['sun', 'sunday', 'su']
                    };

                    // Check if event day matches any abbreviation for target day
                    const targetAbbrevs = dayAbbreviations[targetDay] || [];
                    dayMatches = targetAbbrevs.includes(eventDay);

                    // Also check reverse - if target day matches event day abbreviations
                    if (!dayMatches) {
                        for (const [fullDay, abbrevs] of Object.entries(dayAbbreviations)) {
                            if (abbrevs.includes(eventDay) && fullDay === targetDay) {
                                dayMatches = true;
                                break;
                            }
                        }
                    }
                }

                // If day matches, check if we need to respect date range limits
                if (dayMatches) {
                    // If event has both start_date and end_date, only show within that range
                    if (event.start_date && event.end_date) {
                        const currentDate = dayDateString;
                        return currentDate >= event.start_date && currentDate <= event.end_date;
                    }
                    // If no date range specified, show on all matching days
                    return true;
                }
                return false;
            }

            // RULE 2: If event has specific start_date, show it on that date
            if (event.start_date) {
                const matches = event.start_date === dayDateString;
                return matches;
            }

            return false;
        });

        return filteredEvents;
    };

    // Navigation handlers
    const goToPreviousWeek = () => {
        if (onDateChange && !isAnimating) {
            setAnimationDirection('prev');
            setIsAnimating(true);
            setTimeout(() => {
                const prevWeek = subWeeks(currentDate, 1);
                onDateChange(format(prevWeek, 'yyyy-MM-dd'));
                setTimeout(() => {
                    setIsAnimating(false);
                }, 250);
            }, 125);
        }
    };

    const goToNextWeek = () => {
        if (onDateChange && !isAnimating) {
            setAnimationDirection('next');
            setIsAnimating(true);
            setTimeout(() => {
                const nextWeek = addWeeks(currentDate, 1);
                onDateChange(format(nextWeek, 'yyyy-MM-dd'));
                setTimeout(() => {
                    setIsAnimating(false);
                }, 250);
            }, 125);
        }
    };

    const goToToday = () => {
        if (onDateChange) {
            const today = new Date();
            onDateChange(format(today, 'yyyy-MM-dd'));
        }
    };

    // Handler for opening edit modal
    const handleEditEvent = (event: Event) => {
        setEditingEvent(event);
    };

    // Handler for closing edit modal
    const handleCloseEditModal = () => {
        setEditingEvent(null);
    };

    // Handler for saving edited event
    const handleSaveEvent = async (updatedEvent: Event) => {
        try {
            if (updatedEvent.id) {
                // Extract course code from the event
                const extractCourseCode = (event: Event): string | null => {
                    // Try to extract from title first (e.g., "CSI 2110 - Instructor")
                    const titleMatch = event.title.match(/([A-Z]{3}\s*\d{4})/);
                    if (titleMatch) {
                        return titleMatch[1].replace(/\s+/g, ' ').trim(); // Normalize spacing
                    }

                    // Try to extract from description
                    if (event.description) {
                        const descMatch = event.description.match(/Course:\s*([A-Z]{3}\s*\d{4})/i);
                        if (descMatch) {
                            return descMatch[1].replace(/\s+/g, ' ').trim();
                        }
                    }

                    return null;
                };

                const courseCode = extractCourseCode(updatedEvent);
                // Update event in backend if authenticated
                const isAuthenticated = typeof window !== 'undefined' && localStorage.getItem('token');
                if (isAuthenticated) {
                    const { updateCalendarEvent, getCalendarEvents } = await import('@/lib/api');

                    // Only patch changed fields to avoid unintentionally altering recurrence/date fields
                    const minimalPayload: any = {};
                    if (updatedEvent.theme) minimalPayload.theme = updatedEvent.theme;

                    await updateCalendarEvent(updatedEvent.id, minimalPayload);

                    // Optimistic local update: update the edited event immediately
                    setBackendEvents(prev => {
                        if (!prev || prev.length === 0) return prev;
                        const found = prev.some(e => e.id === updatedEvent.id);
                        if (!found) return prev;
                        return prev.map(e => e.id === updatedEvent.id ? { ...e, theme: updatedEvent.theme || e.theme } : e);
                    });

                    // Optimistic bulk update: if changing theme for a course, recolor all blocks of that course
                    if (courseCode && updatedEvent.theme) {
                        setBackendEvents(prev => {
                            if (!prev || prev.length === 0) return prev;
                            return prev.map(e => (extractCourseCode(e) === courseCode)
                                ? { ...e, theme: updatedEvent.theme as string }
                                : e
                            );
                        });
                    }

                    // If we have a course code and theme changed, update all related events
                    if (courseCode && updatedEvent.theme) {
                        try {
                            // Get all current events
                            const allEvents = await getCalendarEvents();

                            // Find all events for the same course
                            const relatedEvents = allEvents.filter(event => {
                                const eventCourseCode = extractCourseCode({
                                    title: event.title,
                                    description: event.description
                                } as Event);
                                return eventCourseCode === courseCode && event.id !== updatedEvent.id && updatedEvent.id !== undefined;
                            });

                            // Update all related events with the same theme
                            for (const relatedEvent of relatedEvents) {
                                try {
                                    if (relatedEvent.id) {
                                        await updateCalendarEvent(relatedEvent.id, { theme: updatedEvent.theme });
                                    }
                                } catch (error) {}
                            }
                        } catch (error) {
                        }
                    }

                    // Background refresh to keep state consistent across weeks
                    try {
                        const all = await getCalendarEvents();
                        const converted: Event[] = all.map(apiEvent => ({
                            id: apiEvent.id,
                            startTime: apiEvent.start_time,
                            endTime: apiEvent.end_time,
                            title: apiEvent.title,
                            day_of_week: apiEvent.day_of_week,
                            start_date: apiEvent.start_date,
                            end_date: apiEvent.end_date,
                            description: apiEvent.description,
                            professor: apiEvent.professor,
                            recurrence_pattern: apiEvent.recurrence_pattern,
                            reference_date: apiEvent.reference_date,
                            theme: apiEvent.theme
                        }));
                        setBackendEvents(converted);
                    } catch {}
                }

                // Also call the passed handler if provided
                if (onEditEvent) {
                    onEditEvent(updatedEvent.id, updatedEvent);
                }
            }
        } catch (error) {
            alert('Failed to update event. Please try again.');
        }
    };

    const handleAddEvent = () => {
        setShowAddEventModal(true);
    };

    const handleCloseAddEventModal = () => {
        setShowAddEventModal(false);
    };

    const handleSaveNewEvent = async (newEvent: Event) => {
        try {
            // Extract course code from the event
            const extractCourseCode = (event: Event): string | null => {
                // Try to extract from title first (e.g., "CSI 2110 - Instructor")
                const titleMatch = event.title.match(/([A-Z]{3}\s*\d{4})/);
                if (titleMatch) {
                    return titleMatch[1].replace(/\s+/g, ' ').trim(); // Normalize spacing
                }

                // Try to extract from description
                if (event.description) {
                    const descMatch = event.description.match(/Course:\s*([A-Z]{3}\s*\d{4})/i);
                    if (descMatch) {
                        return descMatch[1].replace(/\s+/g, ' ').trim();
                    }
                }

                return null;
            };

            const courseCode = extractCourseCode(newEvent);

            // Create event in backend if authenticated
            const isAuthenticated = typeof window !== 'undefined' && localStorage.getItem('token');
            if (isAuthenticated) {
                const { createCalendarEvent, getCalendarEvents, updateCalendarEvent } = await import('@/lib/api');

                const eventData = {
                    title: newEvent.title,
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

                const createdEvent = await createCalendarEvent(eventData);

                // If we have a course code and theme, update all related events to match
                if (courseCode && newEvent.theme) {
                    try {
                        // Get all current events
                        const allEvents = await getCalendarEvents();

                        // Find all events for the same course (excluding the one we just created)
                        const relatedEvents = allEvents.filter(event => {
                            const eventCourseCode = extractCourseCode({
                                title: event.title,
                                description: event.description
                            } as Event);
                            return eventCourseCode === courseCode && event.id !== createdEvent.id;
                        });

                        // Update all related events with the same theme, patching only 'theme'
                        for (const relatedEvent of relatedEvents) {
                            try {
                                if (relatedEvent.id) {
                                    await updateCalendarEvent(relatedEvent.id, { theme: newEvent.theme });
                                }
                            } catch (error) {}
                        }
                    } catch (error) {
                    }
                }

                // Refresh backend events
                const apiEvents = await getCalendarEvents();
                const convertedEvents: Event[] = apiEvents.map(apiEvent => ({
                    id: apiEvent.id,
                    startTime: apiEvent.start_time,
                    endTime: apiEvent.end_time,
                    title: apiEvent.title,
                    day_of_week: apiEvent.day_of_week,
                    start_date: apiEvent.start_date,
                    end_date: apiEvent.end_date,
                    description: apiEvent.description,
                    professor: apiEvent.professor,
                    recurrence_pattern: apiEvent.recurrence_pattern,
                    reference_date: apiEvent.reference_date,
                    theme: apiEvent.theme
                }));
                setBackendEvents(convertedEvents);

                // Add the backend ID to the event for local use
                newEvent.id = createdEvent.id;
            }

            // Also call the passed handler if provided
            if (onAddEvent) {
                onAddEvent(newEvent);
            }
        } catch (error) {
            alert('Failed to create event. Please try again.');
        }
    };

    const handleDeleteEvents = () => {
        setShowDeleteEventsModal(true);
    };

    const handleCloseDeleteEventsModal = () => {
        setShowDeleteEventsModal(false);
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

    // Handler for Fall/Winter button click to also change the week
    const handleTermChange = (term: string) => {
        if (onTermChange) onTermChange(term);
        if (onDateChange) {
            // Use the proper term start dates from APP_CONFIG
            if (term === 'Fall') onDateChange(APP_CONFIG.ACADEMIC.TERMS.FALL.startDate);
        }
    };

    // Mobile event details handlers
    const handleMobileEventClick = (event: Event) => {
        // Don't allow editing in readOnly mode
        if (readOnly) {
            return;
        }

        // On mobile, show event details first
        if (window.innerWidth < 640) {
            setMobileEventDetails(event);
        } else {
            // On desktop, directly edit
            handleEditEvent(event);
        }
    };

    const handleCloseMobileEventDetails = () => {
        setMobileEventDetails(null);
    };

    // Handler for showing export modal
    const handleExportCalendar = () => {
        const allEvents = [...events, ...(loadFromBackend ? backendEvents : [])];

        if (!hasEventsToExport(allEvents)) {
            alert('No events available to export');
            return;
        }

        setShowDownloadModal(true);
    };

    // Handler for actual download after user confirms filename
    const handleDownloadConfirm = async (filename: string) => {
        try {
            const allEvents = [...events, ...(loadFromBackend ? backendEvents : [])];
            await exportCalendarAsICS(allEvents, filename);
        } catch (error) {
            console.error('Export failed:', error);
            alert(`Failed to export calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    // Handler for sharing schedule
    const handleShareSchedule = async () => {
        try {
            // Check if user is authenticated
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (!token) {
                alert('Please log in to share your schedule');
                return;
            }

            const allEvents = [...events, ...(loadFromBackend ? backendEvents : [])];

            if (!hasScheduleContent(allEvents)) {
                alert('No courses in your schedule to share');
                return;
            }

            setShareLoading(true);
            setShowShareModal(true);

            // Generate shareable schedule data
            const shareableSchedule = generateShareableSchedule(
                allEvents,
                'Fall 2025', // You might want to make this dynamic
                'My Schedule'
            );

            // Share the schedule
            const response = await shareSchedule(shareableSchedule, token);
            setShareUrl(response.share_url);

        } catch (error) {
            console.error('Share failed:', error);
            alert(`Failed to share schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setShowShareModal(false);
        } finally {
            setShareLoading(false);
        }
    };

    // Handler for opening paste modal
    const handleOpenPasteModal = () => {
        setShowPasteModal(true);
        setPasteUrl('');
        setPasteError(null);
    };

    // Handler for closing paste modal
    const handleClosePasteModal = () => {
        setShowPasteModal(false);
        setPasteUrl('');
        setPasteError(null);
        setPasteLoading(false);
    };

    // Handler for pasting and importing shared schedule
    const handlePasteSchedule = async () => {
        if (!pasteUrl.trim()) {
            setPasteError('Please enter a schedule link');
            return;
        }

        try {
            setPasteLoading(true);
            setPasteError(null);

            // Extract schedule ID from URL
            const urlPattern = /\/schedule\/([a-f0-9-]+)/i;
            const match = pasteUrl.match(urlPattern);

            if (!match) {
                setPasteError('Invalid schedule link format');
                return;
            }

            const scheduleId = match[1];

            // Fetch the shared schedule
            const sharedScheduleData = await getSharedSchedule(scheduleId);
            const scheduleEvents = sharedScheduleData.shared_schedule.schedule_data.events;

            // Import the events into the current calendar
            if (scheduleEvents && scheduleEvents.length > 0) {
                // Check if user is authenticated for backend storage
                const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

                if (token && loadFromBackend) {
                    // Save to backend if authenticated
                    const { createCalendarEvent } = await import('@/lib/api');

                    for (const event of scheduleEvents) {
                        try {
                            const eventData = {
                                title: event.title,
                                start_time: event.startTime,
                                end_time: event.endTime,
                                day_of_week: event.day_of_week,
                                start_date: event.start_date,
                                end_date: event.end_date,
                                description: event.description || '',
                                professor: event.professor || '',
                                recurrence_pattern: event.recurrence_pattern || 'weekly',
                                reference_date: event.reference_date,
                                theme: event.theme || 'lavender-peach'
                            };

                            await createCalendarEvent(eventData);
                        } catch (eventError) {
                            console.error('Failed to save event to backend:', eventError);
                        }
                    }

                    // Refresh backend events
                    if (onRefresh) {
                        onRefresh();
                    }
                } else {
                    // Add to local events if not authenticated or not using backend
                    scheduleEvents.forEach(event => {
                        if (onAddEvent) {
                            onAddEvent({
                                id: event.id,
                                title: event.title,
                                startTime: event.startTime,
                                endTime: event.endTime,
                                day_of_week: event.day_of_week,
                                start_date: event.start_date,
                                end_date: event.end_date,
                                description: event.description || '',
                                professor: event.professor || '',
                                recurrence_pattern: event.recurrence_pattern || 'weekly',
                                reference_date: event.reference_date,
                                theme: event.theme || 'lavender-peach'
                            });
                        }
                    });
                }

                // Close the modal
                handleClosePasteModal();

                // Show success message
                alert(`Successfully imported ${scheduleEvents.length} events from shared schedule!`);
            } else {
                setPasteError('No events found in the shared schedule');
            }

        } catch (error) {
            console.error('Paste schedule failed:', error);
            setPasteError(error instanceof Error ? error.message : 'Failed to load shared schedule');
        } finally {
            setPasteLoading(false);
        }
    };

    // Handler for pasting from clipboard
    const handlePasteFromClipboard = async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                const clipboardText = await navigator.clipboard.readText();
                setPasteUrl(clipboardText);
                setPasteError(null);
            } else {
                setPasteError('Clipboard access not available. Please paste the link manually.');
            }
        } catch (error) {
            console.error('Failed to read clipboard:', error);
            setPasteError('Failed to read clipboard. Please paste the link manually.');
        }
    };

    const handleEditFromMobileDetails = () => {
        if (mobileEventDetails) {
            setEditingEvent(mobileEventDetails);
            setMobileEventDetails(null);
        }
    };

    const handleShowConflicts = () => {
        setShowConflictsModal(true);
    };

    const handleCloseConflictsModal = () => {
        setShowConflictsModal(false);
    };

    // Handler for closing share modal
    const handleCloseShareModal = () => {
        setShowShareModal(false);
        setShareUrl('');
        setShareLoading(false);
    };

    useEffect(() => {
        // Define styles inside useEffect to avoid server-side rendering issues
        const styles = `
        .weekly-calendar {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            background: rgb(var(--background-rgb));
            transition: all 0.3s ease;
            position: relative;
        }

        .dark .weekly-calendar {
            background: rgb(var(--background-rgb));
        }



        .calendar-header {
            padding: 1.5rem 2rem;
            border-bottom: 1px solid transparent;
            background: #f9fafb;
            flex-shrink: 0;
            transition: all 0.3s ease;
            min-height: 80px;
            display: flex;
            align-items: center;
        }

        .dark .calendar-header {
            border-bottom-color: ${isKairollView ? 'rgba(42, 47, 54, 0.5)' : 'rgba(255, 255, 255, 0.1)'};
            background: ${isKairollView ? '#1C1F26' : 'rgba(255, 255, 255, 0.02)'};
        }

        .weekly-grid-container {
            background: rgb(var(--card-bg));
            border: 2px solid transparent;
            border-radius: 8px;
            overflow: hidden;
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
            flex: 1 1 auto; /* fill remaining space below header */
            height: auto;
            min-height: 0; /* allow flex child to shrink within container */
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }

        /* Grid layout with narrow time column */
        .grid-cols-8-narrow {
            display: grid;
            grid-template-columns: 60px 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
        }

        /* Mobile-only grid layout with weekdays only (Monday-Friday) */
        .grid-cols-6-mobile {
            display: grid;
            grid-template-columns: 50px 1fr 1fr 1fr 1fr 1fr;
        }

        /* Mobile responsive grid switching */
        @media (max-width: 640px) {
            .grid-cols-8-narrow {
                display: none;
            }
            
            .grid-cols-6-mobile {
                display: grid;
            }

            /* Larger, more touch-friendly mobile grid cells */
            .mobile-time-slot {
                min-height: 70px !important;
                height: 70px !important;
            }

            .mobile-time-label {
                width: 50px !important;
                padding: 0.75rem 0.25rem !important;
                font-size: 0.7rem !important;
                font-weight: 700 !important;
            }

            .mobile-day-header {
                padding: 1rem 0.5rem !important;
                font-size: 0.8rem !important;
                min-height: 60px !important;
            }
        }

        /* Desktop view - hide mobile grid */
        @media (min-width: 769px) {
            .grid-cols-8-narrow {
                display: grid;
            }
            
            .grid-cols-6-mobile {
                display: none;
            }
        }

        .dark .weekly-grid-container {
            background: rgb(var(--card-bg));
            border-color: ${isKairollView ? '#2A2F36' : 'rgb(var(--border-color))'};
        }

        .days-header {
            display: flex;
            border-bottom: 2px solid transparent;
            background: rgb(var(--secondary-bg));
            position: sticky;
            top: 0;
            z-index: 20;
            transition: all 0.3s ease;
            flex-shrink: 0;
            margin-top: 0.5rem;
            backdrop-filter: blur(8px);
            align-items: center;
            min-height: 50px;
        }

        .dark .days-header {
            border-bottom-color: transparent;
            background: rgb(var(--secondary-bg));
        }

        .time-grid {
            display: block;
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: thin;
            scrollbar-color: rgba(156, 163, 175, 0.4) transparent;
            /* Force proper height for scrolling */
            height: 100%;
            max-height: none;
            position: relative;
        }

        /* Universal scrollbar styling for all screen sizes */
        .time-grid::-webkit-scrollbar {
            width: 8px;
        }

        .time-grid::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.05);
            border-radius: 4px;
        }

        .time-grid::-webkit-scrollbar-thumb {
            background-color: rgba(156, 163, 175, 0.5);
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .time-grid::-webkit-scrollbar-thumb:hover {
            background-color: rgba(156, 163, 175, 0.7);
        }

        .dark .time-grid::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
        }

        .dark .time-grid::-webkit-scrollbar-thumb {
            background-color: rgba(156, 163, 175, 0.6);
            border: 1px solid rgba(0, 0, 0, 0.2);
        }

        .dark .time-grid::-webkit-scrollbar-thumb:hover {
            background-color: rgba(156, 163, 175, 0.8);
        }

        .time-slot {
            display: flex;
            border-bottom: 1px solid transparent;
            min-height: 60px;
            height: 60px;
            transition: all 0.15s ease;
            align-items: stretch;
            background: black;
        }

        .dark .time-slot {
            border-bottom-color: transparent;
            background: ${isKairollView ? '#1C1F26' : 'black'};
        }

        .time-slot:hover {
            background-color: #111827;
        }

        .dark .time-slot:hover {
            background-color: ${isKairollView ? '#252A31' : '#111827'};
        }

        .time-label {
            width: 60px;
            padding: 0.5rem;
            text-align: center;
            font-size: 0.7rem;
            color: #9ca3af;
            border-right: 1px solid transparent;
            background: #111827;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: all 0.3s ease;
            position: sticky;
            left: 0;
            z-index: 15;
            backdrop-filter: blur(8px);
            font-weight: 500;
        }

        .dark .time-label {
            color: #9ca3af;
            border-right-color: transparent;
            background: #111827;
        }

        .day-column {
            flex: 1;
            position: relative;
            border-right: 1px solid transparent;
            transition: all 0.3s ease;
            min-width: 0;
            height: 60px;
            display: flex;
            align-items: stretch;
            background: rgb(var(--background-rgb));
        }

        .dark .day-column {
            border-right-color: transparent;
            background: rgb(var(--background-rgb));
        }

        .day-column:last-child {
            border-right: none;
        }

        .events-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
        }

        .event-block {
            position: absolute;
            pointer-events: auto;
            backdrop-filter: blur(8px);
            border: 2px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
            border-radius: 6px;
            padding: 4px 6px;
            font-size: 0.75rem;
            font-weight: 500;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: flex-start;
            /* All other styles will be applied via JavaScript for precise control */
        }

        .event-block:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10;
        }

        /* Mobile specific styles - FIXED LAYOUT AND SPACING */
        @media (max-width: 640px) {
            .weekly-calendar {
                height: 100vh;
                overflow-x: hidden;
                width: 100%;
                position: relative;
                display: flex;
                flex-direction: column;
                background: rgb(var(--background-rgb));
            }

            .dark .weekly-calendar {
                background: rgb(var(--background-rgb));
            }

            /* Compact view for mobile with many events */
            .compact-mobile-events {
                display: none;
            }

            @media (max-width: 480px) {
                .event-block {
                    font-size: 0.6rem !important;
                    padding: 2px 4px !important;
                    min-height: 16px !important;
                    line-height: 1.1 !important;
                    white-space: nowrap !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                }
                
                /* Show abbreviated event text on very small screens */
                .event-title-full {
                    display: none;
                }
                
                .event-title-short {
                    display: block;
                }
            }

            .weekly-grid-container {
                flex: 1;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                height: calc(100vh - 160px);
                height: calc(100dvh - 160px);
                max-height: none;
            }

            .days-header {
                margin-top: 0;
                flex-shrink: 0;
                height: 50px;
                display: flex;
                align-items: center;
                border-bottom: 2px solid transparent;
                background: #f9fafb;
                position: sticky;
                top: 0;
                z-index: 20;
            }

            .dark .days-header {
                border-bottom-color: rgba(255, 255, 255, 0.1);
                background: rgba(255, 255, 255, 0.02);
            }

            .days-header > div {
                padding: 0.75rem 0.25rem !important;
                font-size: 0.75rem !important;
                font-weight: 600 !important;
                text-align: center;
            }

            .time-grid {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                display: block;
                scrollbar-width: thin;
            scrollbar-color: rgba(156, 163, 175, 0.4) transparent;
            background: rgb(var(--background-rgb));
                height: 100%;
                max-height: none;
            }

            .dark .time-grid {
                background: black;
            }

            .time-grid::-webkit-scrollbar {
                width: 6px;
            }

            .time-grid::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.05);
                border-radius: 3px;
            }

            .time-grid::-webkit-scrollbar-thumb {
                background-color: rgba(156, 163, 175, 0.5);
                border-radius: 3px;
            }

            .time-grid::-webkit-scrollbar-thumb:hover {
                background-color: rgba(156, 163, 175, 0.7);
            }

            .time-label {
                width: 50px;
                padding: 0.5rem 0.25rem;
                font-size: 0.65rem;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                background: #f9fafb;
                border-right: 1px solid transparent;
                color: #6b7280;
                text-align: center;
                min-height: 60px;
            }

            .dark .time-label {
                background: rgba(255, 255, 255, 0.02);
                border-right-color: rgba(255, 255, 255, 0.08);
                color: rgba(255, 255, 255, 0.6);
            }

            .time-slot {
                min-height: 50px;
                height: 50px;
                display: flex;
                border-bottom: 1px solid transparent;
                align-items: stretch;
            }

            .dark .time-slot {
                border-bottom-color: rgba(255, 255, 255, 0.08);
            }

            .day-column {
                flex: 1;
                position: relative;
                border-right: 1px solid transparent;
            height: 50px;
            background: rgb(var(--card-bg));
            }

            .dark .day-column {
                border-right-color: rgba(255, 255, 255, 0.08);
                background: black;
            }

            .day-column:last-child {
                border-right: none;
            }

            .event-block {
                /* Mobile styles handled by JavaScript for precise alignment */
            }

            /* Improve touch interaction */
            .time-slot {
                cursor: pointer;
                touch-action: manipulation;
                -webkit-tap-highlight-color: rgba(59, 130, 246, 0.1);
            }

            .time-slot:active {
                background-color: rgba(59, 130, 246, 0.05);
                transform: scale(0.98);
                transition: all 0.1s ease;
            }

            .dark .time-slot:active {
                background-color: rgba(59, 130, 246, 0.1);
            }

            /* Better event touch interaction */
            .event-block {
                cursor: pointer;
                touch-action: manipulation;
                -webkit-tap-highlight-color: rgba(255, 255, 255, 0.2);
                transition: transform 0.1s ease;
            }

            .event-block:active {
                transform: scale(0.95);
            }

            /* FIXED: Remove any layout shifts */
            .weekly-calendar .time-grid:last-child {
                margin-bottom: 0;
                padding-bottom: 0;
            }

            /* Ensure proper alignment */
            .events-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
            }

            /* Enhanced vertical grid lines - responsive alignment */
            .vertical-grid-line {
                position: absolute;
                top: 0;
                bottom: 0;
                background: rgba(156, 163, 175, 0.6);
                z-index: 20;
                pointer-events: none;
            }

            .dark .vertical-grid-line {
                background: rgba(107, 114, 128, 0.7);
            }

            /* Header-only vertical dividers - only appear in day headers with purple RGB colors */
            .header-vertical-line {
                position: absolute;
                top: 0;
                bottom: 0;
                background: linear-gradient(180deg, 
                    rgb(139, 69, 193) 0%,     /* Purple #8b45c1 */
                    rgb(168, 85, 247) 25%,    /* Bright Purple #a855f7 */
                    rgb(147, 51, 234) 50%,    /* Deep Purple #9333ea */
                    rgb(124, 58, 237) 75%,    /* Rich Purple #7c3aed */
                    rgb(139, 69, 193) 100%);  /* Back to Purple #8b45c1 */
                z-index: 25;
                pointer-events: none;
                opacity: 0.8;
                animation: headerPurpleShift 6s ease-in-out infinite;
            }

            @keyframes headerPurpleShift {
                0% {
                    background: linear-gradient(180deg, 
                        rgb(139, 69, 193) 0%, 
                        rgb(168, 85, 247) 25%, 
                        rgb(147, 51, 234) 50%, 
                        rgb(124, 58, 237) 75%, 
                        rgb(139, 69, 193) 100%);
                }
                33% {
                    background: linear-gradient(180deg, 
                        rgb(168, 85, 247) 0%, 
                        rgb(147, 51, 234) 25%, 
                        rgb(124, 58, 237) 50%, 
                        rgb(139, 69, 193) 75%, 
                        rgb(168, 85, 247) 100%);
                }
                66% {
                    background: linear-gradient(180deg, 
                        rgb(147, 51, 234) 0%, 
                        rgb(124, 58, 237) 25%, 
                        rgb(139, 69, 193) 50%, 
                        rgb(168, 85, 247) 75%, 
                        rgb(147, 51, 234) 100%);
                }
                100% {
                    background: linear-gradient(180deg, 
                        rgb(139, 69, 193) 0%, 
                        rgb(168, 85, 247) 25%, 
                        rgb(147, 51, 234) 50%, 
                        rgb(124, 58, 237) 75%, 
                        rgb(139, 69, 193) 100%);
                }
            }

            .dark .header-vertical-line {
                background: linear-gradient(180deg, 
                    rgb(139, 69, 193) 0%, 
                    rgb(168, 85, 247) 25%, 
                    rgb(147, 51, 234) 50%, 
                    rgb(124, 58, 237) 75%, 
                    rgb(139, 69, 193) 100%);
                opacity: 0.9;
            }
        }

        /* Mobile styles (481px - 640px) */
        @media (max-width: 640px) and (min-width: 481px) {
            .time-label {
                width: 65px;
                padding: 0.5rem 0.25rem;
                font-size: 0.7rem;
            }

            .time-slot {
                min-height: 3.5rem;
            }

            .day-column {
                min-height: 3.5rem;
                padding: 0.25rem;
            }

            .event-block {
                font-size: 0.65rem;
                padding: 0.3rem 0.4rem;
                min-height: 20px;
                line-height: 1.3;
            }

            .days-header > div {
                padding: 0.6rem 0.3rem !important;
                font-size: 0.75rem !important;
            }
        }

        /* Mobile styles (320px - 480px) - Better readability */
        @media (max-width: 480px) {
            .weekly-calendar {
                height: 100vh;
                height: 100dvh;
                overflow: hidden;
                padding: 0;
                position: relative;
            }

            .weekly-grid-container {
                height: calc(100vh - 140px);
                height: calc(100dvh - 140px);
                max-height: calc(100vh - 140px);
                max-height: calc(100dvh - 140px);
                overflow: hidden;
                margin: 0;
                padding: 0 0.5rem;
                position: relative;
            }

            .time-grid {
                overflow-y: auto;
                overflow-x: hidden;
                scroll-behavior: smooth;
                -webkit-overflow-scrolling: touch;
                padding-bottom: 2rem;
                position: relative;
            }

            /* Better time labels for mobile */
            .time-label {
                width: 45px;
                padding: 0.4rem 0.2rem;
                font-size: 0.65rem;
                font-weight: 600;
                line-height: 1.1;
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                position: sticky;
                left: 0;
                background: inherit;
                z-index: 10;
            }

            /* Optimal time slot height for mobile with precise timing */
            .time-slot {
                min-height: 3.5rem;
                height: 3.5rem;
                border-bottom-width: 1px;
                position: relative;
                display: flex;
                align-items: stretch;
            }

            /* Better day column spacing with exact positioning */
            .day-column {
                min-height: 3.5rem;
                height: 3.5rem;
                padding: 0.2rem;
                min-width: 0;
                flex: 1;
                position: relative;
                border-right: 1px solid rgba(0,0,0,0.05);
            }

            /* Improved event blocks for mobile with perfect time alignment */
            .event-block {
                /* All mobile event styles handled by JavaScript for precise time alignment */
            }

            /* Ensure event positioning matches grid on mobile with exact calculations */
            .events-overlay {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                height: 100% !important;
                z-index: 5 !important;
                pointer-events: none !important;
            }

            /* Mobile event text visibility */
            .event-block * {
                color: white !important;
                text-shadow: 0 1px 2px rgba(0,0,0,0.8) !important;
                font-size: inherit !important;
            }

            /* Better day headers for mobile */
            .days-header {
                height: auto;
                min-height: 40px;
                padding: 0.25rem 0;
                flex-shrink: 0;
            }

            .days-header > div {
                padding: 0.5rem 0.15rem !important;
                font-size: 0.65rem !important;
                font-weight: 600 !important;
                line-height: 1.2 !important;
                min-width: 0;
                flex: 1;
            }

            /* First column (time) in header */
            .days-header > div:first-child {
                width: 45px !important;
                flex: none !important;
                font-size: 0.6rem !important;
            }

            /* Prevent horizontal scrolling */
            * {
                box-sizing: border-box;
            }

            .weekly-calendar, .weekly-grid-container, .time-grid, .time-slot, .days-header {
                width: 100%;
                max-width: 100%;
                overflow-x: hidden;
            }
        }

        /* Extra small mobile styles (320px - 375px) - Enhanced time precision */
        @media (max-width: 375px) {
            .time-slot {
                min-height: 4rem;
                height: 4rem;
            }

            .day-column {
                min-height: 4rem;
                height: 4rem;
                padding: 0.15rem;
            }

            .time-label {
                width: 40px;
                font-size: 0.6rem;
                padding: 0.3rem 0.1rem;
            }

            .event-block {
                /* Extra small mobile styles handled by JavaScript */
            }

            .days-header > div:first-child {
                width: 40px !important;
                font-size: 0.55rem !important;
            }

            .days-header > div {
                font-size: 0.6rem !important;
                padding: 0.4rem 0.1rem !important;
            }
        }

        /* Extra small mobile (320px and below) */
        @media (max-width: 320px) {
            .time-label {
                width: 35px;
                padding: 0.3rem 0.1rem;
                font-size: 0.55rem;
            }

            .time-slot {
                min-height: 3rem;
                height: 3rem;
            }

            .day-column {
                min-height: 3rem;
                padding: 0.15rem;
            }

            .event-block {
                /* 320px mobile styles handled by JavaScript */
            }

            .days-header > div {
                padding: 0.4rem 0.1rem !important;
                font-size: 0.6rem !important;
            }

            .days-header > div:first-child {
                width: 35px !important;
                font-size: 0.55rem !important;
            }
        }



        /* Desktop/Tablet styles (640px+) - Enhanced scrolling and larger time slots */
        @media (min-width: 640px) {
            .weekly-calendar {
                height: 100%;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .weekly-grid-container {
                flex: 1;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                min-height: 0;
            }

            .days-header {
                flex-shrink: 0;
                height: 70px;
                display: flex;
                align-items: center;
                border-bottom: 2px solid #e5e7eb;
                background: #f9fafb;
                position: sticky;
                top: 0;
                z-index: 20;
            }

            .dark .days-header {
                border-bottom-color: rgba(255, 255, 255, 0.1);
                background: rgba(255, 255, 255, 0.02);
            }

            .days-header > div {
                padding: 1rem 0.75rem !important;
                font-size: 0.95rem !important;
                font-weight: 600 !important;
                text-align: center;
            }

            .time-grid {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                display: block;
                scrollbar-width: thin;
            scrollbar-color: rgba(156, 163, 175, 0.4) transparent;
            background: rgb(var(--background-rgb));
                scroll-behavior: smooth;
                -webkit-overflow-scrolling: touch;
                height: 100%;
                max-height: none;
            }

            .dark .time-grid {
                background: black;
            }

            /* Desktop scrollbar styling - slightly larger */
            .time-grid::-webkit-scrollbar {
                width: 10px;
            }

            .time-grid::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.05);
                border-radius: 5px;
            }

            .time-grid::-webkit-scrollbar-thumb {
                background-color: rgba(156, 163, 175, 0.5);
                border-radius: 5px;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }

            .time-grid::-webkit-scrollbar-thumb:hover {
                background-color: rgba(156, 163, 175, 0.7);
            }

            .time-label {
                width: 85px;
                padding: 1rem 0.75rem;
                font-size: 0.85rem;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                background: #f9fafb;
                border-right: 1px solid #e5e7eb;
                color: #6b7280;
                text-align: center;
                min-height: 60px;
            }

            .dark .time-label {
                background: rgba(255, 255, 255, 0.02);
                border-right-color: rgba(255, 255, 255, 0.08);
                color: rgba(255, 255, 255, 0.6);
            }

            .time-slot {
                min-height: 70px;
                height: 70px;
                display: flex;
                border-bottom: 1px solid #e5e7eb;
                align-items: stretch;
            }

            .dark .time-slot {
                border-bottom-color: rgba(255, 255, 255, 0.08);
            }

            .day-column {
                flex: 1;
                position: relative;
                border-right: 1px solid #e5e7eb;
            height: 70px;
            background: rgb(var(--card-bg));
                padding: 3px;
            }

            .dark .day-column {
                border-right-color: rgba(255, 255, 255, 0.08);
                background: black;
            }

            .day-column:last-child {
                border-right: none;
            }

            /* Desktop optimized event blocks */
            .event-block {
                /* Desktop event styles handled by JavaScript for precise time alignment */
            }

            .event-block:hover {
                transform: translateY(-2px) scale(1.02) !important;
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15) !important;
                z-index: 10 !important;
            }

            /* Ensure event text is always visible on desktop */
            .event-block *,
            .event-block .event-title,
            .event-block .event-time {
                color: white !important;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7) !important;
            }

            .events-overlay {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                pointer-events: none !important;
                z-index: 5 !important;
            }

            /* Better interaction for desktop */
            .time-slot {
                cursor: pointer;
                transition: background-color 0.15s ease;
            }

            .time-slot:hover {
                background-color: rgba(59, 130, 246, 0.03);
            }

            .dark .time-slot:hover {
                background-color: rgba(59, 130, 246, 0.05);
            }

            .event-block {
                transition: all 0.2s ease;
            }

            .event-block:hover {
                transform: translateY(-2px) scale(1.02) !important;
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2) !important;
            }
        }

        /* Animation classes */
        .weekly-grid-container.animating {
            transition: transform 0.3s ease-out, opacity 0.3s ease-out;
        }

        .weekly-grid-container.slide-next {
            transform: translateX(20px);
            opacity: 0.7;
        }

        .weekly-grid-container.slide-prev {
            transform: translateX(-20px);
            opacity: 0.7;
        }
        `;

        // Inject styles into the document on the client side
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);

        // Cleanup function to remove the styles when the component unmounts
        return () => {
            if (document.head.contains(styleSheet)) {
                document.head.removeChild(styleSheet);
            }
        };
    }, []);

    return (
        <div className="font-mono weekly-calendar h-full overflow-hidden">
            {/* Mobile Calendar Header - THEME RESPONSIVE */}
            <div className={`block sm:hidden ${themeStyles.navBg} border-b ${themeStyles.navBorder} px-4 py-3 sticky top-0 z-50`}>
                {/* Main Header Row */}
                <div className="flex items-center justify-between">
                    {/* Left: Date Range with Navigation */}
                    <div className="flex items-center gap-2">
                        {/* Date Range Display */}
                        <div>
                            <span className={`${themeStyles.navText} font-semibold text-sm`}>
                                {format(weekStart, 'MMM d')}–{format(addDays(weekStart, 6), 'd')},
                            </span>
                            <span className="text-gray-400 dark:text-gray-500 font-semibold text-sm ml-1">
                                {format(weekStart, 'yyyy')}
                            </span>
                        </div>

                        {/* Navigation Arrows */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={goToPreviousWeek}
                                disabled={isAnimating}
                                className={`p-1 ${themeStyles.navText} hover:opacity-70 transition-opacity duration-200 ${isAnimating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={goToNextWeek}
                                disabled={isAnimating}
                                className={`p-1 ${themeStyles.navText} hover:opacity-70 transition-opacity duration-200 ${isAnimating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Today Button */}
                        {onDateChange && (
                            <button
                                onClick={goToToday}
                                className="px-2 py-1 bg-transparent border border-gray-300/50 dark:border-white/8 rounded-md text-gray-600 dark:text-[#aaaaaa] text-xs font-medium hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-white hover:border-gray-400/60 dark:hover:border-white/15 transition-all duration-300"
                                title="Go to current week"
                            >
                                Today
                            </button>
                        )}
                    </div>
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center justify-center gap-2 mt-3">
                    {!readOnly && hasScheduleContent(allEvents) && (
                        <button
                            onClick={handleShareSchedule}
                            className="group px-2 py-1 bg-transparent border border-[#4a90e2]/20 dark:border-[#4a90e2]/20 rounded-md text-[#4a90e2] dark:text-[#4a90e2] text-xs font-medium hover:bg-[#4a90e2]/10 dark:hover:bg-white/5 hover:text-[#3a7bc8] dark:hover:text-white hover:border-[#4a90e2]/40 dark:hover:border-white/15 transition-all duration-300 flex items-center gap-1"
                            title="Share schedule"
                        >
                            <Share2 className="w-3 h-3 text-[#4a90e2] group-hover:text-blue-400 transition-colors duration-300" />
                            Share
                        </button>
                    )}
                    {hasEventsToExport(allEvents) && (
                        <button
                            onClick={handleExportCalendar}
                            className="group px-2 py-1 bg-transparent border border-[#4caf81]/20 dark:border-[#4caf81]/20 rounded-md text-[#4caf81] dark:text-[#4caf81] text-xs font-medium hover:bg-[#4caf81]/10 dark:hover:bg-white/5 hover:text-[#3d8b5c] dark:hover:text-white hover:border-[#4caf81]/40 dark:hover:border-white/15 transition-all duration-300 flex items-center gap-1"
                            title="Export calendar as .ics file"
                        >
                            <Download className="w-3 h-3 text-[#4caf81] group-hover:text-green-400 transition-colors duration-300" />
                            Export
                        </button>
                    )}
                    {!readOnly && hasEventsToExport(allEvents) && (
                        <button
                            onClick={handleDeleteEvents}
                            className="group px-2 py-1 bg-transparent border border-[#cc4444]/20 dark:border-[#cc4444]/20 rounded-md text-[#cc4444] dark:text-[#cc4444] text-xs font-medium hover:bg-[#cc4444]/10 dark:hover:bg-white/5 hover:text-[#a53333] dark:hover:text-white hover:border-[#cc4444]/40 dark:hover:border-white/15 transition-all duration-300 flex items-center gap-1"
                            title="Delete events"
                        >
                            <svg className="w-3 h-3 text-[#cc4444] group-hover:text-red-400 transition-colors duration-300" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 7H5l1 12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2l1-12z" />
                                <path d="M9 4V3c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v1h5c.6 0 1 .4 1 1s-.4 1-1 1H3c-.6 0-1-.4-1-1s.4-1 1-1h6zm2 0h2V3h-2v1z" />
                                <path d="M10 9v8c0 .6.4 1 1 1s1-.4 1-1V9c0-.6-.4-1-1-1s-1 .4-1 1z" />
                                <path d="M14 9v8c0 .6.4 1 1 1s1-.4 1-1V9c0-.6-.4-1-1-1s-1 .4-1 1z" />
                            </svg>
                            Delete
                        </button>
                    )}
                    <button
                        onClick={handleOpenPasteModal}
                        className="group px-2 py-1 bg-transparent border border-[#a973d3]/20 dark:border-[#a973d3]/20 rounded-md text-[#a973d3] dark:text-[#a973d3] text-xs font-medium hover:bg-[#a973d3]/10 dark:hover:bg-white/5 hover:text-[#8a5bb8] dark:hover:text-white hover:border-[#a973d3]/40 dark:hover:border-white/15 transition-all duration-300 flex items-center gap-1"
                        title="Paste shared schedule link"
                    >
                        <Clipboard className="w-3 h-3 text-[#a973d3] group-hover:text-purple-400 transition-colors duration-300" />
                        Paste
                    </button>
                </div>
            </div>

            {/* Desktop Calendar Header - THEME RESPONSIVE */}
            <div className={`hidden sm:block ${themeStyles.navBg} border-b ${themeStyles.navBorder} px-4 lg:px-6 py-2.5`}>

                {/* Full width layout for large screens */}
                <div className="hidden xl:flex items-center justify-between">
                    {/* Left: Date Range Display with Navigation and Today Button */}
                    <div className="flex items-center gap-4">
                        {/* Date Range */}
                        <div>
                            <span className={`${themeStyles.navText} font-semibold text-lg`}>
                                {format(weekStart, 'MMM d')}–{format(addDays(weekStart, 6), 'd')},
                            </span>
                            <span className="text-gray-400 dark:text-gray-500 font-semibold text-lg ml-1">
                                {format(weekStart, 'yyyy')}
                            </span>
                        </div>

                        {/* Navigation Arrows */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={goToPreviousWeek}
                                disabled={isAnimating}
                                className={`p-1 ${themeStyles.navText} hover:opacity-70 transition-opacity duration-200 ${isAnimating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={goToNextWeek}
                                disabled={isAnimating}
                                className={`p-1 ${themeStyles.navText} hover:opacity-70 transition-opacity duration-200 ${isAnimating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Today Button */}
                        {onDateChange && (
                            <button
                                onClick={goToToday}
                                className="px-3 py-1 bg-transparent border border-gray-300/50 dark:border-white/8 rounded-md text-gray-600 dark:text-[#aaaaaa] text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-white hover:border-gray-400/60 dark:hover:border-white/15 transition-all duration-300"
                                title="Go to current week"
                            >
                                Today
                            </button>
                        )}
                    </div>

                    {/* Center: Course and Conflicts Badges - Only show in Kairoll view */}
                    {isKairollView && (
                        <div className="flex items-center gap-3">
                            <CounterBadge count={courseCount} label="courses" />
                            <CounterBadge
                                count={conflictsCount}
                                label="conflicts"
                                variant="warning"
                                clickable={true}
                                onClick={handleShowConflicts}
                            />
                        </div>
                    )}

                    {/* Right: Action Buttons */}
                    <div className="flex items-center gap-2">
                        {!readOnly && hasScheduleContent(allEvents) && (
                            <button
                                onClick={handleShareSchedule}
                                className="group px-3 py-1 bg-transparent border border-[#4a90e2]/20 dark:border-[#4a90e2]/20 rounded-md text-[#4a90e2] dark:text-[#4a90e2] text-sm font-medium hover:bg-[#4a90e2]/10 dark:hover:bg-white/5 hover:text-[#3a7bc8] dark:hover:text-white hover:border-[#4a90e2]/40 dark:hover:border-white/15 transition-all duration-300 flex items-center gap-1.5"
                                title="Share schedule"
                            >
                                <Share2 className="w-3.5 h-3.5 text-[#4a90e2] group-hover:text-blue-400 transition-colors duration-300" />
                                Share
                            </button>
                        )}
                        {hasEventsToExport(allEvents) && (
                            <button
                                onClick={handleExportCalendar}
                                className="group px-3 py-1 bg-transparent border border-[#4caf81]/20 dark:border-[#4caf81]/20 rounded-md text-[#4caf81] dark:text-[#4caf81] text-sm font-medium hover:bg-[#4caf81]/10 dark:hover:bg-white/5 hover:text-[#3d8b5c] dark:hover:text-white hover:border-[#4caf81]/40 dark:hover:border-white/15 transition-all duration-300 flex items-center gap-1.5"
                                title="Export calendar as .ics file"
                            >
                                <Download className="w-3.5 h-3.5 text-[#4caf81] group-hover:text-green-400 transition-colors duration-300" />
                                Export
                            </button>
                        )}
                        {!readOnly && hasEventsToExport(allEvents) && (
                            <button
                                onClick={handleDeleteEvents}
                                className="group px-3 py-1 bg-transparent border border-[#cc4444]/20 dark:border-[#cc4444]/20 rounded-md text-[#cc4444] dark:text-[#cc4444] text-sm font-medium hover:bg-[#cc4444]/10 dark:hover:bg-white/5 hover:text-[#a53333] dark:hover:text-white hover:border-[#cc4444]/40 dark:hover:border-white/15 transition-all duration-300 flex items-center gap-1.5"
                                title="Delete events"
                            >
                                <svg className="w-3.5 h-3.5 text-[#cc4444] group-hover:text-red-400 transition-colors duration-300" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 7H5l1 12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2l1-12z" />
                                    <path d="M9 4V3c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v1h5c.6 0 1 .4 1 1s-.4 1-1 1H3c-.6 0-1-.4-1-1s.4-1 1-1h6zm2 0h2V3h-2v1z" />
                                    <path d="M10 9v8c0 .6.4 1 1 1s1-.4 1-1V9c0-.6-.4-1-1-1s-1 .4-1 1z" />
                                    <path d="M14 9v8c0 .6.4 1 1 1s1-.4 1-1V9c0-.6-.4-1-1-1s-1 .4-1 1z" />
                                </svg>
                                Delete
                            </button>
                        )}
                        <button
                            onClick={handleOpenPasteModal}
                            className="group px-3 py-1 bg-transparent border border-[#a973d3]/20 dark:border-[#a973d3]/20 rounded-md text-[#a973d3] dark:text-[#a973d3] text-sm font-medium hover:bg-[#a973d3]/10 dark:hover:bg-white/5 hover:text-[#8a5bb8] dark:hover:text-white hover:border-[#a973d3]/40 dark:hover:border-white/15 transition-all duration-300 flex items-center gap-1.5"
                            title="Paste shared schedule link"
                        >
                            <Clipboard className="w-3.5 h-3.5 text-[#a973d3] group-hover:text-purple-400 transition-colors duration-300" />
                            Paste
                        </button>
                    </div>
                </div>

                {/* Compact layout for medium screens (md to xl) */}
                <div className="xl:hidden flex flex-col gap-3">
                    {/* Course and Conflicts Badges - Only show in Kairoll view */}
                    {isKairollView && (
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <div className="flex items-center gap-3">
                                <CounterBadge count={courseCount} label="courses" />
                                <CounterBadge
                                    count={conflictsCount}
                                    label="conflicts"
                                    variant="warning"
                                    clickable={true}
                                    onClick={handleShowConflicts}
                                />
                            </div>
                        </div>
                    )}

                    {/* Main Header Row */}
                    <div className="flex items-center justify-between">
                        {/* Left: Date Range Display with Navigation and Today Button */}
                        <div className="flex items-center gap-3">
                            {/* Date Range */}
                            <div>
                                <span className={`${themeStyles.navText} font-semibold`}>
                                    {format(weekStart, 'MMM d')}–{format(addDays(weekStart, 6), 'd')},
                                </span>
                                <span className="text-gray-400 dark:text-gray-500 font-semibold ml-1">
                                    {format(weekStart, 'yyyy')}
                                </span>
                            </div>

                            {/* Navigation Arrows */}
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={goToPreviousWeek}
                                    disabled={isAnimating}
                                    className={`p-1 ${themeStyles.navText} hover:opacity-70 transition-opacity duration-200 ${isAnimating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={goToNextWeek}
                                    disabled={isAnimating}
                                    className={`p-1 ${themeStyles.navText} hover:opacity-70 transition-opacity duration-200 ${isAnimating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Today Button */}
                            {onDateChange && (
                                <button
                                    onClick={goToToday}
                                    className="px-3 py-1 bg-transparent border border-gray-300/50 dark:border-white/8 rounded-md text-gray-600 dark:text-[#aaaaaa] text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-white hover:border-gray-400/60 dark:hover:border-white/15 transition-all duration-300"
                                    title="Go to current week"
                                >
                                    Today
                                </button>
                            )}
                        </div>

                        {/* Right: Action Buttons */}
                        <div className="flex items-center gap-2">
                            {!readOnly && hasScheduleContent(allEvents) && (
                                <button
                                    onClick={handleShareSchedule}
                                    className="group px-3 py-1 bg-transparent border border-[#4a90e2]/20 dark:border-[#4a90e2]/20 rounded-md text-[#4a90e2] dark:text-[#4a90e2] text-sm font-medium hover:bg-[#4a90e2]/10 dark:hover:bg-white/5 hover:text-[#3a7bc8] dark:hover:text-white hover:border-[#4a90e2]/40 dark:hover:border-white/15 transition-all duration-300 flex items-center gap-1.5"
                                    title="Share schedule"
                                >
                                    <Share2 className="w-3.5 h-3.5 text-[#4a90e2] group-hover:text-blue-400 transition-colors duration-300" />
                                    Share
                                </button>
                            )}
                            {hasEventsToExport(allEvents) && (
                                <button
                                    onClick={handleExportCalendar}
                                    className="group px-3 py-1 bg-transparent border border-[#4caf81]/20 dark:border-[#4caf81]/20 rounded-md text-[#4caf81] dark:text-[#4caf81] text-sm font-medium hover:bg-[#4caf81]/10 dark:hover:bg-white/5 hover:text-[#3d8b5c] dark:hover:text-white hover:border-[#4caf81]/40 dark:hover:border-white/15 transition-all duration-300 flex items-center gap-1.5"
                                    title="Export calendar as .ics file"
                                >
                                    <Download className="w-3.5 h-3.5 text-[#4caf81] group-hover:text-green-400 transition-colors duration-300" />
                                    Export
                                </button>
                            )}
                            {!readOnly && hasEventsToExport(allEvents) && (
                                <button
                                    onClick={handleDeleteEvents}
                                    className="group px-3 py-1 bg-transparent border border-[#cc4444]/20 dark:border-[#cc4444]/20 rounded-md text-[#cc4444] dark:text-[#cc4444] text-sm font-medium hover:bg-[#cc4444]/10 dark:hover:bg-white/5 hover:text-[#a53333] dark:hover:text-white hover:border-[#cc4444]/40 dark:hover:border-white/15 transition-all duration-300 flex items-center gap-1.5"
                                    title="Delete events"
                                >
                                    <svg className="w-3.5 h-3.5 text-[#cc4444] group-hover:text-red-400 transition-colors duration-300" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 7H5l1 12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2l1-12z" />
                                        <path d="M9 4V3c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v1h5c.6 0 1 .4 1 1s-.4 1-1 1H3c-.6 0-1-.4-1-1s.4-1 1-1h6zm2 0h2V3h-2v1z" />
                                        <path d="M10 9v8c0 .6.4 1 1 1s1-.4 1-1V9c0-.6-.4-1-1-1s-1 .4-1 1z" />
                                        <path d="M14 9v8c0 .6.4 1 1 1s1-.4 1-1V9c0-.6-.4-1-1-1s-1 .4-1 1z" />
                                    </svg>
                                    Delete
                                </button>
                            )}
                            <button
                                onClick={handleOpenPasteModal}
                                className="group px-3 py-1 bg-transparent border border-[#a973d3]/20 dark:border-[#a973d3]/20 rounded-md text-[#a973d3] dark:text-[#a973d3] text-sm font-medium hover:bg-[#a973d3]/10 dark:hover:bg-white/5 hover:text-[#8a5bb8] dark:hover:text-white hover:border-[#a973d3]/40 dark:hover:border-white/15 transition-all duration-300 flex items-center gap-1.5"
                                title="Paste shared schedule link"
                            >
                                <Clipboard className="w-3.5 h-3.5 text-[#a973d3] group-hover:text-purple-400 transition-colors duration-300" />
                                Paste
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Weekly grid container - HIGH-END POLISHED DARK INTERFACE */}
            <div className={`flex flex-col ${themeStyles.containerBg} border-2 ${themeStyles.containerBorder} rounded-lg shadow-lg overflow-hidden mx-4 mt-4 h-[calc(100vh-120px)] transition-colors duration-300 ${isAnimating
                ? `animating ${animationDirection === 'next' ? 'slide-next' : 'slide-prev'}`
                : ''
                }`}>
                {/* Days header */}
                <div className={`grid grid-cols-[48px_repeat(5,1fr)] sm:grid-cols-[64px_repeat(5,1fr)_100px_100px] ${themeStyles.dayHeaderBg} border-b-2 ${themeStyles.containerBorder} sticky top-0 z-20`}>
                    {/* Time column header */}
                    <div className={`col-span-1 p-1 text-xs ${themeStyles.timeLabelText} border-r-2 ${themeStyles.containerBorder} transition-colors duration-300 flex items-center justify-center ${themeStyles.timeLabelBg} font-semibold w-12 sm:w-16 max-w-16`}>
                        <span className="hidden sm:inline text-xs">Time</span>
                        <span className="inline sm:hidden text-[10px]">T</span>
                    </div>
                    {/* Day headers - EXACT same border structure as day columns */}
                    {weekDays.map((day, index) => {
                        // On mobile, only show Monday-Friday (index 0-4)
                        const isWeekend = index >= 5; // Saturday (5) and Sunday (6)

                        return (
                            <div key={index} className={`col-span-1 mobile-day-header p-3 text-center transition-colors duration-300 min-w-0 flex flex-col justify-center ${themeStyles.dayHeaderBg} relative ${isWeekend ? 'hidden sm:flex' : ''}`}>
                                <div className={`text-sm font-semibold ${themeStyles.dayHeaderText} transition-colors duration-300 overflow-hidden`}>
                                    <span className="inline sm:hidden">{dayNames[index].slice(0, 3)}</span>
                                    <span className="hidden sm:inline">{dayNames[index]}</span>
                                </div>
                                <div className={`text-xs ${themeStyles.dayHeaderSubtext} mt-1 transition-colors duration-300`}>
                                    <span className="inline sm:hidden">{format(day, 'd')}</span>
                                    <span className="hidden sm:inline">{format(day, 'MMM d')}</span>
                                </div>
                                {/* Vertical grid line - DESKTOP: extends down through entire calendar */}
                                {index < (screenWidth < 640 ? 4 : 6) && screenWidth >= 640 && (
                                    <div
                                        className="dark:bg-white/5 bg-gray-400/70"
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            height: 'calc(100vh - 140px)', // Extend down through entire calendar
                                            width: '1px',
                                            right: '-0.5px',
                                            zIndex: 30,
                                            pointerEvents: 'none'
                                        }}
                                    ></div>
                                )}
                                {/* Vertical grid line - SMALL SCREENS: extends down through entire calendar */}
                                {index < 4 && screenWidth < 640 && (
                                    <div
                                        className="dark:bg-white/5 bg-gray-400/70"
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            height: 'calc(100vh - 120px)', // Extend down through entire calendar on mobile
                                            width: '1px',
                                            right: '-0.5px',
                                            zIndex: 30,
                                            pointerEvents: 'none'
                                        }}
                                    ></div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Time grid with THEME SUPPORT - FULL HEIGHT + EVENTS EMBEDDED */}
                <div className={`flex-1 flex flex-col overflow-y-auto overflow-x-hidden ${themeStyles.timeSlotBg} relative`}>
                    {/* Events overlay - positioned within scrollable container */}
                    <div className="absolute left-0 right-0 top-0 pointer-events-none" style={{ height: `${timeSlots.length * 80}px` }}>
                        {weekDays.map((day, dayIndex) => {
                            // On mobile, only show Monday-Friday (index 0-4)
                            const isWeekend = dayIndex >= 5; // Saturday (5) and Sunday (6)

                            const dayEvents = getEventsForDay(dayNames[dayIndex], day);

                            // SIMPLIFIED: Use direct fractional positioning to match CSS Grid exactly
                            let leftPosition;
                            let columnWidth;

                            if (screenWidth < 640) {
                                // Mobile: grid-cols-[48px_repeat(5,1fr)] - 5 equal columns after time
                                const timeColumnWidth = 48;
                                const totalColumns = 5;
                                const availableWidth = `calc(100% - ${timeColumnWidth}px)`;

                                columnWidth = `calc(${availableWidth} / ${totalColumns})`;
                                leftPosition = `calc(${timeColumnWidth}px + ${availableWidth} * ${dayIndex} / ${totalColumns})`;
                            } else {
                                // Desktop: grid-cols-[64px_repeat(5,1fr)_100px_100px]
                                const timeColumnWidth = 64;
                                const weekendColumnWidth = 100;

                                if (dayIndex <= 4) {
                                    // Monday-Friday: Equal flexible columns using CSS Grid fr units
                                    const totalFlexColumns = 5;
                                    const flexAreaWidth = `calc(100% - ${timeColumnWidth}px - ${weekendColumnWidth * 2}px)`;

                                    columnWidth = `calc(${flexAreaWidth} / ${totalFlexColumns})`;
                                    leftPosition = `calc(${timeColumnWidth}px + ${flexAreaWidth} * ${dayIndex} / ${totalFlexColumns})`;
                                } else {
                                    // Saturday (5) and Sunday (6): Fixed width columns
                                    columnWidth = `${weekendColumnWidth}px`;
                                    const flexAreaWidth = `calc(100% - ${timeColumnWidth}px - ${weekendColumnWidth * 2}px)`;

                                    if (dayIndex === 5) { // Saturday
                                        leftPosition = `calc(${timeColumnWidth}px + ${flexAreaWidth})`;
                                    } else { // Sunday (6)
                                        leftPosition = `calc(${timeColumnWidth}px + ${flexAreaWidth} + ${weekendColumnWidth}px)`;
                                    }
                                }
                            }

                            return (
                                <div
                                    key={dayIndex}
                                    className={`absolute top-0 ${isWeekend ? 'hidden sm:block' : ''}`}
                                    style={{
                                        left: leftPosition,
                                        width: columnWidth,
                                        height: '100%'
                                    }}
                                >
                                    {dayEvents.map((event, eventIndex) => {
                                        const position = getEventPosition(event, dayEvents, eventIndex, screenWidth);
                                        const colorScheme = getEventThemeStyle(event);

                                        // Only show events that are within business hours - use normalized properties
                                        const normalizedEventForFilter = normalizeEventProperties(event);
                                        const eventStartHour = parseInt(normalizedEventForFilter.startTime.split(':')[0]);
                                        if (eventStartHour < APP_CONFIG.ACADEMIC.CALENDAR.START_HOUR || eventStartHour > APP_CONFIG.ACADEMIC.CALENDAR.END_HOUR) {
                                            return null;
                                        }

                                        return (
                                            <div
                                                key={eventIndex}
                                                className={`absolute rounded-md pointer-events-auto transition-all duration-300 ${colorScheme.bg} backdrop-blur-md border ${colorScheme.border} shadow-sm dark:shadow-[0_0_4px_rgba(255,255,255,0.05)] z-30 ${readOnly ? 'cursor-default' : `cursor-pointer ${colorScheme.hover} hover:shadow-md dark:hover:shadow-[0_0_8px_rgba(255,255,255,0.1)]`
                                                    }`}
                                                style={{
                                                    top: position.top,
                                                    height: position.height,
                                                    left: '4px', // Consistent left margin for all events
                                                    width: 'calc(100% - 8px)', // Consistent width with margins
                                                    padding: screenWidth < 480 ? '4px 6px' : '6px 8px',
                                                    fontSize: screenWidth < 480 ? '0.65rem' : '0.75rem',
                                                    minHeight: '30px',
                                                    margin: '0',
                                                    boxSizing: 'border-box',
                                                    overflow: 'hidden'
                                                }}
                                                ref={(el) => {
                                                    // Element reference for positioning
                                                }}
                                                onClick={() => handleMobileEventClick(event)}
                                                onMouseEnter={(e) => handleMouseEnter(event, e)}
                                                onMouseLeave={handleMouseLeave}
                                            >
                                                {(() => {
                                                    const displayInfo = getEventDisplayInfo(event);

                                                    // Get full section type name
                                                    const getFullSectionType = (type: string) => {
                                                        const typeMap: { [key: string]: string } = {
                                                            'LEC': 'Lecture',
                                                            'LAB': 'Laboratory',
                                                            'TUT': 'Tutorial',
                                                            'DGD': 'Discussion',
                                                            'SEM': 'Seminar',
                                                            'WRK': 'Workshop',
                                                            'THÉ': 'Theory',
                                                            'DIS': 'Discussion',
                                                            'PRA': 'Practical',
                                                            'DRO': 'Directed Reading',
                                                            'STG': 'Stage',
                                                            'REC': 'Recitation',
                                                            'CNF': 'Conference',
                                                            'FLD': 'Field Work'
                                                        };
                                                        return typeMap[type.toUpperCase()] || type;
                                                    };

                                                    return (
                                                        <div className="h-full flex flex-col p-1">
                                                            {/* Course Information Group - Stays at top */}
                                                            <div className="flex-none space-y-1">
                                                                {/* Course Code - Top (bold, small font) */}
                                                                <div className={`${colorScheme.text} font-bold text-sm leading-tight overflow-hidden`}
                                                                     style={{
                                                                         wordBreak: 'break-word',
                                                                         hyphens: 'auto'
                                                                     }}>
                                                                    {displayInfo.courseCode}
                                                                </div>

                                                                {/* Event Type - Simple text */}
                                                                <div className={`${colorScheme.text} text-sm font-medium leading-tight overflow-hidden`}
                                                                     style={{
                                                                         wordBreak: 'break-word'
                                                                     }}>
                                                                    {getFullSectionType(displayInfo.sectionType)}
                                                                </div>

                                                                {/* Instructor Name - Grey/muted text */}
                                                                <div className={`${colorScheme.text} text-xs opacity-75 leading-tight overflow-hidden`}
                                                                     style={{
                                                                         wordBreak: 'break-word'
                                                                     }}>
                                                                    {displayInfo.professor || 'Staff'}
                                                                </div>

                                                                {/* Time Range - Below instructor */}
                                                                <div className={`${colorScheme.text} text-xs opacity-60 leading-tight overflow-hidden`}
                                                                     style={{
                                                                         wordBreak: 'break-word'
                                                                     }}>
                                                                    {(() => {
                                                                        const normalizedEvent = normalizeEventProperties(event);
                                                                        return `${formatTime12Hour(normalizedEvent.startTime)} - ${formatTime12Hour(normalizedEvent.endTime)}`;
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>

                    {/* Time slots */}
                    {timeSlots.map((slot, index) => (
                        <div key={slot.hour} className="relative grid grid-cols-[48px_repeat(5,1fr)] sm:grid-cols-[64px_repeat(5,1fr)_100px_100px] mobile-time-slot min-h-[80px] h-20 flex-1">
                            {/* CLEAN horizontal separator line under each hour */}
                            {screenWidth < 640 ? (
                                <div
                                    style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: '-20px', // Extend beyond container on mobile
                                        width: 'calc(100vw + 40px)', // Full viewport width plus margins
                                        height: '1px',
                                        background: 'rgba(255, 255, 255, 0.3)',
                                        zIndex: 15,
                                        pointerEvents: 'none'
                                    }}
                                ></div>
                            ) : (
                                <div className={`absolute bottom-0 left-0 right-0 h-px ${themeStyles.containerBorder} opacity-30 z-10`}></div>
                            )}

                            {/* Time label */}
                            <div className={`col-span-1 mobile-time-label p-1 text-xs ${themeStyles.timeLabelText} ${themeStyles.timeLabelBg} border-r-2 ${themeStyles.containerBorder} font-medium flex items-center justify-center relative z-20 w-12 sm:w-16 max-w-16`}>
                                {/* Compact mobile format: 10a / 4p */}
                                <span className="inline sm:hidden text-[10px] leading-tight font-medium whitespace-nowrap">{slot.display.replace(':00', '').replace(' ', '').replace('AM', 'a').replace('PM', 'p')}</span>
                                {/* Desktop format: align AM/PM consistently */}
                                <span className="hidden sm:flex items-baseline gap-1 font-medium text-xs whitespace-nowrap">
                                    <span>{slot.display.split(' ')[0]}</span>
                                    <span className="text-[10px] leading-none">{slot.display.split(' ')[1]}</span>
                                </span>
                                {/* Horizontal separator under hour label */}
                                <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-400 dark:bg-white/5"></div>
                            </div>

                            {/* Day columns - CLEAN ALIGNED CELLS */}
                            {weekDays.map((day, dayIndex) => {
                                // On mobile, only show Monday-Friday (index 0-4)
                                const isWeekend = dayIndex >= 5; // Saturday (5) and Sunday (6)

                                return (
                                    <div key={dayIndex} className={`col-span-1 relative ${themeStyles.timeSlotBg} min-h-[80px] h-full ${isWeekend ? 'hidden sm:block' : ''}`}>
                                        {/* Horizontal separator under hour label extending across day columns */}
                                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-400 dark:bg-white/5"></div>
                                        {/* NO vertical lines in time grid - only in header */}
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                </div>
            </div>

            {/* Edit event modal */}
            {!readOnly && editingEvent && (
                <EditEventModal
                    event={editingEvent}
                    isOpen={!!editingEvent}
                    onClose={handleCloseEditModal}
                    onSave={handleSaveEvent}
                    isCreating={false}
                    allEvents={events}
                    onDeleteEvent={onDeleteEvent}
                />
            )}

            {/* Add event modal */}
            {!readOnly && showAddEventModal && (
                <EditEventModal
                    event={null}
                    isOpen={showAddEventModal}
                    onClose={handleCloseAddEventModal}
                    onSave={handleSaveNewEvent}
                    isCreating={true}
                    allEvents={events}
                    onDeleteEvent={onDeleteEvent}
                />
            )}

            {/* Delete events modal */}
            {showDeleteEventsModal && (
                <DeleteEventsModal
                    isOpen={showDeleteEventsModal}
                    onClose={handleCloseDeleteEventsModal}
                    events={events}
                    onDeleteEvent={onDeleteEvent || (() => { })}
                />
            )}

            {/* Event tooltip */}
            {tooltipEvent && (
                <EventTooltip
                    event={tooltipEvent}
                    visible={tooltipVisible}
                    position={tooltipPosition}
                />
            )}

            {/* Mobile Event Details Modal */}
            {mobileEventDetails && (
                <MobileEventDetailsModal
                    event={mobileEventDetails}
                    isOpen={!!mobileEventDetails}
                    onClose={handleCloseMobileEventDetails}
                    onEdit={handleEditFromMobileDetails}
                    onDelete={mobileEventDetails.id ? async () => {
                        if (mobileEventDetails.id) {
                            // Extract course code from the event
                            const extractCourseCode = (event: Event): string | null => {
                                // Try to extract from title first (e.g., "CSI 2110 - Instructor")
                                const titleMatch = event.title.match(/([A-Z]{3}\s*\d{4})/);
                                if (titleMatch) {
                                    return titleMatch[1].replace(/\s+/g, ' ').trim(); // Normalize spacing
                                }

                                // Try to extract from description
                                if (event.description) {
                                    const descMatch = event.description.match(/Course:\s*([A-Z]{3}\s*\d{4})/i);
                                    if (descMatch) {
                                        return descMatch[1].replace(/\s+/g, ' ').trim();
                                    }
                                }

                                return null;
                            };

                            const courseCode = extractCourseCode(mobileEventDetails);

                            // Use centralized deletion service to prevent duplicate dialogs
                            const { deletionService } = await import('@/services/deletionService');

                            // Check if deletion is already in progress
                            if (courseCode && deletionService.isDeletionInProgress(courseCode)) {
                                alert(`${courseCode} is already being deleted.`);
                                return;
                            }

                            if (mobileEventDetails.id && deletionService.isDeletionInProgress(mobileEventDetails.id.toString())) {
                                alert('This event is already being deleted.');
                                return;
                            }

                            const confirmMessage = courseCode
                                ? `Delete all sections of ${courseCode}? This will remove ALL lectures, labs, tutorials, etc. for this course.`
                                : "Delete this event?";

                            if (confirm(confirmMessage)) {
                                try {
                                    let result;

                                    if (courseCode) {
                                        // Delete entire course
                                        result = await deletionService.handleDeletionRequest({
                                            type: 'course',
                                            target: courseCode
                                        });
                                    } else {
                                        // Delete single event
                                        result = await deletionService.handleDeletionRequest({
                                            type: 'event',
                                            target: mobileEventDetails.id!.toString()
                                        });
                                    }

                                    if (result.success) {

                                        // Trigger calendar refresh
                                        if (onDeleteEvent && mobileEventDetails.id) {
                                            onDeleteEvent(mobileEventDetails.id);
                                        }

                                        // Refresh backend events
                                        const { getCalendarEvents } = await import('@/lib/api');
                                        const apiEvents = await getCalendarEvents();
                                        const convertedEvents: Event[] = apiEvents.map(apiEvent => ({
                                            id: apiEvent.id,
                                            startTime: apiEvent.start_time,
                                            endTime: apiEvent.end_time,
                                            title: apiEvent.title,
                                            day_of_week: apiEvent.day_of_week,
                                            start_date: apiEvent.start_date,
                                            end_date: apiEvent.end_date,
                                            description: apiEvent.description,
                                            professor: apiEvent.professor,
                                            recurrence_pattern: apiEvent.recurrence_pattern,
                                            reference_date: apiEvent.reference_date,
                                            theme: apiEvent.theme
                                        }));
                                        setBackendEvents(convertedEvents);
                                    } else {
                                        alert(result.message);
                                    }

                                    setMobileEventDetails(null);
                                } catch (error) {
                                    console.error('❌ Error during deletion:', error);
                                    alert('Failed to delete. Please try again.');
                                }
                            }
                        }
                    } : undefined}
                />
            )}

            {/* Conflicts Modal */}
            <ConflictsModal
                isOpen={showConflictsModal}
                onClose={handleCloseConflictsModal}
                conflicts={getConflictingEvents()}
            />

            {/* Share Schedule Modal */}
            <ShareModal
                isOpen={showShareModal}
                onClose={handleCloseShareModal}
                shareUrl={shareUrl}
                loading={shareLoading}
            />

            {/* Paste Schedule Modal */}
            <PasteModal
                isOpen={showPasteModal}
                onClose={handleClosePasteModal}
                pasteUrl={pasteUrl}
                setPasteUrl={setPasteUrl}
                loading={pasteLoading}
                error={pasteError}
                onPaste={handlePasteSchedule}
                onPasteFromClipboard={handlePasteFromClipboard}
            />

            {/* Download Schedule Modal */}
            <DownloadScheduleModal
                isOpen={showDownloadModal}
                onClose={() => setShowDownloadModal(false)}
                onDownload={handleDownloadConfirm}
                defaultFilename="kairo_schedule"
            />
        </div>
    );
};

interface DeleteEventsModalProps {
    isOpen: boolean;
    onClose: () => void;
    events: Event[];
    onDeleteEvent: (eventId: number) => void;
}

const DeleteEventsModal: React.FC<DeleteEventsModalProps> = ({ isOpen, onClose, events, onDeleteEvent }) => {
    const [selectedEvents, setSelectedEvents] = useState<number[]>([]);
    const [courseToDelete, setCourseToDelete] = useState<string>('');
    const [deletionMode, setDeletionMode] = useState<'events' | 'course'>('events');

    if (!isOpen) return null;

    // Helper function to normalize event properties for backward compatibility
    const normalizeEventProperties = (event: any): Event => {
        return {
            ...event,
            startTime: event.startTime || event.start_time,  // Handle both formats
            endTime: event.endTime || event.end_time,        // Handle both formats
        };
    };

    const handleSelectEvent = (eventId: number) => {
        setSelectedEvents(prev =>
            prev.includes(eventId)
                ? prev.filter(id => id !== eventId)
                : [...prev, eventId]
        );
    };

    const handleSelectAll = () => {
        if (selectedEvents.length === events.length) {
            setSelectedEvents([]);
        } else {
            setSelectedEvents(events.map(event => event.id!).filter(id => id !== undefined));
        }
    };

    const handleDeleteCourse = async () => {
        if (!courseToDelete.trim()) return;

        try {
            // Use centralized deletion service
            const { deletionService } = await import('@/services/deletionService');

            const confirmMessage = `Delete all sections of ${courseToDelete.toUpperCase()}? This will remove ALL lectures, labs, tutorials, etc. for this course.`;

            if (confirm(confirmMessage)) {
                const result = await deletionService.handleDeletionRequest({
                    type: 'course',
                    target: courseToDelete.toUpperCase()
                });

                // Show result
                    if (result && result.message) {
                    if (result.success) {
                        // Refresh the events list by dispatching a global event
                        window.dispatchEvent(new CustomEvent('bulkCalendarDeletion', {
                            detail: {
                                courseCode: courseToDelete.toUpperCase(),
                                deletedCount: result.deletedCount,
                                failedCount: 0
                            }
                        }));
                    } else {
                        alert(result.message);
                    }
                }

                // Clear input and close modal
                setCourseToDelete('');
                onClose();
            }

        } catch (error) {
            console.error('❌ Error deleting course:', error);
            alert('Failed to delete course. Please try again.');
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedEvents.length === 0) return;

        try {
            // Use centralized deletion service
            const { deletionService } = await import('@/services/deletionService');

            // Extract course code from the event
            const extractCourseCode = (event: Event): string | null => {
                // Try to extract from title first (e.g., "CSI 2110 - Instructor")
                const titleMatch = event.title.match(/([A-Z]{3}\s*\d{4})/);
                if (titleMatch) {
                    return titleMatch[1].replace(/\s+/g, ' ').trim(); // Normalize spacing
                }

                // Try to extract from description
                if (event.description) {
                    const descMatch = event.description.match(/Course:\s*([A-Z]{3}\s*\d{4})/i);
                    if (descMatch) {
                        return descMatch[1].replace(/\s+/g, ' ').trim();
                    }
                }

                return null;
            };

            // Analyze selected events to see if they belong to specific courses
            const selectedEventsData = events.filter(event => event.id && selectedEvents.includes(event.id));
            const courseCodes = new Set<string>();

            selectedEventsData.forEach(event => {
                const courseCode = extractCourseCode(event);
                if (courseCode) {
                    courseCodes.add(courseCode);
                }
            });

            let result;

            if (courseCodes.size > 0) {
                // Handle course-based deletion
                const courseList = Array.from(courseCodes).join(', ');
                const confirmMessage = `Delete all sections of ${courseList}? This will remove ALL lectures, labs, tutorials, etc. for ${courseCodes.size === 1 ? 'this course' : 'these courses'}.`;

                if (confirm(confirmMessage)) {
                    // Delete all selected courses using centralized service
                    const courseArray = Array.from(courseCodes);
                    if (courseArray.length === 1) {
                        result = await deletionService.handleDeletionRequest({
                            type: 'course',
                            target: courseArray[0]
                        });
                    } else {
                        result = await deletionService.handleDeletionRequest({
                            type: 'course',
                            message: `Remove courses: ${courseArray.join(', ')}`
                        });
                    }
                } else {
                    return; // User cancelled
                }
            } else {
                // Handle individual event deletion
                const confirmMessage = selectedEvents.length === 1
                    ? "Delete this event?"
                    : `Delete ${selectedEvents.length} events?`;

                if (confirm(confirmMessage)) {
                    // Delete selected events individually using centralized service
                    let successCount = 0;
                    let errorCount = 0;

                    for (const eventId of selectedEvents) {
                        const eventResult = await deletionService.handleDeletionRequest({
                            type: 'event',
                            target: eventId.toString()
                        });

                        if (eventResult.success) {
                            successCount++;
                            onDeleteEvent(eventId);
                        } else {
                            errorCount++;
                        }
                    }

                    result = {
                        success: successCount > 0,
                        message: `Deleted ${successCount}/${selectedEvents.length} events${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
                        deletedCount: successCount,
                        errors: []
                    };
                } else {
                    return; // User cancelled
                }
            }

            // Show result
            if (result && result.message) {
                if (result.success) {
                } else {
                    alert(result.message);
                }
            }

            // Clear selection and close modal
            setSelectedEvents([]);
            onClose();

        } catch (error) {
            console.error('❌ Error deleting events:', error);
            alert('Failed to delete events. Please try again.');
        }
    };

    const formatTime12Hour = (timeString: string): string => {
        const [hours, minutes] = timeString.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        const displayMinutes = minutes.toString().padStart(2, '0');
        return `${displayHours}:${displayMinutes} ${ampm}`;
    };

    // Extract course info from event title and description
    const getEventDisplayInfo = (event: Event) => {
        let courseCode = '';
        let courseName = '';
        let professor = event.professor || '';

        // Try to extract course code from title (format: "CSI 2110 - Instructor" or just "CSI 2110")
        const titleMatch = event.title.match(/([A-Z]{3}\s*\d{4})/);
        if (titleMatch) {
            courseCode = titleMatch[1];
        }

        // Try to extract course name from description
        if (event.description) {
            const titleMatch = event.description.match(/Title:\s*([^\n\r]+)/i);
            if (titleMatch) {
                courseName = titleMatch[1].trim();
            }

            // If no professor in the event object, try to extract from description
            if (!professor) {
                const instructorMatch = event.description.match(/Instructor:\s*([^\n\r]+)/i);
                if (instructorMatch) {
                    professor = instructorMatch[1].trim();
                }
            }
        }

        // If no professor found, try to extract from title after the dash
        if (!professor && event.title.includes(' - ')) {
            const titleParts = event.title.split(' - ');
            if (titleParts.length > 1) {
                professor = titleParts[1].trim();
            }
        }

        return {
            courseCode: courseCode || event.title.split(' - ')[0] || event.title,
            courseName: courseName,
            professor: professor
        };
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-2xl max-h-[95vh] overflow-hidden border-2 border-purple-500/30">
                {/* Header */}
                <div className="flex items-center justify-between p-3 sm:p-6 border-b border-gray-700">
                    <h2 className="text-lg sm:text-xl font-semibold text-white">Delete Events</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-1"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-3 sm:p-6">
                    {/* Deletion Mode Tabs */}
                    <div className="flex mb-4 sm:mb-6 border-b border-gray-700">
                        <button
                            onClick={() => setDeletionMode('events')}
                            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors ${deletionMode === 'events'
                                ? 'border-purple-500 text-purple-400'
                                : 'border-transparent text-gray-400 hover:text-gray-300'
                                }`}
                        >
                            Delete Selected Events
                        </button>
                        <button
                            onClick={() => setDeletionMode('course')}
                            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors ${deletionMode === 'course'
                                ? 'border-purple-500 text-purple-400'
                                : 'border-transparent text-gray-400 hover:text-gray-300'
                                }`}
                        >
                            Delete by Course Code
                        </button>
                    </div>

                    {deletionMode === 'course' ? (
                        /* Course Deletion Mode */
                        <div className="space-y-4">
                            <div className="text-gray-300 text-sm">
                                Enter a course code to delete all sections of that course (e.g., CSI 2110, MAT 1341):
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={courseToDelete}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCourseToDelete(e.target.value)}
                                    placeholder="e.g., CSI 2110"
                                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none text-sm"
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleDeleteCourse();
                                        }
                                    }}
                                />
                                <button
                                    onClick={handleDeleteCourse}
                                    disabled={!courseToDelete.trim()}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
                                >
                                    Delete Course
                                </button>
                            </div>
                            <div className="text-gray-500 text-xs">
                                ⚠️ This will delete ALL sections (lectures, labs, tutorials) for the specified course.
                            </div>
                        </div>
                    ) : events.length === 0 ? (
                        <div className="text-center py-6 sm:py-12">
                            <div className="text-4xl sm:text-6xl mb-2 sm:mb-4">📅</div>
                            <div className="text-gray-300 text-lg sm:text-xl mb-1 sm:mb-2">No events to delete</div>
                            <div className="text-gray-500 text-xs sm:text-sm">
                                Create some events first to see them here.
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Select All / Actions */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-4 sm:mb-6">
                                <button
                                    onClick={handleSelectAll}
                                    className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors border border-gray-600"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedEvents.length === events.length && events.length > 0}
                                        onChange={(e) => { e.stopPropagation(); handleSelectAll(); }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-3 sm:w-4 h-3 sm:h-4 text-purple-500 rounded"
                                    />
                                    <span className="text-gray-300">
                                        Select All ({events.length})
                                    </span>
                                </button>

                                {selectedEvents.length > 0 && (
                                    <button
                                        onClick={handleDeleteSelected}
                                        className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-1.5 sm:py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
                                    >
                                        <svg className="w-3 sm:w-4 h-3 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span className="hidden lg:inline">Delete Selected ({selectedEvents.length})</span>
                                        <span className="lg:hidden">Delete ({selectedEvents.length})</span>
                                    </button>
                                )}
                            </div>

                            {/* Events List */}
                            <div className="max-h-64 sm:max-h-96 overflow-y-auto space-y-2 sm:space-y-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                                {events.map((event) => {
                                    const isSelected = selectedEvents.includes(event.id!);
                                    const eventInfo = getEventDisplayInfo(event);

                                    // Create a simple color scheme based on event title hash
                                    const getSimpleColorScheme = (title: string) => {
                                        const hash = title.split('').reduce((a, b) => {
                                            a = ((a << 5) - a) + b.charCodeAt(0);
                                            return a & a;
                                        }, 0);
                                        const vibrantGradients = [
                                            'linear-gradient(135deg, #fb923c 0%, #ef4444 100%)', // Orange to Red
                                            'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)', // Cyan to Blue
                                            'linear-gradient(135deg, #4ade80 0%, #14b8a6 100%)', // Green to Teal
                                            'linear-gradient(135deg, #e879f9 0%, #f43f5e 100%)', // Fuchsia to Rose
                                            'linear-gradient(135deg, #facc15 0%, #f97316 100%)', // Yellow to Orange
                                            'linear-gradient(135deg, #2dd4bf 0%, #06b6d4 100%)', // Teal to Cyan
                                            'linear-gradient(135deg, #c084fc 0%, #6366f1 100%)', // Purple to Indigo
                                            'linear-gradient(135deg, #a3e635 0%, #eab308 100%)', // Lime to Yellow
                                        ];
                                        const colorIndex = Math.abs(hash) % vibrantGradients.length;
                                        return { gradientCSS: vibrantGradients[colorIndex] };
                                    };

                                    const colorScheme = getSimpleColorScheme(event.title);

                                    return (
                                        <div
                                            key={event.id}
                                            onClick={() => handleSelectEvent(event.id!)}
                                            className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${isSelected
                                                ? 'border-purple-500 bg-purple-500/10'
                                                : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => { e.stopPropagation(); handleSelectEvent(event.id!); }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-5 h-5 text-purple-500 rounded"
                                            />

                                            {/* Event Color Indicator */}
                                            <div
                                                className={`w-5 h-5 rounded-full flex-shrink-0 ${(() => {
                                                    // Simple theme color logic for modal
                                                    const themeName = event.theme || 'lavender-peach';
                                                    const themeColors: { [key: string]: { bg: string; border: string } } = {
                                                        'lavender-peach': { bg: 'bg-purple-400/60', border: 'border-purple-400' },
                                                        'indigo-sunset': { bg: 'bg-indigo-400/60', border: 'border-indigo-400' },
                                                        'cotton-candy': { bg: 'bg-pink-400/60', border: 'border-pink-400' },
                                                        'blue-purple-magenta': { bg: 'bg-blue-400/60', border: 'border-blue-400' },
                                                        'deep-plum-coral': { bg: 'bg-purple-400/60', border: 'border-purple-400' },
                                                        'classic-black-white': { bg: 'bg-gray-400/60', border: 'border-gray-400' },
                                                        'midnight-ivory': { bg: 'bg-slate-400/60', border: 'border-slate-400' },
                                                        'cosmic-galaxy': { bg: 'bg-violet-400/60', border: 'border-violet-400' },
                                                        'twilight-sunset': { bg: 'bg-violet-400/60', border: 'border-violet-400' },
    'midnight-light-blue': { bg: 'bg-blue-400/60', border: 'border-blue-400' },
    'midnight-indigo-blue-cyan': { bg: 'bg-cyan-400/60', border: 'border-cyan-400' },
    'black-deep-bright': { bg: 'bg-red-400/60', border: 'border-red-400' },
    'green-blue': { bg: 'bg-emerald-400/60', border: 'border-emerald-400' },
    'warm-brown': { bg: 'bg-orange-400/60', border: 'border-orange-400' },
    'lime-green': { bg: 'bg-yellow-400/60', border: 'border-yellow-400' },
    'mint-teal': { bg: 'bg-sky-400/60', border: 'border-sky-400' }
                                                    };
                                                    const theme = themeColors[themeName] || themeColors['lavender-peach'];
                                                    return `${theme.bg} ${theme.border}`;
                                                })()}`}
                                            ></div>

                                            {/* Event Details */}
                                            <div className="flex-1 min-w-0">
                                                {/* Course Code */}
                                                <div className="font-semibold text-white text-base mb-1">
                                                    {eventInfo.courseCode}
                                                </div>

                                                {/* Course Name */}
                                                {eventInfo.courseName && (
                                                    <div className="text-gray-300 text-sm mb-2 line-clamp-1">
                                                        {eventInfo.courseName}
                                                    </div>
                                                )}

                                                {/* Schedule Info */}
                                                <div className="text-gray-400 text-sm mb-1">
                                                    {event.day_of_week ? (
                                                        <>
                                                            <span className="font-medium">{event.day_of_week}s</span>
                                                            <span className="mx-2">•</span>
                                                            {(() => {
                                                                const normalizedEvent = normalizeEventProperties(event);
                                                                return <span>{formatTime12Hour(normalizedEvent.startTime)} - {formatTime12Hour(normalizedEvent.endTime)}</span>;
                                                            })()}
                                                            {event.recurrence_pattern === 'biweekly' && (
                                                                <>
                                                                    <span className="mx-2">•</span>
                                                                    <span className="text-yellow-400">Bi-weekly</span>
                                                                </>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="font-medium">{event.start_date}</span>
                                                            <span className="mx-2">•</span>
                                                            {(() => {
                                                                const normalizedEvent = normalizeEventProperties(event);
                                                                return <span>{formatTime12Hour(normalizedEvent.startTime)} - {formatTime12Hour(normalizedEvent.endTime)}</span>;
                                                            })()}
                                                        </>
                                                    )}
                                                </div>

                                                {/* Professor */}
                                                {eventInfo.professor && eventInfo.professor !== 'Staff' && (
                                                    <div className="text-blue-400 text-sm">
                                                        <span className="font-medium">Professor:</span> {eventInfo.professor}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Quick Delete Button */}
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();

                                                    // Extract course code from the event
                                                    const extractCourseCode = (event: Event): string | null => {
                                                        // Try to extract from title first (e.g., "CSI 2110 - Instructor")
                                                        const titleMatch = event.title.match(/([A-Z]{3}\s*\d{4})/);
                                                        if (titleMatch) {
                                                            return titleMatch[1].replace(/\s+/g, ' ').trim(); // Normalize spacing
                                                        }

                                                        // Try to extract from description
                                                        if (event.description) {
                                                            const descMatch = event.description.match(/Course:\s*([A-Z]{3}\s*\d{4})/i);
                                                            if (descMatch) {
                                                                return descMatch[1].replace(/\s+/g, ' ').trim();
                                                            }
                                                        }

                                                        return null;
                                                    };

                                                    const courseCode = extractCourseCode(event);
                                                    const confirmText = courseCode
                                                        ? `Delete all sections of ${courseCode}? This will remove ALL lectures, labs, tutorials, etc. for this course.`
                                                        : `Delete "${eventInfo.courseCode}"?${eventInfo.professor ? `\nProfessor: ${eventInfo.professor}` : ''}`;

                                                    if (confirm(confirmText)) {
                                                        try {
                                                            // Delete from backend if authenticated
                                                            const isAuthenticated = typeof window !== 'undefined' && localStorage.getItem('token');
                                                            if (isAuthenticated) {
                                                                const { deleteCalendarEvent, getCalendarEvents } = await import('@/lib/api');

                                                                // If we have a course code, delete all related events
                                                                if (courseCode) {
                                                                    // Get all current events first
                                                                    const allEvents = await getCalendarEvents();

                                                                    // Find all events for the same course
                                                                    const courseEvents = allEvents.filter(evt => {
                                                                        const eventCourseCode = extractCourseCode({
                                                                            title: evt.title,
                                                                            description: evt.description
                                                                        } as Event);
                                                                        return eventCourseCode === courseCode;
                                                                    });

                                                                    

                                                                    // Delete all course events
                                                                    for (const courseEvent of courseEvents) {
                                                                        try {
                                                                            if (courseEvent.id) {
                                                                                await deleteCalendarEvent(courseEvent.id);
                                                                                 

                                                                                // Also call the passed handler
                                                                                onDeleteEvent(courseEvent.id);
                                                                            }
                                                                        } catch (error) {
                                                                            console.error(`❌ Error deleting course event ${courseEvent.id}:`, error);
                                                                        }
                                                                    }

                                                                    
                                                                } else {
                                                                    // Just delete the single event if no course code found
                                                                    await deleteCalendarEvent(event.id!);

                                                                    // Also call the passed handler
                                                                    onDeleteEvent(event.id!);
                                                                }
                                                            } else {
                                                                // Not authenticated, just call the passed handler
                                                                onDeleteEvent(event.id!);
                                                            }
                                                        } catch (error) {
                                                            console.error(`❌ Error deleting event ${event.id}:`, error);
                                                            alert('Failed to delete event. Please try again.');
                                                        }
                                                    }
                                                }}
                                                className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 rounded-lg transition-colors flex-shrink-0"
                                                title="Delete all sections of this course"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

//  Conflicts Modal Component
interface ConflictsModalProps {
    isOpen: boolean;
    onClose: () => void;
    conflicts: { event1: Event; event2: Event; day: string }[];
}

const ConflictsModal: React.FC<ConflictsModalProps> = ({ isOpen, onClose, conflicts }) => {
    const normalizeEventProperties = (event: any): Event => {
        return {
            id: event.id || 0,
            startTime: event.startTime || event.start_time || '',
            endTime: event.endTime || event.end_time || '',
            title: event.title || '',
            day_of_week: event.day_of_week || event.dayOfWeek || '',
            start_date: event.start_date || event.startDate || '',
            end_date: event.end_date || event.endDate || '',
            description: event.description || '',
            professor: event.professor || '',
            recurrence_pattern: event.recurrence_pattern || event.recurrencePattern || 'weekly',
            reference_date: event.reference_date || event.referenceDate || '',
            theme: event.theme || ''
        };
    };

    const formatTime12Hour = (timeString: string): string => {
        if (!timeString) return '';
        try {
            const [hours, minutes] = timeString.split(':').map(Number);
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
        } catch {
            return timeString;
        }
    };

    const getEventDisplayInfo = (event: Event) => {
        const normalized = normalizeEventProperties(event);

        const title = normalized.title;
        const timeRange = `${formatTime12Hour(normalized.startTime)} - ${formatTime12Hour(normalized.endTime)}`;

        return {
            title,
            timeRange,
            professor: normalized.professor,
            description: normalized.description
        };
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Schedule Conflicts ({conflicts.length})
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6">
                    {conflicts.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="text-green-500 text-4xl mb-4">✓</div>
                            <p className="text-gray-600 dark:text-gray-400">No schedule conflicts found!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {conflicts.map((conflict, index) => {
                                const event1Info = getEventDisplayInfo(conflict.event1);
                                const event2Info = getEventDisplayInfo(conflict.event2);

                                return (
                                    <div key={index} className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="text-red-500 text-xl">⚠️</div>
                                            <h3 className="font-semibold text-red-800 dark:text-red-300">
                                                Conflict on {conflict.day}
                                            </h3>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-2">
                                            {/* Event 1 */}
                                            <div className="bg-white dark:bg-gray-700 rounded p-3 border border-gray-200 dark:border-gray-600">
                                                <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                                                    {event1Info.title}
                                                </h4>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    {event1Info.timeRange}
                                                </p>
                                                {event1Info.professor && (
                                                    <p className="text-sm text-gray-500 dark:text-gray-500">
                                                        {event1Info.professor}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Event 2 */}
                                            <div className="bg-white dark:bg-gray-700 rounded p-3 border border-gray-200 dark:border-gray-600">
                                                <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                                                    {event2Info.title}
                                                </h4>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    {event2Info.timeRange}
                                                </p>
                                                {event2Info.professor && (
                                                    <p className="text-sm text-gray-500 dark:text-gray-500">
                                                        {event2Info.professor}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// Share Schedule Modal Component
interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    shareUrl: string;
    loading: boolean;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, shareUrl, loading }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-blue-500" />
                        Share Schedule
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-gray-600 dark:text-gray-400">Creating shareable link...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                Share this link with anyone to show them your exact calendar:
                            </p>

                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={shareUrl}
                                    readOnly
                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                                    placeholder="Generating link..."
                                />
                                <button
                                    onClick={handleCopy}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 ${copied
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30'
                                        }`}
                                    disabled={!shareUrl}
                                >
                                    {copied ? (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            Copy
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                <p className="text-blue-800 dark:text-blue-200 text-sm">
                                    <strong>Note:</strong> Anyone with this link can view your schedule, but they cannot edit it.
                                    They can clone it to create their own customizable version.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// Paste Schedule Modal Component
interface PasteModalProps {
    isOpen: boolean;
    onClose: () => void;
    pasteUrl: string;
    setPasteUrl: (url: string) => void;
    loading: boolean;
    error: string | null;
    onPaste: () => void;
    onPasteFromClipboard: () => void;
}

const PasteModal: React.FC<PasteModalProps> = ({
    isOpen,
    onClose,
    pasteUrl,
    setPasteUrl,
    loading,
    error,
    onPaste,
    onPasteFromClipboard
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Clipboard className="w-5 h-5 text-purple-500" />
                        Import Shared Schedule
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="space-y-4">
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            Paste a shared schedule link to import it with the exact same colors and layout:
                        </p>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={pasteUrl}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasteUrl(e.target.value)}
                                    placeholder="https://kairoo.ca/schedule/..."
                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                    disabled={loading}
                                />
                                <button
                                    onClick={onPasteFromClipboard}
                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                                    disabled={loading}
                                    title="Paste from clipboard"
                                >
                                    <Clipboard className="w-4 h-4" />
                                </button>
                            </div>

                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                    <p className="text-red-800 dark:text-red-200 text-sm">
                                        {error}
                                    </p>
                                </div>
                            )}

                            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                                <p className="text-purple-800 dark:text-purple-200 text-sm">
                                    <strong>Note:</strong> This will import all events from the shared schedule into your current calendar,
                                    preserving the original colors, times, and course information.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between p-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onPaste}
                        disabled={loading || !pasteUrl.trim()}
                        className={`px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2 ${loading || !pasteUrl.trim()
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-purple-600 hover:bg-purple-700 text-white'
                            }`}
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Importing...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                Import Schedule
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Export WeeklyCalendar as the default export for DailyCalendar import
export default WeeklyCalendar; 