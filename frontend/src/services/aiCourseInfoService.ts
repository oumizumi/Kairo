import { getCourseDetails } from './courseDataService';
import api from '@/lib/api';

interface CourseInfoResult {
    success: boolean;
    message: string;
    courseData?: {
        courseCode: string;
        courseTitle: string;
        description: string;
        prerequisites: string;
        units: string;
    };
}

class AICourseInfoService {

    /**
     * Get AI-elaborated course information
     */
    async getCourseInfo(courseCode: string, userMessage: string): Promise<CourseInfoResult> {
        try {
            // First, get the raw course data
            const courseData = await getCourseDetails(courseCode);

            if (!courseData) {
                return {
                    success: false,
                    message: `I couldn't find information for ${courseCode.toUpperCase()}. Could you double-check the course code? Make sure it's in the format like CSI 2110 or MAT 1341.`
                };
            }

            // IMPORTANT: Only proceed with AI elaboration if we have valid course data
            if (!courseData.courseTitle || courseData.courseTitle.trim() === '') {
                return {
                    success: false,
                    message: `I found a reference to ${courseCode.toUpperCase()} but don't have complete information about it. Please check the official uOttawa course catalog.`
                };
            }

            // Generate AI elaboration with the real course data
            const aiElaboration = await this.generateAIElaboration(courseData, userMessage);

            return {
                success: true,
                message: aiElaboration,
                courseData: courseData
            };

        } catch (error) {
            return {
                success: false,
                message: `Sorry, I encountered an error while looking up ${courseCode}. Please try again.`
            };
        }
    }

    /**
     * Use AI to elaborate on course information based on user's specific question
     */
    private async generateAIElaboration(courseData: any, userMessage: string): Promise<string> {
        try {
            // CRITICAL: Validate that we have actual course data before AI elaboration
            if (!courseData || !courseData.courseCode || !courseData.courseTitle) {
                return this.generateBasicResponse(courseData);
            }

            const prompt = this.buildElaborationPrompt(courseData, userMessage);

            const response = await api.post('/api/ai/classify/', {
                message: userMessage,
                prompt: prompt,
                model: 'gpt-4o-mini',
                temperature: 0.3,
                max_tokens: 500
            });

            const elaboration = response.data.classification || response.data.raw_content;

            // Verify the AI didn't hallucinate - check if it mentions the correct course
            if (elaboration && elaboration.includes(courseData.courseCode)) {
                return elaboration;
            } else {
                return this.generateBasicResponse(courseData, userMessage);
            }

        } catch (error) {
            // Fallback to basic formatted information
            return this.generateBasicResponse(courseData, userMessage);
        }
    }

    /**
     * Build dynamic, context-aware prompt for AI elaboration with strict instructions
     */
    private buildElaborationPrompt(courseData: any, userMessage: string): string {
        // Analyze what the user is asking for dynamically
        const isAboutQuestion = /what.*about|tell.*about|describe|explain|what.*is|what.*does|covers?|content|topics/i.test(userMessage);
        const isPrereqQuestion = /prereq|prerequisite|requirement|need.*before|take.*before|requirement|required/i.test(userMessage) && !/prep|prepare|study/i.test(userMessage);
        const isCreditQuestion = /credit|unit|how many|worth/i.test(userMessage);
        const isStudyQuestion = /prep|prepare|study|tips|advice|difficult|hard|easy|ready|succeed|review/i.test(userMessage);
        const isCombinedQuestion = (isAboutQuestion && isStudyQuestion) || /about.*prep|prep.*for|how.*prep|prepare.*for/i.test(userMessage);
        const isGeneralQuestion = !isAboutQuestion && !isPrereqQuestion && !isCreditQuestion && !isStudyQuestion && !isCombinedQuestion;

        // Build context-aware prompt based on question type
        let responseStyle = '';
        if (isCombinedQuestion) {
            responseStyle = 'Provide a comprehensive explanation of what this course covers AND include specific study tips and preparation advice. Explain the key topics students will learn, then give practical advice on how to prepare for success in this course based on the prerequisites and content.';
        } else if (isAboutQuestion) {
            responseStyle = 'Provide a comprehensive explanation of what this course covers, what students will learn, and key topics. Make it engaging and informative.';
        } else if (isPrereqQuestion) {
            responseStyle = 'FOCUS ONLY on prerequisites. Give a short, direct answer about what courses are required before taking this course. Do NOT include course description, credits, or other details. Keep it concise and to the point.';
        } else if (isCreditQuestion) {
            responseStyle = 'Focus on the credit value and what this means for the student\'s degree progression.';
        } else if (isStudyQuestion) {
            responseStyle = 'Provide study tips and academic advice based on the course content and requirements. Focus on how to prepare for success in this course.';
        } else if (isGeneralQuestion) {
            responseStyle = 'Provide a complete overview including description, prerequisites, credits, and key highlights.';
        }

        return `You are Kairo, a helpful academic AI assistant for University of Ottawa students. 

COURSE INFORMATION:
Course Code: ${courseData.courseCode}
Title: ${courseData.courseTitle}
Description: ${courseData.description || 'Description not available in database'}
Prerequisites: ${courseData.prerequisites || 'None listed'}
Credits: ${courseData.units || '3'} units

STUDENT QUESTION: "${userMessage}"

INSTRUCTIONS:
- ${responseStyle}
- Use ONLY the provided course information - never invent or hallucinate details
- Be conversational and friendly, like talking to a fellow student
- NO emojis, NO markdown headers (##), NO bullet points
- Write in flowing, paragraph style that feels natural
- CRITICAL: Fix ALL grammar and punctuation issues in the source material:
  * Capitalize the first letter of every sentence
  * Add proper periods and commas where needed
  * Fix run-on sentences by adding proper punctuation
  * Remove double periods (..) and replace with single periods (.)
  * Ensure proper sentence structure and flow
- If information is missing from the course data, acknowledge it honestly
- Always include the course code and title in your response (unless it's a prerequisite-only question)
- If the student asks about prerequisites, explain what each prerequisite course covers if you know it
- Break down technical descriptions into simpler, more understandable terms
- For preparation questions, provide specific, actionable study advice based on the course content

Remember: You're helping a University of Ottawa student understand their courses better. Be encouraging and informative while keeping the tone conversational and natural!`;
    }

    /**
     * Generate a basic formatted response when AI elaboration fails
     */
    private generateBasicResponse(courseData: any, userMessage: string = ''): string {
        if (!courseData || !courseData.courseCode) {
            return "I don't have information about this course. Please check the course code and try again.";
        }

        // Always use AI to elaborate, even for "basic" responses
        return this.generateAIElaborationSync(courseData, userMessage || `Tell me about ${courseData.courseCode}`);
    }

    /**
     * Synchronous AI elaboration for basic responses
     */
    private generateAIElaborationSync(courseData: any, userMessage: string): string {
        // Check if this is a prerequisite-only question
        const isPrereqOnly = /prereq|prerequisite|requirement|need.*before|take.*before|required/i.test(userMessage) && !/prep|prepare|study/i.test(userMessage);
        const isStudyQuestion = /prep|prepare|study|tips|advice|difficult|hard|easy|ready|succeed|review/i.test(userMessage);
        const isCombinedQuestion = /about.*prep|prep.*for|how.*prep|prepare.*for/i.test(userMessage);
        
        if (isPrereqOnly) {
            // For prerequisite questions, give a direct, focused answer
            if (courseData.prerequisites && courseData.prerequisites.trim() && courseData.prerequisites !== 'None') {
                return `The prerequisites for ${courseData.courseCode} are: ${courseData.prerequisites}.`;
            } else {
                return `${courseData.courseCode} has no prerequisites.`;
            }
        }

        // For other questions, provide a full response with proper grammar
        let response = `${courseData.courseCode} - ${courseData.courseTitle}\n\n`;
        
        if (courseData.description && courseData.description.trim()) {
            // Aggressively fix grammar and punctuation in description
            let description = courseData.description;
            
            // Capitalize first letter
            description = description.charAt(0).toUpperCase() + description.slice(1);
            
            // Fix common punctuation issues
            description = description.replace(/\.\s*([a-z])/g, (match: string, letter: string) => '. ' + letter.toUpperCase());
            description = description.replace(/\.\./g, '.'); // Fix double periods
            description = description.replace(/\s+/g, ' ').trim(); // Fix multiple spaces
            
            // Add periods to sentence fragments
            if (!description.endsWith('.') && !description.endsWith('!') && !description.endsWith('?')) {
                description += '.';
            }
            
            response += `This course covers ${description}`;
            
            // Add context about prerequisites
            if (courseData.prerequisites && courseData.prerequisites.trim() && courseData.prerequisites !== 'None') {
                response += ` Before taking this course, you'll need to complete ${courseData.prerequisites}.`;
            } else {
                response += ` This is an introductory course with no prerequisites, making it accessible to all students.`;
            }
            
            // Add credit information
            response += ` The course is worth ${courseData.units || '3'} credits toward your degree.`;
            
            // Add study advice for preparation questions
            if (isStudyQuestion || isCombinedQuestion) {
                response += '\n\nTo prepare for this course, ';
                if (courseData.prerequisites && courseData.prerequisites.trim() && courseData.prerequisites !== 'None') {
                    response += `make sure you have a strong foundation in the prerequisite courses (${courseData.prerequisites}). `;
                }
                response += 'Review fundamental programming concepts, practice problem-solving skills, and familiarize yourself with basic mathematical concepts that will be used throughout the course.';
            }
            
        } else {
            response += `This is a ${courseData.units || '3'}-credit course. Unfortunately, I don't have a detailed description available in my database, but I'd recommend checking the official course catalog for more information.`;
        }

        return response;
    }
}

export const aiCourseInfoService = new AICourseInfoService(); 