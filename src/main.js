// Main Application Entry
import { registerRoute, initRouter, navigateTo } from './router.js';
import { initAuth, isAuthenticated, isSuperAdmin, getUserProfile, logout, hasMenuAccess } from './data/auth.js';
import { renderLogin, removeLoginScreen } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderParametres } from './pages/parametres.js';
import { renderTypes } from './pages/types.js';
import { renderProduits } from './pages/produits.js';
import { renderFournisseurs } from './pages/fournisseurs.js';
import { renderClients } from './pages/clients.js';
import { renderBlAchat } from './pages/bl-achat.js';
import { renderFactureAchat } from './pages/facture-achat.js';
import { renderDevisVente } from './pages/devis-vente.js';
import { renderBcVente } from './pages/bc-vente.js';
import { renderBlVente } from './pages/bl-vente.js';
import { renderFactureVente } from './pages/facture-vente.js';
import { renderStock } from './pages/stock.js';
import { renderCaisse } from './pages/caisse.js';
import { renderReglements } from './pages/reglements.js';
import { renderSuperAdminSetup } from './pages/super-admin-setup.js';
import { renderRoles } from './pages/roles.js';
import { renderUsers } from './pages/users.js';
import { renderBcg } from './pages/bcg.js';
import { renderStats } from './pages/stats.js';
import { renderBcgSelect, hasBcgSelected, getSelectedBcgId, isAllBcgMode } from './pages/bcg-select.js';

// Navigation structure with permission keys
const NAV_ITEMS = [
    {
        section: 'Principal', items: [
            { icon: '📊', label: 'Tableau de Bord', route: '/', permKey: 'dashboard' },
            { icon: '📈', label: 'Statistiques', route: '/stats', permKey: 'stats' },
        ]
    },
    {
        section: 'Catalogue', items: [
            { icon: '📁', label: 'Types', route: '/types', permKey: 'types' },
            { icon: '🏗️', label: 'Produits (Poteaux)', route: '/produits', permKey: 'produits' },
        ]
    },
    {
        section: 'Achats', items: [
            { icon: '🏢', label: 'Fournisseurs', route: '/fournisseurs', permKey: 'fournisseurs' },
            { icon: '', label: 'Bon de Livraison', route: '/bl-achat', permKey: 'bl_achat' },
            { icon: '🧾', label: 'Facture Achat', route: '/facture-achat', permKey: 'facture_achat' },
        ]
    },
    {
        section: 'Ventes', items: [
            { icon: '👥', label: 'Clients', route: '/clients', permKey: 'clients' },
            { icon: '📋', label: 'Devis Vente', route: '/devis-vente', permKey: 'devis_vente' },
            { icon: '📦', label: 'Bon de Commande', route: '/bc-vente', permKey: 'bc_vente' },
            { icon: '🚛', label: 'Bon de Livraison', route: '/bl-vente', permKey: 'bl_vente' },
            { icon: '🧾', label: 'Facture Vente', route: '/facture-vente', permKey: 'facture_vente' },
        ]
    },
    {
        section: 'Gestion', items: [
            { icon: '📦', label: 'Stock', route: '/stock', permKey: 'stock' },
            { icon: '💰', label: 'Caisse', route: '/caisse', permKey: 'caisse' },
            { icon: '💳', label: 'Règlements', route: '/reglements', permKey: 'reglements' },
            { icon: '📋', label: 'BCG', route: '/bcg', permKey: 'bcg' },
        ]
    },
    {
        section: 'Administration', items: [
            { icon: '🔐', label: 'Rôles', route: '/roles', permKey: 'roles' },
            { icon: '👤', label: 'Utilisateurs', route: '/users', permKey: 'users' },
        ]
    },
    {
        section: 'Configuration', items: [
            { icon: '⚙️', label: 'Paramètres', route: '/parametres', permKey: 'parametres' },
        ]
    },
];

function buildSidebar() {
    const nav = document.getElementById('sidebar-nav');
    const profile = getUserProfile();

    // Filter nav items based on permissions
    const filteredSections = NAV_ITEMS.map(section => {
        const filteredItems = section.items.filter(item => hasMenuAccess(item.permKey));
        return { ...section, items: filteredItems };
    }).filter(section => section.items.length > 0);

    nav.innerHTML = filteredSections.map(section => `
    <div class="nav-section">
      <div class="nav-section-title">${section.section}</div>
      ${section.items.map(item => `
        <a class="nav-item" data-route="${item.route}" href="#${item.route}">
          <span class="nav-icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `).join('')}
    </div>
  `).join('') + `
    <div class="nav-section" style="margin-top:auto;border-top:1px solid var(--border-color);padding-top:8px;">
      <div style="padding:8px 14px;font-size:0.8rem;color:var(--text-muted);display:flex;align-items:center;gap:8px;">
        <span>👤</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${profile?.displayName || profile?.email || ''}</span>
      </div>
      ${profile?.roleName ? `<div style="padding:2px 14px 6px;font-size:0.72rem;color:var(--accent);">${profile.roleName}</div>` : ''}
      <a class="nav-item" id="logout-btn" href="javascript:void(0)" style="color:var(--danger);">
        <span class="nav-icon">🚪</span>
        <span>Déconnexion</span>
      </a>
    </div>
  `;

    // Sidebar toggle for mobile
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));

    // Close sidebar on nav click (mobile)
    nav.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) sidebar.classList.remove('open');
        });
    });

    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await logout();
        // Auth state listener will handle showing login
    });
}

function registerRoutes() {
    registerRoute('/', renderDashboard, 'dashboard');
    registerRoute('/parametres', renderParametres, 'parametres');
    registerRoute('/types', renderTypes, 'types');
    registerRoute('/produits', renderProduits, 'produits');
    registerRoute('/fournisseurs', renderFournisseurs, 'fournisseurs');
    registerRoute('/clients', renderClients, 'clients');
    registerRoute('/bl-achat', renderBlAchat, 'bl_achat');
    registerRoute('/facture-achat', renderFactureAchat, 'facture_achat');
    registerRoute('/devis-vente', renderDevisVente, 'devis_vente');
    registerRoute('/bc-vente', renderBcVente, 'bc_vente');
    registerRoute('/bl-vente', renderBlVente, 'bl_vente');
    registerRoute('/facture-vente', renderFactureVente, 'facture_vente');
    registerRoute('/stock', renderStock, 'stock');
    registerRoute('/caisse', renderCaisse, 'caisse');
    registerRoute('/reglements', renderReglements, 'reglements');
    registerRoute('/super-admin-setup', renderSuperAdminSetup);
    registerRoute('/roles', renderRoles, 'roles');
    registerRoute('/users', renderUsers, 'users');
    registerRoute('/bcg', renderBcg, 'bcg');
    registerRoute('/stats', renderStats, 'stats');
}

// Initialize with auth
document.addEventListener('DOMContentLoaded', () => {
    registerRoutes();

    initAuth((user) => {
        // Allow super-admin-setup page without authentication
        const hash = window.location.hash.slice(1) || '/';
        if (hash === '/super-admin-setup') {
            removeLoginScreen();
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.style.display = 'none';
            const mainContent = document.getElementById('main-content');
            if (mainContent) mainContent.style.marginLeft = '0';
            initRouter();
            return;
        }

        if (user && isAuthenticated()) {
            // User is logged in — show the app
            removeLoginScreen();
            buildSidebar();

            // Check if BCG is selected
            if (!hasBcgSelected()) {
                // Show BCG selection screen — don't init router yet
                renderBcgSelect((bcgId) => {
                    if (bcgId) {
                        // BCG selected or 'all' mode — now start the app
                        window.location.hash = '/';
                        buildSidebar();
                        initRouter();
                    }
                });
            } else {
                initRouter();
            }
        } else {
            // Not logged in — show login screen
            renderLogin(() => {
                // onSuccess callback — auth state listener will re-trigger
            });
        }
    });
});
