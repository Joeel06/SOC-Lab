import GitHubLink, { AUTHOR } from './GitHubLink.jsx';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: '🛰️' },
  { key: 'agents', label: 'Agentes', icon: '🖧' },
  { key: 'trends', label: 'Tendencias', icon: '📈' },
  { key: 'settings', label: 'Ajustes', icon: '⚙️' },
];

export default function Sidebar({ view, onChangeView, mode, onRefresh, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">🛡️</span>
        Mini-SOC
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((n) => (
          <button
            key={n.key}
            type="button"
            className={`sidebar-link ${view === n.key ? 'active' : ''}`}
            onClick={() => onChangeView(n.key)}
          >
            <span className="icon">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <GitHubLink className="sidebar-credit" label={`Creado por ${AUTHOR}`} />

        <span className={`mode-pill ${mode === 'live' ? 'mode-live' : 'mode-mock'}`}>
          {mode === 'live' ? '● En vivo' : '◌ Demo'}
        </span>
        <div className="sidebar-actions">
          <button className="icon-btn" title="Actualizar ahora" onClick={onRefresh}>⟳</button>
          <button className="icon-btn icon-btn-danger" title="Cerrar sesión" onClick={onLogout}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
