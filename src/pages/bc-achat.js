// BC Achat Page - individual product, global uniqueness
import { getAll, add, update, remove, getSettings, getNextNumber, getUsedProductIds } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatCurrency, formatDate, todayISO, printDocumentHeader } from '../utils/helpers.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';

export async function renderBcAchat() {
  const content = document.getElementById('page-content');
  let bcs = await getAll('bc_achat').catch(() => []);
  const fournisseurs = await getAll('fournisseurs').catch(() => []);
  const produits = await getAll('produits').catch(() => []);
  const categories = await getAll('categories').catch(() => []);
  const settings = await getSettings();
  let currentPage = 1, currentFilters = {};

  function render(filters = currentFilters, page = currentPage) {
    currentFilters = filters; currentPage = page;
    const filtered = applyFilters(bcs, { ...filters, searchFields: ['numero', 'fournisseurNom', 'devisRef'], statusField: 'statut' });
    const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));
    content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">📦 Bon de Commande Achat</h1><p class="page-subtitle">Commandes fournisseurs</p></div>
        <button class="btn btn-primary" id="add-bca-btn">+ Nouveau BC</button></div>
      ${filterBarHTML({ showStatus: true, statusOptions: ['En cours', 'Livré', 'Annulé'] })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>N° BC</th><th>Date</th><th>Fournisseur</th><th>Réf. Devis</th><th>Nb Poteaux</th><th>Total TTC</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(b => `<tr><td><strong style="color:var(--accent)">${b.numero || ''}</strong></td><td>${formatDate(b.date)}</td><td>${b.fournisseurNom || '-'}</td><td>${b.devisRef || '-'}</td><td>${(b.lignes || []).length}</td><td><strong>${formatCurrency(b.totalTTC)}</strong></td>
          <td><span class="badge ${b.statut === 'Livré' ? 'badge-success' : b.statut === 'Annulé' ? 'badge-danger' : 'badge-warning'}">${b.statut || 'En cours'}</span></td>
          <td class="actions"><button class="btn btn-sm btn-secondary view-bca" data-id="${b.id}">👁️</button>${b.statut !== 'Livré' ? `<button class="btn btn-sm btn-success create-bl" data-id="${b.id}" title="→ BL">🚛</button>` : ''}<button class="btn btn-sm btn-danger delete-bca" data-id="${b.id}">🗑️</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">📦</div><div class="title">Aucun BC achat</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;
    paginate(filtered, page, 'pagination-controls', p => render(filters, p));
    wireFilters((f, p) => render(f, p));
    document.getElementById('add-bca-btn').onclick = () => openForm();
    document.querySelectorAll('.view-bca').forEach(b => b.onclick = () => { const bc = bcs.find(x => x.id === b.dataset.id); if (bc) viewDoc(bc); });
    document.querySelectorAll('.create-bl').forEach(b => b.onclick = async () => {
      const bc = bcs.find(x => x.id === b.dataset.id);
      if (bc && await confirmDialog('Créer un BL Achat à partir de ce BC ?')) {
        const n = await getNextNumber('blAchatPrefix');
        await add('bl_achat', { numero: n, date: todayISO(), fournisseurId: bc.fournisseurId, fournisseurNom: bc.fournisseurNom, lignes: bc.lignes, bcRef: bc.numero, statut: 'En attente', note: '' });
        await update('bc_achat', bc.id, { statut: 'Livré' }); bc.statut = 'Livré'; render(); showToast(`BL ${n} créé`);
      }
    });
    document.querySelectorAll('.delete-bca').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ?')) { await remove('bc_achat', b.dataset.id); bcs = bcs.filter(x => x.id !== b.dataset.id); render(); showToast('Supprimé'); } });
  }

  function lineHtml(l = {}) {
    return `<tr class="line-row">
      <td><select class="form-select line-cat" style="min-width:130px"><option value="">-- Catégorie --</option>${categories.map(c => `<option value="${c.id}" ${l.categorieId === c.id ? 'selected' : ''}>${c.nom}</option>`).join('')}</select></td>
      <td><select class="form-select line-prod" style="min-width:200px"><option value="">-- Produit --</option></select></td>
      <td><input class="form-input line-prix" type="number" step="0.001" value="${l.prixUnitaire || 0}" style="width:110px"/></td>
      <td><button type="button" class="btn btn-sm btn-danger remove-line">✗</button></td></tr>`;
  }

  async function openForm(bc = null) {
    const isEdit = !!bc, taxRate = bc?.taxRate ?? settings.taxRate ?? 19;
    const usedIds = await getUsedProductIds();
    const editOwnIds = new Set();
    if (bc?.lignes) bc.lignes.forEach(l => { const pid = l.produitId || l.fromId; if (pid) editOwnIds.add(pid); });

    showModal(isEdit ? 'Modifier BC' : 'Nouveau BC Achat', `<form id="bca-form">
      <div class="form-row"><div class="form-group"><label class="form-label">Fournisseur *</label><select class="form-select" name="fournisseurId" required><option value="">--</option>${fournisseurs.map(f => `<option value="${f.id}" ${bc?.fournisseurId === f.id ? 'selected' : ''}>${f.raisonSociale}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" name="date" value="${bc?.date || todayISO()}"/></div></div>
      <div class="form-group"><label class="form-label">TVA (%)</label><input class="form-input" type="number" name="taxRate" id="bca-tax" value="${taxRate}" style="max-width:150px"/></div>
      <h4 style="margin:16px 0 8px">Poteaux <small style="color:var(--text-muted)">(seuls les poteaux non-utilisés)</small></h4>
      <div class="table-wrapper"><table class="data-table line-items-table"><thead><tr><th>Catégorie</th><th>Poteau (ID)</th><th>Prix HT</th><th></th></tr></thead><tbody id="bca-lines">${(bc?.lignes || [{}]).map(l => lineHtml(l)).join('')}</tbody></table></div>
      <button type="button" class="btn btn-secondary btn-sm" id="bca-add-line">+ Ajouter Poteau</button>
      <div class="form-group" style="margin-top:12px"><label class="form-label">Note</label><textarea class="form-input" name="note" rows="2">${bc?.note || ''}</textarea></div>
      <div class="doc-totals"><div class="doc-total-row"><span>Total HT:</span><span id="total-ht">0,000 DT</span></div><div class="doc-total-row"><span>TVA:</span><span id="total-tva">0,000 DT</span></div><div class="doc-total-row grand-total"><span>Total TTC:</span><span id="total-ttc">0,000 DT</span></div></div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-bca">${isEdit ? 'Modifier' : 'Créer'}</button>`);
    document.querySelector('.modal-container').style.maxWidth = '900px';
    wireAll();
    if (bc?.lignes) { setTimeout(() => { document.querySelectorAll('#bca-lines .line-row').forEach((row, i) => { const l = bc.lignes[i]; if (l?.categorieId) { row.querySelector('.line-cat').value = l.categorieId; populateProducts(row, l.categorieId, l.produitId || l.fromId); } }); recalcAll(); }, 100); }
    document.getElementById('bca-add-line').onclick = () => { document.getElementById('bca-lines').insertAdjacentHTML('beforeend', lineHtml()); wireAll(); };
    document.getElementById('bca-tax').oninput = () => recalcAll();
    document.getElementById('save-bca').onclick = async () => {
      const f = document.getElementById('bca-form'), fid = f.querySelector('[name="fournisseurId"]').value;
      if (!fid) { showToast('Fournisseur requis', 'error'); return; }
      const four = fournisseurs.find(x => x.id === fid), dt = f.querySelector('[name="date"]').value, tax = parseFloat(f.querySelector('[name="taxRate"]').value) || 0, lines = collectLines();
      if (!lines.length) { showToast('Ajoutez un poteau', 'error'); return; }
      const totalHT = lines.reduce((s, l) => s + l.montant, 0), totalTVA = totalHT * tax / 100;
      const data = { date: dt, fournisseurId: fid, fournisseurNom: four?.raisonSociale || '', lignes: lines, taxRate: tax, totalHT, totalTVA, totalTTC: totalHT + totalTVA, statut: bc?.statut || 'En cours', note: f.querySelector('[name="note"]').value };
      if (isEdit) { await update('bc_achat', bc.id, data); Object.assign(bc, data); } else { data.numero = await getNextNumber('bcAchatPrefix'); const id = await add('bc_achat', data); bcs.unshift({ id, ...data }); }
      hideModal(); render(); showToast(isEdit ? 'Modifié' : 'Créé');
    };

    function populateProducts(row, catId, selProdId) {
      const catProds = produits.filter(p => p.categorieId === catId && (!usedIds.has(p.id) || editOwnIds.has(p.id) || p.id === selProdId)).sort((a, b) => (a.numero || 0) - (b.numero || 0));
      row.querySelector('.line-prod').innerHTML = `<option value="">-- Produit --</option>${catProds.map(p => `<option value="${p.id}" data-prix="${p.prixAchat || 0}" ${selProdId === p.id ? 'selected' : ''}>${p.reference}</option>`).join('')}`;
    }
    function wireAll() {
      document.querySelectorAll('#bca-lines .line-row').forEach(row => {
        row.querySelector('.line-cat').onchange = e => { populateProducts(row, e.target.value); recalcRow(row); };
        row.querySelector('.line-prod').onchange = () => recalcRow(row);
        row.querySelector('.line-prix').oninput = () => { row.querySelector('.line-prix').dataset.userEdited = 'true'; recalcRow(row); };
        row.querySelector('.remove-line').onclick = () => { if (document.getElementById('bca-lines').children.length > 1) row.remove(); recalcAll(); };
      });
    }
    function recalcRow(row) {
      const prodOpt = row.querySelector('.line-prod').selectedOptions[0];
      const prixInput = row.querySelector('.line-prix');
      const productPrix = parseFloat(prodOpt?.dataset?.prix) || 0;
      if (prodOpt?.value && productPrix > 0 && !prixInput.dataset.userEdited) prixInput.value = productPrix;
      recalcAll();
    }
    function recalcAll() {
      let ht = 0; document.querySelectorAll('#bca-lines .line-row').forEach(r => { ht += parseFloat(r.querySelector('.line-prix').value) || 0; });
      const t = parseFloat(document.getElementById('bca-tax')?.value) || 0;
      const h = document.getElementById('total-ht'), v = document.getElementById('total-tva'), c = document.getElementById('total-ttc');
      if (h) h.textContent = formatCurrency(ht); if (v) v.textContent = formatCurrency(ht * t / 100); if (c) c.textContent = formatCurrency(ht + ht * t / 100);
    }
    function collectLines() {
      const lines = [], seen = new Set(); document.querySelectorAll('#bca-lines .line-row').forEach(row => {
        const catSel = row.querySelector('.line-cat'), pSel = row.querySelector('.line-prod');
        const prix = parseFloat(row.querySelector('.line-prix').value) || 0;
        if (pSel.value) {
          if (seen.has(pSel.value)) { showToast('Poteau en double!', 'error'); return; }
          seen.add(pSel.value);
          const cat = categories.find(c => c.id === catSel.value), prod = produits.find(p => p.id === pSel.value);
          lines.push({ categorieId: catSel.value, categorieNom: cat?.nom || '', produitId: pSel.value, produitRef: prod?.reference || '', designation: prod?.reference || '', quantite: 1, prixUnitaire: prix, montant: prix });
        }
      }); return lines;
    }
  }

  function viewDoc(b) {
    showModal(`BC Achat - ${b.numero}`, `${printDocumentHeader(settings, 'BON DE COMMANDE ACHAT', b.numero, b.date)}
      <div class="doc-info"><div class="doc-info-box"><p><strong>Fournisseur:</strong> ${b.fournisseurNom}</p></div><div class="doc-info-box"><p><strong>Statut:</strong> ${b.statut}</p></div></div>
      <table class="data-table"><thead><tr><th>Poteau</th><th>Prix HT</th></tr></thead><tbody>${(b.lignes || []).map(l => `<tr><td>${l.designation || l.produitRef || ''}</td><td>${formatCurrency(l.prixUnitaire)}</td></tr>`).join('')}</tbody></table>
      <div class="doc-totals"><div class="doc-total-row"><span>Total HT (${(b.lignes || []).length} poteaux):</span><span>${formatCurrency(b.totalHT)}</span></div><div class="doc-total-row"><span>TVA (${b.taxRate}%):</span><span>${formatCurrency(b.totalTVA)}</span></div><div class="doc-total-row grand-total"><span>Total TTC:</span><span>${formatCurrency(b.totalTTC)}</span></div></div>`,
      `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button><button class="btn btn-primary" onclick="window.print()">🖨️</button>`);
  }
  render();
}
