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
