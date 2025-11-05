import React, { memo } from 'react';
import { getGridConfig } from '@/config/calendar.grid.config';

interface CalendarEventProps {
  event: any;
  position: any;
  colorScheme: any;
  screenWidth: number;
  readOnly: boolean;
  onClick: () => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  displayInfo: any;
  normalizedEvent: any;
  formatTime12Hour: (time: string) => string;
}

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

const CalendarEvent: React.FC<CalendarEventProps> = memo(({
  position,
  colorScheme,
  screenWidth,
  readOnly,
  onClick,
  onMouseEnter,
  onMouseLeave,
  displayInfo,
  normalizedEvent,
  formatTime12Hour
}) => {
  const gridConfig = getGridConfig(screenWidth);
  
  return (
    <div
      className={`absolute rounded-md pointer-events-auto transition-all duration-300 ${colorScheme.bg} backdrop-blur-md border ${colorScheme.border} shadow-sm dark:shadow-[0_0_4px_rgba(255,255,255,0.05)] z-30 ${
        readOnly 
          ? 'cursor-default' 
          : `cursor-pointer ${colorScheme.hover} hover:shadow-md dark:hover:shadow-[0_0_8px_rgba(255,255,255,0.1)]`
      }`}
      style={{
        top: position.top,
        height: position.height,
        left: '4px',
        width: 'calc(100% - 8px)',
        padding: gridConfig.spacing.eventPadding,
        fontSize: gridConfig.fontSize.eventTitle,
        minHeight: '30px',
        margin: '0',
        boxSizing: 'border-box',
        overflow: 'hidden',
        willChange: 'transform',
        contain: 'layout style paint'
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="h-full flex flex-col p-1">
        <div className="flex-none space-y-1">
          <div 
            className={`${colorScheme.text} font-bold text-sm leading-tight overflow-hidden`}
            style={{
              wordBreak: 'break-word',
              hyphens: 'auto'
            }}
          >
            {displayInfo.courseCode}
          </div>

          <div 
            className={`${colorScheme.text} text-sm font-medium leading-tight overflow-hidden`}
            style={{
              wordBreak: 'break-word'
            }}
          >
            {getFullSectionType(displayInfo.sectionType)}
          </div>

          <div 
            className={`${colorScheme.text} text-xs opacity-75 leading-tight overflow-hidden`}
            style={{
              wordBreak: 'break-word'
            }}
          >
            {displayInfo.professor || 'Staff'}
          </div>

          <div 
            className={`${colorScheme.text} text-xs opacity-60 leading-tight overflow-hidden`}
            style={{
              wordBreak: 'break-word'
            }}
          >
            {`${formatTime12Hour(normalizedEvent.startTime)} - ${formatTime12Hour(normalizedEvent.endTime)}`}
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.event.id === nextProps.event.id &&
    prevProps.position.top === nextProps.position.top &&
    prevProps.position.height === nextProps.position.height &&
    prevProps.screenWidth === nextProps.screenWidth &&
    prevProps.readOnly === nextProps.readOnly &&
    prevProps.event.theme === nextProps.event.theme
  );
});

CalendarEvent.displayName = 'CalendarEvent';

export default CalendarEvent;
