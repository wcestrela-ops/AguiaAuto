const firebase = require('../../services/firebase');
const whatsapp = require('../../services/whatsapp');
const sms = require('../../services/sms');
const email = require('../../services/email');
const logger = require('../../logger');

async function processNotification(job) {
  const { channel, payload } = job.data;
  if (!channel || !payload) {
    return { skipped: true };
  }

  switch (channel) {
    case 'push':
      return firebase.sendPushToUser(payload.userId, payload.notification);
    case 'whatsapp':
      return whatsapp.sendText(payload);
    case 'sms':
      return sms.sendText(payload);
    case 'email':
      return email.sendMail(payload);
    default:
      logger.warn('Canal de notificação desconhecido.', { channel });
      return { skipped: true, channel };
  }
}

module.exports = { processNotification };
