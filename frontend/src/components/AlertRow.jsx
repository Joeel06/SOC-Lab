const SEVERITY_LABEL = { critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' };
const SEVERITY_ICON = { critical: '⛔', high: '⚠️', medium: '🟡', low: '🟢' };
const SOURCE_LABEL = { suricata: '🛰 Suricata', wazuh: '🖥 Wazuh' };

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function AlertRow({ alert, onOpen }) {
  return (
    <div
      className={`alert-row severity-${alert.severity}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(alert)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(alert);
        }
      }}
      title="Ver el log completo de esta alerta"
    >
      <div className={`severity-icon severity-${alert.severity}`}>{SEVERITY_ICON[alert.severity]}</div>

      <div className="alert-main">
        <div className="alert-desc">
          {alert.description}
          {alert.count > 1 && <span className="repeat-badge">×{alert.count}</span>}
        </div>
        <div className="alert-meta">
          <span className="source-badge">{SOURCE_LABEL[alert.source]}</span>
          <span>· agente: {alert.agent}</span>
          {alert.srcIp && <span>· {alert.srcIp} → {alert.dstIp}</span>}
          {alert.category && <span>· {alert.category}</span>}
        </div>
      </div>

      <div className={`severity-chip severity-chip-${alert.severity}`}>
        {SEVERITY_LABEL[alert.severity]} · L{alert.level}
      </div>

      <div className="alert-time">{formatTime(alert.timestamp)}</div>
    </div>
  );
}
