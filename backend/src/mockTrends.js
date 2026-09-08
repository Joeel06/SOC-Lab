// A diferencia de mockData.js (que sólo cubre las últimas 6h, pensado para el
// feed de alertas), esto genera una serie sintética de varios días para que
// el gráfico de tendencias no se vea vacío/plano en modo demo.
const MOCK_IPS = [
  '10.0.0.66', '10.0.0.23', '10.0.0.101', '203.0.113.14', '198.51.100.7',
  '10.0.0.45', '192.0.2.88', '10.0.0.12', '203.0.113.201', '10.0.0.199',
];

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

export function buildMockTrends({ days = 14 } = {}) {
  const perDay = [];
  let total = 0;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const isWeekend = [0, 6].includes(d.getDay());
    const base = 20 + Math.floor(Math.random() * 60); // 20-80/día
    const count = Math.round(isWeekend ? base * 0.5 : base);
    perDay.push({ date: dateKey(d), count });
    total += count;
  }

  const topSrcIps = MOCK_IPS
    .map((ip, i) => ({ ip, count: Math.max(3, Math.round((total / 6) * Math.pow(0.72, i))) }))
    .sort((a, b) => b.count - a.count);

  const bySeverity = {
    critical: Math.round(total * 0.06),
    high: Math.round(total * 0.18),
    medium: Math.round(total * 0.38),
    low: 0,
  };
  bySeverity.low = Math.max(0, total - bySeverity.critical - bySeverity.high - bySeverity.medium);

  return { perDay, topSrcIps, bySeverity };
}
