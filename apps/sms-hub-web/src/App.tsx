import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '@/modules/layout/AppLayout';
import LoginPage from '@/modules/auth/LoginPage';
import HomePage from '@/modules/dashboard/HomePage';
import DevicesPage from '@/modules/devices/DevicesPage';
import SendPage from '@/modules/dispatches/SendPage';
import HistoryPage from '@/modules/history/HistoryPage';
import MorePage from '@/modules/settings/MorePage';
import LibraryPage from '@/modules/library/LibraryPage';
import { api } from '@/services/api';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  if (!api.accessToken && !localStorage.getItem('sms_hub_access')) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="send" element={<SendPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="more" element={<MorePage />} />
        <Route path="library" element={<LibraryPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
