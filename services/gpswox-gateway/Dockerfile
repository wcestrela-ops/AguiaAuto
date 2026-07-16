FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/integrations packages/integrations
COPY services/gpswox-gateway services/gpswox-gateway

RUN npm ci --omit=dev -w @aguia/gpswox-gateway
RUN npx playwright install chromium --with-deps

WORKDIR /app/services/gpswox-gateway

RUN mkdir -p logs

RUN groupadd -r appuser && useradd -r -g appuser appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
