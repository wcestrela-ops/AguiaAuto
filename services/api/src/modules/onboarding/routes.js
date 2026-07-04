const { Router } = require('express');

const router = Router();

router.post('/cadastro', (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Fluxo de cadastro automatizado em desenvolvimento.',
    etapas_previstas: [
      'validacao_cpf_cnpj',
      'confirmacao_email',
      'confirmacao_whatsapp',
      'escolha_plano',
      'cadastro_veiculo',
      'assinatura_contrato',
      'pagamento_asaas',
      'criacao_gpswox',
      'liberacao_acesso',
    ],
  });
});

module.exports = router;
