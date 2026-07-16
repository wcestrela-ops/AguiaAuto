/**
 * Guias contextuais do painel admin.
 * Cada guia pode ser aberto pelo botão "?" (HelpButton) nas páginas correspondentes.
 */

export const ADMIN_GUIDES = {
  dashboard: {
    title: 'Primeiros passos no painel admin',
    summary: 'Configure integrações, gateways e veículos sem alterar código.',
    steps: [
      {
        title: '1. Integrações base',
        body: 'Comece em Integrações: GPSWOX (rastreamento), Firebase (push), SMTP (e-mail) e gateways de pagamento (Asaas + Mercado Pago).',
      },
      {
        title: '2. Comunicação',
        body: 'Configure WhatsApp (Evolution, WAHA ou Meta) e SMS Rastreador (Android ou gateway HTTP). Defina principal e backup em cada um.',
      },
      {
        title: '3. Veículos e rastreadores',
        body: 'Cadastre veículos manualmente ou sincronize do GPSWOX. Informe chip SIM, IMEI e modelo para failover 4G → SMS.',
      },
      {
        title: '4. Regra de ouro',
        body: 'Toda API key e credencial fica no painel admin ou no banco — nunca no código-fonte ou no repositório.',
      },
    ],
    links: [
      { label: 'Integrações', to: '/admin/integracoes' },
      { label: 'Veículos', to: '/admin/veiculos' },
    ],
  },

  integrations: {
    title: 'Como configurar integrações',
    summary: 'Cada card leva a um formulário com credenciais, teste de conexão e toggle habilitado/desabilitado.',
    steps: [
      {
        title: 'Escolha a integração',
        body: 'Clique no card desejado (GPSWOX, Asaas, Mercado Pago, Firebase, etc.). O badge indica se já está configurada.',
      },
      {
        title: 'Preencha os campos',
        body: 'Campos secretos (senhas, tokens) podem ficar em branco ao editar para manter o valor atual.',
      },
      {
        title: 'Teste e salve',
        body: 'Use "Testar Conexão" quando disponível. Depois clique em Salvar. Desmarque "Integração habilitada" para pausar sem apagar credenciais.',
      },
      {
        title: 'Ordem recomendada',
        body: 'GPSWOX → Firebase → SMTP → Mercado Pago + Asaas → Gateways de Pagamento (failover) → Alertas.',
      },
    ],
  },

  gpswox: {
    title: 'Como conectar o GPSWOX',
    summary: 'Motor de rastreamento usado internamente — o cliente vê apenas o app Águia.',
    steps: [
      {
        title: '1. URL e admin',
        body: 'Informe a URL da plataforma GPSWOX e o usuário/senha de administrador usados no painel.',
      },
      {
        title: '2. API Hash',
        body: 'Copie o API Hash oficial do GPSWOX (Configurações → API). Necessário para sync e comandos via API.',
      },
      {
        title: '3. Group ID padrão',
        body: 'ID do grupo onde novos clientes serão criados no GPSWOX ao provisionar assinatura.',
      },
      {
        title: '4. Playwright (headless)',
        body: 'Mantenha headless ativo em produção. O gateway interno usa automação quando a API oficial não cobre a ação.',
      },
      {
        title: '5. Sincronizar veículos',
        body: 'Após configurar, vá em Veículos → Prévia GPSWOX (dry-run) e depois Sincronizar GPSWOX. Clientes precisam ter gpswox_user_id vinculado.',
      },
    ],
    links: [{ label: 'Veículos', to: '/admin/veiculos' }],
  },

  asaas: {
    title: 'Como configurar o Asaas',
    summary: 'Gateway principal para cobranças recorrentes (PIX, boleto, cartão).',
    steps: [
      {
        title: '1. API Key',
        body: 'No painel Asaas: Integrações → API → copie a API Key de produção (ou sandbox para testes).',
      },
      {
        title: '2. Webhook',
        body: 'Configure o webhook do Asaas apontando para sua API: POST /webhooks/asaas. Informe o mesmo token em "Token do webhook".',
      },
      {
        title: '3. Sandbox',
        body: 'Ative sandbox apenas em homologação. Em produção, use credenciais reais e desmarque sandbox.',
      },
      {
        title: '4. Failover',
        body: 'Em Integrações → Gateways de Pagamento, defina Asaas como principal ou backup conforme sua estratégia (recorrente vs inicial).',
      },
    ],
    links: [
      { label: 'Gateways de Pagamento', to: '/admin/integracoes/payment_gateways' },
      { label: 'Financeiro', to: '/admin/financeiro' },
    ],
  },

  mercadopago: {
    title: 'Como configurar o Mercado Pago',
    summary: 'Recomendado para adesão inicial via PIX; também funciona como backup do Asaas.',
    steps: [
      {
        title: '1. Access Token',
        body: 'Em developers.mercadopago.com → sua aplicação → Credenciais de produção → Access Token.',
      },
      {
        title: '2. Public Key',
        body: 'Opcional no admin; útil se no futuro houver checkout no front. A cobrança via link usa o Access Token.',
      },
      {
        title: '3. Webhook / notificações',
        body: 'Configure a URL de notificação para POST /webhooks/mercadopago (ou use o campo notification_url). Informe o Webhook Secret se configurado.',
      },
      {
        title: '4. Uso no Águia',
        body: 'Cobranças do tipo "Adesão inicial" usam Mercado Pago primeiro. Mensalidades recorrentes preferem Asaas — ajuste em Gateways de Pagamento.',
      },
    ],
    links: [
      { label: 'Gateways de Pagamento', to: '/admin/integracoes/payment_gateways' },
      { label: 'Financeiro', to: '/admin/financeiro' },
    ],
  },

  payment_gateways: {
    title: 'Failover de gateways de pagamento',
    summary: 'Define qual gateway tenta primeiro e qual entra se o principal falhar.',
    steps: [
      {
        title: 'Inicial — principal / backup',
        body: 'Cobrança de adesão (primeiro pagamento): padrão Mercado Pago → Asaas. Ideal para PIX rápido na entrada.',
      },
      {
        title: 'Recorrente — principal / backup',
        body: 'Mensalidades: padrão Asaas → Mercado Pago. Asaas gerencia assinaturas e boletos recorrentes.',
      },
      {
        title: 'Failover automático',
        body: 'Com failover ativo, se o gateway principal retornar erro, o backup é tentado na mesma operação.',
      },
      {
        title: 'Pré-requisito',
        body: 'Configure Asaas e Mercado Pago antes. Veja o status em Financeiro → cards de gateway.',
      },
    ],
    links: [{ label: 'Financeiro', to: '/admin/financeiro' }],
  },

  firebase: {
    title: 'Firebase — notificações push',
    summary: 'Push no PWA e apps móveis. Service Account no servidor; chaves Web no cliente.',
    steps: [
      {
        title: 'Console Firebase',
        body: 'Crie projeto em console.firebase.google.com. Ative Cloud Messaging (FCM).',
      },
      {
        title: 'Chaves Web',
        body: 'Project ID, Web API Key, Messaging Sender ID, App ID e VAPID Key — usadas no front para registrar tokens.',
      },
      {
        title: 'Service Account',
        body: 'Configurações → Contas de serviço → Gerar chave JSON. Copie client_email e private_key para os campos correspondentes.',
      },
      {
        title: 'Teste',
        body: 'Salve e use Alertas → enviar teste push para um usuário com app/PWA aberto.',
      },
    ],
    links: [{ label: 'Alertas', to: '/admin/alertas' }],
  },

  smtp: {
    title: 'E-mail SMTP',
    summary: 'Cadastro, recuperação de senha e envio de credenciais ao cliente.',
    steps: [
      {
        title: 'Servidor e porta',
        body: 'Informe host SMTP (ex.: smtp.gmail.com, smtp.sendgrid.net) e porta. Use TLS direto (465) ou STARTTLS (587).',
      },
      {
        title: 'Autenticação',
        body: 'Usuário e senha do serviço de e-mail. Para Gmail, use senha de app.',
      },
      {
        title: 'Remetente',
        body: 'From e nome do remetente aparecem nos e-mails enviados pelo sistema.',
      },
    ],
  },

  alertas: {
    title: 'Motor de alertas GPSWOX',
    summary: 'Recebe eventos do GPSWOX e envia push (e WhatsApp apenas onde permitido).',
    steps: [
      {
        title: 'Webhook GPSWOX',
        body: 'Configure no GPSWOX a URL: POST https://SUA_API/webhooks/gpswox. Use o segredo configurado aqui para validação.',
      },
      {
        title: 'Canais de veículo',
        body: 'Alertas de veículo usam push por padrão — WhatsApp não é usado para eventos de rastreamento (anti-ban).',
      },
      {
        title: 'Deduplicação',
        body: 'Evita alertas repetidos do mesmo evento dentro do intervalo em minutos configurado.',
      },
    ],
    links: [{ label: 'Página Alertas', to: '/admin/alertas' }],
  },

  sms_gpswox_gateway: {
    title: 'Gateway SMS GPSWOX (entrada HTTP)',
    summary: 'URL que o painel GPSWOX chama para enviar SMS pela Águia (%NUMBER%, %MESSAGE%).',
    steps: [
      {
        title: '1. Credenciais',
        body: 'Defina usuário e senha que o GPSWOX enviará na query string (username, password).',
      },
      {
        title: '2. URL pública',
        body: 'Informe a URL pública da API (ex.: https://api.seudominio.com) para gerar o link correto no admin SMS.',
      },
      {
        title: '3. Colar no GPSWOX',
        body: 'Copie a URL de exemplo em SMS Rastreador e cole em GPSWOX → Configurações → Gateway SMS/WhatsApp.',
      },
      {
        title: '4. Gateway de saída',
        body: 'A Águia repassa o SMS pelo gateway principal (Android ou HTTP) configurado em /admin/sms.',
      },
    ],
    links: [{ label: 'SMS Rastreador', to: '/admin/sms' }],
  },

  whatsapp: {
    title: 'Como conectar WhatsApp',
    summary: 'Multi-provedor com principal e backup. Usado em cadastro, cobrança e promoções — não em alertas de veículo.',
    steps: [
      {
        title: '1. Escolha o provedor',
        body: 'Evolution API (self-hosted), WAHA ou Meta Cloud API oficial. Cadastre em + Novo Provedor.',
      },
      {
        title: '2. Evolution / WAHA',
        body: 'Informe URL base, API Key e nome da instância/sessão. Escaneie QR no servidor do provedor antes de testar.',
      },
      {
        title: '3. Meta Cloud API',
        body: 'Access Token, Phone Number ID e Business Account ID do Meta Business. Configure webhook verify token se usar callbacks.',
      },
      {
        title: '4. Principal e backup',
        body: 'Defina um provedor como Principal e outro como Backup. Se o principal falhar, mensagens usam o backup.',
      },
      {
        title: '5. Testar',
        body: 'Clique em Testar em cada provedor. Status "connected" indica que a sessão está ativa.',
      },
    ],
  },

  whatsapp_evolution: {
    title: 'Evolution API — passo a passo',
    summary: 'Instância self-hosted conectada via QR Code.',
    steps: [
      { title: 'URL Base', body: 'Endereço do Evolution (ex.: http://evolution:8080). Deve ser acessível pela API Águia.' },
      { title: 'API Key', body: 'Chave global configurada no Evolution (AUTHENTICATION_API_KEY).' },
      { title: 'Instância', body: 'Nome da instância criada no Evolution. Conecte via QR antes de testar.' },
    ],
  },

  whatsapp_waha: {
    title: 'WAHA — passo a passo',
    summary: 'WhatsApp HTTP API com sessões nomeadas.',
    steps: [
      { title: 'URL Base', body: 'Endereço do serviço WAHA.' },
      { title: 'API Key', body: 'Token de autenticação do WAHA.' },
      { title: 'Sessão', body: 'Nome da sessão WhatsApp. Inicie e escaneie QR no painel WAHA.' },
    ],
  },

  whatsapp_meta: {
    title: 'Meta Cloud API — passo a passo',
    summary: 'API oficial do WhatsApp Business.',
    steps: [
      { title: 'Access Token', body: 'Token permanente ou de sistema do app Meta.' },
      { title: 'Phone Number ID', body: 'ID do número WhatsApp Business no Graph API.' },
      { title: 'Business Account ID', body: 'WABA ID da conta comercial.' },
    ],
  },

  sms: {
    title: 'SMS Rastreador — visão geral',
    summary: 'Comandos ao chip do rastreador: failover 4G→SMS, envio manual e biblioteca por modelo.',
    steps: [
      {
        title: 'Gateway Android',
        body: 'Smartphone com chip SMS + agente HTTP. Cadastre URL, chave e device_id. O aparelho envia os SMS.',
      },
      {
        title: 'Gateway HTTP GPSWOX (saída)',
        body: 'Águia chama URL externa: .../sendsms.php?username=USER&password=PASSWORD&number=%NUMBER%&message=%MESSAGE%',
      },
      {
        title: 'Entrada GPSWOX',
        body: 'GPSWOX chama a Águia em /v1/sms/gateway/send. Configure credenciais em Integrações → Gateway SMS GPSWOX.',
      },
      {
        title: 'Biblioteca de comandos',
        body: 'Cadastre modelos (GT06, etc.) com comandos SMS editáveis. Veículos usam o modelo vinculado.',
      },
      {
        title: 'Failover automático',
        body: 'Quando bloqueio/desbloqueio via 4G falha, o sistema envia SMS se o veículo tiver chip SIM cadastrado.',
      },
    ],
    links: [
      { label: 'Veículos', to: '/admin/veiculos' },
      { label: 'Gateway GPSWOX entrada', to: '/admin/integracoes/sms_gpswox_gateway' },
    ],
  },

  sms_tracker_models: {
    title: 'Biblioteca de modelos e comandos SMS',
    summary: 'Cada modelo define os textos SMS (ex.: RELAY,1#) usados no failover e envio manual.',
    steps: [
      { title: 'Criar modelo', body: 'Informe nome, fabricante e protocolo (ex.: GT06).' },
      { title: 'Comandos', body: 'action_key (bloquear), label, sms_template e opcional gpswox_command para sync.' },
      { title: 'Veículo', body: 'Em Veículos, selecione o modelo na biblioteca para usar esses comandos automaticamente.' },
    ],
  },

  vehicles: {
    title: 'Como cadastrar um veículo / rastreador',
    summary: 'Fluxo completo: cliente, GPSWOX, chip SIM e modelo de comandos.',
    steps: [
      {
        title: '1. Cliente cadastrado',
        body: 'O veículo pertence a um cliente Águia. Cadastre o cliente antes ou use sync GPSWOX (requer gpswox_user_id no usuário).',
      },
      {
        title: '2. Dados do veículo',
        body: 'Placa obrigatória. Marca, modelo, cor e ano são opcionais para identificação no app.',
      },
      {
        title: '3. GPSWOX',
        body: 'Device ID liga o veículo ao dispositivo no GPSWOX. Use Sincronizar GPSWOX para importar em lote. Prévia mostra dry-run sem alterar dados.',
      },
      {
        title: '4. Chip SIM (SMS)',
        body: 'Número do chip no rastreador (5511...). Obrigatório para failover 4G→SMS e comandos manuais.',
      },
      {
        title: '5. Modelo do rastreador',
        body: 'Selecione na biblioteca SMS (ex.: GT06). Define comandos RELAY/WHERE usados automaticamente.',
      },
      {
        title: '6. IMEI',
        body: 'Identificador do hardware — útil para suporte e conferência com GPSWOX.',
      },
      {
        title: '7. Status',
        body: 'Aguardando instalação → Ativo após instalação confirmada. Inativo/Bloqueado conforme operação.',
      },
    ],
    links: [
      { label: 'SMS Rastreador', to: '/admin/sms' },
      { label: 'Integrações GPSWOX', to: '/admin/integracoes/gpswox' },
    ],
  },

  vehicles_sync: {
    title: 'Sincronizar veículos do GPSWOX',
    summary: 'Importa device_id, chip, IMEI e modelo do GPSWOX para o Águia.',
    steps: [
      { title: 'Prévia', body: 'Dry-run: mostra quantos dispositivos seriam importados sem gravar.' },
      { title: 'Sincronizar', body: 'Cria veículos novos e atualiza existentes pelo device_id.' },
      { title: 'Vínculo cliente', body: 'Novos veículos só são criados se o usuário Águia tiver gpswox_user_id correspondente.' },
      { title: 'Pré-requisito', body: 'GPSWOX configurado em Integrações com API Hash válido.' },
    ],
  },

  financeiro: {
    title: 'Financeiro e cobranças',
    summary: 'Cobranças manuais, status de gateways e provisionamento Asaas + GPSWOX.',
    steps: [
      {
        title: 'Gateways',
        body: 'Verifique cards Asaas e Mercado Pago. "Pendente" = configure em Integrações antes de cobrar.',
      },
      {
        title: 'Nova cobrança',
        body: 'Selecione cliente, valor, vencimento e tipo (mensalidade vs adesão inicial). PIX é recomendado.',
      },
      {
        title: 'Provisionamento',
        body: 'Reprovisionar recria cliente no Asaas e usuário/dispositivos no GPSWOX após pagamento confirmado.',
      },
      {
        title: 'Failover',
        body: 'Se um gateway falhar na cobrança, o backup é usado — configure em Gateways de Pagamento.',
      },
    ],
    links: [
      { label: 'Mercado Pago', to: '/admin/integracoes/mercadopago' },
      { label: 'Asaas', to: '/admin/integracoes/asaas' },
      { label: 'Failover', to: '/admin/integracoes/payment_gateways' },
    ],
  },

  admin_alerts: {
    title: 'Alertas e promoções',
    summary: 'Histórico de alertas, teste push e envio promocional via WhatsApp.',
    steps: [
      { title: 'Motor', body: 'Configure webhook e canais em Integrações → Motor de Alertas.' },
      { title: 'Teste', body: 'Envie alerta teste para um usuário — verifica push e canais configurados.' },
      { title: 'Promoções', body: 'WhatsApp promocional para usuários selecionados ou todos (use com moderação).' },
    ],
    links: [{ label: 'Integração Alertas', to: '/admin/integracoes/alertas' }],
  },
};

/** Guia por chave de integração (IntegrationEditPage) */
export const INTEGRATION_GUIDE_KEYS = {
  gpswox: 'gpswox',
  asaas: 'asaas',
  mercadopago: 'mercadopago',
  payment_gateways: 'payment_gateways',
  firebase: 'firebase',
  smtp: 'smtp',
  alertas: 'alertas',
  sms_gpswox_gateway: 'sms_gpswox_gateway',
};

export function getAdminGuide(guideId) {
  return ADMIN_GUIDES[guideId] || null;
}

export function getIntegrationGuide(integrationKey) {
  const guideId = INTEGRATION_GUIDE_KEYS[integrationKey];
  return guideId ? ADMIN_GUIDES[guideId] : null;
}
