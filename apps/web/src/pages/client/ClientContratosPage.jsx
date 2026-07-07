import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import AuthenticatedImage from '../../components/AuthenticatedImage';

function formatDuration(minutes) {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

function DeliveryCard({ delivery, termoHtml, onAccept, acceptingId }) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <section className="card contract-delivery-card">
      <header className="section-header">
        <div>
          <h3>{delivery.vehicle_label}</h3>
          <p className="muted">Placa {delivery.plate} · Instalador: {delivery.installer_name || '—'}</p>
        </div>
        {delivery.pending_acceptance ? (
          <span className="badge warning">Aguardando aceite</span>
        ) : (
          <span className="badge success">Aceito</span>
        )}
      </header>

      <dl className="detail-list">
        <div><dt>Duração</dt><dd>{formatDuration(delivery.duration_minutes)}</dd></div>
        <div><dt>Device ID</dt><dd>{delivery.gpswox_device_id}</dd></div>
        <div><dt>Data</dt><dd>{new Date(delivery.finished_at || delivery.created_at).toLocaleString('pt-BR')}</dd></div>
      </dl>

      {delivery.report && (
        <div className="report-box">
          <h4>Relatório do instalador</h4>
          <p>{delivery.report}</p>
        </div>
      )}

      {delivery.notes && (
        <p className="muted"><strong>Observações:</strong> {delivery.notes}</p>
      )}

      {delivery.photos?.length > 0 && (
        <div className="photo-grid">
          {delivery.photos.map((photo) => (
            <AuthenticatedImage
              key={photo.id}
              photoId={photo.id}
              alt={photo.original_filename || 'Foto da instalação'}
              className="installation-photo"
            />
          ))}
        </div>
      )}

      {delivery.pending_acceptance ? (
        <>
          <div
            className="contract-body"
            dangerouslySetInnerHTML={{ __html: termoHtml }}
          />
          <label className="checkbox-row acceptance-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Declaro que verifiquei o relatório e aceito que meu veículo deixou a instalação
            com o rastreador em funcionamento normal.
          </label>
          <button
            type="button"
            disabled={!confirmed || acceptingId === delivery.id}
            onClick={() => onAccept(delivery.id)}
          >
            {acceptingId === delivery.id ? 'Registrando...' : 'Aceitar termo de entrega'}
          </button>
        </>
      ) : (
        <p className="muted accepted-at">
          Aceito em {new Date(delivery.accepted.accepted_at).toLocaleString('pt-BR')}
        </p>
      )}
    </section>
  );
}

export default function ClientContratosPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [serviceConfirmed, setServiceConfirmed] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [acceptingService, setAcceptingService] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.getContratos();
      setData(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAcceptService() {
    setMessage('');
    setError('');
    setAcceptingService(true);
    try {
      const res = await api.acceptServiceContract();
      setMessage(res.message || 'Contrato aceito.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAcceptingService(false);
    }
  }

  async function handleAcceptDelivery(installationLogId) {
    setMessage('');
    setError('');
    setAcceptingId(installationLogId);
    try {
      const res = await api.acceptInstallationDelivery(installationLogId);
      setMessage(res.message || 'Termo aceito.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAcceptingId(null);
    }
  }

  if (loading) return <p className="muted">Carregando contratos...</p>;

  return (
    <div>
      <header className="page-header">
        <h1>Contratos</h1>
        <p>Contrato de serviço e termos de entrega das instalações.</p>
      </header>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {data?.contrato_servico && (
        <section className="card contract-service-card">
          <header className="section-header">
            <h2>{data.contrato_servico.title}</h2>
            {data.contrato_servico.accepted ? (
              <span className="badge success">Aceito</span>
            ) : (
              <span className="badge warning">Pendente</span>
            )}
          </header>

          <div
            className="contract-body"
            dangerouslySetInnerHTML={{ __html: data.contrato_servico.body_html }}
          />

          {!data.contrato_servico.accepted ? (
            <>
              <label className="checkbox-row acceptance-check">
                <input
                  type="checkbox"
                  checked={serviceConfirmed}
                  onChange={(e) => setServiceConfirmed(e.target.checked)}
                />
                Li e aceito o Contrato de Prestação de Serviços.
              </label>
              <button
                type="button"
                disabled={!serviceConfirmed || acceptingService}
                onClick={handleAcceptService}
              >
                {acceptingService ? 'Registrando...' : 'Aceitar contrato'}
              </button>
            </>
          ) : (
            <p className="muted accepted-at">
              Aceito em {new Date(data.contrato_servico.accepted_at).toLocaleString('pt-BR')}
            </p>
          )}
        </section>
      )}

      {data?.entregas_pendentes?.length > 0 && (
        <section className="dashboard-section">
          <h2>Termos de entrega pendentes</h2>
          {data.entregas_pendentes.map((delivery) => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              termoHtml={data.termo_entrega?.body_html || ''}
              onAccept={handleAcceptDelivery}
              acceptingId={acceptingId}
            />
          ))}
        </section>
      )}

      {data?.entregas_aceitas?.length > 0 && (
        <section className="dashboard-section">
          <h2>Instalações aceitas</h2>
          {data.entregas_aceitas.map((delivery) => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              termoHtml={data.termo_entrega?.body_html || ''}
              onAccept={handleAcceptDelivery}
              acceptingId={acceptingId}
            />
          ))}
        </section>
      )}

      {data?.entregas_pendentes?.length === 0
        && data?.entregas_aceitas?.length === 0
        && data?.contrato_servico?.accepted && (
        <div className="card">
          <p className="muted">Nenhum termo de entrega pendente no momento.</p>
        </div>
      )}
    </div>
  );
}
