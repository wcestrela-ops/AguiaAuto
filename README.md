# playwright-gpswox

Serviço HTTP (Express + Playwright) para automação da plataforma GPSWox.
Expõe endpoints REST que o n8n consome para buscar localização de veículos.

---

## Estrutura

```
playwright-gpswox/
├── src/
│   ├── server.js      ← Servidor Express (endpoints REST)
│   ├── browser.js     ← Gerencia sessão do Playwright (login + re-login)
│   ├── tracker.js     ← Lógica de busca de veículos (3 estratégias)
│   └── logger.js      ← Logs com Winston
├── scripts/
│   └── diagnostico.js ← Descobre seletores do seu domínio GPSWox
├── logs/              ← Logs e screenshots de diagnóstico (auto-criado)
├── .env.example       ← Copie para .env e preencha
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## Instalação passo a passo

### 1. Configurar variáveis de ambiente

```bash
cp .env.example .env
nano .env          # preencha URL, usuário, senha e API_SECRET
```

### 2. Descobrir os seletores da sua plataforma  ← FAÇA ISSO PRIMEIRO

```bash
npm install
node scripts/diagnostico.js
```

O script abre o browser **em modo visível**, faz login e imprime todos os
seletores encontrados. Copie os valores corretos para `src/browser.js > SEL`.

### 3. Construir e subir com Docker

```bash
# Se a rede do n8n ainda não existe:
docker network create n8n_network

# Subir o serviço:
docker compose up -d --build

# Ver logs em tempo real:
docker compose logs -f playwright-gpswox
```

### 4. Testar os endpoints

```bash
# Health check
curl http://localhost:3001/health

# Buscar localização
curl -X POST http://localhost:3001/localizacao \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_API_SECRET" \
  -d '{"veiculo": "NOME DO VEICULO"}'

# Buscar vários veículos
curl -X POST http://localhost:3001/localizacao/lote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_API_SECRET" \
  -d '{"veiculos": ["VEICULO 1", "VEICULO 2"]}'
```

---

## Integração com o n8n

No n8n, use o nó **HTTP Request** com as seguintes configurações:

| Campo            | Valor                                      |
|------------------|--------------------------------------------|
| Method           | POST                                       |
| URL              | `http://playwright-gpswox:3001/localizacao` |
| Authentication   | Header Auth → `Authorization: Bearer <secret>` |
| Body Content Type| JSON                                       |
| Body             | `{ "veiculo": "{{ $json.nome_veiculo }}" }` |

A resposta JSON pode ser usada diretamente para montar a mensagem do WhatsApp:
```
📍 *{{ $json.veiculo }}*
📌 {{ $json.endereco }}
🚗 {{ $json.velocidade }}
🗺️ {{ $json.maps_link }}
```

---

## Resposta de exemplo

```json
{
  "success": true,
  "veiculo": "ONIX BRANCO",
  "latitude": -3.7172,
  "longitude": -38.5434,
  "endereco": "Av. Beira Mar, 1500 - Fortaleza, CE",
  "velocidade": "42 km/h",
  "maps_link": "https://maps.google.com/?q=-3.7172,-38.5434",
  "fonte": "popup_mapa",
  "capturado_em": "2025-01-15T14:32:00.000Z"
}
```

---

## Ajuste de seletores

Se o script de diagnóstico revelar seletores diferentes dos padrões, edite
`src/browser.js` no objeto `SEL`. Os seletores mais prováveis de precisar
de ajuste são:

- `searchInput` — barra de busca de veículos no mapa
- `searchResult` — itens da lista de resultados
- `vehiclePopup` — popup que abre ao clicar no veículo
- `addressField` — campo de endereço dentro do popup

---

## Solução de problemas

| Problema | Solução |
|----------|---------|
| Login falha | Veja `logs/login_fail.png` + ajuste `SEL.loginUser/loginPass/loginBtn` |
| Veículo não encontrado | Execute `diagnostico.js` e veja os seletores de busca |
| Container não sobe | Verifique `shm_size: 512mb` no docker-compose.yml |
| Timeout frequente | Aumente `NAV_TIMEOUT` no `.env` (ex: 45000) |
| Coordenadas null | A estratégia via API interna geralmente resolve — veja os logs |
