// BL Achat Page - individual product, no qty (each poteau = 1)
import { getAll, add, update, remove, getSettings, getNextNumber, updateStock } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatDate, todayISO, printDocumentHeader } from '../utils/helpers.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';

export async function renderBlAchat() {
    const content = document.getElementById('page-content');
    let bls = await getAll('bl_achat').catch(() => []);
    const fournisseurs = await getAll('fournisseurs').catch(() => []);
    const produits = await getAll('produits').catch(() => []);
    const categories = await getAll('categories').catch(() => []);
    const settings = await getSettings();
    let currentPage = 1, currentFilters = {};

    function render(filters = currentFilters, page = currentPage) {
        currentFilters = filters; currentPage = page;
        const filtered = applyFilters(bls, { ...filters, searchFields: ['numero', 'fournisseurNom', 'bcRef'] });
        const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));

        content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">🚛 Bon de Livraison Achat</h1><p class="page-subtitle">Réception fournisseurs</p></div>
        <button class="btn btn-primary" id="add-bla-btn">+ Nouveau BL</button></div>
      ${filterBarHTML({ showStatus: true, statusOptions: ['En attente', 'Réceptionné'] })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>N° BL</th><th>Date</th><th>Fournisseur</th><th>Réf. BC</th><th>Nb Poteaux</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(b => `<tr><td><strong style="color:var(--accent)">${b.numero || ''}</strong></td><td>${formatDate(b.date)}</td><td>${b.fournisseurNom || '-'}</td><td>${b.bcRef || '-'}</td><td>${(b.lignes || []).length}</td>
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
                try {
                    for (const l of (bl.lignes || [])) {
                        if (l.produitId) await updateStock(l.produitId, 1, 'entree', bl.numero);
                    }
                } catch (e) { console.warn('Stock update error:', e); }
                await update('bl_achat', bl.id, { statut: 'Réceptionné' }); bl.statut = 'Réceptionné'; render(); showToast('BL réceptionné');
            }
        });
        document.querySelectorAll('.delete-bla').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ?')) { await remove('bl_achat', b.dataset.id); bls = bls.filter(x => x.id !== b.dataset.id); render(); showToast('Supprimé'); } });
    }

    function lineHtml(l = {}) {
        return `<tr class="line-row">
      <td><select class="form-select line-cat" style="min-width:130px"><option value="">-- Catégorie --</option>${categories.map(c => `<option value="${c.id}" ${l.categorieId === c.id ? 'selected' : ''}>${c.nom}</option>`).join('')}</select></td>
      <td><select class="form-select line-prod" style="min-width:200px"><option value="">-- Produit --</option></select></td>
      <td><button type="button" class="btn btn-sm btn-danger remove-line">✗</button></td></tr>`;
    }

    function openForm() {
        showModal('Nouveau BL Achat', `<form id="bla-form"><div class="form-row"><div class="form-group"><label class="form-label">Fournisseur *</label><select class="form-select" name="fournisseurId" required><option value="">--</option>${fournisseurs.map(f => `<option value="${f.id}">${f.raisonSociale}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" name="date" value="${todayISO()}"/></div></div>
      <h4 style="margin:16px 0 8px">Poteaux</h4><div class="table-wrapper"><table class="data-table line-items-table"><thead><tr><th>Catégorie</th><th>Poteau (ID)</th><th></th></tr></thead><tbody id="bla-lines">${lineHtml()}</tbody></table></div>
      <button type="button" class="btn btn-secondary btn-sm" id="bla-add-line">+ Ajouter Poteau</button>
      <div class="form-group" style="margin-top:12px"><label class="form-label">Note</label><textarea class="form-input" name="note" rows="2"></textarea></div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-bla">Créer</button>`);
        document.querySelector('.modal-container').style.maxWidth = '800px'; wireAll();
        document.getElementById('bla-add-line').onclick = () => { document.getElementById('bla-lines').insertAdjacentHTML('beforeend', lineHtml()); wireAll(); };
        document.getElementById('save-bla').onclick = async () => {
            const f = document.getElementById('bla-form'), fid = f.querySelector('[name="fournisseurId"]').value;
            if (!fid) { showToast('Fournisseur requis', 'error'); return; }
            const four = fournisseurs.find(x => x.id === fid), dt = f.querySelector('[name="date"]').value, lines = collectLines();
            if (!lines.length) { showToast('Ajoutez un poteau', 'error'); return; }
            const n = await getNextNumber('blAchatPrefix');
            const note = f.querySelector('[name="note"]').value;
            const id = await add('bl_achat', { numero: n, date: dt, fournisseurId: fid, fournisseurNom: four?.raisonSociale || '', lignes: lines, statut: 'En attente', note });
            bls.unshift({ id, numero: n, date: dt, fournisseurId: fid, fournisseurNom: four?.raisonSociale || '', lignes: lines, statut: 'En attente', note });
            hideModal(); render(); showToast(`BL ${n} créé`);
        };
    }

    function populateProducts(row, catId) {
        const catProds = produits.filter(p => p.categorieId === catId).sort((a, b) => (a.numero || 0) - (b.numero || 0));
        row.querySelector('.line-prod').innerHTML = `<option value="">-- Produit --</option>${catProds.map(p => `<option value="${p.id}" data-ref="${p.reference}">${p.reference}</option>`).join('')}`;
    }
    function wireAll() {
        document.querySelectorAll('#bla-lines .line-row').forEach(row => {
            row.querySelector('.line-cat').onchange = e => populateProducts(row, e.target.value);
            row.querySelector('.remove-line').onclick = () => { if (document.getElementById('bla-lines').children.length > 1) row.remove(); };
        });
    }
    function collectLines() {
        const lines = []; document.querySelectorAll('#bla-lines .line-row').forEach(row => {
            const catSel = row.querySelector('.line-cat'), pSel = row.querySelector('.line-prod');
            if (pSel.value) {
                const cat = categories.find(c => c.id === catSel.value);
                const prod = produits.find(p => p.id === pSel.value);
                lines.push({ categorieId: catSel.value, categorieNom: cat?.nom || '', produitId: pSel.value, produitRef: prod?.reference || '', designation: prod?.reference || '', quantite: 1 });
            }
        }); return lines;
    }

    function viewBl(b) {
        showModal(`BL Achat - ${b.numero}`, `${printDocumentHeader(settings, 'BON DE LIVRAISON ACHAT', b.numero, b.date)}
      <div class="doc-info"><div class="doc-info-box"><p><strong>Fournisseur:</strong> ${b.fournisseurNom}</p></div><div class="doc-info-box"><p><strong>Statut:</strong> ${b.statut}</p></div></div>
      <table class="data-table"><thead><tr><th>Poteau</th></tr></thead><tbody>${(b.lignes || []).map(l => `<tr><td>${l.designation || l.produitRef || ''}</td></tr>`).join('')}</tbody></table>
      <p style="margin-top:8px;color:var(--text-secondary)">${(b.lignes || []).length} poteau(x)</p>`,
            `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button><button class="btn btn-primary" onclick="window.print()">🖨️</button>`);
    }
    render();
}
