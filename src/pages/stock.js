// Stock Page - Per-Category stock view + in-stock products list with filter & print
import { getAll } from '../data/store.js';
import { formatDate, formatCurrency } from '../utils/helpers.js';
import { paginate } from '../utils/pagination.js';

export async function renderStock() {
  const content = document.getElementById('page-content');
  const produits = await getAll('produits').catch(() => []);
  const types = await getAll('types').catch(() => []);
  const blAchats = await getAll('bl_achat').catch(() => []);
  const blVentes = await getAll('bl_vente').catch(() => []);
  let catPage = 1, prodPage = 1, catSearch = '', prodSearch = '', prodTypeFilter = '';

  // Build per-product stock from BLs
  const prodStockMap = {}; // produitId -> { entrees, sorties }
  blAchats.filter(b => b.statut === 'Réceptionné').forEach(bl => {
    (bl.lignes || []).forEach(l => {
      const pid = l.produitId || l.fromId;
      if (pid) { if (!prodStockMap[pid]) prodStockMap[pid] = { entrees: 0, sorties: 0 }; prodStockMap[pid].entrees += (l.quantite || 1); }
    });
  });
  blVentes.filter(b => b.statut === 'Livré').forEach(bl => {
    (bl.lignes || []).forEach(l => {
      const pid = l.produitId || l.fromId;
      if (pid) { if (!prodStockMap[pid]) prodStockMap[pid] = { entrees: 0, sorties: 0 }; prodStockMap[pid].sorties += (l.quantite || 1); }
    });
  });

  // Build per-category stock
  const catStockMap = {};
  types.forEach(c => { catStockMap[c.id] = { ...c, total: 0, entrees: 0, sorties: 0, enStock: 0 }; });
  produits.forEach(p => { if (catStockMap[p.typeId]) catStockMap[p.typeId].total++; });
  Object.entries(prodStockMap).forEach(([pid, s]) => {
    const p = produits.find(x => x.id === pid);
    if (p && catStockMap[p.typeId]) {
      catStockMap[p.typeId].entrees += s.entrees;
      catStockMap[p.typeId].sorties += s.sorties;
    }
  });
  Object.values(catStockMap).forEach(c => { c.enStock = c.entrees - c.sorties; });
  const catStockList = Object.values(catStockMap);

  // Build in-stock product list
  const inStockProducts = produits.map(p => {
    const s = prodStockMap[p.id] || { entrees: 0, sorties: 0 };
    const stock = s.entrees - s.sorties;
    const tp = types.find(t => t.id === p.typeId);
    return { ...p, entrees: s.entrees, sorties: s.sorties, stock, typeNom: tp?.nom || '-' };
  }).filter(p => p.stock > 0);

  const totalPoteaux = produits.length;
  const totalEntrees = catStockList.reduce((s, c) => s + c.entrees, 0);
  const totalSorties = catStockList.reduce((s, c) => s + c.sorties, 0);
  const totalEnStock = totalEntrees - totalSorties;

  function render() {
    // Filter categories
    let filteredCats = [...catStockList];
    if (catSearch) { const q = catSearch.toLowerCase(); filteredCats = filteredCats.filter(c => (c.nom || '').toLowerCase().includes(q) || (c.prefix || '').toLowerCase().includes(q)); }
    const pagedCats = paginate(filteredCats, catPage, 'cat-pagination', p => { catPage = p; render(); });

    // Filter in-stock products
    let filteredProds = [...inStockProducts];
    if (prodSearch) { const q = prodSearch.toLowerCase(); filteredProds = filteredProds.filter(p => (p.reference || '').toLowerCase().includes(q) || (p.designation || '').toLowerCase().includes(q)); }
    if (prodTypeFilter) filteredProds = filteredProds.filter(p => p.typeId === prodTypeFilter);
    const pagedProds = paginate(filteredProds, prodPage, 'prod-pagination', p => { prodPage = p; render(); });

    content.innerHTML = `
    <div class="page-header"><div><h1 class="page-title">📦 Gestion du Stock</h1><p class="page-subtitle">Stock par catégorie de poteaux</p></div></div>

    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-icon blue">🏗️</div><div class="kpi-info"><div class="kpi-label">Total Poteaux</div><div class="kpi-value">${totalPoteaux.toLocaleString('fr-FR')}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon green">📦</div><div class="kpi-info"><div class="kpi-label">En Stock</div><div class="kpi-value" style="color:var(--success)">${totalEnStock.toLocaleString('fr-FR')}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon orange">📥</div><div class="kpi-info"><div class="kpi-label">Total Entrées</div><div class="kpi-value">${totalEntrees.toLocaleString('fr-FR')}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon red">📤</div><div class="kpi-info"><div class="kpi-label">Total Sorties</div><div class="kpi-value">${totalSorties.toLocaleString('fr-FR')}</div></div></div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <h3 class="card-title">📊 Stock par Catégorie</h3>
      </div>
      <div class="filter-bar" style="margin:12px 0"><input type="text" class="filter-search" id="search-cat" placeholder="Rechercher catégorie..." value="${catSearch}"/></div>
      ${pagedCats.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Catégorie</th><th>Préfixe</th><th>Entrée</th><th>Sortie</th><th>En Stock</th></tr></thead><tbody>
        ${pagedCats.map(c => `<tr><td><strong style="color:var(--accent)">${c.nom || ''}</strong></td><td><code style="background:rgba(79,140,255,0.15);padding:2px 8px;border-radius:4px">${c.prefix || '-'}</code></td>
          <td><span class="badge badge-success">${c.entrees}</span></td>
          <td><span class="badge badge-danger">${c.sorties}</span></td>
          <td><span class="badge ${c.enStock > 0 ? 'badge-warning' : 'badge-danger'}" style="font-weight:700">${c.enStock}</span></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty-state"><div class="desc">Aucune catégorie</div></div>'}
      <div id="cat-pagination" class="pagination-container"></div>
    </div>

    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <h3 class="card-title">� Poteaux en Stock (${inStockProducts.length})</h3>
        <button class="btn btn-primary btn-sm" id="print-stock-btn">🖨️ Imprimer</button>
      </div>
      <div class="filter-bar" style="margin:12px 0;display:flex;gap:12px;flex-wrap:wrap">
        <input type="text" class="filter-search" id="search-prod" placeholder="Rechercher poteau..." value="${prodSearch}" style="flex:1;min-width:200px"/>
        <select class="form-select" id="filter-prod-cat" style="max-width:250px"><option value="">Tous types</option>${types.map(t => `<option value="${t.id}" ${prodTypeFilter === t.id ? 'selected' : ''}>${t.nom}</option>`).join('')}</select>
      </div>
      ${pagedProds.length ? `<div class="table-wrapper"><table class="data-table" id="stock-products-table"><thead><tr><th>Référence</th><th>Catégorie</th><th>Entrée</th><th>Sortie</th><th>En Stock</th></tr></thead><tbody>
        ${pagedProds.map(p => `<tr><td><strong style="color:var(--accent)">${p.reference || ''}</strong></td><td>${p.typeNom}</td>
          <td><span class="badge badge-success">${p.entrees}</span></td>
          <td><span class="badge badge-danger">${p.sorties}</span></td>
          <td><span class="badge ${p.stock > 0 ? 'badge-warning' : 'badge-danger'}" style="font-weight:700">${p.stock}</span></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty-state"><div class="desc">Aucun poteau en stock</div></div>'}
      <div id="prod-pagination" class="pagination-container"></div>
    </div>
  `;

    paginate(filteredCats, catPage, 'cat-pagination', p => { catPage = p; render(); });
    paginate(filteredProds, prodPage, 'prod-pagination', p => { prodPage = p; render(); });

    document.getElementById('search-cat')?.addEventListener('input', e => { catSearch = e.target.value; catPage = 1; render(); });
    document.getElementById('search-prod')?.addEventListener('input', e => { prodSearch = e.target.value; prodPage = 1; render(); });
    document.getElementById('filter-prod-cat')?.addEventListener('change', e => { prodTypeFilter = e.target.value; prodPage = 1; render(); });

    document.getElementById('print-stock-btn')?.addEventListener('click', () => {
      // Print filtered in-stock products
      const printProds = [...filteredProds];
      const printWin = window.open('', '_blank');
      printWin.document.write(`<html><head><title>Poteaux en Stock</title><style>
        body{font-family:Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f0f0f0;font-weight:bold}h1{text-align:center;font-size:18px}
        .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600}
        .badge-s{background:#d4edda;color:#155724}.badge-d{background:#f8d7da;color:#721c24}.badge-w{background:#fff3cd;color:#856404}
        @media print{body{padding:0}}
      </style></head><body>
        <h1>📦 Poteaux en Stock — ${new Date().toLocaleDateString('fr-FR')}</h1>
        <p>${printProds.length} poteau(x)</p>
        <table><thead><tr><th>Référence</th><th>Catégorie</th><th>Entrée</th><th>Sortie</th><th>En Stock</th></tr></thead><tbody>
        ${printProds.map(p => `<tr><td>${p.reference || ''}</td><td>${p.typeNom}</td><td>${p.entrees}</td><td>${p.sorties}</td><td><strong>${p.stock}</strong></td></tr>`).join('')}
        </tbody></table>
      </body></html>`);
      printWin.document.close(); printWin.focus(); setTimeout(() => printWin.print(), 300);
    });
  }
  render();
}
