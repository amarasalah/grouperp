// Stock Page - Per-Category stock view with search & pagination
import { getAll } from '../data/store.js';
import { formatDate } from '../utils/helpers.js';
import { paginate } from '../utils/pagination.js';

export async function renderStock() {
  const content = document.getElementById('page-content');
  const produits = await getAll('produits').catch(() => []);
  const categories = await getAll('categories').catch(() => []);
  const mouvements = await getAll('stock_mouvements').catch(() => []);
  let catPage = 1, mvtPage = 1, catSearch = '';

  // Calculate stock per category
  const catStockMap = {};
  categories.forEach(c => { catStockMap[c.id] = { ...c, total: 0, enStock: 0 }; });
  produits.forEach(p => {
    if (catStockMap[p.categorieId]) {
      catStockMap[p.categorieId].total++;
      if ((p.stock || 0) > 0) catStockMap[p.categorieId].enStock++;
    }
  });
  const catStockList = Object.values(catStockMap);

  const totalPoteaux = produits.length;
  const totalEnStock = produits.filter(p => (p.stock || 0) > 0).length;
  const totalEntrees = mouvements.filter(m => m.type === 'entree').reduce((s, m) => s + (m.quantite || 0), 0);
  const totalSorties = mouvements.filter(m => m.type === 'sortie').reduce((s, m) => s + (m.quantite || 0), 0);

  function render() {
    let filteredCats = [...catStockList];
    if (catSearch) { const q = catSearch.toLowerCase(); filteredCats = filteredCats.filter(c => (c.nom || '').toLowerCase().includes(q) || (c.prefix || '').toLowerCase().includes(q)); }
    const pagedCats = paginate(filteredCats, catPage, 'cat-pagination', p => { catPage = p; render(); });
    const sortedMvt = [...mouvements].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const pagedMvt = paginate(sortedMvt, mvtPage, 'mvt-pagination', p => { mvtPage = p; render(); });

    content.innerHTML = `
    <div class="page-header"><div><h1 class="page-title">📦 Gestion du Stock</h1><p class="page-subtitle">Stock par catégorie de poteaux</p></div></div>

    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-icon blue">🏗️</div><div class="kpi-info"><div class="kpi-label">Total Poteaux</div><div class="kpi-value">${totalPoteaux.toLocaleString('fr-FR')}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon green">📦</div><div class="kpi-info"><div class="kpi-label">En Stock</div><div class="kpi-value" style="color:var(--success)">${totalEnStock.toLocaleString('fr-FR')}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon orange">📥</div><div class="kpi-info"><div class="kpi-label">Total Entrées</div><div class="kpi-value">${totalEntrees.toLocaleString('fr-FR')}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon red">📤</div><div class="kpi-info"><div class="kpi-label">Total Sorties</div><div class="kpi-value">${totalSorties.toLocaleString('fr-FR')}</div></div></div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
      <div class="card">
        <div class="card-header"><h3 class="card-title">📊 Stock par Catégorie</h3></div>
        <div class="filter-bar" style="margin:12px 0"><input type="text" class="filter-search" id="search-stock" placeholder="Rechercher catégorie..." value="${catSearch}"/></div>
        ${pagedCats.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Catégorie</th><th>Préfixe</th><th>Total Poteaux</th><th>En Stock</th><th>Disponible</th></tr></thead><tbody>
          ${pagedCats.map(c => {
      const pct = c.total > 0 ? Math.round(c.enStock / c.total * 100) : 0;
      return `<tr><td><strong style="color:var(--accent)">${c.nom || ''}</strong></td><td><code style="background:rgba(79,140,255,0.15);padding:2px 8px;border-radius:4px">${c.prefix || '-'}</code></td>
            <td>${c.total}</td>
            <td><span class="badge ${c.enStock > 0 ? 'badge-success' : 'badge-danger'}">${c.enStock}</span></td>
            <td><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:6px;background:var(--bg-input);border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${pct > 50 ? 'var(--success)' : pct > 20 ? 'var(--warning)' : 'var(--danger)'};border-radius:3px"></div></div><span style="font-size:0.8rem;color:var(--text-secondary)">${pct}%</span></div></td></tr>`;
    }).join('')}
        </tbody></table></div>`: '<div class="empty-state"><div class="desc">Aucune catégorie</div></div>'}
        <div id="cat-pagination" class="pagination-container"></div>
      </div>

      <div class="card">
        <div class="card-header"><h3 class="card-title">📜 Journal des Mouvements</h3></div>
        ${pagedMvt.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Produit</th><th>Qté</th><th>Réf.</th></tr></thead><tbody>
          ${pagedMvt.map(m => {
      const p = produits.find(x => x.id === m.produitId);
      return `<tr><td>${formatDate(m.date)}</td>
            <td><span class="badge ${m.type === 'entree' ? 'badge-success' : 'badge-danger'}">${m.type === 'entree' ? 'Entrée' : 'Sortie'}</span></td>
            <td>${p?.reference || p?.designation || m.produitId}</td><td>${m.quantite}</td><td>${m.reference || '-'}</td></tr>`;
    }).join('')}
        </tbody></table></div>`: '<div class="empty-state"><div class="desc">Aucun mouvement</div></div>'}
        <div id="mvt-pagination" class="pagination-container"></div>
      </div>
    </div>
  `;

    paginate(filteredCats, catPage, 'cat-pagination', p => { catPage = p; render(); });
    paginate(sortedMvt, mvtPage, 'mvt-pagination', p => { mvtPage = p; render(); });

    document.getElementById('search-stock')?.addEventListener('input', e => {
      catSearch = e.target.value; catPage = 1; render();
    });
  }
  render();
}
