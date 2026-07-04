const { Router } = require('express');

const router = Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      veiculos_ativos: 0,
      alertas_recentes: [],
      notificacoes_recentes: [],
      situacao_financeira: { status: 'em_dia', proximo_vencimento: null },
      atalhos: ['meu-veiculo', 'financeiro', 'alertas', 'emergencia'],
    },
    message: 'Módulo em desenvolvimento — dados mockados.',
  });
});

module.exports = router;
