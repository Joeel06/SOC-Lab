import { useEffect, useState } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getTrends } from '../api.js';

const SEVERITY_COLORS = {
  critical: 'var(--critical)',
  high: 'var(--high)',
  medium: 'var(--medium)',
  low: 'var(--low)',
};
const SEVERITY_LABEL = { critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' };

function formatDayLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

// Los datos de tendencia cambian despacio (agregados por día) — a diferencia
// del feed de alertas, no tiene sentido hacer auto-refresco cada pocos
// segundos, así que esta vista sólo carga al entrar y con el botón manual.
export default function TrendsView() {
  const [state, setState] = useState({ status: 'loading' });

  function load() {
    setState({ status: 'loading' });
    getTrends(14)
      .then((data) => setState({ status: 'done', data }))
      .catch((err) => setState({ status: 'error', error: err.message }));
  }

  useEffect(load, []);

  if (state.status === 'loading') {
    return <div className="alert-list-card glass-card"><div className="state-msg">Cargando tendencias…</div></div>;
  }
  if (state.status === 'error') {
    return <div className="alert-list-card glass-card"><div className="state-msg error">Error: {state.error}</div></div>;
  }

  const { perDay, topSrcIps, bySeverity } = state.data;
  const maxIpCount = Math.max(1, ...topSrcIps.map((r) => r.count));
  const severityData = Object.entries(bySeverity).map(([key, value]) => ({ key, value, name: SEVERITY_LABEL[key] }));

  return (
    <div>
      <div className="filters">
        <button type="button" className="toggle-refresh off" onClick={load}>⟳ Actualizar</button>
      </div>

      <div className="trends-grid">
        <div className="glass-card chart-card wide">
          <h2>Alertas por día (últimos 14 días)</h2>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perDay}>
                <XAxis dataKey="date" tickFormatter={formatDayLabel} stroke="var(--text-dim)" fontSize={12} />
                <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} />
                <Tooltip
                  labelFormatter={formatDayLabel}
                  contentStyle={{ background: 'var(--surface-opaque)', border: '1px solid var(--card-border)', borderRadius: 10 }}
                />
                <Bar dataKey="count" name="Alertas" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card chart-card">
          <h2>Top 10 IPs de origen</h2>
          <div className="top-ip-list">
            {topSrcIps.map((row) => (
              <div className="top-ip-row" key={row.ip}>
                <span className="ip">{row.ip}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${(row.count / maxIpCount) * 100}%` }} />
                </span>
                <span className="count">{row.count}</span>
              </div>
            ))}
            {!topSrcIps.length && <p className="empty-hint">Sin datos suficientes todavía.</p>}
          </div>
        </div>

        <div className="glass-card chart-card">
          <h2>Distribución por severidad</h2>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {severityData.map((entry) => (
                    <Cell key={entry.key} fill={SEVERITY_COLORS[entry.key]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--surface-opaque)', border: '1px solid var(--card-border)', borderRadius: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
