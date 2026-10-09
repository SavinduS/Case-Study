import { Navigate, Route, Routes } from 'react-router-dom';
import Topbar from './layout/Topbar.jsx';
import DashboardPage from './features/collar-alerts/pages/DashboardPage.jsx';
import PortalModuleRoute from './pages/PortalModuleRoute.jsx';

/**
 * Operations dashboard shell for the Wildlife Conservation Portal.
 *
 * The Collar Boundary Alerts route is fully implemented here. The other
 * portal tabs belong to the remaining use cases in Group 033's design and
 * render an explicit placeholder naming the owning member.
 */
export default function App() {
  return (
    <div className="flex h-screen flex-col bg-sand-100">
      <Topbar />
      <main className="relative min-h-0 flex-1">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/data-logs" element={<PortalModuleRoute moduleKey="data-logs" />} />
          <Route path="/map-view" element={<PortalModuleRoute moduleKey="map-view" />} />
          <Route path="/reports" element={<PortalModuleRoute moduleKey="reports" />} />
          <Route path="/admin" element={<PortalModuleRoute moduleKey="admin" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}