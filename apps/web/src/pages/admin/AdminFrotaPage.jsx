import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeaderWithHelp, SectionTitleWithHelp } from '../../components/HelpGuide';
import { fleetStatusBadgeClass, fleetStatusLabel } from '../../utils/fleet';

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function fleetChannelLabel(channel) {
  if (channel === 'whatsapp') return 'WhatsApp';
  if (channel === 'sms') return 'SMS';
  if (channel === 'push') return 'Push';
  return channel || '—';
}

function fleetChannelBadge(channel) {
  if (channel === 'whatsapp') return 'info';
  if (channel === 'sms') return 'warning';
  if (channel === 'push') return 'success';
  return '';
}

function vehicleLabel(v) {
  return [v.plate || 'Sem placa', v.user_name || v.user_email].filter(Boolean).join(' — ');
}

const DOC_TYPES = [
  { key: 'crlv', label: 'CRLV' },
  { key: 'seguro', label: 'Seguro' },
  { key: 'ipva', label: 'IPVA' },
  { key: 'licenciamento', label: 'Licenciamento' },
  { key: 'outro', label: 'Outro' },
];

const MAINT_TYPES = [
  { key: 'oleo', label: 'Troca de óleo' },
  { key: 'revisao', label: 'Revisão geral' },
  { key: 'pneus', label: 'Pneus' },
  { key: 'freios', label: 'Freios' },
  { key: 'bateria', label: 'Bateria' },
  { key: 'outro', label: 'Outro' },
];

export default function AdminFrotaPage() {
  const [tab, setTab] = useState('documentos');
  const [documents, setDocuments] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDocForm, setShowDocForm] = useState(false);
  const [showMaintForm, setShowMaintForm] = useState(false);
  const [docForm, setDocForm] = useState({ vehicle_id: '', doc_type: 'crlv', title: '', expiry_date: '', notes: '' });
  const [docFile, setDocFile] = useState(null);
  const [maintForm, setMaintForm] = useState({
    vehicle_id: '', service_type: 'revisao', title: '', performed_at: '', next_due_date: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [reminderStatus, setReminderStatus] = useState(null);
  const [reminderNotifications, setReminderNotifications] = useState([]);
  const [reminderRuns, setReminderRuns] = useState([]);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [runningReminders, setRunningReminders] = useState(false);
  const [expandedReminderId, setExpandedReminderId] = useState(null);

  async function loadReminders() {
    setReminderLoading(true);
    try {
      const res = await api.getAdminFrotaLembretes({ limit: 50 });
      const data = res.data || {};
      setReminderStatus(data.status || null);
      setReminderNotifications(data.notifications || []);
      setReminderRuns(data.runs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setReminderLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const [docsRes, maintRes, vehiclesRes] = await Promise.all([
        api.getAdminFrotaDocuments(),
        api.getAdminFrotaMaintenance(),
        api.getAdminVehicles(),
      ]);
      setDocuments(docsRes.data || []);
      setMaintenance(maintRes.data || []);
      setVehicles(vehiclesRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (tab === 'lembretes') loadReminders();
  }, [tab]);

  async function handleRunReminders() {
    setRunningReminders(true);
    setError('');
    setMessage('');
    try {
      const res = await api.executarAdminFrotaLembretes();
      const data = res.data || {};
      if (data.skipped) {
        const reasonLabels = {
          disabled: 'integração ou lembretes automáticos desativados',
          push_disabled: 'todos os canais desativados',
          channels_disabled: 'nenhum canal de entrega ativo (push, WhatsApp ou SMS)',
          in_progress: 'rodada já em andamento',
        };
        setMessage(`Rodada ignorada: ${reasonLabels[data.reason] || data.reason || 'indisponível'}.`);
      } else {
        setMessage(`Rodada concluída — ${data.reminders_sent ?? 0} push(es) enviado(s), ${data.errors_count ?? 0} erro(s).`);
      }
      await loadReminders();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningReminders(false);
    }
  }

  async function submitDocument(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('doc_type', docForm.doc_type);
      formData.append('title', docForm.title);
      if (docForm.expiry_date) formData.append('expiry_date', docForm.expiry_date);
      if (docForm.notes) formData.append('notes', docForm.notes);
      if (docFile) formData.append('file', docFile);
      await api.createAdminFrotaDocument(docForm.vehicle_id, formData);
      setMessage('Documento cadastrado.');
      setShowDocForm(false);
      setDocFile(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMaintenance(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await api.createAdminFrotaMaintenance(maintForm);
      setMessage('Manutenção registrada.');
      setShowMaintForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;

  return (
    <div>
      <PageHeaderWithHelp
        title="Documentos e Manutenção"
        subtitle="Gestão centralizada de CRLV, seguro e revisões por veículo."
        guideId="admin_frota"
      />

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="tab-row" style={{ marginBottom: '1rem' }}>
        <button type="button" className={tab === 'documentos' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('documentos')}>
          Documentos ({documents.length})
        </button>
        <button type="button" className={tab === 'manutencao' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('manutencao')}>
          Manutenção ({maintenance.length})
        </button>
        <button type="button" className={tab === 'lembretes' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('lembretes')}>
          Lembretes push
        </button>
      </div>

      {tab === 'documentos' && (
        <>
          <div className="section-header">
            <h3>Documentos</h3>
            <button type="button" onClick={() => setShowDocForm((v) => !v)}>
              {showDocForm ? 'Cancelar' : 'Novo documento'}
            </button>
          </div>

          {showDocForm && (
            <form className="form-card" onSubmit={submitDocument}>
              <label>
                Veículo
                <select value={docForm.vehicle_id} onChange={(e) => setDocForm((p) => ({ ...p, vehicle_id: e.target.value }))} required>
                  <option value="">Selecione</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {vehicleLabel(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select value={docForm.doc_type} onChange={(e) => setDocForm((p) => ({ ...p, doc_type: e.target.value }))}>
                  {DOC_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
              <label>
                Título
                <input type="text" value={docForm.title} onChange={(e) => setDocForm((p) => ({ ...p, title: e.target.value }))} required />
              </label>
              <label>
                Vencimento
                <input type="date" value={docForm.expiry_date} onChange={(e) => setDocForm((p) => ({ ...p, expiry_date: e.target.value }))} />
              </label>
              <label>
                Anexo
                <input type="file" accept=".pdf,image/*" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
              </label>
              <button type="submit" disabled={submitting}>Salvar</button>
            </form>
          )}

          <div className="table-card">
            <table>
              <thead>
                <tr><th>Cliente</th><th>Veículo</th><th>Tipo</th><th>Título</th><th>Vencimento</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.user_name || doc.user_email}</td>
                    <td>{doc.plate || 'Sem placa'}</td>
                    <td>{doc.doc_type_label}</td>
                    <td>{doc.title}</td>
                    <td>{doc.expiry_date_br || '—'}</td>
                    <td>
                      <span className={`badge ${fleetStatusBadgeClass(doc.expiry_status)}`}>
                        {fleetStatusLabel(doc.expiry_status)}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => api.deleteAdminFrotaDocument(doc.id).then(load)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'manutencao' && (
        <>
          <div className="section-header">
            <h3>Manutenções</h3>
            <button type="button" onClick={() => setShowMaintForm((v) => !v)}>
              {showMaintForm ? 'Cancelar' : 'Nova manutenção'}
            </button>
          </div>

          {showMaintForm && (
            <form className="form-card" onSubmit={submitMaintenance}>
              <label>
                Veículo
                <select value={maintForm.vehicle_id} onChange={(e) => setMaintForm((p) => ({ ...p, vehicle_id: e.target.value }))} required>
                  <option value="">Selecione</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {vehicleLabel(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select value={maintForm.service_type} onChange={(e) => setMaintForm((p) => ({ ...p, service_type: e.target.value }))}>
                  {MAINT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
              <label>
                Título
                <input type="text" value={maintForm.title} onChange={(e) => setMaintForm((p) => ({ ...p, title: e.target.value }))} required />
              </label>
              <label>
                Data
                <input type="date" value={maintForm.performed_at} onChange={(e) => setMaintForm((p) => ({ ...p, performed_at: e.target.value }))} required />
              </label>
              <label>
                Próxima revisão
                <input type="date" value={maintForm.next_due_date} onChange={(e) => setMaintForm((p) => ({ ...p, next_due_date: e.target.value }))} />
              </label>
              <button type="submit" disabled={submitting}>Salvar</button>
            </form>
          )}

          <div className="table-card">
            <table>
              <thead>
                <tr><th>Cliente</th><th>Veículo</th><th>Serviço</th><th>Realizada</th><th>Próxima</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {maintenance.map((item) => (
                  <tr key={item.id}>
                    <td>{item.user_name || item.user_email}</td>
                    <td>{item.plate || 'Sem placa'}</td>
                    <td>{item.title}</td>
                    <td>{item.performed_at_br}</td>
                    <td>{item.next_due_date_br || '—'}</td>
                    <td>
                      {item.next_due_date ? (
                        <span className={`badge ${fleetStatusBadgeClass(item.due_status)}`}>
                          {fleetStatusLabel(item.due_status)}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => api.deleteAdminFrotaMaintenance(item.id).then(load)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'lembretes' && (
        <>
          <div className="section-header">
            <SectionTitleWithHelp title="Lembretes automáticos (push, WhatsApp e SMS)" guideId="frota" />
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn-secondary" onClick={loadReminders} disabled={reminderLoading}>
                {reminderLoading ? 'Atualizando...' : 'Atualizar'}
              </button>
              <button type="button" onClick={handleRunReminders} disabled={runningReminders}>
                {runningReminders ? 'Executando...' : 'Executar agora'}
              </button>
              <Link to="/admin/integracoes/frota" className="btn-secondary">Configurar integração</Link>
            </div>
          </div>

          {reminderLoading && !reminderStatus ? (
            <p className="muted">Carregando lembretes...</p>
          ) : (
            <>
              <div className="card-grid" style={{ marginBottom: '1rem' }}>
                <section className="card">
                  <h3>Status</h3>
                  <dl className="detail-list">
                    <div><dt>Integração</dt><dd>{reminderStatus?.integration_enabled ? 'Ativa' : 'Inativa'}</dd></div>
                    <div><dt>Lembretes automáticos</dt><dd>{reminderStatus?.auto_reminders_enabled ? 'Sim' : 'Não'}</dd></div>
                    <div><dt>Push Firebase</dt><dd>{reminderStatus?.reminder_push_enabled ? 'Sim' : 'Não'}</dd></div>
                    <div><dt>WhatsApp</dt><dd>{reminderStatus?.reminder_whatsapp_enabled ? 'Sim' : 'Não'}</dd></div>
                    <div><dt>SMS</dt><dd>{reminderStatus?.reminder_sms_enabled ? 'Sim (fallback ou exclusivo)' : 'Não'}</dd></div>
                    <div><dt>Intervalo</dt><dd>{reminderStatus?.reminder_check_interval_hours ?? '—'} h</dd></div>
                    <div><dt>Antecedência</dt><dd>{reminderStatus?.warning_days ?? '—'} dias</dd></div>
                  </dl>
                </section>

                <section className="card">
                  <h3>Última rodada</h3>
                  {reminderStatus?.last_run ? (
                    <dl className="detail-list">
                      <div><dt>Início</dt><dd>{formatDateTime(reminderStatus.last_run.started_at)}</dd></div>
                      <div><dt>Fim</dt><dd>{formatDateTime(reminderStatus.last_run.finished_at)}</dd></div>
                      <div><dt>Enviados</dt><dd>{reminderStatus.last_run.reminders_sent ?? 0}</dd></div>
                      <div><dt>Erros</dt><dd>{reminderStatus.last_run.errors_count ?? 0}</dd></div>
                    </dl>
                  ) : (
                    <p className="muted">Nenhuma rodada registrada nesta sessão do servidor.</p>
                  )}
                </section>
              </div>

              {reminderRuns.length > 0 && (
                <>
                  <h3>Rodadas recentes</h3>
                  <div className="table-card" style={{ marginBottom: '1.5rem' }}>
                    <table>
                      <thead>
                        <tr><th>Início</th><th>Fim</th><th>Enviados</th><th>Erros</th></tr>
                      </thead>
                      <tbody>
                        {reminderRuns.map((run) => (
                          <tr key={run.id}>
                            <td><small>{formatDateTime(run.started_at)}</small></td>
                            <td><small>{formatDateTime(run.finished_at)}</small></td>
                            <td>{run.reminders_sent ?? 0}</td>
                            <td>
                              <span className={`badge ${run.errors_count > 0 ? 'error' : 'success'}`}>
                                {run.errors_count ?? 0}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <h3>Histórico por cliente e canal</h3>
              <div className="table-card">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Cliente</th>
                      <th>Canal</th>
                      <th>Docs</th>
                      <th>Manutenção</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {reminderNotifications.length === 0 ? (
                      <tr><td colSpan={7} className="muted">Nenhum lembrete registrado ainda.</td></tr>
                    ) : (
                      reminderNotifications.map((item) => (
                        <Fragment key={item.id}>
                          <tr>
                            <td><small>{formatDateTime(item.created_at)}</small></td>
                            <td>
                              {item.user_name || item.user_email}
                              {item.user_id ? (
                                <div><Link to={`/admin/clientes/${item.user_id}`}>Ficha #{item.user_id}</Link></div>
                              ) : null}
                            </td>
                            <td>
                              <span className={`badge ${fleetChannelBadge(item.channel)}`}>
                                {fleetChannelLabel(item.channel)}
                              </span>
                              {item.used_fallback && (
                                <small className="muted" style={{ display: 'block' }}>via SMS (fallback)</small>
                              )}
                              {item.phone && (
                                <small className="muted" style={{ display: 'block' }}>{item.phone}</small>
                              )}
                            </td>
                            <td>{item.documents_count ?? 0}</td>
                            <td>{item.maintenance_count ?? 0}</td>
                            <td>
                              <span className={`badge ${item.status === 'failed' ? 'error' : 'success'}`}>
                                {item.status}
                              </span>
                              {item.error_message && item.status === 'failed' && (
                                <small className="muted" style={{ display: 'block' }}>{item.error_message}</small>
                              )}
                            </td>
                            <td>
                              {item.items_snapshot?.length ? (
                                <button
                                  type="button"
                                  className="btn-ghost btn-sm"
                                  onClick={() => setExpandedReminderId(expandedReminderId === item.id ? null : item.id)}
                                >
                                  {expandedReminderId === item.id ? 'Ocultar' : 'Itens'}
                                </button>
                              ) : null}
                            </td>
                          </tr>
                          {expandedReminderId === item.id && (
                            <tr>
                              <td colSpan={7}>
                                <ul className="muted" style={{ margin: 0, paddingLeft: '1.25rem' }}>
                                  {(item.items_snapshot || []).map((entry) => (
                                    <li key={`${entry.kind}-${entry.id}`}>
                                      {entry.kind === 'document' ? 'Doc' : 'Manut.'}: {entry.title}
                                      {entry.plate ? ` (${entry.plate})` : ''}
                                      {entry.date ? ` — ${entry.date}` : ''}
                                      {entry.status ? ` · ${entry.status}` : ''}
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
