import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';

export default function ClientSessionGate({ children, installer = false }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api.ensureClientSession()
      .then((user) => {
        if (cancelled) return;
        setAuthenticated(Boolean(user));
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <div className="login-page">
        <p className="muted">Carregando sessão...</p>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  const user = api.getStoredUser();
  if (!installer && user.role === 'installer') {
    return <Navigate to="/instalador" replace />;
  }
  if (installer && user.role !== 'installer' && user.role !== 'admin') {
    return <Navigate to="/app" replace />;
  }

  return children;
}
