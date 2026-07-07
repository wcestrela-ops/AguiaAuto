FROM node:20-slim AS build

WORKDIR /app

COPY package.json ./
COPY apps/web apps/web

RUN npm install -w @aguia/web
RUN npm run build -w @aguia/web

FROM nginx:alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
