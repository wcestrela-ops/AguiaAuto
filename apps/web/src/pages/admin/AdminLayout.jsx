import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { getStoredAdminUser, hasPlatformAccess } from '../../lib/platform-access';
import {
  ADMIN_NAV,
  filterAdminNav,
  isMultiTenantNavEnabled,
  resolveAdminPageTitle,
} from '../../lib/admin-modules';
import { getCachedBranding } from '../../lib/tenant-branding';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [navItems, setNavItems] = useState(ADMIN_NAV);
  const pageTitle = resolveAdminPageTitle(location.pathname, navItems);
  const user = useMemo(() => getStoredAdminUser(), [location.pathname]);
  const showPlatformLink = hasPlatformAccess(user);
  const branding = getCachedBranding();
  const brandName = branding?.brand_name || branding?.trade_name || 'Águia';
  const brandSubtitle = branding?.slug ? 'Gestão Veicular' : 'Gestão Veicular';

  useEffect(() => {
    if (!isMultiTenantNavEnabled()) return undefined;

    let cancelled = false;
    api.getAdminModules()
      .then((res) => {
        if (cancelled) return;
        setNavItems(filterAdminNav(ADMIN_NAV, res.data || []));
      })
      .catch(() => {
        if (!cancelled) setNavItems(ADMIN_NAV);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.title = `${pageTitle} · ${brandName} Admin`;
    return () => {
      document.title = `${brandName} Admin`;
    };
  }, [pageTitle, brandName]);

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
    <div className={`admin-shell${navOpen ? ' nav-open' : ''}`}>
      {navOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <aside className="sidebar" aria-label="Navegação admin">
        <div className="sidebar-brand">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt="" className="sidebar-brand-logo" />
          ) : (
            <span>🦅</span>
          )}
          <div>
            <strong>{brandName}</strong>
            <small>{brandSubtitle}</small>
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
          {showPlatformLink ? (
            <NavLink to="/platform" className="nav-link nav-link-compact">
              Plataforma SaaS
            </NavLink>
          ) : null}
          <NavLink to="/admin/integracoes" className="nav-link nav-link-compact">
            Integrações
          </NavLink>
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
