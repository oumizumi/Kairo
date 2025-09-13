import React from 'react';

interface UserAvatarProps {
  user?: {
    username?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    profile_pic?: string;
  } | null;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  showEmail?: boolean;
  className?: string;
  showKawaiiBadge?: boolean;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ 
  user, 
  size = 'md', 
  showName = false, 
  showEmail = false,
  className = '',
  showKawaiiBadge = false
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-14 h-14 text-lg'
  };

  const getInitials = () => {
    if (!user) return 'G';
    // Prefer username-based initials when available
    if (user.username && user.username.trim().length > 0) {
      const parts = user.username
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      const letters = (parts[0] || user.username)
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 2)
        .toUpperCase();
      return letters || user.username[0].toUpperCase();
    }
    if (user.first_name || user.last_name) {
      return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || 'U';
  };

  const getDisplayName = () => {
    if (!user) return 'Login to save schedules!';
    if (user.username) return user.username;
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.email?.split('@')[0] || 'User';
  };

  const getGradient = () => {
    if (!user || (!user.username && !user.first_name && !user.last_name && !user.email)) {
      return 'from-gray-400 to-gray-600'; // Guest
    }
    
    // Generate consistent gradient based on user initials
    const initials = getInitials();
    const charCode = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
    const gradients = [
      'from-blue-500 to-indigo-600',
      'from-purple-500 to-pink-600', 
      'from-green-500 to-emerald-600',
      'from-orange-500 to-red-600',
      'from-teal-500 to-cyan-600',
      'from-indigo-500 to-purple-600',
      'from-rose-500 to-pink-600',
      'from-amber-500 to-orange-600'
    ];
    return gradients[charCode % gradients.length];
  };

  const getKawaiiEmoji = () => {
    if (!user) return '✨';
    // Stable cute emoji by seed
    const seed = (user.username || user.first_name || user.email || 'user')
      .split('')
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const emojis = ['🌸', '🍓', '🐰', '☁️', '🍑', '⭐️', '🎀', '🦄', '🍰'];
    return emojis[seed % emojis.length];
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${getGradient()} flex items-center justify-center text-white font-semibold shadow-lg ring-2 ring-white dark:ring-gray-800 transition-all duration-200 hover:shadow-xl hover:scale-105 relative`}>
        {user?.profile_pic ? (
          <img 
            src={user.profile_pic} 
            alt="Profile" 
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span className="select-none">{getInitials()}</span>
        )}
        {showKawaiiBadge && (
          <span className="absolute -bottom-1 -right-1 rounded-full bg-white dark:bg-gray-900 text-base leading-none p-0.5 shadow ring-1 ring-black/5 dark:ring-white/10">
            {getKawaiiEmoji()}
          </span>
        )}
      </div>
      
      {(showName || showEmail) && (
        <div className="flex flex-col min-w-0 flex-1">
          {showName && (
            <div className="font-semibold text-gray-900 dark:text-white text-sm truncate leading-tight">
              {getDisplayName()}
            </div>
          )}
          {showEmail && user?.email && (
            <div className="text-gray-500 dark:text-gray-400 text-xs truncate mt-0.5">
              {user.email}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserAvatar;
