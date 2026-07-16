import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { cn } from '@/lib/cn';

const NAV = [
  { to: '/', label: 'Início', end: true },
  { to: '/devices', label: 'Dispositivos' },
  { to: '/send', label: 'Enviar' },
  { to: '/history', label: 'Histórico' },
  { to: '/more', label: 'Mais' },
];

const ADMIN_NAV = [
  { to: '/admin/companies', label: 'Empresas' },
  { to: '/admin/gateways', label: 'Gateways' },
];

function NavItems({ vertical = false }: { vertical?: boolean }) {
  const user = api.getUser();
  const isAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <>
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => cn(vertical ? 'sidebar-link' : undefined, isActive && 'active')}
        >
          {item.label}
        </NavLink>
      ))}
      {isAdmin && vertical && ADMIN_NAV.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => cn('sidebar-link', isActive && 'active')}>
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const user = api.getUser();

  async function logout() {
    await api.logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar desktop-only">
        <div className="brand" style={{ textAlign: 'left', marginBottom: '1rem' }}>
          <strong>AG SMS Hub</strong>
          <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{user?.name}</div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <NavItems vertical />
        </nav>
        <button type="button" className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={logout}>
          Sair
        </button>
      </aside>

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="bottom-nav mobile-only">
        <NavItems />
      </nav>

      <style>{`
        .desktop-only { display: none; }
        .sidebar-link {
          padding: 0.65rem 0.75rem;
          border-radius: 8px;
          color: var(--muted);
        }
        .sidebar-link.active { background: #0b1220; color: var(--primary); }
        @media (min-width: 900px) {
          .desktop-only { display: block; }
          .mobile-only { display: none; }
        }
      `}</style>
    </div>
  );
}
