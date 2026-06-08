const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app      = express();
const PORT     = process.env.PORT      || 3001;
const DATA     = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const API_KEY  = process.env.API_KEY   || null;

app.use(express.json({ limit: '4mb' }));

// ── Helpers ────────────────────────────────────────────────────────────────

function readData() {
  if (!fs.existsSync(DATA)) return null;
  return JSON.parse(fs.readFileSync(DATA, 'utf8'));
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

app.post('/api/state', (req, res) => {
  try {
    fs.mkdirSync(path.dirname(DATA), { recursive: true });
    fs.writeFileSync(DATA, JSON.stringify(req.body));
    res.json({ ok: true });
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
