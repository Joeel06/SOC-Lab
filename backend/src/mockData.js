import { normalizeAlert } from './normalize.js';

const AGENTS = ['UbuntuServerSoc', 'kali-atacante', 'ubuntu-pruebas'];

const SURICATA_SAMPLES = [
  { sig: 'ET SCAN Nmap Scripting Engine User-Agent Detected', level: 6, category: 'Attempted Information Leak' },
  { sig: 'ET SCAN Suspicious inbound to mySQL port 3306', level: 9, category: 'Attempted Information Leak' },
  { sig: 'ET POLICY SSH session in progress on unusual port', level: 5, category: 'Potentially Bad Traffic' },
  { sig: 'ET SCAN Behavioral Unusual Port 1433 traffic', level: 8, category: 'Attempted Information Leak' },
  { sig: 'GPL ATTACK_RESPONSE id check returned root', level: 13, category: 'Successful Recon Limited' },
  { sig: 'ET SCAN Possible Nmap User-Agent Observed', level: 6, category: 'Attempted Information Leak' },
  { sig: 'ET EXPLOIT Possible ETERNALBLUE Probe MS17-010', level: 14, category: 'Attempted Administrator Privilege Gain' },
];

const WAZUH_SAMPLES = [
  { desc: 'Multiple authentication failures', level: 10, groups: ['authentication_failed', 'pci_dss_10.2.4'] },
  { desc: 'sshd: authentication success', level: 3, groups: ['authentication_success'] },
  { desc: 'Integrity checksum changed for: /etc/passwd', level: 12, groups: ['syscheck', 'ossec'] },
  { desc: 'Host-based anomaly detection event (rootcheck)', level: 7, groups: ['rootcheck'] },
  { desc: 'User added to sudoers group', level: 9, groups: ['audit_command', 'privilege_escalation'] },
  { desc: 'First time this user logged in', level: 4, groups: ['authentication_success'] },
  { desc: 'PAM: Login session opened', level: 3, groups: ['pam', 'authentication_success'] },
];

function randomTimestampWithinLastHours(hours) {
  const now = Date.now();
  const past = now - Math.random() * hours * 60 * 60 * 1000;
  return new Date(past).toISOString();
}

function buildSuricataDoc() {
  const s = SURICATA_SAMPLES[Math.floor(Math.random() * SURICATA_SAMPLES.length)];
  return {
    '@timestamp': randomTimestampWithinLastHours(6),
    agent: { name: AGENTS[Math.floor(Math.random() * AGENTS.length)] },
    rule: { level: s.level, description: s.sig, id: '86601', groups: ['ids', 'suricata'] },
    data: {
      srcip: `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
      dstip: `192.168.0.${Math.floor(Math.random() * 250) + 1}`,
      alert: { signature: s.sig, category: s.category },
    },
  };
}

function buildWazuhDoc() {
  const w = WAZUH_SAMPLES[Math.floor(Math.random() * WAZUH_SAMPLES.length)];
  return {
    '@timestamp': randomTimestampWithinLastHours(6),
    agent: { name: AGENTS[Math.floor(Math.random() * AGENTS.length)] },
    rule: { level: w.level, description: w.desc, id: '5710', groups: w.groups },
    data: {},
  };
}

export async function fetchMockAlerts({ size = 60 } = {}) {
  const docs = [];
  for (let i = 0; i < size; i++) {
    docs.push(Math.random() > 0.45 ? buildSuricataDoc() : buildWazuhDoc());
  }
  // Siempre garantizamos al menos una crítica reciente para que el panel
  // demuestre bien el resaltado de severidad.
  docs.push({
    '@timestamp': new Date().toISOString(),
    agent: { name: 'UbuntuServerSoc' },
    rule: { level: 14, description: 'ET EXPLOIT Possible ETERNALBLUE Probe MS17-010', id: '86601', groups: ['ids', 'suricata'] },
    data: {
      srcip: '10.0.0.66',
      dstip: '192.168.0.22',
      alert: { signature: 'ET EXPLOIT Possible ETERNALBLUE Probe MS17-010', category: 'Attempted Administrator Privilege Gain' },
    },
  });

  return docs
    .map((d) => normalizeAlert(d))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}
