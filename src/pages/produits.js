// Produits (Poteaux) Page - manual ID, select from table to create DA
import { getAll, add, update, remove, getSettings, getNextNumber } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatDate, formatCurrency, todayISO } from '../utils/helpers.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';
import { navigateTo } from '../router.js';

export async function renderProduits() {
  const content = document.getElementById('page-content');
  let produits = await getAll('produits').catch(() => []);
  const categories = await getAll('categories').catch(() => []);
  const fournisseurs = await getAll('fournisseurs').catch(() => []);
  const settings = await getSettings();
  let currentPage = 1, currentFilters = {};

  function render(filters = currentFilters, page = currentPage) {
    currentFilters = filters; currentPage = page;
    const filtered = applyFilters(produits, { ...filters, searchFields: ['reference', 'designation', 'categorieNom', 'fournisseurNom'] });
    const catFilter = filters.category || '';
    const catFiltered = catFilter ? filtered.filter(p => p.categorieId === catFilter) : filtered;
    const paged = paginate(catFiltered, page, 'pagination-controls', p => render(filters, p));

    content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">🏗️ Produits (Poteaux)</h1><p class="page-subtitle">Gestion des poteaux béton</p></div>
        <div style="display:flex;gap:8px"><button class="btn btn-primary" id="add-prod-btn">+ Nouveau Poteau</button><button class="btn btn-success" id="create-da-btn">📋 Créer Devis Achat</button></div></div>
      <div class="kpi-grid" style="margin-bottom:20px">
        <div class="kpi-card"><div class="kpi-icon blue">🏗️</div><div class="kpi-info"><div class="kpi-label">Total Poteaux</div><div class="kpi-value">${produits.length}</div></div></div>
        <div class="kpi-card"><div class="kpi-icon green">📂</div><div class="kpi-info"><div class="kpi-label">Catégories</div><div class="kpi-value">${categories.length}</div></div></div>
        <div class="kpi-card"><div class="kpi-icon orange">🔍</div><div class="kpi-info"><div class="kpi-label">Résultats</div><div class="kpi-value">${catFiltered.length}</div></div></div>
      </div>
      ${filterBarHTML({ showDate: true, extraFilters: `<div class="filter-group"><label>Catégorie:</label><select class="form-select filter-category"><option value="">Toutes</option>${categories.map(c => `<option value="${c.id}" ${catFilter === c.id ? 'selected' : ''}>${c.nom}</option>`).join('')}</select></div>` })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th style="width:40px"><input type="checkbox" id="select-all-prod"/></th><th>ID Poteau</th><th>Catégorie</th><th>Désignation</th><th>Fournisseur</th><th>Prix Achat</th><th>Prix Vente</th><th>Date</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(p => {
      const cat = categories.find(c => c.id === p.categorieId);
      return `<tr><td><input type="checkbox" class="prod-check" data-id="${p.id}"/></td><td><strong style="color:var(--accent)">${p.reference || ''}</strong></td><td>${cat?.nom || '-'}</td><td>${p.designation || ''}</td><td>${p.fournisseurNom || '-'}</td>
            <td>${formatCurrency(p.prixAchat || 0)}</td><td>${formatCurrency(p.prixVente || 0)}</td>
            <td>${formatDate(p.createdAt)}</td>
            <td class="actions"><button class="btn btn-sm btn-secondary edit-prod" data-id="${p.id}">✏️</button><button class="btn btn-sm btn-danger delete-prod" data-id="${p.id}">🗑️</button></td></tr>`;
    }).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">🏗️</div><div class="title">Aucun poteau trouvé</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;

    paginate(catFiltered, page, 'pagination-controls', p => render(filters, p));
    wireFilters((f, p) => render({ ...f, category: document.querySelector('.filter-category')?.value || '' }, p));
    document.querySelector('.filter-category')?.addEventListener('change', e => render({ ...currentFilters, category: e.target.value }, 1));
    document.getElementById('add-prod-btn').onclick = () => openForm();
    document.getElementById('create-da-btn').onclick = () => openDAForm();
    // Select all checkbox
    const selAll = document.getElementById('select-all-prod');
    if (selAll) selAll.onchange = () => document.querySelectorAll('.prod-check').forEach(c => c.checked = selAll.checked);
    document.querySelectorAll('.edit-prod').forEach(b => b.onclick = () => { const p = produits.find(x => x.id === b.dataset.id); if (p) openForm(p); });
    document.querySelectorAll('.delete-prod').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ?')) { await remove('produits', b.dataset.id); produits = produits.filter(x => x.id !== b.dataset.id); render(); showToast('Supprimé'); } });
  }

  function openForm(existing = null) {
    const isEdit = !!existing;
    showModal(isEdit ? `Modifier - ${existing.reference}` : 'Nouveau Poteau', `<form id="prod-form">
      <div class="form-row"><div class="form-group"><label class="form-label">Catégorie *</label><select class="form-select" name="categorieId" id="prod-cat" ${isEdit ? 'disabled' : ''} required><option value="">--</option>${categories.map(c => `<option value="${c.id}" ${existing?.categorieId === c.id ? 'selected' : ''}>${c.nom}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Fournisseur *</label><select class="form-select" name="fournisseurId" id="prod-four" required><option value="">--</option>${fournisseurs.map(f => `<option value="${f.id}" ${existing?.fournisseurId === f.id ? 'selected' : ''}>${f.raisonSociale}</option>`).join('')}</select></div></div>
      <div class="form-group"><label class="form-label">ID Poteau *</label><input class="form-input" id="prod-ref" value="${existing?.reference || ''}" placeholder="Tapez l'identifiant du poteau" ${isEdit ? 'disabled' : ''} required style="font-weight:600;color:var(--accent);font-size:1.05rem"/></div>
      <div class="form-group"><label class="form-label">Désignation</label><input class="form-input" name="designation" value="${existing?.designation || ''}"/></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Prix Achat (DT)</label><input class="form-input" type="number" name="prixAchat" step="0.001" min="0" value="${existing?.prixAchat || 0}"/></div>
        <div class="form-group"><label class="form-label">Prix Vente (DT)</label><input class="form-input" type="number" name="prixVente" step="0.001" min="0" value="${existing?.prixVente || 0}"/></div></div>
      <div class="form-group"><label class="form-label">Unité</label><input class="form-input" name="unite" value="${existing?.unite || 'Unité'}"/></div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-prod">${isEdit ? 'Modifier' : 'Créer'}</button>`);

    document.getElementById('save-prod').onclick = async () => {
      const f = document.getElementById('prod-form');
      const catId = isEdit ? existing.categorieId : f.querySelector('[name="categorieId"]').value;
      if (!catId) { showToast('Catégorie requise', 'error'); return; }
      const fourId = f.querySelector('[name="fournisseurId"]').value;
      if (!fourId) { showToast('Fournisseur requis', 'error'); return; }
      const ref = document.getElementById('prod-ref').value.trim();
      if (!ref) { showToast('ID Poteau requis', 'error'); return; }
      const cat = categories.find(c => c.id === catId);
      const four = fournisseurs.find(x => x.id === fourId);
      const prixAchat = parseFloat(f.querySelector('[name="prixAchat"]').value) || 0;
      const prixVente = parseFloat(f.querySelector('[name="prixVente"]').value) || 0;
      const designation = f.querySelector('[name="designation"]').value;
      const unite = f.querySelector('[name="unite"]').value || 'Unité';

      if (isEdit) {
        const data = { fournisseurId: fourId, fournisseurNom: four?.raisonSociale || '', designation, prixAchat, prixVente, unite };
        await update('produits', existing.id, data);
        Object.assign(existing, data);
        hideModal(); render(); showToast('Modifié');
      } else {
        // Check duplicate
        if (produits.some(p => p.reference === ref)) { showToast(`ID "${ref}" existe déjà !`, 'error'); return; }
        const numMatch = ref.match(/(\d+)$/);
        const numero = numMatch ? parseInt(numMatch[1]) : 0;
        const data = { reference: ref, designation, categorieId: catId, categorieNom: cat?.nom || '', fournisseurId: fourId, fournisseurNom: four?.raisonSociale || '', prixAchat, prixVente, unite, stock: 0, numero };
        try {
          const id = await add('produits', data);
          produits.push({ id, ...data });
          hideModal(); render({}, 1); showToast(`Poteau "${ref}" créé`);
        } catch (err) { showToast('Erreur: ' + err.message, 'error'); }
      }
    };
  }

  function openDAForm() {
    // Get selected products from checkboxes
    const checkedIds = [...document.querySelectorAll('.prod-check:checked')].map(c => c.dataset.id);
    const selected = produits.filter(p => checkedIds.includes(p.id));
    if (!selected.length) { showToast('Sélectionnez des poteaux dans la table', 'error'); return; }

    // Group by fournisseur
    const fourIds = [...new Set(selected.map(p => p.fournisseurId))];
    if (fourIds.length > 1) { showToast('Les poteaux sélectionnés doivent avoir le même fournisseur', 'error'); return; }

    const four = fournisseurs.find(f => f.id === fourIds[0]);
    const taxRate = settings.taxRate || 19;

    // Build summary
    const summary = selected.map(p => `<tr><td>${p.reference}</td><td>${p.categorieNom || '-'}</td><td>${formatCurrency(p.prixAchat || 0)}</td></tr>`).join('');
    const totalHT = selected.reduce((s, p) => s + (p.prixAchat || 0), 0);
    const totalTVA = totalHT * taxRate / 100;

    showModal('Créer Devis Achat', `<div>
      <div class="form-group"><label class="form-label">Fournisseur</label><input class="form-input" value="${four?.raisonSociale || '-'}" disabled/></div>
      <h4 style="margin:16px 0 8px">Poteaux sélectionnés (${selected.length})</h4>
      <div class="table-wrapper"><table class="data-table"><thead><tr><th>ID Poteau</th><th>Catégorie</th><th>Prix Achat</th></tr></thead><tbody>${summary}</tbody></table></div>
      <div class="doc-totals" style="margin-top:16px">
        <div class="doc-total-row"><span>Total HT:</span><span>${formatCurrency(totalHT)}</span></div>
        <div class="doc-total-row"><span>TVA (${taxRate}%):</span><span>${formatCurrency(totalTVA)}</span></div>
        <div class="doc-total-row grand-total"><span>Total TTC:</span><span>${formatCurrency(totalHT + totalTVA)}</span></div>
      </div>
    </div>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="confirm-da">Confirmer & Créer DA</button>`);

    document.getElementById('confirm-da').onclick = async () => {
      try {
        const devisNum = await getNextNumber('devisAchatPrefix');
        // Build lines: one line per product (each poteau = qty 1)
        const lignes = selected.map(p => ({
          categorieId: p.categorieId, categorieNom: p.categorieNom || '',
          fromId: p.id, fromRef: p.reference, toId: p.id, toRef: p.reference,
          designation: `${p.categorieNom || ''} [${p.reference}]`,
          quantite: 1, prixUnitaire: p.prixAchat || 0, montant: p.prixAchat || 0
        }));
        await add('devis_achat', {
          numero: devisNum, date: todayISO(),
          fournisseurId: fourIds[0], fournisseurNom: four?.raisonSociale || '',
          lignes, taxRate, totalHT, totalTVA, totalTTC: totalHT + totalTVA,
          statut: 'Brouillon', note: `${selected.length} poteaux`
        });
        hideModal();
        showToast(`Devis ${devisNum} créé avec ${selected.length} poteaux`);
        setTimeout(() => navigateTo('/devis-achat'), 300);
      } catch (err) { showToast('Erreur: ' + err.message, 'error'); }
    };
  }

  render();
}
