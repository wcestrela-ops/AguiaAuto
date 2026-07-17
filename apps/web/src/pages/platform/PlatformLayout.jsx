import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { filterPlatformNav, getStoredAdminUser, hasPlatformAccess } from '../../lib/platform-access';

const NAV = [
  { to: '/platform', label: 'Dashboard', end: true, permission: 'platform.health.view' },
  { to: '/platform/tenants', label: 'Empresas', permission: 'platform.tenants.view' },
  { to: '/platform/onboarding', label: 'Onboarding B2B', permission: 'platform.tenants.create' },
  { to: '/platform/modules', label: 'Módulos', permission: 'platform.modules.view' },
  { to: '/platform/saas-plans', label: 'Planos SaaS', permission: 'platform.billing.view' },
];

const PAGE_TITLES = {
  '/platform': 'Dashboard',
  '/platform/tenants': 'Empresas',
  '/platform/onboarding': 'Onboarding B2B',
  '/platform/modules': 'Módulos',
  '/platform/saas-plans': 'Planos SaaS',
};

function resolvePageTitle(pathname) {
  if (pathname.startsWith('/platform/tenants/')) return 'Empresa';
  return PAGE_TITLES[pathname] || 'Plataforma Águia';
}

export default function PlatformLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const pageTitle = resolvePageTitle(location.pathname);
  const user = useMemo(() => getStoredAdminUser(), [location.pathname]);
  const navItems = useMemo(() => filterPlatformNav(user, NAV), [user]);
  const showAdminLink = user && !user.role?.startsWith('platform_');

  useEffect(() => {
    document.title = `${pageTitle} · Plataforma Águia`;
    return () => {
      document.title = 'Plataforma Águia';
    };
  }, [pageTitle]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [navOpen]);

  async function logout() {
    await api.adminLogout();
    navigate('/admin/login');
  }

  return (
    <div className={`admin-shell platform-shell${navOpen ? ' nav-open' : ''}`}>
      {navOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <aside className="sidebar" aria-label="Navegação plataforma">
        <div className="sidebar-brand">
          <span>🌐</span>
          <div>
            <strong>Águia</strong>
            <small>Plataforma SaaS</small>
          </div>
        </div>

        <nav>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {showAdminLink && hasPlatformAccess(user) ? (
            <NavLink to="/admin" className="nav-link nav-link-compact">
              Admin tenant
            </NavLink>
          ) : null}
          <button type="button" className="btn-ghost" onClick={logout}>
            Sair
          </button>
        </div>
      </aside>

      <div className="main-column">
        <header className="mobile-topbar">
          <button
            type="button"
            className="nav-toggle btn-ghost"
            aria-expanded={navOpen}
            aria-label={navOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setNavOpen((open) => !open)}
          >
            ☰
          </button>
          <span className="mobile-page-title">{pageTitle}</span>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
