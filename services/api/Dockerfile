FROM node:20-slim

WORKDIR /app

COPY package.json ./
COPY packages/shared packages/shared
COPY packages/integrations packages/integrations
COPY packages/whatsapp packages/whatsapp
COPY services/api services/api

RUN npm install --omit=dev -w @aguia/api

WORKDIR /app/services/api

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
