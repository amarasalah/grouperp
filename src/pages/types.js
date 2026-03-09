// Types Page - Each type has quantity. User creates items inside each type (prefix+ID).
import { getAll, add, update, remove } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatDate } from '../utils/helpers.js';
import { paginate, filterBarHTML, wireFilters } from '../utils/pagination.js';
import { getSelectedBcgId, isAllBcgMode } from './bcg-select.js';
import { hasPermission } from '../data/auth.js';

export async function renderTypes() {
  const content = document.getElementById('page-content');
  let types = await getAll('types').catch(() => []);
  let produits = await getAll('produits').catch(() => []);
  const fournisseurs = await getAll('fournisseurs').catch(() => []);
  const allBcgs = await getAll('bcg').catch(() => []);
  let currentPage = 1, currentFilters = {};

  const bcgId = getSelectedBcgId();
  const allMode = isAllBcgMode();
  const currentBcg = (bcgId && bcgId !== 'all') ? allBcgs.find(b => b.id === bcgId) || null : null;

  const canCreate = hasPermission('types', 'create');
  const canEdit = hasPermission('types', 'edit');
  const canDelete = hasPermission('types', 'delete');

  function render(filters = currentFilters, page = currentPage) {
    currentFilters = filters; currentPage = page;
    let filtered = [...types];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(t => (t.nom || '').toLowerCase().includes(q) || (t.prefix || '').toLowerCase().includes(q) || (t.designation || '').toLowerCase().includes(q));
    }
    const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));

    content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">📁 Types de Poteaux</h1><p class="page-subtitle">Définir les types et créer les poteaux</p></div>
        ${canCreate ? '<button class="btn btn-primary" id="add-type-btn">+ Nouveau Type</button>' : ''}</div>
      ${filterBarHTML({ showDate: false, showStatus: false })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Nom</th><th>Préfixe</th><th>Désignation</th><th>Fournisseur</th><th>Créés</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(t => {
          const items = produits.filter(p => p.typeId === t.id);
          const four = fournisseurs.find(f => f.id === t.fournisseurId);
          // Find quantity limit from any BCG that includes this type
          let typeQty = 0;
          allBcgs.forEach(b => { (b.typesQty || []).forEach(tq => { if (tq.typeId === t.id) typeQty += tq.quantite || 0; }); });
          return `<tr>
            <td><strong style="color:var(--accent);cursor:pointer" class="view-type" data-id="${t.id}">${t.nom}</strong></td>
            <td><code style="background:rgba(79,140,255,0.15);padding:2px 8px;border-radius:4px">${t.prefix || '-'}</code></td>
            <td>${t.designation || '-'}</td>
            <td>${four?.raisonSociale || '-'}</td>
            <td><strong>${items.length}</strong>${typeQty > 0 ? ` / ${typeQty}` : ''}</td>
            <td class="actions">
              <button class="btn btn-sm btn-primary view-type" data-id="${t.id}" title="Voir/Créer poteaux">📋</button>
              ${canEdit ? `<button class="btn btn-sm btn-secondary edit-type" data-id="${t.id}">✏️</button>` : ''}
              ${canDelete ? `<button class="btn btn-sm btn-danger delete-type" data-id="${t.id}">🗑️</button>` : ''}
            </td>
          </tr>`;
        }).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">📁</div><div class="title">Aucun type</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;

    paginate(filtered, page, 'pagination-controls', p => render(filters, p));
    wireFilters((f, p) => render(f, p));
    document.getElementById('add-type-btn')?.addEventListener('click', () => openTypeForm());
    document.querySelectorAll('.view-type').forEach(b => b.onclick = () => { const t = types.find(x => x.id === b.dataset.id); if (t) openTypeItems(t); });
    document.querySelectorAll('.edit-type').forEach(b => b.onclick = () => { const t = types.find(x => x.id === b.dataset.id); if (t) openTypeForm(t); });
    document.querySelectorAll('.delete-type').forEach(b => b.onclick = async () => {
      if (await confirmDialog('Supprimer ce type et tous ses poteaux ? Les quantités dans les BCGs seront aussi supprimées.')) {
        const tid = b.dataset.id;
        // Delete all items of this type
        const items = produits.filter(p => p.typeId === tid);
        for (const item of items) { await remove('produits', item.id); }
        // Remove type from all BCGs' typesQty and recalculate totalProduits
        for (const bcg of allBcgs) {
          const hasType = (bcg.typesQty || []).some(tq => tq.typeId === tid);
          if (hasType) {
            const newTypesQty = (bcg.typesQty || []).filter(tq => tq.typeId !== tid);
            const newTotal = newTypesQty.reduce((s, tq) => s + (tq.quantite || 0), 0);
            await update('bcg', bcg.id, { typesQty: newTypesQty, totalProduits: newTotal });
            bcg.typesQty = newTypesQty;
            bcg.totalProduits = newTotal;
          }
        }
        await remove('types', tid);
        produits = produits.filter(p => p.typeId !== tid);
        types = types.filter(x => x.id !== tid);
        render({}, 1);
        showToast('Type, poteaux et quantités BCG supprimés');
      }
    });
  }

  // ===== TYPE FORM (create/edit type) =====
  function openTypeForm(t = null) {
    const isEdit = !!t;

    showModal(isEdit ? 'Modifier Type' : 'Nouveau Type', `<form id="type-form">
      <div class="form-row">
        <div class="form-group"><label class="form-label">Nom *</label><input class="form-input" name="nom" value="${t?.nom || ''}" required/></div>
        <div class="form-group"><label class="form-label">Préfixe ID *</label><input class="form-input" name="prefix" value="${t?.prefix || ''}" placeholder="ex: PB9, PB12" required style="text-transform:uppercase"/>
          <small style="color:var(--text-muted)">Ex: PB9 → PB9-0001, PB9-0002...</small></div>
      </div>
      <div class="form-group"><label class="form-label">Désignation</label><input class="form-input" name="designation" value="${t?.designation || ''}" placeholder="Description du type"/></div>
      <div class="form-group"><label class="form-label">Fournisseur *</label><select class="form-select" name="fournisseurId" required><option value="">--</option>${fournisseurs.map(f => `<option value="${f.id}" ${t?.fournisseurId === f.id ? 'selected' : ''}>${f.raisonSociale}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-input" name="description" rows="2">${t?.description || ''}</textarea></div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-type">${isEdit ? 'Modifier' : 'Ajouter'}</button>`);

    document.getElementById('save-type').onclick = async () => {
      const f = document.getElementById('type-form');
      const nom = f.querySelector('[name="nom"]').value.trim();
      const prefix = f.querySelector('[name="prefix"]').value.trim().toUpperCase();
      const designation = f.querySelector('[name="designation"]').value.trim();
      const fournisseurId = f.querySelector('[name="fournisseurId"]').value;

      if (!nom || !prefix) { showToast('Nom et préfixe requis', 'error'); return; }
      if (!fournisseurId) { showToast('Fournisseur requis', 'error'); return; }

      const four = fournisseurs.find(x => x.id === fournisseurId);

      const data = {
        nom, prefix, designation,
        fournisseurId, fournisseurNom: four?.raisonSociale || '',
        description: f.querySelector('[name="description"]').value
      };

      if (isEdit) {
        await update('types', t.id, data);
        Object.assign(t, data);
      } else {
        const id = await add('types', data);
        types.push({ id, ...data });
      }
      hideModal(); render({}, 1); showToast(isEdit ? 'Modifié' : 'Ajouté');
    };
  }

  // ===== VIEW TYPE ITEMS + CREATE ITEM =====
  function openTypeItems(t) {
    const items = produits.filter(p => p.typeId === t.id).sort((a, b) => (a.numero || 0) - (b.numero || 0));
    // Get quantity limit from BCG (sum of all BCGs that include this type)
    let typeQtyLimit = 0;
    allBcgs.forEach(b => { (b.typesQty || []).forEach(tq => { if (tq.typeId === t.id) typeQtyLimit += tq.quantite || 0; }); });
    const remaining = typeQtyLimit > 0 ? typeQtyLimit - items.length : -1; // -1 means no limit
    const pct = typeQtyLimit > 0 ? Math.round(items.length / typeQtyLimit * 100) : 0;
    const isFull = typeQtyLimit > 0 && remaining <= 0;

    const itemRows = items.length ? items.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong style="color:var(--accent)">${item.reference || '-'}</strong></td>
        <td>${item.designation || t.designation || '-'}</td>
        <td>${formatDate(item.createdAt)}</td>
        <td class="actions"><button class="btn btn-sm btn-danger del-item" data-id="${item.id}">🗑️</button></td>
      </tr>
    `).join('') : `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">Aucun poteau créé</td></tr>`;

    showModal(`${t.nom} — Poteaux (${items.length}${typeQtyLimit > 0 ? '/' + typeQtyLimit : ''})`, `
      <div class="doc-info" style="margin-bottom:16px;">
        <div class="doc-info-box">
          <p><strong>Préfixe:</strong> <code style="background:rgba(79,140,255,0.15);padding:2px 8px;border-radius:4px">${t.prefix}</code></p>
          <p><strong>Fournisseur:</strong> ${t.fournisseurNom || '-'}</p>
        </div>
        <div class="doc-info-box">
          <p><strong>Limite (BCG):</strong> ${typeQtyLimit > 0 ? typeQtyLimit : 'Non définie'}</p>
          <p><strong>Créés:</strong> ${items.length} ${isFull ? '<span style="color:var(--success)">✓ Complet</span>' : typeQtyLimit > 0 ? `— <strong style="color:var(--warning)">${remaining} restant(s)</strong>` : ''}</p>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <div style="flex:1;height:10px;background:var(--bg-input);border-radius:5px;overflow:hidden;">
          <div style="width:${Math.min(pct,100)}%;height:100%;background:${pct>=100?'var(--success)':'var(--accent)'};border-radius:5px;"></div>
        </div>
        <span style="font-weight:700;font-size:0.9rem;">${pct}%</span>
      </div>

      ${!isFull ? `
      <div style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:16px;margin-bottom:16px;">
        <h4 style="margin-bottom:10px;">+ Nouveau Poteau</h4>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">ID du Poteau *</label>
            <div style="display:flex;align-items:center;gap:4px;">
              <span style="font-weight:700;color:var(--accent);font-size:1rem;">${t.prefix}-</span>
              <input class="form-input" id="new-item-id" placeholder="ex: 0001" required style="font-weight:600;color:var(--accent);font-size:1rem;flex:1;"/>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Désignation</label>
            <input class="form-input" id="new-item-desig" value="${t.designation || ''}" placeholder="Description"/>
          </div>
        </div>
        <button class="btn btn-primary" id="add-item-btn" style="margin-top:8px;">Créer le Poteau</button>
      </div>` : ''}

      <h4 style="margin-bottom:8px;">Poteaux créés (${items.length})</h4>
      <div class="table-wrapper" style="max-height:300px;overflow-y:auto;">
        <table class="data-table">
          <thead><tr><th>#</th><th>Référence</th><th>Désignation</th><th>Date</th><th></th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>
    `, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button>`);

    document.querySelector('.modal-container').style.maxWidth = '800px';

    // Wire add item button
    document.getElementById('add-item-btn')?.addEventListener('click', async () => {
      const itemId = document.getElementById('new-item-id').value.trim();
      if (!itemId) { showToast('ID du poteau requis', 'error'); return; }
      const reference = `${t.prefix}-${itemId}`;
      // Check duplicate
      if (produits.some(p => p.reference === reference)) {
        showToast(`"${reference}" existe déjà !`, 'error');
        return;
      }
      // Check type-specific quantity limit from BCG
      const currentCount = produits.filter(p => p.typeId === t.id).length;
      if (typeQtyLimit > 0 && currentCount >= typeQtyLimit) {
        showToast(`Limite du type atteinte (${currentCount}/${typeQtyLimit})`, 'error');
        return;
      }
      // Check BCG total limit: find BCGs containing this type, check their totalProduits
      for (const bcg of allBcgs) {
        const tqEntry = (bcg.typesQty || []).find(tq => tq.typeId === t.id);
        if (tqEntry) {
          const bcgTypeIds = (bcg.typesQty || []).map(tq => tq.typeId);
          const bcgTotal = produits.filter(p => bcgTypeIds.includes(p.typeId)).length;
          const bcgLimit = bcg.totalProduits || 0;
          if (bcgLimit > 0 && bcgTotal >= bcgLimit) {
            showToast(`Limite BCG ${bcg.numero} atteinte (${bcgTotal}/${bcgLimit})`, 'error');
            return;
          }
        }
      }

      const designation = document.getElementById('new-item-desig').value || t.designation || '';
      const numMatch = itemId.match(/(\d+)$/);
      const numero = numMatch ? parseInt(numMatch[1]) : 0;

      const data = {
        reference, designation,
        typeId: t.id, typeNom: t.nom, typePrefix: t.prefix,
        fournisseurId: t.fournisseurId, fournisseurNom: t.fournisseurNom || '',
        unite: 'Unité', stock: 0, numero
      };

      try {
        const id = await add('produits', data);
        produits.push({ id, ...data });
        hideModal();
        openTypeItems(t); // Re-open to refresh list
        showToast(`Poteau "${reference}" créé`);
      } catch (err) { showToast('Erreur: ' + err.message, 'error'); }
    });

    // Wire delete item buttons
    document.querySelectorAll('.del-item').forEach(btn => {
      btn.onclick = async () => {
        if (await confirmDialog('Supprimer ce poteau ?')) {
          await remove('produits', btn.dataset.id);
          produits = produits.filter(p => p.id !== btn.dataset.id);
          hideModal();
          openTypeItems(t);
          showToast('Poteau supprimé');
        }
      };
    });
  }

  render();
}
