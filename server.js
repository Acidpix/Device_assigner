const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app      = express();
const PORT     = process.env.PORT      || 3001;
const DATA     = process.env.DATA_FILE || path.join(__dirname, 'data.json');

app.use(express.json({ limit: '4mb' }));

app.get('/api/state', (_req, res) => {
  try {
    if (fs.existsSync(DATA)) {
      res.json(JSON.parse(fs.readFileSync(DATA, 'utf8')));
    } else {
      res.json(null);
    }
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

app.listen(PORT, '127.0.0.1', () =>
  console.log(`Device Assigner API → 127.0.0.1:${PORT}`)
);
