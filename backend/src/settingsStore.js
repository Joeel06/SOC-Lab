import fs from 'node:fs';
import path from 'node:path';

// Ajustes que se configuran desde el propio panel (no desde .env), y por
// tanto necesitan persistirse en disco para sobrevivir a un reinicio del
// backend: intervalo de refresco/filtros/correlación de la interfaz, la
// config del bot de Telegram (token, chat, severidad mínima a notificar),
// y la config de análisis con IA (Gemini).
//
// Vive en backend/data/settings.json, que está en .gitignore porque incluye
// el token del bot de Telegram y la API key de Gemini.

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'settings.json');

const DEFAULTS = {
  interface: {
    refreshMs: 5000,
    defaultMinSeverity: 'all',
    defaultSource: 'all',
    correlateAlerts: true,
    correlationWindowMinutes: 10,
  },
  telegram: {
    enabled: false,
    botToken: '',
    chatId: '',
    minSeverity: 'high',
  },
  ai: {
    enabled: false,
    apiKey: '',
    model: 'gemini-3.5-flash-lite',
    autoAnalyzeMinSeverity: 'critical',
  },
};

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify(DEFAULTS, null, 2));
}

export function readSettings() {
  ensureFile();
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return {
      interface: { ...DEFAULTS.interface, ...(raw.interface || {}) },
      telegram: { ...DEFAULTS.telegram, ...(raw.telegram || {}) },
      ai: { ...DEFAULTS.ai, ...(raw.ai || {}) },
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

export function writeSettings(partial) {
  ensureFile();
  const current = readSettings();
  const merged = {
    interface: { ...current.interface, ...(partial.interface || {}) },
    telegram: { ...current.telegram, ...(partial.telegram || {}) },
    ai: { ...current.ai, ...(partial.ai || {}) },
  };
  fs.writeFileSync(FILE, JSON.stringify(merged, null, 2));
  return merged;
}
