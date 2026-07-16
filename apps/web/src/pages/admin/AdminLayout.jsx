import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/integracoes', label: 'Integrações' },
  { to: '/admin/whatsapp', label: 'WhatsApp' },
  { to: '/admin/veiculos', label: 'Veículos' },
  { to: '/admin/financeiro', label: 'Financeiro' },
  { to: '/admin/alertas', label: 'Alertas' },
  { to: '/admin/instaladores', label: 'Instaladores' },
  { to: '/admin/contratos', label: 'Contratos' },
  { to: '/admin/sms', label: 'AG SMS' },
];

export default function AdminLayout() {
  const navigate = useNavigate();

  function logout() {
    api.clearToken();
    navigate('/admin/login');
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span>🦅</span>
          <div>
            <strong>Águia</strong>
            <small>Gestão Veicular</small>
          </div>
        </div>

        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <small>Configurações → Integrações</small>
          <button type="button" className="btn-ghost" onClick={logout}>
            Sair
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
