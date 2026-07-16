import { Link } from 'react-router-dom';
import { api } from '@/services/api';
import PlaceholderPage from '@/components/PlaceholderPage';

export default function MorePage() {
  const user = api.getUser();

  return (
    <div>
      <PlaceholderPage title="Mais" description="Biblioteca, conta e instalação do app." />
      <div className="card">
        <p><strong>Conta:</strong> {user?.email}</p>
        <p><strong>Perfil:</strong> {user?.role}</p>
        <Link to="/library" className="btn btn-secondary" style={{ marginTop: '0.75rem' }}>Biblioteca</Link>
      </div>
    </div>
  );
}
