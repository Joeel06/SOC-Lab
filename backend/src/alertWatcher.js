// Vigilante en segundo plano, un único tick cada 20s que:
//   1. Trae las alertas recientes y las agrupa (correlación).
//   2. Para cada grupo nuevo (no visto antes) por encima del umbral de IA,
//      lo analiza con Gemini y guarda el resultado en caché — así, cuando
//      abras esa alerta en el panel, el análisis ya está ahí.
//   3. Para cada grupo nuevo por encima del umbral de Telegram, lo manda
//      (incluyendo el análisis de IA si se calculó en el paso 2).
//
// "Grupo nuevo" = su id no se ha visto antes en este proceso. Así, si una
// ráfaga sigue creciendo (más eventos con la misma regla/IP llegando), no
// se re-analiza ni se re-envía el mismo grupo una y otra vez mientras crece
// — se trata una vez, que es justo el objetivo de agrupar.

import { config } from './config.js';
import { readSettings } from './settingsStore.js';
import { fetchAlertsFromWazuh } from './wazuhClient.js';
import { fetchMockAlerts } from './mockData.js';
import { groupAlerts } from './correlate.js';
import { sendTelegramMessage, formatAlertMessage } from './telegram.js';
import { analyzeAlert, setCachedAnalysis } from './gemini.js';
import { SEVERITY_ORDER } from './severity.js';

const TICK_MS = 20000;
const MAX_GROUPS_PER_TICK = 10; // evita ráfagas de spam/gasto de cuota si hay un pico
const MAX_NOTIFIED_IDS = 5000; // evita que el Set crezca sin límite en instalaciones que llevan mucho tiempo levantadas

let started = false;
const notifiedGroupIds = new Set();

export function startAlertWatcher() {
  if (started) return;
  started = true;
  setInterval(tick, TICK_MS);
}

function pruneNotifiedIds() {
  if (notifiedGroupIds.size <= MAX_NOTIFIED_IDS) return;
  const toRemove = notifiedGroupIds.size - Math.floor(MAX_NOTIFIED_IDS / 2);
  let removed = 0;
  for (const id of notifiedGroupIds) {
    if (removed >= toRemove) break;
    notifiedGroupIds.delete(id);
    removed += 1;
  }
}

async function tick() {
  const settings = readSettings();
  const aiOn = settings.ai.enabled && !!settings.ai.apiKey;
  const tgOn = settings.telegram.enabled && !!settings.telegram.botToken && !!settings.telegram.chatId;
  if (!aiOn && !tgOn) return;

  try {
    const alerts = config.mode === 'live'
      ? await fetchAlertsFromWazuh({ size: 150 })
      : await fetchMockAlerts({ size: 30 });

    const groups = groupAlerts(alerts, {
      enabled: settings.interface.correlateAlerts !== false,
      windowMinutes: settings.interface.correlationWindowMinutes,
    });

    const fresh = groups
      .filter((g) => !notifiedGroupIds.has(g.id))
      .sort((a, b) => new Date(a.lastSeen) - new Date(b.lastSeen))
      .slice(-MAX_GROUPS_PER_TICK);

    for (const group of fresh) {
      notifiedGroupIds.add(group.id);

      let aiText = null;
      if (
        aiOn &&
        settings.ai.autoAnalyzeMinSeverity !== 'off' &&
        SEVERITY_ORDER[group.severity] >= SEVERITY_ORDER[settings.ai.autoAnalyzeMinSeverity]
      ) {
        try {
          const result = await analyzeAlert(group, { apiKey: settings.ai.apiKey, model: settings.ai.model });
          setCachedAnalysis(group.id, result);
          aiText = result.text;
        } catch (err) {
          console.error('Error analizando alerta con IA:', err.message || err);
        }
      }

      if (tgOn && SEVERITY_ORDER[group.severity] >= SEVERITY_ORDER[settings.telegram.minSeverity]) {
        try {
          await sendTelegramMessage(
            settings.telegram.botToken,
            settings.telegram.chatId,
            formatAlertMessage(group, { aiAnalysis: aiText })
          );
        } catch (err) {
          console.error('Error enviando alerta a Telegram:', err.message || err);
        }
      }
    }

    pruneNotifiedIds();
  } catch (err) {
    console.error('Error en el vigilante de alertas:', err.message || err);
  }
}
