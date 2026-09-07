import { Agent } from 'undici';
import { config } from './config.js';

// Cliente contra la API REST del Wazuh Manager (puerto 55000 por defecto).
// Es una API distinta de la del Indexer: aquí vive el roster real de agentes
// registrados (nombre, IP, SO, versión, estado de conexión...), que no se
// puede reconstruir fiablemente a partir de las alertas del Indexer (un
// agente sin alertas recientes simplemente no aparecería).
//
// Auth: Basic user/pass contra /security/user/authenticate devuelve un JWT
// de corta duración (~900s) que hay que usar como Bearer en las siguientes
// llamadas. Lo cacheamos y renovamos justo antes de que caduque.

const dispatcher = new Agent({ connect: { rejectUnauthorized: !config.wazuh.api.insecure } });

let cachedToken = null;
let tokenExpiresAt = 0;

function withDispatcher(url, init) {
  return fetch(url, { ...init, dispatcher: url.startsWith('https') ? dispatcher : undefined });
}

async function authenticate() {
  const url = `${config.wazuh.api.host}/security/user/authenticate`;
  const basic = Buffer.from(`${config.wazuh.api.user}:${config.wazuh.api.pass}`).toString('base64');

  const res = await withDispatcher(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Wazuh API (auth) respondió ${res.status}: ${text}`);
  }

  const json = await res.json();
  cachedToken = json?.data?.token;
  if (!cachedToken) throw new Error('Wazuh API (auth) no devolvió token');
  tokenExpiresAt = Date.now() + 13 * 60 * 1000; // margen por debajo de los ~15 min por defecto
  return cachedToken;
}

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  return authenticate();
}

export async function fetchAgentsFromWazuh() {
  const url = `${config.wazuh.api.host}/agents?limit=500`;

  async function call(bearer) {
    return withDispatcher(url, { headers: { Authorization: `Bearer ${bearer}` } });
  }

  let token = await getToken();
  let res = await call(token);
  if (res.status === 401) {
    token = await authenticate();
    res = await call(token);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Wazuh API (/agents) respondió ${res.status}: ${text}`);
  }

  const json = await res.json();
  const items = json?.data?.affected_items || [];

  return items
    .filter((a) => a.id !== '000') // el agente "000" es el propio manager
    .map((a) => ({
      id: a.id,
      name: a.name,
      ip: a.ip || null,
      status: a.status, // active | disconnected | never_connected | pending
      os: a.os?.name ? `${a.os.name} ${a.os.version || ''}`.trim() : null,
      version: a.version || null,
      group: Array.isArray(a.group) ? a.group.join(', ') : a.group || null,
      lastKeepAlive: a.lastKeepAlive || null,
      dateAdd: a.dateAdd || null,
    }));
}
