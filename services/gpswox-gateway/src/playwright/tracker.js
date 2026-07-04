const { getPage, SEL } = require('../browser');
const { getGpswoxConfig } = require('../config/provider');
const logger = require('../logger');

async function getVehicleLocation(vehicleName) {
  logger.info('Buscando localização via Playwright...', { vehicleName });

  const settings = await getGpswoxConfig();
  const page = await getPage();
  const baseUrl = settings.url.replace(/\/$/, '');

  if (!page.url().includes('/objects')) {
    await page.goto(baseUrl + '/objects', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SEL.searchInput, { timeout: 15000 });
    await page.waitForTimeout(2000);
  }

  await page.click(SEL.searchInput);
  await page.fill(SEL.searchInput, '');
  await page.type(SEL.searchInput, vehicleName, { delay: 80 });
  await page.waitForTimeout(2000);

  const unitRows = await page.$$('[data-device="name"]');
  let found = false;
  let foundText = '';

  for (const row of unitRows) {
    const text = await row.innerText().catch(() => '');
    if (text.toLowerCase().includes(vehicleName.toLowerCase())) {
      logger.info('Veículo encontrado, clicando...', { text });
      foundText = text;
      await row.click();
      found = true;
      break;
    }
  }

  if (!found) {
    await page.screenshot({ path: `logs/not_found_${Date.now()}.png` });
    throw new Error(`Veículo "${vehicleName}" não encontrado.`);
  }

  await page.waitForTimeout(3000);

  let endereco = null;
  try {
    const addressEls = await page.$$('[data-device="address"]');
    for (const el of addressEls) {
      const visible = await el.isVisible().catch(() => false);
      const text    = await el.innerText().catch(() => '');
      if (visible && text.trim().length > 5) {
        endereco = text.trim();
        break;
      }
    }
  } catch {
    logger.warn('Campo de endereço não encontrado.');
  }

  let velocidade = null;
  try {
    const speedEls = await page.$$('[data-device="speed"]');
    for (const el of speedEls) {
      const visible = await el.isVisible().catch(() => false);
      const text    = await el.innerText().catch(() => '');
      if (visible && text.trim()) {
        velocidade = text.trim();
        break;
      }
    }
  } catch { /* ignora */ }

  let lat = null, lng = null;
  try {
    await page.waitForTimeout(1500);
    const coords = await page.evaluate(() => {
      try {
        if (window.map && typeof window.map.getCenter === 'function') {
          const c = window.map.getCenter();
          if (c && typeof c.lat === 'number' && typeof c.lng === 'number') {
            return { lat: c.lat, lng: c.lng };
          }
        }
      } catch { /* ignora */ }
      return null;
    });
    if (coords?.lat && coords?.lng) {
      lat = coords.lat;
      lng = coords.lng;
    }
  } catch {
    logger.warn('Coordenadas não disponíveis via Leaflet.');
  }

  let mapsLink = null;
  if (lat && lng) {
    mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
  } else if (endereco) {
    mapsLink = `https://maps.google.com/?q=${encodeURIComponent(endereco)}`;
  }

  try {
    await page.fill(SEL.searchInput, '');
  } catch { /* ignora */ }

  return {
    success:      true,
    veiculo:      foundText || vehicleName,
    latitude:     lat ? parseFloat(lat) : null,
    longitude:    lng ? parseFloat(lng) : null,
    endereco:     endereco || 'Endereço não disponível',
    velocidade:   velocidade || '0 Km/h',
    maps_link:    mapsLink,
    fonte:        'playwright',
    capturado_em: new Date().toISOString(),
  };
}

module.exports = { getVehicleLocation };
