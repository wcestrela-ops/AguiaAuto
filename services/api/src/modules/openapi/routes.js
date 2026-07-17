const { Router } = require('express');
const path = require('path');
const fs = require('fs');

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

module.exports = router;
