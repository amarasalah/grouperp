// BCG Selection Screen - shown after login
import { getAll } from '../data/store.js';
import { isSuperAdmin } from '../data/auth.js';
import { formatDate } from '../utils/helpers.js';

export async function renderBcgSelect(onSelected) {
    const content = document.getElementById('page-content');
    const bcgs = await getAll('bcg').catch(() => []);
    const activeBcgs = bcgs.filter(b => b.statut === 'Active');
    const superAdmin = isSuperAdmin();

    content.innerHTML = `
    <div style="max-width:700px;margin:40px auto;">
      <div style="text-align:center;margin-bottom:30px;">
        <div style="font-size:2.5rem;margin-bottom:10px;">📋</div>
        <h1 style="font-size:1.6rem;font-weight:700;">Sélectionner un Bon de Commande Globale</h1>
        <p style="color:var(--text-secondary);font-size:0.9rem;margin-top:6px;">
          ${superAdmin ? 'Choisissez un BCG spécifique ou accédez à tous les BCG' : 'Choisissez un BCG pour continuer'}
        </p>
      </div>

      ${superAdmin ? `
      <div style="display:flex;gap:12px;margin-bottom:24px;justify-content:center;">
        <button class="btn btn-primary" id="enter-all-bcg" style="padding:14px 28px;font-size:1rem;">
          🌐 Entrer TOUS les BCG
        </button>
        <button class="btn btn-secondary" id="create-new-bcg" style="padding:14px 28px;font-size:1rem;">
          + Nouveau BCG
        </button>
      </div>
      ` : ''}

      <div class="card" style="padding:0;">
        ${activeBcgs.length ? `
        <div style="max-height:400px;overflow-y:auto;">
          ${activeBcgs.map(b => {
            const totalTarget = (b.categories || []).reduce((s, c) => s + (c.quantite || 0), 0);
            return `
            <div class="bcg-select-item" data-id="${b.id}" style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border-color);cursor:pointer;transition:var(--transition);">
              <div>
                <div style="font-weight:700;font-size:1rem;color:var(--accent);">${b.numero || '-'}</div>
                <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:2px;">${formatDate(b.date)} — ${totalTarget} poteaux — ${(b.categories || []).length} catégorie(s)</div>
                ${b.description ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">${b.description}</div>` : ''}
              </div>
              <button class="btn btn-primary btn-sm select-bcg-btn" data-id="${b.id}">Choisir</button>
            </div>`;
          }).join('')}
        </div>
        ` : `
        <div class="empty-state" style="padding:40px;">
          <div class="icon">📋</div>
          <div class="title">Aucun BCG actif</div>
          <div class="desc">${superAdmin ? 'Créez un nouveau BCG pour commencer.' : 'Contactez l\'administrateur pour créer un BCG.'}</div>
        </div>
        `}
      </div>
    </div>
    `;

    // Wire events
    document.getElementById('enter-all-bcg')?.addEventListener('click', () => {
        sessionStorage.setItem('selectedBcgId', 'all');
        if (onSelected) onSelected('all');
    });

    document.getElementById('create-new-bcg')?.addEventListener('click', () => {
        window.location.hash = '/bcg';
        if (onSelected) onSelected(null);
    });

    document.querySelectorAll('.select-bcg-btn').forEach(btn => {
        btn.onclick = () => {
            sessionStorage.setItem('selectedBcgId', btn.dataset.id);
            if (onSelected) onSelected(btn.dataset.id);
        };
    });

    // Also allow clicking the row itself
    document.querySelectorAll('.bcg-select-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.select-bcg-btn')) return; // Don't double-fire
            sessionStorage.setItem('selectedBcgId', item.dataset.id);
            if (onSelected) onSelected(item.dataset.id);
        });
        // Hover effect
        item.addEventListener('mouseenter', () => { item.style.background = 'var(--bg-card-hover)'; });
        item.addEventListener('mouseleave', () => { item.style.background = ''; });
    });
}

// Helper to get selected BCG ID
export function getSelectedBcgId() {
    return sessionStorage.getItem('selectedBcgId');
}

// Helper to check if BCG is selected
export function hasBcgSelected() {
    return !!sessionStorage.getItem('selectedBcgId');
}

// Helper to check if viewing all BCGs
export function isAllBcgMode() {
    return sessionStorage.getItem('selectedBcgId') === 'all';
}
