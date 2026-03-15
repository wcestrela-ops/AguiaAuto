FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

RUN npx playwright install chromium --with-deps

COPY src/ ./src/

RUN mkdir -p logs

EXPOSE 3001

CMD ["node", "src/server.js"]
