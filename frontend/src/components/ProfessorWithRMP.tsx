import React from 'react';
import RMPRating from './RMPRating';

interface ProfessorWithRMPProps {
    professorName: string;
    compact?: boolean;
    showDifficulty?: boolean;
    showWouldTakeAgain?: boolean;
    className?: string;
}

const ProfessorWithRMP: React.FC<ProfessorWithRMPProps> = ({
    professorName,
    compact = false,
    showDifficulty = false,
    showWouldTakeAgain = true,
    className = ''
}) => {
    return (
        <div className={className}>
            <RMPRating
                professorName={professorName}
                compact={compact}
                showDifficulty={showDifficulty}
                showWouldTakeAgain={showWouldTakeAgain}
            />
        </div>
    );
};

export default ProfessorWithRMP;
