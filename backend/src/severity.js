// Wazuh usa una escala de rule.level de 0 a 15. La agrupamos en 4 buckets
// para que el panel sea legible de un vistazo.
export function levelToSeverity(level) {
  const l = Number(level) || 0;
  if (l >= 12) return 'critical';
  if (l >= 8) return 'high';
  if (l >= 4) return 'medium';
  return 'low';
}

export const SEVERITY_ORDER = { critical: 3, high: 2, medium: 1, low: 0 };

export const SEVERITY_LABEL_ES = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};
