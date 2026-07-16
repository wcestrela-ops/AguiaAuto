const PROVIDER_TYPES = {
  fake: {
    label: 'Simulado (desenvolvimento)',
    fields: [],
  },
  android: {
    label: 'Gateway Android (chip no aparelho)',
    fields: [
      { key: 'base_url', label: 'URL do agente', type: 'url', required: true },
      { key: 'api_key', label: 'Chave do agente', type: 'password', secret: true, required: true },
      { key: 'device_id', label: 'ID do dispositivo Android', type: 'text', required: true },
    ],
  },
  smsmarket: {
    label: 'SMSMarket',
    fields: [
      { key: 'base_url', label: 'URL da API', type: 'url', required: true },
      { key: 'api_key', label: 'API Key', type: 'password', secret: true, required: true },
      { key: 'sender_id', label: 'Remetente / ID', type: 'text', required: true },
    ],
  },
};

const SECRET_FIELDS = ['api_key'];

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
