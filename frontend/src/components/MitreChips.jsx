// El dato ya viene en el objeto de alerta (normalize.js lo calcula en el
// backend) — sin fetch adicional aquí.
export default function MitreChips({ mitre }) {
  if (!mitre?.ids?.length) return null;

  return (
    <div className="mitre-chips">
      {mitre.ids.map((id, i) => (
        <span key={id} className={`mitre-chip ${mitre.inferred ? 'inferred' : ''}`}>
          <span className="mitre-id">{id}</span>
          {mitre.techniques[i] || mitre.tactics[i] || ''}
          {mitre.inferred && <span className="mitre-estimated-label">· estimado</span>}
        </span>
      ))}
    </div>
  );
}
