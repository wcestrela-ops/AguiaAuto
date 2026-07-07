import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { vehicleStatusBadge, vehicleStatusLabel } from '../../utils/vehicle';

export default function ClientVehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getVehicles()
      .then((res) => setVehicles(res.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="muted">Carregando veículos...</p>;

  return (
    <div>
      <header className="page-header">
        <h1>Meus Veículos</h1>
        <p>Acompanhe a localização e o status dos seus veículos.</p>
      </header>

      {error && <div className="alert error">{error}</div>}

      {vehicles.length === 0 ? (
        <div className="info-box">
          Nenhum veículo cadastrado. Entre em contato com o suporte para vincular seu rastreador.
        </div>
      ) : (
        <div className="vehicle-list">
          {vehicles.map((vehicle) => (
            <Link key={vehicle.id} to={`/app/veiculos/${vehicle.id}`} className="vehicle-card card-link">
              <div className="vehicle-card-header">
                <div>
                  <h3>{vehicle.label}</h3>
                  <p className="muted">{vehicle.plate}</p>
                </div>
                <span className={`badge ${vehicleStatusBadge(vehicle.status)}`}>
                  {vehicleStatusLabel(vehicle.status)}
                </span>
              </div>
              {(vehicle.brand || vehicle.model) && (
                <p className="vehicle-card-meta">
                  {[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' · ')}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
