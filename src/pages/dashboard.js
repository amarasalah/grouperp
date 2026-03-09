// Dashboard Page
import { getAll, getById, getSettings } from '../data/store.js';
import { formatCurrency, formatDate } from '../utils/helpers.js';
import { isSuperAdmin, getUserProfile } from '../data/auth.js';
import { getSelectedBcgId, isAllBcgMode } from './bcg-select.js';

export async function renderDashboard() {
    const content = document.getElementById('page-content');

    const bcgId = getSelectedBcgId();
    const allMode = isAllBcgMode();
    const profile = getUserProfile();

    // Load data
    const [produits, fournisseurs, clients, facturesAchat, facturesVente, reglements, bcgs, blAchats, blVentes] = await Promise.all([
        getAll('produits').catch(() => []),
        getAll('fournisseurs').catch(() => []),
        getAll('clients').catch(() => []),
        getAll('factures_achat').catch(() => []),
        getAll('factures_vente').catch(() => []),
        getAll('reglements').catch(() => []),
        getAll('bcg').catch(() => []),
        getAll('bl_achat').catch(() => []),
        getAll('bl_vente').catch(() => []),
    ]);

    // Current BCG info
    let currentBcg = null;
    if (bcgId && bcgId !== 'all') {
        currentBcg = bcgs.find(b => b.id === bcgId) || null;
    }

    // Calculate KPIs
    const totalProduits = (!allMode && bcgId && bcgId !== 'all') ? produits.filter(p => p.bcgId === bcgId).length : produits.length;
    const totalAchats = facturesAchat.reduce((sum, f) => sum + (f.totalTTC || 0), 0);
    const totalVentes = facturesVente.reduce((sum, f) => sum + (f.totalTTC || 0), 0);
    const totalReglements = reglements.reduce((sum, r) => sum + (r.montant || 0), 0);

    // Stock count from BLs
    const stockIn = blAchats.filter(b => b.statut === 'Réceptionné').reduce((s, b) => s + (b.lignes || []).length, 0);
    const stockOut = blVentes.filter(b => b.statut === 'Livré').reduce((s, b) => s + (b.lignes || []).length, 0);
    const totalStock = stockIn - stockOut;

    // Recent documents
    const recentDocs = [
        ...facturesAchat.slice(0, 5).map(f => ({ ...f, docType: 'Facture Achat', color: 'orange' })),
        ...facturesVente.slice(0, 5).map(f => ({ ...f, docType: 'Facture Vente', color: 'green' }))
    ].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 8);

    // BCG overview for super admin
    const bcgOverviewHtml = isSuperAdmin() && bcgs.length ? `
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><h3 class="card-title">📋 Bon de Commande Globale — Vue d'ensemble</h3></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
        ${bcgs.filter(b => b.statut === 'Active').map(b => {
          const totalTarget = b.totalProduits || 0;
          const totalProduced = produits.filter(p => p.bcgId === b.id).length;
          const pct = totalTarget > 0 ? Math.round(totalProduced / totalTarget * 100) : 0;
          return `<div style="padding:16px;background:var(--bg-input);border-radius:var(--radius-md);border:1px solid var(--border-color);">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <strong style="color:var(--accent)">${b.numero || '-'}</strong>
              <span style="font-size:0.8rem;font-weight:700;color:${pct>=100?'var(--success)':'var(--text-secondary)'};">${pct}%</span>
            </div>
            <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">${totalProduced}/${totalTarget} poteaux</div>
            <div style="height:8px;background:var(--border-color);border-radius:4px;overflow:hidden;">
              <div style="width:${Math.min(pct,100)}%;height:100%;background:${pct>=100?'var(--success)':'var(--accent)'};border-radius:4px;"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

    // Current BCG progress card
    const bcgContextHtml = currentBcg ? `
    <div class="card" style="margin-bottom:20px;padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 class="card-title">📋 BCG: ${currentBcg.numero}</h3>
        <span class="badge badge-success">${currentBcg.statut}</span>
      </div>
      ${(() => {
        const tLimit = currentBcg.totalProduits || 0;
        const tProduced = produits.filter(p => p.bcgId === currentBcg.id).length;
        const tPct = tLimit > 0 ? Math.round(tProduced / tLimit * 100) : 0;
        return `<div style="display:flex;align-items:center;gap:8px;">
          <div style="flex:1;height:10px;background:var(--border-color);border-radius:5px;overflow:hidden;">
            <div style="width:${Math.min(tPct,100)}%;height:100%;background:${tPct>=100?'var(--success)':'var(--accent)'};border-radius:5px;"></div>
          </div>
          <span style="font-weight:700;color:var(--accent);">${tProduced}/${tLimit}</span>
        </div>`;
      })()}
    </div>` : '';

    content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Tableau de Bord</h1>
        <p class="page-subtitle">Bienvenue, ${profile?.displayName || ''} ${currentBcg ? `— BCG: ${currentBcg.numero}` : allMode ? '— Tous les BCG' : ''}</p>
      </div>
      <button class="btn btn-secondary" onclick="sessionStorage.removeItem('selectedBcgId');window.location.reload();">🔄 Changer BCG</button>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-icon blue">📦</div><div class="kpi-info"><div class="kpi-label">En Stock</div><div class="kpi-value">${totalStock.toLocaleString('fr-FR')}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon green">📈</div><div class="kpi-info"><div class="kpi-label">Total Ventes</div><div class="kpi-value">${formatCurrency(totalVentes)}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon orange">📉</div><div class="kpi-info"><div class="kpi-label">Total Achats</div><div class="kpi-value">${formatCurrency(totalAchats)}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon red">💰</div><div class="kpi-info"><div class="kpi-label">Règlements</div><div class="kpi-value">${formatCurrency(totalReglements)}</div></div></div>
    </div>

    ${bcgOverviewHtml}
    ${bcgContextHtml}

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
      <div class="card">
        <div class="card-header"><h3 class="card-title">📊 Résumé</h3></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div style="padding:14px;background:var(--bg-input);border-radius:var(--radius-md);text-align:center;">
            <div style="font-size:1.4rem;font-weight:700;color:var(--accent);">${totalProduits}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary);">Produits</div>
          </div>
          <div style="padding:14px;background:var(--bg-input);border-radius:var(--radius-md);text-align:center;">
            <div style="font-size:1.4rem;font-weight:700;color:var(--success);">${clients.length}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary);">Clients</div>
          </div>
          <div style="padding:14px;background:var(--bg-input);border-radius:var(--radius-md);text-align:center;">
            <div style="font-size:1.4rem;font-weight:700;color:var(--warning);">${fournisseurs.length}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary);">Fournisseurs</div>
          </div>
          <div style="padding:14px;background:var(--bg-input);border-radius:var(--radius-md);text-align:center;">
            <div style="font-size:1.4rem;font-weight:700;color:var(--danger);">${facturesAchat.length + facturesVente.length}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary);">Factures</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3 class="card-title">📄 Documents Récents</h3></div>
        ${recentDocs.length > 0 ? `
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${recentDocs.map(doc => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg-input);border-radius:var(--radius-sm);">
              <div>
                <span class="badge badge-${doc.color === 'green' ? 'success' : 'warning'}">${doc.docType}</span>
                <span style="margin-left:8px;font-weight:600;">${doc.numero || '-'}</span>
              </div>
              <span style="color:var(--text-secondary);font-size:0.82rem;">${formatCurrency(doc.totalTTC || 0)}</span>
            </div>
          `).join('')}
        </div>
        ` : '<div class="empty-state"><div class="icon">📄</div><div class="desc">Aucun document récent</div></div>'}
      </div>
    </div>
  `;
}
