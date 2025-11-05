/**
 * Calendar Grid Configuration System
 * Defines responsive grid configurations for tablet and desktop breakpoints
 * Mobile (< 640px) configuration is handled separately and should not be modified
 */

export interface CalendarGridConfig {
  timeColumnWidth: number;
  dayColumnCount: number;
  weekendColumnWidth?: number;
  timeSlotHeight: number;
  fontSize: {
    eventTitle: string;
    eventSubtitle: string;
    eventDetail: string;
    timeLabel: string;
  };
  spacing: {
    eventPadding: string;
    columnGap: string;
  };
}

export type ResponsiveConfig = {
  xs: CalendarGridConfig;  // < 640px (Mobile - DO NOT MODIFY)
  sm: CalendarGridConfig;  // 640px - 767px (Small tablet)
  md: CalendarGridConfig;  // 768px - 1023px (Tablet)
  lg: CalendarGridConfig;  // 1024px - 1439px (Laptop)
  xl: CalendarGridConfig;  // 1440px - 1919px (Desktop)
  xxl: CalendarGridConfig; // >= 1920px (Large desktop)
};

export interface EventPosition {
  gridColumn: string; // e.g., "2 / 3" for column 2
  gridRow: string;    // e.g., "5 / 8" for rows 5-8
  top: number;        // Pixel offset within the row
  height: number;     // Height in pixels
}

/**
 * Responsive grid configurations for different screen sizes
 * IMPORTANT: xs (mobile) config is preserved and should not be modified
 */
export const CALENDAR_GRID_CONFIG: ResponsiveConfig = {
  // Mobile configuration - DO NOT MODIFY
  xs: {
    timeColumnWidth: 50,
    dayColumnCount: 5, // Monday-Friday only
    timeSlotHeight: 80,
    fontSize: {
      eventTitle: '0.65rem',
      eventSubtitle: '0.65rem',
      eventDetail: '0.6rem',
      timeLabel: '0.6rem',
    },
    spacing: {
      eventPadding: '4px 6px',
      columnGap: '0px',
    },
  },

  // Small tablet (640px - 767px)
  sm: {
    timeColumnWidth: 55,
    dayColumnCount: 7, // Include weekends
    weekendColumnWidth: 80,
    timeSlotHeight: 80,
    fontSize: {
      eventTitle: '0.7rem',
      eventSubtitle: '0.7rem',
      eventDetail: '0.65rem',
      timeLabel: '0.65rem',
    },
    spacing: {
      eventPadding: '5px 7px',
      columnGap: '0px',
    },
  },

  // Tablet (768px - 1023px)
  md: {
    timeColumnWidth: 60,
    dayColumnCount: 7,
    weekendColumnWidth: 85,
    timeSlotHeight: 80,
    fontSize: {
      eventTitle: '0.75rem',
      eventSubtitle: '0.75rem',
      eventDetail: '0.7rem',
      timeLabel: '0.7rem',
    },
    spacing: {
      eventPadding: '6px 8px',
      columnGap: '0px',
    },
  },

  // Laptop (1024px - 1439px)
  lg: {
    timeColumnWidth: 70,
    dayColumnCount: 7,
    weekendColumnWidth: 90,
    timeSlotHeight: 80,
    fontSize: {
      eventTitle: '0.8rem',
      eventSubtitle: '0.8rem',
      eventDetail: '0.75rem',
      timeLabel: '0.75rem',
    },
    spacing: {
      eventPadding: '6px 8px',
      columnGap: '0px',
    },
  },

  // Desktop (1440px - 1919px)
  xl: {
    timeColumnWidth: 80,
    dayColumnCount: 7,
    weekendColumnWidth: 100,
    timeSlotHeight: 90,
    fontSize: {
      eventTitle: '0.85rem',
      eventSubtitle: '0.85rem',
      eventDetail: '0.8rem',
      timeLabel: '0.8rem',
    },
    spacing: {
      eventPadding: '6px 8px',
      columnGap: '0px',
    },
  },

  // Large desktop (>= 1920px)
  xxl: {
    timeColumnWidth: 90,
    dayColumnCount: 7,
    weekendColumnWidth: 110,
    timeSlotHeight: 100,
    fontSize: {
      eventTitle: '0.9rem',
      eventSubtitle: '0.9rem',
      eventDetail: '0.85rem',
      timeLabel: '0.85rem',
    },
    spacing: {
      eventPadding: '6px 8px',
      columnGap: '0px',
    },
  },
};

/**
 * Get grid configuration for current screen width
 * @param screenWidth Current screen width in pixels
 * @returns CalendarGridConfig for the current breakpoint
 */
export function getGridConfig(screenWidth: number): CalendarGridConfig {
  if (screenWidth < 640) {
    return CALENDAR_GRID_CONFIG.xs;
  } else if (screenWidth < 768) {
    return CALENDAR_GRID_CONFIG.sm;
  } else if (screenWidth < 1024) {
    return CALENDAR_GRID_CONFIG.md;
  } else if (screenWidth < 1440) {
    return CALENDAR_GRID_CONFIG.lg;
  } else if (screenWidth < 1920) {
    return CALENDAR_GRID_CONFIG.xl;
  } else {
    return CALENDAR_GRID_CONFIG.xxl;
  }
}

/**
 * Get CSS grid template columns string for current screen width
 * @param screenWidth Current screen width in pixels
 * @returns CSS grid-template-columns value
 */
export function getGridTemplateColumns(screenWidth: number): string {
  const config = getGridConfig(screenWidth);
  
  if (screenWidth < 640) {
    // Mobile: time column + 5 equal weekday columns
    return `${config.timeColumnWidth}px repeat(5, 1fr)`;
  } else {
    // Tablet/Desktop: time column + 5 equal weekday columns + 2 fixed weekend columns
    return `${config.timeColumnWidth}px repeat(5, 1fr) ${config.weekendColumnWidth}px ${config.weekendColumnWidth}px`;
  }
}

/**
 * Get event grid column for tablet/desktop
 * @param dayIndex Day index (0 = Monday, 6 = Sunday)
 * @param screenWidth Current screen width in pixels
 * @returns CSS grid-column value (e.g., "2 / 3")
 */
export function getEventGridColumn(dayIndex: number, screenWidth: number): string {
  // Column 1 is time, so day columns start at 2
  const columnStart = dayIndex + 2;
  const columnEnd = columnStart + 1;
  return `${columnStart} / ${columnEnd}`;
}

/**
 * Convert time string to minutes since midnight
 * @param time Time string in HH:MM format
 * @returns Minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Get event grid row for tablet/desktop
 * @param startTime Start time in HH:MM format
 * @param endTime End time in HH:MM format
 * @param dayStartHour Hour when the calendar day starts (default: 8)
 * @returns CSS grid-row value (e.g., "5 / 8")
 */
export function getEventGridRow(
  startTime: string, 
  endTime: string, 
  dayStartHour: number = 8
): string {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  // Calculate minutes from day start
  const dayStartMinutes = dayStartHour * 60;
  const minutesPerSlot = 60;
  
  // Calculate row positions (1-indexed)
  const rowStart = Math.floor((startMinutes - dayStartMinutes) / minutesPerSlot) + 1;
  const rowEnd = Math.ceil((endMinutes - dayStartMinutes) / minutesPerSlot) + 1;
  
  // Ensure rows are within bounds
  const boundedRowStart = Math.max(1, rowStart);
  const boundedRowEnd = Math.max(boundedRowStart + 1, rowEnd);
  
  return `${boundedRowStart} / ${boundedRowEnd}`;
}

/**
 * Get complete event position for tablet/desktop
 * @param event Event object with startTime and endTime
 * @param dayIndex Day index (0 = Monday, 6 = Sunday)
 * @param screenWidth Current screen width in pixels
 * @param dayStartHour Hour when the calendar day starts (default: 8)
 * @returns EventPosition object with grid positioning data
 */
export function getEventPosition(
  event: { startTime: string; endTime: string },
  dayIndex: number,
  screenWidth: number,
  dayStartHour: number = 8
): EventPosition {
  const gridColumn = getEventGridColumn(dayIndex, screenWidth);
  const gridRow = getEventGridRow(event.startTime, event.endTime, dayStartHour);
  
  // Calculate pixel-based positioning for fine-tuning
  const startMinutes = timeToMinutes(event.startTime);
  const endMinutes = timeToMinutes(event.endTime);
  const dayStartMinutes = dayStartHour * 60;
  
  const config = getGridConfig(screenWidth);
  const slotHeight = config.timeSlotHeight;
  
  // Calculate top offset within the grid row
  const minutesFromSlotStart = (startMinutes - dayStartMinutes) % 60;
  const top = (minutesFromSlotStart / 60) * slotHeight;
  
  // Calculate height
  const durationMinutes = endMinutes - startMinutes;
  const height = (durationMinutes / 60) * slotHeight;
  
  return {
    gridColumn,
    gridRow,
    top: Math.floor(top),
    height: Math.floor(height),
  };
}
