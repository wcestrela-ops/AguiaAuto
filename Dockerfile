# AguiaAuto — App único para EasyPanel (Dockerfile na raiz)
# EasyPanel → App → Dockerfile path: Dockerfile | Porta: 80
#
# Staging: build web + deps API
# Final: nginx (SPA + /api) + node API no mesmo container

FROM node:20-bookworm-slim AS web-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web apps/web
RUN npm ci -w @aguia/web && npm run build -w @aguia/web

FROM node:20-bookworm-slim AS api-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared packages/shared
COPY packages/integrations packages/integrations
COPY packages/whatsapp packages/whatsapp
COPY packages/sms packages/sms
COPY services/api services/api
RUN npm ci --omit=dev -w @aguia/api

FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx supervisor curl \
  && rm -rf /var/lib/apt/lists/* \
  && rm -f /etc/nginx/sites-enabled/default

COPY --from=api-deps /app /app
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html

COPY docker/easypanel/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/easypanel/supervisord.conf /etc/supervisor/conf.d/aguia.conf
COPY docker/easypanel/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production \
    API_PORT=3000 \
    PROCESS_ROLE=api \
    ENABLE_INLINE_POLLERS=true \
    PORT=80

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=5 \
  CMD curl -fsS http://127.0.0.1/api/health/live >/dev/null || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
