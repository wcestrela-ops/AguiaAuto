import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/admin/LoginPage';
import AdminLayout from './pages/admin/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import IntegrationsPage from './pages/admin/IntegrationsPage';
import IntegrationEditPage from './pages/admin/IntegrationEditPage';
import WhatsAppPage from './pages/admin/WhatsAppPage';
import SmsPage from './pages/admin/SmsPage';
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
import ClientContratosPage from './pages/client/ClientContratosPage';
import ClientFrotaPage from './pages/client/ClientFrotaPage';
import ClientEmergenciaPage from './pages/client/ClientEmergenciaPage';
import ForgotPasswordPage from './pages/client/ForgotPasswordPage';
import ResetPasswordPage from './pages/client/ResetPasswordPage';
import InstallerLayout from './pages/instalador/InstallerLayout';
import InstallerHomePage from './pages/instalador/InstallerHomePage';
import InstallerPendingPage from './pages/instalador/InstallerPendingPage';
import InstallerHistoryPage from './pages/instalador/InstallerHistoryPage';
import InstallerJobPage from './pages/instalador/InstallerJobPage';
import AdminInstaladoresPage from './pages/admin/AdminInstaladoresPage';
import AdminContratosPage from './pages/admin/AdminContratosPage';
import AdminFrotaPage from './pages/admin/AdminFrotaPage';
import AdminIndicacoesPage from './pages/admin/AdminIndicacoesPage';
import AdminAuditPage from './pages/admin/AdminAuditPage';
import AdminClientesPage from './pages/admin/AdminClientesPage';
import AdminClienteDetailPage from './pages/admin/AdminClienteDetailPage';
import AdminEmergenciaPage from './pages/admin/AdminEmergenciaPage';
import AdminPlansPage from './pages/admin/AdminPlansPage';
import AdminLandingPage from './pages/admin/AdminLandingPage';
import LandingPage from './pages/LandingPage';
import AdminSecurityPage from './pages/admin/AdminSecurityPage';
import ClientSessionGate from './components/ClientSessionGate';
import AdminSessionGate from './components/AdminSessionGate';
import PlatformSessionGate from './components/PlatformSessionGate';
import PlatformLayout from './pages/platform/PlatformLayout';
import PlatformDashboardPage from './pages/platform/PlatformDashboardPage';
import PlatformTenantsPage from './pages/platform/PlatformTenantsPage';
import PlatformTenantDetailPage from './pages/platform/PlatformTenantDetailPage';
import PlatformModulesPage from './pages/platform/PlatformModulesPage';
import PlatformSaasPlansPage from './pages/platform/PlatformSaasPlansPage';

function AdminRoute({ children }) {
  return <AdminSessionGate>{children}</AdminSessionGate>;
}

function ClientRoute({ children }) {
  return <ClientSessionGate>{children}</ClientSessionGate>;
}

function InstallerRoute({ children }) {
  return <ClientSessionGate installer>{children}</ClientSessionGate>;
}

function PlatformRoute({ children }) {
  return <PlatformSessionGate>{children}</PlatformSessionGate>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

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
        <Route path="contratos" element={<ClientContratosPage />} />
        <Route path="frota" element={<ClientFrotaPage />} />
        <Route path="emergencia" element={<ClientEmergenciaPage />} />
        <Route path="perfil" element={<ClientProfilePage />} />
      </Route>

      {/* Instalador */}
      <Route
        path="/instalador"
        element={
          <InstallerRoute>
            <InstallerLayout />
          </InstallerRoute>
        }
      >
        <Route index element={<InstallerHomePage />} />
        <Route path="agendamentos" element={<InstallerPendingPage />} />
        <Route path="historico" element={<InstallerHistoryPage />} />
        <Route path="instalacoes/:id" element={<InstallerJobPage />} />
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
        <Route path="sms" element={<SmsPage />} />
        <Route path="veiculos" element={<AdminVehiclesPage />} />
        <Route path="financeiro" element={<AdminFinanceiroPage />} />
        <Route path="planos" element={<AdminPlansPage />} />
        <Route path="site" element={<AdminLandingPage />} />
        <Route path="alertas" element={<AdminAlertsPage />} />
        <Route path="instaladores" element={<AdminInstaladoresPage />} />
        <Route path="contratos" element={<AdminContratosPage />} />
        <Route path="frota" element={<AdminFrotaPage />} />
        <Route path="indicacoes" element={<AdminIndicacoesPage />} />
        <Route path="auditoria" element={<AdminAuditPage />} />
        <Route path="seguranca" element={<AdminSecurityPage />} />
        <Route path="clientes" element={<AdminClientesPage />} />
        <Route path="clientes/:id" element={<AdminClienteDetailPage />} />
        <Route path="emergencia" element={<AdminEmergenciaPage />} />
      </Route>

      {/* Plataforma master (SaaS) */}
      <Route
        path="/platform"
        element={
          <PlatformRoute>
            <PlatformLayout />
          </PlatformRoute>
        }
      >
        <Route index element={<PlatformDashboardPage />} />
        <Route path="tenants" element={<PlatformTenantsPage />} />
        <Route path="tenants/:id" element={<PlatformTenantDetailPage />} />
        <Route path="modules" element={<PlatformModulesPage />} />
        <Route path="saas-plans" element={<PlatformSaasPlansPage />} />
      </Route>
    </Routes>
  );
}
