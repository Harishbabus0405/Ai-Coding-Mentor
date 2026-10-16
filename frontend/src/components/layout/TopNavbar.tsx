import React from 'react';
import { LogIn, LogOut } from 'lucide-react';
import type { NavPage } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface TopNavbarProps {
  currentPage: NavPage;
  onRefreshHealth?: () => void;
  isCheckingHealth?: boolean;
  isBackendHealthy?: boolean | null;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  currentPage,
}) => {
  const { user, isLoadingUser, openAuthModal, logout } = useAuth();
  
  const pageTitles: Record<NavPage, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Welcome to your coding journey',
    },
    workspace: {
      title: 'Coding Practice',
      subtitle: 'Write code, test your solutions, and get friendly AI guidance',
    },
    interview: {
      title: 'Interview Practice',
      subtitle: 'Practice technical interview questions based on your code',
    },
    history: {
      title: 'My History',
      subtitle: 'Review your past code sessions and interview practice',
    },
  };

  const { title, subtitle } = pageTitles[currentPage];

  return (
    <header className="h-16 bg-[#0d121f]/90 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between z-10 shrink-0 select-none">
      {/* Page Title */}
      <div>
        <h1 className="text-base font-semibold text-white tracking-tight">
          {title}
        </h1>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>

      {/* User Authentication & Profile Controls */}
      <div className="flex items-center gap-3">
        {isLoadingUser ? (
          <div className="w-8 h-8 rounded-full bg-slate-800 animate-pulse" />
        ) : user ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div 
                className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center uppercase"
                title={user.email}
              >
                {user.display_name ? user.display_name.charAt(0) : user.email.charAt(0)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-medium text-slate-200 leading-tight">
                  {user.display_name || user.email.split('@')[0]}
                </p>
                <p className="text-[10px] text-slate-400 font-mono leading-none">
                  {user.email}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => openAuthModal('login')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-200 hover:text-white font-medium transition-colors"
            >
              <LogIn className="w-3.5 h-3.5 text-slate-400" />
              <span>Sign In</span>
            </button>
            <button
              onClick={() => openAuthModal('register')}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm"
            >
              <span>Create Account</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
