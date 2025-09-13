'use client';

import React from 'react';
import { getCourseColorClasses, getCourseLegendData } from '@/config/course.config';
import { APP_CONFIG } from '@/config/app.config';

interface Course {
    code: string;
    title: string;
    isElective: boolean;
    electiveType?: string;
}

interface CurriculumCalendarProps {
    courses: string[];
    year: number;
    term: string;
    programName: string;
}

const CurriculumCalendar: React.FC<CurriculumCalendarProps> = ({
    courses,
    year,
    term,
    programName
}) => {
    // Parse course strings into objects
    const parsedCourses: Course[] = courses.map(courseStr => {
        if (courseStr.startsWith('Elective')) {
            const parts = courseStr.split(' | ');
            return {
                code: 'ELECTIVE',
                title: parts.length > 1 ? parts[1] : 'General Elective',
                isElective: true,
                electiveType: parts.length > 1 ? parts[1] : 'General'
            };
        } else {
            const parts = courseStr.split(' | ');
            return {
                code: parts[0] || '',
                title: parts[1] || 'Course Title',
                isElective: false
            };
        }
    });

    // Dynamic time slots from configuration
    const timeSlots = APP_CONFIG.ACADEMIC.CALENDAR.TIME_SLOTS.map(slot => slot.time);
    const days = APP_CONFIG.ACADEMIC.CALENDAR.WEEK_DAYS;

    // Simple algorithm to distribute courses across the week
    const distributeCourses = () => {
        const schedule: { [key: string]: { [key: string]: Course | null } } = {};

        days.forEach(day => {
            schedule[day] = {};
            timeSlots.forEach(time => {
                schedule[day][time] = null;
            });
        });

        // Distribute courses across Monday-Friday, 2-3 slots per day
        let courseIndex = 0;
        const slotsPerDay = Math.ceil(parsedCourses.length / 5);

        days.forEach((day, dayIndex) => {
            let slotsUsed = 0;
            for (let i = 0; i < timeSlots.length && slotsUsed < slotsPerDay && courseIndex < parsedCourses.length; i++) {
                const time = timeSlots[i];
                schedule[day][time] = parsedCourses[courseIndex];
                courseIndex++;
                slotsUsed++;
            }
        });

        return schedule;
    };

    const schedule = distributeCourses();

    const getCourseColor = (course: Course) => {
        return getCourseColorClasses(course.code, course.isElective, course.electiveType);
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-4">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    {programName} - Year {year} {term}
                </h2>
                <p className="text-gray-600">
                    Course Schedule Preview (Placeholder Times)
                </p>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white dark:bg-[#121212] rounded-lg shadow-lg dark:shadow-[0_0_4px_rgba(255,255,255,0.05)] overflow-hidden border-2 border-gray-300 dark:border-white/5">
                {/* Days Header */}
                <div className="grid grid-cols-6 bg-gray-50 dark:bg-gradient-to-b dark:from-[#1e1e1e] dark:to-[#1a1a1a] border-b-2 border-gray-300 dark:border-white/5">
                    <div className="p-4 text-sm font-semibold text-gray-700 dark:text-gray-200 border-r-2 border-gray-300 dark:border-gray-600 text-center flex items-center justify-center bg-gray-100 dark:bg-gray-700">Time</div>
                    {days.map(day => (
                        <div key={day} className="p-4 text-sm font-semibold text-center text-gray-700 dark:text-gray-200 border-r border-gray-300 dark:border-gray-600 last:border-r-0 flex items-center justify-center">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Time Slots */}
                {timeSlots.map(time => (
                    <div key={time} className="grid grid-cols-6 border-b border-gray-200 dark:border-gray-700 last:border-b-0 min-h-[80px]">
                        {/* Time Column */}
                        <div className="p-3 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border-r-2 border-gray-300 dark:border-gray-600 font-semibold flex items-center justify-center">
                            {time}
                        </div>

                        {/* Day Columns */}
                        {days.map(day => {
                            const course = schedule[day][time];
                            return (
                                <div key={`${day}-${time}`} className="p-2 border-r border-gray-200 dark:border-white/5 last:border-r-0 min-h-[80px] flex items-stretch bg-white dark:bg-[#121212]">
                                    {course && (
                                        <div className={`${getCourseColor(course)} rounded-lg p-3 border-2 w-full flex flex-col justify-center shadow-sm`}>
                                            <div className="text-xs font-bold text-gray-800 mb-1">
                                                {course.code}
                                            </div>

                                            <div className="text-xs text-gray-700 leading-tight font-medium">
                                                {course.title}
                                            </div>
                                            {course.isElective && (
                                                <div className="text-xs text-gray-500 mt-1 italic">
                                                    {course.electiveType}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Dynamic Legend */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs">
                {getCourseLegendData().map(({ prefix, name, colorClass }) => (
                    <div key={prefix} className="flex items-center gap-2">
                        <div className={`w-4 h-4 border-2 rounded ${colorClass}`}></div>
                        <span>{name} ({prefix})</span>
                    </div>
                ))}
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-100 border-2 border-blue-300 rounded"></div>
                    <span>Electives</span>
                </div>
            </div>

            {/* Note */}
            <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> This is a placeholder schedule. Actual course times, days, and availability
                    will be determined when you register for courses through uOttawa's system.
                </p>
            </div>
        </div>
    );
};

export default CurriculumCalendar; 