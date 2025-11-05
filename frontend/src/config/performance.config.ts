/**
 * Performance configuration for the application
 * Adjust these settings based on device capabilities
 */

export const PERFORMANCE_CONFIG = {
  // Debounce/throttle timings
  RESIZE_DEBOUNCE: 300,
  SCROLL_THROTTLE: 100,
  SEARCH_DEBOUNCE: 300,
  INPUT_DEBOUNCE: 150,
  
  // Animation settings
  ANIMATION_DURATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
  },
  
  // Rendering optimizations
  VIRTUAL_SCROLL_THRESHOLD: 50, // Number of items before enabling virtual scrolling
  LAZY_LOAD_THRESHOLD: 10, // Number of items to load at once
  
  // Calendar specific
  CALENDAR: {
    MAX_EVENTS_PER_DAY: 20, // Warn if more events
    RENDER_BUFFER: 2, // Days to render outside viewport
    UPDATE_THROTTLE: 100, // Throttle calendar updates
  },
  
  // Image optimization
  IMAGE: {
    LAZY_LOAD: true,
    PLACEHOLDER: true,
    QUALITY: 75,
  },
  
  // Network
  NETWORK: {
    TIMEOUT: 10000, // 10 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
  },
  
  // Cache
  CACHE: {
    ENABLED: true,
    TTL: 5 * 60 * 1000, // 5 minutes
    MAX_SIZE: 50, // Max cached items
  },
};

/**
 * Get performance config adjusted for device capabilities
 */
export function getOptimizedConfig() {
  if (typeof window === 'undefined') return PERFORMANCE_CONFIG;
  
  const isLowEnd = 
    (navigator.hardwareConcurrency || 4) <= 2 ||
    ((navigator as any).deviceMemory || 4) <= 2;
  
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  if (isLowEnd || prefersReducedMotion) {
    return {
      ...PERFORMANCE_CONFIG,
      ANIMATION_DURATION: {
        FAST: 0,
        NORMAL: 0,
        SLOW: 0,
      },
      CALENDAR: {
        ...PERFORMANCE_CONFIG.CALENDAR,
        MAX_EVENTS_PER_DAY: 15,
        UPDATE_THROTTLE: 200,
      },
      IMAGE: {
        ...PERFORMANCE_CONFIG.IMAGE,
        QUALITY: 60,
      },
    };
  }
  
  return PERFORMANCE_CONFIG;
}
