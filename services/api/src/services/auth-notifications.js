const email = require('./email');
const whatsapp = require('./whatsapp');
const firebase = require('./firebase');
const { normalizePhone } = require('../lib/phone');
const {
  resolvePasswordResetChannels,
  isWhatsAppAllowedForAuth,
} = require('../lib/notification-policy');
const logger = require('../logger');

async function sendRegistrationWelcome({ user, password }) {
  const results = { channels: [] };

  try {
    const mail = await email.sendRegistrationWelcome({
      to: user.email,
      name: user.name,
      email: user.email,
      password,
    });
    if (mail.sent) results.channels.push('email');
  } catch (err) {
    logger.warn('Falha ao enviar e-mail de cadastro.', { email: user.email, err: err.message });
  }

  if (user.phone && isWhatsAppAllowedForAuth('cadastro')) {
    try {
      await whatsapp.sendWelcome(normalizePhone(user.phone), user.name, {
        user: user.email,
        type: 'cadastro',
      });
      results.channels.push('whatsapp');
    } catch (err) {
      logger.warn('Falha ao enviar WhatsApp de cadastro.', { email: user.email, err: err.message });
    }
  }

  return results;
}

async function sendAccountCredentials({ user, password, roleLabel }) {
  const results = { channels: [] };

  try {
    const mail = await email.sendAccountCredentials({
      to: user.email,
      name: user.name,
      email: user.email,
      password,
      roleLabel,
    });
    if (mail.sent) results.channels.push('email');
  } catch (err) {
    logger.warn('Falha ao enviar credenciais por e-mail.', { email: user.email, err: err.message });
  }

  if (user.phone && isWhatsAppAllowedForAuth('cadastro')) {
    try {
      await whatsapp.sendText({
        to: normalizePhone(user.phone),
        text: [
          `Olá${user.name ? `, ${user.name}` : ''}!`,
          '',
          `Sua conta Águia (${roleLabel}) foi criada.`,
          `Login: ${user.email}`,
          `Senha: ${password}`,
        ].join('\n'),
      }, { user: user.email, type: 'cadastro' });
      results.channels.push('whatsapp');
    } catch (err) {
      logger.warn('Falha ao enviar credenciais via WhatsApp.', { email: user.email, err: err.message });
    }
  }

  return results;
}

async function deliverPasswordResetCode({
  user,
  code,
  expiresMin,
  channel = 'both',
}) {
  const planned = resolvePasswordResetChannels({ channel, hasPhone: Boolean(user.phone) });
  const delivered = [];

  if (planned.includes('email')) {
    try {
      const mail = await email.sendPasswordRecovery({
        to: user.email,
        name: user.name,
        code,
        expiresMin,
      });
      if (mail.sent) {
        delivered.push('email');
        logger.info('Código de recuperação enviado por e-mail.', { email: user.email });
      }
    } catch (err) {
      logger.warn('Falha ao enviar código por e-mail.', { email: user.email, err: err.message });
    }
  }

  if (planned.includes('whatsapp') && user.phone && isWhatsAppAllowedForAuth('recuperacao_senha')) {
    try {
      await whatsapp.sendPasswordRecovery(normalizePhone(user.phone), code, {
        user: user.email,
        type: 'recuperacao_senha',
      }, expiresMin);
      delivered.push('whatsapp');
      logger.info('Código de recuperação enviado via WhatsApp.', { email: user.email });
    } catch (err) {
      logger.warn('Falha ao enviar código via WhatsApp.', { email: user.email, err: err.message });
    }
  }

  if (delivered.length === 0) {
    try {
      await firebase.sendPushToUser(user.id, {
        title: 'Recuperação de senha — Águia',
        body: `Seu código: ${code}. Válido por ${expiresMin} minutos.`,
        data: { type: 'password_reset' },
      });
      delivered.push('push');
    } catch {
      // Push opcional
    }
  }

  return { channels: delivered, planned };
}

module.exports = {
  sendRegistrationWelcome,
  sendAccountCredentials,
  deliverPasswordResetCode,
};
