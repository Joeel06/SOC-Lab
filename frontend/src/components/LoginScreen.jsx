import { useState } from 'react';
import { motion } from 'motion/react';
import { login } from '../api.js';
import GitHubLink, { AUTHOR } from './GitHubLink.jsx';

export default function LoginScreen({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await login(username, password);
      onSuccess();
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <motion.form
        className="login-card glass-card"
        onSubmit={handleSubmit}
        initial={{ opacity: 0, transform: 'translateY(12px)' }}
        animate={{ opacity: 1, transform: 'translateY(0px)' }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="brand-mark login-mark">🛡️</div>
        <h1>Mini-SOC</h1>
        <p className="subtitle">Inicia sesión para ver el panel</p>

        <label className="settings-field">
          <span>Usuario</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </label>

        <label className="settings-field">
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button type="submit" className="toggle-refresh on login-submit" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>

        {status && <p className="settings-status error">{status}</p>}

        <div className="login-credit">
          <span>Creado por <b>{AUTHOR}</b></span>
          <GitHubLink label="github.com/Joeel06/SOC-Lab" />
        </div>
      </motion.form>
    </div>
  );
}
