import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import VehicleMap from '../../components/VehicleMap';
import { vehicleStatusBadge, vehicleStatusLabel } from '../../utils/vehicle';

export default function ClientVehicleDetailPage() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadLocation = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const res = await api.getVehicleLocation(id);
      setLocation(res.data?.localizacao || null);
      if (res.data?.veiculo) setVehicle(res.data.veiculo);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const vehicleRes = await api.getVehicle(id);
        setVehicle(vehicleRes.data);
        if (vehicleRes.data.status === 'active' || vehicleRes.data.status === 'blocked') {
          await loadLocation();
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, loadLocation]);

  async function handleBlock() {
    setMessage('');
    setError('');
    try {
      await api.blockVehicle(id);
      setMessage('Veículo bloqueado.');
      const res = await api.getVehicle(id);
      setVehicle(res.data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUnblock() {
    setMessage('');
    setError('');
    try {
      await api.unblockVehicle(id);
      setMessage('Veículo desbloqueado.');
      const res = await api.getVehicle(id);
      setVehicle(res.data);
      await loadLocation();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Carregando veículo...</p>;
  if (!vehicle) return <div className="alert error">{error || 'Veículo não encontrado.'}</div>;

  const canTrack = vehicle.status === 'active' || vehicle.status === 'blocked';
  const hasCoords = location?.latitude != null && location?.longitude != null;

  return (
    <div>
      <header className="page-header">
        <Link to="/app/veiculos" className="back-link">← Voltar</Link>
        <h1>{vehicle.label}</h1>
        <p>
          <span className={`badge ${vehicleStatusBadge(vehicle.status)}`}>
            {vehicleStatusLabel(vehicle.status)}
          </span>
        </p>
      </header>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="vehicle-detail-grid">
        <div className="form-card vehicle-info-card">
          <h3>Dados do veículo</h3>
          <dl className="detail-list">
            <div><dt>Placa</dt><dd>{vehicle.plate}</dd></div>
            {vehicle.brand && <div><dt>Marca</dt><dd>{vehicle.brand}</dd></div>}
            {vehicle.model && <div><dt>Modelo</dt><dd>{vehicle.model}</dd></div>}
            {vehicle.color && <div><dt>Cor</dt><dd>{vehicle.color}</dd></div>}
            {vehicle.year && <div><dt>Ano</dt><dd>{vehicle.year}</dd></div>}
          </dl>

          {vehicle.gpswox_device_id && (
            <div className="form-actions">
              {vehicle.status !== 'blocked' && (
                <button type="button" className="btn-danger" onClick={handleBlock}>
                  Bloquear
                </button>
              )}
              {vehicle.status === 'blocked' && (
                <button type="button" onClick={handleUnblock}>
                  Desbloquear
                </button>
              )}
            </div>
          )}
        </div>

        <div className="map-card">
          <div className="map-card-header">
            <h3>Localização</h3>
            {canTrack && (
              <button type="button" className="btn-secondary btn-sm" onClick={loadLocation} disabled={refreshing}>
                {refreshing ? 'Atualizando...' : 'Atualizar'}
              </button>
            )}
          </div>

          {vehicle.status === 'pending_installation' && (
            <div className="info-box">Aguardando instalação do rastreador.</div>
          )}

          {canTrack && (
            <>
              <VehicleMap
                latitude={location?.latitude}
                longitude={location?.longitude}
                label={vehicle.label}
              />
              {location && (
                <div className="location-meta">
                  <p><strong>Endereço:</strong> {location.endereco || '—'}</p>
                  <p><strong>Velocidade:</strong> {location.velocidade || '—'}</p>
                  {location.maps_link && (
                    <a href={location.maps_link} target="_blank" rel="noreferrer">
                      Abrir no Google Maps
                    </a>
                  )}
                  {!hasCoords && !refreshing && (
                    <p className="muted">Coordenadas indisponíveis no momento.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
