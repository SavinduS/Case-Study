import { Routes, Route, Navigate, Link } from 'react-router-dom';
import Sidebar from './layout/Sidebar.jsx';
import Topbar from './layout/Topbar.jsx';
import ReportTypePage from './pages/analytics/ReportTypePage.jsx';
import CriteriaPage from './pages/analytics/CriteriaPage.jsx';
import ResultsPage from './pages/analytics/ResultsPage.jsx';
import SavedReportsPage from './pages/analytics/SavedReportsPage.jsx';

export default function App() {
  return (
    <div className="flex min-h-screen bg-sand-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/analytics/type" replace />} />
            <Route path="/analytics/type" element={<ReportTypePage />} />
            <Route path="/analytics/criteria" element={<CriteriaPage />} />
            <Route path="/analytics/results" element={<ResultsPage />} />
            <Route path="/analytics/saved" element={<SavedReportsPage />} />
            <Route path="*" element={<div className="rounded-xl bg-white p-6">Not found. <Link className="underline" to="/analytics/type">Go to analytics</Link></div>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
