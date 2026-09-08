import { timingSafeEqual, createHmac } from 'node:crypto';

// La contraseña de admin vive en texto plano en .env (igual que las
// contraseñas de Wazuh) — no hay hash que generar a mano. Comparación con
// timingSafeEqual para no filtrar por temporización cuánto coincide.
export function verifyPassword(password, expected) {
  const a = Buffer.from(String(password || ''));
  const b = Buffer.from(String(expected || ''));
  if (!expected || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

// Sesión = base64url(payload JSON) + "." + firma HMAC-SHA256 del mismo, en
// vez de jsonwebtoken: sólo necesitamos "quién" y "hasta cuándo", y esto es
// verificable con node:crypto sin dependencias nuevas.
export function signSession(payload, secret) {
  const body = base64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySession(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig || '');
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
