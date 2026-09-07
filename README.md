# Mini-SOC Dashboard — Wazuh + Suricata unificado

Panel personalizado que centraliza las alertas de **Wazuh** (host-based: auth, FIM/syscheck, rootcheck)
y las de **Suricata** (red/IDS, ya ingeridas por Wazuh vía `eve.json`) en una sola vista, ordenada por
severidad, con las alertas más críticas destacadas arriba.

Arquitectura:

```
Suricata (eve.json) ──▶ Wazuh Manager (localfile) ──▶ Wazuh Indexer (OpenSearch, wazuh-alerts-*)
                                                              │
                                                    backend/ (Node/Express)
                                                    consulta el Indexer, normaliza
                                                    y clasifica cada alerta como
                                                    "suricata" o "wazuh"
                                                              │
                                                    frontend/ (React + Vite)
                                                    panel con resumen, filtros
                                                    y feed priorizado
```

No hace falta tocar Suricata ni Wazuh: como ya tienes el `eve.json` integrado como `localfile` en el
manager, esas alertas ya están en el índice `wazuh-alerts-*` del Indexer, mezcladas con las de host.
El backend las separa mirando `rule.groups` / los campos `data.alert.*` que deja el decoder de Suricata.

## Arranque rápido (modo demo, sin credenciales)

Por defecto el backend arranca en `MODE=mock` y genera alertas de ejemplo (mezcla realista de
Suricata + Wazuh) para que puedas ver el panel funcionando ya mismo.

```bash
# 1. Backend
cd backend
cp .env.example .env
npm install
npm run dev          # http://localhost:4000

# 2. Frontend (otra terminal)
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Abre http://localhost:5173 — verás el panel con datos simulados, refrescándose solo.

## Conectarlo a tu Wazuh real

Edita `backend/.env`:

```
MODE=live
WAZUH_INDEXER_HOST=https://192.168.0.22:9200
WAZUH_INDEXER_USER=admin
WAZUH_INDEXER_PASS=tu_password_del_indexer
WAZUH_INDEXER_INSECURE=true   # true si usas el certificado autofirmado por defecto
```

Reinicia el backend (`npm run dev`) y el panel pasará a mostrar alertas reales de tu
`wazuh-alerts-*`. Si lo corres desde el propio "UbuntuServerSoc" o desde una máquina de tu
red local que tenga visibilidad al puerto 9200, funcionará sin nada más.

### Listado real de agentes (pestaña "Agentes")

El Indexer sólo tiene alertas, no el roster de agentes — por eso el nº de "agentes" que veías
en el resumen podía no coincidir con tus agentes reales: sólo contaba a quien había disparado
alguna alerta dentro de las últimas ~1500 que trae el panel, no a los agentes sin alertas
recientes. La pestaña **Agentes** resuelve esto consultando la API del propio Wazuh Manager
(puerto 55000), que sí tiene el listado real con su estado de conexión.

Añade en `backend/.env` (usuario de sólo lectura recomendado):

```
WAZUH_API_HOST=https://192.168.0.22:55000
WAZUH_API_USER=wazuh-wui
WAZUH_API_PASS=tu_password_de_la_api
WAZUH_API_INSECURE=true
```

Si no la configuras, la pestaña Agentes sigue funcionando pero degradada: sólo muestra los
agentes que aparecen en las alertas (con un aviso en el panel explicándolo).

## Qué hace el backend

- `GET /api/alerts` — trae las últimas N alertas del índice `wazuh-alerts-*`, las normaliza a un
  formato común `{ id, timestamp, severity, level, source, agent, description, srcIp, dstIp, raw }`
  y calcula un resumen (conteo por severidad, nº de agentes, última alerta).
- Clasificación `source`:
  - `suricata` si `rule.groups` incluye `ids`/`suricata`/`nids` o el evento trae `data.alert.signature`
    (así es como llegan los eventos de `eve.json` una vez decodificados por Wazuh).
  - `wazuh` en cualquier otro caso (autenticación, FIM, rootcheck, reglas propias, etc.).
- Mapeo de severidad a partir de `rule.level` (escala 0–15 de Wazuh):
  - `critical` ≥ 12, `high` 8–11, `medium` 4–7, `low` 0–3.
- Filtros soportados vía query string: `minSeverity`, `source` (`all|suricata|wazuh`), `agent`, `q`
  (búsqueda libre en la descripción).
- `GET /api/agents` — roster de agentes vía la API del Wazuh Manager (puerto 55000), cruzado con
  el conteo de alertas por severidad de cada uno. Si esa API no está configurada o falla, se
  degrada a un listado derivado sólo de las alertas (`source: "alerts-derived"` en la respuesta,
  con un `warning` si hubo un error concreto).
- `GET /api/settings` / `PUT /api/settings` — ajustes de interfaz y de Telegram, persistidos en
  `backend/data/settings.json`. El token del bot nunca se devuelve en claro, sólo si hay uno
  guardado (`botTokenSet`) y sus últimos 4 caracteres (`botTokenPreview`).
- `POST /api/telegram/test` — manda un mensaje de prueba al chat configurado.
- Vigilante en segundo plano (`telegramNotifier.js`): cada 20s revisa si hay alertas nuevas por
  encima de la severidad mínima configurada y, si Telegram está activado, las reenvía.

## Qué hace el frontend

El panel tiene tres pestañas (Dashboard / Agentes / Ajustes):

**Dashboard**
- Tarjetas resumen: nº de críticas/altas/medias/bajas (con % sobre el total), agentes con
  alertas, hora de la última alerta.
- Feed de alertas ordenado por severidad y luego por hora, con la crítica destacada visualmente
  (borde rojo + parpadeo sutil) para que salte a la vista.
- Filtros por severidad mínima, origen (Suricata/Wazuh/todas), agente y texto libre.
- Auto-refresco (intervalo configurable desde Ajustes), con pausa manual.
- Badge de origen en cada fila (🛰 Suricata / 🖥 Wazuh) para saber de un vistazo si es un evento
  de red o de host.

**Agentes**
- Listado de agentes por separado, cada uno con su estado (activo/desconectado/nunca conectado),
  IP, SO y versión (vía la API del Wazuh Manager — ver más abajo), más un desglose de sus
  alertas por severidad y la hora de la última.
- Al hacer clic en un agente, filtra el Dashboard a sólo ese agente.

**Ajustes**
- Interfaz: frecuencia de auto-refresco, severidad y origen por defecto al abrir el panel, y
  activar/ajustar la correlación de alertas (ver abajo).
- Telegram: activar/desactivar el envío de alertas a un bot de Telegram, token del bot, chat ID
  destino, severidad mínima a notificar, y un botón para mandar un mensaje de prueba.
- IA (Gemini): API key gratuita de Google AI Studio, modelo, y desde qué severidad se analiza
  automáticamente. Todo se guarda en `backend/data/settings.json` (fuera de git).

### Correlación de alertas

Una ráfaga de eventos casi idénticos (misma regla + mismo agente + mismas IPs) en poco tiempo —
por ejemplo, 10 pings seguidos desde la misma IP — se agrupa en **una sola entrada** con un
contador (`×10` en el feed) en vez de llenar la lista con filas repetidas. Se controla desde
Ajustes → Interfaz (activar/desactivar, y la ventana de tiempo, por defecto 10 min). El resumen
de severidades sigue contando cada evento real por separado; solo el feed visual se agrupa.

### Análisis con IA (Gemini)

Cada alerta se puede analizar con Gemini (nivel gratuito de Google AI Studio) para obtener una
explicación tipo "analista SOC": resumen, técnica/patrón (con MITRE ATT&CK si aplica), qué
comprobar a continuación, y si podría ser un falso positivo.

- **Bajo demanda**: botón "Analizar con IA" en el detalle de cualquier alerta.
- **Automático para críticas**: el vigilante en segundo plano analiza sola cualquier alerta (o
  grupo correlacionado) que llegue a severidad crítica, y guarda el resultado en caché — al abrir
  esa alerta en el panel, el análisis ya está ahí. El umbral es configurable en Ajustes.
- Si Telegram también está activado, el análisis de IA se incluye directamente en el mensaje.

Aviso de privacidad: en el nivel gratuito de la API de Gemini, Google puede usar los prompts para
mejorar sus modelos (a diferencia de los tiers de pago). Ten esto en cuenta si tus logs incluyen
algo que prefieras no compartir.

## Próximos pasos sugeridos

- Añadir persistencia de "vistas/atendidas" (marcar alerta como revisada) — hoy es de solo lectura.
- Meter aquí la capa de Airia (scoring de riesgo por IA) como un campo extra `riskScore` que el
  backend calcule antes de servir la alerta, y ordenar por eso en vez de (o además de) `rule.level`.
- Autenticación del propio panel (hoy no tiene login, pensado para uso en tu red local).
- Otros canales de notificación además de Telegram (email, webhook genérico, Slack...).
