const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app      = express();
const PORT     = process.env.PORT      || 3001;
const DATA     = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const API_KEY  = process.env.API_KEY   || null;

app.use(express.json({ limit: '4mb' }));

// ── Flux temps réel (Server-Sent Events) ─────────────────────────────────────
const sseClients = new Set();

function broadcastState(state) {
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (_) { sseClients.delete(res); }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function readData() {
  if (!fs.existsSync(DATA)) return null;
  return JSON.parse(fs.readFileSync(DATA, 'utf8'));
}

// ── Fusion concurrente (merge 3-way par clé + champ) ─────────────────────────
// Chaque client envoie { base, next } : l'état d'où partent ses modifications
// et son état après modification. Le serveur n'applique que la différence
// base→next sur l'état canonique courant, sans écraser les changements des
// autres navigateurs. Conflit réel (même champ, même objet) → dernier gagne.

const COLLECTIONS = {
  categories:  o => o.id,
  items:       o => o.id,
  units:       o => o.id,
  points:      o => o.id,
  essentials:  o => o.id,
  assignments: o => `${o.pointId}|${o.unitId}`,
};

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function indexBy(arr, keyFn) {
  const m = new Map();
  (arr || []).forEach(o => m.set(keyFn(o), o));
  return m;
}

function mergeCollection(keyFn, base, next, current) {
  const baseM = indexBy(base, keyFn);
  const nextM = indexBy(next, keyFn);
  const curM  = indexBy(current, keyFn);

  // Suppressions faites par ce client (présent dans base, absent de next)
  for (const key of baseM.keys()) {
    if (!nextM.has(key)) curM.delete(key);
  }

  // Ajouts / modifications
  for (const [key, nextObj] of nextM) {
    if (!baseM.has(key)) {                 // ajouté par ce client
      curM.set(key, nextObj);
    } else if (!eq(baseM.get(key), nextObj)) {
      const baseObj = baseM.get(key);
      const curObj  = curM.get(key);
      if (!curObj) {                        // supprimé par un autre → ce client le ré-ajoute
        curM.set(key, nextObj);
      } else {                              // fusion champ par champ
        const fields = new Set([...Object.keys(baseObj), ...Object.keys(nextObj)]);
        for (const f of fields) {
          if (!eq(baseObj[f], nextObj[f])) {           // ce client a changé ce champ
            if (nextObj[f] === undefined) delete curObj[f];
            else curObj[f] = nextObj[f];
          }
        }
      }
    }
  }

  // Reconstruit le tableau : ordre de next (ce client) puis ajouts des autres
  const result = [];
  const seen = new Set();
  for (const key of nextM.keys()) {
    if (curM.has(key)) { result.push(curM.get(key)); seen.add(key); }
  }
  for (const [key, val] of curM) {
    if (!seen.has(key)) result.push(val);
  }
  return result;
}

function mergeBagConfigs(base = {}, next = {}, current = {}) {
  const out  = { ...current };
  const pids = new Set([...Object.keys(base), ...Object.keys(next), ...Object.keys(current)]);
  for (const pid of pids) {
    if (base[pid] && !next[pid]) { delete out[pid]; continue; }   // point retiré par ce client
    const b = base[pid] || {}, n = next[pid] || {};
    const merged = { ...(current[pid] || {}) };
    const essIds = new Set([...Object.keys(b), ...Object.keys(n)]);
    for (const e of essIds) {
      if (b[e] !== n[e]) {                       // ce client a changé cette case
        if (n[e] === undefined) delete merged[e];
        else merged[e] = n[e];
      }
    }
    out[pid] = merged;
  }
  return out;
}

function mergeState(base, next, current) {
  base = base || {}; next = next || {}; current = current || {};
  const merged = {};
  for (const [coll, keyFn] of Object.entries(COLLECTIONS)) {
    merged[coll] = mergeCollection(keyFn, base[coll] || [], next[coll] || [], current[coll] || []);
  }
  merged.pointBagConfigs = mergeBagConfigs(base.pointBagConfigs, next.pointBagConfigs, current.pointBagConfigs);

  // Autres clés scalaires (ex. pointsViewMode) : next si modifié, sinon courant
  const keys = new Set([...Object.keys(base), ...Object.keys(next), ...Object.keys(current)]);
  for (const k of keys) {
    if (COLLECTIONS[k] || k === 'pointBagConfigs') continue;
    merged[k] = !eq(base[k], next[k]) ? next[k] : (k in current ? current[k] : next[k]);
  }
  return merged;
}

function checkApiKey(req, res) {
  if (!API_KEY) return true;
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (key !== API_KEY) {
    res.status(401).json({ error: 'Clé API invalide ou manquante.' });
    return false;
  }
  return true;
}

function pointStateColor(assignments) {
  if (!assignments.length) return 'gris';
  const allConfigured  = assignments.every(a => a.configured);
  const allInBag       = assignments.every(a => a.inBag);
  const someConfigured = assignments.some(a => a.configured);
  if (allConfigured && allInBag)  return 'vert';
  if (allInBag && !allConfigured) return 'rouge';
  if (allConfigured && !allInBag) return 'bleu';
  if (someConfigured)             return 'jaune';
  return 'gris';
}

// État de pose : 'empty' | 'none' | 'partial' | 'full'
function placementStatus(assignments) {
  if (!assignments.length) return 'empty';
  const placed = assignments.filter(a => a.placed).length;
  if (placed === 0) return 'none';
  if (placed === assignments.length) return 'full';
  return 'partial';
}

function buildPointPayload(point, data) {
  const assignments = (data.assignments || []).filter(a => a.pointId === point.id);
  const material = assignments.map(a => {
    const unit = (data.units || []).find(u => u.id === a.unitId);
    const item = unit ? (data.items || []).find(i => i.id === unit.itemId) : null;
    const cat  = item ? (data.categories || []).find(c => c.id === item.catId) : null;
    return {
      unitId:     a.unitId,
      name:       unit?.name         || null,
      serialNumber: unit?.serialNumber || null,
      configured: a.configured || false,
      inBag:      a.inBag      || false,
      placed:     a.placed     || false,
      location:   a.location   || null,
      item: item ? {
        id:   item.id,
        name: item.name,
        category: cat ? { id: cat.id, name: cat.name, color: cat.color } : null,
      } : null,
    };
  });
  return {
    id:     point.id,
    name:    point.name,
    desc:    point.desc || null,
    comment: point.comment || null,
    status: pointStateColor(assignments),
    placedStatus: placementStatus(assignments),
    material,
  };
}

// ── Endpoints internes (app) ───────────────────────────────────────────────

app.get('/api/state', (_req, res) => {
  try {
    const data = readData();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Flux SSE : le serveur pousse l'état fusionné dès qu'il change
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache, no-transform',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',          // désactive le tampon nginx pour ce flux
  });
  res.write('retry: 3000\n\n');         // délai de reconnexion côté navigateur

  // État courant immédiat, puis ajout à la liste des abonnés
  try {
    const data = readData();
    if (data) res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (_) {}
  sseClients.add(res);

  // Ping régulier pour garder la connexion ouverte (sous le timeout du proxy)
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) {} }, 8000);

  req.on('close', () => { clearInterval(ping); sseClients.delete(res); });
});

app.post('/api/state', (req, res) => {
  try {
    fs.mkdirSync(path.dirname(DATA), { recursive: true });

    // Lecture-modification-écriture synchrone → atomique vis-à-vis des autres requêtes
    const current = readData();
    const body    = req.body || {};

    // Nouveau protocole : { base, next }. Fallback : ancien format (état brut complet).
    const hasDiff = body && typeof body === 'object' && 'next' in body;
    const next    = hasDiff ? body.next : body;
    const base    = hasDiff ? body.base : null;

    const merged = mergeState(base, next, current);
    fs.writeFileSync(DATA, JSON.stringify(merged));
    res.json({ ok: true, state: merged });
    broadcastState(merged);   // notifie tous les navigateurs connectés
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── API publique (lecture seule) ───────────────────────────────────────────

app.get('/api/v1/points', (req, res) => {
  if (!checkApiKey(req, res)) return;
  try {
    const data = readData();
    if (!data) return res.json([]);
    const points = (data.points || []).map(p => buildPointPayload(p, data));
    res.json(points);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/points/:id', (req, res) => {
  if (!checkApiKey(req, res)) return;
  try {
    const data = readData();
    if (!data) return res.status(404).json({ error: 'Point introuvable.' });
    const point = (data.points || []).find(p => p.id === req.params.id);
    if (!point) return res.status(404).json({ error: 'Point introuvable.' });
    res.json(buildPointPayload(point, data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────

app.listen(PORT, '127.0.0.1', () =>
  console.log(`Device Assigner API → 127.0.0.1:${PORT}`)
);
