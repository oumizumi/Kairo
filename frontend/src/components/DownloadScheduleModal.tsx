import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface DownloadScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDownload: (filename: string) => void;
    defaultFilename?: string;
}

const DownloadScheduleModal: React.FC<DownloadScheduleModalProps> = ({
    isOpen,
    onClose,
    onDownload,
    defaultFilename = 'kairo_schedule'
}) => {
    const [filename, setFilename] = useState(defaultFilename);
    const { actualTheme } = useTheme();

    const handleDownload = () => {
        // Ensure filename doesn't have .ics extension (it will be added automatically)
        const cleanFilename = filename.replace(/\.ics$/, '');
        onDownload(cleanFilename);
        onClose();
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleDownload();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`
                w-full max-w-md rounded-2xl shadow-2xl border-2 overflow-hidden
                ${actualTheme === 'dark' 
                    ? 'bg-gradient-to-b from-[#111111]/95 to-[#0f0f0f]/95 border-white/5' 
                    : 'bg-white/95 border-gray-200'
                }
                backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-200
            `}>
                {/* Header */}
                <div className={`
                    flex items-center justify-between p-6 pb-4
                    ${actualTheme === 'dark' ? 'text-white' : 'text-gray-900'}
                `}>
                    <h2 className="text-xl font-semibold">Download Schedule</h2>
                    <button
                        onClick={onClose}
                        className={`
                            p-2 rounded-lg transition-colors duration-200
                            ${actualTheme === 'dark' 
                                ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' 
                                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                            }
                        `}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 pb-6">
                    <div className="space-y-4">
                        {/* File Name Input */}
                        <div>
                            <label className={`
                                block text-sm font-medium mb-2
                                ${actualTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}
                            `}>
                                File Name
                            </label>
                            <input
                                type="text"
                                value={filename}
                                onChange={(e) => setFilename(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className={`
                                    w-full px-4 py-3 rounded-xl border-2 transition-all duration-200
                                    focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                                    ${actualTheme === 'dark'
                                        ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:bg-gray-750'
                                        : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:bg-white'
                                    }
                                `}
                                placeholder="Enter filename"
                                autoFocus
                            />
                        </div>

                        {/* Info Text */}
                        <p className={`
                            text-sm
                            ${actualTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}
                        `}>
                            The .ics extension will be added automatically
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 mt-8">
                        <button
                            onClick={onClose}
                            className={`
                                flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-200
                                ${actualTheme === 'dark'
                                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border border-gray-300'
                                }
                            `}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={!filename.trim()}
                            className={`
                                flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-200
                                bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700
                                text-white shadow-lg hover:shadow-xl transform hover:scale-105
                                disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                                disabled:hover:from-blue-600 disabled:hover:to-purple-600
                            `}
                        >
                            Download
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DownloadScheduleModal;