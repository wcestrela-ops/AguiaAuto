// src/tracker.js — Águia Rastreamento (GPSWox)
// Estratégia: busca pelo campo pesquisa → clica no veículo → captura endereço e velocidade

const { getPage, SEL } = require('./browser');
const logger = require('./logger');

async function getVehicleLocation(vehicleName) {
  logger.info('Buscando localização...', { vehicleName });

  const page = await getPage();

  // Garante que está na página correta
  if (!page.url().includes('/objects')) {
    await page.goto(process.env.GPSWOX_URL + '/objects', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SEL.searchInput, { timeout: 15000 });
    await page.waitForTimeout(2000);
  }

  // ── 1. Digita o nome na barra de pesquisa ────────────────────────────────
  logger.info('Digitando na barra de pesquisa...');
  await page.click(SEL.searchInput);
  await page.fill(SEL.searchInput, '');
  await page.type(SEL.searchInput, vehicleName, { delay: 80 });
  await page.waitForTimeout(2000);

  // ── 2. Encontra o veículo na lista lateral ───────────────────────────────
  // Pega todos os elementos data-device="name" visíveis
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
    throw new Error(`Veículo "${vehicleName}" não encontrado. Verifique o nome exato conforme aparece na plataforma.`);
  }

  // ── 3. Aguarda popup abrir ────────────────────────────────────────────────
  await page.waitForTimeout(3000);

  // ── 4. Captura endereço ───────────────────────────────────────────────────
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

  // ── 5. Captura velocidade ─────────────────────────────────────────────────
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

  // ── 6. Tenta capturar coordenadas via Leaflet ─────────────────────────────
  let lat = null, lng = null;
  try {
    // Espera o mapa centralizar no veículo
    await page.waitForTimeout(1500);
    const coords = await page.evaluate(() => {
      try {
        if (window.map && typeof window.map.getCenter === 'function') {
          const c = window.map.getCenter();
          if (c && typeof c.lat === 'number' && typeof c.lng === 'number') {
            return { lat: c.lat, lng: c.lng };
          }
        }
      } catch (e) { /* ignora */ }
      return null;
    });
    if (coords && coords.lat && coords.lng) {
      lat = coords.lat;
      lng = coords.lng;
      logger.info('Coordenadas via Leaflet.', { lat, lng });
    }
  } catch {
    logger.warn('Coordenadas não disponíveis via Leaflet.');
  }

  // ── 7. Monta link do Google Maps ──────────────────────────────────────────
  // Usa coordenadas se disponíveis, senão usa o endereço para busca
  let mapsLink = null;
  if (lat && lng) {
    mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
  } else if (endereco) {
    mapsLink = `https://maps.google.com/?q=${encodeURIComponent(endereco)}`;
  }

  // ── 8. Limpa a busca ──────────────────────────────────────────────────────
  try {
    await page.fill(SEL.searchInput, '');
  } catch { /* ignora */ }

  logger.info('Captura concluída.', { vehicleName, endereco, lat, lng });

  return {
    success:      true,
    veiculo:      foundText || vehicleName,
    latitude:     lat ? parseFloat(lat) : null,
    longitude:    lng ? parseFloat(lng) : null,
    endereco:     endereco || 'Endereço não disponível',
    velocidade:   velocidade || '0 Km/h',
    maps_link:    mapsLink,
    capturado_em: new Date().toISOString(),
  };
}

module.exports = { getVehicleLocation };
