// BC Vente Page - only products with validated BL Achat, prices from lot vente
import { getAll, add, update, remove, getSettings, getNextNumber, getReceivedProductIds, getVenteUsedProductIds } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatCurrency, formatDate, todayISO, printDocumentHeader } from '../utils/helpers.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';

export async function renderBcVente() {
  const content = document.getElementById('page-content');
  let bcs = await getAll('bc_vente').catch(() => []);
  const clients = await getAll('clients').catch(() => []);
  const produits = await getAll('produits').catch(() => []);
  const lots = await getAll('lots').catch(() => []);
  const settings = await getSettings();
  let currentPage = 1, currentFilters = {};

  function render(filters = currentFilters, page = currentPage) {
    currentFilters = filters; currentPage = page;
    const filtered = applyFilters(bcs, { ...filters, searchFields: ['numero', 'clientNom'], statusField: 'statut' });
    const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));
    content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">📦 Bon de Commande Vente</h1><p class="page-subtitle">Commandes clients — seuls les poteaux avec BL Achat validé</p></div>
        <button class="btn btn-primary" id="add-bcv-btn">+ Nouveau BC</button></div>
      ${filterBarHTML({ showStatus: true, statusOptions: ['En cours', 'Livré', 'Annulé'] })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>N° BC</th><th>Date</th><th>Client</th><th>Nb Poteaux</th><th>Total HT</th><th>Total TTC</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(b => `<tr><td><strong style="color:var(--accent)">${b.numero || ''}</strong></td><td>${formatDate(b.date)}</td><td>${b.clientNom || '-'}</td><td>${(b.lignes || []).length}</td><td>${formatCurrency(b.totalHT)}</td><td><strong>${formatCurrency(b.totalTTC)}</strong></td>
          <td><span class="badge ${b.statut === 'Livré' ? 'badge-success' : b.statut === 'Annulé' ? 'badge-danger' : 'badge-warning'}">${b.statut || 'En cours'}</span></td>
          <td class="actions"><button class="btn btn-sm btn-secondary view-bcv" data-id="${b.id}">👁️</button>${b.statut !== 'Livré' ? `<button class="btn btn-sm btn-success create-bl" data-id="${b.id}" title="→ BL">🚛</button>` : ''}<button class="btn btn-sm btn-danger delete-bcv" data-id="${b.id}">🗑️</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">📦</div><div class="title">Aucun BC vente</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;
    paginate(filtered, page, 'pagination-controls', p => render(filters, p));
    wireFilters((f, p) => render(f, p));
    document.getElementById('add-bcv-btn').onclick = () => openForm();
    document.querySelectorAll('.view-bcv').forEach(b => b.onclick = () => { const bc = bcs.find(x => x.id === b.dataset.id); if (bc) viewDoc(bc); });
    document.querySelectorAll('.create-bl').forEach(b => b.onclick = async () => {
      const bc = bcs.find(x => x.id === b.dataset.id);
      if (bc && await confirmDialog('Créer un BL Vente à partir de ce BC ?')) {
        const n = await getNextNumber('blVentePrefix');
        await add('bl_vente', { numero: n, date: todayISO(), clientId: bc.clientId, clientNom: bc.clientNom, lignes: bc.lignes, bcRef: bc.numero, totalHT: bc.totalHT || 0, fodec: bc.fodec || 0, baseTva: bc.baseTva || 0, totalTVA: bc.totalTVA || 0, dedTva: bc.dedTva || 0, dedRsIs: bc.dedRsIs || 0, totalTTC: bc.totalTTC || 0, statut: 'En attente', note: '' });
        await update('bc_vente', bc.id, { statut: 'Livré' }); bc.statut = 'Livré'; render(); showToast(`BL Vente ${n} créé`);
      }
    });
    document.querySelectorAll('.delete-bcv').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ?')) { await remove('bc_vente', b.dataset.id); bcs = bcs.filter(x => x.id !== b.dataset.id); render(); showToast('Supprimé'); } });
  }

  async function openForm() {
    // Get products that have validated BL Achat
    const receivedIds = await getReceivedProductIds();
    // Get products already used in vente documents
    const venteUsedIds = await getVenteUsedProductIds();
    const taxRate = settings.taxRate || 19;

    // Available = received AND not yet used in any vente doc
    const available = produits.filter(p => receivedIds.has(p.id) && !venteUsedIds.has(p.id)).sort((a, b) => (a.lotNumero || '').localeCompare(b.lotNumero || '') || (a.numero || 0) - (b.numero || 0));

    // Build lot options for filter
    const lotIds = [...new Set(available.map(p => p.lotId).filter(Boolean))];
    const lotOptions = lotIds.map(lid => { const l = lots.find(x => x.id === lid); return l ? `<option value="${l.id}">${l.numero}</option>` : ''; }).join('');
    // Build category options for filter
    const catIds = [...new Set(available.map(p => p.categorieId).filter(Boolean))];
    const categories = await getAll('categories').catch(() => []);
    const catOptions = catIds.map(cid => { const c = categories.find(x => x.id === cid); return c ? `<option value="${c.id}">${c.nom}</option>` : ''; }).join('');

    showModal('Nouveau BC Vente', `<form id="bcv-form">
      <div class="form-row"><div class="form-group"><label class="form-label">Client *</label><select class="form-select" name="clientId" required><option value="">--</option>${clients.map(c => `<option value="${c.id}">${c.raisonSociale}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" name="date" value="${todayISO()}"/></div></div>
      <h4 style="margin:16px 0 8px">Poteaux disponibles <small style="color:var(--text-muted)">(BL Achat validé, non utilisés en vente) — ${available.length} poteau(x)</small></h4>
      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
        <input class="form-input" type="text" id="bcv-search" placeholder="🔍 Rechercher par référence..." style="flex:1;min-width:150px"/>
        <select class="form-select" id="bcv-lot-filter" style="min-width:140px"><option value="">Tous les lots</option>${lotOptions}</select>
        <select class="form-select" id="bcv-cat-filter" style="min-width:140px"><option value="">Toutes catégories</option>${catOptions}</select>
        <span id="bcv-filter-count" style="font-size:0.82rem;color:var(--text-muted)"></span>
      </div>
      <div class="table-wrapper" style="max-height:350px;overflow-y:auto"><table class="data-table"><thead><tr><th style="width:30px"><input type="checkbox" id="bcv-select-all" title="Tout sélectionner"/></th><th>ID Poteau</th><th>Lot</th><th>Catégorie</th><th>Prix Vente</th></tr></thead><tbody id="bcv-lines">
        ${available.length ? available.map(p => {
          const lot = lots.find(l => l.id === p.lotId);
          const catPrix = (lot?.prixParCategorie || []).find(cp => cp.categorieId === p.categorieId);
          const prix = catPrix?.prixVente || p.prixVente || 0;
          return `<tr data-prod="${p.id}" data-prix="${prix}" data-ref="${(p.reference || '').toLowerCase()}" data-lot="${p.lotId || ''}" data-cat="${p.categorieId || ''}">
            <td><input type="checkbox" class="line-check"/></td>
            <td><strong style="color:var(--accent)">${p.reference}</strong></td>
            <td><span class="badge badge-warning">${p.lotNumero || '-'}</span></td>
            <td>${p.categorieNom || '-'}</td>
            <td>${formatCurrency(prix)}</td>
          </tr>`;
        }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Aucun poteau disponible (BL Achat validé requis)</td></tr>'}
      </tbody></table></div>
      <div class="form-group" style="margin-top:12px"><label class="form-label">Note</label><textarea class="form-input" name="note" rows="2"></textarea></div>
      <div class="doc-totals">
        <div class="doc-total-row"><span>Total HT:</span><span id="total-ht">0,000 DT</span></div>
        <div class="doc-total-row"><span>Fodec (1%):</span><span id="total-fodec">0,000 DT</span></div>
        <div class="doc-total-row"><span>Base TVA:</span><span id="base-tva">0,000 DT</span></div>
        <div class="doc-total-row"><span>TVA (19%):</span><span id="total-tva">0,000 DT</span></div>
        <div class="doc-total-row"><span>Déduction TVA 25%:</span><span id="ded-tva" style="color:var(--danger)">0,000 DT</span></div>
        <div class="doc-total-row"><span>Déduction RS/IS 1%:</span><span id="ded-rsis" style="color:var(--danger)">0,000 DT</span></div>
        <div class="doc-total-row grand-total"><span>Net à Payer:</span><span id="total-ttc">0,000 DT</span></div>
      </div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-bcv">Créer</button>`);
    document.querySelector('.modal-container').style.maxWidth = '900px';

    // Wire search, filters, select all
    const searchInput = document.getElementById('bcv-search');
    const lotFilter = document.getElementById('bcv-lot-filter');
    const catFilter = document.getElementById('bcv-cat-filter');
    const selectAll = document.getElementById('bcv-select-all');

    function filterRows() {
      const q = (searchInput?.value || '').toLowerCase().trim();
      const lotVal = lotFilter?.value || '';
      const catVal = catFilter?.value || '';
      let visible = 0;
      document.querySelectorAll('#bcv-lines tr[data-prod]').forEach(r => {
        const matchRef = !q || r.dataset.ref.includes(q);
        const matchLot = !lotVal || r.dataset.lot === lotVal;
        const matchCat = !catVal || r.dataset.cat === catVal;
        const show = matchRef && matchLot && matchCat;
        r.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      const countEl = document.getElementById('bcv-filter-count');
      if (countEl) countEl.textContent = `${visible} affiché(s)`;
    }
    if (searchInput) searchInput.oninput = filterRows;
    if (lotFilter) lotFilter.onchange = filterRows;
    if (catFilter) catFilter.onchange = filterRows;

    if (selectAll) selectAll.onchange = () => {
      document.querySelectorAll('#bcv-lines tr[data-prod]').forEach(r => {
        if (r.style.display !== 'none') {
          const cb = r.querySelector('.line-check');
          if (cb) cb.checked = selectAll.checked;
        }
      });
      recalcTotals();
    };

    document.querySelectorAll('#bcv-lines .line-check').forEach(cb => cb.onchange = () => recalcTotals());

    function recalcTotals() {
      let ht = 0;
      document.querySelectorAll('#bcv-lines tr[data-prod]').forEach(r => {
        if (r.querySelector('.line-check')?.checked) ht += parseFloat(r.dataset.prix) || 0;
      });
      const fodec = ht * 0.01;
      const baseTva = ht + fodec;
      const tva = baseTva * 0.19;
      const dedTva = tva * 0.25;
      const dedRsIs = (ht + fodec + tva) * 0.01;
      const net = ht + fodec + tva - dedTva - dedRsIs;
      document.getElementById('total-ht').textContent = formatCurrency(ht);
      document.getElementById('total-fodec').textContent = formatCurrency(fodec);
      document.getElementById('base-tva').textContent = formatCurrency(baseTva);
      document.getElementById('total-tva').textContent = formatCurrency(tva);
      document.getElementById('ded-tva').textContent = '-' + formatCurrency(dedTva);
      document.getElementById('ded-rsis').textContent = '-' + formatCurrency(dedRsIs);
      document.getElementById('total-ttc').textContent = formatCurrency(net);
    }

    document.getElementById('save-bcv').onclick = async () => {
      const f = document.getElementById('bcv-form');
      const cid = f.querySelector('[name="clientId"]').value;
      if (!cid) { showToast('Client requis', 'error'); return; }
      const cl = clients.find(x => x.id === cid);
      const dt = f.querySelector('[name="date"]').value;
      const note = f.querySelector('[name="note"]').value;

      const lines = [];
      document.querySelectorAll('#bcv-lines tr[data-prod]').forEach(r => {
        if (!r.querySelector('.line-check')?.checked) return;
        const prodId = r.dataset.prod;
        const prix = parseFloat(r.dataset.prix) || 0;
        const prod = produits.find(p => p.id === prodId);
        lines.push({
          categorieId: prod?.categorieId || '', categorieNom: prod?.categorieNom || '',
          produitId: prodId, produitRef: prod?.reference || '', designation: prod?.reference || '',
          lotId: prod?.lotId || '', lotNumero: prod?.lotNumero || '',
          quantite: 1, prixUnitaire: prix, montant: prix
        });
      });
      if (!lines.length) { showToast('Sélectionnez au moins un poteau', 'error'); return; }

      const totalHT = lines.reduce((s, l) => s + l.montant, 0);
      const fodec = totalHT * 0.01;
      const baseTva = totalHT + fodec;
      const totalTVA = baseTva * 0.19;
      const dedTva = totalTVA * 0.25;
      const dedRsIs = (totalHT + fodec + totalTVA) * 0.01;
      const totalTTC = totalHT + fodec + totalTVA - dedTva - dedRsIs;
      const numero = await getNextNumber('bcVentePrefix');
      const data = { numero, date: dt, clientId: cid, clientNom: cl?.raisonSociale || '', lignes: lines, totalHT, fodec, baseTva, totalTVA, dedTva, dedRsIs, totalTTC, statut: 'En cours', note };
      const id = await add('bc_vente', data);
      bcs.unshift({ id, ...data });
      hideModal(); render(); showToast(`BC Vente ${numero} créé (${lines.length} poteaux)`);
    };
  }

  function viewDoc(b) {
    // Recompute taxes for older records that may not have them stored
    const ht = b.totalHT || 0;
    const fodec = b.fodec ?? ht * 0.01;
    const baseTva = b.baseTva ?? (ht + fodec);
    const tva = b.totalTVA ?? baseTva * 0.19;
    const dedTva = b.dedTva ?? tva * 0.25;
    const dedRsIs = b.dedRsIs ?? (ht + fodec + tva) * 0.01;
    const net = b.totalTTC ?? (ht + fodec + tva - dedTva - dedRsIs);

    showModal(`BC Vente - ${b.numero}`, `${printDocumentHeader(settings, 'BON DE COMMANDE VENTE', b.numero, b.date)}
      <div class="doc-info"><div class="doc-info-box"><p><strong>Client:</strong> ${b.clientNom}</p></div><div class="doc-info-box"><p><strong>Statut:</strong> ${b.statut}</p></div></div>
      <table class="data-table"><thead><tr><th>#</th><th>Référence</th><th>Désignation</th><th>Prix HT</th></tr></thead><tbody>${(b.lignes || []).map((l, i) => `<tr><td>${i + 1}</td><td>${l.produitRef || '-'}</td><td>${l.designation || l.categorieNom || '-'}</td><td>${formatCurrency(l.prixUnitaire)}</td></tr>`).join('')}</tbody></table>
      <div class="doc-totals" style="margin-top:12px">
        <div class="doc-total-row"><span>Total HT (${(b.lignes || []).length} poteaux):</span><span>${formatCurrency(ht)}</span></div>
        <div class="doc-total-row"><span>Fodec (1%):</span><span>${formatCurrency(fodec)}</span></div>
        <div class="doc-total-row"><span>Base TVA:</span><span>${formatCurrency(baseTva)}</span></div>
        <div class="doc-total-row"><span>TVA (19%):</span><span>${formatCurrency(tva)}</span></div>
        <div class="doc-total-row"><span>Déduction TVA 25%:</span><span style="color:var(--danger)">-${formatCurrency(dedTva)}</span></div>
        <div class="doc-total-row"><span>Déduction RS/IS 1%:</span><span style="color:var(--danger)">-${formatCurrency(dedRsIs)}</span></div>
        <div class="doc-total-row grand-total"><span>Net à Payer:</span><span>${formatCurrency(net)}</span></div>
      </div>`,
      `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button><button class="btn btn-primary" onclick="window.print()">🖨️</button>`);
  }
  render();
}
