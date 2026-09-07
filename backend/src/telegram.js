// Cliente mínimo de la Bot API de Telegram — sólo lo que necesita el panel:
// mandar texto a un chat/canal ya conocido (chatId). No usa librerías extra,
// la Bot API es HTTP plano.

export async function sendTelegramMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(json.description || `Telegram respondió ${res.status}`);
  }
  return json;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const SEVERITY_EMOJI = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
const SEVERITY_LABEL = { critical: 'CRÍTICA', high: 'ALTA', medium: 'MEDIA', low: 'BAJA' };
const SOURCE_LABEL = { suricata: '🛰 Suricata (red)', wazuh: '🖥 Wazuh (host)' };

// Longitud máxima del fragmento del log original que se incluye en el
// mensaje cuando NO hay análisis de IA — Telegram admite hasta 4096
// caracteres por mensaje y no queremos que un full_log larguísimo se coma
// el resto de la info.
const FULL_LOG_PREVIEW_CHARS = 500;

// Explicaciones cortas en función de los grupos de la regla (o de la
// categoría de Suricata) — se usan sólo cuando NO hay análisis de IA para
// esta alerta, como fallback más simple.
const GROUP_EXPLANATIONS = [
  { groups: ['authentication_failed'], text: 'Fallos de autenticación repetidos: posible intento de fuerza bruta.' },
  { groups: ['authentication_success'], text: 'Inicio de sesión correcto — revisa si lo esperabas.' },
  { groups: ['syscheck', 'ossec'], text: 'Cambio de integridad en un archivo del sistema (FIM): puede indicar manipulación no autorizada.' },
  { groups: ['rootcheck'], text: 'Anomalía detectada por la verificación de rootkits/comportamiento del host.' },
  { groups: ['privilege_escalation', 'audit_command'], text: 'Posible escalado de privilegios o ejecución de un comando sensible.' },
  { groups: ['sql_injection'], text: 'Posible intento de inyección SQL.' },
  { groups: ['web', 'attack'], text: 'Patrón de ataque web detectado.' },
  { groups: ['recon', 'scan'], text: 'Actividad de reconocimiento/escaneo: alguien está mapeando el sistema o la red.' },
  { groups: ['exploit'], text: 'Patrón de explotación de una vulnerabilidad conocida.' },
  { groups: ['pci_dss_10.2.4'], text: 'Evento relevante para el cumplimiento PCI-DSS (control de accesos).' },
];

function explainAlert(alert) {
  const groups = (alert.ruleGroups || []).map((g) => String(g).toLowerCase());
  for (const rule of GROUP_EXPLANATIONS) {
    if (rule.groups.some((g) => groups.includes(g))) return rule.text;
  }
  if (alert.source === 'suricata' && alert.category) {
    return `Categoría de red (Suricata): ${alert.category}.`;
  }
  if (alert.severity === 'critical') {
    return 'Severidad crítica según la escala de Wazuh: conviene revisarla cuanto antes.';
  }
  return null;
}

export function formatAlertMessage(alert, { aiAnalysis } = {}) {
  const emoji = SEVERITY_EMOJI[alert.severity] || '⚪';
  const count = alert.count || 1;

  const lines = [`${emoji} <b>${escapeHtml(alert.description)}</b>`];

  if (count > 1) {
    const from = new Date(alert.firstSeen).toLocaleTimeString('es-ES');
    const to = new Date(alert.lastSeen).toLocaleTimeString('es-ES');
    lines.push(`🔁 Se repitió <b>${count}</b> veces (misma regla/origen) entre ${from} y ${to}`);
  }

  lines.push('');
  lines.push(`Severidad: <b>${SEVERITY_LABEL[alert.severity] || alert.severity}</b> (nivel ${alert.level})`);
  lines.push(`Origen: ${SOURCE_LABEL[alert.source] || escapeHtml(alert.source)}`);
  lines.push(`Agente: ${escapeHtml(alert.agent)}`);

  if (alert.ruleId) lines.push(`Regla: ${escapeHtml(String(alert.ruleId))}`);
  if (alert.ruleGroups?.length) lines.push(`Grupos: ${escapeHtml(alert.ruleGroups.join(', '))}`);
  if (alert.srcIp) lines.push(`IP: ${escapeHtml(alert.srcIp)}${alert.dstIp ? ' → ' + escapeHtml(alert.dstIp) : ''}`);
  if (alert.category) lines.push(`Categoría: ${escapeHtml(alert.category)}`);

  if (aiAnalysis) {
    lines.push('', '🧠 <b>Análisis IA</b>', escapeHtml(aiAnalysis));
  } else {
    const explanation = explainAlert(alert);
    if (explanation) lines.push('', `ℹ️ ${explanation}`);

    // El log crudo sólo se manda si no hay análisis de IA (que ya cita lo
    // relevante), para no pasarnos del límite de 4096 caracteres de Telegram.
    const fullLog = alert.samples?.[0]?.raw?.full_log || alert.raw?.full_log;
    if (fullLog) {
      const text = String(fullLog);
      const trimmed = text.length > FULL_LOG_PREVIEW_CHARS ? `${text.slice(0, FULL_LOG_PREVIEW_CHARS)}…` : text;
      lines.push('', `<pre>${escapeHtml(trimmed)}</pre>`);
    }
  }

  lines.push('', `🕒 ${new Date(alert.timestamp).toLocaleString('es-ES')}`);

  return lines.join('\n');
}
