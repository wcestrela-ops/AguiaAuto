// scripts/diagnostico.js
// Execute este script UMA VEZ para inspecionar a plataforma e descobrir
// os seletores corretos para o seu domínio GPSWox customizado.
//
// Uso:
//   node scripts/diagnostico.js
//
// O script salva screenshots em logs/ e imprime os seletores encontrados.

require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');

const URL  = process.env.GPSWOX_URL;
const USER = process.env.GPSWOX_USER;
const PASS = process.env.GPSWOX_PASS;

if (!fs.existsSync('logs')) fs.mkdirSync('logs');

async function diagnostico() {
  console.log('\n🔍 DIAGNÓSTICO DA PLATAFORMA GPSWOX\n');
  console.log(`URL: ${URL}`);
  console.log('─'.repeat(50));

  const browser = await chromium.launch({ headless: false }); // headless: false para ver o que acontece
  const page    = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // ── 1. Página de login ────────────────────────────────────────────────────
  console.log('\n[1] Abrindo página de login...');
  await page.goto(URL + '/login', { waitUntil: 'domcontentloaded' }).catch(() =>
    page.goto(URL, { waitUntil: 'domcontentloaded' })
  );
  await page.screenshot({ path: 'logs/diag_01_login.png' });
  console.log('    Screenshot: logs/diag_01_login.png');

  // Inspeciona campos de login
  const inputs = await page.$$eval('input', els =>
    els.map(e => ({
      type:        e.type,
      name:        e.name,
      id:          e.id,
      placeholder: e.placeholder,
      class:       e.className.substring(0, 60),
    }))
  );
  console.log('\n    Inputs encontrados na página de login:');
  inputs.forEach(i => console.log('    ', JSON.stringify(i)));

  const buttons = await page.$$eval('button, input[type=submit]', els =>
    els.map(e => ({
      tag:   e.tagName,
      type:  e.type,
      text:  e.innerText?.substring(0, 40),
      id:    e.id,
      class: e.className.substring(0, 60),
    }))
  );
  console.log('\n    Botões encontrados:');
  buttons.forEach(b => console.log('    ', JSON.stringify(b)));

  // ── 2. Login ──────────────────────────────────────────────────────────────
  console.log('\n[2] Tentando login...');
  try {
    // Tenta os seletores mais comuns
    const userSel = await _findSelector(page, [
      'input[name="email"]', 'input[name="username"]', '#email', '#username', 'input[type="email"]'
    ]);
    const passSel = await _findSelector(page, [
      'input[name="password"]', '#password', 'input[type="password"]'
    ]);
    const btnSel  = await _findSelector(page, [
      'button[type="submit"]', 'input[type="submit"]', '.login-btn', 'button.btn-primary'
    ]);

    console.log(`    ✓ Campo usuário: ${userSel}`);
    console.log(`    ✓ Campo senha:   ${passSel}`);
    console.log(`    ✓ Botão login:   ${btnSel}`);

    await page.fill(userSel, USER);
    await page.fill(passSel, PASS);
    await page.click(btnSel);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'logs/diag_02_apos_login.png' });
    console.log('    Screenshot: logs/diag_02_apos_login.png');
    console.log(`    URL atual: ${page.url()}`);
  } catch (err) {
    console.log(`    ✗ Erro no login: ${err.message}`);
  }

  // ── 3. Inspeção pós-login ─────────────────────────────────────────────────
  console.log('\n[3] Inspecionando página pós-login...');

  const topMenus = await page.$$eval(
    '.top-menu, #top-menu, .navbar, .navbar-user, [class*="user-menu"], [class*="user-info"]',
    els => els.map(e => ({ tag: e.tagName, id: e.id, class: e.className.substring(0, 80) }))
  );
  console.log('\n    Elementos de menu/sessão encontrados:');
  topMenus.forEach(m => console.log('    ', JSON.stringify(m)));

  // ── 4. Busca de veículo ───────────────────────────────────────────────────
  console.log('\n[4] Inspecionando barra de busca de veículos...');

  const searchInputs = await page.$$eval(
    'input[id*="search"], input[placeholder*="search"], input[placeholder*="pesquis"], input[placeholder*="buscar"], input[placeholder*="unit"], .search-input',
    els => els.map(e => ({
      id:          e.id,
      name:        e.name,
      placeholder: e.placeholder,
      class:       e.className.substring(0, 80),
    }))
  );
  console.log('\n    Inputs de busca encontrados:');
  searchInputs.forEach(i => console.log('    ', JSON.stringify(i)));
  await page.screenshot({ path: 'logs/diag_03_mapa.png' });
  console.log('    Screenshot: logs/diag_03_mapa.png');

  // ── 5. Interceptação de chamadas de API ───────────────────────────────────
  console.log('\n[5] Monitorando chamadas de API internas (5 segundos)...');
  const apiCalls = [];
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('/api/') || url.includes('get_') || url.includes('/objects') || url.includes('/units')) {
      try {
        const ct = resp.headers()['content-type'] || '';
        if (ct.includes('json')) {
          const json = await resp.json().catch(() => null);
          apiCalls.push({ url: url.replace(URL, ''), keys: json ? Object.keys(json).join(', ') : 'erro ao parsear' });
        }
      } catch { /* ignora */ }
    }
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  console.log('\n    Chamadas de API capturadas:');
  if (apiCalls.length === 0) {
    console.log('    Nenhuma. Verifique se o login foi bem-sucedido.');
  } else {
    apiCalls.forEach(c => console.log(`    ${c.url}  →  keys: ${c.keys}`));
  }

  // ── Resumo ────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  console.log('RESUMO — Copie e cole em browser.js > SEL:');
  console.log('─'.repeat(50));
  console.log(`
  SEL = {
    // Copie os valores encontrados acima ↑
    loginUser:    '<seletor do campo usuário>',
    loginPass:    '<seletor do campo senha>',
    loginBtn:     '<seletor do botão de login>',
    sessionCheck: '<seletor do elemento pós-login>',
    searchInput:  '<seletor da barra de busca>',
    searchResult: '<seletor dos itens da lista>',
    vehiclePopup: '<seletor do popup do veículo>',
    addressField: '<seletor do campo de endereço>',
  }
  `);

  console.log('\nScreenshots salvos em logs/. Analise-os para ajustar os seletores.');
  console.log('Pressione Ctrl+C para fechar o browser.\n');

  // Mantém o browser aberto para inspeção manual
  await page.pause();
  await browser.close();
}

async function _findSelector(page, candidates) {
  for (const sel of candidates) {
    try {
      await page.waitForSelector(sel, { timeout: 2000 });
      return sel;
    } catch { /* tenta próximo */ }
  }
  throw new Error(`Nenhum dos seletores encontrado: ${candidates.join(', ')}`);
}

diagnostico().catch(err => {
  console.error('Erro no diagnóstico:', err.message);
  process.exit(1);
});
