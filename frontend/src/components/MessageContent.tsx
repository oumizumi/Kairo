import React from 'react';
import ProgramSequenceDisplay from './ProgramSequenceDisplay';
import { ProgramSequence } from '@/services/programSequenceService';

interface MessageContentProps {
    content: string;
    className?: string;
    curriculumData?: ProgramSequence;
    yearRequested?: number;
    termRequested?: string;
    isFullSequence?: boolean;
}

const MessageContent: React.FC<MessageContentProps> = ({ 
    content, 
    className = "", 
    curriculumData, 
    yearRequested, 
    termRequested, 
    isFullSequence = true 
}) => {
    // Regular expression to match URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    // Function to detect and format direct answers
    const formatAnswers = (text: string) => {
        // Patterns for common answer formats
        const answerPatterns = [
            // Prerequisites: "is/are [ANSWER]"
            /(\b(?:prerequisite|prerequisites?|requirement|requirements?)\s+(?:for\s+\w+\s+)?(?:is|are)\s+)([^.!?]+)/gi,
            // Direct answers: "The answer is [ANSWER]"
            /(\b(?:the\s+)?(?:answer|prerequisite|requirement)\s+(?:is|are)\s+)([^.!?]+)/gi,
            // Course codes in answers
            /(\b)([A-Z]{3}\s*\d{4}(?:\s+and\s+[A-Z]{3}\s*\d{4})*)/g,
            // Simple "is/are [ANSWER]" patterns
            /(\s+(?:is|are)\s+)([A-Z][^.!?]*(?:[A-Z]{3}\s*\d{4})[^.!?]*)/g,
        ];

        let formattedText = text;
        
        answerPatterns.forEach(pattern => {
            formattedText = formattedText.replace(pattern, (match, prefix, answer) => {
                // Clean up the answer part
                const cleanAnswer = answer.trim();
                return `${prefix}**${cleanAnswer}**`;
            });
        });

        return formattedText;
    };

    // Process content to add bold formatting for answers
    const processedContent = formatAnswers(content);

    // Split by URLs first, then process markdown-style bold
    const urlParts = processedContent.split(urlRegex);
    
    // Process each part for bold formatting
    const processTextPart = (text: string) => {
        // Split by **bold** markers while capturing them
        const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
        
        return boldParts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                // Bold text - remove the ** markers
                const boldText = part.slice(2, -2);
                return (
                    <strong key={index} className="font-bold">
                        {boldText}
                    </strong>
                );
            }
            // Regular text - filter out empty strings
            if (part === '') return null;
            return (
                <span key={index} className="whitespace-pre-wrap">
                    {part}
                </span>
            );
        });
    };

    return (
        <div>
            {/* Only render text content if it exists */}
            {content && content.trim() && (
                <p className={className}>
                    {urlParts.map((part, index) => {
                        // Check if this part is a URL
                        if (urlRegex.test(part)) {
                            return (
                                <a
                                    key={index}
                                    href={part}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 underline transition-colors"
                                >
                                    {part}
                                </a>
                            );
                        }
                        // Regular text part - process for bold formatting
                        return processTextPart(part);
                    })}
                </p>
            )}
            
            {/* Display program sequence if provided */}
            {curriculumData && (
                <div className={content && content.trim() ? "mt-4" : ""}>
                    <ProgramSequenceDisplay 
                        programSequence={curriculumData}
                        isFullSequence={isFullSequence}
                        yearRequested={yearRequested}
                        termRequested={termRequested}
                    />
                </div>
            )}
        </div>
    );
};

export default MessageContent; 