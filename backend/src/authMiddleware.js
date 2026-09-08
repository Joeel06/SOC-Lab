import { config } from './config.js';
import { verifySession } from './auth.js';

export const SESSION_COOKIE = 'mini_soc_session';

// Parseo manual de la cabecera Cookie: en toda la app sólo hay una cookie
// (la de sesión), así que no hace falta añadir la dependencia cookie-parser.
export function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((pair) => {
      const idx = pair.indexOf('=');
      if (idx === -1) return [pair.trim(), ''];
      return [pair.slice(0, idx).trim(), decodeURIComponent(pair.slice(idx + 1).trim())];
    })
  );
}

// A diferencia del resto de integraciones opcionales del proyecto (API del
// Manager, Telegram, Gemini), que se degradan en silencio si no están
// configuradas, la autenticación falla CERRADA: si no hay ADMIN_PASSWORD
// configurada no dejamos pasar peticiones sin más, devolvemos 503 para que
// quede claro que falta configurar `.env`, no que el panel esté "abierto".
// (El SESSION_SECRET siempre tiene valor: se autogenera si no está en .env.)
export function requireAuth(req, res, next) {
  if (!config.auth.password) {
    return res.status(503).json({ error: 'Autenticación no configurada en el servidor (falta ADMIN_PASSWORD en .env).' });
  }

  const cookies = parseCookies(req);
  const session = verifySession(cookies[SESSION_COOKIE], config.auth.sessionSecret);
  if (!session) {
    return res.status(401).json({ error: 'No autenticado.' });
  }

  req.user = { username: session.username };
  next();
}
