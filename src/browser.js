// src/browser.js — Seletores confirmados via diagnóstico (Águia Rastreamento)
// Gerencia uma única instância do browser e reutiliza a sessão autenticada.

require('dotenv').config();
const { chromium } = require('playwright');
const logger = require('./logger');

const GPSWOX_URL   = process.env.GPSWOX_URL;
const GPSWOX_USER  = process.env.GPSWOX_USER;
const GPSWOX_PASS  = process.env.GPSWOX_PASS;
const HEADLESS     = process.env.HEADLESS !== 'false';
const NAV_TIMEOUT  = parseInt(process.env.NAV_TIMEOUT || '30000', 10);

let browser = null;
let context = null;
let page    = null;

// ─── Seletores confirmados via diagnóstico — Águia Rastreamento (GPSWox) ─────
const SEL = {
  // Login
  loginUser:    'input[name="email"]',
  loginPass:    'input[name="password"]',
  loginBtn:     'button[type="submit"]',

  // Confirmação de sessão ativa
  sessionCheck: 'input[name="search"]',

  // Busca de veículos (confirmado: placeholder "Pesquisa", name="search")
  searchInput:  'input[name="search"]',

  // Itens da lista lateral de veículos
  unitRow:      '[data-device="name"]',

  // Popup do mapa ao clicar no veículo
  vehiclePopup: '.leaflet-popup-content',

  // Endereço no popup (confirmado: data-device="address")
  addressField: '[data-device="address"]',

  // Painel inferior de detalhes
  detailPanel:  '.details',
};

// ─── Inicializa o browser ─────────────────────────────────────────────────────
async function launchBrowser() {
  if (browser && browser.isConnected()) return;

  logger.info('Iniciando browser Playwright...');
  browser = await chromium.launch({
    headless: HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',   // obrigatório em Docker
      '--disable-gpu',
    ]
  });

  context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    ignoreHTTPSErrors: true,
  });

  context.setDefaultTimeout(NAV_TIMEOUT);
  page = await context.newPage();
  logger.info('Browser iniciado.');
}

// ─── Verifica se já está autenticado ─────────────────────────────────────────
async function isLoggedIn() {
  try {
    await page.goto(GPSWOX_URL , { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(2000);
    const url = page.url();
    if (url.includes('/authentication') || url.includes('/login')) return false;
    await page.waitForSelector(SEL.searchInput, { timeout: 8000 });
    logger.info('Sessão ativa encontrada.');
    return true;
  } catch {
    return false;
  }
}

// ─── Realiza o login ──────────────────────────────────────────────────────────
async function login() {
  logger.info('Realizando login na plataforma...', { url: GPSWOX_URL });

  await page.goto(GPSWOX_URL + '/authentication/create', {
    waitUntil: 'domcontentloaded',
    timeout: NAV_TIMEOUT
  });

  await page.waitForSelector(SEL.loginUser, { timeout: 10000 });
  await page.fill(SEL.loginUser, GPSWOX_USER);
  await page.fill(SEL.loginPass, GPSWOX_PASS);
  await page.click(SEL.loginBtn);

  // Aguarda redirecionar para /objects após login
  try {
    await page.waitForURL('**/objects**', { timeout: 15000 });
    await page.waitForSelector(SEL.searchInput, { timeout: 10000 });
    logger.info('Login realizado com sucesso.');
  } catch (err) {
    await page.screenshot({ path: 'logs/login_fail.png' });
    throw new Error('Falha no login — verifique credenciais. Screenshot salvo em logs/login_fail.png');
  }
}

// ─── Garante sessão válida (login + re-login automático) ──────────────────────
async function ensureSession() {
  await launchBrowser();
  const logado = await isLoggedIn();
  if (!logado) {
    await login();
  }
}

// ─── Retorna a page ativa ─────────────────────────────────────────────────────
async function getPage() {
  await ensureSession();
  return page;
}

// ─── Fecha o browser (útil para testes / shutdown gracioso) ──────────────────
async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
    page    = null;
    logger.info('Browser encerrado.');
  }
}

module.exports = { getPage, ensureSession, closeBrowser, SEL };
