import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { setClientPageError } from '../../utils/client-api-error';
import VehicleMap from '../../components/VehicleMap';
import VehicleRouteMap from '../../components/VehicleRouteMap';
import CommandFeedback, { CommandHistoryList } from '../../components/CommandFeedback';
import { HelpButton, InlineGuide, SectionTitleWithHelp } from '../../components/HelpGuide';
import { vehicleStatusBadge, vehicleStatusLabel } from '../../utils/vehicle';

const LOCATION_MODES = [
  { id: 'mapa', label: 'Mapa ao vivo' },
  { id: 'compartilhar', label: 'Compartilhar GPSWOX' },
];

const HISTORY_PRESETS = [
  { id: '24h', label: 'Últimas 24h', hours: 24 },
  { id: '7d', label: 'Últimos 7 dias', hours: 24 * 7 },
];

export default function ClientVehicleDetailPage() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationMode, setLocationMode] = useState('mapa');
  const [shareLink, setShareLink] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyPreset, setHistoryPreset] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commandLoading, setCommandLoading] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const [anchorLoading, setAnchorLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lastCommandFeedback, setLastCommandFeedback] = useState(null);
  const [commandHistory, setCommandHistory] = useState([]);

  const loadLocation = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const res = await api.getVehicleLocation(id);
      setLocation(res.data?.localizacao || null);
      if (res.data?.veiculo) setVehicle(res.data.veiculo);
    } catch (err) {
      setClientPageError(setError, err);
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  const loadAnchor = useCallback(async () => {
    try {
      const res = await api.getVehicleAnchor(id);
      setAnchor(res.data?.ancora || null);
    } catch {
      setAnchor(null);
    }
  }, [id]);

  const loadHistory = useCallback(async (hours) => {
    setHistoryLoading(true);
    setError('');
    try {
      const preset = HISTORY_PRESETS.find((p) => p.id === historyPreset);
      const res = await api.getVehicleHistory(id, { hours: hours || preset?.hours || 24 });
      setHistory(res.data);
    } catch (err) {
      setClientPageError(setError, err);
    } finally {
      setHistoryLoading(false);
    }
  }, [id, historyPreset]);

  const loadCommandHistory = useCallback(async () => {
    try {
      const res = await api.getVehicleCommandHistory(id, { limit: 8 });
      setCommandHistory(res.data || []);
    } catch {
      setCommandHistory([]);
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
          await loadAnchor();
          await loadCommandHistory();
        }
      } catch (err) {
        setClientPageError(setError, err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, loadLocation, loadAnchor, loadCommandHistory]);

  async function runCommand(action) {
    setMessage('');
    setError('');
    setLastCommandFeedback(null);
    setCommandLoading(action);
    try {
      const res = await api.sendVehicleCommand(id, action);
      const feedback = res.data?.command_feedback || null;
      setLastCommandFeedback(feedback);
      setMessage(res.message || feedback?.message || 'Comando enviado.');
      if (action === 'bloquear' || action === 'desbloquear') {
        const vehicleRes = await api.getVehicle(id);
        setVehicle(vehicleRes.data);
      }
      if (action === 'localizar' || action === 'desbloquear') {
        await loadLocation();
      }
      await loadCommandHistory();
    } catch (err) {
      setClientPageError(setError, err);
    } finally {
      setCommandLoading('');
    }
  }

  async function handleAnchorToggle() {
    setMessage('');
    setError('');
    setAnchorLoading(true);
    try {
      if (anchor?.active && anchor?.status === 'monitoring') {
        const res = await api.deactivateVehicleAnchor(id);
        setAnchor(res.data?.ancora || null);
        setMessage(res.message || 'Âncora desativada.');
      } else {
        const res = await api.activateVehicleAnchor(id, 10);
        setAnchor(res.data?.ancora || null);
        setMessage(res.message || 'Âncora ativada.');
      }
    } catch (err) {
      setClientPageError(setError, err);
    } finally {
      setAnchorLoading(false);
    }
  }

  async function handleShare() {
    setMessage('');
    setError('');
    setShareLoading(true);
    try {
      const res = await api.shareVehicleLocation(id, 60);
      const link = res.data?.compartilhamento?.url;
      setShareLink(link || null);
      setMessage(res.message || 'Link gerado.');
    } catch (err) {
      setClientPageError(setError, err);
    } finally {
      setShareLoading(false);
    }
  }

  if (loading) return <p className="muted">Carregando veículo...</p>;
  if (!vehicle) return <div className="alert error">{error || 'Veículo não encontrado.'}</div>;

  const canTrack = vehicle.status === 'active' || vehicle.status === 'blocked';
  const hasCoords = location?.latitude != null && location?.longitude != null;
  const hasDevice = Boolean(vehicle.gpswox_device_id);
  const anchorActive = anchor?.active && anchor?.status === 'monitoring';

  return (
    <div>
      <header className="page-header">
        <Link to="/app/veiculos" className="back-link">← Voltar</Link>
        <div className="page-title-row">
          <h1>{vehicle.label}</h1>
          <HelpButton guideId="client_vehicle_detail" scope="client" label="Ajuda: detalhes do veículo" />
        </div>
        <InlineGuide guideId="client_vehicle_detail" scope="client" />
        <p>
          <span className={`badge ${vehicleStatusBadge(vehicle.status)}`}>
            {vehicleStatusLabel(vehicle.status)}
          </span>
          {location?.ignicao != null && (
            <span className="badge info" style={{ marginLeft: '0.5rem' }}>
              Ignição: {String(location.ignicao)}
            </span>
          )}
          {anchorActive && (
            <span className="badge warning" style={{ marginLeft: '0.5rem' }}>
              Âncora ativa ({anchor.radius_meters || 10}m)
            </span>
          )}
        </p>
      </header>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}
      {lastCommandFeedback && (
        <CommandFeedback feedback={lastCommandFeedback} />
      )}

      <div className="vehicle-detail-grid">
        <div className="form-card vehicle-info-card">
          <h3>Dados do veículo</h3>
          <dl className="detail-list">
            <div><dt>Placa</dt><dd>{vehicle.plate || 'Sem placa'}</dd></div>
            {vehicle.brand && <div><dt>Marca</dt><dd>{vehicle.brand}</dd></div>}
            {vehicle.model && <div><dt>Modelo</dt><dd>{vehicle.model}</dd></div>}
            {vehicle.color && <div><dt>Cor</dt><dd>{vehicle.color}</dd></div>}
            {vehicle.year && <div><dt>Ano</dt><dd>{vehicle.year}</dd></div>}
            {vehicle.gpswox_device_id && (
              <div><dt>Device ID</dt><dd><code>{vehicle.gpswox_device_id}</code></dd></div>
            )}
          </dl>
        </div>

        <div className="map-card">
          <div className="map-card-header">
            <SectionTitleWithHelp title="Localização" guideId="client_vehicle_detail" scope="client" />
            {canTrack && locationMode === 'mapa' && (
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
              <div className="location-mode-tabs">
                {LOCATION_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`btn-secondary btn-sm${locationMode === mode.id ? ' active' : ''}`}
                    onClick={() => setLocationMode(mode.id)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {locationMode === 'mapa' ? (
                <>
                  <VehicleMap
                    latitude={location?.latitude}
                    longitude={location?.longitude}
                    label={vehicle.label}
                    anchor={anchorActive ? anchor : null}
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
              ) : (
                <div className="share-panel">
                  <p className="muted">
                    Gera um link temporário do GPSWOX para compartilhar a localização em tempo real
                    (válido por 60 minutos).
                  </p>
                  <button type="button" onClick={handleShare} disabled={shareLoading || !hasDevice}>
                    {shareLoading ? 'Gerando...' : 'Gerar link GPSWOX'}
                  </button>
                  {shareLink && (
                    <div className="share-link-box">
                      <input type="text" readOnly value={shareLink} />
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => navigator.clipboard.writeText(shareLink)}
                      >
                        Copiar
                      </button>
                      <a href={shareLink} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                        Abrir link
                      </a>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {canTrack && hasDevice && (
        <section className="card vehicle-controls-card">
          <SectionTitleWithHelp title="Comandos do rastreador" guideId="client_vehicle_commands" scope="client" />
          <InlineGuide guideId="client_vehicle_commands" scope="client" />
          <div className="command-grid">
            {vehicle.status !== 'blocked' && (
              <button
                type="button"
                className="btn-danger"
                disabled={Boolean(commandLoading)}
                onClick={() => runCommand('bloquear')}
              >
                {commandLoading === 'bloquear' ? 'Enviando...' : 'Bloquear'}
              </button>
            )}
            {vehicle.status === 'blocked' && (
              <button
                type="button"
                disabled={Boolean(commandLoading)}
                onClick={() => runCommand('desbloquear')}
              >
                {commandLoading === 'desbloquear' ? 'Enviando...' : 'Desbloquear'}
              </button>
            )}
            <button
              type="button"
              className={`btn-secondary${anchorActive ? ' active' : ''}`}
              disabled={Boolean(commandLoading) || anchorLoading || vehicle.status === 'blocked'}
              onClick={handleAnchorToggle}
            >
              {anchorLoading
                ? 'Processando...'
                : anchorActive
                  ? 'Desativar âncora'
                  : 'Âncora'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={Boolean(commandLoading)}
              onClick={() => runCommand('ligar')}
            >
              {commandLoading === 'ligar' ? 'Enviando...' : 'Ligar motor'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={Boolean(commandLoading)}
              onClick={() => runCommand('desligar')}
            >
              {commandLoading === 'desligar' ? 'Enviando...' : 'Desligar motor'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={Boolean(commandLoading)}
              onClick={() => runCommand('localizar')}
            >
              {commandLoading === 'localizar' ? 'Enviando...' : 'Localizar agora'}
            </button>
          </div>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            <HelpButton guideId="client_vehicle_anchor" scope="client" size="sm" label="Ajuda: âncora" />
            {' '}A âncora fixa o veículo em um ponto — toque em ? para entender o bloqueio automático.
          </p>
          {anchorActive && (
            <p className="muted anchor-hint">
              O veículo está em alerta. Se ligar e sair mais de {anchor.radius_meters || 10} metros
              deste ponto sem desativar a âncora, o bloqueio automático será enviado.
            </p>
          )}
        </section>
      )}

      {canTrack && hasDevice && (
        <section className="card vehicle-controls-card">
          <h3>Histórico de comandos</h3>
          <CommandHistoryList items={commandHistory} />
        </section>
      )}

      {canTrack && hasDevice && (
        <section className="card vehicle-history-card">
          <div className="section-header">
            <h3>Histórico de rotas</h3>
            <div className="history-presets">
              {HISTORY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`btn-secondary btn-sm${historyPreset === preset.id ? ' active' : ''}`}
                  onClick={() => setHistoryPreset(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={historyLoading}
                onClick={() => loadHistory()}
              >
                {historyLoading ? 'Carregando...' : 'Carregar'}
              </button>
            </div>
          </div>

          {history?.points?.length > 0 ? (
            <>
              <p className="muted">{history.total} posições · {history.from} até {history.to}</p>
              <VehicleRouteMap points={history.points} label={vehicle.label} />
              <div className="table-card history-table">
                <table>
                  <thead>
                    <tr>
                      <th>Horário</th>
                      <th>Velocidade</th>
                      <th>Endereço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.points.slice(-10).reverse().map((point, index) => (
                      <tr key={`${point.time || index}-${point.latitude}`}>
                        <td>{point.time ? new Date(point.time).toLocaleString('pt-BR') : '—'}</td>
                        <td>{point.speed != null ? `${point.speed} km/h` : '—'}</td>
                        <td>{point.address || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="muted">
              {historyLoading ? 'Buscando histórico no GPSWOX...' : 'Selecione um período e clique em Carregar.'}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
