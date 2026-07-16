import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/integracoes', label: 'Integrações' },
  { to: '/admin/whatsapp', label: 'WhatsApp' },
  { to: '/admin/sms', label: 'SMS Rastreador' },
  { to: '/admin/veiculos', label: 'Veículos' },
  { to: '/admin/clientes', label: 'Clientes' },
  { to: '/admin/financeiro', label: 'Financeiro' },
  { to: '/admin/planos', label: 'Planos' },
  { to: '/admin/site', label: 'Landing page' },
  { to: '/admin/alertas', label: 'Alertas' },
  { to: '/admin/emergencia', label: 'Emergência' },
  { to: '/admin/instaladores', label: 'Instaladores' },
  { to: '/admin/contratos', label: 'Contratos' },
  { to: '/admin/frota', label: 'Documentos' },
  { to: '/admin/indicacoes', label: 'Indicações' },
  { to: '/admin/auditoria', label: 'Auditoria' },
];

const PAGE_TITLES = Object.fromEntries(NAV.map((item) => [item.to, item.label]));

function resolvePageTitle(pathname) {
  if (pathname.startsWith('/admin/integracoes/')) return 'Integração';
  if (pathname.startsWith('/admin/clientes/')) return 'Cliente';
  return PAGE_TITLES[pathname] || 'Águia Admin';
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const pageTitle = resolvePageTitle(location.pathname);

  useEffect(() => {
    document.title = `${pageTitle} · Águia Admin`;
    return () => {
      document.title = 'Águia Admin';
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

  function logout() {
    api.clearToken();
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
