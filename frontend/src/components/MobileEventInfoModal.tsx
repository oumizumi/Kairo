"use client";

import React, { useState } from 'react';
import { Calendar, Clock, Text, Edit, X } from "lucide-react";
import { MobileEventInfoModalProps } from '@/types/chat';
import { parseEventDescription } from '@/utils/chatHelpers';
import { Button } from '@/components/ui/button';
import EditEventModal from '@/components/calendar/EditEventModal';
import { Event } from '@/components/calendar/types';

const MobileEventInfoModal: React.FC<MobileEventInfoModalProps> = ({ event, onClose, position }) => {
    const [showEditModal, setShowEditModal] = useState(false);

    // Safely parse event description with fallbacks
    const { courseTitle, section, instructor } = parseEventDescription(event?.description);
    const courseCodeMatch = event?.title?.match(/([A-Z]{3}\s*\d{4})/);
    const courseCode = courseCodeMatch ? courseCodeMatch[0] : '';
    const sectionTypeMatch = event?.title?.match(/\(([^)]+)\)/);
    const sectionType = sectionTypeMatch ? sectionTypeMatch[1] : 'LEC';

    // Map section type abbreviations to full names
    const sectionTypeMap: { [key: string]: string } = {
        'LEC': 'Lecture',
        'LAB': 'Laboratory',
        'TUT': 'Tutorial',
        'SEM': 'Seminar',
        'DGD': 'Discussion Group'
    };
    const fullSectionType = sectionTypeMap[sectionType] || sectionType;

    const formatTime12Hour = (timeString: string) => {
        if (!timeString) return '';
        const [hour, minute] = timeString.split(':');
        const hourNum = parseInt(hour, 10);
        const ampm = hourNum >= 12 ? 'PM' : 'AM';
        const formattedHour = hourNum % 12 || 12;
        return `${formattedHour}:${minute} ${ampm}`;
    };

    const handleEdit = () => {
        setShowEditModal(true);
    };

    const handleSaveEdit = (updatedEvent: Event) => {
        // TODO: Call parent's onEdit handler if provided
        setShowEditModal(false);
        onClose();
    };

    return (
        <>
            {/* Backdrop - centered positioning */}
            <div
                className="fixed inset-0 z-[59] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={onClose}
            >
                {/* Modal - always centered */}
                <div
                    className="relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 text-gray-900 dark:text-white rounded-2xl shadow-2xl p-4 w-full max-w-[280px] border border-gray-200 dark:border-gray-700 animate-in fade-in-0 zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 z-10"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>

                    <div className="pr-8">
                        {/* Course Code */}
                        <h3 className="font-bold text-xl mb-1.5 text-blue-600 dark:text-blue-400 leading-tight">
                            {courseCode || 'Course'}
                        </h3>

                        {/* Course Title */}
                        {courseTitle && (
                            <h4 className="font-medium text-sm mb-3 text-gray-700 dark:text-gray-300 leading-snug">
                                {courseTitle}
                            </h4>
                        )}

                        {/* Details */}
                        <div className="space-y-2.5 text-sm mt-4">
                            {/* Time */}
                            <div className="flex items-center gap-2.5">
                                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-semibold text-green-600 dark:text-green-400">
                                    {formatTime12Hour(event.startTime)} - {formatTime12Hour(event.endTime)}
                                </span>
                            </div>

                            {/* Section */}
                            {section && (
                                <div className="flex items-center gap-2.5">
                                    <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    <span className="text-gray-700 dark:text-gray-300">
                                        {section} <span className="text-gray-500 dark:text-gray-400">({fullSectionType})</span>
                                    </span>
                                </div>
                            )}

                            {/* Instructor */}
                            {instructor && (
                                <div className="flex items-center gap-2.5">
                                    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span className="text-gray-700 dark:text-gray-300">
                                        {instructor}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Edit Button */}
                        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <Button
                                onClick={handleEdit}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                size="sm"
                            >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Event
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Event Modal */}
            {showEditModal && (
                <EditEventModal
                    event={event as Event}
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    onSave={handleSaveEdit}
                    isCreating={false}
                />
            )}
        </>
    );
};

export default MobileEventInfoModal;

