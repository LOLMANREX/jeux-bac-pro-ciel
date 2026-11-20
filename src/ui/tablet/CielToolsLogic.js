export function parseIpv4(ipStr) {
  const parts = String(ipStr || '').trim().split('.');
  if (parts.length !== 4) return null;
  let acc = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    acc = ((acc << 8) | n) >>> 0;
  }
  return acc >>> 0;
}

export function intToIpv4(num) {
  const u = (Number(num) || 0) >>> 0;
  return [
    (u >>> 24) & 255,
    (u >>> 16) & 255,
    (u >>> 8) & 255,
    u & 255
  ].join('.');
}

export function cidrToMaskInt(cidr) {
  const c = Math.round(Number(cidr));
  if (!Number.isInteger(c) || c < 0 || c > 32) return null;
  return c === 0 ? 0 : (0xffffffff << (32 - c)) >>> 0;
}

export function cidrToMask(cidr) {
  const m = cidrToMaskInt(cidr);
  return m === null ? null : intToIpv4(m);
}

export function maskToCidr(maskInput) {
  if (maskInput === null || maskInput === undefined) return null;
  const raw = String(maskInput).trim().replace(/^\//, '');
  if (/^\d{1,2}$/.test(raw)) {
    const n = Number(raw);
    return n >= 0 && n <= 32 ? n : null;
  }
  const maskInt = parseIpv4(raw);
  if (maskInt === null) return null;
  const inv = (~maskInt) >>> 0;
  if ((inv & ((inv + 1) >>> 0)) !== 0) return null;
  let cidr = 0;
  for (let i = 31; i >= 0; i--) {
    if ((maskInt >>> i) & 1) cidr += 1;
    else break;
  }
  return cidr;
}

function resolveIpClass(firstOctet) {
  if (firstOctet < 128) return 'Classe A';
  if (firstOctet < 192) return 'Classe B';
  if (firstOctet < 224) return 'Classe C';
  if (firstOctet < 240) return 'Classe D (Multicast)';
  return 'Classe E (Expérimental)';
}

function resolveIpScope(ipInt) {
  const a = (ipInt >>> 24) & 255;
  const b = (ipInt >>> 16) & 255;
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
    return 'Privée (RFC 1918)';
  }
  if (a === 127) return 'Loopback (127.0.0.0/8)';
  if (a === 169 && b === 254) return 'APIPA / Link-Local';
  return 'Publique routable';
}

export function calculateIpv4Subnet(ipInput, maskOrCidr = 24) {
  const rawIp = String(ipInput || '').trim();
  let ipPart = rawIp;
  let maskArg = maskOrCidr;

  if (rawIp.includes('/')) {
    const [left, right] = rawIp.split('/');
    ipPart = left.trim();
    if (right !== undefined && right.trim() !== '') {
      maskArg = right.trim();
    }
  }

  const ipInt = parseIpv4(ipPart);
  if (ipInt === null) {
    return { ok: false, error: 'Adresse IPv4 invalide (format attendu : x.x.x.x).' };
  }

  const cidr = maskToCidr(maskArg);
  if (cidr === null) {
    return { ok: false, error: 'Masque ou préfixe CIDR invalide (/0 à /32).' };
  }

  const maskInt = cidrToMaskInt(cidr);
  const wildcardInt = (~maskInt) >>> 0;
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | wildcardInt) >>> 0;
  const totalAddresses = Math.pow(2, 32 - cidr);

  let usableHosts = 0;
  let firstHostInt = networkInt;
  let lastHostInt = broadcastInt;

  if (cidr === 32) {
    usableHosts = 1;
    firstHostInt = networkInt;
    lastHostInt = networkInt;
  } else if (cidr === 31) {
    usableHosts = 2;
    firstHostInt = networkInt;
    lastHostInt = broadcastInt;
  } else {
    usableHosts = Math.max(0, totalAddresses - 2);
    firstHostInt = (networkInt + 1) >>> 0;
    lastHostInt = (broadcastInt - 1) >>> 0;
  }

  const maskBinary = [24, 16, 8, 0]
    .map((shift) => ((maskInt >>> shift) & 255).toString(2).padStart(8, '0'))
    .join('.');

  return {
    ok: true,
    ip: intToIpv4(ipInt),
    cidr,
    mask: intToIpv4(maskInt),
    wildcard: intToIpv4(wildcardInt),
    network: intToIpv4(networkInt),
    broadcast: intToIpv4(broadcastInt),
    firstHost: intToIpv4(firstHostInt),
    lastHost: intToIpv4(lastHostInt),
    usableHosts,
    totalAddresses,
    ipClass: resolveIpClass((ipInt >>> 24) & 255),
    scope: resolveIpScope(ipInt),
    maskBinary
  };
}

export const RESISTOR_BAND_COLORS = [
  { id: 'black', label: 'Noir', hex: '#111827', textColor: '#f8fafc', digit: 0, multiplier: 1, tolerancePct: null },
  { id: 'brown', label: 'Marron', hex: '#78350f', textColor: '#fef3c7', digit: 1, multiplier: 10, tolerancePct: 1 },
  { id: 'red', label: 'Rouge', hex: '#dc2626', textColor: '#fef2f2', digit: 2, multiplier: 100, tolerancePct: 2 },
  { id: 'orange', label: 'Orange', hex: '#f97316', textColor: '#fff7ed', digit: 3, multiplier: 1000, tolerancePct: null },
  { id: 'yellow', label: 'Jaune', hex: '#eab308', textColor: '#0f172a', digit: 4, multiplier: 10000, tolerancePct: null },
  { id: 'green', label: 'Vert', hex: '#16a34a', textColor: '#f0fdf4', digit: 5, multiplier: 100000, tolerancePct: 0.5 },
  { id: 'blue', label: 'Bleu', hex: '#2563eb', textColor: '#eff6ff', digit: 6, multiplier: 1000000, tolerancePct: 0.25 },
  { id: 'violet', label: 'Violet', hex: '#7c3aed', textColor: '#f5f3ff', digit: 7, multiplier: 10000000, tolerancePct: 0.1 },
  { id: 'grey', label: 'Gris', hex: '#64748b', textColor: '#f8fafc', digit: 8, multiplier: 100000000, tolerancePct: 0.05 },
  { id: 'white', label: 'Blanc', hex: '#f8fafc', textColor: '#0f172a', digit: 9, multiplier: 1000000000, tolerancePct: null },
  { id: 'gold', label: 'Or', hex: '#d97706', textColor: '#fffbeb', digit: null, multiplier: 0.1, tolerancePct: 5 },
  { id: 'silver', label: 'Argent', hex: '#cbd5e1', textColor: '#0f172a', digit: null, multiplier: 0.01, tolerancePct: 10 }
];

const BAND_BY_ID = new Map(RESISTOR_BAND_COLORS.map((b) => [b.id, b]));

export function formatResistanceOhms(ohms) {
  const val = Number(ohms);
  if (!Number.isFinite(val) || val < 0) return '-- Ω';
  const cleanNum = (n) => {
    const r = Math.round(n * 100) / 100;
    return Number.isInteger(r) ? String(r) : String(r).replace('.', ',');
  };
  if (val >= 1000000) return `${cleanNum(val / 1000000)} MΩ`;
  if (val >= 1000) return `${cleanNum(val / 1000)} kΩ`;
  return `${cleanNum(val)} Ω`;
}

export function decodeResistor4Band(band1Id, band2Id, multId, tolId = 'gold') {
  const b1 = BAND_BY_ID.get(band1Id);
  const b2 = BAND_BY_ID.get(band2Id);
  const bm = BAND_BY_ID.get(multId);
  const bt = BAND_BY_ID.get(tolId);
  if (!b1 || b1.digit === null) {
    return { ok: false, error: 'Anneau 1 invalide.' };
  }
  if (!b2 || b2.digit === null) {
    return { ok: false, error: 'Anneau 2 invalide.' };
  }
  if (!bm || bm.multiplier === null) {
    return { ok: false, error: 'Anneau multiplicateur invalide.' };
  }
  if (!bt || bt.tolerancePct === null) {
    return { ok: false, error: 'Anneau de tolérance invalide.' };
  }

  const baseVal = b1.digit * 10 + b2.digit;
  const ohms = Math.round(baseVal * bm.multiplier * 1000) / 1000;
  const tolPct = bt.tolerancePct;
  const minOhms = Math.round(ohms * (1 - tolPct / 100) * 1000) / 1000;
  const maxOhms = Math.round(ohms * (1 + tolPct / 100) * 1000) / 1000;

  return {
    ok: true,
    ohms,
    formatted: formatResistanceOhms(ohms),
    tolerancePct: tolPct,
    toleranceLabel: `±${String(tolPct).replace('.', ',')} %`,
    minOhms,
    maxOhms,
    minFormatted: formatResistanceOhms(minOhms),
    maxFormatted: formatResistanceOhms(maxOhms),
    hexColors: [b1.hex, b2.hex, bm.hex, bt.hex],
    bands: [b1, b2, bm, bt]
  };
}

export const MEMO_CATEGORIES = [
  { id: 'all', label: 'Tout' },
  { id: 'linux_net', label: 'Réseau Linux' },
  { id: 'linux_sys', label: 'Admin Debian' },
  { id: 'cisco', label: 'Cisco / VLAN' },
  { id: 'cabling_ports', label: 'Ports & Câblage' }
];

export const CIEL_COMMAND_MEMO = [
  {
    id: 'cmd_ip_a',
    category: 'linux_net',
    cmd: 'ip a',
    title: 'Interfaces & Adresses IPv4/IPv6',
    desc: 'Affiche toutes les cartes réseau, adresses MAC et IP configurées sous Debian.'
  },
  {
    id: 'cmd_ip_route',
    category: 'linux_net',
    cmd: 'ip route',
    title: 'Table de routage & Passerelle',
    desc: 'Vérifie la passerelle par défaut (default via ...) et les routes locales.'
  },
  {
    id: 'cmd_ss',
    category: 'linux_net',
    cmd: 'ss -tuln',
    title: 'Ports TCP/UDP en écoute',
    desc: 'Liste les services réseau ouverts localement sans résolution DNS.'
  },
  {
    id: 'cmd_tcpdump',
    category: 'linux_net',
    cmd: 'sudo tcpdump -i eth0 port 80',
    title: 'Capture de trames réseau',
    desc: 'Analyse le trafic en direct sur l’interface eth0 filtré sur le port 80.'
  },
  {
    id: 'cmd_systemctl',
    category: 'linux_sys',
    cmd: 'sudo systemctl restart ssh',
    title: 'Redémarrer un service systemd',
    desc: 'Relance un démon après modification de son fichier /etc/ssh/sshd_config.'
  },
  {
    id: 'cmd_journalctl',
    category: 'linux_sys',
    cmd: 'sudo journalctl -u ssh -n 30',
    title: 'Journaux d’un service',
    desc: 'Affiche les 30 dernières lignes de logs d’un service Debian.'
  },
  {
    id: 'cmd_chmod',
    category: 'linux_sys',
    cmd: 'chmod 750 script.sh',
    title: 'Droits octaux Linux',
    desc: 'rwx (7) propriétaire, r-x (5) groupe, --- (0) autres.'
  },
  {
    id: 'cmd_ufw',
    category: 'linux_sys',
    cmd: 'sudo ufw allow 443/tcp && sudo ufw enable',
    title: 'Pare-feu UFW',
    desc: 'Autorise HTTPS (443/TCP) et active le pare-feu Debian.'
  },
  {
    id: 'cmd_cisco_vlan',
    category: 'cisco',
    cmd: 'vlan 20 / name ATELIER',
    title: 'Créer un VLAN sur Switch Cisco IOS',
    desc: 'Déclare le VLAN 20 et lui attribue un libellé explicite.'
  },
  {
    id: 'cmd_cisco_access',
    category: 'cisco',
    cmd: 'switchport mode access / switchport access vlan 20',
    title: 'Port Access VLAN',
    desc: 'Assigne un port terminal au VLAN 20.'
  },
  {
    id: 'cmd_cisco_trunk',
    category: 'cisco',
    cmd: 'switchport trunk encapsulation dot1q / switchport mode trunk',
    title: 'Lien Trunk IEEE 802.1Q',
    desc: 'Transporte plusieurs VLANs étiquetés entre switchs ou vers un routeur.'
  },
  {
    id: 'cmd_cisco_show',
    category: 'cisco',
    cmd: 'show vlan brief / show interfaces trunk',
    title: 'Diagnostic VLAN & Trunk IOS',
    desc: 'Vérifie l’affectation des ports et les VLANs autorisés sur les Trunks.'
  },
  {
    id: 'ref_ports',
    category: 'cabling_ports',
    cmd: 'SSH:22 | DNS:53 | DHCP:67-68 | HTTP:80 | HTTPS:443 | RDP:3389',
    title: 'Ports TCP/UDP usuels',
    desc: 'Référence rapide des ports standards évalués en Cybersécurité & Réseaux.'
  },
  {
    id: 'ref_t568b',
    category: 'cabling_ports',
    cmd: '1:B/O  2:O  3:B/V  4:B  5:B/B  6:V  7:B/M  8:M',
    title: 'Câblage RJ45 T568B',
    desc: 'Ordre normalisé des 8 conducteurs dans un connecteur RJ45 (languette dessous).'
  },
  {
    id: 'ref_fibre',
    category: 'cabling_ports',
    cmd: 'OS2 Monomode: 9/125 µm (Jaune) • OM3/OM4 Multimode: 50/125 µm (Aqua/Magenta)',
    title: 'Fibres optiques & DMX512',
    desc: 'Longueur max Ethernet cuivre = 100 m • Bouchon DMX512 RS-485 = 120 Ω.'
  }
];

export function filterCommandMemo(query = '', category = 'all') {
  const cleanCat = String(category || 'all').trim();
  const q = String(query || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return CIEL_COMMAND_MEMO.filter((entry) => {
    if (cleanCat !== 'all' && entry.category !== cleanCat) return false;
    if (!q) return true;
    const hay = `${entry.cmd} ${entry.title} ${entry.desc}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return hay.includes(q);
  });
}
