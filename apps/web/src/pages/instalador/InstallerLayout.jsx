import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

const NAV = [
  { to: '/instalador', label: 'Painel', end: true },
  { to: '/instalador/agendamentos', label: 'Agendamentos' },
  { to: '/instalador/historico', label: 'Histórico' },
];

export default function InstallerLayout() {
  const navigate = useNavigate();
  const user = api.getStoredUser();

  async function logout() {
    await api.logout();
    navigate('/login');
  }

  return (
    <div className="admin-shell client-shell installer-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span>🔧</span>
          <div>
            <strong>Águia</strong>
            <small>{user.name || user.email || 'Instalador'}</small>
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
          <button type="button" className="btn-ghost" onClick={logout}>Sair</button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
