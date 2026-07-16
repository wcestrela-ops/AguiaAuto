const email = require('./email');
const whatsapp = require('./whatsapp');
const sms = require('./sms');
const firebase = require('./firebase');
const { normalizePhone } = require('../lib/phone');
const { renderTemplate } = require('../lib/billing-templates');
const {
  getRegistrationConfig,
  parsePhoneList,
  parseEmailList,
  isEnabled,
} = require('../lib/registration-config');
const logger = require('../logger');

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildRegistrationVars({ user, password, plan, vehicle, referralCode }) {
  const vehicleLabel = vehicle
    ? [vehicle.brand, vehicle.model, vehicle.plate || 'Sem placa'].filter(Boolean).join(' · ')
    : '—';

  return {
    nome: user.name || user.email,
    email: user.email,
    telefone: user.phone || '—',
    cpf_cnpj: user.cpf_cnpj || '—',
    senha: password || '—',
    plano: plan?.name || '—',
    plano_valor: plan ? formatMoney(plan.price_monthly) : '—',
    veiculo: vehicleLabel,
    placa: vehicle?.plate || 'Sem placa',
    indicacao: referralCode || '—',
    data: new Date().toLocaleString('pt-BR'),
  };
}

function buildClientWelcomeText(vars) {
  return [
    `Olá, ${vars.nome}!`,
    '',
    'Bem-vindo à Águia Gestão Veicular. Sua conta foi criada com sucesso.',
    '',
    `Login: ${vars.email}`,
    passwordHint(vars.senha),
    '',
    vars.plano !== '—' ? `Plano: ${vars.plano} — R$ ${vars.plano_valor}/mês` : null,
    vars.veiculo !== '—' ? `Veículo: ${vars.veiculo}` : null,
    '',
    'Acesse o app para acompanhar instalação, contrato e pagamento.',
    '',
    'Equipe Águia',
  ].filter(Boolean).join('\n');
}

function passwordHint(password) {
  if (!password || password === '—') return 'Use a senha definida no cadastro.';
  return `Senha: ${password}`;
}

async function notifyPhoneMessage(phone, text, meta, { whatsappEnabled, smsEnabled }) {
  const normalized = normalizePhone(phone);
  const channels = [];

  if (whatsappEnabled) {
    try {
      await whatsapp.sendText({ to: normalized, text }, meta);
      channels.push('whatsapp');
      return channels;
    } catch (waErr) {
      logger.warn('Cadastro: WhatsApp falhou.', { phone: normalized, err: waErr.message });
      if (!smsEnabled) throw waErr;
    }
  }

  if (smsEnabled) {
    await sms.sendText({
      to: normalized,
      text,
      user: meta.userId || meta.user,
      action: meta.type || 'cadastro',
    });
    channels.push('sms');
  }

  return channels;
}

async function notifyClient({ user, password, plan, vehicle, config, vars }) {
  const results = { channels: [] };

  if (isEnabled(config.client_email_enabled)) {
    try {
      const mail = await email.sendRegistrationWelcome({
        to: user.email,
        name: user.name,
        email: user.email,
        password,
      });
      if (mail.sent) results.channels.push('email');
    } catch (err) {
      logger.warn('Cadastro: e-mail ao cliente falhou.', { userId: user.id, err: err.message });
    }
  }

  const clientText = buildClientWelcomeText(vars);

  if (user.phone && (isEnabled(config.client_whatsapp_enabled) || isEnabled(config.client_sms_enabled, false))) {
    try {
      const phoneChannels = await notifyPhoneMessage(
        user.phone,
        clientText,
        { user: user.email, userId: user.id, type: 'cadastro' },
        {
          whatsappEnabled: isEnabled(config.client_whatsapp_enabled),
          smsEnabled: isEnabled(config.client_sms_enabled, false),
        },
      );
      results.channels.push(...phoneChannels);
    } catch (err) {
      logger.warn('Cadastro: WhatsApp/SMS ao cliente falhou.', { userId: user.id, err: err.message });
    }
  }

  if (isEnabled(config.client_push_enabled)) {
    try {
      const pushResult = await firebase.sendPushToUser(user.id, {
        title: 'Bem-vindo à Águia!',
        body: 'Sua conta foi criada. Acesse o app para acompanhar instalação e pagamento.',
        data: {
          type: 'registration_welcome',
          path: '/app',
        },
      });
      if (pushResult.success) results.channels.push('push');
    } catch (err) {
      logger.warn('Cadastro: push ao cliente falhou.', { userId: user.id, err: err.message });
    }
  }

  return results;
}

async function notifyCentral({ user, plan, vehicle, referralCode, config, vars }) {
  const results = { channels: [], recipients: 0 };

  if (!isEnabled(config.central_notify_enabled)) {
    return results;
  }

  const template = config.template_central
    || '🆕 Novo cadastro Águia\n\nCliente: {{nome}}\nE-mail: {{email}}\nTel: {{telefone}}\nCPF/CNPJ: {{cpf_cnpj}}\nPlano: {{plano}} — R$ {{plano_valor}}/mês\nVeículo: {{veiculo}}\nIndicação: {{indicacao}}\n\n{{data}}';
  const text = renderTemplate(template, vars);

  const phones = parsePhoneList(config.central_phones);
  const emails = parseEmailList(config.central_emails);

  for (const phone of phones) {
    try {
      const phoneChannels = await notifyPhoneMessage(
        phone,
        text,
        { user: user.id, type: 'cadastro.central' },
        {
          whatsappEnabled: isEnabled(config.central_whatsapp_enabled, true),
          smsEnabled: isEnabled(config.central_sms_enabled, true),
        },
      );
      results.channels.push(...phoneChannels.map((c) => `central:${c}`));
      results.recipients += 1;
    } catch (err) {
      logger.warn('Cadastro: falha ao notificar central (telefone).', { phone, err: err.message });
    }
  }

  for (const to of emails) {
    try {
      const mail = await email.sendMail({
        to,
        subject: `[Águia] Novo cadastro — ${vars.nome}`,
        text,
      });
      if (mail.sent) {
        results.channels.push('central:email');
        results.recipients += 1;
      }
    } catch (err) {
      logger.warn('Cadastro: falha ao notificar central (e-mail).', { to, err: err.message });
    }
  }

  return results;
}

async function sendRegistrationNotifications({
  user,
  password,
  plan = null,
  vehicle = null,
  referralCode = null,
}) {
  const config = await getRegistrationConfig();
  if (!config.integrationEnabled) {
    return { skipped: true, client: { channels: [] }, central: { channels: [], recipients: 0 } };
  }

  const vars = buildRegistrationVars({ user, password, plan, vehicle, referralCode });

  const [client, central] = await Promise.all([
    notifyClient({ user, password, plan, vehicle, config, vars }),
    notifyCentral({ user, plan, vehicle, referralCode, config, vars }),
  ]);

  return { client, central };
}

module.exports = {
  sendRegistrationNotifications,
  buildRegistrationVars,
  buildClientWelcomeText,
};
