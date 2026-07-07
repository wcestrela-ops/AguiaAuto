import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from './api/client';
import LoginPage from './pages/admin/LoginPage';
import AdminLayout from './pages/admin/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import IntegrationsPage from './pages/admin/IntegrationsPage';
import IntegrationEditPage from './pages/admin/IntegrationEditPage';
import WhatsAppPage from './pages/admin/WhatsAppPage';
import AdminVehiclesPage from './pages/admin/AdminVehiclesPage';
import AdminFinanceiroPage from './pages/admin/AdminFinanceiroPage';
import AdminAlertsPage from './pages/admin/AdminAlertsPage';
import ClientLoginPage from './pages/client/ClientLoginPage';
import ClientRegisterPage from './pages/client/ClientRegisterPage';
import ClientLayout from './pages/client/ClientLayout';
import ClientHomePage from './pages/client/ClientHomePage';
import ClientProfilePage from './pages/client/ClientProfilePage';
import ClientVehiclesPage from './pages/client/ClientVehiclesPage';
import ClientVehicleDetailPage from './pages/client/ClientVehicleDetailPage';
import ClientFinanceiroPage from './pages/client/ClientFinanceiroPage';
import ClientAlertsPage from './pages/client/ClientAlertsPage';
import ForgotPasswordPage from './pages/client/ForgotPasswordPage';
import ResetPasswordPage from './pages/client/ResetPasswordPage';

function AdminRoute({ children }) {
  const token = api.adminToken || localStorage.getItem('admin_token');
  if (!token) return <Navigate to="/admin/login" replace />;
  return children;
}

function ClientRoute({ children }) {
  if (!api.isClientLoggedIn()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Cliente */}
      <Route path="/login" element={<ClientLoginPage />} />
      <Route path="/cadastro" element={<ClientRegisterPage />} />
      <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
      <Route path="/recuperar-senha/confirmar" element={<ResetPasswordPage />} />
      <Route
        path="/app"
        element={
          <ClientRoute>
            <ClientLayout />
          </ClientRoute>
        }
      >
        <Route index element={<ClientHomePage />} />
        <Route path="veiculos" element={<ClientVehiclesPage />} />
        <Route path="veiculos/:id" element={<ClientVehicleDetailPage />} />
        <Route path="financeiro" element={<ClientFinanceiroPage />} />
        <Route path="alertas" element={<ClientAlertsPage />} />
        <Route path="perfil" element={<ClientProfilePage />} />
      </Route>

      {/* Admin */}
      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="integracoes" element={<IntegrationsPage />} />
        <Route path="integracoes/:key" element={<IntegrationEditPage />} />
        <Route path="whatsapp" element={<WhatsAppPage />} />
        <Route path="veiculos" element={<AdminVehiclesPage />} />
        <Route path="financeiro" element={<AdminFinanceiroPage />} />
        <Route path="alertas" element={<AdminAlertsPage />} />
      </Route>
    </Routes>
  );
}
