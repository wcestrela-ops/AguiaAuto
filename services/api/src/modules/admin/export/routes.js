const { Router } = require('express');
const { getAdminExportService } = require('../../../services/admin-export-service');
const { sendExportResponse } = require('../../../lib/export/table-export');
const { getAuditService } = require('../../../services/audit-service');

const router = Router();

const VALID_RESOURCES = new Set([
  'clientes',
  'cliente',
  'veiculos',
  'financeiro-cobrancas',
  'frota-documentos',
  'frota-manutencao',
  'emergencia',
  'sms-dispatches',
  'auditoria',
]);

router.get('/:resource', async (req, res) => {
  try {
    const { resource } = req.params;
    if (!VALID_RESOURCES.has(resource)) {
      return res.status(404).json({ success: false, error: 'Recurso de exportação não encontrado.' });
    }

    const result = await getAdminExportService().build(resource, req.query);

    await getAuditService().adminAction('export.download', {
      resourceType: 'export',
      resourceId: resource,
      metadata: {
        format: result.format,
        filename: result.filename,
        filters: { ...req.query, format: undefined },
      },
      req,
    });

    sendExportResponse(res, result);
  } catch (err) {
    const status = err.message.includes('não encontrado') || err.message.includes('obrigatório') ? 400 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
