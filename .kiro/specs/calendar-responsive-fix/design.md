# Design Document

## Overview

This design addresses critical layout and alignment issues in the Kairo calendar component across non-mobile screen sizes. The calendar currently suffers from inconsistent column widths, misaligned event blocks, and overflow problems that break the layout on tablets, laptops, and large desktops. The solution involves refactoring the CSS grid system, improving event positioning calculations, and implementing proper responsive breakpoints.

## Architecture

### Current Issues Identified

1. **Inconsistent Grid Column Calculations**
   - Mobile uses `grid-cols-[50px_repeat(5,1fr)]` but desktop uses `grid-cols-[64px_repeat(5,1fr)_100px_100px]`
   - Event positioning uses complex calc() expressions that don't match the actual grid layout
   - Time column width varies (50px mobile, 64px desktop) causing misalignment

2. **Event Positioning Problems**
   - Events use absolute positioning with calc() that doesn't account for actual grid column widths
   - Left position calculations are inconsistent between mobile and desktop
   - No proper handling for tablets (768px-1023px) - they fall into desktop styles but need different treatment

3. **Overflow and Scrolling Issues**
   - Time grid has conflicting overflow properties
   - Events can overflow their column boundaries
   - Horizontal scrolling appears on some screen sizes

4. **Responsive Breakpoint Gaps**
   - Only two breakpoints: mobile (<640px) and desktop (>=640px)
   - Tablets (768px-1023px) need specific handling
   - Large desktops (1440px+) need optimized spacing

## Components and Interfaces

### 1. Grid System Refactor

**Current Structure:**
```tsx
// Mobile: grid-cols-[50px_repeat(5,1fr)]
// Desktop: grid-cols-[64px_repeat(5,1fr)_100px_100px]
```

**Proposed Structure:**
```tsx
// Mobile (< 640px): grid-cols-[50px_repeat(5,1fr)]
// Tablet (640px-1023px): grid-cols-[60px_repeat(5,1fr)_80px_80px]
// Laptop (1024px-1439px): grid-cols-[70px_repeat(5,1fr)_90px_90px]
// Desktop (>= 1440px): grid-cols-[80px_repeat(5,1fr)_100px_100px]
```

### 2. Event Positioning System

**Current Approach:**
- Uses complex calc() expressions with hardcoded pixel values
- Doesn't match actual grid column widths
- Example: `calc(${timeColumnWidth}px + (${singleColumnWidth} * ${dayIndex}))`

**Proposed Approach:**
- Use CSS Grid's built-in positioning with `grid-column` property
- Calculate column start/end based on day index
- Remove absolute positioning in favor of grid placement
- Use CSS custom properties for dynamic values

### 3. Responsive Breakpoint System

**Breakpoints:**
- `xs`: < 640px (Mobile - existing)
- `sm`: 640px - 767px (Small tablet)
- `md`: 768px - 1023px (Tablet)
- `lg`: 1024px - 1439px (Laptop)
- `xl`: 1440px - 1919px (Desktop)
- `2xl`: >= 1920px (Large desktop)

### 4. Typography and Spacing Scale

**Font Sizes by Breakpoint:**
```css
/* Event blocks */
xs: 0.65rem - 0.7rem
sm: 0.7rem - 0.75rem
md: 0.75rem - 0.8rem
lg: 0.8rem - 0.85rem
xl: 0.85rem - 0.9rem
2xl: 0.9rem - 1rem

/* Time labels */
xs: 0.6rem
sm: 0.65rem
md: 0.7rem
lg: 0.75rem
xl: 0.8rem
2xl: 0.85rem
```

**Spacing Scale:**
```css
/* Time column width */
xs: 50px
sm: 55px
md: 60px
lg: 70px
xl: 80px
2xl: 90px

/* Time slot height */
xs: 60px
sm: 70px
md: 80px
lg: 80px
xl: 90px
2xl: 100px
```

## Data Models

### CalendarGridConfig Interface

```typescript
interface CalendarGridConfig {
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
```

### ResponsiveConfig Type

```typescript
type ResponsiveConfig = {
  xs: CalendarGridConfig;
  sm: CalendarGridConfig;
  md: CalendarGridConfig;
  lg: CalendarGridConfig;
  xl: CalendarGridConfig;
  xxl: CalendarGridConfig;
};
```

### EventPosition Interface

```typescript
interface EventPosition {
  gridColumn: string; // e.g., "2 / 3" for column 2
  gridRow: string;    // e.g., "5 / 8" for rows 5-8
  top: number;        // Pixel offset within the row
  height: number;     // Height in pixels
}
```

## Error Handling

### Grid Calculation Errors

**Problem:** Event positioning calculations can fail if grid dimensions are unavailable

**Solution:**
- Add fallback values for all grid calculations
- Implement bounds checking to ensure events stay within columns
- Add error boundaries around event rendering

### Overflow Prevention

**Problem:** Events can overflow their containers causing layout breaks

**Solution:**
- Add `overflow: hidden` to day columns
- Implement max-width constraints on event blocks
- Use `box-sizing: border-box` consistently

### Screen Resize Handling

**Problem:** Layout can break during window resize

**Solution:**
- Debounce resize events (300ms)
- Recalculate grid dimensions on resize
- Use CSS transitions for smooth adaptation

## Testing Strategy

### Visual Regression Testing

1. **Breakpoint Testing**
   - Test at each breakpoint boundary (639px, 640px, 767px, 768px, etc.)
   - Verify column widths match expected values
   - Check event positioning accuracy

2. **Event Density Testing**
   - Test with 0 events (empty state)
   - Test with 1-3 events per day (normal)
   - Test with 5+ events per day (high density)
   - Test with overlapping events

3. **Content Testing**
   - Test with short course names (3-4 chars)
   - Test with long course names (20+ chars)
   - Test with long professor names
   - Test with missing data (no professor, no time)

### Functional Testing

1. **Scrolling Behavior**
   - Verify vertical scrolling works smoothly
   - Confirm no horizontal scrolling appears
   - Test scroll performance with many events

2. **Event Interaction**
   - Click/tap events at different screen sizes
   - Hover states on desktop
   - Touch interactions on tablets

3. **Layout Integrity**
   - Verify no overflow beyond container
   - Check that all events are visible
   - Confirm proper spacing between elements

### Cross-Browser Testing

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

### Device Testing

- iPad (768px x 1024px)
- iPad Pro (1024px x 1366px)
- MacBook Air 13" (1440px x 900px)
- MacBook Pro 16" (1728px x 1117px)
- Desktop 1080p (1920px x 1080px)
- Desktop 1440p (2560px x 1440px)

## Implementation Approach

### Phase 1: CSS Grid Refactor

1. Replace absolute positioning with CSS Grid
2. Implement responsive grid-template-columns
3. Add CSS custom properties for dynamic values
4. Remove complex calc() expressions

### Phase 2: Event Positioning

1. Create event positioning utility function
2. Implement grid-column/grid-row calculations
3. Add bounds checking and overflow prevention
4. Update event rendering logic

### Phase 3: Responsive Breakpoints

1. Add new breakpoint media queries
2. Implement responsive typography scale
3. Add responsive spacing scale
4. Test at all breakpoints

### Phase 4: Polish and Optimization

1. Add smooth transitions
2. Optimize performance
3. Add error boundaries
4. Implement visual regression tests

## Design Decisions and Rationales

### Decision 1: Use CSS Grid Instead of Absolute Positioning

**Rationale:**
- CSS Grid is designed for this exact use case
- Eliminates complex calc() expressions
- Automatically handles responsive behavior
- Better browser support and performance

**Trade-offs:**
- Requires refactoring existing code
- May need to adjust event rendering logic
- Learning curve for team members unfamiliar with Grid

### Decision 2: Six Breakpoints Instead of Two

**Rationale:**
- Tablets need specific treatment (current gap between 640px-1023px)
- Large desktops can benefit from more spacious layout
- Better matches actual device landscape
- Allows for more precise control

**Trade-offs:**
- More CSS to maintain
- More testing required
- Slightly larger bundle size

### Decision 3: Remove Weekend Columns on Mobile

**Rationale:**
- Most classes don't occur on weekends
- Saves horizontal space on small screens
- Reduces cognitive load
- Already implemented in current code

**Trade-offs:**
- Weekend events won't be visible on mobile
- Users need to switch to desktop for weekend view

### Decision 4: Dynamic Time Column Width

**Rationale:**
- Larger screens can afford more space for time labels
- Improves readability on desktop
- Maintains compact layout on mobile
- Scales naturally with screen size

**Trade-offs:**
- Requires responsive calculations
- More complex grid template

## Key Technical Specifications

### Grid Template Columns Formula

```css
/* General formula */
grid-template-columns: [time-col-width] repeat([day-count], 1fr) [weekend-col-width] [weekend-col-width];

/* Specific implementations */
@media (max-width: 639px) {
  grid-template-columns: 50px repeat(5, 1fr);
}

@media (min-width: 640px) and (max-width: 767px) {
  grid-template-columns: 55px repeat(5, 1fr) 80px 80px;
}

@media (min-width: 768px) and (max-width: 1023px) {
  grid-template-columns: 60px repeat(5, 1fr) 85px 85px;
}

@media (min-width: 1024px) and (max-width: 1439px) {
  grid-template-columns: 70px repeat(5, 1fr) 90px 90px;
}

@media (min-width: 1440px) and (max-width: 1919px) {
  grid-template-columns: 80px repeat(5, 1fr) 100px 100px;
}

@media (min-width: 1920px) {
  grid-template-columns: 90px repeat(5, 1fr) 110px 110px;
}
```

### Event Positioning Formula

```typescript
// Calculate grid column for event
function getEventGridColumn(dayIndex: number, screenWidth: number): string {
  // Column 1 is time, so day columns start at 2
  const columnStart = dayIndex + 2;
  const columnEnd = columnStart + 1;
  return `${columnStart} / ${columnEnd}`;
}

// Calculate grid row for event
function getEventGridRow(startTime: string, endTime: string, slotHeight: number): string {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  // Assuming day starts at 8:00 AM (480 minutes)
  const dayStartMinutes = 480;
  const minutesPerSlot = 60;
  
  const rowStart = Math.floor((startMinutes - dayStartMinutes) / minutesPerSlot) + 1;
  const rowEnd = Math.ceil((endMinutes - dayStartMinutes) / minutesPerSlot) + 1;
  
  return `${rowStart} / ${rowEnd}`;
}
```

### Container Overflow Prevention

```css
.weekly-calendar {
  overflow: hidden; /* Prevent horizontal scroll */
  width: 100%;
  max-width: 100%;
}

.time-grid {
  overflow-y: auto; /* Allow vertical scroll */
  overflow-x: hidden; /* Prevent horizontal scroll */
  width: 100%;
  max-width: 100%;
}

.day-column {
  overflow: hidden; /* Clip events to column */
  position: relative;
}

.event-block {
  max-width: 100%; /* Never exceed column width */
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

## Performance Considerations

### Rendering Optimization

- Use `will-change: transform` for animated elements
- Implement virtual scrolling for calendars with 100+ events
- Debounce resize handlers (300ms)
- Use CSS containment for event blocks

### Memory Management

- Limit number of rendered events per view
- Clean up event listeners on unmount
- Use React.memo for event components
- Implement lazy loading for off-screen events

## Accessibility

- Maintain keyboard navigation
- Ensure sufficient color contrast (WCAG AA)
- Add ARIA labels for screen readers
- Support reduced motion preferences

## Browser Compatibility

- CSS Grid: All modern browsers (IE11 not supported)
- CSS Custom Properties: All modern browsers
- Flexbox fallback: Not needed (Grid is sufficient)
- Vendor prefixes: Not required for target browsers
