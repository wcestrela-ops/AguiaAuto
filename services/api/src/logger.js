const { createLogger, format, transports } = require('winston');
const { sanitizeLogMeta } = require('./infrastructure/sanitize-log');

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'aguia-api' },
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format((info) => {
      const { timestamp, level, message, service, ...meta } = info;
      return {
        timestamp,
        level,
        message,
        service,
        ...sanitizeLogMeta(meta),
      };
    })(),
    format.json(),
  ),
  transports: [new transports.Console()],
});

module.exports = logger;
