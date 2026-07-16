/**
 * Guias contextuais do app cliente (PWA).
 * Abertos pelo botão "?" nas páginas correspondentes.
 */

export const CLIENT_GUIDES = {
  client_home: {
    title: 'Como usar o Meu Painel',
    summary: 'Visão geral dos seus veículos, financeiro, contratos e alertas em um só lugar.',
    steps: [
      {
        title: '1. Veículos',
        body: 'Veja quantos veículos estão ativos e acesse a localização, comandos e histórico de rotas.',
      },
      {
        title: '2. Financeiro',
        body: 'Confira se está em dia, o próximo vencimento e pague faturas via PIX ou link.',
      },
      {
        title: '3. Contratos',
        body: 'Leia e aceite o contrato de serviço e os dados de instalação. Sem aceite, o app fica bloqueado.',
      },
      {
        title: '4. Alertas',
        body: 'Notificações de ignição, velocidade, rota e âncora chegam por push — ative em Meu Perfil.',
      },
    ],
    links: [
      { label: 'Meus veículos', to: '/app/veiculos' },
      { label: 'Financeiro', to: '/app/financeiro' },
      { label: 'Meu perfil', to: '/app/perfil' },
    ],
  },

  client_vehicles: {
    title: 'Meus veículos',
    summary: 'Lista de veículos vinculados à sua conta. Toque em um para ver mapa, comandos e histórico.',
    steps: [
      {
        title: 'Status do veículo',
        body: 'Ativo = rastreador instalado e funcionando. Bloqueado = motor cortado. Pendente = aguardando instalação.',
      },
      {
        title: 'Sem veículos?',
        body: 'Entre em contato com o suporte. O veículo precisa estar cadastrado e vinculado ao seu e-mail no sistema.',
      },
      {
        title: 'Detalhes',
        body: 'Na tela do veículo você vê localização ao vivo, compartilhamento temporário, comandos e rotas.',
      },
    ],
  },

  client_vehicle_detail: {
    title: 'Detalhes do veículo',
    summary: 'Localização em tempo real, compartilhamento, comandos do rastreador e histórico de rotas.',
    steps: [
      {
        title: 'Mapa ao vivo',
        body: 'Mostra a última posição conhecida. Use "Atualizar" ou o comando "Localizar agora" para forçar nova posição.',
      },
      {
        title: 'Compartilhar GPSWOX',
        body: 'Gera um link temporário (60 min) para outra pessoa acompanhar a localização sem login.',
      },
      {
        title: 'Histórico de rotas',
        body: 'Escolha 24h ou 7 dias e clique em Carregar para ver o percurso no mapa e na tabela.',
      },
      {
        title: 'Aguardando instalação',
        body: 'Se o status for "pendente instalação", o mapa e comandos ficam indisponíveis até o instalador concluir.',
      },
    ],
    links: [
      { label: 'Comandos do rastreador', to: '/app/veiculos' },
    ],
  },

  client_vehicle_commands: {
    title: 'Comandos do rastreador',
    summary: 'Bloquear, desbloquear, ligar/desligar motor, localizar e âncora. Tentamos 4G primeiro; se falhar, SMS.',
    steps: [
      {
        title: 'Bloquear / Desbloquear',
        body: 'Corta ou libera o motor remotamente. O status do veículo muda para "bloqueado" quando aplicado.',
      },
      {
        title: 'Ligar / Desligar motor',
        body: 'Comandos de ignição remota — dependem do modelo do rastreador instalado.',
      },
      {
        title: 'Localizar agora',
        body: 'Solicita nova posição GPS. Útil quando o mapa está desatualizado.',
      },
      {
        title: 'Feedback do comando',
        body: 'Após cada comando, veja se foi enviado por 4G ou SMS e se teve sucesso. O histórico fica abaixo dos botões.',
      },
      {
        title: 'Veículo bloqueado',
        body: 'Com a âncora ativa, alguns comandos ficam desabilitados até desativar a âncora.',
      },
    ],
  },

  client_vehicle_anchor: {
    title: 'Âncora (cerca virtual)',
    summary: 'Fixa o veículo em um ponto. Se ligar e sair do raio sem desativar, o bloqueio automático é enviado.',
    steps: [
      {
        title: 'Ativar',
        body: 'Com o veículo parado no local desejado, toque em "Âncora". O raio padrão é 10 metros.',
      },
      {
        title: 'Monitoramento',
        body: 'Enquanto ativa, um badge amarelo aparece no topo. O sistema monitora movimento e ignição.',
      },
      {
        title: 'Alerta automático',
        body: 'Se o veículo ligar e ultrapassar o raio, recebe bloqueio automático e alerta por push.',
      },
      {
        title: 'Desativar',
        body: 'Toque em "Desativar âncora" antes de usar o veículo normalmente.',
      },
    ],
  },

  client_financeiro: {
    title: 'Financeiro',
    summary: 'Situação da assinatura, faturas pendentes, PIX copia e cola e segunda via de pagamento.',
    steps: [
      {
        title: 'Situação',
        body: 'Em dia = sem pendências. Em atraso = há fatura vencida — regularize para evitar bloqueio do serviço.',
      },
      {
        title: 'Pagar fatura',
        body: 'Use "Copiar PIX" ou o botão "Pagar" (link Asaas/Mercado Pago). O pagamento pode levar alguns minutos para confirmar.',
      },
      {
        title: 'Segunda via',
        body: 'Se o link expirou, clique em "2ª via" para gerar novo PIX ou boleto.',
      },
      {
        title: 'Desconto por indicação',
        body: 'Indicações confirmadas geram desconto ou mensalidade isenta — veja em Meu Perfil.',
      },
    ],
    links: [
      { label: 'Meu perfil (indicações)', to: '/app/perfil' },
    ],
  },

  client_contract: {
    title: 'Contratos e instalação',
    summary: 'Aceite obrigatório do contrato de serviço. Instalações novas podem vir junto no mesmo aceite.',
    steps: [
      {
        title: 'Primeiro acesso',
        body: 'Leia o contrato, marque a caixa de confirmação e aceite. Com instalação pendente, os dados do rastreador vêm no mesmo documento.',
      },
      {
        title: 'Bloqueio do app',
        body: 'Enquanto o contrato não for aceito, as outras áreas do app ficam redirecionadas para esta página.',
      },
      {
        title: 'Nova instalação',
        body: 'Veículos instalados depois do cadastro exigem aceite separado dos dados de entrega.',
      },
      {
        title: 'Download',
        body: 'Após aceitar, baixe a cópia do contrato ou da instalação a qualquer momento.',
      },
    ],
  },

  client_alerts: {
    title: 'Alertas',
    summary: 'Notificações de veículo (ignição, velocidade, rota, âncora) chegam por push neste app.',
    steps: [
      {
        title: 'Lista de alertas',
        body: 'Alertas não lidos aparecem destacados. Marque individualmente ou use "Marcar todos lidos".',
      },
      {
        title: 'Configurar',
        body: 'Escolha quais tipos de alerta deseja receber. Push para alertas de veículo é sempre recomendado.',
      },
      {
        title: 'WhatsApp',
        body: 'Alertas de rastreamento não vão por WhatsApp — reservado para cadastro e cobranças, para evitar bloqueio.',
      },
      {
        title: 'Sem alertas?',
        body: 'Ative notificações push em Meu Perfil e permita no navegador/celular.',
      },
    ],
    links: [
      { label: 'Ativar push', to: '/app/perfil' },
    ],
  },

  client_frota: {
    title: 'Documentos e manutenção',
    summary: 'CRLV, seguro, IPVA e histórico de revisões por veículo.',
    steps: [
      {
        title: 'Documentos',
        body: 'Cadastre CRLV, seguro, IPVA ou licenciamento com data de vencimento. Anexe PDF ou foto para consulta rápida.',
      },
      {
        title: 'Alertas de vencimento',
        body: 'Documentos vencidos ou a vencer em 30 dias aparecem destacados no painel e em Meu Painel.',
      },
      {
        title: 'Manutenção',
        body: 'Registre troca de óleo, revisões e pneus. Informe a próxima data ou KM para lembrete.',
      },
    ],
    links: [{ label: 'Meus veículos', to: '/app/veiculos' }],
  },

  client_frota_docs: {
    title: 'Documentos do veículo',
    summary: 'Anexe CRLV, seguro e IPVA com vencimento.',
    steps: [
      { title: 'Cadastro', body: 'Escolha o veículo, tipo e vencimento. PDF ou foto opcional.' },
      { title: 'Editar', body: 'Use "Editar" para alterar dados ou substituir o anexo. O veículo não pode ser trocado após o cadastro.' },
      { title: 'Consulta', body: 'Toque em "Ver arquivo" para abrir o anexo em nova aba.' },
    ],
  },

  client_frota_maint: {
    title: 'Manutenção',
    summary: 'Histórico e próximas revisões.',
    steps: [
      { title: 'Registrar', body: 'Informe data, KM e próxima revisão prevista.' },
      { title: 'Editar', body: 'Corrija datas, KM, custo ou observações pelo botão "Editar" na lista.' },
      { title: 'Lembretes', body: 'Revisões próximas ou atrasadas aparecem com badge de alerta.' },
    ],
  },

  client_emergency: {
    title: 'Botão de emergência (SOS)',
    summary: 'Notifica contatos de confiança por WhatsApp/SMS com localização do veículo.',
    steps: [
      { title: 'Cadastre contatos', body: 'Informe nome e telefone de até 5 pessoas que receberão o alerta.' },
      { title: 'Acione o SOS', body: 'Escolha o veículo para incluir GPS. Selecione SOS e confirme.' },
      { title: 'Risco imediato', body: 'Em perigo grave, ligue 190 — o SOS complementa, não substitui.' },
    ],
    links: [{ label: 'Meu perfil', to: '/app/perfil' }],
  },

  client_emergency_dial: {
    title: 'Ligação rápida',
    summary: '190, 193, 192 e telefones da Águia configurados pelo admin.',
    steps: [
      { title: 'Toque no card', body: 'Abre o discador do celular com o número.' },
    ],
  },

  client_emergency_contacts: {
    title: 'Contatos de emergência',
    summary: 'Quem recebe SMS/WhatsApp quando você aciona o SOS.',
    steps: [
      { title: 'Salvar', body: 'Use números com DDD. Mantenha atualizado.' },
    ],
  },

  client_profile: {
    title: 'Meu perfil',
    summary: 'Dados pessoais, indicações, senha e notificações push do dispositivo.',
    steps: [
      {
        title: 'Indique e ganhe',
        body: 'Compartilhe seu link. Quando o indicado instalar e aceitar o contrato, você ganha desconto na mensalidade.',
      },
      {
        title: 'Push',
        body: 'Toque em "Ativar notificações" e permita no navegador. Use "Enviar teste" para confirmar.',
      },
      {
        title: 'Permissão negada',
        body: 'No celular, vá em Configurações do navegador → Notificações → permitir para este site.',
      },
      {
        title: 'Senha',
        body: 'Após alterar a senha, faça login novamente em todos os dispositivos.',
      },
    ],
    links: [
      { label: 'Alertas', to: '/app/alertas' },
    ],
  },
};

export function getClientGuide(guideId) {
  return CLIENT_GUIDES[guideId] || null;
}
