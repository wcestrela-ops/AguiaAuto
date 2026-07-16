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

  rastreamento: {
    title: 'Plataforma de rastreamento',
    summary: 'Escolha GPSWOX ou Traccar sem alterar código — só mudar aqui e recarregar integrações.',
    steps: [
      {
        title: '1. Configure as duas (opcional)',
        body: 'Cadastre credenciais em GPSWOX e/ou Traccar. Só a plataforma ativa será usada pela API e pelo gateway.',
      },
      {
        title: '2. Selecione a ativa',
        body: 'Em Plataforma ativa, escolha GPSWOX ou Traccar. Salve e use Integrações → Recarregar cache.',
      },
      {
        title: '3. Provisionamento e sync',
        body: 'Novos clientes e sync de veículos usam a plataforma selecionada. Veículos antigos mantêm IDs da plataforma original até migração.',
      },
    ],
    links: [
      { label: 'GPSWOX', to: '/admin/integracoes/gpswox' },
      { label: 'Traccar', to: '/admin/integracoes/traccar' },
    ],
  },

  traccar: {
    title: 'Como conectar o Traccar',
    summary: 'Servidor Traccar self-hosted ou cloud — API REST nativa, sem Playwright.',
    steps: [
      {
        title: '1. URL e credenciais',
        body: 'Informe a URL base (ex.: https://traccar.seudominio.com) e e-mail/senha de administrador, ou token API se configurado.',
      },
      {
        title: '2. Teste a conexão',
        body: 'Use Testar Conexão — verifica /api/health e autenticação em /api/devices.',
      },
      {
        title: '3. Ative no roteamento',
        body: 'Em Plataforma de Rastreamento, selecione Traccar como plataforma ativa e recarregue o cache.',
      },
      {
        title: '4. Group ID',
        body: 'Opcional: ID do grupo Traccar onde novos devices serão criados no provisionamento.',
      },
    ],
    links: [
      { label: 'Plataforma de Rastreamento', to: '/admin/integracoes/rastreamento' },
      { label: 'Veículos', to: '/admin/veiculos' },
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
        body: 'Após configurar, use sync automático (24h) ou Veículos → Sincronizar GPSWOX. Clientes precisam ter tracker_user_id vinculado.',
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

  sms_gpswox_templates: {
    title: 'Templates SMS na API GPSWOX',
    summary: 'Sincronize modelos SMS entre Águia e GPSWOX via API oficial (user_api_hash).',
    steps: [
      {
        title: 'Pré-requisito',
        body: 'Configure GPSWOX em Integrações com URL e API Hash. O hash admin é usado em get_user_sms_templates.',
      },
      {
        title: 'Listar GPSWOX',
        body: 'Carrega templates existentes no painel GPSWOX (title + message).',
      },
      {
        title: 'Importar → Águia',
        body: 'Copia templates GPSWOX para o modelo selecionado. Comandos com mesmo ID GPSWOX são atualizados.',
      },
      {
        title: 'Enviar Águia → GPSWOX',
        body: 'Cria ou atualiza templates no GPSWOX a partir dos comandos do modelo. Salva gpswox_sms_template_id no comando.',
      },
      {
        title: 'Endpoints usados',
        body: 'GET get_user_sms_templates · POST add_user_sms_template · POST edit_user_sms_template · GET get_user_sms_message',
      },
    ],
    links: [{ label: 'Integrações GPSWOX', to: '/admin/integracoes/gpswox' }],
  },

  vehicles: {
    title: 'Como cadastrar um veículo / rastreador',
    summary: 'Fluxo completo: cliente, GPSWOX, chip SIM e modelo de comandos.',
    steps: [
      {
        title: '1. Cliente cadastrado',
        body: 'O veículo pertence a um cliente Águia. Cadastre o cliente antes ou use sync GPSWOX (requer tracker_user_id no usuário).',
      },
      {
        title: '2. Dados do veículo',
        body: 'Placa opcional (veículos novos podem estar sem emplacamento). Marca, modelo, cor e ano ajudam na identificação no app.',
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
      {
        title: '8. Filtros',
        body: 'Busque por placa, cliente, Device ID, IMEI ou chip. Filtre por status, cliente, pendências (sem device/chip/IMEI/modelo) e exporte a lista filtrada.',
      },
      {
        title: '9. Atribuição de instalador',
        body: 'Veículos "Aguardando instalação" podem ficar no pool (qualquer instalador) ou ser atribuídos a um instalador específico, com data/hora opcional. O instalador recebe push na atribuição.',
      },
    ],
    links: [
      { label: 'SMS Rastreador', to: '/admin/sms' },
      { label: 'Integrações GPSWOX', to: '/admin/integracoes/gpswox' },
    ],
  },

  vehicles_sync: {
    title: 'Sincronizar veículos do GPSWOX',
    summary: 'Importa device_id, chip, IMEI e modelo do GPSWOX para o Águia — manual ou automático.',
    steps: [
      { title: 'Sync automático', body: 'Ative em Integrações → GPSWOX. Padrão: a cada 24h a API importa/atualiza veículos.' },
      { title: 'Prévia', body: 'Dry-run manual: mostra quantos dispositivos seriam importados sem gravar.' },
      { title: 'Sincronizar', body: 'Manual imediato: cria veículos novos e atualiza existentes pelo device_id.' },
      { title: 'Vínculo cliente', body: 'Novos veículos só são criados se o usuário Águia tiver tracker_user_id correspondente.' },
      { title: 'Sem cliente', body: 'Dispositivos ignorados aparecem no dashboard operacional — vincule o cliente e aguarde o próximo sync.' },
      { title: 'Pré-requisito', body: 'GPSWOX configurado com API Hash + gateway interno rodando.' },
    ],
    links: [{ label: 'Integrações GPSWOX', to: '/admin/integracoes/gpswox' }],
  },

  financeiro: {
    title: 'Financeiro e cobranças',
    summary: 'Cobranças manuais, status de gateways, provisionamento e lembretes WhatsApp→SMS.',
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
        title: 'Lembrete ao cliente',
        body: 'Configure dias e templates em Integrações → Cobrança. WhatsApp primeiro; SMS opcional para não duplicar outros envios.',
      },
      {
        title: 'Baixa manual',
        body: 'Para pagamento em dinheiro/espécie, use "Baixa manual" na cobrança. Opcionalmente notifica o cliente com template personalizado.',
      },
      {
        title: 'Coluna Notificação',
        body: 'WhatsApp = entregue pelo WhatsApp. SMS (fallback) = WhatsApp falhou e SMS foi usado. Falhou = nenhum canal.',
      },
      {
        title: 'Provisionamento',
        body: 'Reprovisionar recria cliente no Asaas e usuário/dispositivos no GPSWOX após pagamento confirmado.',
      },
      {
        title: 'Failover pagamento',
        body: 'Se um gateway falhar na cobrança, o backup é usado — configure em Gateways de Pagamento.',
      },
    ],
    links: [
      { label: 'Cobrança e lembretes', to: '/admin/integracoes/cobranca' },
      { label: 'Mercado Pago', to: '/admin/integracoes/mercadopago' },
      { label: 'Asaas', to: '/admin/integracoes/asaas' },
      { label: 'Failover', to: '/admin/integracoes/payment_gateways' },
    ],
  },

  cobranca: {
    title: 'Cobrança e lembretes automáticos',
    summary: 'Dias de lembrete, templates personalizados, SMS opcional e confirmação de pagamento.',
    steps: [
      {
        title: 'Dias de lembrete',
        body: 'Ative vencimento (dia 0), +1, +2, +3 e +15 dias após o vencimento. O job roda periodicamente conforme intervalo configurado.',
      },
      {
        title: 'SMS opcional',
        body: 'Desative "Permitir SMS nos lembretes" se você envia cobrança por outro canal. Ative "somente SMS" para lembretes agendados sem WhatsApp.',
      },
      {
        title: 'Mensagem consolidada por cliente',
        body: 'Se o cliente tiver várias faturas em aberto, o sistema envia uma única mensagem por dia (não uma por fatura). {{resumo_valor}}, {{resumo_vencimento}} e {{resumo_atraso}} adaptam o texto automaticamente; {{detalhe_faturas}} lista cada fatura quando há 2 ou mais; {{total_valor}} é sempre a soma. O PIX/link é atualizado no gateway antes do envio.',
      },
      {
        title: 'Templates',
        body: 'Variáveis: {{cliente}}, {{valor}}, {{total_valor}}, {{vencimento}}, {{resumo_valor}}, {{resumo_vencimento}}, {{resumo_atraso}}, {{detalhe_faturas}}, {{lista_faturas}}, {{faturas_pendentes}}, {{meses_atraso}}, {{pix}}, {{link}}, {{pix_ou_link}}, {{dias_atraso}}, {{data_pagamento}}.',
      },
      {
        title: 'Pagamento recebido',
        body: 'Webhook automático e baixa manual podem enviar confirmação usando template_payment_received.',
      },
    ],
    links: [{ label: 'Financeiro', to: '/admin/financeiro' }],
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

  admin_contratos: {
    title: 'Contratos e aceites',
    summary: 'Edite modelos HTML e consulte aceites assinados pelos clientes.',
    steps: [
      {
        title: 'Modelos',
        body: 'Contrato de Prestação de Serviços e Termo de Entrega/Instalação. Ao salvar, a versão incrementa — novos aceites usam o texto atualizado.',
      },
      {
        title: 'Aceites',
        body: 'Lista de assinaturas com data, cliente, tipo e placa. Baixe a cópia assinada (snapshot) quando disponível.',
      },
      {
        title: 'Bloqueio no app',
        body: 'Clientes sem contrato de serviço aceito recebem CONTRACT_REQUIRED e são redirecionados para /app/contratos.',
      },
    ],
    links: [
      { label: 'Instaladores', to: '/admin/instaladores' },
      { label: 'Veículos', to: '/admin/veiculos' },
    ],
  },

  instaladores: {
    title: 'Fluxo de instalação',
    summary: 'Cadastre instaladores, deixe veículos pendentes e o campo preenche IMEI, chip e modelo no checklist.',
    steps: [
      {
        title: '1. Criar instalador',
        body: 'Cadastre e-mail e senha aqui. Credenciais são enviadas por e-mail/WhatsApp. Login em /login redireciona para /instalador.',
      },
      {
        title: '2. Veículo pendente',
        body: 'Em Veículos, cadastre com status "Aguardando instalação". Device ID pode ficar vazio — o instalador preenche na finalização. Atribua um instalador ou deixe no pool.',
      },
      {
        title: '3. Atribuição',
        body: 'Na lista de veículos pendentes, selecione instalador e opcionalmente data/hora. Sem atribuição = pool visível para todos os instaladores.',
      },
      {
        title: '4. Checklist na instalação',
        body: 'Instalador informa Device ID, IMEI (15 dígitos), chip SIM, modelo do rastreador, mínimo 1 foto e teste de comunicação.',
      },
      {
        title: '5. Cliente aceita',
        body: 'Após finalizar, o cliente recebe push e aceita contrato + dados de instalação em /app/contratos.',
      },
      {
        title: '6. Veículo ativo',
        body: 'IMEI, chip e modelo são gravados no veículo automaticamente — habilita comandos 4G/SMS no app cliente.',
      },
    ],
    links: [
      { label: 'Veículos', to: '/admin/veiculos' },
      { label: 'Contratos', to: '/admin/contratos' },
    ],
  },

  operational_dashboard: {
    title: 'Painel operacional',
    summary: 'Indicadores do que trava a operação no dia a dia — veículos, comandos, SMS e financeiro.',
    steps: [
      { title: 'Aguardando instalação', body: 'Veículos pendentes de instalação — atribua instalador ou deixe no pool. Veja colunas Instalador e Agendamento.' },
      { title: 'Cobrança SMS fallback', body: 'Lembretes que foram para SMS porque WhatsApp falhou — veja Financeiro.' },
      { title: 'Lembretes falharam', body: 'Cobranças em que WhatsApp e SMS não entregaram o lembrete.' },
      { title: 'Veículos sem IMEI', body: 'Ativos/bloqueados sem tracker_imei — deveriam ser preenchidos no checklist do instalador.' },
      { title: 'Veículos sem chip', body: 'Ativos/bloqueados sem tracker_phone não têm backup SMS.' },
      { title: 'Comandos com falha', body: 'Últimas 24h — bloqueio/desbloqueio que nem 4G nem SMS conseguiram.' },
      { title: 'Provisionamento', body: 'Clientes sem Asaas/GPSWOX completo — veja Financeiro → Reprovisionar.' },
      { title: 'Faturas vencidas', body: 'Cobranças pending/overdue com vencimento passado.' },
      { title: 'Documentos vencendo', body: 'CRLV, seguro e IPVA com vencimento em 30 dias — veja Documentos no admin.' },
      { title: 'Manutenções próximas', body: 'Revisões programadas ou atrasadas por veículo.' },
      { title: 'Emergências (SOS)', body: 'Acionamentos do botão de pânico nas últimas 24h — veja em Emergência no menu admin.' },
      { title: 'Clientes inativos', body: 'Contas ativas sem login no app há 30+ dias (ou nunca acessaram) — filtre em Clientes.' },
    ],
    links: [
      { label: 'Clientes', to: '/admin/clientes' },
      { label: 'Emergência (SOS)', to: '/admin/emergencia' },
      { label: 'Instaladores', to: '/admin/instaladores' },
      { label: 'Veículos', to: '/admin/veiculos' },
      { label: 'Financeiro', to: '/admin/financeiro' },
      { label: 'Documentos', to: '/admin/frota' },
      { label: 'SMS', to: '/admin/sms' },
    ],
  },

  admin_plans: {
    title: 'Planos de assinatura',
    summary: 'Cadastre e edite planos exibidos no cadastro online e na landing page.',
    steps: [
      { title: 'Criar plano', body: 'Informe nome, descrição, valor mensal e marque como ativo para aparecer em /cadastro e na home pública.' },
      { title: 'Desativar', body: 'Planos inativos não aparecem para novos clientes, mas assinaturas existentes continuam.' },
      { title: 'Landing', body: 'A seção de planos na landing usa automaticamente os planos ativos cadastrados aqui.' },
    ],
    links: [
      { label: 'Landing page', to: '/admin/site' },
      { label: 'Financeiro', to: '/admin/financeiro' },
    ],
  },

  admin_landing: {
    title: 'Landing page pública',
    summary: 'Edite textos, recursos, contato e rodapé da página inicial (/) sem deploy.',
    steps: [
      { title: 'Hero', body: 'Título, subtítulo e botões principais (Cadastro / Login). Links relativos como /cadastro funcionam.' },
      { title: 'Recursos', body: 'Cards de benefícios com ícone emoji, título e descrição — adicione ou remova quantos precisar.' },
      { title: 'Planos', body: 'Ative a seção para listar planos ativos. Títulos editáveis; valores vêm de Planos.' },
      { title: 'Contato', body: 'Telefone, WhatsApp e e-mail aparecem no rodapé da landing.' },
      { title: 'Desativar', body: 'Com "Landing page ativa" desligada, visitantes em / são redirecionados para login.' },
    ],
    links: [
      { label: 'Planos', to: '/admin/planos' },
      { label: 'Ver site', to: '/' },
    ],
  },

  admin_frota: {
    title: 'Documentos e manutenção',
    summary: 'Gestão de CRLV, seguro, IPVA, revisões e lembretes push automáticos.',
    steps: [
      { title: 'Documentos', body: 'Cadastre vencimentos e anexe PDF/foto. Use Editar para alterar dados ou substituir o anexo; Ver anexo abre o arquivo em nova aba.' },
      { title: 'Manutenção', body: 'Registre serviços realizados e próxima revisão (data ou KM). Edite registros existentes pela tabela.' },
      { title: 'Lembretes push', body: 'Aba "Lembretes push" mostra status, histórico por canal (push/WhatsApp/SMS) e botão "Executar agora".' },
      { title: 'Push automático', body: 'Configure canais, intervalo e template em Integrações → Documentos e Manutenção.' },
      { title: 'Cliente', body: 'O cliente também pode cadastrar em /app/frota — você vê tudo aqui.' },
    ],
    links: [
      { label: 'Veículos', to: '/admin/veiculos' },
      { label: 'Integração Frota', to: '/admin/integracoes/frota' },
    ],
  },

  admin_indicacoes: {
    title: 'Indique e Ganhe',
    summary: 'Indicações confirmadas geram 50% de desconto por mês; duas no mês isentam a mensalidade.',
    steps: [
      { title: 'Qualificação', body: 'Indicado precisa concluir instalação, aceitar contrato e ter veículo ativo.' },
      { title: 'Desconto automático', body: 'Poller aplica desconto na mensalidade do mês. Use "Sincronizar" para forçar.' },
      { title: 'Cliente', body: 'Link e código ficam em Meu Perfil no app cliente.' },
    ],
    links: [{ label: 'Financeiro', to: '/admin/financeiro' }],
  },

  admin_audit: {
    title: 'Auditoria administrativa',
    summary: 'Histórico ampliado de ações sensíveis no painel, financeiro, frota, integrações e app cliente.',
    steps: [
      { title: 'O que é registrado', body: 'Veículos e clientes (admin), documentos/manutenção de frota, lembretes push, cobranças e provisionamento, integrações, comandos remotos e sync GPSWOX.' },
      { title: 'Filtros', body: 'Filtre por ação, ator, recurso, ID do recurso, busca livre (placa, metadados) e intervalo de datas.' },
      { title: 'Detalhes', body: 'Clique em JSON para metadados completos. Links levam à ficha do cliente ou integração quando aplicável.' },
    ],
    links: [
      { label: 'Clientes', to: '/admin/clientes' },
      { label: 'Veículos', to: '/admin/veiculos' },
      { label: 'Integrações GPSWOX', to: '/admin/integracoes/gpswox' },
    ],
  },

  admin_clientes: {
    title: 'Painel de clientes',
    summary: 'Ficha completa com cadastro, veículos, financeiro, provisionamento e indicações.',
    steps: [
      { title: 'Lista', body: 'Busque por nome, e-mail, telefone ou CPF. Filtre por status ativo, provisionamento e último acesso (7/30/60/90 dias ou nunca). Exporte a lista filtrada em Excel (.xlsx) ou PDF.' },
      { title: 'Ficha do cliente', body: 'Edite nome, telefone e bloqueie acesso desativando a conta. Veja veículos, faturas recentes e último acesso ao app. Use Excel/PDF na ficha para exportar resumo, veículos e faturas.' },
      { title: 'Provisionamento', body: 'Use Reprovisionar para retentar Asaas + GPSWOX quando houver falha parcial ou pendência.' },
      { title: 'Atalhos', body: 'Links rápidos para Financeiro, Veículos e Indique e Ganhe a partir da ficha.' },
    ],
    links: [
      { label: 'Financeiro', to: '/admin/financeiro' },
      { label: 'Veículos', to: '/admin/veiculos' },
      { label: 'Indicações', to: '/admin/indicacoes' },
    ],
  },

  emergencia: {
    title: 'Emergência (SOS)',
    summary: 'Botão de pânico no app — alerta contatos e central via WhatsApp/SMS.',
    steps: [
      { title: 'Central', body: 'Informe telefones em "Telefones da central" — recebem alerta automático a cada SOS.' },
      { title: 'Assistência 24h', body: 'Exibido no app para ligação rápida (não envia alerta automático).' },
      { title: 'Canais', body: 'WhatsApp primeiro, SMS como fallback — igual cobrança.' },
      { title: 'Cooldown', body: 'Intervalo mínimo entre acionamentos evita spam acidental.' },
    ],
    links: [
      { label: 'Painel SOS', to: '/admin/emergencia' },
      { label: 'Integrações', to: '/admin/integracoes' },
    ],
  },

  admin_emergencia: {
    title: 'Painel de Emergência (SOS)',
    summary: 'Monitore acionamentos do botão de pânico com cliente, veículo e mapa.',
    steps: [
      { title: '24 horas', body: 'O card superior mostra quantos SOS ocorreram nas últimas 24h — o mesmo dado do dashboard operacional.' },
      { title: 'Localização', body: 'Endereço e coordenadas vêm do GPSWOX no momento do acionamento. Use "Abrir mapa" para Google Maps.' },
      { title: 'Canais', body: 'Expanda "Detalhes" para ver WhatsApp/SMS por telefone e status de entrega.' },
      { title: 'Cliente', body: 'Link "Ficha" abre o painel de clientes com cadastro e financeiro.' },
    ],
    links: [
      { label: 'Configurar SOS', to: '/admin/integracoes/emergencia' },
      { label: 'Clientes', to: '/admin/clientes' },
    ],
  },

  cadastro: {
    title: 'Notificações de cadastro',
    summary: 'E-mail, push, WhatsApp/SMS ao cliente e alerta à central em cada novo cadastro.',
    steps: [
      { title: 'Cliente', body: 'Recebe e-mail com credenciais, WhatsApp/SMS de boas-vindas e push (se Firebase ativo e app com token).' },
      { title: 'Central', body: 'Telefones e e-mails configurados recebem resumo: nome, plano, veículo, indicação.' },
      { title: 'WhatsApp + SMS', body: 'WhatsApp primeiro; SMS como fallback quando habilitado (cliente e central).' },
      { title: 'Template central', body: 'Personalize a mensagem com variáveis {{nome}}, {{plano}}, {{veiculo}}, etc.' },
    ],
    links: [
      { label: 'Integrações', to: '/admin/integracoes/cadastro' },
      { label: 'Clientes', to: '/admin/clientes' },
    ],
  },

  frota: {
    title: 'Lembretes de documentos e manutenção',
    summary: 'Push, WhatsApp e SMS automáticos quando CRLV, seguro, IPVA ou revisões estão vencendo ou atrasados.',
    steps: [
      {
        title: 'Consolidado por cliente',
        body: 'No máximo um lembrete por dia por cliente, mesmo com vários documentos ou manutenções pendentes.',
      },
      {
        title: 'Canais',
        body: 'Push (Firebase), WhatsApp no telefone cadastrado e SMS opcional (fallback ou exclusivo). Pelo menos um canal deve estar ativo.',
      },
      {
        title: 'Antecedência',
        body: 'Itens com vencimento dentro do prazo configurado (padrão 30 dias) entram no lembrete — inclui já vencidos.',
      },
      {
        title: 'Template',
        body: 'Personalize a mensagem WhatsApp/SMS com variáveis como {{cliente}}, {{resumo}} e {{detalhe_itens}}.',
      },
      {
        title: 'Histórico admin',
        body: 'Na aba Lembretes push em /admin/frota: status, rodadas recentes, histórico por canal e execução manual.',
      },
    ],
    links: [
      { label: 'Documentos (admin)', to: '/admin/frota' },
      { label: 'Firebase', to: '/admin/integracoes/firebase' },
    ],
  },
};

/** Guia por chave de integração (IntegrationEditPage) */
export const INTEGRATION_GUIDE_KEYS = {
  rastreamento: 'rastreamento',
  traccar: 'traccar',
  gpswox: 'gpswox',
  asaas: 'asaas',
  mercadopago: 'mercadopago',
  payment_gateways: 'payment_gateways',
  firebase: 'firebase',
  smtp: 'smtp',
  alertas: 'alertas',
  sms_gpswox_gateway: 'sms_gpswox_gateway',
  cobranca: 'cobranca',
  cadastro: 'cadastro',
  frota: 'frota',
  emergencia: 'emergencia',
};

export function getAdminGuide(guideId) {
  return ADMIN_GUIDES[guideId] || null;
}

export function getIntegrationGuide(integrationKey) {
  const guideId = INTEGRATION_GUIDE_KEYS[integrationKey];
  return guideId ? ADMIN_GUIDES[guideId] : null;
}
