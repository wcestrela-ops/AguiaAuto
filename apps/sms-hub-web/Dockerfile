FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/sms-hub-web/package.json apps/sms-hub-web/

RUN npm install -w @ag-sms-hub/web

COPY apps/sms-hub-web apps/sms-hub-web

RUN npm run build -w @ag-sms-hub/web

FROM nginx:1.27-alpine

COPY apps/sms-hub-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/sms-hub-web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
