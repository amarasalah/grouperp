// Stats / Analytics Page - Charts and overview
import { getAll, getSettings } from '../data/store.js';
import { formatCurrency, formatDate } from '../utils/helpers.js';

export async function renderStats() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="spinner"></div>';

  const [produits, types, fournisseurs, clients, facturesAchat, facturesVente, reglements, blAchats, blVentes, bcgs, caisse] = await Promise.all([
    getAll('produits').catch(() => []),
    getAll('types').catch(() => []),
    getAll('fournisseurs').catch(() => []),
    getAll('clients').catch(() => []),
    getAll('factures_achat').catch(() => []),
    getAll('factures_vente').catch(() => []),
    getAll('reglements').catch(() => []),
    getAll('bl_achat').catch(() => []),
    getAll('bl_vente').catch(() => []),
    getAll('bcg').catch(() => []),
    getAll('caisse').catch(() => [])
  ]);

  // KPIs
  const totalAchats = facturesAchat.reduce((s, f) => s + (f.totalTTC || 0), 0);
  const totalVentes = facturesVente.reduce((s, f) => s + (f.totalTTC || 0), 0);
  const totalReglements = reglements.reduce((s, r) => s + (r.montant || 0), 0);
  const caisseEntrees = caisse.filter(m => m.type === 'entree').reduce((s, m) => s + (m.montant || 0), 0);
  const caisseSorties = caisse.filter(m => m.type === 'sortie').reduce((s, m) => s + (m.montant || 0), 0);

  // Stock per category
  const catStockData = {};
  types.forEach(c => { catStockData[c.id] = { nom: c.nom, entrees: 0, sorties: 0 }; });
  blAchats.filter(b => b.statut === 'Réceptionné').forEach(bl => {
    (bl.lignes || []).forEach(l => {
      const pid = l.produitId;
      if (pid) {
        const p = produits.find(x => x.id === pid);
        if (p && catStockData[p.typeId]) catStockData[p.typeId].entrees++;
      }
    });
  });
  blVentes.filter(b => b.statut === 'Livré').forEach(bl => {
    (bl.lignes || []).forEach(l => {
      const pid = l.produitId;
      if (pid) {
        const p = produits.find(x => x.id === pid);
        if (p && catStockData[p.typeId]) catStockData[p.typeId].sorties++;
      }
    });
  });

  // Top clients by facture volume
  const clientVolume = {};
  facturesVente.forEach(f => {
    clientVolume[f.clientNom || 'Inconnu'] = (clientVolume[f.clientNom || 'Inconnu'] || 0) + (f.totalTTC || 0);
  });
  const topClients = Object.entries(clientVolume).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Top fournisseurs
  const fourVolume = {};
  facturesAchat.forEach(f => {
    fourVolume[f.fournisseurNom || 'Inconnu'] = (fourVolume[f.fournisseurNom || 'Inconnu'] || 0) + (f.totalTTC || 0);
  });
  const topFours = Object.entries(fourVolume).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Payment status
  const paidAchat = facturesAchat.filter(f => f.regle).length;
  const unpaidAchat = facturesAchat.filter(f => !f.regle).length;
  const paidVente = facturesVente.filter(f => f.regle).length;
  const unpaidVente = facturesVente.filter(f => !f.regle).length;

  content.innerHTML = `
    <div class="page-header"><div><h1 class="page-title">📈 Statistiques</h1><p class="page-subtitle">Vue d'ensemble analytique</p></div></div>

    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-icon green">📈</div><div class="kpi-info"><div class="kpi-label">Total Ventes</div><div class="kpi-value" style="color:var(--success)">${formatCurrency(totalVentes)}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon orange">📉</div><div class="kpi-info"><div class="kpi-label">Total Achats</div><div class="kpi-value" style="color:var(--warning)">${formatCurrency(totalAchats)}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon blue">💰</div><div class="kpi-info"><div class="kpi-label">Marge Brute</div><div class="kpi-value" style="color:${totalVentes - totalAchats >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(totalVentes - totalAchats)}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon red">💳</div><div class="kpi-info"><div class="kpi-label">Règlements</div><div class="kpi-value">${formatCurrency(totalReglements)}</div></div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
      <div class="card"><div class="card-header"><h3 class="card-title">📦 Stock par Catégorie</h3></div>
        <div style="height:300px;"><canvas id="chart-stock"></canvas></div>
      </div>
      <div class="card"><div class="card-header"><h3 class="card-title">💰 Achats vs Ventes</h3></div>
        <div style="height:300px;"><canvas id="chart-av"></canvas></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
      <div class="card"><div class="card-header"><h3 class="card-title">🧾 État des Paiements</h3></div>
        <div style="height:280px;"><canvas id="chart-payments"></canvas></div>
      </div>
      <div class="card"><div class="card-header"><h3 class="card-title">💵 Caisse (Entrées vs Sorties)</h3></div>
        <div style="height:280px;"><canvas id="chart-caisse"></canvas></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
      <div class="card"><div class="card-header"><h3 class="card-title">🏆 Top Clients</h3></div>
        ${topClients.length ? `<table class="data-table"><thead><tr><th>Client</th><th>Volume TTC</th></tr></thead><tbody>
          ${topClients.map(([nom, vol], i) => `<tr><td><strong style="color:var(--accent)">${i + 1}. ${nom}</strong></td><td style="font-weight:600">${formatCurrency(vol)}</td></tr>`).join('')}
        </tbody></table>` : '<p style="color:var(--text-muted);padding:12px;">Aucun client</p>'}
      </div>
      <div class="card"><div class="card-header"><h3 class="card-title">🏭 Top Fournisseurs</h3></div>
        ${topFours.length ? `<table class="data-table"><thead><tr><th>Fournisseur</th><th>Volume TTC</th></tr></thead><tbody>
          ${topFours.map(([nom, vol], i) => `<tr><td><strong style="color:var(--accent)">${i + 1}. ${nom}</strong></td><td style="font-weight:600">${formatCurrency(vol)}</td></tr>`).join('')}
        </tbody></table>` : '<p style="color:var(--text-muted);padding:12px;">Aucun fournisseur</p>'}
      </div>
    </div>

    ${bcgs.length ? `<div class="card" style="margin-bottom:20px;"><div class="card-header"><h3 class="card-title">📋 Progression BCG</h3></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
        ${bcgs.map(b => {
          const totalTarget = b.totalProduits || 0;
          const totalProduced = produits.filter(p => p.bcgId === b.id).length;
          const pct = totalTarget > 0 ? Math.round(totalProduced / totalTarget * 100) : 0;
          return `<div style="padding:16px;background:var(--bg-input);border-radius:var(--radius-md);border:1px solid var(--border-color);">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <strong style="color:var(--accent)">${b.numero || '-'}</strong>
              <span class="badge ${b.statut === 'Active' ? 'badge-success' : 'badge-warning'}">${b.statut}</span>
            </div>
            <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">${totalProduced}/${totalTarget} poteaux (${pct}%)</div>
            <div style="height:8px;background:var(--border-color);border-radius:4px;overflow:hidden;">
              <div style="width:${Math.min(pct,100)}%;height:100%;background:${pct>=100?'var(--success)':'var(--accent)'};"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
  `;

  // Draw charts
  if (typeof Chart === 'undefined') return;

  const chartColors = {
    blue: 'rgba(79, 140, 255, 0.8)',
    green: 'rgba(52, 211, 153, 0.8)',
    orange: 'rgba(251, 191, 36, 0.8)',
    red: 'rgba(248, 113, 113, 0.8)',
    purple: 'rgba(167, 139, 250, 0.8)',
    blueBg: 'rgba(79, 140, 255, 0.15)',
    greenBg: 'rgba(52, 211, 153, 0.15)',
  };
  const chartDefaults = { color: '#8b8fa3', borderColor: '#2a2d3e' };

  // Stock per category bar chart
  const stockLabels = Object.values(catStockData).map(c => c.nom);
  const stockEntrees = Object.values(catStockData).map(c => c.entrees);
  const stockSorties = Object.values(catStockData).map(c => c.sorties);
  const stockNet = Object.values(catStockData).map(c => c.entrees - c.sorties);

  new Chart(document.getElementById('chart-stock'), {
    type: 'bar',
    data: {
      labels: stockLabels,
      datasets: [
        { label: 'Entrées', data: stockEntrees, backgroundColor: chartColors.green },
        { label: 'Sorties', data: stockSorties, backgroundColor: chartColors.red },
        { label: 'En Stock', data: stockNet, backgroundColor: chartColors.blue }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: chartDefaults.color } } }, scales: { x: { ticks: { color: chartDefaults.color }, grid: { color: chartDefaults.borderColor } }, y: { ticks: { color: chartDefaults.color }, grid: { color: chartDefaults.borderColor } } } }
  });

  // Achats vs Ventes doughnut
  new Chart(document.getElementById('chart-av'), {
    type: 'doughnut',
    data: {
      labels: ['Ventes', 'Achats'],
      datasets: [{ data: [totalVentes, totalAchats], backgroundColor: [chartColors.green, chartColors.orange], borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: chartDefaults.color } } } }
  });

  // Payment status
  new Chart(document.getElementById('chart-payments'), {
    type: 'bar',
    data: {
      labels: ['Factures Achat', 'Factures Vente'],
      datasets: [
        { label: 'Réglé', data: [paidAchat, paidVente], backgroundColor: chartColors.green },
        { label: 'Non réglé', data: [unpaidAchat, unpaidVente], backgroundColor: chartColors.red }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { labels: { color: chartDefaults.color } } }, scales: { x: { ticks: { color: chartDefaults.color }, grid: { color: chartDefaults.borderColor }, stacked: true }, y: { ticks: { color: chartDefaults.color }, grid: { color: chartDefaults.borderColor }, stacked: true } } }
  });

  // Caisse
  new Chart(document.getElementById('chart-caisse'), {
    type: 'doughnut',
    data: {
      labels: ['Entrées', 'Sorties'],
      datasets: [{ data: [caisseEntrees, caisseSorties], backgroundColor: [chartColors.green, chartColors.red], borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: chartDefaults.color } } } }
  });
}
