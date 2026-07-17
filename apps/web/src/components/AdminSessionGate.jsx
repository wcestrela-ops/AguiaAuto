import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';

export default function AdminSessionGate({ children }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api.ensureAdminSession()
      .then((admin) => {
        if (cancelled) return;
        setAuthenticated(Boolean(admin));
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <div className="login-page">
        <p className="muted">Carregando sessão administrativa...</p>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
