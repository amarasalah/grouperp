// Devis Achat Page - individual product selection, no qty (each poteau = 1)
import { getAll, add, update, remove, getSettings, getNextNumber } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatCurrency, formatDate, todayISO, printDocumentHeader, numberToWords } from '../utils/helpers.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';

export async function renderDevisAchat() {
  const content = document.getElementById('page-content');
  let devis = await getAll('devis_achat').catch(() => []);
  const fournisseurs = await getAll('fournisseurs').catch(() => []);
  const produits = await getAll('produits').catch(() => []);
  const categories = await getAll('categories').catch(() => []);
  const settings = await getSettings();
  let currentPage = 1, currentFilters = {};

  function render(filters = currentFilters, page = currentPage) {
    currentFilters = filters; currentPage = page;
    const filtered = applyFilters(devis, { ...filters, searchFields: ['numero', 'fournisseurNom'], statusField: 'statut' });
    const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));

    content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">📋 Devis Achat</h1><p class="page-subtitle">Devis fournisseurs</p></div>
        <button class="btn btn-primary" id="add-da-btn">+ Nouveau Devis</button></div>
      ${filterBarHTML({ showStatus: true, statusOptions: ['Brouillon', 'Validé', 'Annulé'] })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>N°</th><th>Date</th><th>Fournisseur</th><th>Nb Poteaux</th><th>Total HT</th><th>Total TTC</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(d => `<tr><td><strong style="color:var(--accent)">${d.numero || ''}</strong></td><td>${formatDate(d.date)}</td><td>${d.fournisseurNom || '-'}</td><td>${(d.lignes || []).length}</td><td>${formatCurrency(d.totalHT)}</td><td><strong>${formatCurrency(d.totalTTC)}</strong></td>
          <td><span class="badge ${d.statut === 'Validé' ? 'badge-success' : d.statut === 'Annulé' ? 'badge-danger' : 'badge-warning'}">${d.statut || 'Brouillon'}</span></td>
          <td class="actions"><button class="btn btn-sm btn-secondary view-da" data-id="${d.id}">👁️</button><button class="btn btn-sm btn-secondary edit-da" data-id="${d.id}">✏️</button>${d.statut !== 'Validé' ? `<button class="btn btn-sm btn-success convert-bc" data-id="${d.id}" title="→ BC">📦</button>` : ''}<button class="btn btn-sm btn-danger delete-da" data-id="${d.id}">🗑️</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">📋</div><div class="title">Aucun devis achat</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;

    paginate(filtered, page, 'pagination-controls', p => render(filters, p));
    wireFilters((f, p) => render(f, p));
    document.getElementById('add-da-btn').onclick = () => openForm();
    document.querySelectorAll('.edit-da').forEach(b => b.onclick = () => { const d = devis.find(x => x.id === b.dataset.id); if (d) openForm(d); });
    document.querySelectorAll('.view-da').forEach(b => b.onclick = () => { const d = devis.find(x => x.id === b.dataset.id); if (d) viewDoc(d); });
    document.querySelectorAll('.convert-bc').forEach(b => b.onclick = async () => {
      const d = devis.find(x => x.id === b.dataset.id);
      if (d && await confirmDialog('Convertir en BC Achat ?')) {
        const n = await getNextNumber('bcAchatPrefix');
        await add('bc_achat', { numero: n, date: todayISO(), fournisseurId: d.fournisseurId, fournisseurNom: d.fournisseurNom, lignes: d.lignes, taxRate: d.taxRate, totalHT: d.totalHT, totalTVA: d.totalTVA, totalTTC: d.totalTTC, devisRef: d.numero, statut: 'En cours' });
        await update('devis_achat', d.id, { statut: 'Validé' }); d.statut = 'Validé'; render(); showToast(`BC ${n} créé`);
      }
    });
    document.querySelectorAll('.delete-da').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ?')) { await remove('devis_achat', b.dataset.id); devis = devis.filter(x => x.id !== b.dataset.id); render(); showToast('Supprimé'); } });
  }

  function lineHtml(l = {}) {
    return `<tr class="line-row">
      <td><select class="form-select line-cat" style="min-width:130px"><option value="">-- Catégorie --</option>${categories.map(c => `<option value="${c.id}" ${l.categorieId === c.id ? 'selected' : ''}>${c.nom}</option>`).join('')}</select></td>
      <td><select class="form-select line-prod" style="min-width:200px"><option value="">-- Produit --</option></select></td>
      <td><input class="form-input line-prix" type="number" step="0.001" value="${l.prixUnitaire || 0}" style="width:110px"/></td>
      <td><button type="button" class="btn btn-sm btn-danger remove-line">✗</button></td></tr>`;
  }

  function openForm(dv = null) {
    const isEdit = !!dv, taxRate = dv?.taxRate ?? settings.taxRate ?? 19;
    showModal(isEdit ? 'Modifier Devis' : 'Nouveau Devis Achat', `<form id="da-form">
      <div class="form-row"><div class="form-group"><label class="form-label">Fournisseur *</label><select class="form-select" name="fournisseurId" required><option value="">--</option>${fournisseurs.map(f => `<option value="${f.id}" ${dv?.fournisseurId === f.id ? 'selected' : ''}>${f.raisonSociale}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" name="date" value="${dv?.date || todayISO()}"/></div></div>
      <div class="form-group"><label class="form-label">TVA (%)</label><input class="form-input" type="number" name="taxRate" id="da-tax" value="${taxRate}" style="max-width:150px"/></div>
      <h4 style="margin:16px 0 8px">Poteaux</h4>
      <div class="table-wrapper"><table class="data-table line-items-table"><thead><tr><th>Catégorie</th><th>Poteau (ID)</th><th>Prix HT</th><th></th></tr></thead><tbody id="da-lines">${(dv?.lignes || [{}]).map(l => lineHtml(l)).join('')}</tbody></table></div>
      <button type="button" class="btn btn-secondary btn-sm" id="da-add-line">+ Ajouter Poteau</button>
      <div class="form-group" style="margin-top:12px"><label class="form-label">Note</label><textarea class="form-input" name="note" rows="2">${dv?.note || ''}</textarea></div>
      <div class="doc-totals"><div class="doc-total-row"><span>Total HT:</span><span id="total-ht">0,000 DT</span></div><div class="doc-total-row"><span>TVA:</span><span id="total-tva">0,000 DT</span></div><div class="doc-total-row grand-total"><span>Total TTC:</span><span id="total-ttc">0,000 DT</span></div></div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-da">${isEdit ? 'Modifier' : 'Créer'}</button>`);
    document.querySelector('.modal-container').style.maxWidth = '900px';
    wireAll();
    if (dv?.lignes) { setTimeout(() => { document.querySelectorAll('#da-lines .line-row').forEach((row, i) => { const l = dv.lignes[i]; if (l?.categorieId) { row.querySelector('.line-cat').value = l.categorieId; populateProducts(row, l.categorieId, l.produitId); } }); recalcAll(); }, 100); }
    document.getElementById('da-add-line').onclick = () => { document.getElementById('da-lines').insertAdjacentHTML('beforeend', lineHtml()); wireAll(); };
    document.getElementById('da-tax').oninput = () => recalcAll();
    document.getElementById('save-da').onclick = async () => {
      const f = document.getElementById('da-form'), fid = f.querySelector('[name="fournisseurId"]').value;
      if (!fid) { showToast('Fournisseur requis', 'error'); return; }
      const four = fournisseurs.find(x => x.id === fid), dt = f.querySelector('[name="date"]').value, tax = parseFloat(f.querySelector('[name="taxRate"]').value) || 0, lines = collectLines();
      if (!lines.length) { showToast('Ajoutez un poteau', 'error'); return; }
      const totalHT = lines.reduce((s, l) => s + l.montant, 0), totalTVA = totalHT * tax / 100;
      const data = { date: dt, fournisseurId: fid, fournisseurNom: four?.raisonSociale || '', lignes: lines, taxRate: tax, totalHT, totalTVA, totalTTC: totalHT + totalTVA, statut: dv?.statut || 'Brouillon', note: f.querySelector('[name="note"]').value };
      if (isEdit) { await update('devis_achat', dv.id, data); Object.assign(dv, data); } else { data.numero = await getNextNumber('devisAchatPrefix'); const id = await add('devis_achat', data); devis.unshift({ id, ...data }); }
      hideModal(); render(); showToast(isEdit ? 'Modifié' : 'Créé');
    };
  }

  function populateProducts(row, catId, selProdId) {
    const catProds = produits.filter(p => p.categorieId === catId).sort((a, b) => (a.numero || 0) - (b.numero || 0));
    row.querySelector('.line-prod').innerHTML = `<option value="">-- Produit --</option>${catProds.map(p => `<option value="${p.id}" data-ref="${p.reference}" data-prix="${p.prixAchat || 0}" ${selProdId === p.id ? 'selected' : ''}>${p.reference}</option>`).join('')}`;
  }
  function wireAll() {
    document.querySelectorAll('#da-lines .line-row').forEach(row => {
      row.querySelector('.line-cat').onchange = e => { populateProducts(row, e.target.value); recalcRow(row); };
      row.querySelector('.line-prod').onchange = () => recalcRow(row);
      row.querySelector('.line-prix').oninput = () => { row.querySelector('.line-prix').dataset.userEdited = 'true'; recalcRow(row); };
      row.querySelector('.remove-line').onclick = () => { if (document.getElementById('da-lines').children.length > 1) row.remove(); recalcAll(); };
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
    let ht = 0; document.querySelectorAll('#da-lines .line-row').forEach(r => { ht += parseFloat(r.querySelector('.line-prix').value) || 0; });
    const t = parseFloat(document.getElementById('da-tax')?.value) || 0;
    const h = document.getElementById('total-ht'), v = document.getElementById('total-tva'), c = document.getElementById('total-ttc');
    if (h) h.textContent = formatCurrency(ht); if (v) v.textContent = formatCurrency(ht * t / 100); if (c) c.textContent = formatCurrency(ht + ht * t / 100);
  }
  function collectLines() {
    const lines = []; document.querySelectorAll('#da-lines .line-row').forEach(row => {
      const catSel = row.querySelector('.line-cat'), pSel = row.querySelector('.line-prod');
      const prix = parseFloat(row.querySelector('.line-prix').value) || 0;
      if (pSel.value) {
        const cat = categories.find(c => c.id === catSel.value);
        const prod = produits.find(p => p.id === pSel.value);
        lines.push({ categorieId: catSel.value, categorieNom: cat?.nom || '', produitId: pSel.value, produitRef: prod?.reference || '', designation: prod?.reference || '', quantite: 1, prixUnitaire: prix, montant: prix });
      }
    }); return lines;
  }

  function viewDoc(d) {
    showModal(`Devis Achat - ${d.numero}`, `${printDocumentHeader(settings, 'DEVIS ACHAT', d.numero, d.date)}
      <div class="doc-info"><div class="doc-info-box"><p><strong>Fournisseur:</strong> ${d.fournisseurNom}</p></div><div class="doc-info-box"><p><strong>Date:</strong> ${formatDate(d.date)}</p></div></div>
      <table class="data-table"><thead><tr><th>Poteau</th><th>Prix HT</th></tr></thead><tbody>${(d.lignes || []).map(l => `<tr><td>${l.designation || l.produitRef || ''}</td><td>${formatCurrency(l.prixUnitaire)}</td></tr>`).join('')}</tbody></table>
      <div class="doc-totals"><div class="doc-total-row"><span>Total HT (${(d.lignes || []).length} poteaux):</span><span>${formatCurrency(d.totalHT)}</span></div><div class="doc-total-row"><span>TVA (${d.taxRate}%):</span><span>${formatCurrency(d.totalTVA)}</span></div><div class="doc-total-row grand-total"><span>Total TTC:</span><span>${formatCurrency(d.totalTTC)}</span></div></div>
      ${d.note ? `<p style="margin-top:12px;font-style:italic;color:var(--text-secondary)">${d.note}</p>` : ''}`,
      `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button><button class="btn btn-primary" onclick="window.print()">🖨️</button>`);
  }
  render();
}
