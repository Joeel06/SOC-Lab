// El ruleset 4.x de Wazuh ya trae MITRE ATT&CK en muchas reglas (rule.mitre.id/
// tactic/technique como arrays paralelos) — si está, es el dato "oficial".
export function extractMitreFromWazuhRule(doc) {
  const m = doc?.rule?.mitre;
  if (!m?.id?.length) return null;
  return {
    ids: m.id,
    tactics: m.tactic || [],
    techniques: m.technique || [],
    inferred: false,
  };
}

// Suricata/ET no trae MITRE de fábrica. Tabla local pequeña y "best effort"
// sobre firma+categoría — NO es un mapeo oficial, por eso va marcada
// inferred:true (el frontend la muestra distinta a un tag de Wazuh). Cubre
// las familias de firmas ET más comunes de este lab, incluidas las de
// mockData.js, para que la demo se vea poblada.
const SURICATA_KEYWORD_MAP = [
  { match: /nmap|scan/i, id: 'T1595', tactic: 'Reconnaissance', technique: 'Active Scanning' },
  { match: /eternalblue|exploit/i, id: 'T1190', tactic: 'Initial Access', technique: 'Exploit Public-Facing Application' },
  { match: /ssh session|policy/i, id: 'T1046', tactic: 'Discovery', technique: 'Network Service Discovery' },
  { match: /id check|attack_response/i, id: 'T1082', tactic: 'Discovery', technique: 'System Information Discovery' },
];

export function inferMitreForSuricata(source, doc) {
  if (source !== 'suricata') return null;

  const text = [doc?.data?.alert?.signature, doc?.data?.alert?.category, doc?.rule?.description]
    .filter(Boolean)
    .join(' ');
  if (!text) return null;

  const hit = SURICATA_KEYWORD_MAP.find((entry) => entry.match.test(text));
  if (!hit) return null;

  return { ids: [hit.id], tactics: [hit.tactic], techniques: [hit.technique], inferred: true };
}
