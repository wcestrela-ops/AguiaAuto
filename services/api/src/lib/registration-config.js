const { getStore, getDefaults } = require('@aguia/integrations');

function parsePhoneList(value) {
  if (!value) return [];
  return String(value)
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseEmailList(value) {
  if (!value) return [];
  return String(value)
    .split(/[,;\n]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function isEnabled(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return value !== false && value !== 'false';
}

async function getRegistrationConfig() {
  const defaults = getDefaults('cadastro');
  try {
    const store = getStore();
    const config = await store.get('cadastro');
    const settings = config.settings || {};
    return {
      integrationEnabled: config.enabled !== false,
      ...defaults,
      ...settings,
    };
  } catch {
    return {
      integrationEnabled: true,
      ...defaults,
    };
  }
}

module.exports = {
  getRegistrationConfig,
  parsePhoneList,
  parseEmailList,
  isEnabled,
};
