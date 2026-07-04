const { getWhatsAppService } = require('@aguia/whatsapp');
const logger = require('../logger');

let service = null;

function getService() {
  if (!service) {
    service = getWhatsAppService({ logger });
  }
  return service;
}

module.exports = {
  sendText: (payload, meta) => getService().sendText(payload, meta),
  sendImage: (payload, meta) => getService().sendImage(payload, meta),
  sendDocument: (payload, meta) => getService().sendDocument(payload, meta),
  sendAudio: (payload, meta) => getService().sendAudio(payload, meta),
  sendVideo: (payload, meta) => getService().sendVideo(payload, meta),
  sendLocation: (payload, meta) => getService().sendLocation(payload, meta),
  sendContact: (payload, meta) => getService().sendContact(payload, meta),
  sendButtons: (payload, meta) => getService().sendButtons(payload, meta),
  sendList: (payload, meta) => getService().sendList(payload, meta),

  sendWelcome: (to, name, meta) =>
    getService().sendText({
      to,
      text: `Olá${name ? `, ${name}` : ''}! Bem-vindo à Águia Gestão Veicular. 🚗`,
    }, meta),

  sendAlert: (to, message, meta) =>
    getService().sendText({ to, text: message }, meta),

  sendBillingReminder: (to, { valor, vencimento, link }, meta) =>
    getService().sendText({
      to,
      text: `💰 Lembrete de mensalidade\nValor: R$ ${valor}\nVencimento: ${vencimento}${link ? `\nPague aqui: ${link}` : ''}`,
    }, meta),

  sendPasswordRecovery: (to, code, meta) =>
    getService().sendText({
      to,
      text: `Seu código de recuperação Águia: ${code}\nVálido por 10 minutos.`,
    }, meta),
};
