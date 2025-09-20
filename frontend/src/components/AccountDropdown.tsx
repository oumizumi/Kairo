import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import UserAvatar from './UserAvatar';
import { APP_CONFIG } from '@/config/app.config';

interface User {
  id?: number | null;
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  profile_pic?: string;
  banner_style?: string;
  profile_mode?: string;
  profile_badge?: string;
  isGuest?: boolean;
}

interface AccountDropdownProps {
  user?: User | null;
  isAuthenticated: boolean;
  onLogout: () => void;
  className?: string;
}

const AccountDropdown: React.FC<AccountDropdownProps> = ({ 
  user, 
  isAuthenticated, 
  onLogout,
  className = '' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavigation = (path: string) => {
    setIsOpen(false);
    router.push(path);
  };

  const handleLogout = () => {
    setIsOpen(false);
    onLogout();
  };

  const isGuest = !isAuthenticated || !user || user.isGuest || !user.id;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Account Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        <UserAvatar user={user} size="sm" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block max-w-32 truncate">
          {isGuest ? 'Guest' : (user?.username || user?.first_name || user?.email?.split('@')[0] || 'Account')}
        </span>
        <svg 
          className={`w-4 h-4 text-gray-400 transition-all duration-200 ${isOpen ? 'rotate-180 text-gray-600 dark:text-gray-300' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-72 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border border-gray-200/60 dark:border-gray-600/60 rounded-2xl shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
          {/* User Info Header */}
          {!isGuest && user && (
            <div className="px-4 py-5 border-b border-gray-100/80 dark:border-gray-700/80 relative overflow-hidden">
              {/* Banner from user preference */}
              <div
                className={`absolute inset-0 bg-gradient-to-r ${
                  (APP_CONFIG.UI.PROFILE_BANNERS.find(b => b.key === (user.banner_style || ''))?.className) || 'from-pink-50 via-rose-50 to-amber-50 dark:from-pink-900/20 dark:via-rose-900/20 dark:to-amber-900/20'
                }`}
              />
              <div className="relative">
                <UserAvatar 
                  user={user}
                  size="md" 
                  showName={true} 
                  showEmail={true}
                  className="w-full"
                  showKawaiiBadge={false}
                />
                {(() => {
                  const modeKey = user.profile_mode || '';
                  const mode = APP_CONFIG.UI.PROFILE_MODES.find(m => m.key === modeKey);
                  if (!modeKey || !mode) return null;
                  return (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/70 dark:bg-gray-900/60 px-2.5 py-1 text-xs font-medium text-pink-600 dark:text-pink-300 ring-1 ring-pink-200/70 dark:ring-pink-800/40">
                      <span>{mode.emoji}</span>
                      <span>{mode.label}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Menu Items */}
          <div className="py-2">
            {isAuthenticated && !isGuest ? (
              <>
                <button
                  onClick={() => handleNavigation('/profile')}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-150 flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">View Profile</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Manage your account</div>
                  </div>
                </button>
                
                <button
                  onClick={() => handleNavigation('/login')}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-150 flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">Switch Account</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Login with different account</div>
                  </div>
                </button>

                <button
                  onClick={() => handleNavigation('/profile')}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-150 flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center group-hover:bg-green-100 dark:group-hover:bg-green-900/30 transition-colors">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">Settings</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Manage your preferences</div>
                  </div>
                </button>

                <div className="border-t border-gray-100/80 dark:border-gray-700/80 my-2"></div>
                
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-150 flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-red-900/30 transition-colors">
                    <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">Sign Out</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">End your session</div>
                  </div>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleNavigation('/profile')}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-150 flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700/20 flex items-center justify-center group-hover:bg-gray-100 dark:group-hover:bg-gray-600/30 transition-colors">
                    <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">Guest Profile</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Create account to save data</div>
                  </div>
                </button>
                
                <div className="border-t border-gray-100/80 dark:border-gray-700/80 my-2"></div>
                
                <button
                  onClick={() => handleNavigation('/login')}
                  className="w-full px-4 py-3 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-150 flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">Sign In</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Access your account</div>
                  </div>
                </button>
                
                <button
                  onClick={() => handleNavigation('/signup')}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-150 flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 transition-colors">
                    <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">Create Account</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Join Kairo today</div>
                  </div>
                </button>

                {/* Guest Info Message */}
                <div className="px-4 py-3 bg-blue-50/50 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-800/30">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-blue-800 dark:text-blue-200">Login/Signup to save schedules</div>
                      <div className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">Create an account to persist your data</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountDropdown;
