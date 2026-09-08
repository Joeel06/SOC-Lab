import { Agent } from 'undici';
import { config } from './config.js';
import { normalizeAlert } from './normalize.js';

// Cliente mínimo contra el Wazuh Indexer (OpenSearch). El fetch nativo de Node
// está implementado sobre undici, así que para desactivar la verificación TLS
// (certificado autofirmado por defecto del Indexer) hay que pasar un
// dispatcher de undici, no un https.Agent de Node (ese solo lo respeta
// node-fetch, no el fetch global).
const dispatcher = new Agent({ connect: { rejectUnauthorized: !config.wazuh.insecure } });

function authHeader() {
  const token = Buffer.from(`${config.wazuh.user}:${config.wazuh.pass}`).toString('base64');
  return `Basic ${token}`;
}

export async function fetchAlertsFromWazuh({ size = 200 } = {}) {
  const url = `${config.wazuh.host}/${config.wazuh.alertsIndex}/_search`;

  const body = {
    size,
    sort: [{ '@timestamp': { order: 'desc' } }],
    query: { match_all: {} },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify(body),
    dispatcher: url.startsWith('https') ? dispatcher : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Wazuh Indexer respondió ${res.status}: ${text}`);
  }

  const json = await res.json();
  const hits = json?.hits?.hits || [];
  return hits.map((h) => normalizeAlert(h._source, h._id));
}

// Tendencias: en vez de traer miles de documentos y agregarlos en Node,
// dejamos que lo haga el propio Indexer (mucho más barato). `data.srcip` va
// mapeado como tipo `ip` en la plantilla de índice por defecto de Wazuh, así
// que admite `terms` directamente — si tu plantilla lo tiene como texto,
// prueba con `data.srcip.keyword`.
export async function fetchTrendsFromWazuh({ days = 14 } = {}) {
  const url = `${config.wazuh.host}/${config.wazuh.alertsIndex}/_search`;

  const body = {
    size: 0,
    query: { range: { '@timestamp': { gte: `now-${days}d/d` } } },
    aggs: {
      per_day: { date_histogram: { field: '@timestamp', calendar_interval: 'day', min_doc_count: 0 } },
      top_src_ips: { terms: { field: 'data.srcip', size: 10 } },
      by_level: { terms: { field: 'rule.level', size: 16 } },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify(body),
    dispatcher: url.startsWith('https') ? dispatcher : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Wazuh Indexer respondió ${res.status}: ${text}`);
  }

  const json = await res.json();
  const aggs = json?.aggregations || {};

  return {
    perDay: (aggs.per_day?.buckets || []).map((b) => ({ date: b.key_as_string.slice(0, 10), count: b.doc_count })),
    topSrcIps: (aggs.top_src_ips?.buckets || []).map((b) => ({ ip: b.key, count: b.doc_count })),
    byLevelBuckets: (aggs.by_level?.buckets || []).map((b) => ({ level: Number(b.key), count: b.doc_count })),
  };
}
