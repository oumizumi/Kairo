import { processCourseSequenceQueryAsync, formatCourseSequence, getAvailableProgramsAsync } from '@/services/courseSequenceService';

/**
 * Process a user query about course sequences and return a formatted response
 * This utility is designed to be used by Kairo AI to handle course sequence queries
 * 
 * @param query The user's query string
 * @returns A formatted response string
 */
export async function processSequenceQuery(query: string): Promise<string> {
  const result = await processCourseSequenceQueryAsync(query);
  if (!result.success) return result.message;

  let response = `${result.message}\n\n`;
  if (result.courses) {
    if (result.courses.required && result.courses.required.length > 0) {
      response += "**Required Courses:**\n";
      result.courses.required.forEach(course => {
        response += `- ${course.code}${course.name ? `: ${course.name}` : ''}${course.credits ? ` (${course.credits} credits)` : ''}\n`;
        if (course.description) response += `  ${course.description}\n`;
        if (course.prerequisites && course.prerequisites.length > 0) {
          response += `  Prerequisites: ${course.prerequisites.join(', ')}\n`;
        }
      });
      response += "\n";
    }
    if (result.courses.electives && result.courses.electives.length > 0) {
      response += "**Elective Courses:**\n";
      result.courses.electives.forEach(course => {
        response += `- ${course.code}${course.name ? `: ${course.name}` : ''}${course.credits ? ` (${course.credits} credits)` : ''}\n`;
        if (course.description) response += `  ${course.description}\n`;
        if (course.prerequisites && course.prerequisites.length > 0) {
          response += `  Prerequisites: ${course.prerequisites.join(', ')}\n`;
        }
      });
    }
  }
  return response;
}

/**
 * Get a list of available programs for course sequences
 * @returns A formatted string listing available programs
 */
export async function getAvailableProgramsText(): Promise<string> {
  const programs = await getAvailableProgramsAsync();
  if (programs.length === 0) return "There are currently no program sequences available. More will be added soon!";
  return `Available programs for course sequences:\n${programs.map(p => `- ${p}`).join('\n')}`;
}

/**
 * Check if a query is related to course sequences
 * @param query The user's query string
 * @returns True if the query is likely about course sequences
 */
export function isCourseSequenceQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  
  // Keywords that suggest a course sequence query
  const sequenceKeywords = [
    'course sequence', 'program sequence', 'curriculum', 'course list',
    'show me year', 'what courses', 'courses for', 'classes for',
    'year 1', 'year 2', 'year 3', 'year 4',
    '1st year', '2nd year', '3rd year', '4th year',
    'first year', 'second year', 'third year', 'fourth year'
  ];
  
  // Check if any of the keywords are in the query
  return sequenceKeywords.some(keyword => lowerQuery.includes(keyword));
}