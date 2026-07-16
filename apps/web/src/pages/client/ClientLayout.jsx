import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

const NAV = [
  { to: '/app', label: 'Início', end: true },
  { to: '/app/veiculos', label: 'Meus Veículos' },
  { to: '/app/financeiro', label: 'Financeiro' },
  { to: '/app/contratos', label: 'Contratos' },
  { to: '/app/frota', label: 'Documentos' },
  { to: '/app/emergencia', label: 'Emergência' },
  { to: '/app/alertas', label: 'Alertas' },
  { to: '/app/perfil', label: 'Meu Perfil' },
];

const CONTRACT_ONLY_NAV = [
  { to: '/app/contratos', label: 'Contratos', end: true },
];

export default function ClientLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = api.getStoredUser();
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

  const navItems = serviceAccepted === false ? CONTRACT_ONLY_NAV : NAV;
  const blocked = serviceAccepted === false;

  return (
    <div className={`admin-shell client-shell${blocked ? ' contract-blocked' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span>🦅</span>
          <div>
            <strong>Águia</strong>
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
