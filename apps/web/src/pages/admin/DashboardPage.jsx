import { Link } from 'react-router-dom';
import { HelpButton, InlineGuide } from '../../components/HelpGuide';

const CARDS = [
  { title: 'Integrações', desc: 'GPSWOX, Asaas, Firebase Push', to: '/admin/integracoes', icon: '⚙️', guideId: 'integrations' },
  { title: 'WhatsApp', desc: 'Evolution, WAHA, Meta Cloud', to: '/admin/whatsapp', icon: '💬', guideId: 'whatsapp' },
  { title: 'SMS Rastreador', desc: 'Comandos chip + gateways', to: '/admin/sms', icon: '📡', guideId: 'sms' },
  { title: 'Veículos', desc: 'GPSWOX, chip SIM, sync', to: '/admin/veiculos', icon: '🚗', guideId: 'vehicles' },
];

export default function DashboardPage() {
  return (
    <div>
      <header className="page-header">
        <div className="page-title-row">
          <h1>Dashboard</h1>
          <HelpButton guideId="dashboard" label="Primeiros passos" />
        </div>
        <p>Configure APIs e integrações sem alterar código.</p>
        <InlineGuide guideId="dashboard" />
      </header>

      <div className="card-grid">
        {CARDS.map((card) => (
          <Link key={card.to} to={card.to} className="card card-link">
            <span className="card-icon">{card.icon}</span>
            <div className="section-title-row">
              <h3>{card.title}</h3>
              <HelpButton guideId={card.guideId} size="sm" label={`Ajuda: ${card.title}`} />
            </div>
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
