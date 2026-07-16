import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { smsApi } from '../../../api/sms-client';

export default function SmsHomePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const user = smsApi.getUser();

  useEffect(() => {
    smsApi.dashboard()
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      {error && <div className="alert error">{error}</div>}

      <div className="stat-grid">
        {Object.entries(data || {})
          .filter(([key]) => !['role', 'company_id'].includes(key))
          .map(([key, value]) => (
            <div key={key} className="stat-card">
              <strong>{String(value)}</strong>
              <span>{key.replace(/_/g, ' ')}</span>
            </div>
          ))}
      </div>

      <div className="sms-card">
        <h3 style={{ marginTop: 0 }}>Operador SMS: {user?.name}</h3>
        <p style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
          Biblioteca, dispositivos, envio e gateways serão habilitados nas próximas entregas.
        </p>
        <Link to="/admin/sms/send" className="sms-btn">
          Enviar comando
        </Link>
      </div>
    </div>
  );
}
