export default function SmsPlaceholderPage({ title, description }) {
  return (
    <div className="sms-card">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ color: 'var(--muted)', margin: 0 }}>{description}</p>
      <p style={{ color: 'var(--muted)', marginTop: '0.75rem', marginBottom: 0 }}>
        Em desenvolvimento — módulo unificado ao painel Águia.
      </p>
    </div>
  );
}
