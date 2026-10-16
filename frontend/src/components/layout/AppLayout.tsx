import React from 'react';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import type { NavPage } from '../../types';

interface AppLayoutProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  isBackendHealthy: boolean | null;
  latencyMs?: number;
  isCheckingHealth: boolean;
  onRefreshHealth: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentPage,
  onNavigate,
  isBackendHealthy,
  latencyMs,
  isCheckingHealth,
  onRefreshHealth,
  children,
}) => {
  return (
    <div className="flex h-screen w-full bg-[#0a0e17] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        isBackendHealthy={isBackendHealthy}
        latencyMs={latencyMs}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Navbar */}
        <TopNavbar
          currentPage={currentPage}
          onRefreshHealth={onRefreshHealth}
          isCheckingHealth={isCheckingHealth}
          isBackendHealthy={isBackendHealthy}
        />

        {/* Main Page Body */}
        <main
          className={`flex-1 ${
            currentPage === 'workspace'
              ? 'overflow-hidden p-3 md:p-4'
              : 'overflow-y-auto p-6 md:p-8'
          } bg-[#0a0e17]`}
        >
          <div className={currentPage === 'workspace' ? 'w-full h-full' : 'max-w-7xl mx-auto'}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
