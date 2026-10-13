import { useCallback, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Topbar from './layout/Topbar.jsx';
import { usePortalSession } from './layout/usePortalSession.js';
import { OfflineBanner } from './offline/SyncBadge.jsx';
import DashboardPage from './features/collar-alerts/pages/DashboardPage.jsx';
import TriagePage from './features/field-incidents/pages/TriagePage.jsx';
import ReportsPage from './features/reports/pages/ReportsPage.jsx';
import SavedReportsPage from './features/reports/pages/SavedReportsPage.jsx';
import AnalyticsShell from './features/reports/components/AnalyticsShell.jsx';
import ComparisonPage from './features/reports/pages/ComparisonPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { setUnauthorizedHandler } from './services/api.js';
import { DASHBOARD_ROLES, clearSession, homePathForRole } from './services/session.js';

/**
 * Operations dashboard shell for the Wildlife Conservation Portal.
 *
 * The Collar Boundary Alerts route is fully implemented here. The top bar
 * carries exactly two destinations — the dashboard and the reports workspace —
 * and both open working features; anything else the officer types returns them
 * to their own home.
 *
 * Every route except /login needs a session: either one started here with the
 * sign-in page, or one the mobile app handed over when the dashboard is shown
 * inside the app's WebView.
 *
 * Authorization is enforced on both sides. The backend refuses any collar,
 * park, alert or audit request without an officer/manager token (see
 * backend/middlewares/operationsAccess.js); these guards only decide which
 * shell to show, so a mistyped URL does not land an officer on another role's
 * workspace.
 */
export default function App() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { session, waiting } = usePortalSession();
  const isLogin = pathname === '/login';

  const handleUnauthorized = useCallback(() => {
    // Exception flow 2: an expired or revoked token signs the officer out and
    // returns them to authentication. The protected data is gone from this
    // page because the session it was rendered under no longer exists.
    clearSession();
    if (!isLogin) navigate('/login', { replace: true });
  }, [navigate, isLogin]);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, [handleUnauthorized]);

  const isAnalytics = pathname.startsWith('/analytics');
  // The Park Manager works in the analytics workspace, so any other URL —
  // including "/" — sends them there instead of the collar alert dashboard.
  const isManagerHome = session?.role === 'manager' && !isAnalytics;

  if (isLogin) return <LoginPage />;

  // Inside the app the session may still be on its way; show nothing rather
  // than bouncing to the sign-in page and back.
  if (waiting) return null;

  if (!session || !DASHBOARD_ROLES.includes(session.role)) {
    return <Navigate to="/login" replace />;
  }

  if (isManagerHome) {
    return <Navigate to={homePathForRole(session.role)} replace />;
  }

  // An unknown URL returns each role to its own home, not everyone to "/".
  const home = <Navigate to={homePathForRole(session.role)} replace />;

  return (
    <div className="h-screen">
      {isAnalytics ? (
        <AnalyticsShell>
          <Routes>
            <Route path="/analytics/type" element={<ReportsPage />} />
            <Route path="/analytics/comparison" element={<ComparisonPage />} />
            <Route path="/analytics/saved" element={<SavedReportsPage />} />
            <Route path="*" element={home} />
          </Routes>
        </AnalyticsShell>
      ) : (
        <div className="flex h-full flex-col bg-sand-100">
          <OfflineBanner />
          <Topbar />
          <main className="relative min-h-0 flex-1">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/incidents/triage" element={<TriagePage />} />
              <Route path="/reports" element={<Navigate to="/analytics/type" replace />} />
              <Route path="/reports/saved" element={<SavedReportsPage />} />
              <Route path="*" element={home} />
            </Routes>
          </main>
        </div>
      )}
    </div>
  );
}