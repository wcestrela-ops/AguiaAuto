import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from './api/client';
import LoginPage from './pages/admin/LoginPage';
import AdminLayout from './pages/admin/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import IntegrationsPage from './pages/admin/IntegrationsPage';
import IntegrationEditPage from './pages/admin/IntegrationEditPage';
import WhatsAppPage from './pages/admin/WhatsAppPage';

function PrivateRoute({ children }) {
  const token = api.token || localStorage.getItem('admin_token');
  if (!token) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <PrivateRoute>
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="integracoes" element={<IntegrationsPage />} />
        <Route path="integracoes/:key" element={<IntegrationEditPage />} />
        <Route path="whatsapp" element={<WhatsAppPage />} />
      </Route>
    </Routes>
  );
}
