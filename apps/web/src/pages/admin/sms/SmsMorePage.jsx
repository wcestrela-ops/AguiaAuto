import { Link } from 'react-router-dom';
import { smsApi } from '../../../api/sms-client';
import SmsPlaceholderPage from './SmsPlaceholderPage';

export default function SmsMorePage() {
  const user = smsApi.getUser();

  return (
    <div>
      <SmsPlaceholderPage title="Mais" description="Biblioteca, conta e configurações." />
      <div className="sms-card">
        <p><strong>Conta SMS:</strong> {user?.email}</p>
        <p><strong>Perfil:</strong> {user?.role}</p>
        <Link to="/admin/sms/library" className="sms-btn sms-btn-secondary" style={{ marginTop: '0.75rem' }}>
          Biblioteca
        </Link>
      </div>
    </div>
  );
}
