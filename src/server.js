// src/server.js
require('dotenv').config();

const express  = require('express');
const logger   = require('./logger');
const { getVehicleLocation } = require('./tracker');
const { closeBrowser }       = require('./browser');

const app    = express();
const PORT   = process.env.PORT || 3001;
const SECRET = process.env.API_SECRET || '';

app.use(express.json());

// ─── Middleware de autenticação por chave ─────────────────────────────────────
// O n8n deve enviar o header: Authorization: Bearer <API_SECRET>
app.use((req, res, next) => {
  if (!SECRET) return next(); // sem segredo configurado, permite tudo (só em dev)

  const auth = req.headers['authorization'] || '';
  if (auth !== `Bearer ${SECRET}`) {
    logger.warn('Requisição não autorizada.', { ip: req.ip, path: req.path });
    return res.status(401).json({ success: false, error: 'Não autorizado.' });
  }
  next();
});

// ─── Middleware de log de entrada ─────────────────────────────────────────────
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { body: req.body });
  next();
});

// ────────────────────────────────────────────────────────────────────────────
// GET /health
// Verifica se o serviço está no ar.
// n8n pode chamar este endpoint antes de iniciar o fluxo.
// ────────────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /localizacao
//
// Body esperado:
// { "veiculo": "NOME DO VEICULO" }
//
// Resposta de sucesso:
// {
//   "success": true,
//   "veiculo": "NOME DO VEICULO",
//   "latitude": -3.7172,
//   "longitude": -38.5434,
//   "endereco": "Av. Beira Mar, 1500 - Fortaleza, CE",
//   "velocidade": "42 km/h",
//   "maps_link": "https://maps.google.com/?q=-3.7172,-38.5434",
//   "fonte": "popup_mapa",
//   "capturado_em": "2025-01-15T14:32:00.000Z"
// }
//
// Resposta de erro:
// { "success": false, "error": "mensagem de erro" }
// ────────────────────────────────────────────────────────────────────────────
app.post('/localizacao', async (req, res) => {
  const { veiculo } = req.body;

  if (!veiculo || typeof veiculo !== 'string' || !veiculo.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Campo "veiculo" obrigatório no body da requisição.'
    });
  }

  try {
    const resultado = await getVehicleLocation(veiculo.trim());
    return res.json(resultado);
  } catch (err) {
    logger.error('Erro ao buscar localização.', { veiculo, err: err.message });
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /localizacao/lote
//
// Busca localização de múltiplos veículos em paralelo (até 5 por vez).
//
// Body:
// { "veiculos": ["NOME 1", "NOME 2", "NOME 3"] }
// ────────────────────────────────────────────────────────────────────────────
app.post('/localizacao/lote', async (req, res) => {
  const { veiculos } = req.body;

  if (!Array.isArray(veiculos) || veiculos.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Campo "veiculos" deve ser um array não vazio.'
    });
  }

  if (veiculos.length > 10) {
    return res.status(400).json({
      success: false,
      error: 'Máximo de 10 veículos por requisição em lote.'
    });
  }

  // Executa sequencialmente para não sobrecarregar a plataforma
  const resultados = [];
  for (const nome of veiculos) {
    try {
      const r = await getVehicleLocation(nome.trim());
      resultados.push(r);
    } catch (err) {
      resultados.push({
        success:  false,
        veiculo:  nome,
        error:    err.message
      });
    }
  }

  return res.json({
    success: true,
    total:   veiculos.length,
    resultados
  });
});

// ─── Shutdown gracioso ────────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  logger.info('Encerrando servidor...');
  await closeBrowser();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Interrompido. Encerrando browser...');
  await closeBrowser();
  process.exit(0);
});

// ─── Inicia o servidor ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`Serviço Playwright GPSWox rodando na porta ${PORT}`);
  logger.info(`Endpoints disponíveis:
  GET  /health
  POST /localizacao       { "veiculo": "nome" }
  POST /localizacao/lote  { "veiculos": ["nome1","nome2"] }`);
});
