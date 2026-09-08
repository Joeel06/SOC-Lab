import { useEffect, useState } from 'react';
import { getAgents } from '../api.js';

const AGENTS_POLL_MS = 15000; // se refresca sola para no quedarse con datos viejos si borras/añades un agente

const STATUS_LABEL = {
  active: 'Activo',
  disconnected: 'Desconectado',
  never_connected: 'Nunca conectado',
  pending: 'Pendiente',
  unknown: 'Sin verificar',
};

function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function AgentsView({ onFilterAgent }) {
  const [state, setState] = useState({ loading: true, error: null, agents: [], source: null, warning: null });

  useEffect(() => {
    let alive = true;

    function load() {
      getAgents()
        .then((res) => { if (alive) setState({ loading: false, error: null, ...res }); })
        .catch((e) => { if (alive) setState((s) => ({ ...s, loading: false, error: e.message })); });
    }

    load();
    const id = setInterval(load, AGENTS_POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (state.loading) {
    return <div className="alert-list-card glass-card"><div className="state-msg">Cargando agentes…</div></div>;
  }
  if (state.error) {
    return <div className="alert-list-card glass-card"><div className="state-msg error">Error: {state.error}</div></div>;
  }

  return (
    <div>
      {state.source === 'alerts-derived' && (
        <div className="banner-note">
          Mostrando sólo los agentes que han generado alertas recientes (no el listado real de
          agentes registrados). Rellena <code>WAZUH_API_HOST</code>, <code>WAZUH_API_USER</code> y{' '}
          <code>WAZUH_API_PASS</code> en <code>backend/.env</code> (API del Wazuh Manager, puerto
          55000) para ver aquí el listado completo con su estado real.
          {state.warning ? <div className="banner-note-detail">Detalle: {state.warning}</div> : null}
        </div>
      )}

      <div className="agent-grid">
        {state.agents.map((a) => (
          <button key={a.id ?? a.name} type="button" className="agent-card glass-card" onClick={() => onFilterAgent(a.name)}>
            <div className="agent-card-top">
              <span className={`agent-status agent-status-${a.status}`} />
              <span className="agent-name">{a.name}</span>
            </div>
            <div className="agent-meta">
              <span>{STATUS_LABEL[a.status] || a.status}</span>
              {a.ip && <span>· {a.ip}</span>}
              {a.os && <span>· {a.os}</span>}
            </div>
            <div className="agent-alert-chips">
              <span className="mini-chip mini-chip-critical" title="Críticas">{a.alerts.critical}</span>
              <span className="mini-chip mini-chip-high" title="Altas">{a.alerts.high}</span>
              <span className="mini-chip mini-chip-medium" title="Medias">{a.alerts.medium}</span>
              <span className="mini-chip mini-chip-low" title="Bajas">{a.alerts.low}</span>
            </div>
            <div className="agent-footer">Última alerta: {formatTime(a.lastAlert)}</div>
          </button>
        ))}
        {!state.agents.length && <div className="state-msg">No hay agentes para mostrar.</div>}
      </div>
    </div>
  );
}
