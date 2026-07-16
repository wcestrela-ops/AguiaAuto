const whatsapp = require('./whatsapp');
const sms = require('./sms');
const logger = require('../logger');

async function sendBillingReminder(phone, payload, meta = {}) {
  try {
    return await whatsapp.sendBillingReminder(phone, payload, meta);
  } catch (err) {
    logger.warn('Cobrança via WhatsApp falhou — tentando SMS.', { err: err.message });
    return sms.sendBillingReminder(phone, payload, meta);
  }
}

module.exports = { sendBillingReminder };
