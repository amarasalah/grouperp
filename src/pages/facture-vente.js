// Facture Vente Page - partial BL invoicing with editable quantities
import { getAll, add, update, remove, getSettings, getNextNumber, getFacturedQtyMap, deleteFactureWithReglements } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatCurrency, formatDate, todayISO, numberToWords, printDocumentHeader } from '../utils/helpers.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';

export async function renderFactureVente() {
  const content = document.getElementById('page-content');
  let factures = await getAll('factures_vente').catch(() => []);
  const clients = await getAll('clients').catch(() => []);
  const bls = await getAll('bl_vente').catch(() => []);
  const produits = await getAll('produits').catch(() => []);
  const settings = await getSettings();

  let currentPage = 1, currentFilters = {};

  function render(filters = currentFilters, page = currentPage) {
    currentFilters = filters; currentPage = page;
    const filtered = applyFilters(factures, { ...filters, statusField: 'regle', searchFields: ['numero', 'clientNom'] });
    const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));

    content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">🧾 Facture Vente</h1><p class="page-subtitle">Factures clients (multi-BL, quantités modifiables)</p></div>
        <button class="btn btn-primary" id="add-fv-btn">+ Nouvelle Facture</button></div>
      ${filterBarHTML({ showStatus: true, statusOptions: ['Oui', 'Non'] })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>BL Réf.</th><th>Total HT</th><th>TVA</th><th>Total TTC</th><th>Réglé</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(f => `<tr><td><strong style="color:var(--accent)">${f.numero || ''}</strong></td><td>${formatDate(f.date)}</td><td>${f.clientNom || '-'}</td>
          <td>${(f.blRefs || []).join(', ') || '-'}</td><td>${formatCurrency(f.totalHT)}</td><td>${formatCurrency(f.totalTVA)}</td><td><strong>${formatCurrency(f.totalTTC)}</strong></td>
          <td><span class="badge ${f.regle ? 'badge-success' : 'badge-warning'}">${f.regle ? 'Oui' : 'Non'}</span></td>
          <td class="actions"><button class="btn btn-sm btn-secondary view-fv" data-id="${f.id}">👁️</button><button class="btn btn-sm btn-danger delete-fv" data-id="${f.id}">🗑️</button></td></tr>`).join('')}
      </tbody></table></div>`: `<div class="empty-state"><div class="icon">🧾</div><div class="title">Aucune facture vente</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;

    paginate(filtered, page, 'pagination-controls', p => render(filters, p));
    wireFilters((f, p) => render(f, p));
    document.getElementById('add-fv-btn').onclick = () => openForm();
    document.querySelectorAll('.view-fv').forEach(b => b.onclick = () => { const f = factures.find(x => x.id === b.dataset.id); if (f) viewFacture(f); });
    document.querySelectorAll('.delete-fv').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer la facture et ses règlements ?')) { const n = await deleteFactureWithReglements('factures_vente', b.dataset.id); factures = factures.filter(x => x.id !== b.dataset.id); render(); showToast(`Supprimée (${n} règlement(s) supprimé(s))`); } });
  }

  async function openForm() {
    const facturedMap = await getFacturedQtyMap('factures_vente');
    const availBls = bls.filter(b => b.statut === 'Livré');
    const tax = settings.taxRate || 19;

    showModal('Nouvelle Facture Vente', `<form id="fv-form">
      <div class="form-row"><div class="form-group"><label class="form-label">Client *</label><select class="form-select" name="clientId" id="fv-client" required><option value="">--</option>${clients.map(c => `<option value="${c.id}">${c.raisonSociale}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" name="date" value="${todayISO()}"/></div></div>
      <div class="form-group"><label class="form-label">TVA (%)</label><input class="form-input" type="number" name="taxRate" id="fv-tax" value="${tax}" style="max-width:150px"/></div>
      <div class="form-group"><label class="form-label">Sélectionner les BL à facturer</label>
        <div class="checkbox-list" id="bl-checks">${availBls.map(b => `<label class="checkbox-item"><input type="checkbox" value="${b.id}" data-client="${b.clientId}" class="bl-chk"/>${b.numero} - ${b.clientNom} (${formatDate(b.date)})</label>`).join('')}
          ${!availBls.length ? '<p style="color:var(--text-muted);padding:8px">Aucun BL livré disponible</p>' : ''}</div></div>
      <h4 style="margin:16px 0 8px">Lignes (quantités modifiables)</h4>
      <div class="table-wrapper"><table class="data-table line-items-table"><thead><tr><th>Désignation</th><th>Qté BL</th><th>Déjà facturé</th><th>Qté à facturer</th><th>Prix HT</th><th>Montant</th></tr></thead><tbody id="fv-lines"><tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Sélectionnez des BL</td></tr></tbody></table></div>
      <div class="form-group" style="margin-top:12px"><label class="form-label">Note</label><textarea class="form-input" name="note" rows="2" placeholder="Note ou observation..."></textarea></div>
      <div class="doc-totals"><div class="doc-total-row"><span>Total HT:</span><span id="total-ht">0,000 DT</span></div><div class="doc-total-row"><span>TVA:</span><span id="total-tva">0,000 DT</span></div><div class="doc-total-row grand-total"><span>Total TTC:</span><span id="total-ttc">0,000 DT</span></div></div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-fv">Créer</button>`);
    document.querySelector('.modal-container').style.maxWidth = '950px';

    document.getElementById('fv-client').onchange = () => {
      const cid = document.getElementById('fv-client').value;
      document.querySelectorAll('.bl-chk').forEach(cb => { cb.closest('.checkbox-item').style.display = (!cid || cb.dataset.client === cid) ? '' : 'none'; cb.checked = false; });
      rebuildLines();
    };
    document.querySelectorAll('.bl-chk').forEach(cb => cb.onchange = () => rebuildLines());
    document.getElementById('fv-tax').oninput = () => recalc();

    function rebuildLines() {
      const checked = [...document.querySelectorAll('.bl-chk:checked')];
      const tbody = document.getElementById('fv-lines');
      if (!checked.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Sélectionnez des BL</td></tr>'; recalc(); return; }
      let html = '';
      checked.forEach(cb => {
        const bl = bls.find(b => b.id === cb.value); if (!bl) return;
        const blFactured = facturedMap[bl.id] || {};
        (bl.lignes || []).forEach((l, idx) => {
          const p = produits.find(x => x.id === l.produitId);
          const prix = l.prixUnitaire || (p?.prixVente || 0);
          const qtyBl = l.quantite || 0;
          const alreadyFactured = blFactured[idx] || 0;
          const remaining = Math.max(0, qtyBl - alreadyFactured);
          if (remaining <= 0) return;
          html += `<tr data-bl="${bl.id}" data-line="${idx}" data-max="${remaining}">
                      <td>${l.designation || ''} <small style="color:var(--text-muted)">(${bl.numero})</small></td>
                      <td style="text-align:center">${qtyBl}</td>
                      <td style="text-align:center;color:var(--warning)">${alreadyFactured > 0 ? alreadyFactured : '-'}</td>
                      <td><input class="form-input line-qty" type="number" min="0" max="${remaining}" value="${remaining}" style="width:80px"/></td>
                      <td><input class="form-input line-prix" type="number" step="0.001" value="${prix}" style="width:100px"/></td>
                      <td class="line-montant">${formatCurrency(remaining * prix)}</td></tr>`;
        });
      });
      if (!html) html = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Toutes les lignes sont déjà facturées</td></tr>';
      tbody.innerHTML = html;
      document.querySelectorAll('#fv-lines .line-qty, #fv-lines .line-prix').forEach(i => i.oninput = () => recalc());
      recalc();
    }

    function recalc() {
      let ht = 0;
      document.querySelectorAll('#fv-lines tr[data-bl]').forEach(r => {
        const q = parseFloat(r.querySelector('.line-qty')?.value) || 0;
        const p = parseFloat(r.querySelector('.line-prix')?.value) || 0;
        ht += q * p;
        const m = r.querySelector('.line-montant'); if (m) m.textContent = formatCurrency(q * p);
      });
      const t = parseFloat(document.getElementById('fv-tax')?.value) || 0;
      const h = document.getElementById('total-ht'), v = document.getElementById('total-tva'), c = document.getElementById('total-ttc');
      if (h) h.textContent = formatCurrency(ht); if (v) v.textContent = formatCurrency(ht * t / 100); if (c) c.textContent = formatCurrency(ht + ht * t / 100);
    }

    document.getElementById('save-fv').onclick = async () => {
      const cid = document.getElementById('fv-client').value;
      if (!cid) { showToast('Client requis', 'error'); return; }
      const cl = clients.find(x => x.id === cid);
      const dt = document.querySelector('[name="date"]').value;
      const tax = parseFloat(document.getElementById('fv-tax').value) || 0;

      const allLines = [], blAllocations = [], blRefsSet = new Set();
      document.querySelectorAll('#fv-lines tr[data-bl]').forEach(r => {
        const qty = parseFloat(r.querySelector('.line-qty')?.value) || 0;
        const prix = parseFloat(r.querySelector('.line-prix')?.value) || 0;
        if (qty <= 0) return;
        const blId = r.dataset.bl, lineIdx = parseInt(r.dataset.line);
        const maxQty = parseFloat(r.dataset.max) || 0;
        if (qty > maxQty) { showToast(`Quantité dépasse le restant (${maxQty})`, 'error'); return; }
        const bl = bls.find(b => b.id === blId);
        const line = bl?.lignes?.[lineIdx] || {};
        blRefsSet.add(bl?.numero || blId);
        allLines.push({ ...line, quantite: qty, prixUnitaire: prix, montant: qty * prix, blId, blLineIdx: lineIdx });
        blAllocations.push({ blId, lineIdx, qty });
      });
      if (!allLines.length) { showToast('Aucune ligne à facturer', 'error'); return; }

      const blRefs = [...blRefsSet];
      const totalHT = allLines.reduce((s, l) => s + l.montant, 0), totalTVA = totalHT * tax / 100;
      const n = await getNextNumber('factureVentePrefix');
      try {
        const note = document.querySelector('[name="note"]').value;
        const id = await add('factures_vente', { numero: n, date: dt, clientId: cid, clientNom: cl?.raisonSociale || '', blRefs, blIds: [...new Set(allLines.map(l => l.blId))], blAllocations, lignes: allLines, taxRate: tax, totalHT, totalTVA, totalTTC: totalHT + totalTVA, regle: false, note });
        factures.unshift({ id, numero: n, date: dt, clientId: cid, clientNom: cl?.raisonSociale || '', blRefs, blAllocations, lignes: allLines, taxRate: tax, totalHT, totalTVA, totalTTC: totalHT + totalTVA, regle: false, note });
        hideModal(); render(); showToast(`Facture ${n} créée`);
      } catch (err) { showToast('Erreur: ' + err.message, 'error'); }
    };
  }

  function viewFacture(f) {
    showModal(`Facture Vente - ${f.numero}`, `${printDocumentHeader(settings, 'FACTURE VENTE', f.numero, f.date)}
      <div class="doc-info"><div class="doc-info-box"><p><strong>Client:</strong> ${f.clientNom}</p></div><div class="doc-info-box"><p><strong>BL:</strong> ${(f.blRefs || []).join(', ')}</p></div></div>
      <table class="data-table"><thead><tr><th>Désignation</th><th>Qté</th><th>Prix HT</th><th>Montant</th></tr></thead><tbody>${(f.lignes || []).map(l => `<tr><td>${l.designation}</td><td>${l.quantite}</td><td>${formatCurrency(l.prixUnitaire)}</td><td>${formatCurrency(l.montant)}</td></tr>`).join('')}</tbody></table>
      <div class="doc-totals"><div class="doc-total-row"><span>Total HT:</span><span>${formatCurrency(f.totalHT)}</span></div><div class="doc-total-row"><span>TVA (${f.taxRate}%):</span><span>${formatCurrency(f.totalTVA)}</span></div><div class="doc-total-row grand-total"><span>Total TTC:</span><span>${formatCurrency(f.totalTTC)}</span></div></div>
      <p style="margin-top:12px;font-size:0.85rem;font-style:italic;color:var(--text-secondary)">Arrêté à: <strong>${numberToWords(f.totalTTC)}</strong></p>`,
      `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button><button class="btn btn-primary" onclick="window.print()">🖨️</button>`);
  }
  render();
}
