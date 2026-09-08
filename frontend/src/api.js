// Callback registrado por App.jsx: cuando cualquier petición a la API
// devuelve 401 (sesión caducada, cookie borrada, etc.), avisamos para que la
// interfaz vuelva a la pantalla de login en vez de quedarse mostrando un
// error genérico o datos vacíos.
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function apiFetch(url, options) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    onUnauthorized?.();
  }
  return res;
}

export async function login(username, password) {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `API respondió ${res.status}`);
  return json;
}

export async function logout() {
  await apiFetch('/api/auth/logout', { method: 'POST' });
}

export async function getMe() {
  const res = await apiFetch('/api/auth/me');
  if (!res.ok) throw new Error(`API respondió ${res.status}`);
  return res.json();
}

export async function getAlerts(filters) {
  const params = new URLSearchParams();
  if (filters.minSeverity && filters.minSeverity !== 'all') params.set('minSeverity', filters.minSeverity);
  if (filters.source && filters.source !== 'all') params.set('source', filters.source);
  if (filters.agent && filters.agent !== 'all') params.set('agent', filters.agent);
  if (filters.q) params.set('q', filters.q);

  const res = await apiFetch(`/api/alerts?${params.toString()}`);
  if (!res.ok) throw new Error(`API respondió ${res.status}`);
  return res.json();
}

export async function getAgents() {
  const res = await apiFetch('/api/agents');
  if (!res.ok) throw new Error(`API respondió ${res.status}`);
  return res.json();
}

export async function getSettings() {
  const res = await apiFetch('/api/settings');
  if (!res.ok) throw new Error(`API respondió ${res.status}`);
  return res.json();
}

export async function saveSettings(payload) {
  const res = await apiFetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API respondió ${res.status}`);
  return res.json();
}

export async function testTelegram() {
  const res = await apiFetch('/api/telegram/test', { method: 'POST' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `API respondió ${res.status}`);
  return json;
}

export async function analyzeAlert(alert) {
  const res = await apiFetch('/api/alerts/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alert }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `API respondió ${res.status}`);
  return json;
}

export async function testAi() {
  const res = await apiFetch('/api/ai/test', { method: 'POST' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `API respondió ${res.status}`);
  return json;
}

export async function getTrends(days = 14) {
  const res = await apiFetch(`/api/stats/trends?days=${days}`);
  if (!res.ok) throw new Error(`API respondió ${res.status}`);
  return res.json();
}
