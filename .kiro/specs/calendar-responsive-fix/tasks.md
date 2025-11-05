# Implementation Plan

**IMPORTANT: Do NOT modify mobile styles (< 640px). Only work on tablet and desktop breakpoints.**

- [x] 1. Create responsive grid configuration system for tablet/desktop
  - Create TypeScript interfaces for grid configuration (CalendarGridConfig, ResponsiveConfig)
  - Define grid configurations for tablet/desktop breakpoints only (sm, md, lg, xl, 2xl)
  - Add CSS custom properties for dynamic grid values (640px and above)
  - Leave mobile (< 640px) configuration untouched
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2_

- [x] 2. Refactor CSS grid system for tablet/desktop in DailyCalendar component
  - [x] 2.1 Update grid-template-columns for tablet/desktop breakpoints only
    - Replace hardcoded grid values with responsive configurations for >= 640px
    - Implement media queries for sm (640-767px), md (768-1023px), lg (1024-1439px), xl (1440-1919px), 2xl (>= 1920px)
    - Add dynamic time column widths for tablet/desktop (60px → 90px)
    - DO NOT modify mobile (< 640px) grid styles
    - _Requirements: 1.1, 1.2, 4.1, 4.2, 4.3_
  
  - [x] 2.2 Remove absolute positioning from event blocks (tablet/desktop only)
    - Replace absolute positioning with CSS Grid placement for >= 640px
    - Remove complex calc() expressions for left/width on tablet/desktop
    - Implement grid-column and grid-row for event positioning on tablet/desktop
    - Keep mobile event positioning unchanged
    - _Requirements: 2.1, 2.3, 2.4_
  
  - [x] 2.3 Add overflow prevention styles (tablet/desktop only)
    - Add overflow: hidden to weekly-calendar container for >= 640px
    - Set overflow-x: hidden on time-grid for >= 640px
    - Add max-width: 100% to event blocks for >= 640px
    - Implement box-sizing: border-box consistently for >= 640px
    - Do not modify mobile overflow styles
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 3. Implement event positioning utility functions (tablet/desktop only)
  - [x] 3.1 Create getEventGridColumn function for tablet/desktop
    - Calculate grid column based on day index for >= 640px
    - Account for time column offset on tablet/desktop
    - Return grid-column string (e.g., "2 / 3")
    - Do not affect mobile event positioning
    - _Requirements: 2.1, 2.3, 4.3_
  
  - [x] 3.2 Create getEventGridRow function for tablet/desktop
    - Convert start/end times to grid row positions for >= 640px
    - Calculate row span based on event duration
    - Handle edge cases (events before 8am, after 10pm)
    - Return grid-row string (e.g., "5 / 8")
    - Keep mobile row calculations unchanged
    - _Requirements: 2.1, 2.5_
  
  - [x] 3.3 Create getEventPosition function for tablet/desktop
    - Combine grid column and row calculations for >= 640px
    - Add bounds checking to prevent overflow on tablet/desktop
    - Return EventPosition object with all positioning data
    - Use separate logic path for mobile (< 640px)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 3.4 Update event rendering to use new positioning (tablet/desktop only)
    - Replace inline style calculations with utility functions for >= 640px
    - Apply grid-column and grid-row to event elements on tablet/desktop
    - Remove absolute positioning styles for >= 640px
    - Keep mobile event rendering logic unchanged
    - _Requirements: 2.1, 2.3, 2.4_

- [x] 4. Implement responsive typography and spacing (tablet/desktop only)
  - [x] 4.1 Add responsive font size classes for tablet/desktop
    - Create utility classes for event titles on tablet/desktop (.event-title-sm, .event-title-md, etc.)
    - Create utility classes for event subtitles and details for >= 640px
    - Create utility classes for time labels for >= 640px
    - Implement media queries for tablet/desktop breakpoints only
    - Do not modify mobile font sizes
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 4.2 Add responsive spacing scale for tablet/desktop
    - Define padding values for tablet/desktop breakpoints
    - Define margin values for tablet/desktop breakpoints
    - Define gap values for grid columns on >= 640px
    - Update event block padding responsively for tablet/desktop
    - Keep mobile spacing unchanged
    - _Requirements: 5.4, 5.5_
  
  - [x] 4.3 Update time slot heights for tablet/desktop
    - Set time slot heights for tablet/desktop breakpoints (70px → 100px)
    - Ensure event heights scale proportionally on >= 640px
    - Update scroll container calculations for tablet/desktop
    - Do not change mobile time slot heights
    - _Requirements: 2.5, 3.1, 3.2_

- [x] 5. Add tablet-specific breakpoint handling
  - [x] 5.1 Implement sm breakpoint (640-767px)
    - Add media query for small tablets
    - Set grid-template-columns: 55px repeat(5, 1fr) 80px 80px
    - Adjust font sizes and spacing
    - _Requirements: 1.1, 1.2, 4.1, 4.2, 5.1_
  
  - [x] 5.2 Implement md breakpoint (768-1023px)
    - Add media query for tablets
    - Set grid-template-columns: 60px repeat(5, 1fr) 85px 85px
    - Adjust font sizes and spacing
    - Test on iPad and similar devices
    - _Requirements: 1.1, 1.2, 4.1, 4.2, 5.2_

- [x] 6. Update globals.css with responsive calendar styles (tablet/desktop only)
  - [x] 6.1 Add responsive grid styles for tablet/desktop
    - Update .weekly-calendar styles for >= 640px breakpoints only
    - Update .time-grid styles for >= 640px breakpoints only
    - Update .day-column styles for >= 640px breakpoints only
    - Do not modify mobile (< 640px) grid styles
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3_
  
  - [x] 6.2 Add responsive event block styles for tablet/desktop
    - Update .event-block styles for >= 640px only
    - Add responsive padding and margins for tablet/desktop
    - Add responsive font sizes for >= 640px
    - Ensure text truncation works at tablet/desktop sizes
    - Keep mobile event block styles unchanged
    - _Requirements: 2.1, 2.3, 2.4, 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 6.3 Add responsive scrollbar styles for tablet/desktop
    - Update scrollbar width for tablet/desktop breakpoints
    - Ensure scrollbar is visible on all tablet/desktop sizes
    - Add smooth scrolling behavior for >= 640px
    - Do not modify mobile scrollbar styles
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 7. Add screen resize handling
  - [x] 7.1 Implement debounced resize handler
    - Create useDebounce hook or use existing
    - Debounce resize events to 300ms
    - Recalculate grid dimensions on resize
    - _Requirements: 1.4, 4.4_
  
  - [x] 7.2 Add smooth transitions for layout changes
    - Add CSS transitions for grid changes
    - Add transitions for font size changes
    - Ensure transitions don't impact performance
    - _Requirements: 1.4_

- [x] 8. Fix Kairoll view calendar width
  - [x] 8.1 Ensure calendar respects 65% width constraint
    - Verify calendar container uses correct width in Kairoll view
    - Test grid calculations within 65% container
    - Ensure no overflow beyond container
    - _Requirements: 1.5, 4.4, 6.3, 6.4_
  
  - [x] 8.2 Update event positioning for Kairoll view
    - Verify events position correctly in narrower container
    - Test with various screen sizes in Kairoll view
    - Ensure column widths calculate correctly
    - _Requirements: 2.3, 2.4, 4.4_

- [x] 9. Test calendar at tablet/desktop breakpoints
  - [x] 9.1 Test at tablet/desktop breakpoint boundaries
    - Test at 640px, 767px, 768px, 1023px, 1024px, 1439px, 1440px, 1919px, 1920px
    - Verify grid columns match expected values on tablet/desktop
    - Check event positioning accuracy on >= 640px
    - Verify no horizontal scrolling on tablet/desktop
    - Confirm mobile (< 640px) still works correctly
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.3, 6.1, 6.2_
  
  - [x] 9.2 Test with various event densities on tablet/desktop
    - Test with 0 events (empty state) on >= 640px
    - Test with 1-3 events per day (normal) on tablet/desktop
    - Test with 5+ events per day (high density) on >= 640px
    - Test with overlapping events on tablet/desktop
    - Verify mobile event rendering still works
    - _Requirements: 2.2, 2.4, 6.4, 6.5_
  
  - [x] 9.3 Test scrolling behavior on tablet/desktop
    - Verify smooth vertical scrolling on >= 640px
    - Confirm no horizontal scrolling appears on tablet/desktop
    - Test scroll performance with many events on >= 640px
    - Verify scrollbar visibility on tablet/desktop
    - Confirm mobile scrolling unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x] 9.4 Test on actual tablet/desktop devices
    - Test on iPad (768px x 1024px)
    - Test on iPad Pro (1024px x 1366px)
    - Test on MacBook Air 13" (1440px x 900px)
    - Test on MacBook Pro 16" (1728px x 1117px)
    - Test on 1080p desktop (1920px x 1080px)
    - Test on 1440p desktop (2560px x 1440px)
    - Verify mobile still works on phone
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 10. Performance optimization (tablet/desktop only)
  - [x] 10.1 Add CSS containment for event blocks on tablet/desktop
    - Add contain: layout style to event blocks for >= 640px
    - Test rendering performance improvement on tablet/desktop
    - Do not modify mobile event rendering
    - _Requirements: 2.1, 2.3_
  
  - [x] 10.2 Optimize event rendering for tablet/desktop
    - Use React.memo for event components if not already (all sizes)
    - Implement virtualization for calendars with 100+ events on >= 640px
    - Profile and optimize re-renders on tablet/desktop
    - Keep mobile rendering optimizations separate
    - _Requirements: 2.1, 2.2_
