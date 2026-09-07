import { useEffect, useState } from 'react';
import { getSettings, saveSettings, testTelegram, testAi } from '../api.js';

const REFRESH_OPTIONS = [3000, 5000, 10000, 30000, 60000];
const SEVERITY_OPTIONS = ['all', 'low', 'medium', 'high', 'critical'];
const CORRELATION_WINDOW_OPTIONS = [2, 5, 10, 15, 30, 60];
const AI_MODEL_OPTIONS = [
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (recomendado, más margen gratis)' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
];

export default function SettingsView({ onSaved }) {
  const [form, setForm] = useState(null);
  const [botToken, setBotToken] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState(null);
  const [testStatus, setTestStatus] = useState(null);
  const [aiTestStatus, setAiTestStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingAi, setTestingAi] = useState(false);

  useEffect(() => {
    getSettings()
      .then(setForm)
      .catch((e) => setStatus({ type: 'error', text: e.message }));
  }, []);

  if (!form) {
    return <div className="alert-list-card"><div className="state-msg">Cargando ajustes…</div></div>;
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const payload = {
        interface: form.interface,
        telegram: {
          enabled: form.telegram.enabled,
          chatId: form.telegram.chatId,
          minSeverity: form.telegram.minSeverity,
          ...(botToken ? { botToken } : {}),
        },
        ai: {
          enabled: form.ai.enabled,
          model: form.ai.model,
          autoAnalyzeMinSeverity: form.ai.autoAnalyzeMinSeverity,
          ...(apiKey ? { apiKey } : {}),
        },
      };
      const saved = await saveSettings(payload);
      setForm(saved);
      setBotToken('');
      setApiKey('');
      setStatus({ type: 'ok', text: 'Ajustes guardados.' });
      onSaved?.(saved);
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestTelegram() {
    setTesting(true);
    setTestStatus(null);
    try {
      await testTelegram();
      setTestStatus({ type: 'ok', text: 'Mensaje de prueba enviado. Revisa Telegram.' });
    } catch (err) {
      setTestStatus({ type: 'error', text: err.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleTestAi() {
    setTestingAi(true);
    setAiTestStatus(null);
    try {
      const res = await testAi();
      setAiTestStatus({ type: 'ok', text: `Gemini respondió correctamente: "${res.sample.slice(0, 80)}..."` });
    } catch (err) {
      setAiTestStatus({ type: 'error', text: err.message });
    } finally {
      setTestingAi(false);
    }
  }

  return (
    <form className="settings-grid" onSubmit={handleSave}>
      <section className="settings-card">
        <h2>Interfaz</h2>

        <label className="settings-field">
          <span>Frecuencia de auto-refresco</span>
          <select
            value={form.interface.refreshMs}
            onChange={(e) => setForm({ ...form, interface: { ...form.interface, refreshMs: Number(e.target.value) } })}
          >
            {REFRESH_OPTIONS.map((ms) => (
              <option key={ms} value={ms}>{ms / 1000}s</option>
            ))}
          </select>
        </label>

        <label className="settings-field">
          <span>Severidad mínima por defecto</span>
          <select
            value={form.interface.defaultMinSeverity}
            onChange={(e) => setForm({ ...form, interface: { ...form.interface, defaultMinSeverity: e.target.value } })}
          >
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'Todas' : s}</option>
            ))}
          </select>
        </label>

        <label className="settings-field">
          <span>Fuente por defecto</span>
          <select
            value={form.interface.defaultSource}
            onChange={(e) => setForm({ ...form, interface: { ...form.interface, defaultSource: e.target.value } })}
          >
            <option value="all">Suricata + Wazuh</option>
            <option value="suricata">Sólo Suricata</option>
            <option value="wazuh">Sólo Wazuh</option>
          </select>
        </label>

        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={form.interface.correlateAlerts}
            onChange={(e) => setForm({ ...form, interface: { ...form.interface, correlateAlerts: e.target.checked } })}
          />
          <span>Agrupar alertas repetidas (correlación)</span>
        </label>

        <label className="settings-field">
          <span>Ventana de correlación</span>
          <select
            value={form.interface.correlationWindowMinutes}
            onChange={(e) => setForm({
              ...form,
              interface: { ...form.interface, correlationWindowMinutes: Number(e.target.value) },
            })}
            disabled={!form.interface.correlateAlerts}
          >
            {CORRELATION_WINDOW_OPTIONS.map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </label>
      </section>

      <section className="settings-card">
        <h2>Alertas por Telegram</h2>
        <p className="settings-hint">
          Crea un bot hablando con <b>@BotFather</b> en Telegram (<code>/newbot</code>), copia el
          token que te da, y pon el <b>chat ID</b> al que quieras que lleguen las alertas (tu chat
          personal, un grupo o un canal — puedes sacarlo hablando con <b>@userinfobot</b>).
        </p>

        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={form.telegram.enabled}
            onChange={(e) => setForm({ ...form, telegram: { ...form.telegram, enabled: e.target.checked } })}
          />
          <span>Enviar alertas a Telegram</span>
        </label>

        <label className="settings-field">
          <span>
            Token del bot
            {form.telegram.botTokenSet && <em className="settings-current"> (actual: {form.telegram.botTokenPreview})</em>}
          </span>
          <input
            type="password"
            autoComplete="off"
            placeholder={form.telegram.botTokenSet ? 'Dejar en blanco para no cambiarlo' : '123456789:ABC-DEF...'}
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
          />
        </label>

        <label className="settings-field">
          <span>Chat ID</span>
          <input
            type="text"
            placeholder="Ej: 123456789 o -1001234567890"
            value={form.telegram.chatId}
            onChange={(e) => setForm({ ...form, telegram: { ...form.telegram, chatId: e.target.value } })}
          />
        </label>

        <label className="settings-field">
          <span>Severidad mínima que se envía</span>
          <select
            value={form.telegram.minSeverity}
            onChange={(e) => setForm({ ...form, telegram: { ...form.telegram, minSeverity: e.target.value } })}
          >
            <option value="low">Todas (incl. bajas)</option>
            <option value="medium">Medias o más</option>
            <option value="high">Altas o más</option>
            <option value="critical">Sólo críticas</option>
          </select>
        </label>

        <button type="button" className="toggle-refresh off" onClick={handleTestTelegram} disabled={testing}>
          {testing ? 'Enviando…' : 'Enviar mensaje de prueba'}
        </button>
        {testStatus && <p className={`settings-status ${testStatus.type}`}>{testStatus.text}</p>}
      </section>

      <section className="settings-card">
        <h2>Análisis con IA (Gemini)</h2>
        <p className="settings-hint">
          Saca una API key gratis en <b>Google AI Studio</b> (aistudio.google.com). Con ella, cada
          alerta se puede analizar bajo demanda desde su detalle, y las críticas se analizan solas
          en cuanto aparecen. Ten en cuenta que, en el nivel gratuito, Google puede usar lo que le
          mandes para mejorar sus modelos — evítalo si tus logs incluyen algo que prefieras no compartir.
        </p>

        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={form.ai.enabled}
            onChange={(e) => setForm({ ...form, ai: { ...form.ai, enabled: e.target.checked } })}
          />
          <span>Activar análisis con IA</span>
        </label>

        <label className="settings-field">
          <span>
            API key de Gemini
            {form.ai.apiKeySet && <em className="settings-current"> (actual: {form.ai.apiKeyPreview})</em>}
          </span>
          <input
            type="password"
            autoComplete="off"
            placeholder={form.ai.apiKeySet ? 'Dejar en blanco para no cambiarla' : 'AIza...'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>

        <label className="settings-field">
          <span>Modelo</span>
          <select
            value={form.ai.model}
            onChange={(e) => setForm({ ...form, ai: { ...form.ai, model: e.target.value } })}
          >
            {AI_MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>

        <label className="settings-field">
          <span>Analizar automáticamente desde</span>
          <select
            value={form.ai.autoAnalyzeMinSeverity}
            onChange={(e) => setForm({ ...form, ai: { ...form.ai, autoAnalyzeMinSeverity: e.target.value } })}
          >
            <option value="off">Nunca (sólo análisis manual)</option>
            <option value="low">Todas (incl. bajas)</option>
            <option value="medium">Medias o más</option>
            <option value="high">Altas o más</option>
            <option value="critical">Sólo críticas</option>
          </select>
        </label>

        <button type="button" className="toggle-refresh off" onClick={handleTestAi} disabled={testingAi}>
          {testingAi ? 'Probando…' : 'Probar conexión con Gemini'}
        </button>
        {aiTestStatus && <p className={`settings-status ${aiTestStatus.type}`}>{aiTestStatus.text}</p>}
      </section>

      <div className="settings-actions">
        <button type="submit" className="toggle-refresh on" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar ajustes'}
        </button>
        {status && <p className={`settings-status ${status.type}`}>{status.text}</p>}
      </div>
    </form>
  );
}
