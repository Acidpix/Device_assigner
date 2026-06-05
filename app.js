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

if (!state.categories.length) {
  state.categories = [
    { id: uid(), name: 'Audio',     color: '#7c5cfc' },
    { id: uid(), name: 'Éclairage', color: '#f9a825' },
    { id: uid(), name: 'Vidéo',     color: '#00b894' },
  ];
  state.items = [
    { id: uid(), name: 'Console de mixage', catId: state.categories[0].id, qty: 4 },
    { id: uid(), name: 'Micro HF',          catId: state.categories[0].id, qty: 12 },
    { id: uid(), name: 'Retour de scène',   catId: state.categories[0].id, qty: 8 },
    { id: uid(), name: 'PAR LED 64',        catId: state.categories[1].id, qty: 20 },
    { id: uid(), name: 'Moving head',       catId: state.categories[1].id, qty: 6 },
    { id: uid(), name: 'Projecteur 2K',     catId: state.categories[2].id, qty: 3 },
  ];
  state.points = [
    { id: uid(), name: 'Scène Principale', desc: 'Grande scène extérieure' },
    { id: uid(), name: 'Scène 2',          desc: 'Scène indoor' },
  ];
  saveState();
}

// ── Utils ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getCat(id)   { return state.categories.find(c => c.id === id); }
function getItem(id)  { return state.items.find(i => i.id === id); }
function getPoint(id) { return state.points.find(p => p.id === id); }

function reserveQty(itemId) {
  const item = getItem(itemId);
  if (!item) return 0;
  const assigned = state.assignments
    .filter(a => a.itemId === itemId)
    .reduce((s, a) => s + a.qty, 0);
  return item.qty - assigned;
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

    const totalQty     = catItems.reduce((s, i) => s + i.qty, 0);
    const totalReserve = catItems.reduce((s, i) => s + reserveQty(i.id), 0);

    const block = document.createElement('div');
    block.className = 'category-block';
    block.innerHTML = `
      <div class="category-block-header">
        <span class="cat-dot" style="background:${cat.color}"></span>
        <h3>${cat.name}</h3>
        <span class="cat-total">Réserve : <span>${totalReserve}</span> / ${totalQty}</span>
      </div>
      <div class="items-grid"></div>
    `;
    container.appendChild(block);

    const grid = block.querySelector('.items-grid');
    catItems.forEach(item => {
      const avail = reserveQty(item.id);
      const pct   = item.qty > 0 ? Math.round((avail / item.qty) * 100) : 0;
      const card  = document.createElement('div');
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
    card.setAttribute('role', 'button');
    card.tabIndex = 0;

    const assignedItems = state.assignments.filter(a => a.pointId === point.id);

    // Résumé par catégorie
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

    // Tooltip survol
    let tooltipHtml = assignedItems.length
      ? assignedItems.map(a => {
          const item = getItem(a.itemId);
          const cat  = item ? getCat(item.catId) : null;
          if (!item) return '';
          return `<div class="tooltip-item">
            <span>${item.name}</span>
            ${cat ? `<span class="tooltip-cat" style="background:${cat.color}">${cat.name}</span>` : ''}
            <strong>×${a.qty}</strong>
          </div>`;
        }).join('')
      : '<div style="color:var(--text-muted);font-size:.85rem">Aucun matériel assigné</div>';

    card.innerHTML = `
      <div class="point-card-header">
        <span class="point-card-name">${point.name}</span>
        <span class="point-click-hint">↗ détails</span>
      </div>
      ${point.desc ? `<div class="point-card-desc">${point.desc}</div>` : ''}
      <div class="point-summary">${summaryHtml}</div>
      <div class="point-tooltip">${tooltipHtml}</div>
    `;

    card.addEventListener('click', () => openPointDetail(point.id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') openPointDetail(point.id);
    });

    grid.appendChild(card);
  });
}

// ── Render: Admin ──────────────────────────────────────────────────────────

function renderAdmin() {
  // Catégories
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
      state.items       = state.items.filter(i => i.catId !== cat.id);
      state.categories  = state.categories.filter(c => c.id !== cat.id);
      saveState();
      renderAll();
    });
    ul.appendChild(li);
  });

  // Matériel — accordion
  const count = document.getElementById('items-accordion-count');
  count.textContent = state.items.length;

  const list = document.getElementById('items-accordion-body');
  list.innerHTML = '';

  if (!state.items.length) {
    const li = document.createElement('li');
    li.className = 'admin-list-empty';
    li.textContent = 'Aucun matériel ajouté.';
    list.appendChild(li);
  } else {
    state.items.forEach(item => {
      const cat         = getCat(item.catId);
      const avail       = reserveQty(item.id);
      const assignedQty = item.qty - avail;

      const li = document.createElement('li');
      li.className = 'item-accordion-row';
      li.dataset.id = item.id;

      li.innerHTML = `
        <div class="item-row-summary">
          ${cat ? `<span class="cat-dot" style="background:${cat.color}"></span>` : ''}
          <span class="item-row-name">${item.name}</span>
          <span class="item-row-cat">${cat ? cat.name : '—'}</span>
          <span class="item-row-qty"><strong>${avail}</strong>/${item.qty}</span>
          <button type="button" class="btn-ghost item-row-edit-btn" title="Modifier">✎</button>
        </div>
        <div class="item-row-edit hidden">
          <div class="item-edit-fields">
            <input type="text"   class="item-edit-name" value="${item.name.replace(/"/g, '&quot;')}" placeholder="Nom" />
            <select class="item-edit-cat">
              ${state.categories.map(c =>
                `<option value="${c.id}"${c.id === item.catId ? ' selected' : ''}>${c.name}</option>`
              ).join('')}
            </select>
            <input type="number" class="item-edit-qty" value="${item.qty}" min="${Math.max(1, assignedQty)}" />
          </div>
          ${assignedQty > 0 ? `<div class="item-edit-qty-hint">Min. ${assignedQty} (déjà assigné)</div>` : ''}
          <div class="item-edit-actions">
            <button type="button" class="btn-primary item-edit-save">Sauvegarder</button>
            <button type="button" class="btn-ghost item-edit-cancel">Annuler</button>
            <button type="button" class="btn-danger item-edit-delete">Supprimer</button>
          </div>
        </div>
      `;

      // Ouvrir / fermer l'édition
      li.querySelector('.item-row-edit-btn').addEventListener('click', () => {
        const editRow = li.querySelector('.item-row-edit');
        const isOpen  = !editRow.classList.contains('hidden');
        // Fermer tous les autres
        document.querySelectorAll('.item-row-edit').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.item-accordion-row').forEach(el => el.classList.remove('open'));
        if (!isOpen) {
          editRow.classList.remove('hidden');
          li.classList.add('open');
          li.querySelector('.item-edit-name').focus();
        }
      });

      // Sauvegarder
      li.querySelector('.item-edit-save').addEventListener('click', () => {
        const newName = li.querySelector('.item-edit-name').value.trim();
        const newCat  = li.querySelector('.item-edit-cat').value;
        const newQty  = parseInt(li.querySelector('.item-edit-qty').value, 10);
        if (!newName || !newCat || !newQty || newQty < 1) return;
        if (newQty < assignedQty) {
          alert(`Impossible : ${assignedQty} unité(s) déjà assignée(s) à des points.`);
          return;
        }
        const idx = state.items.findIndex(i => i.id === item.id);
        if (idx !== -1) state.items[idx] = { ...state.items[idx], name: newName, catId: newCat, qty: newQty };
        saveState();
        renderAll();
      });

      // Annuler
      li.querySelector('.item-edit-cancel').addEventListener('click', () => {
        li.querySelector('.item-row-edit').classList.add('hidden');
        li.classList.remove('open');
      });

      // Supprimer
      li.querySelector('.item-edit-delete').addEventListener('click', () => {
        if (!confirm(`Supprimer « ${item.name} » ? Le matériel assigné sera retiré de tous les points.`)) return;
        state.assignments = state.assignments.filter(a => a.itemId !== item.id);
        state.items       = state.items.filter(i => i.id !== item.id);
        saveState();
        renderAll();
      });

      list.appendChild(li);
    });
  }

  // Select catégorie du formulaire d'ajout
  const catSelect = document.getElementById('input-item-cat');
  catSelect.innerHTML = '<option value="">— Catégorie —</option>';
  state.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    catSelect.appendChild(opt);
  });
}

// ── Reserve filter ─────────────────────────────────────────────────────────

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

// ── Point Detail Modal ─────────────────────────────────────────────────────

let activePointId = null;
let detailMode    = 'view';

function openPointDetail(pointId) {
  activePointId = pointId;
  detailMode    = 'view';
  renderDetailModal();
  document.getElementById('modal-point-detail').classList.remove('hidden');
  document.getElementById('overlay').classList.remove('hidden');
}

function closePointDetail() {
  document.getElementById('modal-point-detail').classList.add('hidden');
  document.getElementById('overlay').classList.add('hidden');
  activePointId = null;
}

function setDetailMode(mode) {
  detailMode = mode;
  renderDetailModal();
}

function renderDetailModal() {
  const point = getPoint(activePointId);
  if (!point) return;

  const viewHeader = document.getElementById('detail-view-header');
  const editHeader = document.getElementById('detail-edit-header');
  const viewBody   = document.getElementById('detail-view-body');
  const editBody   = document.getElementById('detail-edit-body');

  if (detailMode === 'view') {
    viewHeader.classList.remove('hidden');
    editHeader.classList.add('hidden');
    viewBody.classList.remove('hidden');
    editBody.classList.add('hidden');

    document.getElementById('detail-point-name').textContent = point.name;
    const descEl = document.getElementById('detail-point-desc');
    descEl.textContent  = point.desc || '';
    descEl.style.display = point.desc ? '' : 'none';

    renderDetailAssignedList();
    populateDetailAssignSelect();
  } else {
    viewHeader.classList.add('hidden');
    editHeader.classList.remove('hidden');
    viewBody.classList.add('hidden');
    editBody.classList.remove('hidden');

    document.getElementById('edit-point-name').value = point.name;
    document.getElementById('edit-point-desc').value = point.desc || '';
  }
}

function renderDetailAssignedList() {
  const ul       = document.getElementById('detail-assigned-list');
  ul.innerHTML   = '';
  const assigned = state.assignments.filter(a => a.pointId === activePointId);

  if (!assigned.length) {
    const li = document.createElement('li');
    li.className   = 'detail-empty';
    li.textContent = 'Aucun matériel assigné à ce point.';
    ul.appendChild(li);
    return;
  }

  assigned.forEach(a => {
    const item = getItem(a.itemId);
    const cat  = item ? getCat(item.catId) : null;
    if (!item) return;

    const li = document.createElement('li');
    li.className = 'assigned-row';
    li.innerHTML = `
      <span class="assigned-row-name">${item.name}</span>
      ${cat ? `<span class="assigned-row-cat" style="background:${cat.color}">${cat.name}</span>` : ''}
      <span class="assigned-row-qty">×${a.qty}</span>
      <button class="btn-danger btn-return">Retirer</button>
    `;
    li.querySelector('.btn-return').addEventListener('click', () => {
      const idx = state.assignments.findIndex(x => x.pointId === activePointId && x.itemId === a.itemId);
      if (idx !== -1) state.assignments.splice(idx, 1);
      saveState();
      renderDetailAssignedList();
      populateDetailAssignSelect();
      renderReserve();
      renderPoints();
    });
    ul.appendChild(li);
  });
}

function populateDetailAssignSelect() {
  const sel    = document.getElementById('detail-assign-select');
  sel.innerHTML = '<option value="">— Matériel —</option>';
  state.items.forEach(item => {
    const avail = reserveQty(item.id);
    if (avail <= 0) return;
    const cat = getCat(item.catId);
    const opt = document.createElement('option');
    opt.value       = item.id;
    opt.textContent = `${item.name}${cat ? ' [' + cat.name + ']' : ''} — ${avail} dispo`;
    sel.appendChild(opt);
  });
}

// ── Modal: Ajouter un point ────────────────────────────────────────────────

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

// Navigation tabs
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// Filtre réserve
document.getElementById('reserve-filter-cat').addEventListener('change', renderReserve);

// Ajouter catégorie
document.getElementById('form-add-category').addEventListener('submit', e => {
  e.preventDefault();
  const name  = document.getElementById('input-cat-name').value.trim();
  const color = document.getElementById('input-cat-color').value;
  if (!name) return;
  state.categories.push({ id: uid(), name, color });
  saveState();
  document.getElementById('input-cat-name').value = '';
  renderAll();
});

// Ajouter matériel
document.getElementById('form-add-item').addEventListener('submit', e => {
  e.preventDefault();
  const name  = document.getElementById('input-item-name').value.trim();
  const catId = document.getElementById('input-item-cat').value;
  const qty   = parseInt(document.getElementById('input-item-qty').value, 10);
  if (!name || !catId || !qty || qty < 1) return;
  state.items.push({ id: uid(), name, catId, qty });
  saveState();
  document.getElementById('input-item-name').value  = '';
  document.getElementById('input-item-qty').value   = '1';
  // Ouvrir l'accordion si fermé
  const body  = document.getElementById('items-accordion-body');
  const arrow = document.getElementById('items-accordion-arrow');
  const toggle = document.getElementById('items-accordion-toggle');
  if (body.classList.contains('hidden')) {
    body.classList.remove('hidden');
    toggle.classList.add('open');
  }
  renderAll();
});

// Accordion matériel
document.getElementById('items-accordion-toggle').addEventListener('click', () => {
  const body   = document.getElementById('items-accordion-body');
  const toggle = document.getElementById('items-accordion-toggle');
  const isOpen = !body.classList.contains('hidden');
  body.classList.toggle('hidden', isOpen);
  toggle.classList.toggle('open', !isOpen);
});

// Ajouter un point
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

// Modal détail point — fermer (vue)
document.getElementById('btn-detail-close').addEventListener('click', closePointDetail);

// Modal détail point — passer en mode édition
document.getElementById('btn-detail-edit').addEventListener('click', () => setDetailMode('edit'));

// Modal détail point — annuler édition (× en-tête edit)
document.getElementById('btn-detail-edit-close').addEventListener('click', () => setDetailMode('view'));

// Modal détail point — annuler édition (bouton Annuler dans le corps)
document.getElementById('btn-edit-cancel').addEventListener('click', () => setDetailMode('view'));

// Modal détail point — sauvegarder édition
document.getElementById('form-edit-point').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('edit-point-name').value.trim();
  const desc = document.getElementById('edit-point-desc').value.trim();
  if (!name || !activePointId) return;
  const idx = state.points.findIndex(p => p.id === activePointId);
  if (idx !== -1) state.points[idx] = { ...state.points[idx], name, desc };
  saveState();
  renderPoints();
  setDetailMode('view');
});

// Modal détail point — supprimer le point
document.getElementById('btn-delete-point').addEventListener('click', () => {
  const point = getPoint(activePointId);
  if (!point) return;
  if (!confirm(`Supprimer le point « ${point.name} » ? Tout le matériel retournera en réserve.`)) return;
  state.assignments = state.assignments.filter(a => a.pointId !== activePointId);
  state.points      = state.points.filter(p => p.id !== activePointId);
  saveState();
  closePointDetail();
  renderPoints();
  renderReserve();
});

// Modal détail point — assigner
document.getElementById('btn-detail-do-assign').addEventListener('click', () => {
  const itemId = document.getElementById('detail-assign-select').value;
  const qty    = parseInt(document.getElementById('detail-assign-qty').value, 10);
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
  renderDetailAssignedList();
  populateDetailAssignSelect();
  renderReserve();
  renderPoints();
  document.getElementById('detail-assign-qty').value = '1';
});

// Fermer les modals en cliquant sur l'overlay
document.getElementById('overlay').addEventListener('click', () => {
  closePointDetail();
  closeAddPointModal();
});

// ── Init ────────────────────────────────────────────────────────────────────
renderAll();
