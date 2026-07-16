import { Link } from 'react-router-dom';

const CARDS = [
  { title: 'Integrações', desc: 'GPSWOX, Asaas, Firebase Push', to: '/admin/integracoes', icon: '⚙️' },
  { title: 'WhatsApp', desc: 'Evolution, WAHA, Meta Cloud', to: '/admin/whatsapp', icon: '💬' },
  { title: 'SMS Rastreador', desc: 'Comandos chip + gateways', to: '/admin/sms', icon: '📡' },
  { title: 'Veículos', desc: 'GPSWOX, chip SIM, sync', to: '/admin/veiculos', icon: '🚗' },
];

export default function DashboardPage() {
  return (
    <div>
      <header className="page-header">
        <h1>Dashboard</h1>
        <p>Configure APIs e integrações sem alterar código.</p>
      </header>

      <div className="card-grid">
        {CARDS.map((card) => (
          <Link key={card.to} to={card.to} className="card card-link">
            <span className="card-icon">{card.icon}</span>
            <h3>{card.title}</h3>
            <p>{card.desc}</p>
          </Link>
        ))}
      </div>

      <div className="info-box">
        <strong>Regra principal:</strong> Toda API/key (Firebase, WhatsApp, GPSWOX, Asaas) é
        configurada aqui no painel admin. Nunca no código-fonte.
      </div>
    </div>
  );
}
