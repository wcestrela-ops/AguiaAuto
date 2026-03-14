// src/tracker.js
// Funções de automação da plataforma GPSWox.
// Cada função retorna um objeto JSON limpo, pronto para o n8n consumir.

const { getPage, SEL } = require('./browser');
const logger = require('./logger');

// ─── Busca a localização de um veículo pelo nome/apelido ────────────────────
async function getVehicleLocation(vehicleName) {
  logger.info('Buscando localização do veículo...', { vehicleName });

  const page = await getPage();

  // ── Estratégia 1: usar a barra de busca de unidades ──────────────────────
  try {
    return await _searchViaSearchBar(page, vehicleName);
  } catch (err) {
    logger.warn('Estratégia 1 falhou, tentando estratégia 2...', { err: err.message });
  }

  // ── Estratégia 2: navegar direto para a URL de unidades e filtrar ─────────
  try {
    return await _searchViaUnitList(page, vehicleName);
  } catch (err) {
    logger.warn('Estratégia 2 falhou, tentando estratégia 3 (API interna)...', { err: err.message });
  }

  // ── Estratégia 3: interceptar requisição da API interna do GPSWox ─────────
  try {
    return await _searchViaInternalApi(page, vehicleName);
  } catch (err) {
    logger.error('Todas as estratégias falharam.', { vehicleName, err: err.message });
    await page.screenshot({ path: `logs/search_fail_${Date.now()}.png` });
    throw new Error(`Veículo "${vehicleName}" não encontrado ou plataforma não respondeu.`);
  }
}

// ─── Estratégia 1: barra de pesquisa do mapa ─────────────────────────────────
async function _searchViaSearchBar(page, vehicleName) {
  // Garante que está na tela do mapa
  const mapUrl = process.env.GPSWOX_URL;
  if (!page.url().startsWith(mapUrl)) {
    await page.goto(mapUrl, { waitUntil: 'domcontentloaded' });
  }

  await page.waitForSelector(SEL.searchInput, { timeout: 8000 });
  await page.fill(SEL.searchInput, '');
  await page.type(SEL.searchInput, vehicleName, { delay: 80 });

  // Aguarda resultados aparecerem
  await page.waitForSelector(SEL.searchResult, { timeout: 6000 });

  // Clica no primeiro resultado que contenha o nome buscado
  const results = await page.$$(SEL.searchResult);
  let found = false;

  for (const el of results) {
    const text = await el.innerText();
    if (text.toLowerCase().includes(vehicleName.toLowerCase())) {
      await el.click();
      found = true;
      break;
    }
  }

  if (!found) throw new Error('Veículo não encontrado na lista de busca.');

  // Aguarda popup / painel com dados do veículo
  await page.waitForSelector(SEL.vehiclePopup, { timeout: 8000 });

  return await _extractLocationData(page, vehicleName);
}

// ─── Estratégia 2: lista de unidades (página /units ou /objects) ──────────────
async function _searchViaUnitList(page, vehicleName) {
  const urls = [
    process.env.GPSWOX_URL + '/objects',
    process.env.GPSWOX_URL + '/units',
    process.env.GPSWOX_URL + '/map',
  ];

  for (const url of urls) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const rows = await page.$$(SEL.unitRow);

    for (const row of rows) {
      const text = await row.innerText().catch(() => '');
      if (text.toLowerCase().includes(vehicleName.toLowerCase())) {
        await row.click();
        await page.waitForTimeout(1500);
        return await _extractLocationData(page, vehicleName);
      }
    }
  }

  throw new Error('Veículo não encontrado na lista de unidades.');
}

// ─── Estratégia 3: interceptar API interna do GPSWox ─────────────────────────
// O GPSWox faz chamadas AJAX para /api/get_devices ou similar.
// Esta estratégia escuta as respostas de rede para extrair dados diretamente.
async function _searchViaInternalApi(page, vehicleName) {
  const apiPatterns = ['/get_devices', '/objects/get', '/units/get', '/api/objects'];
  let capturedData = null;

  // Intercepta respostas JSON da plataforma
  page.on('response', async (response) => {
    const url = response.url();
    const isApiCall = apiPatterns.some(p => url.includes(p));
    if (!isApiCall) return;

    try {
      const json = await response.json();
      // Procura o veículo no JSON retornado
      const list = Array.isArray(json) ? json : (json.data || json.objects || json.devices || []);
      const match = list.find(item => {
        const name = (item.name || item.unit_name || item.label || '').toLowerCase();
        return name.includes(vehicleName.toLowerCase());
      });
      if (match) capturedData = match;
    } catch {
      // Resposta não é JSON, ignora
    }
  });

  // Força um reload para disparar as chamadas de API
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);

  if (!capturedData) throw new Error('API interna não retornou dados do veículo.');

  // Normaliza os campos da API interna do GPSWox
  const lat  = capturedData.lat  || capturedData.lastlat  || capturedData.latitude  || null;
  const lng  = capturedData.lng  || capturedData.lastlng  || capturedData.longitude || null;
  const addr = capturedData.address || capturedData.last_address || null;
  const speed = capturedData.speed || capturedData.last_speed || 0;

  if (!lat || !lng) throw new Error('Coordenadas não encontradas na resposta da API interna.');

  const googleMapsLink = `https://maps.google.com/?q=${lat},${lng}`;

  logger.info('Localização extraída via API interna.', { vehicleName, lat, lng });

  return {
    success:     true,
    veiculo:     vehicleName,
    latitude:    parseFloat(lat),
    longitude:   parseFloat(lng),
    endereco:    addr || 'Endereço não disponível',
    velocidade:  `${parseFloat(speed).toFixed(0)} km/h`,
    maps_link:   googleMapsLink,
    fonte:       'api_interna',
    capturado_em: new Date().toISOString(),
  };
}

// ─── Extrai dados de localização do popup/painel aberto no mapa ───────────────
async function _extractLocationData(page, vehicleName) {
  await page.waitForTimeout(1000); // deixa o popup renderizar

  // Tenta capturar endereço
  let address = null;
  try {
    address = await page.$eval(SEL.addressField, el => el.innerText.trim());
  } catch {
    // tenta texto completo do popup
    try {
      address = await page.$eval(SEL.vehiclePopup, el => el.innerText.trim());
    } catch { /* ignora */ }
  }

  // Tenta capturar coordenadas (podem estar em atributos data- ou em texto)
  let lat = null, lng = null;

  // Método 1: data-lat / data-lng no elemento do popup
  try {
    const popup = await page.$(SEL.vehiclePopup);
    lat = await popup.getAttribute('data-lat');
    lng = await popup.getAttribute('data-lng');
  } catch { /* ignora */ }

  // Método 2: URL do mapa (muitas versões do GPSWox atualizam o hash com lat/lng)
  if (!lat || !lng) {
    const url = page.url();
    const hashMatch = url.match(/[@/](-?\d+\.\d+)[,/](-?\d+\.\d+)/);
    if (hashMatch) {
      lat = hashMatch[1];
      lng = hashMatch[2];
    }
  }

  // Método 3: captura via execução de JS — leaflet expõe o centro do mapa
  if (!lat || !lng) {
    try {
      const coords = await page.evaluate(() => {
        if (window.map && window.map.getCenter) {
          const c = window.map.getCenter();
          return { lat: c.lat, lng: c.lng };
        }
        // Wialon/GPSWox às vezes expõe um objeto global de unidades
        if (window.wialon && window.wialon.core && window.wialon.core.Session) {
          return null; // Wialon puro tem SDK próprio
        }
        return null;
      });
      if (coords) { lat = coords.lat; lng = coords.lng; }
    } catch { /* ignora */ }
  }

  if (!lat || !lng) {
    // Retorna só o endereço textual se não conseguiu coordenadas
    logger.warn('Coordenadas não extraídas, retornando apenas texto.', { vehicleName });
    return {
      success:     true,
      veiculo:     vehicleName,
      latitude:    null,
      longitude:   null,
      endereco:    address || 'Localização encontrada mas coordenadas indisponíveis.',
      velocidade:  null,
      maps_link:   null,
      fonte:       'popup_texto',
      capturado_em: new Date().toISOString(),
    };
  }

  const googleMapsLink = `https://maps.google.com/?q=${lat},${lng}`;

  logger.info('Localização extraída com sucesso.', { vehicleName, lat, lng });

  return {
    success:     true,
    veiculo:     vehicleName,
    latitude:    parseFloat(lat),
    longitude:   parseFloat(lng),
    endereco:    address || 'Endereço não disponível',
    velocidade:  null,
    maps_link:   googleMapsLink,
    fonte:       'popup_mapa',
    capturado_em: new Date().toISOString(),
  };
}

module.exports = { getVehicleLocation };
