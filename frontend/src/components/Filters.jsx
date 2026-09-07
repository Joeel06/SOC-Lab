const SEVERITIES = [
  { value: 'all', label: 'Todas las severidades' },
  { value: 'critical', label: 'Solo críticas' },
  { value: 'high', label: 'Altas o más' },
  { value: 'medium', label: 'Medias o más' },
  { value: 'low', label: 'Todas (incl. bajas)' },
];

const SOURCES = [
  { value: 'all', label: 'Suricata + Wazuh' },
  { value: 'suricata', label: 'Solo Suricata (red)' },
  { value: 'wazuh', label: 'Solo Wazuh (host)' },
];

export default function Filters({ filters, onChange, agents, autoRefresh, onToggleAutoRefresh }) {
  return (
    <div className="filters">
      <select value={filters.minSeverity} onChange={(e) => onChange({ ...filters, minSeverity: e.target.value })}>
        {SEVERITIES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <select value={filters.source} onChange={(e) => onChange({ ...filters, source: e.target.value })}>
        {SOURCES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <select value={filters.agent} onChange={(e) => onChange({ ...filters, agent: e.target.value })}>
        <option value="all">Todos los agentes</option>
        {agents.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Buscar en la descripción…"
        value={filters.q}
        onChange={(e) => onChange({ ...filters, q: e.target.value })}
      />

      <button
        className={`toggle-refresh ${autoRefresh ? 'on' : 'off'}`}
        onClick={onToggleAutoRefresh}
        title="Auto-refresco cada 5s"
      >
        {autoRefresh ? '⏸ Pausar refresco' : '▶ Reanudar refresco'}
      </button>
    </div>
  );
}
