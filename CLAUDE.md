# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Solidays Device Assigner — single-page web app (no build tool, no framework, no dependencies) for distributing festival equipment across distribution points. Open `index.html` directly in a browser to run it.

## Deployment

```bash
chmod +x install.sh
sudo ./install.sh
```

Deploys via nginx on Debian 11 LXC. The script copies the three source files to `/var/www/device-assigner/` and writes an nginx vhost on port 80.

## Architecture

All logic lives in three files with a strict separation of concerns:

- **[app.js](app.js)** — state, business logic, rendering, event wiring
- **[index.html](index.html)** — static shell: tab containers, modal skeletons, form scaffolding. All dynamic content is injected by `app.js`.
- **[style.css](style.css)** — dark-theme design system using CSS custom properties (`--bg`, `--surface`, `--accent`, etc.)

### State model (`app.js`)

One global `state` object, persisted to `localStorage` under the key `solidays_v1`:

```js
{
  categories: [{ id, name, color }],
  items:      [{ id, name, catId, qty }],   // qty = total stock
  points:     [{ id, name, desc }],
  assignments:[{ pointId, itemId, qty }]    // one entry per (point, item) pair
}
```

Reserve availability is always derived — never stored — via `reserveQty(itemId)` which subtracts all assigned quantities from `item.qty`.

### Render pattern

Every state mutation ends with a targeted render call (or `renderAll()` which calls all four render functions). Renders do a full `innerHTML` wipe and rebuild from state — there is no diffing or partial update. Event listeners are re-attached on each render.

The four render functions map 1-to-1 with the three tabs plus the assign-modal list:
- `renderReserve()` → `#reserve-categories`
- `renderPoints()` → `#points-grid`
- `renderAdmin()` → `#list-categories`, `#list-items`, `#input-item-cat`
- `renderAssignedList(pointId)` → `#modal-assigned-list`

### Modal state

A single module-level variable `activePointId` tracks which point the assign modal is open for. Both modals share one `#overlay` div; closing either closes both.

### Data integrity rules

- Deleting a category cascades to its items and their assignments.
- Deleting an item cascades to its assignments.
- Deleting a point cascades to its assignments.
- Assigning increments an existing `assignments` entry if one already exists for the `(pointId, itemId)` pair; otherwise pushes a new entry.
- The assign modal's select only shows items with `reserveQty > 0`.
