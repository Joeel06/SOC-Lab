const SEVERITIES = [
  { key: 'critical', label: 'Críticas', className: 'severity-critical' },
  { key: 'high', label: 'Altas', className: 'severity-high' },
  { key: 'medium', label: 'Medias', className: 'severity-medium' },
  { key: 'low', label: 'Bajas', className: 'severity-low' },
];

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function SummaryBar({ summary }) {
  if (!summary) return null;

  const total = SEVERITIES.reduce((sum, s) => sum + (summary.bySeverity[s.key] || 0), 0) || 1;

  return (
    <div className="stat-grid">
      {SEVERITIES.map((s) => {
        const count = summary.bySeverity[s.key] || 0;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={s.key} className={`stat-widget glass-card ${s.className}`}>
            {/* --pct alimenta el conic-gradient del anillo; el color sale de
                la clase de severidad, no de un valor suelto aquí */}
            <span className="stat-ring" style={{ '--pct': pct }}>{pct}%</span>
            <div className="stat-value">{count}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        );
      })}

      <div className="stat-widget glass-card">
        <span className="stat-icon">📊</span>
        <div className="stat-value">{total}</div>
        <div className="stat-label">Alertas totales</div>
      </div>

      <div className="stat-widget glass-card">
        <span className="stat-icon">🖧</span>
        <div className="stat-value">{summary.agentCount}</div>
        <div className="stat-label">Agentes con alertas</div>
      </div>

      <div className="stat-widget glass-card">
        <span className="stat-icon">🕒</span>
        <div className="stat-value stat-value-sm">{formatTime(summary.lastTimestamp)}</div>
        <div className="stat-label">Última alerta</div>
      </div>
    </div>
  );
}
