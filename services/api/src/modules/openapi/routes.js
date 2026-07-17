const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const { isOpenApiDocsEnabled } = require('../../infrastructure/openapi-docs');

const router = Router();
const specPath = path.join(__dirname, '../../../openapi/spec.json');

router.get('/openapi.json', (req, res) => {
  try {
    const raw = fs.readFileSync(specPath, 'utf8');
    const spec = JSON.parse(raw);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(spec);
  } catch (err) {
    res.status(503).json({
      success: false,
      error: 'Especificação OpenAPI indisponível.',
      requestId: req.requestId,
    });
  }
});

if (isOpenApiDocsEnabled()) {
  const swaggerHandler = swaggerUi.setup(null, {
    customSiteTitle: 'Águia Gestão Veicular — API',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      url: '/v1/openapi.json',
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
    },
  });

  router.use('/docs', swaggerUi.serve);
  router.get('/docs', swaggerHandler);
} else {
  router.get('/docs', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Documentação interativa desabilitada. Defina OPENAPI_DOCS_ENABLED=true.',
        requestId: req.requestId,
      },
    });
  });
}

module.exports = router;
