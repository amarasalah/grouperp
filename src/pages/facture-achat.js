// Facture Achat Page - per-category pricing, products from BL Achat
import { getAll, add, update, remove, getSettings, getNextNumber, deleteFactureWithReglements } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatCurrency, formatDate, todayISO, numberToWords, printDocumentHeader } from '../utils/helpers.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';
import { hasPermission } from '../data/auth.js';

export async function renderFactureAchat() {
  const content = document.getElementById('page-content');
  let factures = await getAll('factures_achat').catch(() => []);
  const fournisseurs = await getAll('fournisseurs').catch(() => []);
  const bls = await getAll('bl_achat').catch(() => []);
  const produits = await getAll('produits').catch(() => []);
  const types = await getAll('types').catch(() => []);
  const settings = await getSettings();

  // Build set of already-invoiced product IDs (from existing factures_achat)
  const invoicedProdIds = new Set();
  factures.forEach(f => { (f.lignes || []).forEach(l => { if (l.produitId) invoicedProdIds.add(l.produitId); }); });

  let currentPage = 1, currentFilters = {};

  const canCreate = hasPermission('facture_achat', 'create');
  const canDelete = hasPermission('facture_achat', 'delete');

  function render(filters = currentFilters, page = currentPage) {
    currentFilters = filters; currentPage = page;
    const filtered = applyFilters(factures, { ...filters, statusField: 'regle', searchFields: ['numero', 'fournisseurNom'] });
    const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));

    content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">🧾 Facture Achat</h1><p class="page-subtitle">Factures fournisseurs — prix fixé par catégorie</p></div>
        ${canCreate ? '<button class="btn btn-primary" id="add-fa-btn">+ Nouvelle Facture</button>' : ''}</div>
      ${filterBarHTML({ showStatus: true, statusOptions: ['Oui', 'Non'] })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>N°</th><th>Date</th><th>Fournisseur</th><th>BL Réf.</th><th>Nb Poteaux</th><th>Total HT</th><th>Total TTC</th><th>Réglé</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(f => `<tr><td><strong style="color:var(--accent)">${f.numero || ''}</strong></td><td>${formatDate(f.date)}</td><td>${f.fournisseurNom || '-'}</td>
          <td>${(f.blRefs || []).join(', ') || '-'}</td><td>${(f.lignes || []).length}</td><td>${formatCurrency(f.totalHT)}</td><td><strong>${formatCurrency(f.totalTTC)}</strong></td>
          <td><span class="badge ${f.regle ? 'badge-success' : 'badge-warning'}">${f.regle ? 'Oui' : 'Non'}</span></td>
          <td class="actions"><button class="btn btn-sm btn-secondary view-fa" data-id="${f.id}">👁️</button>${canDelete ? `<button class="btn btn-sm btn-danger delete-fa" data-id="${f.id}">🗑️</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">🧾</div><div class="title">Aucune facture achat</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;

    paginate(filtered, page, 'pagination-controls', p => render(filters, p));
    wireFilters((f, p) => render(f, p));
    document.getElementById('add-fa-btn')?.addEventListener('click', () => openForm());
    document.querySelectorAll('.view-fa').forEach(b => b.onclick = () => { const f = factures.find(x => x.id === b.dataset.id); if (f) viewFacture(f); });
    document.querySelectorAll('.delete-fa').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer la facture et ses règlements ?')) { const n = await deleteFactureWithReglements('factures_achat', b.dataset.id); factures = factures.filter(x => x.id !== b.dataset.id); render(); showToast(`Supprimée (${n} règlement(s) supprimé(s))`); } });
  }

  function openForm() {
    const availBls = bls.filter(b => b.statut === 'Réceptionné');
    const taxRate = settings.taxRate || 19;

    showModal('Nouvelle Facture Achat', `<form id="fa-form">
      <div class="form-row"><div class="form-group"><label class="form-label">Fournisseur *</label><select class="form-select" name="fournisseurId" id="fa-four" required><option value="">--</option>${fournisseurs.map(f => `<option value="${f.id}">${f.raisonSociale}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" name="date" value="${todayISO()}"/></div></div>
      <div class="form-group"><label class="form-label">TVA (%)</label><input class="form-input" type="number" name="taxRate" id="fa-tax" value="${taxRate}" style="max-width:150px"/></div>
      <div class="form-group"><label class="form-label">Sélectionner les BL à facturer</label>
        <div class="checkbox-list" id="bl-checkboxes">${availBls.map(b => `<label class="checkbox-item"><input type="checkbox" value="${b.id}" data-four="${b.fournisseurId}" class="bl-check"/>${b.numero} - ${b.fournisseurNom} (${formatDate(b.date)})</label>`).join('')}
          ${!availBls.length ? '<p style="color:var(--text-muted);padding:8px">Aucun BL réceptionné disponible</p>' : ''}</div></div>
      <h4 style="margin:16px 0 8px">Prix par Catégorie</h4>
      <div id="fa-cat-pricing" style="margin-bottom:12px;"><p style="color:var(--text-muted);font-size:0.85rem;">Sélectionnez des BL ci-dessus</p></div>
      <h4 style="margin:8px 0">Poteaux inclus <small style="color:var(--text-muted)">(déjà facturés exclus)</small></h4>
      <div class="table-wrapper" style="max-height:250px;overflow-y:auto;"><table class="data-table"><thead><tr><th>Poteau</th><th>Catégorie</th><th>BL</th></tr></thead><tbody id="fa-lines"><tr><td colspan="3" style="text-align:center;color:var(--text-muted)">Sélectionnez des BL</td></tr></tbody></table></div>
      <div class="form-group" style="margin-top:12px"><label class="form-label">Note</label><textarea class="form-input" name="note" rows="2"></textarea></div>
      <div class="doc-totals"><div class="doc-total-row"><span>Total HT:</span><span id="total-ht">0,000 DT</span></div><div class="doc-total-row"><span>TVA:</span><span id="total-tva">0,000 DT</span></div><div class="doc-total-row grand-total"><span>Total TTC:</span><span id="total-ttc">0,000 DT</span></div></div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-fa">Créer</button>`);
    document.querySelector('.modal-container').style.maxWidth = '900px';

    let selectedProds = []; // {produitId, typeId, typeNom, produitRef, blId, blNumero}

    document.getElementById('fa-four').onchange = () => {
      const fid = document.getElementById('fa-four').value;
      document.querySelectorAll('.bl-check').forEach(cb => { cb.closest('.checkbox-item').style.display = (!fid || cb.dataset.four === fid) ? '' : 'none'; cb.checked = false; });
      rebuildLines();
    };
    document.querySelectorAll('.bl-check').forEach(cb => cb.onchange = () => rebuildLines());
    document.getElementById('fa-tax').oninput = () => recalcTotals();

    function rebuildLines() {
      const checked = [...document.querySelectorAll('.bl-check:checked')];
      selectedProds = [];
      checked.forEach(cb => {
        const bl = bls.find(b => b.id === cb.value); if (!bl) return;
        (bl.lignes || []).forEach(l => {
          const pid = l.produitId;
          if (!pid || invoicedProdIds.has(pid)) return;
          const p = produits.find(x => x.id === pid);
          selectedProds.push({
            produitId: pid,
            typeId: l.typeId || p?.typeId || '',
            typeNom: l.typeNom || p?.typeNom || '',
            produitRef: l.produitRef || p?.reference || pid,
            blId: bl.id,
            blNumero: bl.numero
          });
        });
      });

      // Product list
      const tbody = document.getElementById('fa-lines');
      if (!selectedProds.length) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">Aucun poteau non-facturé trouvé</td></tr>';
      } else {
        tbody.innerHTML = selectedProds.map(p =>
          `<tr><td><strong style="color:var(--accent)">${p.produitRef}</strong></td><td>${p.typeNom || '-'}</td><td><small style="color:var(--text-muted)">${p.blNumero}</small></td></tr>`
        ).join('');
      }

      // Category pricing: group by category
      const catGroups = {};
      selectedProds.forEach(p => {
        if (!catGroups[p.typeId]) catGroups[p.typeId] = { nom: p.typeNom, count: 0 };
        catGroups[p.typeId].count++;
      });

      const pricingDiv = document.getElementById('fa-cat-pricing');
      if (Object.keys(catGroups).length === 0) {
        pricingDiv.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Aucune catégorie</p>';
      } else {
        pricingDiv.innerHTML = `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Catégorie</th><th>Nb Poteaux</th><th>Prix Unitaire HT</th><th>Sous-total HT</th></tr></thead><tbody>
          ${Object.entries(catGroups).map(([catId, g]) =>
            `<tr><td><strong style="color:var(--accent)">${g.nom || '-'}</strong></td>
             <td>${g.count}</td>
             <td><input class="form-input cat-prix" data-cat="${catId}" type="number" step="0.001" min="0" value="0" style="width:120px;"/></td>
             <td class="cat-subtotal" data-cat="${catId}" style="font-weight:600;">0,000 DT</td></tr>`
          ).join('')}
        </tbody></table></div>`;
        // Wire price inputs
        document.querySelectorAll('.cat-prix').forEach(inp => {
          inp.oninput = () => recalcTotals();
        });
      }
      recalcTotals();
    }

    function recalcTotals() {
      let ht = 0;
      const catGroups = {};
      selectedProds.forEach(p => {
        if (!catGroups[p.typeId]) catGroups[p.typeId] = 0;
        catGroups[p.typeId]++;
      });
      Object.entries(catGroups).forEach(([catId, count]) => {
        const prix = parseFloat(document.querySelector(`.cat-prix[data-cat="${catId}"]`)?.value) || 0;
        const sub = prix * count;
        const subtotalEl = document.querySelector(`.cat-subtotal[data-cat="${catId}"]`);
        if (subtotalEl) subtotalEl.textContent = formatCurrency(sub);
        ht += sub;
      });
      const tax = parseFloat(document.getElementById('fa-tax')?.value) || 0;
      document.getElementById('total-ht').textContent = formatCurrency(ht);
      document.getElementById('total-tva').textContent = formatCurrency(ht * tax / 100);
      document.getElementById('total-ttc').textContent = formatCurrency(ht + ht * tax / 100);
    }

    document.getElementById('save-fa').onclick = async () => {
      const fid = document.getElementById('fa-four').value;
      if (!fid) { showToast('Fournisseur requis', 'error'); return; }
      if (!selectedProds.length) { showToast('Aucun poteau sélectionné', 'error'); return; }
      const four = fournisseurs.find(x => x.id === fid);
      const dt = document.querySelector('[name="date"]').value;
      const tax = parseFloat(document.getElementById('fa-tax').value) || 0;

      // Collect per-category prices
      const catPrices = {};
      document.querySelectorAll('.cat-prix').forEach(inp => {
        catPrices[inp.dataset.cat] = parseFloat(inp.value) || 0;
      });

      // Build lines with category price applied
      const lignes = selectedProds.map(p => {
        const prix = catPrices[p.typeId] || 0;
        return {
          typeId: p.typeId, typeNom: p.typeNom,
          produitId: p.produitId, produitRef: p.produitRef,
          designation: p.produitRef, quantite: 1,
          prixUnitaire: prix, montant: prix,
          blId: p.blId
        };
      });

      const blRefs = [...new Set(selectedProds.map(p => p.blNumero))];
      const totalHT = lignes.reduce((s, l) => s + l.montant, 0);
      const totalTVA = totalHT * tax / 100;
      const n = await getNextNumber('factureAchatPrefix');
      try {
        const note = document.querySelector('[name="note"]').value;
        const data = {
          numero: n, date: dt, fournisseurId: fid, fournisseurNom: four?.raisonSociale || '',
          blRefs, lignes, catPrices,
          taxRate: tax, totalHT, totalTVA, totalTTC: totalHT + totalTVA,
          regle: false, note
        };
        const id = await add('factures_achat', data);
        factures.unshift({ id, ...data });
        // Update invoicedProdIds
        lignes.forEach(l => invoicedProdIds.add(l.produitId));
        hideModal(); render(); showToast(`Facture ${n} créée`);
      } catch (err) { showToast('Erreur: ' + err.message, 'error'); }
    };
  }

  function viewFacture(f) {
    // Group lines by category for display
    const catMap = {};
    (f.lignes || []).forEach(l => {
      const key = l.typeId || 'other';
      if (!catMap[key]) catMap[key] = { nom: l.typeNom || '-', prix: l.prixUnitaire || 0, prods: [] };
      catMap[key].prods.push(l);
    });
    const catRows = Object.values(catMap).map(g =>
      `<tr><td><strong style="color:var(--accent)">${g.nom}</strong></td><td>${g.prods.length}</td><td>${formatCurrency(g.prix)}</td><td>${formatCurrency(g.prix * g.prods.length)}</td></tr>`
    ).join('');
    const prodRows = (f.lignes || []).map(l =>
      `<tr><td>${l.designation || l.produitRef || ''}</td><td>${l.typeNom || '-'}</td><td>${formatCurrency(l.prixUnitaire)}</td></tr>`
    ).join('');

    showModal(`Facture Achat - ${f.numero}`, `${printDocumentHeader(settings, 'FACTURE ACHAT', f.numero, f.date)}
      <div class="doc-info"><div class="doc-info-box"><p><strong>Fournisseur:</strong> ${f.fournisseurNom}</p></div><div class="doc-info-box"><p><strong>BL:</strong> ${(f.blRefs || []).join(', ')}</p></div></div>
      <h4 style="margin:8px 0">Résumé par catégorie</h4>
      <table class="data-table"><thead><tr><th>Catégorie</th><th>Qté</th><th>Prix Unit.</th><th>Sous-total</th></tr></thead><tbody>${catRows}</tbody></table>
      <h4 style="margin:12px 0 8px">Détail poteaux (${(f.lignes || []).length})</h4>
      <table class="data-table"><thead><tr><th>Poteau</th><th>Catégorie</th><th>Prix HT</th></tr></thead><tbody>${prodRows}</tbody></table>
      <div class="doc-totals"><div class="doc-total-row"><span>Total HT:</span><span>${formatCurrency(f.totalHT)}</span></div><div class="doc-total-row"><span>TVA (${f.taxRate}%):</span><span>${formatCurrency(f.totalTVA)}</span></div><div class="doc-total-row grand-total"><span>Total TTC:</span><span>${formatCurrency(f.totalTTC)}</span></div></div>
      <p style="margin-top:12px;font-size:0.85rem;font-style:italic;color:var(--text-secondary)">Arrêté à: <strong>${numberToWords(f.totalTTC)}</strong></p>`,
      `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button><button class="btn btn-primary" onclick="window.print()">🖨️</button>`);
  }
  render();
}
