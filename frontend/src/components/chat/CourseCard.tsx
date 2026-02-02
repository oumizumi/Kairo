"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Course, isCourseGrouped } from '@/types/course';
import { CourseCardProps } from '@/types/chat';
import ProfessorWithRMP from '@/components/ProfessorWithRMP';

const CourseCard = React.memo(function CourseCard({ course, onAddCourse, onSectionToggle, selectedSectionEvents, pendingAdditions }: CourseCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    // Touch tracking to differentiate between scroll and click
    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
    const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

    // Use the global selection state with unique course-section identifiers
    const isSelected = (sectionCode: string) => {
        const courseCode = isCourseGrouped(course) ? course.courseCode : course.code;
        const uniqueKey = `${courseCode}-${sectionCode}`;
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

    // Check if touch movement was a scroll (moved more than 10px)
    const wasScroll = () => {
        if (!touchStart || !touchEnd) return false;
        const deltaX = Math.abs(touchEnd.x - touchStart.x);
        const deltaY = Math.abs(touchEnd.y - touchStart.y);
        return deltaX > 10 || deltaY > 10;
    };

    const handleSectionClick = (sectionCode: string, sectionData: any) => {
        const isCurrentlySelected = isSelected(sectionCode);
        const courseCode = isCourseGrouped(course) ? course.courseCode : course.code;
        const uniqueSectionData = {
            ...sectionData,
            uniqueKey: `${courseCode}-${sectionCode}`,
            courseCode: courseCode
        };

        if (onSectionToggle) {
            onSectionToggle(uniqueSectionData, !isCurrentlySelected);
        }
    };

    // Helper function to format time with stacked days
    const formatStackedTime = (timeString: string | undefined) => {
        if (!timeString) return null;
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
            <div className="w-full bg-gray-100 dark:bg-cream/[0.06] border border-gray-200 dark:border-white/10 rounded-lg transition-colors">
                {/* Course Header - Grouped Format */}
                <div
                    className="p-3 sm:p-4 cursor-pointer hover:bg-gray-200 dark:hover:bg-cream/[0.12] transition-colors"
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
                        const lecturePrefix = sectionGroup.lecture?.section?.charAt(0) || groupId.charAt(0);

                        if (!groupedByPrefix.has(lecturePrefix)) {
                            groupedByPrefix.set(lecturePrefix, { labs: [], tutorials: [] });
                        }

                        const group = groupedByPrefix.get(lecturePrefix)!;

                        if (sectionGroup.lecture) {
                            group.lecture = sectionGroup.lecture;
                        }

                        if (sectionGroup.labs) {
                            group.labs.push(...sectionGroup.labs);
                        }

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
                                const baseSectionCode = group.lecture?.section?.split('-')[0] ||
                                    group.labs[0]?.section?.split('-')[0] ||
                                    group.tutorials[0]?.section?.split('-')[0] ||
                                    `${prefix}00`;

                                return (
                                    <div key={prefix} className="border-b border-gray-200 dark:border-white/10 last:border-b-0">
                                        {/* Main section header */}
                                        <div
                                            className="p-2 sm:p-3 hover:bg-gray-50 dark:hover:bg-cream/[0.03] transition-colors cursor-pointer touch-manipulation"
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
                                                {isDetailExpanded && group.lecture?.instructor && (
                                                    <div className="flex items-center">
                                                        <ProfessorWithRMP
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
                                            <div className="bg-gray-50 dark:bg-cream/[0.02] border-t border-gray-200 dark:border-white/5">
                                                {/* Lecture Section */}
                                                {group.lecture && (
                                                    <>
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
                                                                    <motion.div
                                                                        className={`w-5 h-5 border-2 touch-manipulation rounded-sm ${isPending(group.lecture.section)
                                                                            ? 'border-orange-400 bg-orange-100 animate-pulse cursor-wait'
                                                                            : isSelected(group.lecture.section)
                                                                                ? 'bg-blue-600 border-blue-600 shadow-lg cursor-pointer'
                                                                                : 'border-gray-400 dark:border-gray-500 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                                                            }`}
                                                                        whileTap={{ scale: 0.9 }}
                                                                        transition={{ duration: 0.12 }}
                                                                        onTouchStart={(e) => {
                                                                            setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                                                                        }}
                                                                        onTouchEnd={(e) => {
                                                                            setTouchEnd({ x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY });
                                                                        }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            e.preventDefault();

                                                                            if (wasScroll()) {
                                                                                setTouchStart(null);
                                                                                setTouchEnd(null);
                                                                                return;
                                                                            }

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

                                                                            setTouchStart(null);
                                                                            setTouchEnd(null);
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
                                                                    </motion.div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                {/* Labs Section */}
                                                {group.labs && group.labs.length > 0 && (
                                                    <>
                                                        <div className="py-1"></div>
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
                                                                        <motion.div
                                                                            className={`w-5 h-5 border-2 touch-manipulation rounded-sm ${isPending(lab.section)
                                                                                ? 'border-orange-400 bg-orange-100 animate-pulse cursor-wait'
                                                                                : isSelected(lab.section)
                                                                                    ? 'bg-blue-600 border-blue-600 shadow-lg cursor-pointer'
                                                                                    : 'border-gray-400 dark:border-gray-500 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                                                                }`}
                                                                            whileTap={{ scale: 0.9 }}
                                                                            transition={{ duration: 0.12 }}
                                                                            onTouchStart={(e) => {
                                                                                setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                                                                            }}
                                                                            onTouchEnd={(e) => {
                                                                                setTouchEnd({ x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY });
                                                                            }}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                e.preventDefault();

                                                                                if (wasScroll()) {
                                                                                    setTouchStart(null);
                                                                                    setTouchEnd(null);
                                                                                    return;
                                                                                }

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

                                                                                setTouchStart(null);
                                                                                setTouchEnd(null);
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
                                                                        </motion.div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </>
                                                )}

                                                {/* Tutorials Section */}
                                                {group.tutorials && group.tutorials.length > 0 && (
                                                    <>
                                                        <div className="py-1"></div>
                                                        <div className="px-6 pt-3 pb-1 flex justify-between items-center">
                                                            <span className="text-base text-neutral-600 dark:text-white font-bold">Tutorials</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">Choose 1 of {group.tutorials.length}</span>
                                                        </div>
                                                        {group.tutorials.sort((a, b) => a.section.localeCompare(b.section)).map((tutorial: any, idx: number) => {
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
                                                                            <motion.div
                                                                                className={`w-5 h-5 border-2 touch-manipulation rounded-sm ${isPending(tutorial.section)
                                                                                    ? 'border-orange-400 bg-orange-100 animate-pulse cursor-wait'
                                                                                    : isSelected(tutorial.section)
                                                                                        ? 'bg-blue-600 border-blue-600 shadow-lg cursor-pointer'
                                                                                        : 'border-gray-400 dark:border-gray-500 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                                                                    }`}
                                                                                whileTap={{ scale: 0.9 }}
                                                                                transition={{ duration: 0.12 }}
                                                                                onTouchStart={(e) => {
                                                                                    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                                                                                }}
                                                                                onTouchEnd={(e) => {
                                                                                    setTouchEnd({ x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY });
                                                                                }}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    e.preventDefault();

                                                                                    if (wasScroll()) {
                                                                                        setTouchStart(null);
                                                                                        setTouchEnd(null);
                                                                                        return;
                                                                                    }

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

                                                                                    setTouchStart(null);
                                                                                    setTouchEnd(null);
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
                                                                            </motion.div>
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
            <div className="bg-gray-100 dark:bg-cream/[0.06] border border-gray-200 dark:border-white/10 rounded-lg transition-colors">
                <div
                    className="p-4 cursor-pointer hover:bg-gray-200 dark:hover:bg-cream/[0.12] transition-colors"
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
            </div>
        );
    }
});

export default CourseCard;

