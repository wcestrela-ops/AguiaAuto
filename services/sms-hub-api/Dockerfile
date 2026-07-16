FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/sms-hub-api/package.json services/sms-hub-api/

RUN npm install -w @ag-sms-hub/api

COPY services/sms-hub-api services/sms-hub-api

RUN npm run build -w @ag-sms-hub/api

FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/sms-hub-api/package.json services/sms-hub-api/

RUN npm install --omit=dev -w @ag-sms-hub/api

COPY --from=builder /app/services/sms-hub-api/dist services/sms-hub-api/dist

WORKDIR /app/services/sms-hub-api

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/v1/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main.js"]
