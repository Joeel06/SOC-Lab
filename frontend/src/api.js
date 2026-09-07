export async function getAlerts(filters) {
  const params = new URLSearchParams();
  if (filters.minSeverity && filters.minSeverity !== 'all') params.set('minSeverity', filters.minSeverity);
  if (filters.source && filters.source !== 'all') params.set('source', filters.source);
  if (filters.agent && filters.agent !== 'all') params.set('agent', filters.agent);
  if (filters.q) params.set('q', filters.q);

  const res = await fetch(`/api/alerts?${params.toString()}`);
  if (!res.ok) throw new Error(`API respondió ${res.status}`);
  return res.json();
}

export async function getAgents() {
  const res = await fetch('/api/agents');
  if (!res.ok) throw new Error(`API respondió ${res.status}`);
  return res.json();
}

export async function getSettings() {
  const res = await fetch('/api/settings');
  if (!res.ok) throw new Error(`API respondió ${res.status}`);
  return res.json();
}

export async function saveSettings(payload) {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API respondió ${res.status}`);
  return res.json();
}

export async function testTelegram() {
  const res = await fetch('/api/telegram/test', { method: 'POST' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `API respondió ${res.status}`);
  return json;
}

export async function analyzeAlert(alert) {
  const res = await fetch('/api/alerts/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alert }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `API respondió ${res.status}`);
  return json;
}

export async function testAi() {
  const res = await fetch('/api/ai/test', { method: 'POST' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `API respondió ${res.status}`);
  return json;
}
