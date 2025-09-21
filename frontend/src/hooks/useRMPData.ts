import { useState, useCallback } from 'react';
import { RMPFormData } from '@/components/AddRMPDataModal';

interface UseRMPDataReturn {
    saveRMPData: (data: RMPFormData) => Promise<boolean>;
    isLoading: boolean;
    error: string | null;
}

export const useRMPData = (): UseRMPDataReturn => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const saveRMPData = useCallback(async (data: RMPFormData): Promise<boolean> => {
        setIsLoading(true);
        setError(null);

        try {
            // First, try to save to your backend API if available
            try {
                const API_BASE = (() => {
                    const base = (process.env.NEXT_PUBLIC_API_URL || '').trim();
                    if (base) {
                        return `${base.replace(/\/+$/, '')}/api`;
                    }
                    return process.env.NODE_ENV === 'development' ? 'http://localhost:8000/api' : '/api';
                })();

                const response = await fetch(`${API_BASE}/professors/rmp/add/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: data.professorName,
                        rmp_id: data.rmp_id || null,
                        rmp_rating: data.rmp_rating ? parseFloat(data.rmp_rating) : null,
                        rmp_difficulty: data.rmp_difficulty ? parseFloat(data.rmp_difficulty) : null,
                        rmp_would_take_again: data.rmp_would_take_again ? parseFloat(data.rmp_would_take_again) : null,
                        rmp_department: data.rmp_department || null,
                        notes: data.notes || null
                    })
                });

                if (response.ok) {
                    console.log('RMP data saved to backend successfully');
                    setIsLoading(false);
                    return true;
                }
            } catch (apiError) {
                console.log('Backend API not available, saving to local storage');
            }

            // Fallback: Save to local storage for manual processing
            const existingData = localStorage.getItem('manual_rmp_data');
            const manualRMPData = existingData ? JSON.parse(existingData) : [];

            // Check if professor already exists in manual data
            const existingIndex = manualRMPData.findIndex((item: RMPFormData) => 
                item.professorName.toLowerCase() === data.professorName.toLowerCase()
            );

            const rmpEntry = {
                ...data,
                timestamp: new Date().toISOString(),
                id: Date.now().toString() // Simple ID for tracking
            };

            if (existingIndex >= 0) {
                // Update existing entry
                manualRMPData[existingIndex] = rmpEntry;
            } else {
                // Add new entry
                manualRMPData.push(rmpEntry);
            }

            localStorage.setItem('manual_rmp_data', JSON.stringify(manualRMPData));

            // Also save to a CSV-like format for easy export
            const csvData = manualRMPData.map((item: any) => ({
                name: item.professorName,
                rmp_id: item.rmp_id || '',
                rmp_rating: item.rmp_rating || '',
                rmp_difficulty: item.rmp_difficulty || '',
                rmp_would_take_again: item.rmp_would_take_again || '',
                rmp_department: item.rmp_department || '',
                notes: item.notes || '',
                timestamp: item.timestamp
            }));

            localStorage.setItem('manual_rmp_csv_data', JSON.stringify(csvData));

            console.log(`RMP data for ${data.professorName} saved to local storage`);
            setIsLoading(false);
            return true;

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save RMP data');
            setIsLoading(false);
            return false;
        }
    }, []);

    return {
        saveRMPData,
        isLoading,
        error
    };
};

// Helper function to export manual RMP data as CSV
export const exportManualRMPData = (): void => {
    const data = localStorage.getItem('manual_rmp_csv_data');
    if (!data) {
        alert('No manual RMP data found to export');
        return;
    }

    const csvData = JSON.parse(data);
    const headers = ['name', 'rmp_id', 'rmp_rating', 'rmp_difficulty', 'rmp_would_take_again', 'rmp_department', 'notes', 'timestamp'];
    
    const csvContent = [
        headers.join(','),
        ...csvData.map((row: any) => 
            headers.map(header => {
                const value = row[header] || '';
                // Escape commas and quotes in CSV
                return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
                    ? `"${value.replace(/"/g, '""')}"` 
                    : value;
            }).join(',')
        )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `manual_rmp_data_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// Helper function to get count of manual entries
export const getManualRMPDataCount = (): number => {
    const data = localStorage.getItem('manual_rmp_data');
    return data ? JSON.parse(data).length : 0;
};
