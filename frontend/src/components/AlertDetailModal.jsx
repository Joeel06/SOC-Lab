import { useEffect, useState } from 'react';
import { analyzeAlert } from '../api.js';

const SEVERITY_LABEL = { critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' };
const SOURCE_LABEL = { suricata: '🛰 Suricata (red)', wazuh: '🖥 Wazuh (host)' };

function formatFullTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function AlertDetailModal({ alert, onClose }) {
  const [ai, setAi] = useState({ status: 'idle' });

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Las críticas se analizan solas al abrir el modal: si el vigilante en
  // segundo plano ya la analizó, esto es solo una lectura de caché (gratis,
  // instantáneo). El resto de severidades quedan a un clic, para no gastar
  // cuota de la IA analizando cosas que no interesan.
  useEffect(() => {
    setAi({ status: 'idle' });
    if (alert?.severity === 'critical') {
      runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert?.id]);

  async function runAnalysis() {
    setAi({ status: 'loading' });
    try {
      const res = await analyzeAlert(alert);
      setAi({ status: 'done', text: res.text, cached: res.cached });
    } catch (err) {
      setAi({ status: 'error', error: err.message });
    }
  }

  if (!alert) return null;

  const samples = alert.samples?.length
    ? alert.samples
    : (alert.raw ? [{ timestamp: alert.timestamp, raw: alert.raw }] : []);
  const isGroup = (alert.count || 1) > 1;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className={`severity-chip severity-chip-${alert.severity}`}>
              {SEVERITY_LABEL[alert.severity]} · L{alert.level}
            </span>
            <h2>{alert.description}</h2>
            <div className="modal-meta">
              <span>{SOURCE_LABEL[alert.source] || alert.source}</span>
              <span>· agente: {alert.agent}</span>
              <span>· {formatFullTime(alert.timestamp)}</span>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} title="Cerrar">✕</button>
        </div>

        <div className="modal-body">
          {isGroup && (
            <div className="modal-section">
              <h3>Correlación</h3>
              <p className="settings-hint">
                Se agruparon <b>{alert.count}</b> eventos casi idénticos (misma regla, agente e IPs) entre{' '}
                {formatFullTime(alert.firstSeen)} y {formatFullTime(alert.lastSeen)}.
              </p>
            </div>
          )}

          <div className="modal-section">
            <h3>Detalles</h3>
            <dl className="modal-fields">
              <div>
                <dt>Regla</dt>
                <dd>{alert.ruleId || '—'}</dd>
              </div>
              <div>
                <dt>Grupos</dt>
                <dd>{alert.ruleGroups?.length ? alert.ruleGroups.join(', ') : '—'}</dd>
              </div>
              {alert.srcIp && (
                <div>
                  <dt>IP origen</dt>
                  <dd>{alert.srcIp}</dd>
                </div>
              )}
              {alert.dstIp && (
                <div>
                  <dt>IP destino</dt>
                  <dd>{alert.dstIp}</dd>
                </div>
              )}
              {alert.category && (
                <div>
                  <dt>Categoría</dt>
                  <dd>{alert.category}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="modal-section">
            <h3>Análisis con IA</h3>
            {ai.status === 'idle' && (
              <button type="button" className="toggle-refresh off" onClick={runAnalysis}>
                🧠 Analizar con IA
              </button>
            )}
            {ai.status === 'loading' && <p className="ai-status">Analizando con Gemini…</p>}
            {ai.status === 'error' && <p className="ai-status error">{ai.error}</p>}
            {ai.status === 'done' && <div className="ai-analysis">{ai.text}</div>}
          </div>

          {samples.length > 0 && (
            <div className="modal-section">
              <h3>{samples.length > 1 ? `Log original (${samples.length} ejemplos)` : 'Log original'}</h3>
              {samples.map((s, i) => (
                s.raw?.full_log ? <pre className="log-block" key={i}>{s.raw.full_log}</pre> : null
              ))}
            </div>
          )}

          <div className="modal-section">
            <details>
              <summary className="modal-json-toggle">
                Ver documento completo (JSON){samples.length > 1 ? ' — primer ejemplo' : ''}
              </summary>
              <pre className="log-block">{JSON.stringify(samples[0]?.raw ?? {}, null, 2)}</pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
