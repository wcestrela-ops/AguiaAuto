const INTEGRATIONS = {
  rastreamento: {
    label: 'Plataforma de Rastreamento',
    description: 'GPSWOX e Traccar podem estar ativos ao mesmo tempo — cada veículo usa a plataforma escolhida no cadastro.',
    fields: [
      {
        key: 'default_provider',
        label: 'Plataforma padrão (novos veículos)',
        type: 'select',
        default: 'gpswox',
        options: [
          { value: 'gpswox', label: 'GPSWOX (GPS Box)' },
          { value: 'traccar', label: 'Traccar' },
        ],
        hint: 'Usada no onboarding e instalador quando nenhuma plataforma for escolhida. Veículos existentes mantêm a plataforma marcada.',
      },
      {
        key: 'provider',
        label: 'Plataforma padrão (legado)',
        type: 'select',
        default: 'gpswox',
        options: [
          { value: 'gpswox', label: 'GPSWOX (GPS Box)' },
          { value: 'traccar', label: 'Traccar' },
        ],
        hint: 'Alias de default_provider — mantido para compatibilidade.',
      },
    ],
  },
  traccar: {
    label: 'Traccar',
    description: 'Motor de rastreamento alternativo (API REST — sem Playwright)',
    fields: [
      { key: 'url', label: 'URL do servidor Traccar', type: 'url', required: true, env: 'TRACCAR_URL', hint: 'Ex.: https://traccar.seudominio.com' },
      { key: 'email', label: 'E-mail admin', type: 'text', env: 'TRACCAR_EMAIL', hint: 'Usuário administrador (autenticação Basic)' },
      { key: 'password', label: 'Senha admin', type: 'password', secret: true, env: 'TRACCAR_PASSWORD' },
      { key: 'api_token', label: 'Token API (alternativa)', type: 'password', secret: true, env: 'TRACCAR_API_TOKEN', hint: 'Opcional — use em vez de e-mail/senha se configurado no Traccar' },
      { key: 'default_group_id', label: 'Group ID padrão (novos devices)', type: 'number', env: 'TRACCAR_DEFAULT_GROUP_ID' },
      { key: 'auto_sync_enabled', label: 'Sync automático de veículos', type: 'boolean', default: true, hint: 'Importa/atualiza veículos do Traccar periodicamente' },
      { key: 'auto_sync_interval_hours', label: 'Intervalo do sync (horas)', type: 'number', default: 24, env: 'TRACCAR_AUTO_SYNC_INTERVAL_HOURS' },
      { key: 'webhook_secret', label: 'Segredo webhook alertas', type: 'password', secret: true, env: 'TRACCAR_WEBHOOK_SECRET', hint: 'Configure notificador HTTP no Traccar → POST /webhooks/traccar na API' },
    ],
  },
  gpswox: {
    label: 'GPSWOX',
    description: 'Motor de rastreamento (invisível ao cliente)',
    fields: [
      { key: 'url', label: 'URL da plataforma', type: 'url', required: true, env: 'GPSWOX_URL', hint: 'Endereço do painel GPSWOX (ex.: https://gps.seudominio.com)' },
      { key: 'user', label: 'Usuário admin', type: 'text', required: true, env: 'GPSWOX_USER', hint: 'Login de administrador do GPSWOX' },
      { key: 'pass', label: 'Senha admin', type: 'password', secret: true, required: true, env: 'GPSWOX_PASS' },
      { key: 'api_hash', label: 'API Hash oficial', type: 'password', secret: true, env: 'GPSWOX_API_HASH', hint: 'GPSWOX → Configurações → API' },
      { key: 'default_group_id', label: 'Group ID padrão (novos clientes)', type: 'number', env: 'GPSWOX_DEFAULT_GROUP_ID', hint: 'Grupo onde novos clientes serão criados' },
      { key: 'headless', label: 'Modo headless (Playwright)', type: 'boolean', default: true, env: 'HEADLESS', hint: 'Mantenha ativo em produção' },
      { key: 'nav_timeout', label: 'Timeout de navegação (ms)', type: 'number', default: 30000, env: 'NAV_TIMEOUT' },
      { key: 'auto_sync_enabled', label: 'Sync automático de veículos', type: 'boolean', default: true, hint: 'Importa/atualiza veículos do GPSWOX periodicamente' },
      { key: 'auto_sync_interval_hours', label: 'Intervalo do sync (horas)', type: 'number', default: 24, env: 'GPSWOX_AUTO_SYNC_INTERVAL_HOURS', hint: 'Padrão: 1× por dia (24h)' },
    ],
  },
  gateway: {
    label: 'Gateway GPSWOX',
    description: 'Configuração interna do serviço gateway',
    fields: [
      { key: 'secret', label: 'Segredo de autenticação', type: 'password', secret: true, env: 'GATEWAY_SECRET' },
      { key: 'port', label: 'Porta', type: 'number', default: 3001, env: 'GATEWAY_PORT' },
    ],
  },
  gateway_client: {
    label: 'Conexão API → Gateway',
    description: 'Como a API se conecta ao gateway interno',
    fields: [
      { key: 'url', label: 'URL do gateway', type: 'url', default: 'http://gpswox-gateway:3001', env: 'GATEWAY_URL' },
      { key: 'secret', label: 'Segredo', type: 'password', secret: true, env: 'GATEWAY_SECRET' },
    ],
  },
  asaas: {
    label: 'Asaas',
    description: 'Pagamentos recorrentes, PIX e boletos mensais',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', secret: true, required: true, env: 'ASAAS_API_KEY', hint: 'Asaas → Integrações → API' },
      { key: 'webhook_token', label: 'Token do webhook', type: 'password', secret: true, env: 'ASAAS_WEBHOOK_TOKEN', hint: 'Mesmo token configurado no webhook POST /webhooks/asaas' },
      { key: 'sandbox', label: 'Modo sandbox', type: 'boolean', default: false, env: 'ASAAS_SANDBOX', hint: 'Ative apenas em homologação' },
    ],
  },
  mercadopago: {
    label: 'Mercado Pago',
    description: 'Pagamento inicial de assinaturas e failover PIX',
    fields: [
      { key: 'access_token', label: 'Access Token', type: 'password', secret: true, required: true, env: 'MP_ACCESS_TOKEN', hint: 'Credenciais de produção no developers.mercadopago.com' },
      { key: 'public_key', label: 'Public Key', type: 'text', env: 'MP_PUBLIC_KEY' },
      { key: 'webhook_secret', label: 'Webhook Secret', type: 'password', secret: true, env: 'MP_WEBHOOK_SECRET' },
      { key: 'notification_url', label: 'URL de notificação (webhook)', type: 'url', env: 'MP_NOTIFICATION_URL', hint: 'POST /webhooks/mercadopago na sua API' },
      { key: 'sandbox', label: 'Modo sandbox', type: 'boolean', default: false, env: 'MP_SANDBOX' },
    ],
  },
  payment_gateways: {
    label: 'Gateways de Pagamento',
    description: 'Roteamento Asaas + Mercado Pago com failover automático',
    fields: [
      { key: 'initial_primary', label: 'Inicial — principal', type: 'text', default: 'mercadopago', hint: 'Primeiro pagamento (adesão)' },
      { key: 'initial_backup', label: 'Inicial — backup', type: 'text', default: 'asaas' },
      { key: 'recurring_primary', label: 'Recorrente — principal', type: 'text', default: 'asaas', hint: 'Mensalidades' },
      { key: 'recurring_backup', label: 'Recorrente — backup', type: 'text', default: 'mercadopago' },
      { key: 'failover_enabled', label: 'Failover automático', type: 'boolean', default: true },
      { key: 'prefer_pix', label: 'Priorizar PIX nas cobranças', type: 'boolean', default: true },
    ],
  },
  alertas: {
    label: 'Motor de Alertas',
    description: 'GPSWOX → Push + WhatsApp (webhook e deduplicação)',
    fields: [
      { key: 'enabled', label: 'Motor ativo', type: 'boolean', default: true },
      { key: 'webhook_secret', label: 'Segredo do webhook GPSWOX', type: 'password', secret: true, env: 'ALERT_WEBHOOK_SECRET' },
      { key: 'default_channels', label: 'Canais de alerta de veículo', type: 'text', default: 'push' },
      { key: 'dedup_minutes', label: 'Deduplicação (minutos)', type: 'number', default: 5 },
      { key: 'whatsapp_note', label: 'Nota', type: 'text', default: 'WhatsApp não é usado para alertas de veículo (anti-ban). Apenas cadastro, cobrança e promoções admin.' },
    ],
  },
  firebase: {
    label: 'Firebase',
    description: 'Notificações push (PWA e apps) — configure pelo painel admin',
    fields: [
      { key: 'project_id', label: 'Project ID', type: 'text', required: true, env: 'FIREBASE_PROJECT_ID' },
      { key: 'web_api_key', label: 'Web API Key', type: 'password', secret: true, required: true, env: 'FIREBASE_WEB_API_KEY' },
      { key: 'messaging_sender_id', label: 'Messaging Sender ID', type: 'text', required: true, env: 'FIREBASE_MESSAGING_SENDER_ID' },
      { key: 'app_id', label: 'App ID', type: 'text', required: true, env: 'FIREBASE_APP_ID' },
      { key: 'vapid_key', label: 'VAPID Key (Web Push)', type: 'password', secret: true, env: 'FIREBASE_VAPID_KEY' },
      { key: 'client_email', label: 'Service Account Email', type: 'text', required: true, env: 'FIREBASE_CLIENT_EMAIL' },
      { key: 'private_key', label: 'Service Account Private Key', type: 'password', secret: true, required: true, env: 'FIREBASE_PRIVATE_KEY' },
    ],
  },
  smtp: {
    label: 'E-mail (SMTP)',
    description: 'Cadastro, recuperação de senha e credenciais — configure no painel admin',
    fields: [
      { key: 'host', label: 'Servidor SMTP', type: 'text', required: true, env: 'SMTP_HOST' },
      { key: 'port', label: 'Porta', type: 'number', default: 587, env: 'SMTP_PORT' },
      { key: 'secure', label: 'TLS direto (porta 465)', type: 'boolean', default: false, env: 'SMTP_SECURE' },
      { key: 'user', label: 'Usuário SMTP', type: 'text', env: 'SMTP_USER' },
      { key: 'pass', label: 'Senha SMTP', type: 'password', secret: true, env: 'SMTP_PASS' },
      { key: 'from', label: 'Remetente (From)', type: 'text', required: true, env: 'SMTP_FROM' },
      { key: 'from_name', label: 'Nome do remetente', type: 'text', default: 'Águia Gestão Veicular', env: 'SMTP_FROM_NAME' },
    ],
  },
  cadastro: {
    label: 'Notificações de cadastro',
    description: 'Avisos ao cliente e à central quando um novo cadastro é concluído',
    fields: [
      { key: 'client_email_enabled', label: 'E-mail para o cliente', type: 'boolean', default: true },
      { key: 'client_push_enabled', label: 'Push para o cliente', type: 'boolean', default: true, hint: 'Requer Firebase; pode falhar se o app ainda não registrou token' },
      { key: 'client_whatsapp_enabled', label: 'WhatsApp para o cliente', type: 'boolean', default: true },
      { key: 'client_sms_enabled', label: 'SMS para o cliente (fallback)', type: 'boolean', default: true, hint: 'Usado se WhatsApp falhar' },
      { key: 'central_notify_enabled', label: 'Notificar a central', type: 'boolean', default: true },
      { key: 'central_whatsapp_enabled', label: 'Central — WhatsApp', type: 'boolean', default: true },
      { key: 'central_sms_enabled', label: 'Central — SMS (fallback)', type: 'boolean', default: true },
      {
        key: 'central_phones',
        label: 'Telefones da central',
        type: 'textarea',
        hint: 'Um por linha ou separados por vírgula — recebem alerta de novo cadastro',
      },
      {
        key: 'central_emails',
        label: 'E-mails da central',
        type: 'textarea',
        hint: 'Um por linha — recebem alerta de novo cadastro',
      },
      {
        key: 'template_central',
        label: 'Mensagem — alerta à central',
        type: 'textarea',
        default: '🆕 Novo cadastro Águia\n\nCliente: {{nome}}\nE-mail: {{email}}\nTel: {{telefone}}\nCPF/CNPJ: {{cpf_cnpj}}\nPlano: {{plano}} — R$ {{plano_valor}}/mês\nVeículo: {{veiculo}}\nIndicação: {{indicacao}}\n\n{{data}}',
        hint: 'Variáveis: {{nome}}, {{email}}, {{telefone}}, {{cpf_cnpj}}, {{plano}}, {{plano_valor}}, {{veiculo}}, {{placa}}, {{indicacao}}, {{data}}',
      },
    ],
  },
  sms_gpswox_gateway: {
    label: 'Gateway SMS GPSWOX (entrada)',
    description: 'URL que o painel GPSWOX chama para enviar SMS via Águia (%NUMBER%, %MESSAGE%)',
    fields: [
      { key: 'username', label: 'Usuário (username na URL)', type: 'text', env: 'SMS_GPSWOX_GATEWAY_USER', hint: 'Enviado pelo GPSWOX como ?username=' },
      { key: 'password', label: 'Senha (password na URL)', type: 'password', secret: true, env: 'SMS_GPSWOX_GATEWAY_PASSWORD' },
      { key: 'public_base_url', label: 'URL pública da API (ex.: https://api.seudominio.com)', type: 'url', env: 'SMS_GPSWOX_GATEWAY_PUBLIC_URL', hint: 'Usada para gerar o link em SMS Rastreador' },
    ],
  },
  cobranca: {
    label: 'Cobrança e lembretes',
    description: 'Lembretes automáticos por vencimento/atraso, templates de mensagem e confirmação de pagamento',
    fields: [
      { key: 'auto_reminders_enabled', label: 'Lembretes automáticos agendados', type: 'boolean', default: true, hint: 'Envia nos dias configurados abaixo (vencimento e atrasos)' },
      { key: 'reminder_check_interval_hours', label: 'Verificar lembretes a cada (horas)', type: 'number', default: 1, env: 'BILLING_REMINDER_CHECK_HOURS' },
      { key: 'remind_on_due_date', label: 'No dia do vencimento', type: 'boolean', default: true },
      { key: 'remind_day_1', label: '1 dia após o vencimento', type: 'boolean', default: true },
      { key: 'remind_day_2', label: '2 dias após o vencimento', type: 'boolean', default: true },
      { key: 'remind_day_3', label: '3 dias após o vencimento', type: 'boolean', default: true },
      { key: 'remind_day_15', label: '15 dias após o vencimento', type: 'boolean', default: true },
      { key: 'reminder_sms_enabled', label: 'Permitir SMS nos lembretes', type: 'boolean', default: false, hint: 'Opcional — desative se envia cobrança por outro canal para não duplicar' },
      { key: 'reminder_sms_only', label: 'Lembretes agendados somente via SMS', type: 'boolean', default: false, hint: 'Quando ativo, lembretes automáticos não usam WhatsApp' },
      { key: 'notify_on_new_charge', label: 'Enviar mensagem ao criar cobrança manual', type: 'boolean', default: true },
      { key: 'notify_payment_received_auto', label: 'Notificar pagamento confirmado (webhook)', type: 'boolean', default: true },
      { key: 'notify_payment_received_manual', label: 'Notificar na baixa manual', type: 'boolean', default: true },
      { key: 'payment_received_sms_enabled', label: 'Permitir SMS na confirmação de pagamento', type: 'boolean', default: true, hint: 'Fallback SMS se WhatsApp falhar' },
      {
        key: 'template_new_charge',
        label: 'Mensagem — nova cobrança',
        type: 'textarea',
        default: '💰 Cobrança Águia\nOlá {{cliente}},\n{{resumo_valor}}\n{{detalhe_faturas}}{{pix_ou_link}}',
        hint: 'Automático: 1 fatura usa valor individual; 2+ somam em {{total_valor}} e listam em {{detalhe_faturas}}. Variáveis: {{resumo_valor}}, {{total_valor}}, {{faturas_pendentes}}, {{pix_ou_link}}',
      },
      {
        key: 'template_due',
        label: 'Mensagem — dia do vencimento',
        type: 'textarea',
        default: '💰 Lembrete Águia — vence hoje\nOlá {{cliente}},\n{{resumo_vencimento}}\n{{detalhe_faturas}}{{pix_ou_link}}',
        hint: 'Consolidado: {{resumo_vencimento}} adapta 1 ou várias faturas; {{detalhe_faturas}} lista cada uma com PIX/link.',
      },
      {
        key: 'template_overdue',
        label: 'Mensagem — após vencimento (atraso)',
        type: 'textarea',
        default: '⚠️ Mensalidade em atraso\nOlá {{cliente}},\n{{resumo_atraso}}\n{{detalhe_faturas}}{{pix_ou_link}}',
        hint: 'Consolidado: 1 msg por cliente/dia. {{resumo_atraso}} soma meses em atraso; PIX atualizado antes do envio.',
      },
      {
        key: 'template_payment_received',
        label: 'Mensagem — pagamento recebido',
        type: 'textarea',
        default: '✅ Pagamento confirmado\nOlá {{cliente}}, recebemos o pagamento de R$ {{valor}} referente a {{descricao}}.\nData: {{data_pagamento}}\nObrigado!',
        hint: 'Variáveis: {{cliente}}, {{valor}}, {{descricao}}, {{data_pagamento}}, {{vencimento}}',
      },
    ],
  },
  frota: {
    label: 'Documentos e Manutenção',
    description: 'Lembretes automáticos de vencimento via push, WhatsApp e SMS',
    fields: [
      { key: 'auto_reminders_enabled', label: 'Lembretes automáticos', type: 'boolean', default: true, hint: 'Envia um lembrete consolidado por cliente por dia' },
      { key: 'reminder_check_interval_hours', label: 'Verificar lembretes a cada (horas)', type: 'number', default: 6, env: 'FLEET_REMINDER_CHECK_HOURS' },
      { key: 'warning_days', label: 'Antecedência do alerta (dias)', type: 'number', default: 30, hint: 'Documentos e manutenções com vencimento neste prazo entram no lembrete' },
      { key: 'reminder_push_enabled', label: 'Enviar notificação push', type: 'boolean', default: true, hint: 'Requer Firebase configurado e app com token FCM registrado' },
      { key: 'reminder_whatsapp_enabled', label: 'Enviar WhatsApp', type: 'boolean', default: true, hint: 'Mensagem no telefone cadastrado do cliente' },
      { key: 'reminder_sms_enabled', label: 'Permitir SMS nos lembretes', type: 'boolean', default: false, hint: 'Fallback quando WhatsApp falhar, ou canal exclusivo se "somente SMS"' },
      { key: 'reminder_sms_only', label: 'Lembretes somente via SMS', type: 'boolean', default: false, hint: 'Quando ativo, lembretes de frota não usam WhatsApp' },
      {
        key: 'template_fleet_reminder',
        label: 'Mensagem — lembrete de documentos/manutenção',
        type: 'textarea',
        default: '📋 Lembrete Águia — documentos e manutenção\n\nOlá {{cliente}},\n\n{{resumo}}\n\n{{detalhe_itens}}\n\nAcesse o app em Documentos e Manutenção para atualizar.',
        hint: 'Variáveis: {{cliente}}, {{resumo}}, {{detalhe_itens}}, {{documentos_vencidos}}, {{documentos_vencendo}}, {{manutencao_atrasada}}, {{manutencao_proxima}}, {{total_itens}}',
      },
    ],
  },
  emergencia: {
    label: 'Emergência (SOS)',
    description: 'Botão de pânico no app — notifica contatos via WhatsApp/SMS com localização',
    fields: [
      { key: 'emergency_enabled', label: 'Botão de emergência ativo', type: 'boolean', default: true },
      { key: 'cooldown_minutes', label: 'Intervalo mínimo entre acionamentos (min)', type: 'number', default: 5 },
      { key: 'notify_whatsapp', label: 'Tentar WhatsApp primeiro', type: 'boolean', default: true },
      { key: 'notify_sms', label: 'Permitir SMS (fallback ou principal)', type: 'boolean', default: true },
      { key: 'assistencia_24h_label', label: 'Assistência 24h — rótulo', type: 'text', default: 'Assistência 24h Águia' },
      { key: 'assistencia_24h_phone', label: 'Assistência 24h — telefone', type: 'text', hint: 'Exibido no app para ligação rápida' },
      { key: 'seguradora_label', label: 'Seguradora — rótulo', type: 'text', default: 'Seguradora' },
      { key: 'seguradora_phone', label: 'Seguradora — telefone', type: 'text' },
      {
        key: 'company_alert_phones',
        label: 'Telefones da central (alerta automático)',
        type: 'textarea',
        hint: 'Um por linha ou separados por vírgula — recebem SMS/WhatsApp quando cliente aciona SOS',
      },
    ],
  },
};

function isSharedCapable(key) {
  if (!key || ['gateway', 'gateway_client'].includes(key)) return false;
  const schema = getSchema(key);
  if (schema?.sharedCapable === false) return false;
  return true;
}

function getSchema(key) {
  return INTEGRATIONS[key] || null;
}

function listSchemas() {
  return Object.entries(INTEGRATIONS).map(([key, schema]) => ({
    key,
    label: schema.label,
    description: schema.description,
    fields: schema.fields.map(({ secret, env, ...field }) => field),
  }));
}

function getDefaults(key) {
  const schema = getSchema(key);
  if (!schema) return {};

  const defaults = {};
  for (const field of schema.fields) {
    if (field.default !== undefined) {
      defaults[field.key] = field.default;
    } else if (field.env && process.env[field.env] !== undefined) {
      const raw = process.env[field.env];
      if (field.type === 'boolean') {
        defaults[field.key] = raw !== 'false';
      } else if (field.type === 'number') {
        defaults[field.key] = parseInt(raw, 10);
      } else {
        defaults[field.key] = raw;
      }
    }
  }
  return defaults;
}

function maskSettings(key, settings) {
  const schema = getSchema(key);
  if (!schema) return settings;

  const masked = { ...settings };
  for (const field of schema.fields) {
    if (!field.secret || !masked[field.key]) continue;
    const value = String(masked[field.key]);
    masked[field.key] = value.length <= 4 ? '****' : `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
  }
  return masked;
}

module.exports = {
  INTEGRATIONS,
  getSchema,
  listSchemas,
  getDefaults,
  maskSettings,
  isSharedCapable,
};
