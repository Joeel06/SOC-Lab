import dotenv from 'dotenv';
dotenv.config();

export const config = {
  mode: process.env.MODE || 'mock', // 'mock' | 'live'
  port: Number(process.env.PORT || 4000),
  wazuh: {
    // Wazuh Indexer (OpenSearch) — de aquí salen las alertas.
    host: process.env.WAZUH_INDEXER_HOST || 'https://localhost:9200',
    user: process.env.WAZUH_INDEXER_USER || 'admin',
    pass: process.env.WAZUH_INDEXER_PASS || '',
    insecure: String(process.env.WAZUH_INDEXER_INSECURE || 'true') === 'true',
    alertsIndex: process.env.WAZUH_ALERTS_INDEX || 'wazuh-alerts-*',

    // Wazuh Manager API (puerto 55000 por defecto) — de aquí sale el listado
    // real de agentes registrados (nombre, IP, estado, SO...), que es distinto
    // de "agentes que han generado alertas" y no vive en el Indexer.
    api: {
      host: process.env.WAZUH_API_HOST || 'https://localhost:55000',
      user: process.env.WAZUH_API_USER || 'wazuh-wui',
      pass: process.env.WAZUH_API_PASS || '',
      insecure: String(process.env.WAZUH_API_INSECURE ?? process.env.WAZUH_INDEXER_INSECURE ?? 'true') === 'true',
    },
  },
};
