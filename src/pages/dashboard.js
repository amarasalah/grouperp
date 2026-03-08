// Dashboard Page
import { getAll, getSettings } from '../data/store.js';
import { formatCurrency, formatDate, tsToDate } from '../utils/helpers.js';

export async function renderDashboard() {
    const content = document.getElementById('page-content');

    // Load data
    const [produits, fournisseurs, clients, facturesAchat, facturesVente, reglements, settings] = await Promise.all([
        getAll('produits').catch(() => []),
        getAll('fournisseurs').catch(() => []),
        getAll('clients').catch(() => []),
        getAll('factures_achat').catch(() => []),
        getAll('factures_vente').catch(() => []),
        getAll('reglements').catch(() => []),
        getSettings().catch(() => ({}))
    ]);

    // Calculate KPIs
    const totalStock = produits.reduce((sum, p) => sum + (p.stock || 0), 0);
    const totalAchats = facturesAchat.reduce((sum, f) => sum + (f.totalTTC || 0), 0);
    const totalVentes = facturesVente.reduce((sum, f) => sum + (f.totalTTC || 0), 0);
    const totalReglements = reglements.reduce((sum, r) => sum + (r.montant || 0), 0);

    // Recent documents
    const recentDocs = [
        ...facturesAchat.slice(0, 5).map(f => ({ ...f, docType: 'Facture Achat', color: 'orange' })),
        ...facturesVente.slice(0, 5).map(f => ({ ...f, docType: 'Facture Vente', color: 'green' }))
    ].sort((a, b) => {
        const da = a.createdAt?.seconds || 0;
        const db = b.createdAt?.seconds || 0;
        return db - da;
    }).slice(0, 8);

    content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Tableau de Bord</h1>
        <p class="page-subtitle">Vue d'ensemble de votre activité</p>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon blue">📦</div>
        <div class="kpi-info">
          <div class="kpi-label">Stock Total (Unités)</div>
          <div class="kpi-value">${totalStock.toLocaleString('fr-FR')}</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon green">📈</div>
        <div class="kpi-info">
          <div class="kpi-label">Total Ventes</div>
          <div class="kpi-value">${formatCurrency(totalVentes)}</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon orange">📉</div>
        <div class="kpi-info">
          <div class="kpi-label">Total Achats</div>
          <div class="kpi-value">${formatCurrency(totalAchats)}</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon red">💰</div>
        <div class="kpi-info">
          <div class="kpi-label">Règlements</div>
          <div class="kpi-value">${formatCurrency(totalReglements)}</div>
        </div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📊 Résumé</h3>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div style="padding:14px; background:var(--bg-input); border-radius:var(--radius-md); text-align:center;">
            <div style="font-size:1.4rem; font-weight:700; color:var(--accent);">${produits.length}</div>
            <div style="font-size:0.8rem; color:var(--text-secondary);">Produits</div>
          </div>
          <div style="padding:14px; background:var(--bg-input); border-radius:var(--radius-md); text-align:center;">
            <div style="font-size:1.4rem; font-weight:700; color:var(--success);">${clients.length}</div>
            <div style="font-size:0.8rem; color:var(--text-secondary);">Clients</div>
          </div>
          <div style="padding:14px; background:var(--bg-input); border-radius:var(--radius-md); text-align:center;">
            <div style="font-size:1.4rem; font-weight:700; color:var(--warning);">${fournisseurs.length}</div>
            <div style="font-size:0.8rem; color:var(--text-secondary);">Fournisseurs</div>
          </div>
          <div style="padding:14px; background:var(--bg-input); border-radius:var(--radius-md); text-align:center;">
            <div style="font-size:1.4rem; font-weight:700; color:var(--danger);">${facturesAchat.length + facturesVente.length}</div>
            <div style="font-size:0.8rem; color:var(--text-secondary);">Factures</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📄 Documents Récents</h3>
        </div>
        ${recentDocs.length > 0 ? `
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${recentDocs.map(doc => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg-input); border-radius:var(--radius-sm);">
              <div>
                <span class="badge badge-${doc.color === 'green' ? 'success' : 'warning'}">${doc.docType}</span>
                <span style="margin-left:8px; font-weight:600;">${doc.numero || '-'}</span>
              </div>
              <span style="color:var(--text-secondary); font-size:0.82rem;">${formatCurrency(doc.totalTTC || 0)}</span>
            </div>
          `).join('')}
        </div>
        ` : '<div class="empty-state"><div class="icon">📄</div><div class="desc">Aucun document récent</div></div>'}
      </div>
    </div>
  `;
}
