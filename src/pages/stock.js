// Stock Page - Per-Category stock view with search & pagination
import { getAll } from '../data/store.js';
import { formatDate } from '../utils/helpers.js';
import { paginate } from '../utils/pagination.js';

export async function renderStock() {
  const content = document.getElementById('page-content');
  const produits = await getAll('produits').catch(() => []);
  const categories = await getAll('categories').catch(() => []);
  const blAchats = await getAll('bl_achat').catch(() => []);
  const blVentes = await getAll('bl_vente').catch(() => []);
  const mouvements = await getAll('stock_mouvements').catch(() => []);
  let catPage = 1, mvtPage = 1, catSearch = '';

  // Calculate stock per category from BL Achat (entree) and BL Vente (sortie)
  const catStockMap = {};
  categories.forEach(c => { catStockMap[c.id] = { ...c, total: 0, entrees: 0, sorties: 0, enStock: 0 }; });
  produits.forEach(p => {
    if (catStockMap[p.categorieId]) catStockMap[p.categorieId].total++;
  });
  // Entrée = poteaux from BL Achat validés (Réceptionné)
  blAchats.filter(b => b.statut === 'Réceptionné').forEach(bl => {
    (bl.lignes || []).forEach(l => {
      const prodId = l.produitId || l.fromId;
      const prod = prodId ? produits.find(p => p.id === prodId) : null;
      if (prod && catStockMap[prod.categorieId]) {
        catStockMap[prod.categorieId].entrees += (l.quantite || 1);
      }
    });
  });
  // Sortie = poteaux from BL Vente validés (Livré)
  blVentes.filter(b => b.statut === 'Livré').forEach(bl => {
    (bl.lignes || []).forEach(l => {
      const prodId = l.produitId || l.fromId;
      const prod = prodId ? produits.find(p => p.id === prodId) : null;
      if (prod && catStockMap[prod.categorieId]) {
        catStockMap[prod.categorieId].sorties += (l.quantite || 1);
      }
    });
  });
  // En Stock = Entrée - Sortie
  Object.values(catStockMap).forEach(c => { c.enStock = c.entrees - c.sorties; });
  const catStockList = Object.values(catStockMap);

  const totalPoteaux = produits.length;
  const totalEntrees = catStockList.reduce((s, c) => s + c.entrees, 0);
  const totalSorties = catStockList.reduce((s, c) => s + c.sorties, 0);
  const totalEnStock = totalEntrees - totalSorties;

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
        ${pagedCats.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Catégorie</th><th>Préfixe</th><th>Entrée</th><th>Sortie</th><th>En Stock</th></tr></thead><tbody>
          ${pagedCats.map(c => {
      return `<tr><td><strong style="color:var(--accent)">${c.nom || ''}</strong></td><td><code style="background:rgba(79,140,255,0.15);padding:2px 8px;border-radius:4px">${c.prefix || '-'}</code></td>
            <td><span class="badge badge-success">${c.entrees}</span></td>
            <td><span class="badge badge-danger">${c.sorties}</span></td>
            <td><span class="badge ${c.enStock > 0 ? 'badge-warning' : 'badge-danger'}" style="font-weight:700">${c.enStock}</span></td></tr>`;
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
