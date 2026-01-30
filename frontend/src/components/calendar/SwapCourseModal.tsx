import React, { useState, useEffect } from 'react';
import { loadCoursesForTerm } from '@/services/courseDataService';
import { Event, SwapCourseModalProps } from './types';

const SwapCourseModal: React.FC<SwapCourseModalProps> = ({ 
    event, 
    isOpen, 
    onClose, 
    onSwap, 
    allEvents = [], 
    onDeleteEvent, 
    onAddEvent 
}) => {
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
            console.error('Error loading alternatives:', error);
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
                console.error('Error adding components:', error);
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

    if (!isOpen) return null;

    const courseInfo = event ? extractCourseInfo(event) : null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-cream dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[70vh] border border-gray-200 dark:border-gray-700 flex flex-col">
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
                                                                            <div className="w-2 h-2 bg-cream rounded-full"></div>
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

export default SwapCourseModal;