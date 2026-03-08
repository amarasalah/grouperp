// BL Vente Page - individual product, global uniqueness
import { getAll, add, update, remove, getSettings, getNextNumber, updateStock, getUsedProductIds } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatDate, todayISO, printDocumentHeader } from '../utils/helpers.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';

export async function renderBlVente() {
    const content = document.getElementById('page-content');
    let bls = await getAll('bl_vente').catch(() => []);
    const clients = await getAll('clients').catch(() => []);
    const produits = await getAll('produits').catch(() => []);
    const categories = await getAll('categories').catch(() => []);
    const settings = await getSettings();
    let currentPage = 1, currentFilters = {};

    function render(filters = currentFilters, page = currentPage) {
        currentFilters = filters; currentPage = page;
        const filtered = applyFilters(bls, { ...filters, searchFields: ['numero', 'clientNom', 'bcRef'] });
        const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));
        content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">🚛 Bon de Livraison Vente</h1><p class="page-subtitle">Livraisons clients</p></div>
        <button class="btn btn-primary" id="add-blv-btn">+ Nouveau BL</button></div>
      ${filterBarHTML({ showStatus: true, statusOptions: ['En attente', 'Livré'] })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>N° BL</th><th>Date</th><th>Client</th><th>Réf. BC</th><th>Nb Poteaux</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(b => `<tr><td><strong style="color:var(--accent)">${b.numero || ''}</strong></td><td>${formatDate(b.date)}</td><td>${b.clientNom || '-'}</td><td>${b.bcRef || '-'}</td><td>${(b.lignes || []).length}</td>
          <td><span class="badge ${b.statut === 'Livré' ? 'badge-success' : 'badge-warning'}">${b.statut || 'En attente'}</span></td>
          <td class="actions"><button class="btn btn-sm btn-secondary view-blv" data-id="${b.id}">👁️</button>${b.statut !== 'Livré' ? `<button class="btn btn-sm btn-success validate-blv" data-id="${b.id}">✓</button>` : ''}<button class="btn btn-sm btn-danger delete-blv" data-id="${b.id}">🗑️</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">🚛</div><div class="title">Aucun BL vente</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;
        paginate(filtered, page, 'pagination-controls', p => render(filters, p));
        wireFilters((f, p) => render(f, p));
        document.getElementById('add-blv-btn').onclick = () => openForm();
        document.querySelectorAll('.view-blv').forEach(b => b.onclick = () => { const bl = bls.find(x => x.id === b.dataset.id); if (bl) viewBl(bl); });
        document.querySelectorAll('.validate-blv').forEach(b => b.onclick = async () => {
            const bl = bls.find(x => x.id === b.dataset.id);
            if (bl && await confirmDialog('Valider la livraison ? Stock sera mis à jour.')) {
                try { for (const l of (bl.lignes || [])) { if (l.produitId) await updateStock(l.produitId, 1, 'sortie', bl.numero); } } catch (e) { console.warn('Stock update error:', e); }
                await update('bl_vente', bl.id, { statut: 'Livré' }); bl.statut = 'Livré'; render(); showToast('BL livré');
            }
        });
        document.querySelectorAll('.delete-blv').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ?')) { await remove('bl_vente', b.dataset.id); bls = bls.filter(x => x.id !== b.dataset.id); render(); showToast('Supprimé'); } });
    }

    function lineHtml(l = {}) {
        return `<tr class="line-row">
      <td><select class="form-select line-cat" style="min-width:130px"><option value="">-- Catégorie --</option>${categories.map(c => `<option value="${c.id}" ${l.categorieId === c.id ? 'selected' : ''}>${c.nom}</option>`).join('')}</select></td>
      <td><select class="form-select line-prod" style="min-width:200px"><option value="">-- Produit --</option></select></td>
      <td><button type="button" class="btn btn-sm btn-danger remove-line">✗</button></td></tr>`;
    }

    async function openForm() {
        const usedIds = await getUsedProductIds();
        showModal('Nouveau BL Vente', `<form id="blv-form"><div class="form-row"><div class="form-group"><label class="form-label">Client *</label><select class="form-select" name="clientId" required><option value="">--</option>${clients.map(c => `<option value="${c.id}">${c.raisonSociale}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" name="date" value="${todayISO()}"/></div></div>
      <h4 style="margin:16px 0 8px">Poteaux <small style="color:var(--text-muted)">(seuls les poteaux non-utilisés)</small></h4>
      <div class="table-wrapper"><table class="data-table line-items-table"><thead><tr><th>Catégorie</th><th>Poteau (ID)</th><th></th></tr></thead><tbody id="blv-lines">${lineHtml()}</tbody></table></div>
      <button type="button" class="btn btn-secondary btn-sm" id="blv-add-line">+ Ajouter Poteau</button>
      <div class="form-group" style="margin-top:12px"><label class="form-label">Note</label><textarea class="form-input" name="note" rows="2"></textarea></div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-blv">Créer</button>`);
        document.querySelector('.modal-container').style.maxWidth = '800px'; wireAll();
        document.getElementById('blv-add-line').onclick = () => { document.getElementById('blv-lines').insertAdjacentHTML('beforeend', lineHtml()); wireAll(); };
        document.getElementById('save-blv').onclick = async () => {
            const f = document.getElementById('blv-form'), cid = f.querySelector('[name="clientId"]').value;
            if (!cid) { showToast('Client requis', 'error'); return; }
            const cl = clients.find(x => x.id === cid), dt = f.querySelector('[name="date"]').value, lines = collectLines();
            if (!lines.length) { showToast('Ajoutez un poteau', 'error'); return; }
            const n = await getNextNumber('blVentePrefix'), note = f.querySelector('[name="note"]').value;
            const id = await add('bl_vente', { numero: n, date: dt, clientId: cid, clientNom: cl?.raisonSociale || '', lignes: lines, statut: 'En attente', note });
            bls.unshift({ id, numero: n, date: dt, clientId: cid, clientNom: cl?.raisonSociale || '', lignes: lines, statut: 'En attente', note });
            hideModal(); render(); showToast(`BL ${n} créé`);
        };

        function populateProducts(row, catId) {
            const catProds = produits.filter(p => p.categorieId === catId && !usedIds.has(p.id)).sort((a, b) => (a.numero || 0) - (b.numero || 0));
            row.querySelector('.line-prod').innerHTML = `<option value="">-- Produit --</option>${catProds.map(p => `<option value="${p.id}">${p.reference}</option>`).join('')}`;
        }
        function wireAll() {
            document.querySelectorAll('#blv-lines .line-row').forEach(row => {
                row.querySelector('.line-cat').onchange = e => populateProducts(row, e.target.value);
                row.querySelector('.remove-line').onclick = () => { if (document.getElementById('blv-lines').children.length > 1) row.remove(); };
            });
        }
        function collectLines() {
            const lines = [], seen = new Set(); document.querySelectorAll('#blv-lines .line-row').forEach(row => {
                const catSel = row.querySelector('.line-cat'), pSel = row.querySelector('.line-prod');
                if (pSel.value) {
                    if (seen.has(pSel.value)) { showToast('Poteau en double!', 'error'); return; }
                    seen.add(pSel.value);
                    const cat = categories.find(c => c.id === catSel.value), prod = produits.find(p => p.id === pSel.value);
                    lines.push({ categorieId: catSel.value, categorieNom: cat?.nom || '', produitId: pSel.value, produitRef: prod?.reference || '', designation: prod?.reference || '', quantite: 1 });
                }
            }); return lines;
        }
    }

    function viewBl(b) {
        showModal(`BL Vente - ${b.numero}`, `${printDocumentHeader(settings, 'BON DE LIVRAISON VENTE', b.numero, b.date)}
      <div class="doc-info"><div class="doc-info-box"><p><strong>Client:</strong> ${b.clientNom}</p></div><div class="doc-info-box"><p><strong>Statut:</strong> ${b.statut}</p></div></div>
      <table class="data-table"><thead><tr><th>Poteau</th></tr></thead><tbody>${(b.lignes || []).map(l => `<tr><td>${l.designation || l.produitRef || ''}</td></tr>`).join('')}</tbody></table>
      <p style="margin-top:8px;color:var(--text-secondary)">${(b.lignes || []).length} poteau(x)</p>`,
            `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button><button class="btn btn-primary" onclick="window.print()">🖨️</button>`);
    }
    render();
}
