// Produits (Poteaux) Page - requires lot selection, prices from lot
import { getAll, add, update, remove } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatDate, formatCurrency } from '../utils/helpers.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';

export async function renderProduits() {
  const content = document.getElementById('page-content');
  let produits = await getAll('produits').catch(() => []);
  const categories = await getAll('categories').catch(() => []);
  const fournisseurs = await getAll('fournisseurs').catch(() => []);
  const lots = await getAll('lots').catch(() => []);
  let currentPage = 1, currentFilters = {};

  function render(filters = currentFilters, page = currentPage) {
    currentFilters = filters; currentPage = page;
    const filtered = applyFilters(produits, { ...filters, searchFields: ['reference', 'designation', 'categorieNom', 'fournisseurNom', 'lotNumero'] });
    const catFilter = filters.category || '';
    const lotFilter = filters.lot || '';
    let result = filtered;
    if (catFilter) result = result.filter(p => p.categorieId === catFilter);
    if (lotFilter) result = result.filter(p => p.lotId === lotFilter);
    const paged = paginate(result, page, 'pagination-controls', p => render(filters, p));

    content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">🏗️ Produits (Poteaux)</h1><p class="page-subtitle">Gestion des poteaux béton — chaque produit appartient à un lot</p></div>
        <button class="btn btn-primary" id="add-prod-btn">+ Nouveau Poteau</button></div>
      <div class="kpi-grid" style="margin-bottom:20px">
        <div class="kpi-card"><div class="kpi-icon blue">🏗️</div><div class="kpi-info"><div class="kpi-label">Total Poteaux</div><div class="kpi-value">${produits.length}</div></div></div>
        <div class="kpi-card"><div class="kpi-icon green">📂</div><div class="kpi-info"><div class="kpi-label">Catégories</div><div class="kpi-value">${categories.length}</div></div></div>
        <div class="kpi-card"><div class="kpi-icon orange">📦</div><div class="kpi-info"><div class="kpi-label">Lots</div><div class="kpi-value">${lots.length}</div></div></div>
        <div class="kpi-card"><div class="kpi-icon red">🔍</div><div class="kpi-info"><div class="kpi-label">Résultats</div><div class="kpi-value">${result.length}</div></div></div>
      </div>
      ${filterBarHTML({ showDate: true, extraFilters: `
        <div class="filter-group"><label>Catégorie:</label><select class="form-select filter-category"><option value="">Toutes</option>${categories.map(c => `<option value="${c.id}" ${catFilter === c.id ? 'selected' : ''}>${c.nom}</option>`).join('')}</select></div>
        <div class="filter-group"><label>Lot:</label><select class="form-select filter-lot"><option value="">Tous</option>${lots.map(l => `<option value="${l.id}" ${lotFilter === l.id ? 'selected' : ''}>${l.numero}</option>`).join('')}</select></div>
      ` })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>ID Poteau</th><th>Lot</th><th>Catégorie</th><th>Désignation</th><th>Fournisseur</th><th>Prix Achat</th><th>Prix Vente</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(p => {
      return `<tr><td><strong style="color:var(--accent)">${p.reference || ''}</strong></td>
            <td><span class="badge badge-warning">${p.lotNumero || '-'}</span></td>
            <td>${p.categorieNom || '-'}</td><td>${p.designation || ''}</td><td>${p.fournisseurNom || '-'}</td>
            <td>${formatCurrency(p.prixAchat || 0)}</td><td>${formatCurrency(p.prixVente || 0)}</td>
            <td class="actions"><button class="btn btn-sm btn-secondary edit-prod" data-id="${p.id}">✏️</button><button class="btn btn-sm btn-danger delete-prod" data-id="${p.id}">🗑️</button></td></tr>`;
    }).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">🏗️</div><div class="title">Aucun poteau trouvé</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;

    paginate(result, page, 'pagination-controls', p => render(filters, p));
    wireFilters((f, p) => render({ ...f, category: document.querySelector('.filter-category')?.value || '', lot: document.querySelector('.filter-lot')?.value || '' }, p));
    document.querySelector('.filter-category')?.addEventListener('change', e => render({ ...currentFilters, category: e.target.value }, 1));
    document.querySelector('.filter-lot')?.addEventListener('change', e => render({ ...currentFilters, lot: e.target.value }, 1));
    document.getElementById('add-prod-btn').onclick = () => openForm();
    document.querySelectorAll('.edit-prod').forEach(b => b.onclick = () => { const p = produits.find(x => x.id === b.dataset.id); if (p) openForm(p); });
    document.querySelectorAll('.delete-prod').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ?')) { await remove('produits', b.dataset.id); produits = produits.filter(x => x.id !== b.dataset.id); render(); showToast('Supprimé'); } });
  }

  function openForm(existing = null) {
    const isEdit = !!existing;
    showModal(isEdit ? `Modifier - ${existing.reference}` : 'Nouveau Poteau', `<form id="prod-form">
      <div class="form-group"><label class="form-label">Lot *</label><select class="form-select" name="lotId" id="prod-lot" ${isEdit ? 'disabled' : ''} required>
        <option value="">-- Sélectionner un lot --</option>
        ${lots.map(l => {
          const count = produits.filter(p => p.lotId === l.id).length;
          const full = count >= (l.maxProduits || 0);
          return `<option value="${l.id}" ${existing?.lotId === l.id ? 'selected' : ''} ${!isEdit && full ? 'disabled' : ''}>${l.numero} (${count}/${l.maxProduits}${full ? ' - PLEIN' : ''})</option>`;
        }).join('')}
      </select></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Catégorie *</label><select class="form-select" name="categorieId" id="prod-cat" ${isEdit ? 'disabled' : ''} required><option value="">--</option>${categories.map(c => `<option value="${c.id}" ${existing?.categorieId === c.id ? 'selected' : ''}>${c.nom}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Fournisseur *</label><select class="form-select" name="fournisseurId" id="prod-four" required><option value="">--</option>${fournisseurs.map(f => `<option value="${f.id}" ${existing?.fournisseurId === f.id ? 'selected' : ''}>${f.raisonSociale}</option>`).join('')}</select></div></div>
      <div class="form-group"><label class="form-label">ID Poteau *</label><input class="form-input" id="prod-ref" value="${existing?.reference || ''}" placeholder="Tapez l'identifiant du poteau" ${isEdit ? 'disabled' : ''} required style="font-weight:600;color:var(--accent);font-size:1.05rem"/></div>
      <div class="form-group"><label class="form-label">Désignation</label><input class="form-input" name="designation" value="${existing?.designation || ''}"/></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Prix Achat (DT) <small style="color:var(--text-muted)">(du lot)</small></label><input class="form-input" type="number" id="prod-prix-achat" step="0.001" min="0" value="${existing?.prixAchat || 0}" readonly style="background:var(--bg-input);opacity:0.7"/></div>
        <div class="form-group"><label class="form-label">Prix Vente (DT) <small style="color:var(--text-muted)">(du lot)</small></label><input class="form-input" type="number" id="prod-prix-vente" step="0.001" min="0" value="${existing?.prixVente || 0}" readonly style="background:var(--bg-input);opacity:0.7"/></div>
      </div>
      <div class="form-group"><label class="form-label">Unité</label><input class="form-input" name="unite" value="${existing?.unite || 'Unité'}"/></div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-prod">${isEdit ? 'Modifier' : 'Créer'}</button>`);

    // Auto-fill prices when lot + category change
    function updatePrices() {
      const lotId = document.getElementById('prod-lot').value;
      const catId = document.getElementById('prod-cat').value;
      const lot = lots.find(l => l.id === lotId);
      if (lot && catId) {
        const catPrix = (lot.prixParCategorie || []).find(p => p.categorieId === catId);
        document.getElementById('prod-prix-achat').value = catPrix?.prixAchat || 0;
        document.getElementById('prod-prix-vente').value = catPrix?.prixVente || 0;
      }
    }
    document.getElementById('prod-lot').onchange = updatePrices;
    document.getElementById('prod-cat').onchange = updatePrices;

    document.getElementById('save-prod').onclick = async () => {
      const f = document.getElementById('prod-form');
      const lotId = isEdit ? existing.lotId : f.querySelector('[name="lotId"]').value;
      if (!lotId) { showToast('Lot requis', 'error'); return; }
      const catId = isEdit ? existing.categorieId : f.querySelector('[name="categorieId"]').value;
      if (!catId) { showToast('Catégorie requise', 'error'); return; }
      const fourId = f.querySelector('[name="fournisseurId"]').value;
      if (!fourId) { showToast('Fournisseur requis', 'error'); return; }
      const ref = document.getElementById('prod-ref').value.trim();
      if (!ref) { showToast('ID Poteau requis', 'error'); return; }

      const lot = lots.find(l => l.id === lotId);
      const cat = categories.find(c => c.id === catId);
      const four = fournisseurs.find(x => x.id === fourId);
      const catPrix = (lot?.prixParCategorie || []).find(p => p.categorieId === catId);
      const prixAchat = catPrix?.prixAchat || 0;
      const prixVente = catPrix?.prixVente || 0;
      const designation = f.querySelector('[name="designation"]').value;
      const unite = f.querySelector('[name="unite"]').value || 'Unité';

      if (isEdit) {
        const data = { fournisseurId: fourId, fournisseurNom: four?.raisonSociale || '', designation, prixAchat, prixVente, unite };
        await update('produits', existing.id, data);
        Object.assign(existing, data);
        hideModal(); render(); showToast('Modifié');
      } else {
        // Check lot limit
        const lotCount = produits.filter(p => p.lotId === lotId).length;
        if (lotCount >= (lot?.maxProduits || 0)) { showToast(`Lot "${lot.numero}" est plein (${lot.maxProduits} max)`, 'error'); return; }
        // Check duplicate
        if (produits.some(p => p.reference === ref)) { showToast(`ID "${ref}" existe déjà !`, 'error'); return; }
        const numMatch = ref.match(/(\d+)$/);
        const numero = numMatch ? parseInt(numMatch[1]) : 0;
        const data = { reference: ref, designation, categorieId: catId, categorieNom: cat?.nom || '', fournisseurId: fourId, fournisseurNom: four?.raisonSociale || '', lotId, lotNumero: lot?.numero || '', prixAchat, prixVente, unite, stock: 0, numero };
        try {
          const id = await add('produits', data);
          produits.push({ id, ...data });
          hideModal(); render({}, 1); showToast(`Poteau "${ref}" créé dans lot ${lot.numero}`);
        } catch (err) { showToast('Erreur: ' + err.message, 'error'); }
      }
    };
  }

  render();
}
