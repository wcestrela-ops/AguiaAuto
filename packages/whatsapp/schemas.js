const PROVIDER_TYPES = {
  evolution: {
    label: 'Evolution API',
    fields: [
      { key: 'base_url', label: 'URL Base', type: 'url', required: true },
      { key: 'api_key', label: 'API Key', type: 'password', secret: true, required: true },
      { key: 'instance', label: 'Nome da Instância', type: 'text', required: true },
      { key: 'access_token', label: 'Token (opcional)', type: 'password', secret: true },
    ],
  },
  waha: {
    label: 'WAHA (WhatsApp HTTP API)',
    fields: [
      { key: 'base_url', label: 'URL Base', type: 'url', required: true },
      { key: 'api_key', label: 'API Key ou Token', type: 'password', secret: true, required: true },
      { key: 'session', label: 'Nome da Sessão', type: 'text', required: true },
      { key: 'port', label: 'Porta (opcional)', type: 'number' },
    ],
  },
  meta_cloud: {
    label: 'Meta Cloud API',
    fields: [
      { key: 'access_token', label: 'Access Token', type: 'password', secret: true, required: true },
      { key: 'phone_number_id', label: 'Phone Number ID', type: 'text', required: true },
      { key: 'business_account_id', label: 'WhatsApp Business Account ID', type: 'text', required: true },
      { key: 'app_id', label: 'App ID (opcional)', type: 'text' },
      { key: 'app_secret', label: 'App Secret (opcional)', type: 'password', secret: true },
      { key: 'verify_token', label: 'Verify Token do Webhook', type: 'password', secret: true },
    ],
  },
};

const SECRET_FIELDS = ['api_key', 'access_token', 'app_secret', 'verify_token'];

function getProviderSchema(type) {
  return PROVIDER_TYPES[type] || null;
}

function listProviderTypes() {
  return Object.entries(PROVIDER_TYPES).map(([type, schema]) => ({
    type,
    label: schema.label,
    fields: schema.fields.map(({ secret, ...field }) => field),
  }));
}

function maskProvider(row) {
  if (!row) return row;
  const masked = { ...row };
  for (const field of SECRET_FIELDS) {
    if (!masked[field]) continue;
    const value = String(masked[field]);
    masked[field] = value.length <= 4 ? '****' : `${'*'.repeat(Math.min(value.length - 4, 8))}${value.slice(-4)}`;
  }
  return masked;
}

module.exports = {
  PROVIDER_TYPES,
  SECRET_FIELDS,
  getProviderSchema,
  listProviderTypes,
  maskProvider,
};
