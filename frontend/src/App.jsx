import { useEffect, useRef, useState } from 'react';
import { getAgents, getAlerts, getSettings } from './api.js';
import SummaryBar from './components/SummaryBar.jsx';
import Filters from './components/Filters.jsx';
import AlertList from './components/AlertList.jsx';
import AgentsView from './components/AgentsView.jsx';
import SettingsView from './components/SettingsView.jsx';
import AlertDetailModal from './components/AlertDetailModal.jsx';

const DEFAULT_REFRESH_MS = 5000;
const AGENTS_REFRESH_MS = 30000; // el roster cambia poco -> no hace falta pedirlo tan seguido como las alertas
const UI_STATE_KEY = 'mini-soc-ui-state';

// Estado de la interfaz (pestaña activa, filtros, auto-refresco) al recargar
// la página (F5): se lee una vez al cargar el módulo, no en cada render, así
// que un F5 restaura exactamente donde estabas en vez de volver siempre al
// Dashboard. Si localStorage no está disponible (privado, cuota...) se
// arranca con los valores por defecto de siempre, sin romper nada.
const SAVED_UI_STATE = (() => {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'agents', label: 'Agentes' },
  { key: 'settings', label: 'Ajustes' },
];

export default function App() {
  const [view, setView] = useState(SAVED_UI_STATE?.view || 'dashboard');
  const [filters, setFilters] = useState(
    SAVED_UI_STATE?.filters || { minSeverity: 'all', source: 'all', agent: 'all', q: '' }
  );
  const [data, setData] = useState({ alerts: [], summary: null, mode: 'mock' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(
    typeof SAVED_UI_STATE?.autoRefresh === 'boolean' ? SAVED_UI_STATE.autoRefresh : true
  );
  const [refreshMs, setRefreshMs] = useState(DEFAULT_REFRESH_MS);
  const [agentOptions, setAgentOptions] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const timerRef = useRef(null);

  // Ajustes de interfaz guardados desde la pestaña Ajustes: intervalo de
  // refresco y filtros por defecto al abrir el panel.
  useEffect(() => {
    getSettings()
      .then((s) => {
        setRefreshMs(s.interface.refreshMs || DEFAULT_REFRESH_MS);
        if (!SAVED_UI_STATE?.filters) {
          setFilters((f) => ({
            ...f,
            minSeverity: s.interface.defaultMinSeverity || f.minSeverity,
            source: s.interface.defaultSource || f.source,
          }));
        }
      })
      .catch(() => {
        // Si /api/settings falla (backend viejo, etc.) seguimos con los valores por defecto.
      });
  }, []);

  // Lista de agentes para el filtro: viene de /api/agents (roster real de Wazuh,
  // con fallback a los agentes vistos en alertas si la API del Manager no está
  // configurada), nunca de una lista fija. Se refresca sola cada 30s para que
  // si añades o quitas un agente en Wazuh, aparezca/desaparezca aquí sin recargar.
  useEffect(() => {
    let alive = true;

    async function loadAgentOptions() {
      try {
        const res = await getAgents();
        if (!alive) return;
        const names = res.agents.map((a) => a.name).sort((a, b) => a.localeCompare(b));
        setAgentOptions(names);
      } catch {
        // si falla, dejamos la lista de agentes tal cual estuviera
      }
    }

    loadAgentOptions();
    const id = setInterval(loadAgentOptions, AGENTS_REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Guarda pestaña/filtros/auto-refresco en localStorage en cada cambio, para
  // que recargar la página (F5) no te devuelva siempre al Dashboard.
  useEffect(() => {
    try {
      localStorage.setItem(UI_STATE_KEY, JSON.stringify({ view, filters, autoRefresh }));
    } catch {
      // si falla (privado, cuota...) simplemente no se recuerda el estado
    }
  }, [view, filters, autoRefresh]);

  async function load() {
    try {
      setError(null);
      const res = await getAlerts(filters);
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.minSeverity, filters.source, filters.agent, filters.q]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefresh) {
      timerRef.current = setInterval(load, refreshMs);
    }
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, filters, refreshMs]);

  return (
    <div className="page">
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">🛡️</span>
            Mini-SOC
          </div>

          <nav className="nav-pills">
            {NAV_ITEMS.map((n) => (
              <button
                key={n.key}
                type="button"
                className={`nav-pill ${view === n.key ? 'active' : ''}`}
                onClick={() => setView(n.key)}
              >
                {n.label}
              </button>
            ))}
          </nav>

          <div className="topbar-actions">
            <span className={`mode-pill ${data.mode === 'live' ? 'mode-live' : 'mode-mock'}`}>
              {data.mode === 'live' ? '● En vivo · Wazuh Indexer' : '◌ Demo · datos simulados'}
            </span>
            <button className="icon-btn" title="Actualizar ahora" onClick={load}>⟳</button>
          </div>
        </header>

        {view === 'dashboard' && (
          <>
            <section className="hero">
              <div>
                <h1>Bienvenido a tu SOC 👋</h1>
                <p className="subtitle">Suricata (red) + Wazuh (host) en una sola vista, priorizado por severidad</p>
              </div>
            </section>

            <SummaryBar summary={data.summary} />

            <Filters
              filters={filters}
              onChange={setFilters}
              agents={agentOptions}
              autoRefresh={autoRefresh}
              onToggleAutoRefresh={() => setAutoRefresh((v) => !v)}
            />

            <AlertList
              alerts={data.alerts}
              loading={loading}
              error={error}
              onOpenAlert={setSelectedAlert}
            />
          </>
        )}

        {view === 'agents' && (
          <>
            <section className="hero">
              <div>
                <h1>Agentes</h1>
                <p className="subtitle">Estado real de cada agente registrado en Wazuh, con sus alertas recientes</p>
              </div>
            </section>

            <AgentsView
              onFilterAgent={(name) => {
                setFilters((f) => ({ ...f, agent: name }));
                setView('dashboard');
              }}
            />
          </>
        )}

        {view === 'settings' && (
          <>
            <section className="hero">
              <div>
                <h1>Ajustes</h1>
                <p className="subtitle">Preferencias de la interfaz y notificaciones por Telegram</p>
              </div>
            </section>

            <SettingsView onSaved={(saved) => setRefreshMs(saved.interface.refreshMs || DEFAULT_REFRESH_MS)} />
          </>
        )}
      </div>

      {selectedAlert && (
        <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}
    </div>
  );
}
