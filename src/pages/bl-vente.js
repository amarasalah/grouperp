// BL Vente Page - created from BC Vente conversion, validate for stock sortie
import { getAll, update, remove, getSettings, updateStock } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatDate, formatCurrency, printDocumentHeader } from '../utils/helpers.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';

export async function renderBlVente() {
    const content = document.getElementById('page-content');
    let bls = await getAll('bl_vente').catch(() => []);
    const settings = await getSettings();
    let currentPage = 1, currentFilters = {};

    function render(filters = currentFilters, page = currentPage) {
        currentFilters = filters; currentPage = page;
        const filtered = applyFilters(bls, { ...filters, searchFields: ['numero', 'clientNom', 'bcRef'] });
        const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));
        content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">🚛 Bon de Livraison Vente</h1><p class="page-subtitle">Livraisons clients — créés à partir des BC Vente</p></div></div>
      ${filterBarHTML({ showStatus: true, statusOptions: ['En attente', 'Livré'] })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>N° BL</th><th>Date</th><th>Client</th><th>Réf. BC</th><th>Nb Poteaux</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(b => `<tr><td><strong style="color:var(--accent)">${b.numero || ''}</strong></td><td>${formatDate(b.date)}</td><td>${b.clientNom || '-'}</td><td>${b.bcRef || '-'}</td><td>${(b.lignes || []).length}</td>
          <td><span class="badge ${b.statut === 'Livré' ? 'badge-success' : 'badge-warning'}">${b.statut || 'En attente'}</span></td>
          <td class="actions"><button class="btn btn-sm btn-secondary view-blv" data-id="${b.id}">👁️</button>${b.statut !== 'Livré' ? `<button class="btn btn-sm btn-success validate-blv" data-id="${b.id}">✓</button>` : ''}<button class="btn btn-sm btn-danger delete-blv" data-id="${b.id}">🗑️</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">🚛</div><div class="title">Aucun BL vente</div><div class="desc">Les BL vente sont créés depuis la page Bon de Commande Vente</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;
        paginate(filtered, page, 'pagination-controls', p => render(filters, p));
        wireFilters((f, p) => render(f, p));
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

    function viewBl(b) {
        showModal(`BL Vente - ${b.numero}`, `${printDocumentHeader(settings, 'BON DE LIVRAISON VENTE', b.numero, b.date)}
      <div class="doc-info"><div class="doc-info-box"><p><strong>Client:</strong> ${b.clientNom}</p><p><strong>Réf. BC:</strong> ${b.bcRef || '-'}</p></div><div class="doc-info-box"><p><strong>Statut:</strong> ${b.statut}</p></div></div>
      <table class="data-table"><thead><tr><th>Poteau</th><th>Catégorie</th><th>Prix Vente</th></tr></thead><tbody>${(b.lignes || []).map(l => `<tr><td>${l.designation || l.produitRef || ''}</td><td>${l.categorieNom || '-'}</td><td>${formatCurrency(l.prixUnitaire || 0)}</td></tr>`).join('')}</tbody></table>
      <p style="margin-top:8px;color:var(--text-secondary)">${(b.lignes || []).length} poteau(x)</p>`,
            `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button><button class="btn btn-primary" onclick="window.print()">🖨️</button>`);
    }
    render();
}
