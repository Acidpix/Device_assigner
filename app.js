// ── State ──────────────────────────────────────────────────────────────────

const DB_KEY = 'solidays_v1';

function loadState() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { categories: [], items: [], points: [], assignments: [] };
}

function saveState() {
  localStorage.setItem(DB_KEY, JSON.stringify(state));
}

let state = loadState();

// Seed demo data on first load
if (!state.categories.length) {
  state.categories = [
    { id: uid(), name: 'Audio', color: '#7c5cfc' },
    { id: uid(), name: 'Éclairage', color: '#f9a825' },
    { id: uid(), name: 'Vidéo', color: '#00b894' },
  ];
  state.items = [
    { id: uid(), name: 'Console de mixage', catId: state.categories[0].id, qty: 4 },
    { id: uid(), name: 'Micro HF', catId: state.categories[0].id, qty: 12 },
    { id: uid(), name: 'Retour de scène', catId: state.categories[0].id, qty: 8 },
    { id: uid(), name: 'PAR LED 64', catId: state.categories[1].id, qty: 20 },
    { id: uid(), name: 'Moving head', catId: state.categories[1].id, qty: 6 },
    { id: uid(), name: 'Projecteur 2K', catId: state.categories[2].id, qty: 3 },
  ];
  state.points = [
    { id: uid(), name: 'Scène Principale', desc: 'Grande scène extérieure' },
    { id: uid(), name: 'Scène 2', desc: 'Scène indoor' },
  ];
  saveState();
}

// ── Utils ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getCat(id) { return state.categories.find(c => c.id === id); }
function getItem(id) { return state.items.find(i => i.id === id); }
function getPoint(id) { return state.points.find(p => p.id === id); }

/** Quantité encore disponible en réserve pour un item */
function reserveQty(itemId) {
  const item = getItem(itemId);
  if (!item) return 0;
  const assigned = state.assignments
    .filter(a => a.itemId === itemId)
    .reduce((s, a) => s + a.qty, 0);
  return item.qty - assigned;
}

/** Quantité assignée à un point pour un item */
function pointAssignedQty(pointId, itemId) {
  const a = state.assignments.find(a => a.pointId === pointId && a.itemId === itemId);
  return a ? a.qty : 0;
}

// ── Render: Réserve ────────────────────────────────────────────────────────

function renderReserve() {
  const filterCat = document.getElementById('reserve-filter-cat').value;
  const container = document.getElementById('reserve-categories');
  container.innerHTML = '';

  const cats = filterCat
    ? state.categories.filter(c => c.id === filterCat)
    : state.categories;

  if (!cats.length || !state.items.length) {
    container.innerHTML = '<div class="empty-state">Aucun matériel. Ajoutez des catégories et du matériel dans Administration.</div>';
    return;
  }

  cats.forEach(cat => {
    const catItems = state.items.filter(i => i.catId === cat.id);
    if (!catItems.length) return;

    const totalQty = catItems.reduce((s, i) => s + i.qty, 0);
    const totalReserve = catItems.reduce((s, i) => s + reserveQty(i.id), 0);

    const block = document.createElement('div');
    block.className = 'category-block';
    block.innerHTML = `
      <div class="category-block-header">
        <span class="cat-dot" style="background:${cat.color}"></span>
        <h3>${cat.name}</h3>
        <span class="cat-total">Réserve : <span>${totalReserve}</span> / ${totalQty}</span>
      </div>
      <div class="items-grid" id="items-grid-${cat.id}"></div>
    `;
    container.appendChild(block);

    const grid = block.querySelector('.items-grid');
    catItems.forEach(item => {
      const avail = reserveQty(item.id);
      const pct = item.qty > 0 ? Math.round((avail / item.qty) * 100) : 0;
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-card-name">${item.name}</div>
        <div class="item-card-stock">
          <div class="stock-bar">
            <div class="stock-bar-fill" style="width:${pct}%;background:${cat.color}"></div>
          </div>
          <span class="stock-count"><strong>${avail}</strong> / ${item.qty}</span>
        </div>
      `;
      grid.appendChild(card);
    });
  });
}

// ── Render: Points ─────────────────────────────────────────────────────────

function renderPoints() {
  const grid = document.getElementById('points-grid');
  grid.innerHTML = '';

  if (!state.points.length) {
    grid.innerHTML = '<div class="empty-state">Aucun point. Cliquez sur « Ajouter un point ».</div>';
    return;
  }

  state.points.forEach(point => {
    const card = document.createElement('div');
    card.className = 'point-card';

    // Build summary tags (one per category represented)
    const assignedItems = state.assignments.filter(a => a.pointId === point.id);
    let summaryHtml = '';
    if (assignedItems.length) {
      const byCat = {};
      assignedItems.forEach(a => {
        const item = getItem(a.itemId);
        if (!item) return;
        byCat[item.catId] = (byCat[item.catId] || 0) + a.qty;
      });
      summaryHtml = Object.entries(byCat).map(([catId, qty]) => {
        const cat = getCat(catId);
        return cat ? `<span class="point-tag" style="background:${cat.color}">${cat.name} ×${qty}</span>` : '';
      }).join('');
    } else {
      summaryHtml = '<span class="point-empty">Aucun matériel assigné</span>';
    }

    // Tooltip detail
    let tooltipHtml = '';
    if (assignedItems.length) {
      tooltipHtml = assignedItems.map(a => {
        const item = getItem(a.itemId);
        const cat = item ? getCat(item.catId) : null;
        if (!item) return '';
        return `<div class="tooltip-item">
          <span>${item.name}</span>
          ${cat ? `<span class="tooltip-cat" style="background:${cat.color}">${cat.name}</span>` : ''}
          <strong>×${a.qty}</strong>
        </div>`;
      }).join('');
    } else {
      tooltipHtml = '<div style="color:var(--text-muted);font-size:.85rem">Aucun matériel assigné</div>';
    }

    card.innerHTML = `
      <div class="point-card-header">
        <span class="point-card-name">${point.name}</span>
        <div class="point-card-actions">
          <button class="btn-ghost btn-assign" data-id="${point.id}">Assigner</button>
          <button class="btn-danger btn-delete-point" data-id="${point.id}">✕</button>
        </div>
      </div>
      ${point.desc ? `<div class="point-card-desc">${point.desc}</div>` : ''}
      <div class="point-summary">${summaryHtml}</div>
      <div class="point-tooltip">${tooltipHtml}</div>
    `;

    card.querySelector('.btn-assign').addEventListener('click', e => {
      e.stopPropagation();
      openAssignModal(point.id);
    });
    card.querySelector('.btn-delete-point').addEventListener('click', e => {
      e.stopPropagation();
      if (confirm(`Supprimer le point « ${point.name} » ? Tout le matériel retournera en réserve.`)) {
        state.assignments = state.assignments.filter(a => a.pointId !== point.id);
        state.points = state.points.filter(p => p.id !== point.id);
        saveState();
        renderPoints();
        renderReserve();
      }
    });

    grid.appendChild(card);
  });
}

// ── Render: Admin ──────────────────────────────────────────────────────────

function renderAdmin() {
  // Categories list
  const ul = document.getElementById('list-categories');
  ul.innerHTML = '';
  state.categories.forEach(cat => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="admin-list-info">
        <span class="cat-dot" style="background:${cat.color}"></span>
        <span>${cat.name}</span>
      </div>
      <button class="btn-danger btn-del-cat" data-id="${cat.id}">Supprimer</button>
    `;
    li.querySelector('.btn-del-cat').addEventListener('click', () => {
      const hasItems = state.items.some(i => i.catId === cat.id);
      if (hasItems && !confirm(`La catégorie « ${cat.name} » contient du matériel. Tout supprimer ?`)) return;
      const itemIds = state.items.filter(i => i.catId === cat.id).map(i => i.id);
      state.assignments = state.assignments.filter(a => !itemIds.includes(a.itemId));
      state.items = state.items.filter(i => i.catId !== cat.id);
      state.categories = state.categories.filter(c => c.id !== cat.id);
      saveState();
      renderAll();
    });
    ul.appendChild(li);
  });

  // Items list
  const ul2 = document.getElementById('list-items');
  ul2.innerHTML = '';
  state.items.forEach(item => {
    const cat = getCat(item.catId);
    const avail = reserveQty(item.id);
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="admin-list-info">
        ${cat ? `<span class="cat-dot" style="background:${cat.color}"></span>` : ''}
        <span>${item.name}</span>
        <span class="admin-list-meta">${cat ? cat.name : '—'} · ${avail}/${item.qty} dispo</span>
      </div>
      <button class="btn-danger btn-del-item" data-id="${item.id}">Supprimer</button>
    `;
    li.querySelector('.btn-del-item').addEventListener('click', () => {
      if (!confirm(`Supprimer « ${item.name} » ?`)) return;
      state.assignments = state.assignments.filter(a => a.itemId !== item.id);
      state.items = state.items.filter(i => i.id !== item.id);
      saveState();
      renderAll();
    });
    ul2.appendChild(li);
  });

  // Populate selects
  const catSelect = document.getElementById('input-item-cat');
  catSelect.innerHTML = '<option value="">— Catégorie —</option>';
  state.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    catSelect.appendChild(opt);
  });
}

// ── Populate filter + assign selects ──────────────────────────────────────

function populateReserveFilter() {
  const sel = document.getElementById('reserve-filter-cat');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Toutes</option>';
  state.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
  sel.value = cur;
}

function populateAssignSelect(pointId) {
  const sel = document.getElementById('assign-item-select');
  sel.innerHTML = '<option value="">— Matériel —</option>';
  state.items.forEach(item => {
    const avail = reserveQty(item.id);
    if (avail <= 0) return;
    const cat = getCat(item.catId);
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.name}${cat ? ' [' + cat.name + ']' : ''} — ${avail} dispo`;
    sel.appendChild(opt);
  });
}

// ── Modal: Assign ──────────────────────────────────────────────────────────

let activePointId = null;

function openAssignModal(pointId) {
  activePointId = pointId;
  const point = getPoint(pointId);
  document.getElementById('modal-assign-title').textContent = `Assigner — ${point.name}`;
  populateAssignSelect(pointId);
  renderAssignedList(pointId);
  document.getElementById('modal-assign').classList.remove('hidden');
  document.getElementById('overlay').classList.remove('hidden');
}

function closeAssignModal() {
  document.getElementById('modal-assign').classList.add('hidden');
  document.getElementById('overlay').classList.add('hidden');
  activePointId = null;
}

function renderAssignedList(pointId) {
  const ul = document.getElementById('modal-assigned-list');
  ul.innerHTML = '';
  const assigned = state.assignments.filter(a => a.pointId === pointId);
  if (!assigned.length) {
    ul.innerHTML = '<li style="color:var(--text-muted);font-size:.85rem;padding:8px 0">Aucun matériel assigné à ce point.</li>';
    return;
  }
  assigned.forEach(a => {
    const item = getItem(a.itemId);
    const cat = item ? getCat(item.catId) : null;
    if (!item) return;
    const li = document.createElement('li');
    li.className = 'assigned-row';
    li.innerHTML = `
      <span class="assigned-row-name">${item.name}</span>
      ${cat ? `<span class="assigned-row-cat" style="background:${cat.color}">${cat.name}</span>` : ''}
      <span class="assigned-row-qty">×${a.qty}</span>
      <button class="btn-danger btn-return" data-item="${a.itemId}" data-point="${pointId}">Retirer</button>
    `;
    li.querySelector('.btn-return').addEventListener('click', () => {
      const idx = state.assignments.findIndex(x => x.pointId === pointId && x.itemId === a.itemId);
      if (idx !== -1) state.assignments.splice(idx, 1);
      saveState();
      renderAssignedList(pointId);
      populateAssignSelect(pointId);
      renderReserve();
      renderPoints();
    });
    ul.appendChild(li);
  });
}

// ── Modal: Add Point ───────────────────────────────────────────────────────

function openAddPointModal() {
  document.getElementById('input-point-name').value = '';
  document.getElementById('input-point-desc').value = '';
  document.getElementById('modal-add-point').classList.remove('hidden');
  document.getElementById('overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('input-point-name').focus(), 50);
}

function closeAddPointModal() {
  document.getElementById('modal-add-point').classList.add('hidden');
  document.getElementById('overlay').classList.add('hidden');
}

// ── renderAll ──────────────────────────────────────────────────────────────

function renderAll() {
  populateReserveFilter();
  renderReserve();
  renderPoints();
  renderAdmin();
}

// ── Events ─────────────────────────────────────────────────────────────────

// Tab navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// Reserve filter
document.getElementById('reserve-filter-cat').addEventListener('change', renderReserve);

// Add category
document.getElementById('form-add-category').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('input-cat-name').value.trim();
  const color = document.getElementById('input-cat-color').value;
  if (!name) return;
  state.categories.push({ id: uid(), name, color });
  saveState();
  document.getElementById('input-cat-name').value = '';
  renderAll();
});

// Add item
document.getElementById('form-add-item').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('input-item-name').value.trim();
  const catId = document.getElementById('input-item-cat').value;
  const qty = parseInt(document.getElementById('input-item-qty').value, 10);
  if (!name || !catId || !qty || qty < 1) return;
  state.items.push({ id: uid(), name, catId, qty });
  saveState();
  document.getElementById('input-item-name').value = '';
  document.getElementById('input-item-qty').value = '1';
  renderAll();
});

// Add point button
document.getElementById('btn-add-point').addEventListener('click', openAddPointModal);
document.getElementById('btn-close-add-point').addEventListener('click', closeAddPointModal);

document.getElementById('form-add-point').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('input-point-name').value.trim();
  const desc = document.getElementById('input-point-desc').value.trim();
  if (!name) return;
  state.points.push({ id: uid(), name, desc });
  saveState();
  closeAddPointModal();
  renderPoints();
});

// Assign modal
document.getElementById('btn-modal-close').addEventListener('click', closeAssignModal);
document.getElementById('btn-do-assign').addEventListener('click', () => {
  const itemId = document.getElementById('assign-item-select').value;
  const qty = parseInt(document.getElementById('assign-qty').value, 10);
  if (!itemId || !qty || qty < 1 || !activePointId) return;

  const avail = reserveQty(itemId);
  if (qty > avail) {
    alert(`Seulement ${avail} unité(s) disponible(s) en réserve.`);
    return;
  }

  const existing = state.assignments.find(a => a.pointId === activePointId && a.itemId === itemId);
  if (existing) {
    existing.qty += qty;
  } else {
    state.assignments.push({ pointId: activePointId, itemId, qty });
  }
  saveState();
  renderAssignedList(activePointId);
  populateAssignSelect(activePointId);
  renderReserve();
  renderPoints();
  document.getElementById('assign-qty').value = '1';
});

// Close modals on overlay click
document.getElementById('overlay').addEventListener('click', () => {
  closeAssignModal();
  closeAddPointModal();
});

// ── Init ────────────────────────────────────────────────────────────────────
renderAll();
