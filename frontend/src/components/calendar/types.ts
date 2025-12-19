// Shared types for calendar components
export interface Event {
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
    term?: string; // e.g., "Fall 2025", "Winter 2026"
}

export interface EditEventModalProps {
    event: Event | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedEvent: Event) => void;
    isCreating?: boolean;
    allEvents?: Event[];
    onDeleteEvent?: (eventId: number) => void;
    onAddEvent?: (newEvent: Event) => void;
}

export interface SwapCourseModalProps {
    event: Event | null;
    isOpen: boolean;
    onClose: () => void;
    onSwap: (newEvent: Event) => void;
    allEvents?: Event[];
    onDeleteEvent?: (eventId: number) => void;
    onAddEvent?: (newEvent: Event) => void;
}

export interface EventTooltipProps {
    event: Event | null;
    visible: boolean;
    position: { x: number; y: number };
}

export interface WeeklyCalendarProps {
    date: Date | string;
    events: Event[];
    onDateChange?: (date: Date | string) => void;
    onEventChange?: (events: Event[]) => void;
    onEventEdit?: (eventId: number, updatedEvent: Event) => void;
    onEventDelete?: (eventId: number) => void;
    onEventAdd?: (event: Event) => void;
    onRefresh?: () => void;
    // Legacy prop names for backward compatibility
    onDeleteEvent?: (eventId: number) => void;
    onAddEvent?: (event: Event) => void;
    onEditEvent?: (eventId: number, updatedEvent: Event) => void;
    selectedTerm?: string;
    onTermChange?: (term: string) => void;
    loadFromBackend?: boolean;
    readOnly?: boolean;
    isKairollView?: boolean;
    onStatsChange?: (courseCount: number, conflictsCount: number, events?: Event[]) => void;
    courseCount?: number;
    conflictsCount?: number;
    currentTerm?: string;
}