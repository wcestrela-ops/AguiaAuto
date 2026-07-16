import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeaderWithHelp, SectionTitleWithHelp } from '../../components/HelpGuide';

const CHANNEL_LABELS = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
};

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function formatChannels(channels) {
  if (!Array.isArray(channels) || channels.length === 0) return '—';
  return channels.map((item) => {
    const label = CHANNEL_LABELS[item.channel] || item.channel;
    const status = item.status === 'sent' ? '✓' : '✗';
    return `${label} ${status}`;
  }).join(' · ');
}

function channelBadgeClass(status) {
  return status === 'sent' ? 'success' : 'error';
}

export default function AdminEmergenciaPage() {
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, eventsRes] = await Promise.all([
        api.getAdminEmergencySummary(),
        api.getAdminEmergencyEvents(50),
      ]);
      setSummary(summaryRes.data);
      setEvents(eventsRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeaderWithHelp
        title="Emergência (SOS)"
        subtitle="Acionamentos do botão de pânico — central, contatos e localização"
        guideId="admin_emergencia"
      >
        <Link
          to="/admin/integracoes/emergencia"
          className="btn-secondary"
          style={{ padding: '0.625rem 1rem', borderRadius: '8px' }}
        >
          Configurar integração
        </Link>
      </PageHeaderWithHelp>

      {error && <div className="alert error">{error}</div>}

      {summary && (
        <div className="card-grid client-summary-grid">
          <div className="card emergency-summary-card">
            <h3>SOS nas últimas 24h</h3>
            <p className="client-summary-value">{summary.count_24h}</p>
          </div>
          <div className="card">
            <h3>Histórico carregado</h3>
            <p className="client-summary-value">{events.length}</p>
            <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.875rem' }}>
              Últimos 50 acionamentos
            </p>
          </div>
        </div>
      )}

      {summary?.recent?.length > 0 && (
        <div className="form-card emergency-recent-strip">
          <SectionTitleWithHelp title="Últimos acionamentos (24h)" guideId="admin_emergencia" />
          <div className="emergency-recent-list">
            {summary.recent.map((event) => (
              <div key={event.id} className="emergency-recent-item">
                <strong>{formatDateTime(event.created_at)}</strong>
                <span>{event.user_name || event.user_email}</span>
                {event.plate && <span className="badge warning">{event.plate}</span>}
                <span className="muted">{event.notified_count} contato(s)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="table-card">
        <SectionTitleWithHelp title="Histórico completo" guideId="admin_emergencia" />
        {loading ? (
          <p className="muted" style={{ padding: '1rem' }}>Carregando...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Veículo</th>
                <th>Localização</th>
                <th>Mensagem</th>
                <th>Notificados</th>
                <th>Canais</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={8} className="muted">Nenhum acionamento registrado.</td></tr>
              ) : (
                events.map((event) => {
                  const mapsLink = event.latitude != null && event.longitude != null
                    ? `https://maps.google.com/?q=${event.latitude},${event.longitude}`
                    : null;

                  return (
                    <Fragment key={event.id}>
                      <tr className={summary?.count_24h > 0 && isWithin24h(event.created_at) ? 'emergency-row-recent' : undefined}>
                        <td>{formatDateTime(event.created_at)}</td>
                        <td>
                          <strong>{event.user_name || '—'}</strong>
                          <div className="muted audit-actor-id">{event.user_email}</div>
                          {event.user_phone && (
                            <div className="muted audit-actor-id">{event.user_phone}</div>
                          )}
                          <Link to={`/admin/clientes/${event.user_id}`} className="btn-ghost btn-sm" style={{ marginTop: '0.35rem' }}>
                            Ficha
                          </Link>
                        </td>
                        <td>
                          {event.vehicle_label || event.plate || '—'}
                        </td>
                        <td>
                          {event.address && <div>{event.address}</div>}
                          {event.latitude != null && (
                            <div className="muted audit-actor-id">
                              {Number(event.latitude).toFixed(5)}, {Number(event.longitude).toFixed(5)}
                            </div>
                          )}
                          {mapsLink && (
                            <a href={mapsLink} target="_blank" rel="noreferrer" className="btn-ghost btn-sm" style={{ marginTop: '0.35rem' }}>
                              Abrir mapa
                            </a>
                          )}
                          {!event.address && !mapsLink && '—'}
                        </td>
                        <td>{event.message || '—'}</td>
                        <td><span className="badge info">{event.notified_count}</span></td>
                        <td>{formatChannels(event.channels)}</td>
                        <td>
                          {event.channels?.length > 0 && (
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                            >
                              {expandedId === event.id ? 'Ocultar' : 'Detalhes'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedId === event.id && (
                        <tr className="audit-meta-row">
                          <td colSpan={8}>
                            <div className="emergency-channel-details">
                              {(event.channels || []).map((channel, index) => (
                                <div key={`${event.id}-${index}`} className="emergency-channel-item">
                                  <span className={`badge ${channelBadgeClass(channel.status)}`}>
                                    {CHANNEL_LABELS[channel.channel] || channel.channel}
                                  </span>
                                  <span>{channel.phone || '—'}</span>
                                  <span className="muted">{channel.status}</span>
                                  {channel.error && <span className="muted">{channel.error}</span>}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function isWithin24h(value) {
  if (!value) return false;
  const date = new Date(value);
  return Date.now() - date.getTime() < 24 * 60 * 60 * 1000;
}
