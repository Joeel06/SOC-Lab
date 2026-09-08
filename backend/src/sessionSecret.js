import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

// Si SESSION_SECRET no está en .env, se genera solo una vez y se guarda en
// backend/data/session_secret (fuera de git, igual que settings.json) para
// que sobreviva a reinicios — si no, cada `npm run dev` invalidaría todas
// las sesiones y habría que volver a iniciar sesión constantemente.
const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'session_secret');

export function getOrCreateSessionSecret(envValue) {
  if (envValue) return envValue;

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(FILE)) {
    const existing = fs.readFileSync(FILE, 'utf8').trim();
    if (existing) return existing;
  }

  const secret = randomBytes(32).toString('hex');
  fs.writeFileSync(FILE, secret);
  return secret;
}
