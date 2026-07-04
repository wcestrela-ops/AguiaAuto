const { chromium } = require('playwright');
const logger = require('./logger');
const { getGpswoxConfig } = require('./config/provider');

let browser = null;
let context = null;
let page    = null;

const SEL = {
  loginUser:    'input[name="email"]',
  loginPass:    'input[name="password"]',
  loginBtn:     'button[type="submit"]',
  sessionCheck: 'input[name="search"]',
  searchInput:  'input[name="search"]',
  unitRow:      '[data-device="name"]',
  vehiclePopup: '.leaflet-popup-content',
  addressField: '[data-device="address"]',
  detailPanel:  '.details',
};

async function launchBrowser(settings) {
  if (browser && browser.isConnected()) return;

  const headless = settings.headless !== false;
  const navTimeout = parseInt(settings.nav_timeout || '30000', 10);

  logger.info('Iniciando browser Playwright...');
  browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ]
  });

  context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    ignoreHTTPSErrors: true,
  });

  context.setDefaultTimeout(navTimeout);
  page = await context.newPage();
  logger.info('Browser iniciado.');
}

async function isLoggedIn(settings) {
  const navTimeout = parseInt(settings.nav_timeout || '30000', 10);

  try {
    await page.goto(settings.url, { waitUntil: 'domcontentloaded', timeout: navTimeout });
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

async function login(settings) {
  const navTimeout = parseInt(settings.nav_timeout || '30000', 10);
  const baseUrl = settings.url.replace(/\/$/, '');

  logger.info('Realizando login na plataforma...', { url: baseUrl });

  await page.goto(baseUrl + '/authentication/create', {
    waitUntil: 'domcontentloaded',
    timeout: navTimeout
  });

  await page.waitForSelector(SEL.loginUser, { timeout: 10000 });
  await page.fill(SEL.loginUser, settings.user);
  await page.fill(SEL.loginPass, settings.pass);
  await page.click(SEL.loginBtn);

  try {
    await page.waitForURL('**/objects**', { timeout: 15000 });
    await page.waitForSelector(SEL.searchInput, { timeout: 10000 });
    logger.info('Login realizado com sucesso.');
  } catch {
    await page.screenshot({ path: 'logs/login_fail.png' });
    throw new Error('Falha no login — verifique credenciais no painel admin.');
  }
}

async function ensureSession() {
  const settings = await getGpswoxConfig();
  if (!settings.url || !settings.user || !settings.pass) {
    throw new Error('GPSWOX: configure url, user e pass no painel admin.');
  }

  await launchBrowser(settings);
  const logado = await isLoggedIn(settings);
  if (!logado) {
    await login(settings);
  }
}

async function getPage() {
  await ensureSession();
  return page;
}

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
