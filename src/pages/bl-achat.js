// BL Achat Page - select lot first, filter products by lot, enforce lot limit
import { getAll, add, update, remove, getSettings, getNextNumber, updateStock, getUsedProductIds } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatDate, formatCurrency, todayISO, printDocumentHeader } from '../utils/helpers.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';

export async function renderBlAchat() {
    const content = document.getElementById('page-content');
    let bls = await getAll('bl_achat').catch(() => []);
    const fournisseurs = await getAll('fournisseurs').catch(() => []);
    const produits = await getAll('produits').catch(() => []);
    const categories = await getAll('categories').catch(() => []);
    const lots = await getAll('lots').catch(() => []);
    const settings = await getSettings();
    let currentPage = 1, currentFilters = {};

    function render(filters = currentFilters, page = currentPage) {
        currentFilters = filters; currentPage = page;
        const filtered = applyFilters(bls, { ...filters, searchFields: ['numero', 'fournisseurNom', 'lotNumero'] });
        const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));
        content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">🚛 Bon de Livraison Achat</h1><p class="page-subtitle">Réception fournisseurs — sélectionnez un lot puis les poteaux</p></div>
        <button class="btn btn-primary" id="add-bla-btn">+ Nouveau BL</button></div>
      ${filterBarHTML({ showStatus: true, statusOptions: ['En attente', 'Réceptionné'] })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>N° BL</th><th>Date</th><th>Fournisseur</th><th>Lot</th><th>Nb Poteaux</th><th>Total HT</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(b => `<tr><td><strong style="color:var(--accent)">${b.numero || ''}</strong></td><td>${formatDate(b.date)}</td><td>${b.fournisseurNom || '-'}</td>
          <td><span class="badge badge-warning">${b.lotNumero || '-'}</span></td><td>${(b.lignes || []).length}</td>
          <td>${formatCurrency(b.totalHT || 0)}</td>
          <td><span class="badge ${b.statut === 'Réceptionné' ? 'badge-success' : 'badge-warning'}">${b.statut || 'En attente'}</span></td>
          <td class="actions"><button class="btn btn-sm btn-secondary view-bla" data-id="${b.id}">👁️</button>${b.statut !== 'Réceptionné' ? `<button class="btn btn-sm btn-success validate-bla" data-id="${b.id}">✓</button>` : ''}<button class="btn btn-sm btn-danger delete-bla" data-id="${b.id}">🗑️</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">🚛</div><div class="title">Aucun BL achat</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;
        paginate(filtered, page, 'pagination-controls', p => render(filters, p));
        wireFilters((f, p) => render(f, p));
        document.getElementById('add-bla-btn').onclick = () => openForm();
        document.querySelectorAll('.view-bla').forEach(b => b.onclick = () => { const bl = bls.find(x => x.id === b.dataset.id); if (bl) viewBl(bl); });
        document.querySelectorAll('.validate-bla').forEach(b => b.onclick = async () => {
            const bl = bls.find(x => x.id === b.dataset.id);
            if (bl && await confirmDialog('Valider la réception ? Stock sera mis à jour.')) {
                try { for (const l of (bl.lignes || [])) { if (l.produitId) await updateStock(l.produitId, 1, 'entree', bl.numero); } } catch (e) { console.warn('Stock update error:', e); }
                await update('bl_achat', bl.id, { statut: 'Réceptionné' }); bl.statut = 'Réceptionné'; render(); showToast('BL réceptionné');
            }
        });
        document.querySelectorAll('.delete-bla').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ?')) { await remove('bl_achat', b.dataset.id); bls = bls.filter(x => x.id !== b.dataset.id); render(); showToast('Supprimé'); } });
    }

    async function openForm() {
        const usedIds = await getUsedProductIds();
        const taxRate = settings.taxRate || 19;

        showModal('Nouveau BL Achat', `<form id="bla-form">
      <div class="form-row">
        <div class="form-group"><label class="form-label">Lot *</label><select class="form-select" name="lotId" id="bla-lot" required><option value="">-- Sélectionner un lot --</option>${lots.map(l => `<option value="${l.id}">${l.numero} (max: ${l.maxProduits})</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Fournisseur *</label><select class="form-select" name="fournisseurId" required><option value="">--</option>${fournisseurs.map(f => `<option value="${f.id}">${f.raisonSociale}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" name="date" value="${todayISO()}"/></div>
        <div class="form-group"><label class="form-label">TVA (%)</label><input class="form-input" type="number" name="taxRate" id="bla-tax" value="${taxRate}" style="max-width:120px"/></div>
      </div>
      <div id="bla-lot-info" style="margin:12px 0;padding:10px;background:var(--bg-input);border-radius:var(--radius-md);display:none"></div>
      <h4 style="margin:16px 0 8px">Poteaux du lot <small style="color:var(--text-muted)">(cochez ceux à réceptionner)</small></h4>
      <div class="table-wrapper"><table class="data-table"><thead><tr><th style="width:30px">✓</th><th>ID Poteau</th><th>Catégorie</th><th>Prix Achat</th></tr></thead><tbody id="bla-lines"><tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Sélectionnez un lot ci-dessus</td></tr></tbody></table></div>
      <div class="doc-totals" style="margin-top:12px"><div class="doc-total-row"><span>Total HT:</span><span id="total-ht">0,000 DT</span></div><div class="doc-total-row"><span>TVA:</span><span id="total-tva">0,000 DT</span></div><div class="doc-total-row grand-total"><span>Total TTC:</span><span id="total-ttc">0,000 DT</span></div></div>
      <div class="form-group" style="margin-top:12px"><label class="form-label">Note</label><textarea class="form-input" name="note" rows="2"></textarea></div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-bla">Créer</button>`);
        document.querySelector('.modal-container').style.maxWidth = '900px';

        // When lot changes, populate products from that lot
        document.getElementById('bla-lot').onchange = () => rebuildLotProducts();
        document.getElementById('bla-tax').oninput = () => recalcTotals();

        function rebuildLotProducts() {
            const lotId = document.getElementById('bla-lot').value;
            const tbody = document.getElementById('bla-lines');
            const infoDiv = document.getElementById('bla-lot-info');
            if (!lotId) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Sélectionnez un lot</td></tr>';
                infoDiv.style.display = 'none';
                recalcTotals(); return;
            }
            const lot = lots.find(l => l.id === lotId);
            // Get products in this lot that are not already used
            const lotProds = produits.filter(p => p.lotId === lotId && !usedIds.has(p.id)).sort((a, b) => (a.numero || 0) - (b.numero || 0));
            const alreadyUsedInLot = produits.filter(p => p.lotId === lotId && usedIds.has(p.id)).length;

            infoDiv.style.display = 'block';
            infoDiv.innerHTML = `<strong>Lot ${lot?.numero}:</strong> ${lotProds.length} poteau(x) disponible(s) | ${alreadyUsedInLot} déjà utilisé(s) | Max: ${lot?.maxProduits || 0}`;

            if (!lotProds.length) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Aucun poteau disponible dans ce lot</td></tr>';
                recalcTotals(); return;
            }
            tbody.innerHTML = lotProds.map(p => {
                const catPrix = (lot?.prixParCategorie || []).find(cp => cp.categorieId === p.categorieId);
                const prix = catPrix?.prixAchat || p.prixAchat || 0;
                return `<tr data-prod="${p.id}" data-prix="${prix}">
                    <td><input type="checkbox" class="line-check" checked/></td>
                    <td><strong style="color:var(--accent)">${p.reference}</strong></td>
                    <td>${p.categorieNom || '-'}</td>
                    <td>${formatCurrency(prix)}</td>
                </tr>`;
            }).join('');
            document.querySelectorAll('#bla-lines .line-check').forEach(cb => cb.onchange = () => recalcTotals());
            recalcTotals();
        }

        function recalcTotals() {
            let ht = 0;
            document.querySelectorAll('#bla-lines tr[data-prod]').forEach(r => {
                if (r.querySelector('.line-check')?.checked) ht += parseFloat(r.dataset.prix) || 0;
            });
            const tax = parseFloat(document.getElementById('bla-tax')?.value) || 0;
            document.getElementById('total-ht').textContent = formatCurrency(ht);
            document.getElementById('total-tva').textContent = formatCurrency(ht * tax / 100);
            document.getElementById('total-ttc').textContent = formatCurrency(ht + ht * tax / 100);
        }

        document.getElementById('save-bla').onclick = async () => {
            const f = document.getElementById('bla-form');
            const lotId = f.querySelector('[name="lotId"]').value;
            if (!lotId) { showToast('Lot requis', 'error'); return; }
            const fid = f.querySelector('[name="fournisseurId"]').value;
            if (!fid) { showToast('Fournisseur requis', 'error'); return; }
            const lot = lots.find(l => l.id === lotId);
            const four = fournisseurs.find(x => x.id === fid);
            const dt = f.querySelector('[name="date"]').value;
            const tax = parseFloat(f.querySelector('[name="taxRate"]').value) || 0;
            const note = f.querySelector('[name="note"]').value;

            // Collect checked products
            const lines = [];
            document.querySelectorAll('#bla-lines tr[data-prod]').forEach(r => {
                if (!r.querySelector('.line-check')?.checked) return;
                const prodId = r.dataset.prod;
                const prix = parseFloat(r.dataset.prix) || 0;
                const prod = produits.find(p => p.id === prodId);
                lines.push({
                    categorieId: prod?.categorieId || '', categorieNom: prod?.categorieNom || '',
                    produitId: prodId, produitRef: prod?.reference || '', designation: prod?.reference || '',
                    lotId, lotNumero: lot?.numero || '',
                    quantite: 1, prixUnitaire: prix, montant: prix
                });
            });
            if (!lines.length) { showToast('Sélectionnez au moins un poteau', 'error'); return; }

            // Enforce lot limit
            const existingInLot = bls.reduce((count, bl) => count + (bl.lignes || []).filter(l => l.lotId === lotId).length, 0);
            if (existingInLot + lines.length > (lot?.maxProduits || 0)) {
                showToast(`Limite du lot dépassée ! ${existingInLot} déjà en BL + ${lines.length} sélectionnés > ${lot?.maxProduits} max`, 'error');
                return;
            }

            const totalHT = lines.reduce((s, l) => s + l.montant, 0);
            const totalTVA = totalHT * tax / 100;
            const n = await getNextNumber('blAchatPrefix');
            const data = { numero: n, date: dt, fournisseurId: fid, fournisseurNom: four?.raisonSociale || '', lotId, lotNumero: lot?.numero || '', lignes: lines, taxRate: tax, totalHT, totalTVA, totalTTC: totalHT + totalTVA, statut: 'En attente', note };
            const id = await add('bl_achat', data);
            bls.unshift({ id, ...data });
            hideModal(); render(); showToast(`BL ${n} créé (${lines.length} poteaux du lot ${lot?.numero})`);
        };
    }

    function viewBl(b) {
        const lot = lots.find(l => l.id === b.lotId);
        showModal(`BL Achat - ${b.numero}`, `${printDocumentHeader(settings, 'BON DE LIVRAISON ACHAT', b.numero, b.date)}
      <div class="doc-info">
        <div class="doc-info-box"><p><strong>Fournisseur:</strong> ${b.fournisseurNom}</p><p><strong>Lot:</strong> ${b.lotNumero || '-'}</p></div>
        <div class="doc-info-box"><p><strong>Statut:</strong> ${b.statut}</p></div>
      </div>
      <table class="data-table"><thead><tr><th>Poteau</th><th>Catégorie</th><th>Prix Achat</th></tr></thead><tbody>${(b.lignes || []).map(l => `<tr><td>${l.designation || l.produitRef || ''}</td><td>${l.categorieNom || '-'}</td><td>${formatCurrency(l.prixUnitaire || 0)}</td></tr>`).join('')}</tbody></table>
      <div class="doc-totals" style="margin-top:12px"><div class="doc-total-row"><span>Total HT (${(b.lignes || []).length} poteaux):</span><span>${formatCurrency(b.totalHT || 0)}</span></div><div class="doc-total-row"><span>TVA (${b.taxRate || 0}%):</span><span>${formatCurrency(b.totalTVA || 0)}</span></div><div class="doc-total-row grand-total"><span>Total TTC:</span><span>${formatCurrency(b.totalTTC || 0)}</span></div></div>
      <p style="margin-top:8px;color:var(--text-secondary)">${(b.lignes || []).length} poteau(x)</p>`,
            `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button><button class="btn btn-primary" onclick="window.print()">🖨️</button>`);
    }
    render();
}
