// src/tracker.js — Lógica de busca de veículos para Águia Rastreamento (GPSWox)
// Estratégia: busca pelo campo de pesquisa → clica no veículo → captura popup + coordenadas via Leaflet

const { getPage, SEL } = require('./browser');
const logger = require('./logger');

async function getVehicleLocation(vehicleName) {
  logger.info('Buscando localização...', { vehicleName });

  const page = await getPage();

  // Garante que está na página correta
  if (!page.url().includes('/objects')) {
    await page.goto(process.env.GPSWOX_URL + '/objects', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SEL.searchInput, { timeout: 10000 });
  }

  // ── 1. Digita o nome na barra de pesquisa ────────────────────────────────
  logger.info('Digitando na barra de pesquisa...');
  await page.click(SEL.searchInput);
  await page.fill(SEL.searchInput, '');
  await page.type(SEL.searchInput, vehicleName, { delay: 80 });
  await page.waitForTimeout(1500); // aguarda a lista filtrar

  // ── 2. Encontra o veículo na lista lateral ───────────────────────────────
  const unitRows = await page.$$('[data-device="name"]');
  let found = false;

  for (const row of unitRows) {
    const text = await row.innerText().catch(() => '');
    if (text.toLowerCase().includes(vehicleName.toLowerCase())) {
      logger.info('Veículo encontrado na lista, clicando...', { text });
      // Clica no elemento pai (linha completa) para abrir o popup no mapa
      const parent = await row.$('xpath=ancestor::li[1] | xpath=ancestor::div[contains(@class,"object")][1]');
      if (parent) {
        await parent.click();
      } else {
        await row.click();
      }
      found = true;
      break;
    }
  }

  if (!found) {
    await page.screenshot({ path: `logs/not_found_${Date.now()}.png` });
    throw new Error(`Veículo "${vehicleName}" não encontrado na lista. Verifique o nome exato.`);
  }

  // ── 3. Aguarda popup ou painel abrir ─────────────────────────────────────
  await page.waitForTimeout(3000);
  await page.waitForLoadState('domcontentloaded');

  // ── 4. Captura endereço via data-device="address" ─────────────────────────
  let endereco = null;
  try {
    // Aguarda o campo de endereço ser preenchido (pode demorar um pouco)
    await page.waitForSelector('[data-device="address"]', { timeout: 8000 });
    
    // Pega o endereço do popup aberto (pode haver vários na página, pega o visível)
    const addressEls = await page.$$('[data-device="address"]');
    for (const el of addressEls) {
      const visible = await el.isVisible();
      const text    = await el.innerText().catch(() => '');
      if (visible && text.trim().length > 5) {
        endereco = text.trim();
        break;
      }
    }
  } catch {
    logger.warn('Campo de endereço não encontrado no popup.');
  }

  // ── 5. Captura coordenadas via objeto Leaflet ─────────────────────────────
  let lat = null, lng = null;

  try {
    await page.waitForFunction(() => window.map !== undefined, { timeout: 5000 }).catch(() => {});
    const coords = await page.evaluate(() => {
      try {
        if (window.map && typeof window.map.getCenter === 'function') {
          const c = window.map.getCenter();
          if (c && c.lat && c.lng) return { lat: c.lat, lng: c.lng };
        }
      } catch(e) {}
      return null;
    });
    if (coords && coords.lat && coords.lng) {
      lat = coords.lat;
      lng = coords.lng;
      logger.info('Coordenadas via Leaflet.', { lat, lng });
    }
  } catch {
    logger.warn('Leaflet não disponível.');
  }

  // ── 6. Alternativa: coordenadas via texto do popup ─────────────────────────
  if (!lat || !lng) {
    try {
      const posEl = await page.$('[data-device="lat"]');
      const lngEl = await page.$('[data-device="lng"]');
      if (posEl) lat = await posEl.innerText().catch(() => null);
      if (lngEl) lng = await lngEl.innerText().catch(() => null);
    } catch { /* ignora */ }
  }

  // ── 7. Alternativa: captura da URL do mapa (hash com coordenadas) ─────────
  if (!lat || !lng) {
    try {
      const url = page.url();
      const match = url.match(/[@#](-?\d+\.\d+)[,/](-?\d+\.\d+)/);
      if (match) { lat = match[1]; lng = match[2]; }
    } catch { /* ignora */ }
  }

  // ── 8. Alternativa: intercepta o objeto do veículo via JS global ──────────
  if (!lat || !lng) {
    try {
      const coords = await page.evaluate((name) => {
        try {
          const keys = ['devices', 'units', 'objects', 'markers'];
          for (const key of keys) {
            if (!window[key]) continue;
            const list = Array.isArray(window[key])
              ? window[key]
              : Object.values(window[key]);
            const match = list.find(d => {
              const n = ((d && (d.name || d.unit_name || d.label)) || '').toLowerCase();
              return n.includes(name.toLowerCase());
            });
            if (match) {
              return {
                lat: match.lat || match.lastlat || match.latitude || null,
                lng: match.lng || match.lastlng || match.longitude || null,
              };
            }
          }
        } catch(e) {}
        return null;
      }, vehicleName);

      if (coords && coords.lat && coords.lng) {
        lat = coords.lat;
        lng = coords.lng;
        logger.info('Coordenadas capturadas via objeto JS global.', { lat, lng });
      }
    } catch { /* ignora */ }
  }

  // ── Captura velocidade ────────────────────────────────────────────────────
  let velocidade = null;
  try {
    const speedEls = await page.$$('[data-device="speed"]');
    for (const el of speedEls) {
      const visible = await el.isVisible();
      const text    = await el.innerText().catch(() => '');
      if (visible && text.trim()) { velocidade = text.trim(); break; }
    }
  } catch { /* ignora */ }

  // ── Monta link do Google Maps ─────────────────────────────────────────────
  const mapsLink = lat && lng
    ? `https://maps.google.com/?q=${lat},${lng}`
    : null;

  // ── Limpa a busca para não interferir na próxima consulta ─────────────────
  try {
    await page.fill(SEL.searchInput, '');
  } catch { /* ignora */ }

  logger.info('Localização capturada com sucesso.', { vehicleName, lat, lng, endereco });

  return {
    success:      true,
    veiculo:      vehicleName,
    latitude:     lat ? parseFloat(lat) : null,
    longitude:    lng ? parseFloat(lng) : null,
    endereco:     endereco || 'Endereço não disponível',
    velocidade:   velocidade || '0 Km/h',
    maps_link:    mapsLink,
    capturado_em: new Date().toISOString(),
  };
}

module.exports = { getVehicleLocation };
