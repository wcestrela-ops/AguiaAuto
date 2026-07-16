import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import FieldInput from '../../components/FieldInput';

const PROVIDER_LABELS = {
  fake: 'Simulado (dev)',
  android: 'Gateway Android',
  http_gateway: 'Gateway HTTP GPSWOX',
  smsmarket: 'SMSMarket',
};

const EMPTY_COMMAND = {
  action_key: '',
  label: '',
  sms_template: '',
  gpswox_command: '',
  sort_order: 0,
};

export default function SmsPage() {
  const [data, setData] = useState({ providers: [], primary: null, backup: null });
  const [types, setTypes] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ provider: 'fake', enabled: true, name: 'Gateway SMS' });
  const [sendForm, setSendForm] = useState({ to: '', message: '', model_id: '', action_key: '' });
  const [newModel, setNewModel] = useState({ name: '', manufacturer: '', protocol: '' });
  const [expandedModel, setExpandedModel] = useState(null);
  const [newCommand, setNewCommand] = useState(EMPTY_COMMAND);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [gpswoxGateway, setGpswoxGateway] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [providersRes, typesRes, dispatchesRes, modelsRes, gpswoxRes] = await Promise.all([
        api.getSmsProviders(),
        api.getSmsTypes(),
        api.getSmsDispatches({ limit: 20 }),
        api.getTrackerModels(),
        api.getSmsGpswoxGatewayInfo().catch(() => ({ data: null })),
      ]);
      setData(providersRes.data);
      setTypes(typesRes.data);
      setDispatches(dispatchesRes.data || []);
      setModels(modelsRes.data || []);
      setGpswoxGateway(gpswoxRes.data || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const selectedType = types.find((t) => t.type === form.provider);
  const selectedModel = models.find((m) => String(m.id) === sendForm.model_id);
  const selectedCommand = selectedModel?.commands?.find((c) => c.action_key === sendForm.action_key);

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreateGateway(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.createSmsProvider(form);
      setMessage('Gateway SMS cadastrado.');
      setShowForm(false);
      setForm({ provider: 'fake', enabled: true, name: 'Gateway SMS' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSendSms(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const payload = {
        to: sendForm.to.trim(),
        vehicle_id: sendForm.vehicle_id || undefined,
      };

      if (sendForm.model_id && sendForm.action_key) {
        payload.model_id = Number(sendForm.model_id);
        payload.action_key = sendForm.action_key;
        if (sendForm.message.trim()) payload.message = sendForm.message.trim();
        await api.sendSmsCommand(payload);
      } else {
        payload.message = sendForm.message.trim();
        await api.sendSmsManual(payload);
      }

      setMessage('SMS enviado.');
      setSendForm({ to: '', message: '', model_id: '', action_key: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateModel(e) {
    e.preventDefault();
    if (!newModel.name.trim()) return;
    try {
      await api.createTrackerModel(newModel);
      setNewModel({ name: '', manufacturer: '', protocol: '' });
      setMessage('Modelo de rastreador criado.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveCommand(modelId) {
    if (!newCommand.action_key || !newCommand.label || !newCommand.sms_template) {
      setError('Preencha action_key, label e sms_template.');
      return;
    }
    try {
      await api.createTrackerCommand(modelId, newCommand);
      setNewCommand(EMPTY_COMMAND);
      setMessage('Comando adicionado.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdateCommand(modelId, cmd) {
    try {
      await api.updateTrackerCommand(modelId, cmd.id, {
        label: cmd.label,
        sms_template: cmd.sms_template,
        gpswox_command: cmd.gpswox_command,
        sort_order: cmd.sort_order,
      });
      setMessage('Comando atualizado.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAction(action, id) {
    setError('');
    setMessage('');
    try {
      if (action === 'primary') await api.setSmsPrimary(id);
      if (action === 'backup') await api.setSmsBackup(id);
      if (action === 'test') {
        const res = await api.testSms(id);
        setMessage(res.data?.message || 'Teste OK.');
      }
      if (action === 'delete') {
        if (!confirm('Remover este gateway?')) return;
        await api.deleteSms(id);
        setMessage('Gateway removido.');
      }
      if (action !== 'test') load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;

  return (
    <div>
      <header className="page-header row">
        <div>
          <h1>SMS Rastreador</h1>
          <p>
            Gateway Android (celular com chip), biblioteca de comandos por modelo e envio manual.
          </p>
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Novo Gateway'}
        </button>
      </header>

      <div className="info-box">
        <strong>Gateway Android:</strong> instale o agente no smartphone com chip SMS, informe URL + chave + device_id.
        {' '}Principal: {data.primary ? PROVIDER_LABELS[data.primary.provider] || data.primary.name : '—'}
        {' · '}Backup: {data.backup ? PROVIDER_LABELS[data.backup.provider] || data.backup.name : '—'}
      </div>

      {gpswoxGateway && (
        <div className="form-card" style={{ marginTop: '1rem' }}>
          <h3>Gateway SMS GPSWOX (entrada HTTP)</h3>
          <p className="muted">
            Cole esta URL no painel GPSWOX (Configurações → Gateway SMS/WhatsApp).
            Variáveis: <code>%NUMBER%</code>, <code>%MESSAGE%</code>.
            Credenciais em <strong>Integrações → Gateway SMS GPSWOX (entrada)</strong>.
          </p>
          <label>
            URL para o GPSWOX
            <input
              type="text"
              readOnly
              value={gpswoxGateway.example_url || ''}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <p className="muted">
            <small>{gpswoxGateway.gpswox_help}</small>
          </p>
        </div>
      )}

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <form className="form-card" onSubmit={handleSendSms}>
        <h3>Enviar SMS</h3>
        <label>
          Número do chip / telefone
          <input
            value={sendForm.to}
            onChange={(e) => setSendForm((p) => ({ ...p, to: e.target.value }))}
            placeholder="5511999999999"
            required
          />
        </label>
        <label>
          Modelo do rastreador (opcional — preenche comando)
          <select
            value={sendForm.model_id}
            onChange={(e) => setSendForm((p) => ({ ...p, model_id: e.target.value, action_key: '' }))}
          >
            <option value="">Texto livre</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        {sendForm.model_id && (
          <label>
            Comando da biblioteca
            <select
              value={sendForm.action_key}
              onChange={(e) => {
                const key = e.target.value;
                const cmd = selectedModel?.commands?.find((c) => c.action_key === key);
                setSendForm((p) => ({
                  ...p,
                  action_key: key,
                  message: cmd?.sms_template || p.message,
                }));
              }}
            >
              <option value="">Selecione...</option>
              {(selectedModel?.commands || []).map((c) => (
                <option key={c.id} value={c.action_key}>{c.label} ({c.sms_template})</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Mensagem SMS
          <textarea
            rows={3}
            value={sendForm.message}
            onChange={(e) => setSendForm((p) => ({ ...p, message: e.target.value }))}
            placeholder={selectedCommand ? selectedCommand.sms_template : 'RELAY,0# ou texto livre'}
            required={!sendForm.action_key}
          />
        </label>
        <button type="submit">Enviar SMS</button>
      </form>

      <div className="form-card" style={{ marginTop: '1.5rem' }}>
        <h3>Modelos de rastreador e comandos</h3>
        <p className="muted">
          Cadastre cada modelo (GT06, Joker, etc.) com comandos SMS editáveis. Veículos usam o modelo vinculado em Veículos.
        </p>

        <form className="row" onSubmit={handleCreateModel} style={{ gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <input placeholder="Nome do modelo" value={newModel.name} onChange={(e) => setNewModel((p) => ({ ...p, name: e.target.value }))} required />
          <input placeholder="Fabricante" value={newModel.manufacturer} onChange={(e) => setNewModel((p) => ({ ...p, manufacturer: e.target.value }))} />
          <input placeholder="Protocolo (GT06...)" value={newModel.protocol} onChange={(e) => setNewModel((p) => ({ ...p, protocol: e.target.value }))} />
          <button type="submit">+ Modelo</button>
        </form>

        {models.map((model) => (
          <div key={model.id} className="table-card" style={{ marginBottom: '1rem' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{model.name}</strong>
                {model.protocol && <small> · {model.protocol}</small>}
                <br /><small className="muted">{model.command_count || model.commands?.length || 0} comandos</small>
              </div>
              <button type="button" className="btn-sm" onClick={() => setExpandedModel(expandedModel === model.id ? null : model.id)}>
                {expandedModel === model.id ? 'Fechar' : 'Editar comandos'}
              </button>
            </div>

            {expandedModel === model.id && (
              <div style={{ marginTop: '1rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Ação</th>
                      <th>Label</th>
                      <th>SMS</th>
                      <th>GPSWOX</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(model.commands || []).map((cmd) => (
                      <tr key={cmd.id}>
                        <td><code>{cmd.action_key}</code></td>
                        <td>
                          <input
                            value={cmd.label}
                            onChange={(e) => {
                              cmd.label = e.target.value;
                              setModels([...models]);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            value={cmd.sms_template}
                            onChange={(e) => {
                              cmd.sms_template = e.target.value;
                              setModels([...models]);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            value={cmd.gpswox_command || ''}
                            onChange={(e) => {
                              cmd.gpswox_command = e.target.value;
                              setModels([...models]);
                            }}
                          />
                        </td>
                        <td>
                          <button type="button" className="btn-sm" onClick={() => handleUpdateCommand(model.id, cmd)}>Salvar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                  <input placeholder="action_key (ex: bloquear)" value={newCommand.action_key} onChange={(e) => setNewCommand((p) => ({ ...p, action_key: e.target.value }))} />
                  <input placeholder="Label" value={newCommand.label} onChange={(e) => setNewCommand((p) => ({ ...p, label: e.target.value }))} />
                  <input placeholder="SMS (RELAY,1#)" value={newCommand.sms_template} onChange={(e) => setNewCommand((p) => ({ ...p, sms_template: e.target.value }))} />
                  <input placeholder="GPSWOX cmd" value={newCommand.gpswox_command} onChange={(e) => setNewCommand((p) => ({ ...p, gpswox_command: e.target.value }))} />
                  <button type="button" className="btn-sm" onClick={() => handleSaveCommand(model.id)}>+ Comando</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleCreateGateway}>
          <h3>Novo Gateway SMS</h3>
          {form.provider === 'android' && (
            <div className="info-box">
              <strong>Gateway Android:</strong> use um smartphone com chip SMS e agente HTTP instalado.
              O aparelho envia os SMS pelo chip dele. Campos: URL do agente, chave API e ID do dispositivo.
            </div>
          )}
          {form.provider === 'http_gateway' && (
            <div className="info-box">
              <strong>Gateway HTTP GPSWOX (saída):</strong> Águia chama um gateway externo no padrão GPSWOX.
              Exemplo de URL template:
              {' '}
              <code>http://host/sendsms.php?username=USER&amp;password=PASSWORD&amp;number=%NUMBER%&amp;message=%MESSAGE%</code>
              {' '}Substitua USER/PASSWORD pelos campos Usuário e Senha abaixo.
            </div>
          )}
          <label>
            Nome
            <input type="text" value={form.name || ''} onChange={(e) => updateForm('name', e.target.value)} />
          </label>
          <label>
            Tipo
            <select value={form.provider} onChange={(e) => updateForm('provider', e.target.value)}>
              {types.map((t) => (
                <option key={t.type} value={t.type}>{t.label}</option>
              ))}
            </select>
          </label>
          {selectedType?.fields.map((field) => (
            <FieldInput key={field.key} field={field} value={form[field.key] ?? ''} onChange={(v) => updateForm(field.key, v)} />
          ))}
          <button type="submit">Cadastrar gateway</button>
        </form>
      )}

      <div className="table-card" style={{ marginTop: '1.5rem' }}>
        <h3>Gateways configurados</h3>
        <table>
          <thead>
            <tr><th>Gateway</th><th>Status</th><th>Papel</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {data.providers.length === 0 && (
              <tr><td colSpan={4} className="muted">Nenhum gateway cadastrado.</td></tr>
            )}
            {data.providers.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name || PROVIDER_LABELS[p.provider] || p.provider}</strong>
                  <br /><small>{p.url_template || p.base_url || p.device_id || '—'}</small>
                </td>
                <td>
                  <span className={`badge ${p.status === 'connected' ? 'success' : p.status === 'error' ? 'error' : 'warning'}`}>
                    {p.status || 'unknown'}
                  </span>
                </td>
                <td>
                  {p.is_primary && <span className="badge info">Principal</span>}
                  {p.is_backup && <span className="badge info">Backup</span>}
                </td>
                <td className="actions">
                  {!p.is_primary && <button type="button" className="btn-sm" onClick={() => handleAction('primary', p.id)}>Principal</button>}
                  {!p.is_backup && <button type="button" className="btn-sm" onClick={() => handleAction('backup', p.id)}>Backup</button>}
                  <button type="button" className="btn-sm" onClick={() => handleAction('test', p.id)}>Testar</button>
                  <button type="button" className="btn-sm btn-danger" onClick={() => handleAction('delete', p.id)}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-card" style={{ marginTop: '1.5rem' }}>
        <h3>Últimos envios</h3>
        <table>
          <thead>
            <tr><th>Data</th><th>Telefone</th><th>Ação</th><th>Status</th></tr>
          </thead>
          <tbody>
            {dispatches.map((d) => (
              <tr key={d.id}>
                <td><small>{new Date(d.created_at).toLocaleString('pt-BR')}</small></td>
                <td>{d.phone}</td>
                <td>{d.action || d.source}</td>
                <td><span className="badge">{d.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
