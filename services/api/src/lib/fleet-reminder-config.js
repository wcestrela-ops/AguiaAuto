const { getStore, getDefaults } = require('@aguia/integrations');

const DEFAULT_WARNING_DAYS = 30;

async function getFleetReminderConfig() {
  const defaults = getDefaults('frota');
  try {
    const store = getStore();
    const config = await store.get('frota');
    const settings = config.settings || {};
    return {
      integrationEnabled: config.enabled !== false,
      ...defaults,
      ...settings,
      warning_days: Number(settings.warning_days ?? defaults.warning_days ?? DEFAULT_WARNING_DAYS),
    };
  } catch {
    return {
      integrationEnabled: false,
      warning_days: DEFAULT_WARNING_DAYS,
      ...defaults,
    };
  }
}

function isAutoRemindersEnabled(settings) {
  return settings.auto_reminders_enabled !== false
    && settings.auto_reminders_enabled !== 'false';
}

function isPushEnabled(settings) {
  return settings.reminder_push_enabled !== false
    && settings.reminder_push_enabled !== 'false';
}

module.exports = {
  DEFAULT_WARNING_DAYS,
  getFleetReminderConfig,
  isAutoRemindersEnabled,
  isPushEnabled,
};
