import { Navigate, Route, Routes } from 'react-router-dom';
import Topbar from './layout/Topbar.jsx';
import DashboardPage from './features/collar-alerts/pages/DashboardPage.jsx';

/**
 * Operations dashboard shell for the Wildlife Conservation Portal.
 *
 * Only the Collar Boundary Alerts route is implemented here — the other
 * modules belong to the remaining use cases in Group 033's design.
 */
export default function App() {
  return (
    <div className="flex h-screen flex-col bg-sand-100">
      <Topbar active="dashboard" />
      <main className="relative min-h-0 flex-1">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}