// src/browser.js
// Gerencia uma única instância do browser e reutiliza a sessão autenticada.
// O login é feito uma vez; se a sessão expirar, faz re-login automático.

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

// ─── Seletores da plataforma GPSWox ──────────────────────────────────────────
// Ajuste estes seletores caso o seu domínio tenha customizações visuais.
const SEL = {
  // Página de login
  loginUser:     'input[name="email"], input[name="username"], #email, #username',
  loginPass:     'input[name="password"], #password',
  loginBtn:      'button[type="submit"], input[type="submit"], .login-btn',

  // Indicador de sessão autenticada (elemento que só aparece quando logado)
  sessionCheck:  '.top-menu, #top-menu, .navbar-user, .user-info, [class*="user-menu"]',

  // Barra de busca de unidades/veículos no mapa
  searchInput:   '#search_units, input[placeholder*="pesquis"], input[placeholder*="search"], input[placeholder*="buscar"], .search-input',
  searchResult:  '.unit-list-item, .units-list li, [class*="unit-item"]',

  // Popup / painel de detalhes do veículo no mapa
  vehiclePopup:  '.leaflet-popup-content, .unit-info-popup, [class*="popup-content"]',
  addressField:  '[class*="address"], [class*="location"], .unit-address',
  coordsField:   '[class*="lat"], [class*="coord"], .unit-coords',

  // Alternativa: menu lateral de unidades
  unitRow:       '.unit-row, .units-list .unit',
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
    await page.goto(GPSWOX_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForSelector(SEL.sessionCheck, { timeout: 5000 });
    logger.info('Sessão ativa encontrada.');
    return true;
  } catch {
    return false;
  }
}

// ─── Realiza o login ──────────────────────────────────────────────────────────
async function login() {
  logger.info('Realizando login na plataforma...', { url: GPSWOX_URL });

  await page.goto(GPSWOX_URL + '/login', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });

  // Aguarda campo de usuário aparecer
  await page.waitForSelector(SEL.loginUser, { timeout: 10000 });

  await page.fill(SEL.loginUser, GPSWOX_USER);
  await page.fill(SEL.loginPass, GPSWOX_PASS);
  await page.click(SEL.loginBtn);

  // Aguarda confirmação de login
  try {
    await page.waitForSelector(SEL.sessionCheck, { timeout: 15000 });
    logger.info('Login realizado com sucesso.');
  } catch (err) {
    // Tira screenshot para diagnóstico
    await page.screenshot({ path: 'logs/login_fail.png' });
    throw new Error('Falha no login — verifique credenciais ou seletores. Screenshot salvo em logs/login_fail.png');
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
