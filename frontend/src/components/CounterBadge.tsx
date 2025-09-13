import React from 'react';

interface CounterBadgeProps {
    count: number;
    label: string;
    variant?: 'default' | 'warning' | 'error';
    className?: string;
    onClick?: () => void;
    clickable?: boolean;
}

const CounterBadge: React.FC<CounterBadgeProps> = ({ count, label, variant = 'default', className = '', onClick, clickable = false }) => {
    const getVariantStyles = () => {
        switch (variant) {
            case 'warning':
                return 'bg-orange-600 dark:bg-orange-700 text-white';
            case 'error':
                return 'bg-red-600 dark:bg-red-700 text-white';
            default:
                return 'bg-gray-800 dark:bg-gray-700 text-white';
        }
    };

    const isClickable = clickable && count > 0 && onClick;

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔥 CounterBadge clicked!', { count, label, clickable, isClickable });
        if (isClickable && onClick) {
            onClick();
        }
    };

    return (
        <div
            className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${getVariantStyles()} ${className} ${isClickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={handleClick}
            style={{ pointerEvents: isClickable ? 'auto' : 'none' }}
        >
            <span className="tabular-nums">{count}</span>
            <span className="ml-1">{label}</span>
        </div>
    );
};

export default CounterBadge; 