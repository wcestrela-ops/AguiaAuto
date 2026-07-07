import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

const NAV = [
  { to: '/app', label: 'Início', end: true },
  { to: '/app/veiculos', label: 'Meus Veículos' },
  { to: '/app/financeiro', label: 'Financeiro' },
  { to: '/app/perfil', label: 'Meu Perfil' },
];

export default function ClientLayout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  async function logout() {
    await api.logout();
    navigate('/login');
  }

  return (
    <div className="admin-shell client-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span>🦅</span>
          <div>
            <strong>Águia</strong>
            <small>{user.name || user.email || 'Cliente'}</small>
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
