# ─── Imagem base com Playwright e dependências de sistema ────────────────────
# Usamos a imagem oficial do Playwright que já inclui Chromium + libs necessárias
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Diretório de trabalho
WORKDIR /app

# Copia manifesto e instala dependências Node primeiro (aproveita cache do Docker)
COPY package.json ./
RUN npm install --omit=dev

# Instala somente o Chromium (não precisamos de Firefox/WebKit)
RUN npx playwright install chromium --with-deps

# Copia código-fonte
COPY src/ ./src/

# Cria diretório de logs
RUN mkdir -p logs

# Usuário não-root para segurança
RUN groupadd -r appuser && useradd -r -g appuser appuser \
    && chown -R appuser:appuser /app
USER appuser

# Porta do servidor Express
EXPOSE 3001

# Healthcheck para Docker / docker-compose
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
