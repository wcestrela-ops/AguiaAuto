const { getSmsService } = require('@aguia/sms');
const logger = require('../logger');

let service = null;

function getService() {
  if (!service) {
    service = getSmsService({ logger });
  }
  return service;
}

module.exports = {
  sendTrackerCommand: (payload) => getService().sendTrackerCommand(payload),
  sendText: (payload) => getService().sendText(payload),
  sendBillingReminder: (to, data, meta) => getService().sendBillingReminder(to, { ...data, userId: meta?.user }),
  sendVehicleAlert: (to, message, meta) => getService().sendVehicleAlert(to, message, meta),
  listDispatches: (options) => getService().listDispatches(options),
};
