import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Topbar from './layout/Topbar.jsx';
import { usePortalSession } from './layout/usePortalSession.js';
import { OfflineBanner } from './offline/SyncBadge.jsx';
import DashboardPage from './features/collar-alerts/pages/DashboardPage.jsx';
import TriagePage from './features/field-incidents/pages/TriagePage.jsx';
import PortalModuleRoute from './pages/PortalModuleRoute.jsx';
import ReportsPage from './features/reports/pages/ReportsPage.jsx';
import SavedReportsPage from './features/reports/pages/SavedReportsPage.jsx';
import ManagerShell from './features/reports/components/ManagerShell.jsx';
import ComparisonPage from './features/reports/pages/ComparisonPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { DASHBOARD_ROLES, homePathForRole } from './services/session.js';

/**
 * Operations dashboard shell for the Wildlife Conservation Portal.
 *
 * The Collar Boundary Alerts route is fully implemented here. The other
 * portal tabs belong to the remaining use cases in Group 033's design and
 * render an explicit placeholder naming the owning member.
 *
 * Every route except /login needs a session: either one started here with the
 * sign-in page, or one the mobile app handed over when the dashboard is shown
 * inside the app's WebView.
 */
export default function App() {
  const { pathname } = useLocation();
  const { session, waiting } = usePortalSession();
  const isLogin = pathname === '/login';
  const isManagerAnalytics = pathname === '/analytics/type' || pathname.startsWith('/analytics/type/');
  const isManagerWorkspace = isManagerAnalytics
    || pathname === '/analytics/comparison'
    || pathname === '/analytics/saved';

  if (isLogin) return <LoginPage />;

  // Inside the app the session may still be on its way; show nothing rather
  // than bouncing to the sign-in page and back.
  if (waiting) return null;

  if (!session || !DASHBOARD_ROLES.includes(session.role)) {
    return <Navigate to="/login" replace />;
  }

  // The Park Manager works in the analytics workspace, so any other URL —
  // including "/" — sends them there instead of the collar alert dashboard.
  if (session.role === 'manager' && !isManagerWorkspace) {
    return <Navigate to={homePathForRole(session.role)} replace />;
  }

  // An unknown URL returns each role to its own home, not everyone to "/".
  const home = <Navigate to={homePathForRole(session.role)} replace />;

  return (
    <div className="h-screen">
      {isManagerWorkspace ? (
        <ManagerShell>
          <Routes>
            <Route path="/analytics/type" element={<ReportsPage />} />
            <Route path="/analytics/comparison" element={<ComparisonPage />} />
            <Route path="/analytics/saved" element={<SavedReportsPage />} />
            <Route path="*" element={home} />
          </Routes>
        </ManagerShell>
      ) : (
        <div className="flex h-full flex-col bg-sand-100">
          <OfflineBanner />
          <Topbar />
          <main className="relative min-h-0 flex-1">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/incidents/triage" element={<TriagePage />} />
              <Route path="/data-logs" element={<PortalModuleRoute moduleKey="data-logs" />} />
              <Route path="/map-view" element={<PortalModuleRoute moduleKey="map-view" />} />
              <Route path="/reports" element={<PortalModuleRoute moduleKey="reports" />} />
              <Route path="/reports/saved" element={<SavedReportsPage />} />
              <Route path="/admin" element={<PortalModuleRoute moduleKey="admin" />} />
              <Route path="*" element={home} />
            </Routes>
          </main>
        </div>
      )}
    </div>
  );
}