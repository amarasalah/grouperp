// Devis Vente Page - individual product, no qty (each poteau = 1)
import { getAll, add, update, remove, getSettings, getNextNumber } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatCurrency, formatDate, todayISO, printDocumentHeader } from '../utils/helpers.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';

export async function renderDevisVente() {
  const content = document.getElementById('page-content');
  let devis = await getAll('devis_vente').catch(() => []);
  const clients = await getAll('clients').catch(() => []);
  const produits = await getAll('produits').catch(() => []);
  const categories = await getAll('categories').catch(() => []);
  const settings = await getSettings();
  let currentPage = 1, currentFilters = {};

  function render(filters = currentFilters, page = currentPage) {
    currentFilters = filters; currentPage = page;
    const filtered = applyFilters(devis, { ...filters, searchFields: ['numero', 'clientNom'], statusField: 'statut' });
    const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));

    content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">📋 Devis Vente</h1><p class="page-subtitle">Devis clients</p></div>
        <button class="btn btn-primary" id="add-dv-btn">+ Nouveau Devis</button></div>
      ${filterBarHTML({ showStatus: true, statusOptions: ['Brouillon', 'Validé', 'Annulé'] })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Nb Poteaux</th><th>Total HT</th><th>Total TTC</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(d => `<tr><td><strong style="color:var(--accent)">${d.numero || ''}</strong></td><td>${formatDate(d.date)}</td><td>${d.clientNom || '-'}</td><td>${(d.lignes || []).length}</td><td>${formatCurrency(d.totalHT)}</td><td><strong>${formatCurrency(d.totalTTC)}</strong></td>
          <td><span class="badge ${d.statut === 'Validé' ? 'badge-success' : d.statut === 'Annulé' ? 'badge-danger' : 'badge-warning'}">${d.statut || 'Brouillon'}</span></td>
          <td class="actions"><button class="btn btn-sm btn-secondary view-dv" data-id="${d.id}">👁️</button><button class="btn btn-sm btn-secondary edit-dv" data-id="${d.id}">✏️</button>${d.statut !== 'Validé' ? `<button class="btn btn-sm btn-success convert-bc" data-id="${d.id}" title="→ BC">📦</button>` : ''}<button class="btn btn-sm btn-danger delete-dv" data-id="${d.id}">🗑️</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">📋</div><div class="title">Aucun devis vente</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;

    paginate(filtered, page, 'pagination-controls', p => render(filters, p));
    wireFilters((f, p) => render(f, p));
    document.getElementById('add-dv-btn').onclick = () => openForm();
    document.querySelectorAll('.edit-dv').forEach(b => b.onclick = () => { const d = devis.find(x => x.id === b.dataset.id); if (d) openForm(d); });
    document.querySelectorAll('.view-dv').forEach(b => b.onclick = () => { const d = devis.find(x => x.id === b.dataset.id); if (d) viewDoc(d); });
    document.querySelectorAll('.convert-bc').forEach(b => b.onclick = async () => {
      const d = devis.find(x => x.id === b.dataset.id);
      if (d && await confirmDialog('Convertir en BC Vente ?')) {
        const n = await getNextNumber('bcVentePrefix');
        await add('bc_vente', { numero: n, date: todayISO(), clientId: d.clientId, clientNom: d.clientNom, lignes: d.lignes, taxRate: d.taxRate, totalHT: d.totalHT, totalTVA: d.totalTVA, totalTTC: d.totalTTC, devisRef: d.numero, statut: 'En cours' });
        await update('devis_vente', d.id, { statut: 'Validé' }); d.statut = 'Validé'; render(); showToast(`BC Vente ${n} créé`);
      }
    });
    document.querySelectorAll('.delete-dv').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ?')) { await remove('devis_vente', b.dataset.id); devis = devis.filter(x => x.id !== b.dataset.id); render(); showToast('Supprimé'); } });
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
    showModal(isEdit ? 'Modifier Devis' : 'Nouveau Devis Vente', `<form id="dv-form">
      <div class="form-row"><div class="form-group"><label class="form-label">Client *</label><select class="form-select" name="clientId" required><option value="">--</option>${clients.map(c => `<option value="${c.id}" ${dv?.clientId === c.id ? 'selected' : ''}>${c.raisonSociale}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" name="date" value="${dv?.date || todayISO()}"/></div></div>
      <div class="form-group"><label class="form-label">TVA (%)</label><input class="form-input" type="number" name="taxRate" id="dv-tax" value="${taxRate}" style="max-width:150px"/></div>
      <h4 style="margin:16px 0 8px">Poteaux</h4>
      <div class="table-wrapper"><table class="data-table line-items-table"><thead><tr><th>Catégorie</th><th>Poteau (ID)</th><th>Prix HT</th><th></th></tr></thead><tbody id="dv-lines">${(dv?.lignes || [{}]).map(l => lineHtml(l)).join('')}</tbody></table></div>
      <button type="button" class="btn btn-secondary btn-sm" id="dv-add-line">+ Ajouter Poteau</button>
      <div class="form-group" style="margin-top:12px"><label class="form-label">Note</label><textarea class="form-input" name="note" rows="2">${dv?.note || ''}</textarea></div>
      <div class="doc-totals"><div class="doc-total-row"><span>Total HT:</span><span id="total-ht">0,000 DT</span></div><div class="doc-total-row"><span>TVA:</span><span id="total-tva">0,000 DT</span></div><div class="doc-total-row grand-total"><span>Total TTC:</span><span id="total-ttc">0,000 DT</span></div></div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-dv">${isEdit ? 'Modifier' : 'Créer'}</button>`);
    document.querySelector('.modal-container').style.maxWidth = '900px';
    wireAll();
    if (dv?.lignes) { setTimeout(() => { document.querySelectorAll('#dv-lines .line-row').forEach((row, i) => { const l = dv.lignes[i]; if (l?.categorieId) { row.querySelector('.line-cat').value = l.categorieId; populateProducts(row, l.categorieId, l.produitId); } }); recalcAll(); }, 100); }
    document.getElementById('dv-add-line').onclick = () => { document.getElementById('dv-lines').insertAdjacentHTML('beforeend', lineHtml()); wireAll(); };
    document.getElementById('dv-tax').oninput = () => recalcAll();
    document.getElementById('save-dv').onclick = async () => {
      const f = document.getElementById('dv-form'), cid = f.querySelector('[name="clientId"]').value;
      if (!cid) { showToast('Client requis', 'error'); return; }
      const cli = clients.find(x => x.id === cid), dt = f.querySelector('[name="date"]').value, tax = parseFloat(f.querySelector('[name="taxRate"]').value) || 0, lines = collectLines();
      if (!lines.length) { showToast('Ajoutez un poteau', 'error'); return; }
      const totalHT = lines.reduce((s, l) => s + l.montant, 0), totalTVA = totalHT * tax / 100;
      const data = { date: dt, clientId: cid, clientNom: cli?.raisonSociale || '', lignes: lines, taxRate: tax, totalHT, totalTVA, totalTTC: totalHT + totalTVA, statut: dv?.statut || 'Brouillon', note: f.querySelector('[name="note"]').value };
      if (isEdit) { await update('devis_vente', dv.id, data); Object.assign(dv, data); } else { data.numero = await getNextNumber('devisVentePrefix'); const id = await add('devis_vente', data); devis.unshift({ id, ...data }); }
      hideModal(); render(); showToast(isEdit ? 'Modifié' : 'Créé');
    };
  }

  function populateProducts(row, catId, selProdId) {
    const catProds = produits.filter(p => p.categorieId === catId).sort((a, b) => (a.numero || 0) - (b.numero || 0));
    row.querySelector('.line-prod').innerHTML = `<option value="">-- Produit --</option>${catProds.map(p => `<option value="${p.id}" data-ref="${p.reference}" data-prix="${p.prixVente || 0}" ${selProdId === p.id ? 'selected' : ''}>${p.reference}</option>`).join('')}`;
  }
  function wireAll() {
    document.querySelectorAll('#dv-lines .line-row').forEach(row => {
      row.querySelector('.line-cat').onchange = e => { populateProducts(row, e.target.value); recalcRow(row); };
      row.querySelector('.line-prod').onchange = () => recalcRow(row);
      row.querySelector('.line-prix').oninput = () => { row.querySelector('.line-prix').dataset.userEdited = 'true'; recalcRow(row); };
      row.querySelector('.remove-line').onclick = () => { if (document.getElementById('dv-lines').children.length > 1) row.remove(); recalcAll(); };
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
    let ht = 0; document.querySelectorAll('#dv-lines .line-row').forEach(r => { ht += parseFloat(r.querySelector('.line-prix').value) || 0; });
    const t = parseFloat(document.getElementById('dv-tax')?.value) || 0;
    document.getElementById('total-ht').textContent = formatCurrency(ht);
    document.getElementById('total-tva').textContent = formatCurrency(ht * t / 100);
    document.getElementById('total-ttc').textContent = formatCurrency(ht + ht * t / 100);
  }
  function collectLines() {
    const lines = []; document.querySelectorAll('#dv-lines .line-row').forEach(row => {
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
    showModal(`Devis Vente - ${d.numero}`, `${printDocumentHeader(settings, 'DEVIS VENTE', d.numero, d.date)}
      <div class="doc-info"><div class="doc-info-box"><p><strong>Client:</strong> ${d.clientNom}</p></div><div class="doc-info-box"><p><strong>Date:</strong> ${formatDate(d.date)}</p></div></div>
      <table class="data-table"><thead><tr><th>Poteau</th><th>Prix HT</th></tr></thead><tbody>${(d.lignes || []).map(l => `<tr><td>${l.designation || l.produitRef || ''}</td><td>${formatCurrency(l.prixUnitaire)}</td></tr>`).join('')}</tbody></table>
      <div class="doc-totals"><div class="doc-total-row"><span>Total HT (${(d.lignes || []).length} poteaux):</span><span>${formatCurrency(d.totalHT)}</span></div><div class="doc-total-row"><span>TVA (${d.taxRate}%):</span><span>${formatCurrency(d.totalTVA)}</span></div><div class="doc-total-row grand-total"><span>Total TTC:</span><span>${formatCurrency(d.totalTTC)}</span></div></div>`,
      `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button><button class="btn btn-primary" onclick="window.print()">🖨️</button>`);
  }
  render();
}
