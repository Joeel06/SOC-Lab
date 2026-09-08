import { AnimatePresence, motion } from 'motion/react';
import AlertRow from './AlertRow.jsx';

// Las filas usan el id estable de la alerta/grupo como key (ya estable entre
// sondeos, ver correlate.js). Motion sólo anima la ENTRADA de una key la
// primera vez que aparece — una fila que ya existía y sólo actualiza su
// contador/hora no se remonta, así que el sondeo de 5s nunca reanima toda la
// lista, sólo las filas genuinamente nuevas (regla: "100+ veces/día = sin
// animación" aplicada a la lista completa, no a cada fila nueva).
const MAX_STAGGER_ITEMS = 15; // ráfagas grandes no disparan 50 entradas escalonadas a la vez

export default function AlertList({ alerts, loading, error, onOpenAlert }) {
  return (
    <div className="alert-list-card glass-card">
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
          <AnimatePresence initial={false}>
            {alerts.map((a, i) => (
              <motion.div
                key={a.id}
                className="alert-row-wrap"
                initial={{ opacity: 0, transform: 'translateY(8px)' }}
                animate={{ opacity: 1, transform: 'translateY(0px)' }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.2,
                  ease: [0.23, 1, 0.32, 1],
                  delay: Math.min(i, MAX_STAGGER_ITEMS) * 0.02,
                }}
              >
                <AlertRow alert={a} onOpen={onOpenAlert} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
