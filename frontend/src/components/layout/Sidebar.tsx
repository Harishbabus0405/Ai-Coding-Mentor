import React from 'react';
import { 
  LayoutDashboard, 
  Code2, 
  MessageSquareCode, 
  History, 
  GraduationCap,
  ChevronRight
} from 'lucide-react';
import type { NavPage } from '../../types';

interface SidebarProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  isBackendHealthy?: boolean | null;
  latencyMs?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
}) => {
  const navItems: Array<{
    id: NavPage;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'workspace',
      label: 'Coding Practice',
      icon: <Code2 className="w-4 h-4" />,
    },
    {
      id: 'interview',
      label: 'Interview Practice',
      icon: <MessageSquareCode className="w-4 h-4" />,
    },
    {
      id: 'history',
      label: 'My History',
      icon: <History className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="w-60 bg-[#0d121f] border-r border-slate-800/80 flex flex-col h-screen shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center border-b border-slate-800/80 gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <GraduationCap className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <div className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
            AI Coding Mentor
          </div>
          <p className="text-[11px] text-slate-400">Personal Coding Tutor</p>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-4 px-3 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase font-mono">
          Menu
        </div>

        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-emerald-400' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>

              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Helper */}
      <div className="p-4 border-t border-slate-800/80 bg-[#090d17]/60">
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 text-center">
          <p className="text-xs font-medium text-slate-200">Need help?</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Write code, run test cases, or ask your AI mentor for guided hints.
          </p>
        </div>
      </div>
    </aside>
  );
};
