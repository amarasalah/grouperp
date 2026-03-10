// Dashboard Page - Comprehensive stats, charts, and alerts
import { getAll, getSettings } from '../data/store.js';
import { formatCurrency, formatDate } from '../utils/helpers.js';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const COLORS = ['#4f8cff','#34d399','#fbbf24','#f87171','#a78bfa','#fb923c','#38bdf8','#e879f9','#4ade80','#f472b6'];
const OVERDUE_DAYS = 45;

function daysSince(dateStr) {
  if (!dateStr) return 999;
  const d = new Date(dateStr);
  if (isNaN(d)) return 999;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function getMonthLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

function destroyCharts(ids) {
  ids.forEach(id => { const c = Chart.getChart(id); if (c) c.destroy(); });
}

export async function renderDashboard() {
  const content = document.getElementById('page-content');

  const [produits, fournisseurs, clients, lots, categories, blAchat, blVente, bcVente, facturesAchat, facturesVente, reglements] = await Promise.all([
    getAll('produits').catch(() => []),
    getAll('fournisseurs').catch(() => []),
    getAll('clients').catch(() => []),
    getAll('lots').catch(() => []),
    getAll('categories').catch(() => []),
    getAll('bl_achat').catch(() => []),
    getAll('bl_vente').catch(() => []),
    getAll('bc_vente').catch(() => []),
    getAll('factures_achat').catch(() => []),
    getAll('factures_vente').catch(() => []),
    getAll('reglements').catch(() => [])
  ]);

  // ── KPI calculations ──
  const totalProduits = produits.length;
  const receivedBL = blAchat.filter(b => b.statut === 'Réceptionné');
  const deliveredBL = blVente.filter(b => b.statut === 'Livré');
  const receivedCount = receivedBL.reduce((s, b) => s + (b.lignes || []).length, 0);
  const deliveredCount = deliveredBL.reduce((s, b) => s + (b.lignes || []).length, 0);
  const generalStock = receivedCount - deliveredCount;
  const totalAchatTTC = facturesAchat.reduce((s, f) => s + (f.totalTTC || 0), 0);
  const totalVenteTTC = facturesVente.reduce((s, f) => s + (f.totalTTC || 0), 0);
  const totalReglementsAchat = reglements.filter(r => r.typeFacture === 'Achat').reduce((s, r) => s + (r.montant || 0), 0);
  const totalReglementsVente = reglements.filter(r => r.typeFacture === 'Vente').reduce((s, r) => s + (r.montant || 0), 0);

  // ── Stock by Lot ──
  const lotStockData = lots.map(lot => {
    const lotProds = produits.filter(p => p.lotId === lot.id);
    let entrees = 0, sorties = 0;
    receivedBL.forEach(bl => (bl.lignes || []).forEach(l => { if (l.lotId === lot.id) entrees++; }));
    deliveredBL.forEach(bl => (bl.lignes || []).forEach(l => { if (l.lotId === lot.id) sorties++; }));
    return { numero: lot.numero, total: lotProds.length, max: lot.maxProduits || 0, entrees, sorties, stock: entrees - sorties };
  });

  // ── Stock by Category ──
  const catStockData = categories.map(cat => {
    let entrees = 0, sorties = 0;
    receivedBL.forEach(bl => (bl.lignes || []).forEach(l => { if (l.categorieId === cat.id) entrees++; }));
    deliveredBL.forEach(bl => (bl.lignes || []).forEach(l => { if (l.categorieId === cat.id) sorties++; }));
    return { nom: cat.nom, prefix: cat.prefix, entrees, sorties, stock: entrees - sorties };
  });

  // ── Monthly document stats (last 6 months) ──
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: d.toLocaleDateString('fr-FR', { month:'short', year:'2-digit' }) });
  }
  function countByMonth(docs) { return months.map(m => docs.filter(d => (d.date || '').startsWith(m.key)).length); }
  function sumByMonth(docs, field='totalTTC') { return months.map(m => docs.filter(d => (d.date || '').startsWith(m.key)).reduce((s,d) => s + (d[field]||0), 0)); }
  const monthlyBLA = countByMonth(blAchat);
  const monthlyBLV = countByMonth(blVente);
  const monthlyBCV = countByMonth(bcVente);
  const monthlyFA = countByMonth(facturesAchat);
  const monthlyFV = countByMonth(facturesVente);
  const monthlyAmountFA = sumByMonth(facturesAchat);
  const monthlyAmountFV = sumByMonth(facturesVente);

  // ── Overdue invoices (>45 days unpaid) ──
  const allFactures = [
    ...facturesAchat.map(f => ({ ...f, type: 'Achat', collection: 'factures_achat' })),
    ...facturesVente.map(f => ({ ...f, type: 'Vente', collection: 'factures_vente' }))
  ];
  const overdueInvoices = allFactures.filter(f => {
    if (f.regle) return false;
    const days = daysSince(f.date);
    return days > OVERDUE_DAYS;
  }).map(f => ({ ...f, daysOld: daysSince(f.date), paye: reglements.filter(r => r.factureId === f.id).reduce((s,r) => s + (r.montant||0), 0) }));

  // ── Payment progress per invoice (for bullet/gauge) ──
  const unpaidInvoices = allFactures.filter(f => !f.regle).map(f => {
    const paye = reglements.filter(r => r.factureId === f.id).reduce((s,r) => s + (r.montant||0), 0);
    return { ...f, paye, reste: (f.totalTTC||0) - paye, pct: f.totalTTC ? Math.min(100, Math.round(paye / f.totalTTC * 100)) : 0, daysOld: daysSince(f.date) };
  }).sort((a,b) => b.daysOld - a.daysOld).slice(0, 8);

  // ── Radar: category distribution (products, received, delivered) ──
  const radarLabels = categories.map(c => c.nom || c.prefix);
  const radarProduits = categories.map(c => produits.filter(p => p.categorieId === c.id).length);
  const radarReceived = catStockData.map(c => c.entrees);
  const radarDelivered = catStockData.map(c => c.sorties);

  // ── Bubble: Lots (x=products, y=stock, r=maxProduits) ──
  const bubbleData = lotStockData.map((l, i) => ({ x: l.total, y: l.stock, r: Math.max(5, Math.min(30, l.max / 2)), label: l.numero }));

  // ── HTML ──
  content.innerHTML = `
  <div class="page-header"><div>
    <h1 class="page-title">📊 Tableau de Bord</h1>
    <p class="page-subtitle">Vue d'ensemble complète — Stock, Documents, Finances, Alertes</p>
  </div></div>

  ${overdueInvoices.length ? `
  <div class="card" style="margin-bottom:20px;border-left:4px solid var(--danger);background:rgba(248,113,113,0.06)">
    <div class="card-header"><h3 class="card-title" style="color:var(--danger)">⚠️ Alertes — Factures impayées > ${OVERDUE_DAYS} jours (${overdueInvoices.length})</h3></div>
    <div class="table-wrapper"><table class="data-table"><thead><tr><th>N°</th><th>Type</th><th>Tiers</th><th>Date</th><th>Jours</th><th>Total TTC</th><th>Payé</th><th>Reste</th></tr></thead><tbody>
      ${overdueInvoices.map(f => {
        const reste = (f.totalTTC||0) - f.paye;
        const urgency = f.daysOld > 90 ? 'color:var(--danger);font-weight:700' : f.daysOld > 60 ? 'color:var(--warning);font-weight:600' : '';
        return `<tr><td><strong style="color:var(--accent)">${f.numero||'-'}</strong></td>
          <td><span class="badge ${f.type==='Vente'?'badge-success':'badge-warning'}">${f.type}</span></td>
          <td>${f.fournisseurNom||f.clientNom||'-'}</td><td>${formatDate(f.date)}</td>
          <td style="${urgency}">${f.daysOld}j</td><td>${formatCurrency(f.totalTTC)}</td>
          <td>${formatCurrency(f.paye)}</td><td style="color:var(--danger);font-weight:600">${formatCurrency(reste)}</td></tr>`;
      }).join('')}
    </tbody></table></div>
  </div>` : ''}

  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-icon blue">📦</div><div class="kpi-info"><div class="kpi-label">Stock Général</div><div class="kpi-value">${generalStock}</div></div></div>
    <div class="kpi-card"><div class="kpi-icon green">📥</div><div class="kpi-info"><div class="kpi-label">Réceptionné</div><div class="kpi-value">${receivedCount}</div></div></div>
    <div class="kpi-card"><div class="kpi-icon orange">📤</div><div class="kpi-info"><div class="kpi-label">Livré</div><div class="kpi-value">${deliveredCount}</div></div></div>
    <div class="kpi-card"><div class="kpi-icon red">🏗️</div><div class="kpi-info"><div class="kpi-label">Total Produits</div><div class="kpi-value">${totalProduits}</div></div></div>
  </div>

  <div class="kpi-grid" style="margin-top:12px">
    <div class="kpi-card"><div class="kpi-icon green">💰</div><div class="kpi-info"><div class="kpi-label">CA Ventes TTC</div><div class="kpi-value" style="font-size:1rem">${formatCurrency(totalVenteTTC)}</div></div></div>
    <div class="kpi-card"><div class="kpi-icon orange">💸</div><div class="kpi-info"><div class="kpi-label">Achats TTC</div><div class="kpi-value" style="font-size:1rem">${formatCurrency(totalAchatTTC)}</div></div></div>
    <div class="kpi-card"><div class="kpi-icon blue">💳</div><div class="kpi-info"><div class="kpi-label">Payé (Vente)</div><div class="kpi-value" style="font-size:1rem">${formatCurrency(totalReglementsVente)}</div></div></div>
    <div class="kpi-card"><div class="kpi-icon red">💳</div><div class="kpi-info"><div class="kpi-label">Payé (Achat)</div><div class="kpi-value" style="font-size:1rem">${formatCurrency(totalReglementsAchat)}</div></div></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px">
    <!-- Bar: Stock by Lot -->
    <div class="card"><div class="card-header"><h3 class="card-title">📦 Stock par Lot</h3></div>
      <div style="position:relative;height:280px"><canvas id="chart-lot-stock"></canvas></div></div>
    <!-- Bar: Stock by Category -->
    <div class="card"><div class="card-header"><h3 class="card-title">📂 Stock par Catégorie</h3></div>
      <div style="position:relative;height:280px"><canvas id="chart-cat-stock"></canvas></div></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px">
    <!-- Column: Monthly documents -->
    <div class="card"><div class="card-header"><h3 class="card-title">📄 Documents Mensuels (6 mois)</h3></div>
      <div style="position:relative;height:280px"><canvas id="chart-monthly-docs"></canvas></div></div>
    <!-- Column: Monthly invoice amounts -->
    <div class="card"><div class="card-header"><h3 class="card-title">💰 Montants Factures Mensuels</h3></div>
      <div style="position:relative;height:280px"><canvas id="chart-monthly-amounts"></canvas></div></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px">
    <!-- Radar: Category Distribution -->
    <div class="card"><div class="card-header"><h3 class="card-title">🕸️ Répartition par Catégorie</h3></div>
      <div style="position:relative;height:300px"><canvas id="chart-radar"></canvas></div></div>
    <!-- Bubble: Lots Overview -->
    <div class="card"><div class="card-header"><h3 class="card-title">🫧 Vue Lots (Produits vs Stock)</h3></div>
      <div style="position:relative;height:300px"><canvas id="chart-bubble"></canvas></div></div>
  </div>

  <!-- Bullet Graphs: Payment progress -->
  <div class="card" style="margin-top:20px">
    <div class="card-header"><h3 class="card-title">🎯 Progression Règlements — Factures Impayées</h3></div>
    ${unpaidInvoices.length ? `
    <div style="display:flex;flex-direction:column;gap:14px;padding:4px 0">
      ${unpaidInvoices.map(f => {
        const barColor = f.daysOld > OVERDUE_DAYS ? '#f87171' : f.pct > 70 ? '#34d399' : f.pct > 30 ? '#fbbf24' : '#4f8cff';
        const overdueBadge = f.daysOld > OVERDUE_DAYS ? `<span style="color:#f87171;font-weight:700;font-size:0.75rem;margin-left:6px">⚠ ${f.daysOld}j</span>` : '';
        return `<div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-weight:600;font-size:0.85rem"><span style="color:var(--accent)">${f.numero}</span> — ${f.fournisseurNom||f.clientNom||'-'} <span class="badge ${f.type==='Vente'?'badge-success':'badge-warning'}" style="font-size:0.7rem">${f.type}</span>${overdueBadge}</span>
            <span style="font-size:0.8rem;color:var(--text-secondary)">${formatCurrency(f.paye)} / ${formatCurrency(f.totalTTC)} (${f.pct}%)</span>
          </div>
          <div style="height:18px;background:var(--bg-input);border-radius:10px;overflow:hidden;position:relative">
            <div style="height:100%;width:${f.pct}%;background:${barColor};border-radius:10px;transition:width 0.5s"></div>
            <div style="position:absolute;right:6px;top:1px;font-size:0.7rem;font-weight:700;color:var(--text-primary)">${f.pct}%</div>
          </div>
        </div>`;
      }).join('')}
    </div>` : '<p style="color:var(--text-muted);padding:12px;text-align:center">Toutes les factures sont réglées ✓</p>'}
  </div>

  <!-- Gauge-style: Global payment coverage -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px">
    <div class="card"><div class="card-header"><h3 class="card-title">📈 Couverture Règlements Achat</h3></div>
      <div style="position:relative;height:200px"><canvas id="chart-gauge-achat"></canvas></div></div>
    <div class="card"><div class="card-header"><h3 class="card-title">📈 Couverture Règlements Vente</h3></div>
      <div style="position:relative;height:200px"><canvas id="chart-gauge-vente"></canvas></div></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px">
    <div class="card">
      <div class="card-header"><h3 class="card-title">📊 Résumé Entités</h3></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        ${[
          { v: lots.length, l: 'Lots', c: '#4f8cff' },
          { v: categories.length, l: 'Catégories', c: '#34d399' },
          { v: produits.length, l: 'Produits', c: '#fbbf24' },
          { v: fournisseurs.length, l: 'Fournisseurs', c: '#fb923c' },
          { v: clients.length, l: 'Clients', c: '#a78bfa' },
          { v: blAchat.length, l: 'BL Achat', c: '#38bdf8' },
          { v: bcVente.length, l: 'BC Vente', c: '#4ade80' },
          { v: blVente.length, l: 'BL Vente', c: '#e879f9' },
          { v: facturesAchat.length + facturesVente.length, l: 'Factures', c: '#f87171' },
        ].map(k => `<div style="padding:12px;background:var(--bg-input);border-radius:var(--radius-md);text-align:center;border-left:3px solid ${k.c}">
          <div style="font-size:1.4rem;font-weight:700;color:${k.c}">${k.v}</div>
          <div style="font-size:0.78rem;color:var(--text-secondary)">${k.l}</div>
        </div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3 class="card-title">📄 Documents Récents</h3></div>
      ${(() => {
        const recent = [...facturesAchat.map(f=>({...f,dt:'FA'})),...facturesVente.map(f=>({...f,dt:'FV'})),...blAchat.map(f=>({...f,dt:'BLA'})),...bcVente.map(f=>({...f,dt:'BCV'}))].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,8);
        return recent.length ? `<div style="display:flex;flex-direction:column;gap:6px">${recent.map(d=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--bg-input);border-radius:var(--radius-sm)">
          <div><span class="badge ${d.dt.startsWith('F')?'badge-warning':'badge-success'}" style="font-size:0.7rem">${d.dt}</span> <strong style="margin-left:4px">${d.numero||'-'}</strong></div>
          <span style="font-size:0.8rem;color:var(--text-secondary)">${formatDate(d.date)} ${d.totalTTC ? '— '+formatCurrency(d.totalTTC) : ''}</span>
        </div>`).join('')}</div>` : '<p style="color:var(--text-muted);text-align:center;padding:12px">Aucun document</p>';
      })()}
    </div>
  </div>

  <!-- Lot Stock Table -->
  <div class="card" style="margin-top:20px">
    <div class="card-header"><h3 class="card-title">📦 Détail Stock par Lot</h3></div>
    ${lotStockData.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Lot</th><th>Produits</th><th>Max</th><th>Réceptionné</th><th>Livré</th><th>En Stock</th><th>Remplissage</th></tr></thead><tbody>
      ${lotStockData.map(l => {
        const fillPct = l.max ? Math.round(l.total / l.max * 100) : 0;
        return `<tr><td><strong style="color:var(--accent)">${l.numero}</strong></td><td>${l.total}</td><td>${l.max}</td>
          <td><span class="badge badge-success">${l.entrees}</span></td><td><span class="badge badge-danger">${l.sorties}</span></td>
          <td><span class="badge ${l.stock>0?'badge-warning':'badge-danger'}" style="font-weight:700">${l.stock}</span></td>
          <td><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:8px;background:var(--bg-input);border-radius:4px;overflow:hidden"><div style="height:100%;width:${fillPct}%;background:${fillPct>=100?'#f87171':fillPct>=70?'#fbbf24':'#34d399'};border-radius:4px"></div></div><span style="font-size:0.78rem;font-weight:600">${fillPct}%</span></div></td></tr>`;
      }).join('')}
    </tbody></table></div>` : '<p style="color:var(--text-muted);text-align:center;padding:12px">Aucun lot</p>'}
  </div>
  `;

  // ── Render Charts ──
  destroyCharts(['chart-lot-stock','chart-cat-stock','chart-monthly-docs','chart-monthly-amounts','chart-radar','chart-bubble','chart-gauge-achat','chart-gauge-vente']);

  // Bar: Stock by Lot
  if (lotStockData.length) {
    new Chart(document.getElementById('chart-lot-stock'), {
      type: 'bar', data: {
        labels: lotStockData.map(l => l.numero),
        datasets: [
          { label: 'Réceptionné', data: lotStockData.map(l => l.entrees), backgroundColor: '#34d399' },
          { label: 'Livré', data: lotStockData.map(l => l.sorties), backgroundColor: '#f87171' },
          { label: 'En Stock', data: lotStockData.map(l => l.stock), backgroundColor: '#4f8cff' }
        ]
      }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } } }, scales: { y: { beginAtZero: true } } }
    });
  }

  // Bar: Stock by Category
  if (catStockData.length) {
    new Chart(document.getElementById('chart-cat-stock'), {
      type: 'bar', data: {
        labels: catStockData.map(c => c.nom),
        datasets: [
          { label: 'Entrées', data: catStockData.map(c => c.entrees), backgroundColor: '#34d399' },
          { label: 'Sorties', data: catStockData.map(c => c.sorties), backgroundColor: '#fb923c' },
          { label: 'Stock', data: catStockData.map(c => c.stock), backgroundColor: '#4f8cff' }
        ]
      }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } } }, scales: { y: { beginAtZero: true } } }
    });
  }

  // Column: Monthly Documents
  new Chart(document.getElementById('chart-monthly-docs'), {
    type: 'bar', data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: 'BL Achat', data: monthlyBLA, backgroundColor: '#38bdf8' },
        { label: 'BC Vente', data: monthlyBCV, backgroundColor: '#4ade80' },
        { label: 'BL Vente', data: monthlyBLV, backgroundColor: '#e879f9' },
        { label: 'Fact. Achat', data: monthlyFA, backgroundColor: '#fbbf24' },
        { label: 'Fact. Vente', data: monthlyFV, backgroundColor: '#f87171' }
      ]
    }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 10 } } } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });

  // Column: Monthly Invoice Amounts
  new Chart(document.getElementById('chart-monthly-amounts'), {
    type: 'bar', data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: 'Achats TTC', data: monthlyAmountFA, backgroundColor: '#fbbf24' },
        { label: 'Ventes TTC', data: monthlyAmountFV, backgroundColor: '#34d399' }
      ]
    }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } } }, scales: { y: { beginAtZero: true } } }
  });

  // Radar: Category Distribution
  if (radarLabels.length) {
    new Chart(document.getElementById('chart-radar'), {
      type: 'radar', data: {
        labels: radarLabels,
        datasets: [
          { label: 'Produits', data: radarProduits, borderColor: '#4f8cff', backgroundColor: 'rgba(79,140,255,0.15)', pointBackgroundColor: '#4f8cff' },
          { label: 'Réceptionné', data: radarReceived, borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.15)', pointBackgroundColor: '#34d399' },
          { label: 'Livré', data: radarDelivered, borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.15)', pointBackgroundColor: '#f87171' }
        ]
      }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } } }, scales: { r: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
  }

  // Bubble: Lots
  if (bubbleData.length) {
    new Chart(document.getElementById('chart-bubble'), {
      type: 'bubble', data: {
        datasets: lotStockData.map((l, i) => ({
          label: l.numero,
          data: [{ x: l.total, y: l.stock, r: Math.max(6, Math.min(25, l.max / 3)) }],
          backgroundColor: COLORS[i % COLORS.length] + '99',
          borderColor: COLORS[i % COLORS.length]
        }))
      }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 10 } } } }, scales: { x: { title: { display: true, text: 'Produits' }, beginAtZero: true }, y: { title: { display: true, text: 'En Stock' }, beginAtZero: true } } }
    });
  }

  // Doughnut Gauge: Achat Payment Coverage
  const achatPct = totalAchatTTC > 0 ? Math.min(100, Math.round(totalReglementsAchat / totalAchatTTC * 100)) : 0;
  new Chart(document.getElementById('chart-gauge-achat'), {
    type: 'doughnut', data: {
      labels: ['Payé', 'Restant'],
      datasets: [{ data: [achatPct, 100 - achatPct], backgroundColor: ['#fb923c', 'rgba(255,255,255,0.08)'], borderWidth: 0 }]
    }, options: { responsive: true, maintainAspectRatio: false, cutout: '75%', rotation: -90, circumference: 180, plugins: { legend: { display: false }, tooltip: { enabled: false } } },
    plugins: [{ id: 'gaugeText', afterDraw(chart) { const { ctx, width, height } = chart; ctx.save(); ctx.font = 'bold 28px Inter,sans-serif'; ctx.fillStyle = '#fb923c'; ctx.textAlign = 'center'; ctx.fillText(`${achatPct}%`, width/2, height - 30); ctx.font = '12px Inter,sans-serif'; ctx.fillStyle = '#999'; ctx.fillText(`${formatCurrency(totalReglementsAchat)} / ${formatCurrency(totalAchatTTC)}`, width/2, height - 10); ctx.restore(); } }]
  });

  // Doughnut Gauge: Vente Payment Coverage
  const ventePct = totalVenteTTC > 0 ? Math.min(100, Math.round(totalReglementsVente / totalVenteTTC * 100)) : 0;
  new Chart(document.getElementById('chart-gauge-vente'), {
    type: 'doughnut', data: {
      labels: ['Payé', 'Restant'],
      datasets: [{ data: [ventePct, 100 - ventePct], backgroundColor: ['#34d399', 'rgba(255,255,255,0.08)'], borderWidth: 0 }]
    }, options: { responsive: true, maintainAspectRatio: false, cutout: '75%', rotation: -90, circumference: 180, plugins: { legend: { display: false }, tooltip: { enabled: false } } },
    plugins: [{ id: 'gaugeText2', afterDraw(chart) { const { ctx, width, height } = chart; ctx.save(); ctx.font = 'bold 28px Inter,sans-serif'; ctx.fillStyle = '#34d399'; ctx.textAlign = 'center'; ctx.fillText(`${ventePct}%`, width/2, height - 30); ctx.font = '12px Inter,sans-serif'; ctx.fillStyle = '#999'; ctx.fillText(`${formatCurrency(totalReglementsVente)} / ${formatCurrency(totalVenteTTC)}`, width/2, height - 10); ctx.restore(); } }]
  });
}
