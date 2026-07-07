import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../../api/client';
import AuthenticatedImage from '../../components/AuthenticatedImage';

function formatDuration(minutes) {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

function InstallationPreview({ delivery }) {
  return (
    <div className="installation-preview-block">
      <h4>{delivery.vehicle_label}</h4>
      <dl className="detail-list compact">
        <div><dt>Placa</dt><dd>{delivery.plate}</dd></div>
        <div><dt>Instalador</dt><dd>{delivery.installer_name || '—'}</dd></div>
        <div><dt>Device ID</dt><dd>{delivery.gpswox_device_id}</dd></div>
        <div><dt>Duração</dt><dd>{formatDuration(delivery.duration_minutes)}</dd></div>
        <div><dt>Data</dt><dd>{new Date(delivery.finished_at || delivery.created_at).toLocaleString('pt-BR')}</dd></div>
      </dl>
      {delivery.report && (
        <div className="report-box">
          <strong>Relatório:</strong>
          <p>{delivery.report}</p>
        </div>
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
    </div>
  );
}

function AcceptedDeliveryCard({ delivery, onDownload }) {
  return (
    <section className="card contract-delivery-card">
      <header className="section-header">
        <div>
          <h3>{delivery.vehicle_label}</h3>
          <p className="muted">Aceito em {new Date(delivery.accepted.accepted_at).toLocaleString('pt-BR')}</p>
        </div>
        <span className="badge success">Aceito</span>
      </header>
      <InstallationPreview delivery={delivery} />
      <button type="button" className="btn-secondary btn-sm" onClick={() => onDownload(delivery.id)}>
        Baixar cópia da instalação
      </button>
    </section>
  );
}

export default function ClientContratosPage() {
  const navigate = useNavigate();
  const outlet = useOutletContext() || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [serviceConfirmed, setServiceConfirmed] = useState(false);
  const [acceptingService, setAcceptingService] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.getContratos();
      setData(res.data);
      const accepted = Boolean(res.data?.contrato_servico?.accepted);
      api.setServiceContractAccepted(accepted);
      outlet.setServiceAccepted?.(accepted);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAcceptUnified() {
    setMessage('');
    setError('');
    setAcceptingService(true);
    try {
      const res = await api.acceptServiceContract();
      const unified = res.data?.unified || res.data?.deliveries_accepted?.length > 0;
      setMessage(
        unified
          ? 'Contrato e dados de instalação aceitos. Sua cópia está disponível para download.'
          : (res.message || 'Contrato aceito.')
      );
      api.setServiceContractAccepted(true);
      outlet.setServiceAccepted?.(true);
      await load();
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setAcceptingService(false);
    }
  }

  async function handleDownloadService() {
    try {
      await api.downloadContractDocument('servico');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDownloadDelivery(installationLogId) {
    try {
      await api.downloadContractDocument('entrega', installationLogId);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Carregando contratos...</p>;

  const pendingInstallations = data?.instalacoes_incluidas || data?.entregas_pendentes || [];
  const hasUnified = pendingInstallations.length > 0;

  return (
    <div>
      <header className="page-header">
        <h1>Contratos</h1>
        <p>Contrato de serviço com dados de instalação. Baixe sua cópia a qualquer momento.</p>
      </header>

      {data?.contrato_servico && !data.contrato_servico.accepted && (
        <div className="alert warning contract-block-banner">
          Para usar o aplicativo, leia e aceite o contrato abaixo
          {hasUnified ? ' (inclui os dados de instalação do seu veículo).' : '.'}
        </div>
      )}

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

          {hasUnified && !data.contrato_servico.accepted && (
            <section className="installation-bundle">
              <h3>Dados de instalação incluídos neste aceite</h3>
              {pendingInstallations.map((delivery) => (
                <InstallationPreview key={delivery.id} delivery={delivery} />
              ))}
              {data.termo_entrega?.body_html && (
                <div
                  className="contract-body"
                  dangerouslySetInnerHTML={{ __html: data.termo_entrega.body_html }}
                />
              )}
            </section>
          )}

          {!data.contrato_servico.accepted ? (
            <>
              <label className="checkbox-row acceptance-check">
                <input
                  type="checkbox"
                  checked={serviceConfirmed}
                  onChange={(e) => setServiceConfirmed(e.target.checked)}
                />
                {hasUnified
                  ? 'Li e aceito o Contrato de Prestação de Serviços e os dados de instalação acima, declarando que o rastreador está em funcionamento normal.'
                  : 'Li e aceito o Contrato de Prestação de Serviços.'}
              </label>
              <button
                type="button"
                disabled={!serviceConfirmed || acceptingService}
                onClick={handleAcceptUnified}
              >
                {acceptingService
                  ? 'Registrando...'
                  : hasUnified
                    ? 'Aceitar contrato e instalação'
                    : 'Aceitar contrato'}
              </button>
            </>
          ) : (
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <p className="muted accepted-at">
                Aceito em {new Date(data.contrato_servico.accepted_at).toLocaleString('pt-BR')}
              </p>
              <button type="button" className="btn-secondary btn-sm" onClick={handleDownloadService}>
                Baixar cópia do contrato
              </button>
            </div>
          )}
        </section>
      )}

      {data?.entregas_aceitas?.length > 0 && (
        <section className="dashboard-section">
          <h2>Instalações aceitas</h2>
          {data.entregas_aceitas.map((delivery) => (
            <AcceptedDeliveryCard
              key={delivery.id}
              delivery={delivery}
              onDownload={handleDownloadDelivery}
            />
          ))}
        </section>
      )}

      {data?.contrato_servico?.accepted
        && pendingInstallations.length > 0 && (
        <section className="card">
          <h3>Nova instalação pendente de aceite</h3>
          <p className="muted">Novos veículos instalados após seu cadastro.</p>
          {pendingInstallations.map((delivery) => (
            <InstallationPreview key={delivery.id} delivery={delivery} />
          ))}
          <button type="button" disabled={acceptingService} onClick={handleAcceptUnified}>
            {acceptingService ? 'Registrando...' : 'Aceitar dados de instalação'}
          </button>
        </section>
      )}
    </div>
  );
}
