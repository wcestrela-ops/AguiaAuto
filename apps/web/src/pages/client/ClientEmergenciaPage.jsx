import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeaderWithHelp, SectionTitleWithHelp } from '../../components/HelpGuide';

const EMPTY_CONTACT = { name: '', phone: '' };

export default function ClientEmergenciaPage() {
  const [data, setData] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [message, setMessage] = useState('');
  const [contacts, setContacts] = useState([{ ...EMPTY_CONTACT }]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [savingContacts, setSavingContacts] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [emergencyRes, vehiclesRes] = await Promise.all([
        api.getEmergencyContacts(),
        api.getVehicles(),
      ]);
      setData(emergencyRes.data);
      setVehicles(vehiclesRes.data || []);
      const personal = emergencyRes.data?.contatos_pessoais || [];
      setContacts(personal.length ? personal : [{ ...EMPTY_CONTACT }]);
      if ((vehiclesRes.data || []).length === 1) {
        setVehicleId(String(vehiclesRes.data[0].id));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function updateContact(index, key, value) {
    setContacts((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  function addContactRow() {
    if (contacts.length >= 5) return;
    setContacts((prev) => [...prev, { ...EMPTY_CONTACT }]);
  }

  function removeContactRow(index) {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveContacts(e) {
    e.preventDefault();
    setSavingContacts(true);
    setError('');
    setFeedback('');
    try {
      const res = await api.saveEmergencyContacts(contacts.filter((c) => c.name && c.phone));
      setContacts(res.data?.contatos_pessoais?.length ? res.data.contatos_pessoais : [{ ...EMPTY_CONTACT }]);
      setFeedback('Contatos de emergência salvos.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingContacts(false);
    }
  }

  async function triggerEmergency() {
    if (!window.confirm(
      'Confirma o acionamento de EMERGÊNCIA?\n\nSeus contatos cadastrados receberão SMS/WhatsApp com sua localização.',
    )) {
      return;
    }

    setTriggering(true);
    setError('');
    setFeedback('');
    try {
      const res = await api.triggerEmergency({
        vehicle_id: vehicleId || undefined,
        message: message.trim() || undefined,
      });
      setFeedback(res.message || res.data?.message || 'Emergência acionada.');
      setMessage('');
    } catch (err) {
      setError(err.message);
    } finally {
      setTriggering(false);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;

  const disabled = !data?.enabled;
  const hasPersonalContacts = (data?.contatos_pessoais || []).length > 0;

  return (
    <div className="emergency-page">
      <PageHeaderWithHelp
        title="Emergência"
        subtitle="Acione contatos de confiança com um toque. Em risco imediato, ligue 190."
        guideId="client_emergency"
        scope="client"
      />

      {disabled && (
        <div className="alert warning">
          Botão de emergência temporariamente indisponível. Ligue 190 ou contate o suporte.
        </div>
      )}
      {error && <div className="alert error">{error}</div>}
      {feedback && <div className="alert success">{feedback}</div>}

      <section className="emergency-sos-card">
        <p className="emergency-sos-hint">
          Envia alerta por WhatsApp/SMS para seus contatos e para a central configurada pela Águia.
        </p>

        {vehicles.length > 0 && (
          <label>
            Veículo (inclui localização no alerta)
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">Sem veículo / sem GPS</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.label || v.plate}</option>
              ))}
            </select>
          </label>
        )}

        <label>
          Mensagem opcional
          <textarea
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex.: Estou na rodovia, preciso de ajuda"
            maxLength={280}
          />
        </label>

        <button
          type="button"
          className="emergency-sos-button"
          disabled={disabled || triggering || !hasPersonalContacts}
          onClick={triggerEmergency}
        >
          {triggering ? 'Enviando alerta...' : 'SOS — ACIONAR EMERGÊNCIA'}
        </button>

        {!hasPersonalContacts && (
          <p className="guide-inline">Cadastre ao menos um contato pessoal abaixo antes de acionar.</p>
        )}

        {data?.cooldown_minutes > 0 && (
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Intervalo mínimo entre acionamentos: {data.cooldown_minutes} min.
          </p>
        )}
      </section>

      <section className="emergency-dial-grid">
        <SectionTitleWithHelp title="Ligar agora" guideId="client_emergency_dial" scope="client" />
        <div className="card-grid">
          {(data?.nacional || []).map((item) => (
            <a key={item.key} href={`tel:${item.dial}`} className="card card-link emergency-dial-card">
              <span className="card-icon">📞</span>
              <h3>{item.label}</h3>
              <p>{item.phone}</p>
            </a>
          ))}
          {(data?.empresa || []).map((item) => (
            <a key={item.key} href={`tel:${item.dial}`} className="card card-link emergency-dial-card">
              <span className="card-icon">🛟</span>
              <h3>{item.label}</h3>
              <p>{item.phone}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="form-card">
        <SectionTitleWithHelp title="Contatos de emergência" guideId="client_emergency_contacts" scope="client" />
        <p className="guide-inline">
          Estes contatos recebem SMS/WhatsApp quando você aciona o SOS.
          {' '}<Link to="/app/perfil">Atualize seu telefone</Link> no perfil.
        </p>

        <form onSubmit={saveContacts}>
          {contacts.map((contact, index) => (
            <div key={index} className="form-row emergency-contact-row">
              <label>
                Nome
                <input
                  type="text"
                  value={contact.name}
                  onChange={(e) => updateContact(index, 'name', e.target.value)}
                  placeholder="Ex.: Maria (esposa)"
                />
              </label>
              <label>
                Telefone
                <input
                  type="tel"
                  value={contact.phone}
                  onChange={(e) => updateContact(index, 'phone', e.target.value)}
                  placeholder="11999999999"
                />
              </label>
              {contacts.length > 1 && (
                <button type="button" className="btn-ghost btn-sm" onClick={() => removeContactRow(index)}>
                  Remover
                </button>
              )}
            </div>
          ))}

          <div className="emergency-contact-actions">
            {contacts.length < 5 && (
              <button type="button" className="btn-secondary btn-sm" onClick={addContactRow}>
                + Contato
              </button>
            )}
            <button type="submit" disabled={savingContacts}>
              {savingContacts ? 'Salvando...' : 'Salvar contatos'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
