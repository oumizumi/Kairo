/**
 * Chat and Calendar Type Definitions
 */

import { Course } from './course';

export interface ChatMessage {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: Date;
    curriculumData?: any;
    yearRequested?: number;
    termRequested?: string;
    isFullSequence?: boolean;
}

export interface CalendarComponentProps {
    refreshKey: number;
    initialDate?: string;
    onEventAdded?: () => void;
    showDeleteButton?: boolean;
    onStatsChange?: (courseCount: number, conflictsCount: number, events?: DailyCalendarEvent[]) => void;
    courseCount?: number;
    conflictsCount?: number;
    isKairollView?: boolean;
    selectedTerm?: string;
}

export interface DailyCalendarEvent {
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
    term?: string;
}

export interface BackendMessage {
    id: number;
    content: string;
    role: 'user' | 'assistant';
    timestamp: string;
}

export interface AssistantComponentProps {
    onEventAdded?: () => void;
}

export interface InteractiveCoursesBadgeProps {
    events: DailyCalendarEvent[];
    selectedTerm: string;
    onTermChange: (term: string) => void;
}

export interface MultiSelectSectionDropdownProps {
    course: Course;
    onSelectionChange: (selectedSections: string[]) => void;
}

export interface CourseCardProps {
    course: Course;
    onAddCourse: (course: Course) => void;
    onSectionToggle?: (section: any, isSelected: boolean) => void;
    selectedSectionEvents?: Map<string, number[]>;
    pendingAdditions?: Map<string, string>;
}

export interface FeatureCarouselProps {
    isOpen: boolean;
    onClose: () => void;
    onSignup: () => void;
    onLogin: () => void;
    isMobile: boolean;
}

export interface MobileEventInfoModalProps {
    event: DailyCalendarEvent;
    onClose: () => void;
    position?: { x: number, y: number };
}

