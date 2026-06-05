// ── State ──────────────────────────────────────────────────────────────────
// Modèle v2 : items = types de matériel, units = unités individuelles
// assignments : { pointId, unitId }  (pas de quantité, 1 entrée par unité)
// Stockage : API serveur  GET/POST /api/state

async function loadState() {
  try {
    const res = await fetch('/api/state');
    if (res.ok) {
      const data = await res.json();
      if (data) return data;
    }
  } catch (_) {}
  return { categories: [], items: [], units: [], points: [], assignments: [] };
}

function saveState() {
  fetch('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  }).catch(() => {});
}

let state;

// ── Utils ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

function getCat(id)   { return state.categories.find(c => c.id === id); }
function getItem(id)  { return state.items.find(i => i.id === id); }
function getPoint(id) { return state.points.find(p => p.id === id); }
function getUnit(id)  { return state.units.find(u => u.id === id); }

function itemUnits(itemId) {
  return state.units.filter(u => u.itemId === itemId);
}
function reserveUnits(itemId) {
  const assignedIds = new Set(state.assignments.map(a => a.unitId));
  return state.units.filter(u => u.itemId === itemId && !assignedIds.has(u.id));
}
function unitPoint(unitId) {
  const a = state.assignments.find(a => a.unitId === unitId);
  return a ? getPoint(a.pointId) : null;
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
    container.innerHTML = '<div class="empty-state">Aucun matériel. Ajoutez des types dans Administration.</div>';
    return;
  }

  cats.forEach(cat => {
    const catItems = state.items.filter(i => i.catId === cat.id);
    if (!catItems.length) return;

    const totalUnits   = catItems.reduce((s, i) => s + itemUnits(i.id).length, 0);
    const totalReserve = catItems.reduce((s, i) => s + reserveUnits(i.id).length, 0);

    const block = document.createElement('div');
    block.className = 'category-block';
    block.innerHTML = `
      <div class="category-block-header">
        <span class="cat-dot" style="background:${cat.color}"></span>
        <h3>${cat.name}</h3>
        <span class="cat-total">Réserve : <span>${totalReserve}</span> / ${totalUnits}</span>
      </div>
      <div class="items-grid"></div>
    `;
    container.appendChild(block);

    const grid = block.querySelector('.items-grid');
    const assignedIds = new Set(state.assignments.map(a => a.unitId));

    catItems.forEach(item => {
      const units = itemUnits(item.id);
      const avail = units.filter(u => !assignedIds.has(u.id)).length;

      const sorted = [
        ...units.filter(u => !assignedIds.has(u.id)),
        ...units.filter(u =>  assignedIds.has(u.id)),
      ];

      const slotsHtml = sorted.map(unit => {
        const isAssigned = assignedIds.has(unit.id);
        const pt         = isAssigned ? unitPoint(unit.id) : null;
        const title      = isAssigned
          ? `${unit.name} → ${pt ? pt.name : '?'}`
          : unit.name;
        return `<span class="unit-slot ${isAssigned ? 'assigned' : 'libre'}"
          style="${isAssigned ? '' : `background:${cat.color}`}"
          title="${title}"></span>`;
      }).join('');

      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-card-header">
          <span class="item-card-name">${item.name}</span>
          <span class="item-card-count"><strong>${avail}</strong>/${units.length}</span>
        </div>
        <div class="unit-slots">${slotsHtml}</div>
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

    const assignedUnitIds = state.assignments
      .filter(a => a.pointId === point.id)
      .map(a => a.unitId);
    const assignedUnits = state.units.filter(u => assignedUnitIds.includes(u.id));

    // Résumé par catégorie
    let summaryHtml = '';
    if (assignedUnits.length) {
      const byCat = {};
      assignedUnits.forEach(unit => {
        const item = getItem(unit.itemId);
        if (!item) return;
        byCat[item.catId] = (byCat[item.catId] || 0) + 1;
      });
      summaryHtml = Object.entries(byCat).map(([catId, qty]) => {
        const cat = getCat(catId);
        return cat ? `<span class="point-tag" style="background:${cat.color}">${cat.name} ×${qty}</span>` : '';
      }).join('');
    } else {
      summaryHtml = '<span class="point-empty">Aucun matériel assigné</span>';
    }

    // Tooltip survol — détail par unité
    let tooltipHtml = assignedUnits.length
      ? assignedUnits.map(unit => {
          const item = getItem(unit.itemId);
          const cat  = item ? getCat(item.catId) : null;
          return `<div class="tooltip-item">
            <span>${unit.name}</span>
            ${cat ? `<span class="tooltip-cat" style="background:${cat.color}">${cat.name}</span>` : ''}
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
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openPointDetail(point.id); });
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

    function showView() {
      li.innerHTML = `
        <div class="admin-list-info">
          <span class="cat-dot" style="background:${cat.color}"></span>
          <span class="cat-label">${cat.name}</span>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-ghost btn-sm btn-edit-cat">✎</button>
          <button class="btn-danger btn-del-cat">Supprimer</button>
        </div>
      `;
      li.querySelector('.btn-edit-cat').addEventListener('click', showEdit);
      li.querySelector('.btn-del-cat').addEventListener('click', () => {
        const hasItems = state.items.some(i => i.catId === cat.id);
        if (hasItems && !confirm(`La catégorie « ${cat.name} » contient du matériel. Tout supprimer ?`)) return;
        const itemIds = state.items.filter(i => i.catId === cat.id).map(i => i.id);
        const unitIds = state.units.filter(u => itemIds.includes(u.itemId)).map(u => u.id);
        state.assignments = state.assignments.filter(a => !unitIds.includes(a.unitId));
        state.units       = state.units.filter(u => !itemIds.includes(u.itemId));
        state.items       = state.items.filter(i => i.catId !== cat.id);
        state.categories  = state.categories.filter(c => c.id !== cat.id);
        saveState(); renderAll();
      });
    }

    function showEdit() {
      li.innerHTML = `
        <input type="text"  class="cat-edit-name"  value="${cat.name.replace(/"/g, '&quot;')}" />
        <input type="color" class="cat-edit-color" value="${cat.color}" title="Couleur" />
        <div style="display:flex;gap:6px">
          <button class="btn-primary btn-sm cat-save">✓</button>
          <button class="btn-ghost   btn-sm cat-cancel">✕</button>
        </div>
      `;
      const nameInput = li.querySelector('.cat-edit-name');
      nameInput.focus();
      nameInput.select();

      const save = () => {
        const newName  = nameInput.value.trim();
        const newColor = li.querySelector('.cat-edit-color').value;
        if (!newName) return;
        const idx = state.categories.findIndex(c => c.id === cat.id);
        if (idx !== -1) { state.categories[idx].name = newName; state.categories[idx].color = newColor; }
        saveState(); renderAll();
      };

      li.querySelector('.cat-save').addEventListener('click', save);
      li.querySelector('.cat-cancel').addEventListener('click', showView);
      nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter')  save();
        if (e.key === 'Escape') showView();
      });
    }

    showView();
    ul.appendChild(li);
  });

  // Types de matériel
  const list = document.getElementById('items-accordion-body');
  list.innerHTML = '';

  if (!state.items.length) {
    const li = document.createElement('li');
    li.className = 'admin-list-empty';
    li.textContent = 'Aucun type de matériel ajouté.';
    list.appendChild(li);
  } else {
    state.items.forEach(item => buildItemRow(item, list));
  }

  // Select catégorie du formulaire d'ajout
  const catSelect = document.getElementById('input-item-cat');
  catSelect.innerHTML = '<option value="">— Catégorie —</option>';
  state.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    catSelect.appendChild(opt);
  });
}

function buildItemRow(item, list) {
  const cat = getCat(item.catId);

  const li = document.createElement('li');
  li.className = 'item-accordion-row';
  li.dataset.id = item.id;

  function summaryQty() {
    const avail = reserveUnits(item.id).length;
    const total = itemUnits(item.id).length;
    return `<strong>${avail}</strong>/${total} libres`;
  }
  function unitsLabel() {
    const n = itemUnits(item.id).length;
    return `${n} unité${n > 1 ? 's' : ''} ▾`;
  }

  li.innerHTML = `
    <div class="item-row-summary">
      ${cat ? `<span class="cat-dot" style="background:${cat.color}"></span>` : ''}
      <span class="item-row-name">${item.name}</span>
      <span class="item-row-cat">${cat ? cat.name : '—'}</span>
      <span class="item-row-qty">${summaryQty()}</span>
      <button type="button" class="btn-ghost item-row-edit-btn btn-sm" title="Modifier le type">✎</button>
      <button type="button" class="item-row-units-btn">${unitsLabel()}</button>
    </div>
    <div class="item-row-edit hidden">
      <div class="item-edit-fields">
        <input type="text" class="item-edit-name" value="${item.name.replace(/"/g, '&quot;')}" />
        <select class="item-edit-cat">
          ${state.categories.map(c => `<option value="${c.id}"${c.id === item.catId ? ' selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="item-edit-actions">
        <button type="button" class="btn-primary item-edit-save">Sauvegarder</button>
        <button type="button" class="btn-ghost item-edit-cancel">Annuler</button>
        <button type="button" class="btn-danger item-edit-delete">Supprimer le type</button>
      </div>
    </div>
    <div class="item-units-list hidden"></div>
  `;

  const editRow   = li.querySelector('.item-row-edit');
  const unitsList = li.querySelector('.item-units-list');
  const qtySpan   = li.querySelector('.item-row-qty');
  const unitsBtn  = li.querySelector('.item-row-units-btn');

  // ── Unités ─────────────────────────────────────────────────────────────

  function refreshUnits() {
    unitsList.innerHTML = '';
    itemUnits(item.id).forEach(unit => {
      const pt  = unitPoint(unit.id);
      const row = document.createElement('div');
      row.className = 'unit-row';
      row.innerHTML = `
        <input type="text" class="unit-name" value="${unit.name.replace(/"/g, '&quot;')}" />
        <span class="unit-status ${pt ? 'assigned' : 'libre'}">${pt ? '→ ' + pt.name : 'Libre'}</span>
        <button type="button" class="unit-delete" ${pt ? 'disabled title="Retirer d\'abord du point"' : ''}>✕</button>
      `;

      const nameInput = row.querySelector('.unit-name');
      const persist = () => {
        const v = nameInput.value.trim();
        if (!v) { nameInput.value = unit.name; return; }
        const idx = state.units.findIndex(u => u.id === unit.id);
        if (idx !== -1 && state.units[idx].name !== v) {
          state.units[idx].name = v;
          saveState();
        }
      };
      nameInput.addEventListener('blur', persist);
      nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') nameInput.blur(); });

      row.querySelector('.unit-delete').addEventListener('click', () => {
        if (!confirm(`Supprimer l'unité « ${unit.name} » ?`)) return;
        state.units       = state.units.filter(u => u.id !== unit.id);
        state.assignments = state.assignments.filter(a => a.unitId !== unit.id);
        saveState();
        refreshUnits();
        qtySpan.innerHTML  = summaryQty();
        unitsBtn.textContent = unitsLabel();
        renderReserve(); renderPoints();
      });

      unitsList.appendChild(row);
    });

    // Bouton + Ajouter unité
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-add-unit';
    addBtn.textContent = '+ Ajouter une unité';
    addBtn.addEventListener('click', () => {
      const n = itemUnits(item.id).length + 1;
      state.units.push({ id: uid(), itemId: item.id, name: `${item.name} #${n}` });
      saveState();
      refreshUnits();
      qtySpan.innerHTML  = summaryQty();
      unitsBtn.textContent = unitsLabel();
      renderReserve(); renderPoints();
      // Focus le nouvel input
      const inputs = unitsList.querySelectorAll('.unit-name');
      if (inputs.length) inputs[inputs.length - 1].focus();
    });
    unitsList.appendChild(addBtn);
  }

  refreshUnits();

  // Toggle unités
  unitsBtn.addEventListener('click', () => unitsList.classList.toggle('hidden'));

  // Toggle édition type
  li.querySelector('.item-row-edit-btn').addEventListener('click', () => {
    const isOpen = !editRow.classList.contains('hidden');
    document.querySelectorAll('.item-row-edit').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.item-accordion-row').forEach(el => el.classList.remove('edit-open'));
    if (!isOpen) {
      editRow.classList.remove('hidden');
      li.classList.add('edit-open');
      li.querySelector('.item-edit-name').focus();
    }
  });

  // Sauvegarder type
  li.querySelector('.item-edit-save').addEventListener('click', () => {
    const newName = li.querySelector('.item-edit-name').value.trim();
    const newCat  = li.querySelector('.item-edit-cat').value;
    if (!newName || !newCat) return;
    const idx = state.items.findIndex(i => i.id === item.id);
    if (idx !== -1) state.items[idx] = { ...state.items[idx], name: newName, catId: newCat };
    saveState(); renderAll();
  });

  // Annuler édition type
  li.querySelector('.item-edit-cancel').addEventListener('click', () => {
    editRow.classList.add('hidden');
    li.classList.remove('edit-open');
  });

  // Supprimer type
  li.querySelector('.item-edit-delete').addEventListener('click', () => {
    const units  = itemUnits(item.id);
    const pinned = units.filter(u => unitPoint(u.id)).length;
    const msg    = pinned > 0
      ? `Supprimer « ${item.name} » et ses ${units.length} unités (dont ${pinned} assignée(s)) ?`
      : `Supprimer « ${item.name} » et ses ${units.length} unités ?`;
    if (!confirm(msg)) return;
    const unitIds = units.map(u => u.id);
    state.assignments = state.assignments.filter(a => !unitIds.includes(a.unitId));
    state.units       = state.units.filter(u => u.itemId !== item.id);
    state.items       = state.items.filter(i => i.id !== item.id);
    saveState(); renderAll();
  });

  list.appendChild(li);
}

// ── Reserve filter ─────────────────────────────────────────────────────────

function populateReserveFilter() {
  const sel = document.getElementById('reserve-filter-cat');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Toutes</option>';
  state.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
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
    viewHeader.classList.remove('hidden'); editHeader.classList.add('hidden');
    viewBody.classList.remove('hidden');   editBody.classList.add('hidden');

    document.getElementById('detail-point-name').textContent = point.name;
    const descEl = document.getElementById('detail-point-desc');
    descEl.textContent   = point.desc || '';
    descEl.style.display = point.desc ? '' : 'none';

    renderDetailAssignedList();
    populateDetailAssignSelect();
  } else {
    viewHeader.classList.add('hidden'); editHeader.classList.remove('hidden');
    viewBody.classList.add('hidden');   editBody.classList.remove('hidden');

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
    li.textContent = 'Aucune unité assignée à ce point.';
    ul.appendChild(li);
    return;
  }

  assigned.forEach(a => {
    const unit = getUnit(a.unitId);
    if (!unit) return;
    const item = getItem(unit.itemId);
    const cat  = item ? getCat(item.catId) : null;

    const li = document.createElement('li');
    li.className = 'assigned-row';
    li.innerHTML = `
      <span class="assigned-row-name">${unit.name}</span>
      ${cat ? `<span class="assigned-row-cat" style="background:${cat.color}">${cat.name}</span>` : ''}
      <button class="btn-danger btn-return">Retirer</button>
    `;
    li.querySelector('.btn-return').addEventListener('click', () => {
      state.assignments = state.assignments.filter(
        a2 => !(a2.pointId === activePointId && a2.unitId === unit.id)
      );
      saveState();
      renderDetailAssignedList();
      populateDetailAssignSelect();
      renderReserve(); renderPoints();
    });
    ul.appendChild(li);
  });
}

function populateDetailAssignSelect() {
  const sel     = document.getElementById('detail-assign-select');
  sel.innerHTML = '<option value="">— Sélectionner une unité —</option>';

  state.items.forEach(item => {
    const avail = reserveUnits(item.id);
    if (!avail.length) return;
    const cat   = getCat(item.catId);
    const group = document.createElement('optgroup');
    group.label = `${item.name}${cat ? '  ·  ' + cat.name : ''}`;
    avail.forEach(unit => {
      const opt = document.createElement('option');
      opt.value = unit.id; opt.textContent = unit.name;
      group.appendChild(opt);
    });
    sel.appendChild(group);
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

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

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

// Ajouter type de matériel + générer ses unités
document.getElementById('form-add-item').addEventListener('submit', e => {
  e.preventDefault();
  const name  = document.getElementById('input-item-name').value.trim();
  const catId = document.getElementById('input-item-cat').value;
  const qty   = parseInt(document.getElementById('input-item-qty').value, 10);
  if (!name || !catId || !qty || qty < 1) return;
  const itemId = uid();
  state.items.push({ id: itemId, name, catId });
  for (let k = 1; k <= qty; k++) {
    state.units.push({ id: uid(), itemId, name: `${name} #${k}` });
  }
  saveState();
  document.getElementById('input-item-name').value = '';
  document.getElementById('input-item-qty').value  = '1';
  renderAll();
});

// Ajouter point
document.getElementById('btn-add-point').addEventListener('click', openAddPointModal);
document.getElementById('btn-close-add-point').addEventListener('click', closeAddPointModal);
document.getElementById('form-add-point').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('input-point-name').value.trim();
  const desc = document.getElementById('input-point-desc').value.trim();
  if (!name) return;
  state.points.push({ id: uid(), name, desc });
  saveState();
  closeAddPointModal(); renderPoints();
});

// Point detail — navigation modes
document.getElementById('btn-detail-close').addEventListener('click', closePointDetail);
document.getElementById('btn-detail-edit').addEventListener('click', () => setDetailMode('edit'));
document.getElementById('btn-detail-edit-close').addEventListener('click', () => setDetailMode('view'));
document.getElementById('btn-edit-cancel').addEventListener('click', () => setDetailMode('view'));

document.getElementById('form-edit-point').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('edit-point-name').value.trim();
  const desc = document.getElementById('edit-point-desc').value.trim();
  if (!name || !activePointId) return;
  const idx = state.points.findIndex(p => p.id === activePointId);
  if (idx !== -1) state.points[idx] = { ...state.points[idx], name, desc };
  saveState(); renderPoints(); setDetailMode('view');
});

document.getElementById('btn-delete-point').addEventListener('click', () => {
  const point = getPoint(activePointId);
  if (!point) return;
  if (!confirm(`Supprimer le point « ${point.name} » ? Les unités retourneront en réserve.`)) return;
  state.assignments = state.assignments.filter(a => a.pointId !== activePointId);
  state.points      = state.points.filter(p => p.id !== activePointId);
  saveState(); closePointDetail(); renderPoints(); renderReserve();
});

// Assigner une unité
document.getElementById('btn-detail-do-assign').addEventListener('click', () => {
  const unitId = document.getElementById('detail-assign-select').value;
  if (!unitId || !activePointId) return;
  if (state.assignments.find(a => a.unitId === unitId)) return; // déjà assignée
  state.assignments.push({ pointId: activePointId, unitId });
  saveState();
  renderDetailAssignedList();
  populateDetailAssignSelect();
  renderReserve(); renderPoints();
  document.getElementById('detail-assign-select').value = '';
});

// Fermer sur overlay
document.getElementById('overlay').addEventListener('click', () => {
  closePointDetail();
  closeAddPointModal();
});

// ── Init ────────────────────────────────────────────────────────────────────
(async () => {
  state = await loadState();

  if (!state.categories.length) {
    state.categories = [
      { id: uid(), name: 'Audio',     color: '#7c5cfc' },
      { id: uid(), name: 'Éclairage', color: '#f9a825' },
      { id: uid(), name: 'Vidéo',     color: '#00b894' },
    ];
    const defs = [
      { name: 'Console de mixage', ci: 0, n: 4  },
      { name: 'Micro HF',          ci: 0, n: 12 },
      { name: 'Retour de scène',   ci: 0, n: 8  },
      { name: 'PAR LED 64',        ci: 1, n: 20 },
      { name: 'Moving head',       ci: 1, n: 6  },
      { name: 'Projecteur 2K',     ci: 2, n: 3  },
    ];
    state.items = defs.map(d => ({ id: uid(), name: d.name, catId: state.categories[d.ci].id }));
    state.units = [];
    defs.forEach((d, i) => {
      for (let k = 1; k <= d.n; k++) {
        state.units.push({ id: uid(), itemId: state.items[i].id, name: `${d.name} #${k}` });
      }
    });
    state.points = [
      { id: uid(), name: 'Scène Principale', desc: 'Grande scène extérieure' },
      { id: uid(), name: 'Scène 2',          desc: 'Scène indoor' },
    ];
    saveState();
  }

  renderAll();
})();
