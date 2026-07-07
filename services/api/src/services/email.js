const nodemailer = require('nodemailer');
const { getStore } = require('@aguia/integrations');
const logger = require('../logger');

async function getSmtpConfig() {
  try {
    const store = getStore();
    const config = await store.get('smtp');
    if (config?.enabled && config.settings?.host && config.settings?.from) {
      return config.settings;
    }
  } catch {
    // Store may be unavailable outside DATABASE_URL bootstrap
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
    return null;
  }

  return {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
    from_name: process.env.SMTP_FROM_NAME || 'Águia Gestão Veicular',
  };
}

async function createTransport() {
  const settings = await getSmtpConfig();
  if (!settings) return null;

  return {
    settings,
    transport: nodemailer.createTransport({
      host: settings.host,
      port: settings.port || 587,
      secure: Boolean(settings.secure),
      auth: settings.user ? { user: settings.user, pass: settings.pass } : undefined,
    }),
  };
}

function formatFrom(settings) {
  const name = settings.from_name || 'Águia Gestão Veicular';
  return `"${name}" <${settings.from}>`;
}

async function sendMail({ to, subject, text, html }) {
  const mailer = await createTransport();
  if (!mailer) {
    logger.warn('SMTP não configurado — e-mail não enviado.', { to, subject });
    return { sent: false, reason: 'smtp_not_configured' };
  }

  await mailer.transport.sendMail({
    from: formatFrom(mailer.settings),
    to,
    subject,
    text,
    html,
  });

  logger.info('E-mail enviado.', { to, subject });
  return { sent: true };
}

async function sendRegistrationWelcome({ to, name, email, password }) {
  const greeting = name ? `Olá, ${name}!` : 'Olá!';
  const subject = 'Bem-vindo à Águia Gestão Veicular — seus dados de acesso';
  const text = [
    greeting,
    '',
    'Sua conta foi criada com sucesso.',
    '',
    `Login (e-mail): ${email}`,
    `Senha: ${password}`,
    '',
    'Guarde esta senha em local seguro. Você também pode alterá-la em Meu Perfil.',
    'Para recuperar o acesso, use "Esqueci minha senha" no app.',
    '',
    'Equipe Águia Gestão Veicular',
  ].join('\n');

  const html = `
    <p>${greeting}</p>
    <p>Sua conta foi criada com sucesso.</p>
    <ul>
      <li><strong>Login (e-mail):</strong> ${email}</li>
      <li><strong>Senha:</strong> ${password}</li>
    </ul>
    <p>Guarde esta senha em local seguro. Você também pode alterá-la em <strong>Meu Perfil</strong>.</p>
    <p>Para recuperar o acesso, use <strong>Esqueci minha senha</strong> no app.</p>
    <p>Equipe Águia Gestão Veicular</p>
  `;

  return sendMail({ to, subject, text, html });
}

async function sendAccountCredentials({ to, name, email, password, roleLabel = 'usuário' }) {
  const subject = `Águia — credenciais de acesso (${roleLabel})`;
  const text = [
    `Olá${name ? `, ${name}` : ''}!`,
    '',
    `Sua conta de ${roleLabel} foi criada.`,
    '',
    `Login (e-mail): ${email}`,
    `Senha: ${password}`,
    '',
    'Acesse o app e altere a senha em Meu Perfil, se desejar.',
    '',
    'Equipe Águia Gestão Veicular',
  ].join('\n');

  const html = `
    <p>Olá${name ? `, ${name}` : ''}!</p>
    <p>Sua conta de <strong>${roleLabel}</strong> foi criada.</p>
    <ul>
      <li><strong>Login (e-mail):</strong> ${email}</li>
      <li><strong>Senha:</strong> ${password}</li>
    </ul>
    <p>Acesse o app e altere a senha em <strong>Meu Perfil</strong>, se desejar.</p>
  `;

  return sendMail({ to, subject, text, html });
}

async function sendPasswordRecovery({ to, name, code, expiresMin }) {
  const subject = 'Código de recuperação de senha — Águia';
  const text = [
    `Olá${name ? `, ${name}` : ''}!`,
    '',
    `Seu código de recuperação Águia: ${code}`,
    `Válido por ${expiresMin} minutos.`,
    '',
    'Se você não solicitou, ignore este e-mail.',
  ].join('\n');

  const html = `
    <p>Olá${name ? `, ${name}` : ''}!</p>
    <p>Seu código de recuperação Águia:</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>
    <p>Válido por <strong>${expiresMin} minutos</strong>.</p>
    <p>Se você não solicitou, ignore este e-mail.</p>
  `;

  return sendMail({ to, subject, text, html });
}

async function testConnection() {
  const mailer = await createTransport();
  if (!mailer) {
    throw new Error('SMTP não configurado. Configure em Integrações → E-mail (SMTP).');
  }
  await mailer.transport.verify();
  return { ok: true, host: mailer.settings.host };
}

module.exports = {
  sendMail,
  sendRegistrationWelcome,
  sendAccountCredentials,
  sendPasswordRecovery,
  testConnection,
  getSmtpConfig,
};
