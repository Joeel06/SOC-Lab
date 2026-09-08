import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { router } from './routes.js';
import { startAlertWatcher } from './alertWatcher.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', router);

app.listen(config.port, () => {
  console.log(`Mini-SOC backend escuchando en http://localhost:${config.port} (modo: ${config.mode})`);
  if (config.mode === 'mock') {
    console.log('-> Sirviendo alertas de ejemplo. Pon MODE=live en .env cuando quieras conectar tu Wazuh real.');
  }
  if (!config.auth.password) {
    console.log('⚠ Autenticación no configurada: define ADMIN_USER y ADMIN_PASSWORD en .env (ver backend/.env.example). Hasta entonces, la API rechaza todas las peticiones.');
  }
  startAlertWatcher();
});
