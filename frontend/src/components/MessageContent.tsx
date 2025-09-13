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

    // Split the content by URLs and create an array of text and URL parts
    const parts = content.split(urlRegex);

    return (
        <div>
            {/* Only render text content if it exists */}
            {content && content.trim() && (
                <p className={className}>
                    {parts.map((part, index) => {
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
                        // Regular text part - preserve whitespace and line breaks
                        return (
                            <span key={index} className="whitespace-pre-wrap">
                                {part}
                            </span>
                        );
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