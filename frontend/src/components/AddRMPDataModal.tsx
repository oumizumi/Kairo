import React, { useState } from 'react';
import { X, Star, User, BookOpen, TrendingUp } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface AddRMPDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    professorName: string;
    onSave: (data: RMPFormData) => void;
}

export interface RMPFormData {
    professorName: string;
    rmp_id: string;
    rmp_rating: string;
    rmp_difficulty: string;
    rmp_would_take_again: string;
    rmp_department: string;
    notes?: string;
}

const AddRMPDataModal: React.FC<AddRMPDataModalProps> = ({
    isOpen,
    onClose,
    professorName,
    onSave
}) => {
    const { actualTheme } = useTheme();
    const [formData, setFormData] = useState<RMPFormData>({
        professorName,
        rmp_id: '',
        rmp_rating: '',
        rmp_difficulty: '',
        rmp_would_take_again: '',
        rmp_department: '',
        notes: ''
    });

    const handleSave = () => {
        // Basic validation
        if (!formData.rmp_rating || !formData.rmp_difficulty) {
            alert('Please fill in at least the rating and difficulty fields.');
            return;
        }

        onSave(formData);
        onClose();
        
        // Reset form
        setFormData({
            professorName,
            rmp_id: '',
            rmp_rating: '',
            rmp_difficulty: '',
            rmp_would_take_again: '',
            rmp_department: '',
            notes: ''
        });
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`
                w-full max-w-lg rounded-2xl shadow-2xl border-2 overflow-hidden
                ${actualTheme === 'dark' 
                    ? 'bg-gradient-to-b from-[#111111]/95 to-[#0f0f0f]/95 border-white/5' 
                    : 'bg-white/95 border-gray-200'
                }
                backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-200
            `}>
                {/* Header */}
                <div className={`
                    flex items-center justify-between p-6 pb-4
                    ${actualTheme === 'dark' 
                        ? 'border-b border-white/10' 
                        : 'border-b border-gray-200'
                    }
                `}>
                    <div className="flex items-center gap-3">
                        <div className={`
                            p-2 rounded-xl
                            ${actualTheme === 'dark'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-blue-50 text-blue-600'
                            }
                        `}>
                            <User className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className={`text-xl font-bold ${actualTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                Add RMP Data
                            </h2>
                            <p className={`text-sm ${actualTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                {professorName}
                            </p>
                        </div>
                    </div>
                    
                    <button
                        onClick={onClose}
                        className={`
                            p-2 rounded-xl transition-colors
                            ${actualTheme === 'dark'
                                ? 'hover:bg-white/10 text-gray-400 hover:text-white'
                                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                            }
                        `}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-4">
                    {/* Instructions */}
                    <div className={`
                        p-4 rounded-xl border
                        ${actualTheme === 'dark'
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                            : 'bg-blue-50 border-blue-200 text-blue-700'
                        }
                    `}>
                        <p className="text-sm">
                            Visit <a href="https://www.ratemyprofessors.com" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">RateMyProfessors.com</a> to find this professor's data and fill in the fields below.
                        </p>
                    </div>

                    {/* RMP ID */}
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${actualTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                            RMP Professor ID (optional)
                        </label>
                        <input
                            type="text"
                            value={formData.rmp_id}
                            onChange={(e) => setFormData({ ...formData, rmp_id: e.target.value })}
                            placeholder="e.g., 1234567"
                            className={`
                                w-full px-4 py-3 rounded-xl border transition-colors
                                ${actualTheme === 'dark'
                                    ? 'bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-blue-500'
                                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                                }
                                focus:outline-none focus:ring-2 focus:ring-blue-500/20
                            `}
                            onKeyPress={handleKeyPress}
                        />
                    </div>

                    {/* Rating */}
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${actualTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                            <Star className="w-4 h-4 inline mr-1" />
                            Rating (1.0 - 5.0) *
                        </label>
                        <input
                            type="number"
                            min="1.0"
                            max="5.0"
                            step="0.1"
                            value={formData.rmp_rating}
                            onChange={(e) => setFormData({ ...formData, rmp_rating: e.target.value })}
                            placeholder="e.g., 4.2"
                            className={`
                                w-full px-4 py-3 rounded-xl border transition-colors
                                ${actualTheme === 'dark'
                                    ? 'bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-blue-500'
                                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                                }
                                focus:outline-none focus:ring-2 focus:ring-blue-500/20
                            `}
                            onKeyPress={handleKeyPress}
                        />
                    </div>

                    {/* Difficulty */}
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${actualTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                            <TrendingUp className="w-4 h-4 inline mr-1" />
                            Difficulty (1.0 - 5.0) *
                        </label>
                        <input
                            type="number"
                            min="1.0"
                            max="5.0"
                            step="0.1"
                            value={formData.rmp_difficulty}
                            onChange={(e) => setFormData({ ...formData, rmp_difficulty: e.target.value })}
                            placeholder="e.g., 3.1"
                            className={`
                                w-full px-4 py-3 rounded-xl border transition-colors
                                ${actualTheme === 'dark'
                                    ? 'bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-blue-500'
                                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                                }
                                focus:outline-none focus:ring-2 focus:ring-blue-500/20
                            `}
                            onKeyPress={handleKeyPress}
                        />
                    </div>

                    {/* Would Take Again */}
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${actualTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                            Would Take Again (0-100%)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.rmp_would_take_again}
                            onChange={(e) => setFormData({ ...formData, rmp_would_take_again: e.target.value })}
                            placeholder="e.g., 75"
                            className={`
                                w-full px-4 py-3 rounded-xl border transition-colors
                                ${actualTheme === 'dark'
                                    ? 'bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-blue-500'
                                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                                }
                                focus:outline-none focus:ring-2 focus:ring-blue-500/20
                            `}
                            onKeyPress={handleKeyPress}
                        />
                    </div>

                    {/* Department */}
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${actualTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                            <BookOpen className="w-4 h-4 inline mr-1" />
                            Department
                        </label>
                        <input
                            type="text"
                            value={formData.rmp_department}
                            onChange={(e) => setFormData({ ...formData, rmp_department: e.target.value })}
                            placeholder="e.g., Computer Science"
                            className={`
                                w-full px-4 py-3 rounded-xl border transition-colors
                                ${actualTheme === 'dark'
                                    ? 'bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-blue-500'
                                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                                }
                                focus:outline-none focus:ring-2 focus:ring-blue-500/20
                            `}
                            onKeyPress={handleKeyPress}
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${actualTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                            Notes (optional)
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Any additional notes..."
                            rows={3}
                            className={`
                                w-full px-4 py-3 rounded-xl border transition-colors resize-none
                                ${actualTheme === 'dark'
                                    ? 'bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-blue-500'
                                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                                }
                                focus:outline-none focus:ring-2 focus:ring-blue-500/20
                            `}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className={`
                    flex justify-end gap-3 p-6 pt-4
                    ${actualTheme === 'dark' 
                        ? 'border-t border-white/10' 
                        : 'border-t border-gray-200'
                    }
                `}>
                    <button
                        onClick={onClose}
                        className={`
                            px-6 py-2.5 rounded-xl font-medium transition-colors
                            ${actualTheme === 'dark'
                                ? 'text-gray-400 hover:text-white hover:bg-white/5'
                                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                            }
                        `}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className={`
                            px-6 py-2.5 rounded-xl font-medium transition-colors
                            ${actualTheme === 'dark'
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }
                        `}
                    >
                        Save RMP Data
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddRMPDataModal;
