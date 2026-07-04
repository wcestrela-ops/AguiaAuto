require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
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

  const browser = await chromium.launch({ headless: false });
  const page    = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log('\n[1] Abrindo página de login...');
  await page.goto(URL + '/login', { waitUntil: 'domcontentloaded' }).catch(() =>
    page.goto(URL, { waitUntil: 'domcontentloaded' })
  );
  await page.screenshot({ path: 'logs/diag_01_login.png' });
  console.log('    Screenshot: logs/diag_01_login.png');

  const inputs = await page.$$eval('input', els =>
    els.map(e => ({
      type: e.type,
      name: e.name,
      id: e.id,
      placeholder: e.placeholder,
      class: e.className.substring(0, 60),
    }))
  );
  console.log('\n    Inputs encontrados na página de login:');
  inputs.forEach(i => console.log('    ', JSON.stringify(i)));

  console.log('\n[2] Tentando login...');
  try {
    const userSel = await _findSelector(page, [
      'input[name="email"]', 'input[name="username"]', '#email', '#username', 'input[type="email"]'
    ]);
    const passSel = await _findSelector(page, [
      'input[name="password"]', '#password', 'input[type="password"]'
    ]);
    const btnSel  = await _findSelector(page, [
      'button[type="submit"]', 'input[type="submit"]', '.login-btn', 'button.btn-primary'
    ]);

    await page.fill(userSel, USER);
    await page.fill(passSel, PASS);
    await page.click(btnSel);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'logs/diag_02_apos_login.png' });
    console.log(`    URL atual: ${page.url()}`);
  } catch (err) {
    console.log(`    ✗ Erro no login: ${err.message}`);
  }

  console.log('\nScreenshots salvos em logs/.');
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
