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
    <div className="stat-strip">
      <div className="stat-pills">
        {SEVERITIES.map((s) => {
          const count = summary.bySeverity[s.key] || 0;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={s.key} className={`stat-pill ${s.className}`}>
              <span className="pct">
                {count} <small>({pct}%)</small>
              </span>
              <span className="lbl">{s.label}</span>
            </div>
          );
        })}
      </div>

      <div className="stat-numbers">
        <div className="stat-number">
          <span className="icon">📊</span>
          <div>
            <div className="value">{total}</div>
            <div className="label">Alertas totales</div>
          </div>
        </div>
        <div className="stat-number">
          <span className="icon">🖧</span>
          <div>
            <div className="value">{summary.agentCount}</div>
            <div className="label">Agentes con alertas</div>
          </div>
        </div>
        <div className="stat-number">
          <span className="icon">🕒</span>
          <div>
            <div className="value">{formatTime(summary.lastTimestamp)}</div>
            <div className="label">Última alerta</div>
          </div>
        </div>
      </div>
    </div>
  );
}
