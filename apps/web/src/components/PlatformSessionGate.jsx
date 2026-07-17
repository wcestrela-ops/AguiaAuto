import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { hasPlatformAccess } from '../lib/platform-access';

export default function PlatformSessionGate({ children }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api.ensureAdminSession()
      .then((admin) => {
        if (cancelled) return;
        setAuthenticated(Boolean(admin));
        setAllowed(hasPlatformAccess(admin));
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <div className="login-page">
        <p className="muted">Carregando painel da plataforma...</p>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!allowed) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Acesso restrito</h1>
          <p className="muted">Esta área é exclusiva para operadores da plataforma.</p>
          <a href="/admin" className="btn-primary" style={{ display: 'inline-block', marginTop: '1rem', textAlign: 'center' }}>
            Voltar ao admin
          </a>
        </div>
      </div>
    );
  }

  return children;
}
