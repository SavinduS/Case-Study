import { Routes, Route, Navigate, Link } from 'react-router-dom';
import Sidebar from './layout/Sidebar.jsx';
import ReportTypePage from './pages/analytics/ReportTypePage.jsx';
import CriteriaPage from './pages/analytics/CriteriaPage.jsx';
import ResultsPage from './pages/analytics/ResultsPage.jsx';
import SavedReportsPage from './pages/analytics/SavedReportsPage.jsx';

export default function App() {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/analytics/type" replace />} />
          <Route path="/analytics/type" element={<ReportTypePage />} />
          <Route path="/analytics/criteria" element={<CriteriaPage />} />
          <Route path="/analytics/results" element={<ResultsPage />} />
          <Route path="/analytics/saved" element={<SavedReportsPage />} />
          <Route path="*" element={<div>Not found. <Link to="/analytics/type">Go to analytics</Link></div>} />
        </Routes>
      </main>
    </div>
  );
}
