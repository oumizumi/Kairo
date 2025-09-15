/**
 * Course Selection Storage Service
 * Handles persisting course selections to localStorage
 */

// Type for course selection data
interface CourseSelectionData {
  [courseCode: string]: {
    sections: string[];
    timestamp: number;
  };
}

import { getUserStorageItem, setUserStorageItem, removeUserStorageItem } from '../lib/userStorage';

// Storage key
const STORAGE_KEY = 'kairo-course-selections';

/**
 * Save selected sections for a course
 */
export function saveSelectedSections(courseCode: string, sections: string[]): void {
  try {
    // Get existing data
    const existingData = loadAllSelections();
    
    // Update with new selection
    existingData[courseCode] = {
      sections,
      timestamp: Date.now()
    };
    
    // Save back to user-specific localStorage
    setUserStorageItem(STORAGE_KEY, JSON.stringify(existingData));
  
    
    // Dispatch event for cross-component sync
    window.dispatchEvent(new CustomEvent('courseSelectionsChanged', {
      detail: { courseCode, sections }
    }));
  } catch (error) {
    console.error('Failed to save course selection:', error);
  }
}

/**
 * Load selected sections for a specific course
 */
export function loadSelectedSections(courseCode: string): string[] {
  try {
    const allSelections = loadAllSelections();
    return allSelections[courseCode]?.sections || [];
  } catch (error) {
    console.error(`Failed to load selections for ${courseCode}:`, error);
    return [];
  }
}

/**
 * Load all course selections
 */
export function loadAllSelections(): CourseSelectionData {
  try {
    const savedData = getUserStorageItem(STORAGE_KEY);
    return savedData ? JSON.parse(savedData) : {};
  } catch (error) {
    console.error('Failed to load course selections:', error);
    return {};
  }
}

/**
 * Clear selection for a specific course
 */
export function clearCourseSelection(courseCode: string): void {
  try {
    const existingData = loadAllSelections();
    
    if (existingData[courseCode]) {
      delete existingData[courseCode];
      setUserStorageItem(STORAGE_KEY, JSON.stringify(existingData));
      
      // Dispatch event for cross-component sync
      window.dispatchEvent(new CustomEvent('courseSelectionsChanged', {
        detail: { courseCode, sections: [] }
      }));
    }
  } catch (error) {
    console.error(`Failed to clear selection for ${courseCode}:`, error);
  }
}

/**
 * Clear all course selections
 */
export function clearAllSelections(): void {
  try {
    removeUserStorageItem(STORAGE_KEY);
    
    // Dispatch event for cross-component sync
    window.dispatchEvent(new CustomEvent('courseSelectionsChanged', {
      detail: { cleared: true }
    }));
  } catch (error) {
    console.error('Failed to clear all selections:', error);
  }
}

/**
 * Check if a section is selected for a course
 */
export function isSectionSelected(courseCode: string, sectionCode: string): boolean {
  const selections = loadSelectedSections(courseCode);
  return selections.includes(sectionCode);
}