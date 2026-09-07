import { Router } from 'express';
import { config } from './config.js';
import { fetchAlertsFromWazuh } from './wazuhClient.js';
import { fetchMockAlerts } from './mockData.js';
import { fetchAgentsFromWazuh } from './wazuhManagerClient.js';
import { summarize } from './normalize.js';
import { groupAlerts } from './correlate.js';
import { SEVERITY_ORDER } from './severity.js';
import { readSettings, writeSettings } from './settingsStore.js';
import { sendTelegramMessage } from './telegram.js';
import { analyzeAlert, getCachedAnalysis, setCachedAnalysis } from './gemini.js';

export const router = Router();

async function getAlerts() {
  return config.mode === 'live' ? fetchAlertsFromWazuh({ size: 1500 }) : fetchMockAlerts({ size: 60 });
}

router.get('/alerts', async (req, res) => {
  try {
    const { minSeverity, source, agent, q } = req.query;

    let alerts = await getAlerts();

    if (source && source !== 'all') {
      alerts = alerts.filter((a) => a.source === source);
    }
    if (minSeverity && SEVERITY_ORDER[minSeverity] !== undefined) {
      alerts = alerts.filter((a) => SEVERITY_ORDER[a.severity] >= SEVERITY_ORDER[minSeverity]);
    }
    if (agent && agent !== 'all') {
      alerts = alerts.filter((a) => a.agent === agent);
    }
    if (q) {
      const needle = String(q).toLowerCase();
      alerts = alerts.filter((a) => a.description.toLowerCase().includes(needle));
    }

    alerts.sort((a, b) => {
      const timeDiff = new Date(b.timestamp) - new Date(a.timestamp);
      if (timeDiff !== 0) return timeDiff;
      return SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    });

    // El resumen (nº por severidad, agentCount...) se calcula sobre las
    // alertas reales (sin agrupar), para que refleje el volumen real de
    // eventos. La lista que se manda al frontend sí se agrupa (correlación),
    // para que una ráfaga de eventos casi idénticos no llene el feed.
    const summary = summarize(alerts);

    const settings = readSettings();
    const grouped = groupAlerts(alerts, {
      enabled: settings.interface.correlateAlerts !== false,
      windowMinutes: settings.interface.correlationWindowMinutes,
    }).sort((a, b) => {
      const timeDiff = new Date(b.timestamp) - new Date(a.timestamp);
      if (timeDiff !== 0) return timeDiff;
      return SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    });

    res.json({
      mode: config.mode,
      summary,
      alerts: grouped,
    });
  } catch (err) {
    console.error('Error obteniendo alertas:', err);
    res.status(502).json({ error: 'No se pudo obtener alertas', detail: String(err.message || err) });
  }
});

// Análisis de una alerta (o grupo de alertas) con IA (Gemini). El frontend
// manda el objeto de la alerta tal cual lo recibió de /alerts (ya incluye
// samples/raw), así no hace falta volver a consultar Wazuh ni guardar nada
// en el backend.
router.post('/alerts/analyze', async (req, res) => {
  try {
    const alert = req.body?.alert;
    if (!alert || !alert.id) {
      return res.status(400).json({ error: 'Falta el objeto de la alerta a analizar.' });
    }

    const cached = getCachedAnalysis(alert.id);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const settings = readSettings();
    if (!settings.ai.enabled) {
      return res.status(400).json({ error: 'El análisis con IA está desactivado. Actívalo en Ajustes.' });
    }
    if (!settings.ai.apiKey) {
      return res.status(400).json({ error: 'Falta configurar la API key de Gemini en Ajustes.' });
    }

    const result = await analyzeAlert(alert, { apiKey: settings.ai.apiKey, model: settings.ai.model });
    setCachedAnalysis(alert.id, result);
    res.json({ ...result, cached: false });
  } catch (err) {
    console.error('Error analizando alerta con IA:', err);
    res.status(502).json({ error: String(err.message || err) });
  }
});

router.post('/ai/test', async (req, res) => {
  try {
    const s = readSettings();
    if (!s.ai.apiKey) {
      return res.status(400).json({ error: 'Configura la API key de Gemini antes de probar.' });
    }

    const sampleAlert = {
      id: '__test__',
      description: 'Prueba de conexión del panel Mini-SOC con Gemini',
      severity: 'medium',
      level: 6,
      source: 'wazuh',
      agent: 'panel-test',
      ruleId: '0',
      ruleGroups: [],
      timestamp: new Date().toISOString(),
      count: 1,
    };

    const result = await analyzeAlert(sampleAlert, { apiKey: s.ai.apiKey, model: s.ai.model });
    res.json({ ok: true, sample: result.text });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

// Listado de agentes "por separado", con su estado real (vía API del
// Wazuh Manager, puerto 55000) cruzado con las alertas que ha generado cada
// uno. Si la API del Manager no está configurada (o falla), se degrada a
// un listado derivado únicamente de las alertas.
router.get('/agents', async (req, res) => {
  try {
    let roster = [];
    let warning = null;

    if (config.mode === 'live') {
      try {
        roster = await fetchAgentsFromWazuh();
      } catch (err) {
        warning = String(err.message || err);
      }
    }

    const alerts = await getAlerts();
    const statsByAgent = {};
    const lastAlertByAgent = {};

    for (const a of alerts) {
      // El pseudo-agente "000" (el propio manager) no es un endpoint real —
      // lo dejamos fuera del roster igual que en /alerts summarize().
      if (a.agentId === '000') continue;

      const bucket = (statsByAgent[a.agent] ??= { critical: 0, high: 0, medium: 0, low: 0, total: 0 });
      bucket[a.severity] = (bucket[a.severity] || 0) + 1;
      bucket.total += 1;
      if (!lastAlertByAgent[a.agent] || new Date(a.timestamp) > new Date(lastAlertByAgent[a.agent])) {
        lastAlertByAgent[a.agent] = a.timestamp;
      }
    }

    const emptyStats = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
    let agents;
    let source;

    if (roster.length) {
      source = 'wazuh-api';
      agents = roster.map((r) => ({
        ...r,
        alerts: statsByAgent[r.name] || emptyStats,
        lastAlert: lastAlertByAgent[r.name] || null,
      }));
    } else {
      source = 'alerts-derived';
      agents = Object.keys(statsByAgent).map((name) => ({
        id: null,
        name,
        ip: null,
        status: 'unknown',
        os: null,
        version: null,
        group: null,
        lastKeepAlive: null,
        alerts: statsByAgent[name],
        lastAlert: lastAlertByAgent[name],
      }));
    }

    agents.sort((a, b) => (b.alerts.total || 0) - (a.alerts.total || 0));

    res.json({ mode: config.mode, source, warning, agents });
  } catch (err) {
    console.error('Error obteniendo agentes:', err);
    res.status(502).json({ error: 'No se pudo obtener agentes', detail: String(err.message || err) });
  }
});

// Ajustes editables desde el panel (Ajustes): interfaz, Telegram e IA.
// El token del bot / la API key de Gemini nunca se devuelven en claro, sólo
// si hay uno guardado y sus últimos 4 caracteres, para poder confirmarlo
// sin exponerlo.
function publicSettings(s) {
  return {
    interface: s.interface,
    telegram: {
      enabled: s.telegram.enabled,
      chatId: s.telegram.chatId,
      minSeverity: s.telegram.minSeverity,
      botTokenSet: !!s.telegram.botToken,
      botTokenPreview: s.telegram.botToken ? `••••${s.telegram.botToken.slice(-4)}` : '',
    },
    ai: {
      enabled: s.ai.enabled,
      model: s.ai.model,
      autoAnalyzeMinSeverity: s.ai.autoAnalyzeMinSeverity,
      apiKeySet: !!s.ai.apiKey,
      apiKeyPreview: s.ai.apiKey ? `••••${s.ai.apiKey.slice(-4)}` : '',
    },
  };
}

router.get('/settings', (req, res) => {
  res.json(publicSettings(readSettings()));
});

router.put('/settings', (req, res) => {
  const body = req.body || {};
  const patch = { interface: {}, telegram: {}, ai: {} };

  if (body.interface) {
    const { refreshMs, defaultMinSeverity, defaultSource, correlateAlerts, correlationWindowMinutes } = body.interface;
    if (refreshMs) patch.interface.refreshMs = Math.max(2000, Number(refreshMs) || 5000);
    if (defaultMinSeverity) patch.interface.defaultMinSeverity = defaultMinSeverity;
    if (defaultSource) patch.interface.defaultSource = defaultSource;
    if (correlateAlerts !== undefined) patch.interface.correlateAlerts = !!correlateAlerts;
    if (correlationWindowMinutes) {
      patch.interface.correlationWindowMinutes = Math.max(1, Number(correlationWindowMinutes) || 10);
    }
  }

  if (body.telegram) {
    const { enabled, chatId, minSeverity, botToken } = body.telegram;
    if (enabled !== undefined) patch.telegram.enabled = !!enabled;
    if (chatId !== undefined) patch.telegram.chatId = String(chatId);
    if (minSeverity) patch.telegram.minSeverity = minSeverity;
    if (botToken) patch.telegram.botToken = String(botToken); // sólo se sobrescribe si llega uno nuevo
  }

  if (body.ai) {
    const { enabled, model, autoAnalyzeMinSeverity, apiKey } = body.ai;
    if (enabled !== undefined) patch.ai.enabled = !!enabled;
    if (model) patch.ai.model = model;
    if (autoAnalyzeMinSeverity) patch.ai.autoAnalyzeMinSeverity = autoAnalyzeMinSeverity;
    if (apiKey) patch.ai.apiKey = String(apiKey); // idem: sólo se sobrescribe si llega una nueva
  }

  const saved = writeSettings(patch);
  res.json(publicSettings(saved));
});

router.post('/telegram/test', async (req, res) => {
  try {
    const s = readSettings();
    if (!s.telegram.botToken || !s.telegram.chatId) {
      return res.status(400).json({ error: 'Configura el token del bot y el chat ID antes de probar.' });
    }
    await sendTelegramMessage(
      s.telegram.botToken,
      s.telegram.chatId,
      '✅ Mini-SOC: prueba de conexión con Telegram correcta.'
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

router.get('/health', (req, res) => {
  res.json({ ok: true, mode: config.mode });
});
