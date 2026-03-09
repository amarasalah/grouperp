// BL Achat Page - Checkbox-based product selection from manufactured products
import { getAll, add, update, remove, getSettings, getNextNumber, updateStock } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatDate, todayISO, printDocumentHeader } from '../utils/helpers.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';
import { getSelectedBcgId, isAllBcgMode } from './bcg-select.js';
import { hasPermission } from '../data/auth.js';

export async function renderBlAchat() {
    const content = document.getElementById('page-content');
    let bls = await getAll('bl_achat').catch(() => []);
    const fournisseurs = await getAll('fournisseurs').catch(() => []);
    const produits = await getAll('produits').catch(() => []);
    const types = await getAll('types').catch(() => []);
    const allBcgs = await getAll('bcg').catch(() => []);
    const settings = await getSettings();
    const bcgId = getSelectedBcgId();
    const allMode = isAllBcgMode();
    // TypeIds that belong to the selected BCG (for product filtering)
    const bcgTypeIds = (!allMode && bcgId && bcgId !== 'all')
        ? ((allBcgs.find(b => b.id === bcgId)?.typesQty || []).map(tq => tq.typeId))
        : null;
    let currentPage = 1, currentFilters = {};

    function render(filters = currentFilters, page = currentPage) {
        currentFilters = filters; currentPage = page;
        let filtered = applyFilters(bls, { ...filters, searchFields: ['numero', 'fournisseurNom'] });
        if (!allMode && bcgTypeIds) {
            filtered = filtered.filter(bl => (bl.lignes || []).some(l => bcgTypeIds.includes(l.typeId)));
        }
        const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));

        const canCreate = hasPermission('bl_achat', 'create');
        const canDelete = hasPermission('bl_achat', 'delete');

        content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">🚛 Bon de Livraison Achat</h1><p class="page-subtitle">Réception fournisseurs — sélection par cases à cocher</p></div>
        ${canCreate ? '<button class="btn btn-primary" id="add-bla-btn">+ Nouveau BL</button>' : ''}</div>
      ${filterBarHTML({ showStatus: true, statusOptions: ['En attente', 'Réceptionné'] })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>N° BL</th><th>Date</th><th>Fournisseur</th><th>Nb Poteaux</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(b => `<tr><td><strong style="color:var(--accent)">${b.numero || ''}</strong></td><td>${formatDate(b.date)}</td><td>${b.fournisseurNom || '-'}</td><td>${(b.lignes || []).length}</td>
          <td><span class="badge ${b.statut === 'Réceptionné' ? 'badge-success' : 'badge-warning'}">${b.statut || 'En attente'}</span></td>
          <td class="actions"><button class="btn btn-sm btn-secondary view-bla" data-id="${b.id}">👁️</button>${b.statut !== 'Réceptionné' ? `<button class="btn btn-sm btn-success validate-bla" data-id="${b.id}">✓ Réceptionner</button>` : ''}${canDelete ? `<button class="btn btn-sm btn-danger delete-bla" data-id="${b.id}">🗑️</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">🚛</div><div class="title">Aucun BL achat</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;

        paginate(filtered, page, 'pagination-controls', p => render(filters, p));
        wireFilters((f, p) => render(f, p));
        document.getElementById('add-bla-btn')?.addEventListener('click', () => openForm());
        document.querySelectorAll('.view-bla').forEach(b => b.onclick = () => { const bl = bls.find(x => x.id === b.dataset.id); if (bl) viewBl(bl); });
        document.querySelectorAll('.validate-bla').forEach(b => b.onclick = async () => {
            const bl = bls.find(x => x.id === b.dataset.id);
            if (bl && await confirmDialog('Valider la réception ? Les produits entreront en stock.')) {
                try {
                    for (const l of (bl.lignes || [])) {
                        if (l.produitId) await updateStock(l.produitId, 1, 'entree', bl.numero);
                    }
                } catch (e) { console.warn('Stock update error:', e); }
                await update('bl_achat', bl.id, { statut: 'Réceptionné' });
                bl.statut = 'Réceptionné';
                render();
                showToast('BL réceptionné — produits entrés en stock');
            }
        });
        document.querySelectorAll('.delete-bla').forEach(b => b.onclick = async () => {
            if (await confirmDialog('Supprimer ?')) {
                await remove('bl_achat', b.dataset.id);
                bls = bls.filter(x => x.id !== b.dataset.id);
                render();
                showToast('Supprimé');
            }
        });
    }

    async function openForm() {
        // Get IDs of products already used in any BL Achat
        const usedIds = new Set();
        bls.forEach(bl => {
            (bl.lignes || []).forEach(l => {
                if (l.produitId) usedIds.add(l.produitId);
            });
        });

        // Available products: not used in any BL Achat, filtered by BCG type if context set
        let availableProducts = produits.filter(p => !usedIds.has(p.id));
        if (bcgTypeIds && bcgTypeIds.length > 0) {
            availableProducts = availableProducts.filter(p => bcgTypeIds.includes(p.typeId));
        }

        // Group available products by type for display
        const catGroups = {};
        availableProducts.forEach(p => {
            const catId = p.typeId || 'none';
            if (!catGroups[catId]) {
                const tp = types.find(t => t.id === catId);
                catGroups[catId] = { nom: tp?.nom || 'Sans type', prefix: tp?.prefix || '', products: [] };
            }
            catGroups[catId].products.push(p);
        });

        // Filter by category
        const catFilterOptions = types.map(t => `<option value="${t.id}">${t.nom}</option>`).join('');

        showModal('Nouveau BL Achat — Sélection des poteaux', `
          <form id="bla-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Fournisseur *</label>
                <select class="form-select" name="fournisseurId" required>
                  <option value="">--</option>
                  ${fournisseurs.map(f => `<option value="${f.id}">${f.raisonSociale}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Date</label>
                <input class="form-input" type="date" name="date" value="${todayISO()}"/>
              </div>
            </div>
            <div style="display:flex;gap:12px;align-items:center;margin:16px 0 8px;">
              <h4>Poteaux disponibles (${availableProducts.length})</h4>
              <select class="form-select" id="bla-cat-filter" style="max-width:200px;">
                <option value="">Toutes catégories</option>
                ${catFilterOptions}
              </select>
              <input class="form-input" id="bla-search" placeholder="Rechercher..." style="max-width:200px;"/>
              <button type="button" class="btn btn-sm btn-secondary" id="bla-select-all">Tout cocher</button>
              <button type="button" class="btn btn-sm btn-secondary" id="bla-deselect-all">Tout décocher</button>
            </div>
            <div class="table-wrapper" style="max-height:350px;overflow-y:auto;">
              <table class="data-table" id="bla-products-table">
                <thead><tr><th style="width:40px">✓</th><th>ID Poteau</th><th>Type</th><th>Désignation</th></tr></thead>
                <tbody>
                  ${availableProducts.map(p => {
                    const tp = types.find(t => t.id === p.typeId);
                    return `<tr class="prod-row" data-cat="${p.typeId || ''}" data-ref="${(p.reference || '').toLowerCase()}" data-desig="${(p.designation || '').toLowerCase()}">
                      <td><input type="checkbox" class="prod-check" data-id="${p.id}" style="accent-color:var(--accent);width:16px;height:16px;"/></td>
                      <td><strong style="color:var(--accent)">${p.reference || ''}</strong></td>
                      <td>${tp?.nom || '-'}</td>
                      <td>${p.designation || '-'}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
            <div style="margin-top:8px;font-size:0.85rem;color:var(--text-secondary);">
              Sélectionnés: <strong id="bla-count">0</strong> poteau(x)
            </div>
            <div class="form-group" style="margin-top:12px">
              <label class="form-label">Note</label>
              <textarea class="form-input" name="note" rows="2"></textarea>
            </div>
          </form>
        `, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button>
           <button class="btn btn-primary" id="save-bla">Créer le BL</button>`);

        document.querySelector('.modal-container').style.maxWidth = '900px';

        // Wire filter/search
        const updateCount = () => {
            const count = document.querySelectorAll('.prod-check:checked').length;
            const el = document.getElementById('bla-count');
            if (el) el.textContent = count;
        };

        document.getElementById('bla-cat-filter').onchange = (e) => {
            const val = e.target.value;
            document.querySelectorAll('.prod-row').forEach(row => {
                const match = !val || row.dataset.cat === val;
                row.style.display = match ? '' : 'none';
            });
        };

        document.getElementById('bla-search').oninput = (e) => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll('.prod-row').forEach(row => {
                const match = !q || row.dataset.ref.includes(q) || row.dataset.desig.includes(q);
                row.style.display = match ? '' : 'none';
            });
        };

        document.getElementById('bla-select-all').onclick = () => {
            document.querySelectorAll('.prod-row:not([style*="display: none"]) .prod-check').forEach(c => c.checked = true);
            updateCount();
        };
        document.getElementById('bla-deselect-all').onclick = () => {
            document.querySelectorAll('.prod-check').forEach(c => c.checked = false);
            updateCount();
        };
        document.querySelectorAll('.prod-check').forEach(c => c.onchange = updateCount);

        // Save
        document.getElementById('save-bla').onclick = async () => {
            const f = document.getElementById('bla-form');
            const fid = f.querySelector('[name="fournisseurId"]').value;
            if (!fid) { showToast('Fournisseur requis', 'error'); return; }
            const four = fournisseurs.find(x => x.id === fid);
            const dt = f.querySelector('[name="date"]').value;
            const note = f.querySelector('[name="note"]').value;

            // Collect selected products
            const selectedIds = [...document.querySelectorAll('.prod-check:checked')].map(c => c.dataset.id);
            if (!selectedIds.length) { showToast('Sélectionnez au moins un poteau', 'error'); return; }

            const lignes = selectedIds.map(pid => {
                const prod = produits.find(p => p.id === pid);
                const tp = types.find(t => t.id === prod?.typeId);
                return {
                    typeId: prod?.typeId || '',
                    typeNom: tp?.nom || '',
                    produitId: pid,
                    produitRef: prod?.reference || '',
                    designation: prod?.reference || '',
                    quantite: 1
                };
            });

            const n = await getNextNumber('blAchatPrefix');
            const data = {
                numero: n, date: dt,
                fournisseurId: fid, fournisseurNom: four?.raisonSociale || '',
                lignes, statut: 'En attente', note,
                bcgId: (!allMode && bcgId && bcgId !== 'all') ? bcgId : null
            };
            const id = await add('bl_achat', data);
            bls.unshift({ id, ...data });
            hideModal();
            render();
            showToast(`BL ${n} créé avec ${selectedIds.length} poteau(x)`);
        };
    }

    function viewBl(b) {
        showModal(`BL Achat - ${b.numero}`, `${printDocumentHeader(settings, 'BON DE LIVRAISON ACHAT', b.numero, b.date)}
      <div class="doc-info"><div class="doc-info-box"><p><strong>Fournisseur:</strong> ${b.fournisseurNom}</p></div><div class="doc-info-box"><p><strong>Statut:</strong> <span class="badge ${b.statut === 'Réceptionné' ? 'badge-success' : 'badge-warning'}">${b.statut}</span></p></div></div>
      <table class="data-table"><thead><tr><th>Poteau</th><th>Type</th></tr></thead><tbody>${(b.lignes || []).map(l => `<tr><td><strong style="color:var(--accent)">${l.designation || l.produitRef || ''}</strong></td><td>${l.typeNom || '-'}</td></tr>`).join('')}</tbody></table>
      <p style="margin-top:8px;color:var(--text-secondary)">${(b.lignes || []).length} poteau(x)</p>`,
            `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button><button class="btn btn-primary" onclick="window.print()">🖨️</button>`);
    }

    render();
}
