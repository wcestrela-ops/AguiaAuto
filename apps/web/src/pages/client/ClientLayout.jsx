import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import {
  CLIENT_NAV,
  CONTRACT_ONLY_NAV,
  filterClientNav,
  isMultiTenantClientNavEnabled,
} from '../../lib/client-modules';
import { getCachedBranding } from '../../lib/tenant-branding';

export default function ClientLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = api.getStoredUser();
  const branding = getCachedBranding();
  const brandName = branding?.brand_name || branding?.trade_name || 'Águia';
  const [fullNav, setFullNav] = useState(CLIENT_NAV);
  const [serviceAccepted, setServiceAccepted] = useState(
    api.isServiceContractAccepted() ? true : null,
  );
  const [contractNotice, setContractNotice] = useState('');

  const redirectToContracts = useCallback((message) => {
    setServiceAccepted(false);
    api.setServiceContractAccepted(false);
    if (message) setContractNotice(message);

    if (location.pathname !== '/app/contratos') {
      navigate('/app/contratos', {
        replace: true,
        state: {
          contractRequired: true,
          message: message || 'Aceite o Contrato de Prestação de Serviços para continuar.',
        },
      });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    api.setContractRequiredHandler(redirectToContracts);
    return () => api.setContractRequiredHandler(null);
  }, [redirectToContracts]);

  useEffect(() => {
    if (!isMultiTenantClientNavEnabled()) return undefined;

    let cancelled = false;
    api.getClientModules()
      .then((res) => {
        if (cancelled) return;
        setFullNav(filterClientNav(CLIENT_NAV, res.data || []));
      })
      .catch(() => {
        if (!cancelled) setFullNav(CLIENT_NAV);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    api.getContractStatus()
      .then((res) => {
        if (cancelled) return;
        const accepted = Boolean(res.data?.service_accepted);
        api.setServiceContractAccepted(accepted);
        setServiceAccepted(accepted);
        if (!accepted && location.pathname !== '/app/contratos') {
          redirectToContracts('Aceite o Contrato de Prestação de Serviços para liberar o aplicativo.');
        }
      })
      .catch(() => {
        if (!cancelled) setServiceAccepted(false);
      });

    return () => { cancelled = true; };
  }, [location.pathname, redirectToContracts]);

  useEffect(() => {
    if (location.state?.contractRequired && location.state?.message) {
      setContractNotice(location.state.message);
    }
  }, [location.state]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return;
      if (!api.hasClientSession()) return;
      if (api.isAccessTokenValid()) return;
      api.ensureClientSession().catch(() => {});
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  async function logout() {
    await api.logout();
    navigate('/login');
  }

  const navItems = serviceAccepted === false ? CONTRACT_ONLY_NAV : fullNav;
  const blocked = serviceAccepted === false;

  return (
    <div className={`admin-shell client-shell${blocked ? ' contract-blocked' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt="" className="sidebar-brand-logo" />
          ) : (
            <span>🦅</span>
          )}
          <div>
            <strong>{brandName}</strong>
            <small>{user.name || user.email || 'Cliente'}</small>
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
          {blocked && (
            <small className="contract-block-hint">Aceite o contrato para liberar o app.</small>
          )}
          <button type="button" className="btn-ghost" onClick={logout}>Sair</button>
        </div>
      </aside>

      <main className="main-content">
        {serviceAccepted === null && location.pathname !== '/app/contratos' ? (
          <p className="muted">Verificando contrato...</p>
        ) : (
          <Outlet context={{ serviceAccepted, setServiceAccepted, contractNotice }} />
        )}
      </main>
    </div>
  );
}
