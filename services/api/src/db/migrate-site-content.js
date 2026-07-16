const { getPool } = require('./pool');

const DEFAULT_LANDING = {
  enabled: true,
  brand_icon: '🦅',
  brand_name: 'Águia Gestão Veicular',
  hero_title: 'Rastreamento veicular inteligente',
  hero_subtitle: 'Monitore, proteja e gerencie sua frota com app, alertas e suporte Águia.',
  hero_cta_primary_label: 'Criar conta',
  hero_cta_primary_url: '/cadastro',
  hero_cta_secondary_label: 'Entrar',
  hero_cta_secondary_url: '/login',
  features_title: 'Por que escolher a Águia?',
  features: [
    { icon: '📍', title: 'Localização em tempo real', description: 'Acompanhe seus veículos pelo app a qualquer hora.' },
    { icon: '🔒', title: 'Bloqueio remoto', description: 'Comandos 4G com failover SMS quando necessário.' },
    { icon: '📋', title: 'Documentos e manutenção', description: 'Lembretes de vencimento de CRLV, seguro e revisões.' },
    { icon: '🆘', title: 'Botão SOS', description: 'Emergência com um toque para contatos e central.' },
  ],
  plans_section_enabled: true,
  plans_section_title: 'Planos disponíveis',
  plans_section_subtitle: 'Escolha o plano ideal para seu veículo e cadastre-se online.',
  contact_title: 'Fale conosco',
  contact_phone: '',
  contact_whatsapp: '',
  contact_email: '',
  footer_text: '© Águia Gestão Veicular. Todos os direitos reservados.',
  meta_description: 'Rastreamento veicular com app Águia — localização, bloqueio, documentos e SOS.',
};

async function migrateSiteContent() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_content (
      key           VARCHAR(50) PRIMARY KEY,
      content       JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by    VARCHAR(100)
    );
  `);

  await pool.query(
    `INSERT INTO site_content (key, content)
     VALUES ('landing', $1::jsonb)
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify(DEFAULT_LANDING)],
  );
}

module.exports = { migrateSiteContent, DEFAULT_LANDING };
