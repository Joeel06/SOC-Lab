import { SEVERITY_ORDER } from './severity.js';

const DEFAULT_WINDOW_MINUTES = 10;
const MAX_SAMPLES = 5;

function correlationKey(a) {
  return [a.source, a.agent, a.ruleId ?? 'norule', a.srcIp || '', a.dstIp || ''].join('|');
}

function toSingleton(a) {
  return {
    ...a,
    count: 1,
    firstSeen: a.timestamp,
    lastSeen: a.timestamp,
    groupedIds: [a.id],
    samples: [{ timestamp: a.timestamp, raw: a.raw }],
  };
}

// Agrupa alertas casi idénticas (misma regla + mismo agente + mismas IPs)
// que ocurren dentro de una ventana de tiempo, para que una ráfaga (p.ej.
// 10 pings desde la misma IP disparando la misma regla) no llene el feed
// con 10 filas iguales: se convierte en una sola entrada con un contador
// (count), primera/última vez vista (firstSeen/lastSeen) y unas pocas
// muestras del log original (samples, tope MAX_SAMPLES) para el detalle.
//
// Importante: si la MISMA clave (regla+agente+IPs) vuelve a aparecer mucho
// más tarde, después de que la ráfaga anterior ya "cerrase" por superar la
// ventana, se trata como una ráfaga nueva y separada — no se mezclan ni se
// pierden alertas de la ráfaga anterior.
export function groupAlerts(alerts, { windowMinutes = DEFAULT_WINDOW_MINUTES, enabled = true } = {}) {
  if (!enabled || !alerts.length) {
    return alerts.map(toSingleton);
  }

  const windowMs = Math.max(1, Number(windowMinutes) || DEFAULT_WINDOW_MINUTES) * 60 * 1000;
  const chronological = [...alerts].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const openGroups = new Map(); // key -> grupo "abierto" (última alerta vista dentro de la ventana)
  const closedGroups = [];

  for (const alert of chronological) {
    const key = correlationKey(alert);
    const existing = openGroups.get(key);
    const t = new Date(alert.timestamp).getTime();

    if (existing && t - new Date(existing.lastSeen).getTime() <= windowMs) {
      existing.count += 1;
      existing.lastSeen = alert.timestamp;
      existing.groupedIds.push(alert.id);
      if (existing.samples.length < MAX_SAMPLES) {
        existing.samples.push({ timestamp: alert.timestamp, raw: alert.raw });
      }
      if (SEVERITY_ORDER[alert.severity] > SEVERITY_ORDER[existing.severity]) {
        existing.severity = alert.severity;
        existing.level = alert.level;
      }
    } else {
      // Si había un grupo abierto con esta clave pero ya superó la ventana,
      // se archiva tal cual (no se pierde) antes de abrir uno nuevo.
      if (existing) closedGroups.push(existing);

      openGroups.set(key, {
        id: `group:${alert.id}`,
        firstSeen: alert.timestamp,
        lastSeen: alert.timestamp,
        level: alert.level,
        severity: alert.severity,
        source: alert.source,
        agent: alert.agent,
        agentId: alert.agentId,
        description: alert.description,
        ruleId: alert.ruleId,
        ruleGroups: alert.ruleGroups,
        srcIp: alert.srcIp,
        dstIp: alert.dstIp,
        category: alert.category,
        count: 1,
        groupedIds: [alert.id],
        samples: [{ timestamp: alert.timestamp, raw: alert.raw }],
      });
    }
  }

  const all = [...closedGroups, ...openGroups.values()];
  return all.map((g) => ({ ...g, timestamp: g.lastSeen }));
}
