import { levelToSeverity } from './severity.js';

// Detecta si una alerta viene de Suricata (vía eve.json ingerido por Wazuh como
// localfile) o es una alerta "nativa" de Wazuh (auth, FIM/syscheck, rootcheck, etc.)
function detectSource(doc) {
  const groups = (doc?.rule?.groups || []).map((g) => String(g).toLowerCase());
  const hasIdsGroup = groups.some((g) => ['ids', 'suricata', 'nids', 'intrusion_detection'].includes(g));
  const hasSuricataPayload = !!(doc?.data?.alert?.signature || doc?.data?.alert?.category);
  if (hasIdsGroup || hasSuricataPayload) return 'suricata';
  return 'wazuh';
}

function pickDescription(doc, source) {
  if (source === 'suricata') {
    return doc?.data?.alert?.signature || doc?.rule?.description || 'Alerta de red sin descripción';
  }
  return doc?.rule?.description || 'Alerta sin descripción';
}

// Convierte un hit crudo del Indexer (OpenSearch/Elasticsearch _source) al formato
// común que consume el frontend.
export function normalizeAlert(doc, id) {
  const source = detectSource(doc);
  const level = doc?.rule?.level ?? 0;

  return {
    id: id || doc?.id || `${doc?.['@timestamp'] || doc?.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: doc?.['@timestamp'] || doc?.timestamp || new Date().toISOString(),
    level,
    severity: levelToSeverity(level),
    source, // 'suricata' | 'wazuh'
    agent: doc?.agent?.name || 'desconocido',
    // El agente "000" es un pseudo-agente que usa el propio Wazuh Manager para
    // sus eventos internos (arranque, autochequeos...); su "agent.name" suele
    // ser el hostname del propio manager, y por eso puede colarse en listados
    // de agentes como si fuera un endpoint monitorizado real. Lo guardamos
    // para poder excluirlo donde se listan agentes (no donde se cuentan alertas).
    agentId: doc?.agent?.id ?? null,
    description: pickDescription(doc, source),
    ruleId: doc?.rule?.id,
    ruleGroups: doc?.rule?.groups || [],
    srcIp: doc?.data?.srcip || doc?.data?.src_ip || doc?.data?.alert?.src_ip || null,
    dstIp: doc?.data?.dstip || doc?.data?.dest_ip || doc?.data?.alert?.dest_ip || null,
    category: doc?.data?.alert?.category || null,
    raw: doc,
  };
}

const MANAGER_PSEUDO_AGENT_ID = '000';

export function summarize(alerts) {
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  const agents = new Set();
  let lastTimestamp = null;

  for (const a of alerts) {
    bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
    // Todas las alertas cuentan para el total/severidad (son eventos reales),
    // pero el pseudo-agente del propio manager no cuenta como "agente" —
    // si no, cada instalación tendría siempre +1 "agente" fantasma con el
    // hostname del servidor, aunque nunca se haya dado de alta ningún endpoint.
    if (a.agentId !== MANAGER_PSEUDO_AGENT_ID) {
      agents.add(a.agent);
    }
    if (!lastTimestamp || new Date(a.timestamp) > new Date(lastTimestamp)) {
      lastTimestamp = a.timestamp;
    }
  }

  return {
    total: alerts.length,
    bySeverity,
    agentCount: agents.size,
    agents: Array.from(agents),
    lastTimestamp,
  };
}
