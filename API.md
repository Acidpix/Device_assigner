# API publique — Device Assigner

API REST lecture seule pour récupérer les points de distribution et le matériel qui leur est assigné.

**Base URL :** `http://<serveur>/api/v1`

---

## Authentification

Par défaut, l'API est ouverte. Pour la protéger, définir la variable d'environnement `API_KEY` au lancement du serveur :

```bash
API_KEY=mon_secret node server.js
```

Passer ensuite la clé dans chaque requête, au choix :

| Méthode | Exemple |
|---------|---------|
| Header HTTP | `X-Api-Key: mon_secret` |
| Query param | `?api_key=mon_secret` |

---

## Endpoints

### `GET /api/v1/points`

Retourne la liste de tous les points avec leur matériel assigné.

**Exemple de requête**
```
GET /api/v1/points
X-Api-Key: mon_secret
```

**Exemple de réponse** `200 OK`
```json
[
  {
    "id": "abc123",
    "name": "Scène principale",
    "desc": "Face à la scène",
    "comment": "Prévoir une rallonge",
    "status": "bleu",
    "placedStatus": "partial",
    "material": [
      {
        "unitId": "unit456",
        "name": "Talkie Brice",
        "serialNumber": "SN-00042",
        "configured": true,
        "inBag": false,
        "placed": false,
        "location": "Régie, rack 2",
        "item": {
          "id": "item789",
          "name": "Talkie-walkie",
          "category": {
            "id": "cat001",
            "name": "Radio",
            "color": "#f97316"
          }
        }
      }
    ]
  }
]
```

---

### `GET /api/v1/points/:id`

Retourne un point précis avec son matériel assigné.

**Exemple de requête**
```
GET /api/v1/points/abc123
X-Api-Key: mon_secret
```

**Réponse** `200 OK` — même structure qu'un élément de la liste ci-dessus.

**Réponse** `404 Not Found`
```json
{ "error": "Point introuvable." }
```

---

## Champs de la réponse

### Objet `point`

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant unique |
| `name` | string | Nom du point |
| `desc` | string \| null | Description optionnelle |
| `comment` | string \| null | Commentaire libre du point |
| `status` | string | État global config/sac (voir ci-dessous) |
| `placedStatus` | string | État de pose du matériel (voir ci-dessous) |
| `material` | array | Liste des unités assignées |

### Valeurs de `status`

| Valeur | Signification |
|--------|---------------|
| `gris` | Aucun matériel assigné |
| `jaune` | Configuration en cours (partielle) |
| `bleu` | Tout configuré, pas encore en sac |
| `rouge` | Tout en sac, pas encore configuré |
| `vert` | Tout configuré et en sac — prêt |

### Valeurs de `placedStatus`

| Valeur | Signification |
|--------|---------------|
| `empty` | Aucun matériel assigné |
| `none` | Rien de posé |
| `partial` | Une partie du matériel est posée |
| `full` | Tout le matériel est posé |

### Objet `material[n]`

| Champ | Type | Description |
|-------|------|-------------|
| `unitId` | string | Identifiant de l'unité physique |
| `name` | string \| null | Nom de l'unité (ex : "Talkie Brice") |
| `serialNumber` | string \| null | Numéro de série |
| `configured` | boolean | L'unité a été configurée |
| `inBag` | boolean | L'unité est dans le sac du point |
| `placed` | boolean | L'équipement a été posé / installé sur le point |
| `location` | string \| null | Emplacement de l'équipement sur le point (champ libre) |
| `item` | object \| null | Type de matériel |
| `item.id` | string | Identifiant du type |
| `item.name` | string | Nom du type (ex : "Talkie-walkie") |
| `item.category` | object \| null | Catégorie parente |
| `item.category.id` | string | |
| `item.category.name` | string | |
| `item.category.color` | string | Couleur CSS hex |

---

## Exemple JavaScript (fetch)

```js
const BASE = 'http://device-assigner.example.com';
const KEY  = 'mon_secret';

async function getPoints() {
  const res = await fetch(`${BASE}/api/v1/points`, {
    headers: { 'X-Api-Key': KEY },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getPoint(id) {
  const res = await fetch(`${BASE}/api/v1/points/${id}`, {
    headers: { 'X-Api-Key': KEY },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

---

## CORS

Si l'autre app est sur un domaine différent, ajouter dans la config nginx :

```nginx
location /api/v1/ {
    add_header Access-Control-Allow-Origin  "*";
    add_header Access-Control-Allow-Headers "X-Api-Key, Content-Type";
    proxy_pass http://127.0.0.1:3001;
}
```
