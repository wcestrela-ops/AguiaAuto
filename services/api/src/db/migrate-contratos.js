const { getPool } = require('./pool');

const SERVICE_CONTRACT_HTML = `
<h2>Contrato de Prestação de Serviços de Rastreamento Veicular</h2>
<p>Pelo presente instrumento, o <strong>CLIENTE</strong> contrata os serviços de monitoramento e rastreamento veicular prestados pela <strong>Águia Gestão Veicular</strong>, nas condições abaixo:</p>
<ol>
  <li>O serviço compreende o monitoramento do veículo cadastrado via aplicativo e plataforma própria.</li>
  <li>O CLIENTE se compromete a manter os dados cadastrais atualizados e a efetuar o pagamento das mensalidades em dia.</li>
  <li>A instalação do equipamento de rastreamento será realizada por técnico credenciado, com emissão de relatório e termo de entrega.</li>
  <li>O CLIENTE declara estar ciente de que o funcionamento normal do rastreador depende da instalação correta e da manutenção do equipamento.</li>
  <li>A aceitação deste contrato é condição para utilização dos serviços da plataforma.</li>
</ol>
`.trim();

const DELIVERY_TERMS_HTML = `
<h2>Termo de Entrega e Aceite de Instalação</h2>
<p>Ao aceitar este termo, o <strong>CLIENTE</strong> declara que:</p>
<ol>
  <li>Verificou o relatório de instalação e as fotos registradas pelo técnico instalador.</li>
  <li>Recebeu o equipamento de rastreamento instalado em seu veículo (automóvel ou motocicleta).</li>
  <li>Concorda que o veículo deixou o processo de instalação com o rastreador em <strong>funcionamento normal</strong>, conforme descrito no relatório.</li>
  <li>Está ciente de que eventuais problemas decorrentes de mau uso, desconexão ou danos físicos posteriores à instalação não são de responsabilidade da empresa.</li>
</ol>
`.trim();

async function migrateContratos() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contract_templates (
      id          SERIAL PRIMARY KEY,
      slug        VARCHAR(50) UNIQUE NOT NULL,
      title       VARCHAR(255) NOT NULL,
      body_html   TEXT NOT NULL,
      version     INTEGER NOT NULL DEFAULT 1,
      active      BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contract_acceptances (
      id                  SERIAL PRIMARY KEY,
      user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vehicle_id          INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
      template_id         INTEGER NOT NULL REFERENCES contract_templates(id),
      template_version    INTEGER NOT NULL,
      acceptance_type     VARCHAR(40) NOT NULL,
      installation_log_id INTEGER REFERENCES installation_logs(id) ON DELETE SET NULL,
      ip_address          VARCHAR(45),
      user_agent          TEXT,
      accepted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_contract_acceptances_user ON contract_acceptances (user_id);
    CREATE INDEX IF NOT EXISTS idx_contract_acceptances_vehicle ON contract_acceptances (vehicle_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_acceptances_service
      ON contract_acceptances (user_id, template_id)
      WHERE acceptance_type = 'service';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_acceptances_delivery
      ON contract_acceptances (user_id, installation_log_id)
      WHERE acceptance_type = 'installation_delivery';
  `);

  await pool.query(
    `INSERT INTO contract_templates (slug, title, body_html, version, active)
     VALUES ($1, $2, $3, 1, true)
     ON CONFLICT (slug) DO NOTHING`,
    ['contrato-prestacao', 'Contrato de Prestação de Serviços', SERVICE_CONTRACT_HTML]
  );

  await pool.query(
    `INSERT INTO contract_templates (slug, title, body_html, version, active)
     VALUES ($1, $2, $3, 1, true)
     ON CONFLICT (slug) DO NOTHING`,
    ['termo-entrega-instalacao', 'Termo de Entrega e Aceite de Instalação', DELIVERY_TERMS_HTML]
  );
}

module.exports = { migrateContratos };
