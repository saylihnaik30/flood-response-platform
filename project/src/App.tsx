import { Routes, Route, Navigate } from 'react-router-dom';
import ReportPage from '@/pages/ReportPage';
import DashboardPage from '@/pages/DashboardPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/report" replace />} />
      <Route path="/report" element={<ReportPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/report" replace />} />
    </Routes>
  );
}
