"use client";

import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Course, Section, isCourseLegacy } from '@/types/course';
import { MultiSelectSectionDropdownProps } from '@/types/chat';

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
                className="w-full bg-cream dark:bg-[#1e1e1e] border border-gray-300 dark:border-white/5 rounded px-3 py-2 text-black dark:text-[#e0e0e0] text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-300 text-left flex items-center justify-between"
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
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-cream dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-64 overflow-y-auto">
                    {sectionOptions.map((option) => (
                        <div
                            key={option.value}
                            className={`px-3 py-2 border-b border-gray-100 dark:border-gray-600 last:border-b-0 transition-colors duration-150 ${pendingToggles.current.has(option.value)
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

export default MultiSelectSectionDropdown;

