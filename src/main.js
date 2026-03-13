// Main Application Entry
import { registerRoute, initRouter, navigateTo } from './router.js';
import { initAuth, isAuthenticated, getCurrentProfile, hasRouteAccess, isSuperAdmin, logout, onAuthChange } from './data/auth.js';
import { renderLogin, hideLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderParametres } from './pages/parametres.js';
import { renderCategories } from './pages/categories.js';
import { renderProduits } from './pages/produits.js';
import { renderFournisseurs } from './pages/fournisseurs.js';
import { renderClients } from './pages/clients.js';
import { renderLots } from './pages/lots.js';
import { renderBlAchat } from './pages/bl-achat.js';
import { renderFactureAchat } from './pages/facture-achat.js';
import { renderBcVente } from './pages/bc-vente.js';
import { renderBlVente } from './pages/bl-vente.js';
import { renderFactureVente } from './pages/facture-vente.js';
import { renderStock } from './pages/stock.js';
import { renderCaisse } from './pages/caisse.js';
import { renderReglements } from './pages/reglements.js';
import { renderRoles } from './pages/roles.js';
import { renderUsers } from './pages/users.js';
import { renderSetup } from './pages/setup.js';

// Full navigation structure (all possible items)
const ALL_NAV_ITEMS = [
    {
        section: 'Principal', items: [
            { icon: '\u{1F52E}', label: 'Tableau de Bord', route: '/' },
        ]
    },
    {
        section: 'Catalogue', items: [
            { icon: '\u{1F5C2}\uFE0F', label: 'Cat\u00E9gories', route: '/categories' },
            { icon: '\u{1F3AF}', label: 'Lots', route: '/lots' },
            { icon: '\u{1FAB5}', label: 'Produits (Poteaux)', route: '/produits' },
        ]
    },
    {
        section: 'Achats', items: [
            { icon: '\u{1F3ED}', label: 'Fournisseurs', route: '/fournisseurs' },
            { icon: '\u{1F4E5}', label: 'Bon de Livraison', route: '/bl-achat' },
            { icon: '\u{1F4CB}', label: 'Facture Achat', route: '/facture-achat' },
        ]
    },
    {
        section: 'Ventes', items: [
            { icon: '\u{1F91D}', label: 'Clients', route: '/clients' },
            { icon: '\u{1F6D2}', label: 'Bon de Commande', route: '/bc-vente' },
            { icon: '\u{1F4E4}', label: 'Bon de Livraison', route: '/bl-vente' },
            { icon: '\u{1F9FE}', label: 'Facture Vente', route: '/facture-vente' },
        ]
    },
    {
        section: 'Gestion', items: [
            { icon: '\u{1F4CA}', label: 'Stock', route: '/stock' },
            { icon: '\u{1F3E6}', label: 'Caisse', route: '/caisse' },
            { icon: '\u{1F48E}', label: 'R\u00E8glements', route: '/reglements' },
        ]
    },
    {
        section: 'Configuration', items: [
            { icon: '\u{1F527}', label: 'Param\u00E8tres', route: '/parametres' },
        ]
    },
    {
        section: 'Administration', items: [
            { icon: '\u{1F6E1}\uFE0F', label: 'R\u00F4les', route: '/roles' },
            { icon: '\u{1F464}', label: 'Utilisateurs', route: '/users' },
        ]
    },
];

// Route -> handler map
const ROUTE_HANDLERS = {
    '/': renderDashboard,
    '/parametres': renderParametres,
    '/categories': renderCategories,
    '/produits': renderProduits,
    '/fournisseurs': renderFournisseurs,
    '/clients': renderClients,
    '/lots': renderLots,
    '/bl-achat': renderBlAchat,
    '/facture-achat': renderFactureAchat,
    '/bc-vente': renderBcVente,
    '/bl-vente': renderBlVente,
    '/facture-vente': renderFactureVente,
    '/stock': renderStock,
    '/caisse': renderCaisse,
    '/reglements': renderReglements,
    '/roles': renderRoles,
    '/users': renderUsers,
};

// Build sidebar filtered by user permissions
function buildSidebar() {
    const nav = document.getElementById('sidebar-nav');
    const filteredSections = ALL_NAV_ITEMS.map(section => {
        const allowedItems = section.items.filter(item => hasRouteAccess(item.route));
        return { ...section, items: allowedItems };
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
  `).join('');

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
}

// Build user bar at bottom of sidebar
function buildUserBar() {
    const bar = document.getElementById('user-bar');
    const profile = getCurrentProfile();
    if (!profile) {
        bar.style.display = 'none';
        return;
    }
    const initials = (profile.displayName || profile.email || '?')
        .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    bar.style.display = 'flex';
    bar.innerHTML = `
        <div class="user-bar-avatar">${initials}</div>
        <div class="user-bar-info">
            <div class="user-bar-name">${profile.displayName || profile.email}</div>
            <div class="user-bar-role">${profile.roleName || '-'}</div>
        </div>
        <button class="logout-btn" id="logout-btn" title="Déconnexion">🚪</button>
    `;
    document.getElementById('logout-btn').onclick = async () => {
        await logout();
        window.location.reload();
    };
}

// Register routes with auth guard wrapping
function registerRoutes() {
    Object.entries(ROUTE_HANDLERS).forEach(([path, handler]) => {
        registerRoute(path, () => {
            if (!isAuthenticated()) {
                navigateTo('/');
                return;
            }
            if (!hasRouteAccess(path)) {
                const content = document.getElementById('page-content');
                content.innerHTML = `<div class="empty-state" style="padding:80px 20px">
                    <div class="icon">🚫</div>
                    <div class="title">Accès Refusé</div>
                    <div class="desc">Vous n'avez pas les permissions pour accéder à cette page.</div>
                    <a href="#/" class="btn btn-primary" style="margin-top:16px">Retour au tableau de bord</a>
                </div>`;
                return;
            }
            handler();
        });
    });
}

// Theme management
function initTheme() {
    const saved = localStorage.getItem('grouperp-theme');
    const theme = saved || 'light';
    applyTheme(theme);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('grouperp-theme', theme);
    const icon = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    if (icon && label) {
        if (theme === 'dark') {
            icon.textContent = '\u2600\uFE0F';
            label.textContent = 'Mode Clair';
        } else {
            icon.textContent = '\u{1F319}';
            label.textContent = 'Mode Sombre';
        }
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

// Full app boot after successful auth
function bootApp() {
    buildSidebar();
    buildUserBar();
    registerRoutes();
    initRouter();
}

// Check if current hash is the hidden setup page
function isSetupRoute() {
    const hash = window.location.hash.slice(1) || '/';
    return hash === '/setup';
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

    // If navigating to hidden setup page, show it directly (no auth needed)
    if (isSetupRoute()) {
        renderSetup();
        // Listen for hash changes away from setup
        window.addEventListener('hashchange', () => {
            if (!isSetupRoute()) window.location.reload();
        });
        return;
    }

    // Wait for Firebase Auth to resolve
    const user = await initAuth();

    if (user) {
        // Already logged in
        const profile = getCurrentProfile();
        if (profile && profile.active !== false) {
            bootApp();
        } else {
            // User is inactive or has no profile
            await logout();
            renderLogin(() => {
                window.location.reload();
            });
        }
    } else {
        // Not logged in — show login
        renderLogin(() => {
            window.location.reload();
        });
    }
});
