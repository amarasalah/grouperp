// Produits (Poteaux) Page - Read-only list of all items across types, with filters
import { getAll } from '../data/store.js';
import { formatDate } from '../utils/helpers.js';
import { paginate } from '../utils/pagination.js';
import { getSelectedBcgId, isAllBcgMode } from './bcg-select.js';

export async function renderProduits() {
  const content = document.getElementById('page-content');
  let produits = await getAll('produits').catch(() => []);
  const types = await getAll('types').catch(() => []);
  const allBcgs = await getAll('bcg').catch(() => []);
  let currentPage = 1, currentFilters = {};

  const bcgId = getSelectedBcgId();
  const allMode = isAllBcgMode();

  let displayProducts = produits;
  if (!allMode && bcgId && bcgId !== 'all') {
    displayProducts = produits.filter(p => p.bcgId === bcgId);
  }

  let typeFilter = '', searchTerm = '';

  function render(page = currentPage) {
    currentPage = page;
    let filtered = [...displayProducts];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(p => (p.reference || '').toLowerCase().includes(q) || (p.designation || '').toLowerCase().includes(q) || (p.typeNom || '').toLowerCase().includes(q) || (p.fournisseurNom || '').toLowerCase().includes(q));
    }
    if (typeFilter) filtered = filtered.filter(p => p.typeId === typeFilter);
    const paged = paginate(filtered, page, 'pagination-controls', p => render(p));

    content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">🏗️ Produits (Poteaux)</h1><p class="page-subtitle">Liste de tous les poteaux créés</p></div></div>
      <div class="kpi-grid" style="margin-bottom:20px">
        <div class="kpi-card"><div class="kpi-icon blue">🏗️</div><div class="kpi-info"><div class="kpi-label">Total Poteaux</div><div class="kpi-value">${displayProducts.length}</div></div></div>
        <div class="kpi-card"><div class="kpi-icon green">📁</div><div class="kpi-info"><div class="kpi-label">Types</div><div class="kpi-value">${types.length}</div></div></div>
        <div class="kpi-card"><div class="kpi-icon orange">🔍</div><div class="kpi-info"><div class="kpi-label">Résultats</div><div class="kpi-value">${filtered.length}</div></div></div>
      </div>
      <div class="filter-bar" style="margin-bottom:16px;">
        <input type="text" class="filter-search" id="prod-search" placeholder="Rechercher par référence, type, fournisseur..." value="${searchTerm}" style="flex:1;min-width:200px;"/>
        <div class="filter-group"><label>Type:</label><select class="form-select" id="prod-type-filter"><option value="">Tous</option>${types.map(t => `<option value="${t.id}" ${typeFilter === t.id ? 'selected' : ''}>${t.nom} (${t.prefix})</option>`).join('')}</select></div>
      </div>
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Référence</th><th>Type</th><th>Désignation</th><th>Fournisseur</th><th>BCG</th><th>Date</th></tr></thead><tbody>
        ${paged.map(p => {
      const tp = types.find(t => t.id === p.typeId);
      const bcgDoc = p.bcgId ? allBcgs.find(b => b.id === p.bcgId) : null;
      return `<tr><td><strong style="color:var(--accent)">${p.reference || ''}</strong></td><td>${tp?.nom || p.typeNom || '-'}</td><td>${p.designation || ''}</td><td>${p.fournisseurNom || '-'}</td>
            <td><small style="color:var(--text-muted)">${bcgDoc?.numero || '-'}</small></td>
            <td>${formatDate(p.createdAt)}</td></tr>`;
    }).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">🏗️</div><div class="title">Aucun poteau trouvé</div><div class="desc">Créez des poteaux depuis la page Types</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;

    paginate(filtered, page, 'pagination-controls', p => render(p));
    document.getElementById('prod-search')?.addEventListener('input', e => { searchTerm = e.target.value; render(1); });
    document.getElementById('prod-type-filter')?.addEventListener('change', e => { typeFilter = e.target.value; render(1); });
  }

  render();
}
