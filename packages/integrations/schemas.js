const INTEGRATIONS = {
  gpswox: {
    label: 'GPSWOX',
    description: 'Motor de rastreamento (invisível ao cliente)',
    fields: [
      { key: 'url', label: 'URL da plataforma', type: 'url', required: true, env: 'GPSWOX_URL' },
      { key: 'user', label: 'Usuário admin', type: 'text', required: true, env: 'GPSWOX_USER' },
      { key: 'pass', label: 'Senha admin', type: 'password', secret: true, required: true, env: 'GPSWOX_PASS' },
      { key: 'api_hash', label: 'API Hash oficial', type: 'password', secret: true, env: 'GPSWOX_API_HASH' },
      { key: 'default_group_id', label: 'Group ID padrão (novos clientes)', type: 'number', env: 'GPSWOX_DEFAULT_GROUP_ID' },
      { key: 'headless', label: 'Modo headless (Playwright)', type: 'boolean', default: true, env: 'HEADLESS' },
      { key: 'nav_timeout', label: 'Timeout de navegação (ms)', type: 'number', default: 30000, env: 'NAV_TIMEOUT' },
    ],
  },
  gateway: {
    label: 'Gateway GPSWOX',
    description: 'Configuração interna do serviço gateway',
    fields: [
      { key: 'secret', label: 'Segredo de autenticação', type: 'password', secret: true, env: 'GATEWAY_SECRET' },
      { key: 'port', label: 'Porta', type: 'number', default: 3001, env: 'GATEWAY_PORT' },
    ],
  },
  gateway_client: {
    label: 'Conexão API → Gateway',
    description: 'Como a API se conecta ao gateway interno',
    fields: [
      { key: 'url', label: 'URL do gateway', type: 'url', default: 'http://gpswox-gateway:3001', env: 'GATEWAY_URL' },
      { key: 'secret', label: 'Segredo', type: 'password', secret: true, env: 'GATEWAY_SECRET' },
    ],
  },
  asaas: {
    label: 'Asaas',
    description: 'Pagamentos recorrentes, PIX e boletos mensais',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', secret: true, required: true, env: 'ASAAS_API_KEY' },
      { key: 'webhook_token', label: 'Token do webhook', type: 'password', secret: true, env: 'ASAAS_WEBHOOK_TOKEN' },
      { key: 'sandbox', label: 'Modo sandbox', type: 'boolean', default: false, env: 'ASAAS_SANDBOX' },
    ],
  },
  mercadopago: {
    label: 'Mercado Pago',
    description: 'Pagamento inicial de assinaturas e failover PIX',
    fields: [
      { key: 'access_token', label: 'Access Token', type: 'password', secret: true, required: true, env: 'MP_ACCESS_TOKEN' },
      { key: 'public_key', label: 'Public Key', type: 'text', env: 'MP_PUBLIC_KEY' },
      { key: 'webhook_secret', label: 'Webhook Secret', type: 'password', secret: true, env: 'MP_WEBHOOK_SECRET' },
      { key: 'notification_url', label: 'URL de notificação (webhook)', type: 'url', env: 'MP_NOTIFICATION_URL' },
      { key: 'sandbox', label: 'Modo sandbox', type: 'boolean', default: false, env: 'MP_SANDBOX' },
    ],
  },
  payment_gateways: {
    label: 'Gateways de Pagamento',
    description: 'Roteamento Asaas + Mercado Pago com failover automático',
    fields: [
      { key: 'initial_primary', label: 'Inicial — principal', type: 'text', default: 'mercadopago' },
      { key: 'initial_backup', label: 'Inicial — backup', type: 'text', default: 'asaas' },
      { key: 'recurring_primary', label: 'Recorrente — principal', type: 'text', default: 'asaas' },
      { key: 'recurring_backup', label: 'Recorrente — backup', type: 'text', default: 'mercadopago' },
      { key: 'failover_enabled', label: 'Failover automático', type: 'boolean', default: true },
      { key: 'prefer_pix', label: 'Priorizar PIX nas cobranças', type: 'boolean', default: true },
    ],
  },
  alertas: {
    label: 'Motor de Alertas',
    description: 'GPSWOX → Push + WhatsApp (webhook e deduplicação)',
    fields: [
      { key: 'enabled', label: 'Motor ativo', type: 'boolean', default: true },
      { key: 'webhook_secret', label: 'Segredo do webhook GPSWOX', type: 'password', secret: true, env: 'ALERT_WEBHOOK_SECRET' },
      { key: 'default_channels', label: 'Canais padrão (push,whatsapp)', type: 'text', default: 'push,whatsapp' },
      { key: 'dedup_minutes', label: 'Deduplicação (minutos)', type: 'number', default: 5 },
    ],
  },
  firebase: {
    label: 'Firebase',
    description: 'Notificações push (PWA e apps) — configure pelo painel admin',
    fields: [
      { key: 'project_id', label: 'Project ID', type: 'text', required: true, env: 'FIREBASE_PROJECT_ID' },
      { key: 'web_api_key', label: 'Web API Key', type: 'password', secret: true, required: true, env: 'FIREBASE_WEB_API_KEY' },
      { key: 'messaging_sender_id', label: 'Messaging Sender ID', type: 'text', required: true, env: 'FIREBASE_MESSAGING_SENDER_ID' },
      { key: 'app_id', label: 'App ID', type: 'text', required: true, env: 'FIREBASE_APP_ID' },
      { key: 'vapid_key', label: 'VAPID Key (Web Push)', type: 'password', secret: true, env: 'FIREBASE_VAPID_KEY' },
      { key: 'client_email', label: 'Service Account Email', type: 'text', required: true, env: 'FIREBASE_CLIENT_EMAIL' },
      { key: 'private_key', label: 'Service Account Private Key', type: 'password', secret: true, required: true, env: 'FIREBASE_PRIVATE_KEY' },
    ],
  },
};

function getSchema(key) {
  return INTEGRATIONS[key] || null;
}

function listSchemas() {
  return Object.entries(INTEGRATIONS).map(([key, schema]) => ({
    key,
    label: schema.label,
    description: schema.description,
    fields: schema.fields.map(({ secret, env, ...field }) => field),
  }));
}

function getDefaults(key) {
  const schema = getSchema(key);
  if (!schema) return {};

  const defaults = {};
  for (const field of schema.fields) {
    if (field.default !== undefined) {
      defaults[field.key] = field.default;
    } else if (field.env && process.env[field.env] !== undefined) {
      const raw = process.env[field.env];
      if (field.type === 'boolean') {
        defaults[field.key] = raw !== 'false';
      } else if (field.type === 'number') {
        defaults[field.key] = parseInt(raw, 10);
      } else {
        defaults[field.key] = raw;
      }
    }
  }
  return defaults;
}

function maskSettings(key, settings) {
  const schema = getSchema(key);
  if (!schema) return settings;

  const masked = { ...settings };
  for (const field of schema.fields) {
    if (!field.secret || !masked[field.key]) continue;
    const value = String(masked[field.key]);
    masked[field.key] = value.length <= 4 ? '****' : `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
  }
  return masked;
}

module.exports = {
  INTEGRATIONS,
  getSchema,
  listSchemas,
  getDefaults,
  maskSettings,
};
