/**
 * Guias contextuais da área do instalador.
 */

export const INSTALLER_GUIDES = {
  installer_home: {
    title: 'Painel do instalador',
    summary: 'Veja quantas instalações estão pendentes e acesse o histórico recente.',
    steps: [
      {
        title: 'Agendamentos',
        body: 'Lista todos os veículos com status "aguardando instalação". Toque em um para abrir o checklist de finalização.',
      },
      {
        title: 'Após finalizar',
        body: 'O cliente recebe push e deve aceitar o relatório em Contratos no app. Até lá, mapa e comandos ficam bloqueados.',
      },
    ],
    links: [
      { label: 'Agendamentos', to: '/instalador/agendamentos' },
    ],
  },

  installer_pending: {
    title: 'Agendamentos',
    summary: 'Veículos cadastrados pelo admin aguardando instalação do rastreador.',
    steps: [
      {
        title: 'Ordem',
        body: 'Os mais antigos aparecem primeiro. Qualquer instalador logado pode finalizar qualquer pendência.',
      },
      {
        title: 'Antes de ir a campo',
        body: 'Confira placa, cliente e telefone. Leve o rastreador, chip SIM e ferramentas de teste.',
      },
    ],
  },

  installer_job: {
    title: 'Checklist de instalação',
    summary: 'Preencha Device ID, IMEI, chip SIM e modelo antes de finalizar. Mínimo 1 foto e teste de comunicação.',
    steps: [
      {
        title: '1. Device ID GPSWOX',
        body: 'ID do dispositivo na plataforma. Pode criar automaticamente no GPSWOX se marcar a opção no formulário.',
      },
      {
        title: '2. IMEI (15 dígitos)',
        body: 'Obrigatório — é gravado no veículo e no relatório para o cliente. Confira na etiqueta do rastreador.',
      },
      {
        title: '3. Chip SIM',
        body: 'Número do chip instalado no rastreador (com DDD). Necessário para backup SMS se a rede 4G falhar.',
      },
      {
        title: '4. Modelo do rastreador',
        body: 'Selecione na lista (ex.: GT06). Define os comandos SMS usados pelo sistema.',
      },
      {
        title: '5. Teste de comunicação',
        body: 'Confirme posição ou resposta a comando antes de marcar o checkbox. Evita retrabalho no suporte.',
      },
      {
        title: '6. Fotos e relatório',
        body: 'Mínimo 1 foto da instalação. Descreva local do equipamento, testes e observações para o cliente.',
      },
    ],
  },

  installer_history: {
    title: 'Histórico de instalações',
    summary: 'Instalações que você finalizou, com placa, cliente, Device ID e IMEI.',
    steps: [
      {
        title: 'Aceite do cliente',
        body: 'Se o cliente ainda não aceitou em Contratos, o veículo já está ativo mas o aceite formal pode estar pendente.',
      },
    ],
  },
};

export function getInstallerGuide(guideId) {
  return INSTALLER_GUIDES[guideId] || null;
}
