// Cliente mínimo de la API de Gemini (Google AI Studio, capa gratuita) para
// pedirle un análisis tipo "analista SOC" de una alerta. Sin SDK: la API
// REST de generateContent es HTTP + JSON plano.

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Caché en memoria: evita volver a gastar cuota si reabres la misma alerta
// o si el vigilante en segundo plano ya la analizó. Se pierde al reiniciar
// el backend, que es aceptable aquí (no es información que deba persistir).
const analysisCache = new Map(); // id -> { text, model, createdAt }

export function getCachedAnalysis(id) {
  return analysisCache.get(id) || null;
}

export function setCachedAnalysis(id, data) {
  analysisCache.set(id, data);
}

const SEVERITY_LABEL = { critical: 'CRÍTICA', high: 'ALTA', medium: 'MEDIA', low: 'BAJA' };

const SYSTEM_PROMPT = `Eres un analista SOC (Security Operations Center) con experiencia, explicando alertas de Wazuh/Suricata a un compañero que está aprendiendo ciberseguridad. Responde SIEMPRE en español, de forma clara y concisa (máximo ~180 palabras), con este formato exacto:

📋 Resumen: qué está pasando, en una frase y en lenguaje llano.
🎯 Técnica/patrón: qué técnica o patrón de ataque encaja (menciona la táctica de MITRE ATT&CK si aplica; si no aplica, dilo).
🔍 Siguiente paso: qué comprobaría un analista a continuación para confirmar o descartar.
⚖️ Falso positivo: valora si podría serlo y por qué (o por qué no).

No inventes datos que no estén en la alerta. Si la información es insuficiente para alguna sección, dilo brevemente en vez de rellenar con suposiciones.`;

function buildPrompt(alert) {
  const isGroup = (alert.count || 1) > 1;
  const lines = [];

  lines.push(`Descripción: ${alert.description}`);
  lines.push(`Severidad (Wazuh): ${SEVERITY_LABEL[alert.severity] || alert.severity} (nivel ${alert.level})`);
  lines.push(`Origen: ${alert.source === 'suricata' ? 'Suricata (red/IDS)' : 'Wazuh (host)'}`);
  lines.push(`Agente: ${alert.agent}`);
  if (alert.ruleId) lines.push(`ID de regla: ${alert.ruleId}`);
  if (alert.ruleGroups?.length) lines.push(`Grupos de la regla: ${alert.ruleGroups.join(', ')}`);
  if (alert.srcIp) lines.push(`IP origen: ${alert.srcIp}${alert.dstIp ? ` -> IP destino: ${alert.dstIp}` : ''}`);
  if (alert.category) lines.push(`Categoría: ${alert.category}`);

  if (isGroup) {
    lines.push(
      `\nNOTA: esta entrada agrupa ${alert.count} eventos casi idénticos (misma regla/agente/IPs) ` +
      `entre ${alert.firstSeen} y ${alert.lastSeen}.`
    );
  }

  const samples = alert.samples?.length
    ? alert.samples
    : (alert.raw ? [{ timestamp: alert.timestamp, raw: alert.raw }] : []);

  if (samples.length) {
    lines.push('\nEjemplos de log original (full_log) de esta alerta:');
    for (const s of samples.slice(0, 3)) {
      const text = s.raw?.full_log ?? JSON.stringify(s.raw ?? {});
      lines.push(`- [${s.timestamp}] ${String(text).slice(0, 400)}`);
    }
  }

  return lines.join('\n');
}

export async function analyzeAlert(alert, { apiKey, model } = {}) {
  if (!apiKey) throw new Error('Falta la API key de Gemini');
  const useModel = model || 'gemini-3.5-flash-lite';

  const url = `${API_BASE}/${useModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildPrompt(alert) }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || `Gemini respondió ${res.status}`);
  }

  const text = (json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) {
    const blockReason = json?.promptFeedback?.blockReason;
    throw new Error(blockReason ? `Gemini bloqueó la respuesta (${blockReason})` : 'Gemini no devolvió texto');
  }

  return { text, model: useModel, createdAt: new Date().toISOString() };
}
