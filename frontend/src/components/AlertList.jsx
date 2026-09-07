import AlertRow from './AlertRow.jsx';

export default function AlertList({ alerts, loading, error, onOpenAlert }) {
  return (
    <div className="alert-list-card">
      <div className="alert-list-header">
        <h2>Alertas recientes</h2>
        <span className="alert-count-badge">{alerts.length} eventos</span>
      </div>

      {loading ? (
        <div className="state-msg">Cargando alertas…</div>
      ) : error ? (
        <div className="state-msg error">Error: {error}</div>
      ) : !alerts.length ? (
        <div className="state-msg">Sin alertas para estos filtros.</div>
      ) : (
        <div className="alert-list">
          {alerts.map((a) => (
            <AlertRow key={a.id} alert={a} onOpen={onOpenAlert} />
          ))}
        </div>
      )}
    </div>
  );
}
