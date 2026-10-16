import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { CodingWorkspacePage, type RestoredCodeState } from './pages/CodingWorkspacePage';
import { InterviewPracticePage } from './pages/InterviewPracticePage';
import { HistoryPage } from './pages/HistoryPage';
import type { NavPage } from './types';
import { checkBackendHealth } from './services/api';
import { AuthProvider } from './context/AuthContext';
import { AuthModal } from './components/auth/AuthModal';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<NavPage>('dashboard');
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | undefined>(undefined);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);
  const [restoredCodeState, setRestoredCodeState] = useState<RestoredCodeState | null>(null);

  const performHealthCheck = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      const result = await checkBackendHealth();
      setIsBackendHealthy(result.success);
      setLatencyMs(result.latencyMs);
    } catch {
      setIsBackendHealthy(false);
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  // Run initial health check on startup
  useEffect(() => {
    performHealthCheck();
    // Poll every 15 seconds to update connection status
    const interval = setInterval(performHealthCheck, 15000);
    return () => clearInterval(interval);
  }, [performHealthCheck]);

  const handleRestoreCode = (restored: RestoredCodeState) => {
    setRestoredCodeState(restored);
    setCurrentPage('workspace');
  };

  return (
    <>
      <AppLayout
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        isBackendHealthy={isBackendHealthy}
        latencyMs={latencyMs}
        isCheckingHealth={isCheckingHealth}
        onRefreshHealth={performHealthCheck}
      >
        {currentPage === 'dashboard' && (
          <DashboardPage onNavigate={setCurrentPage} />
        )}

        {currentPage === 'workspace' && (
          <CodingWorkspacePage
            onNavigate={setCurrentPage}
            restoredState={restoredCodeState}
            onClearRestoredState={() => setRestoredCodeState(null)}
          />
        )}

        {currentPage === 'interview' && (
          <InterviewPracticePage onNavigate={setCurrentPage} />
        )}

        {currentPage === 'history' && (
          <HistoryPage
            onNavigate={setCurrentPage}
            onRestoreCode={handleRestoreCode}
          />
        )}
      </AppLayout>

      <AuthModal />
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
