const logger = require('../logger');

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.status || err.statusCode || 500;
  const code = err.code || (status === 403 ? 'ACCESS_DENIED' : status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR');
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Erro interno do servidor.'
    : (err.message || 'Erro inesperado.');

  if (status >= 500) {
    logger.error('Erro não tratado.', {
      requestId: req.requestId,
      err: err.message,
      path: req.path,
    });
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      requestId: req.requestId,
    },
  });
}

module.exports = { errorHandler };
