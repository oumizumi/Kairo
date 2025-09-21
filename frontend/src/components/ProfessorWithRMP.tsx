import React, { useState } from 'react';
import RMPRating from './RMPRating';
import AddRMPDataModal, { RMPFormData } from './AddRMPDataModal';
import { useRMPData } from '@/hooks/useRMPData';

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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { saveRMPData, isLoading } = useRMPData();

    const handleAddRMPData = (name: string) => {
        setIsModalOpen(true);
    };

    const handleSaveRMPData = async (data: RMPFormData) => {
        const success = await saveRMPData(data);
        if (success) {
            // Show success message
            console.log(`RMP data saved for ${data.professorName}`);
            // You could add a toast notification here
            
            // Force refresh of RMP data by clearing cache
            // This will make the RMPRating component re-fetch the data
            if (typeof window !== 'undefined') {
                window.location.reload(); // Simple refresh - you could implement a more elegant solution
            }
        }
    };

    return (
        <div className={className}>
            <RMPRating
                professorName={professorName}
                compact={compact}
                showDifficulty={showDifficulty}
                showWouldTakeAgain={showWouldTakeAgain}
                showAddButton={true}
                onAddRMPData={handleAddRMPData}
            />
            
            <AddRMPDataModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                professorName={professorName}
                onSave={handleSaveRMPData}
            />
        </div>
    );
};

export default ProfessorWithRMP;
