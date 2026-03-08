// Main Application Entry
import { registerRoute, initRouter, navigateTo } from './router.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderParametres } from './pages/parametres.js';
import { renderCategories } from './pages/categories.js';
import { renderProduits } from './pages/produits.js';
import { renderFournisseurs } from './pages/fournisseurs.js';
import { renderClients } from './pages/clients.js';
import { renderDevisAchat } from './pages/devis-achat.js';
import { renderBcAchat } from './pages/bc-achat.js';
import { renderBlAchat } from './pages/bl-achat.js';
import { renderFactureAchat } from './pages/facture-achat.js';
import { renderDevisVente } from './pages/devis-vente.js';
import { renderBcVente } from './pages/bc-vente.js';
import { renderBlVente } from './pages/bl-vente.js';
import { renderFactureVente } from './pages/facture-vente.js';
import { renderStock } from './pages/stock.js';
import { renderCaisse } from './pages/caisse.js';
import { renderReglements } from './pages/reglements.js';

// Navigation structure
const NAV_ITEMS = [
    {
        section: 'Principal', items: [
            { icon: '📊', label: 'Tableau de Bord', route: '/' },
        ]
    },
    {
        section: 'Catalogue', items: [
            { icon: '📁', label: 'Catégories', route: '/categories' },
            { icon: '🏗️', label: 'Produits (Poteaux)', route: '/produits' },
        ]
    },
    {
        section: 'Achats', items: [
            { icon: '🏢', label: 'Fournisseurs', route: '/fournisseurs' },
            { icon: '📋', label: 'Devis Achat', route: '/devis-achat' },
            { icon: '📦', label: 'Bon de Commande', route: '/bc-achat' },
            { icon: '🚛', label: 'Bon de Livraison', route: '/bl-achat' },
            { icon: '🧾', label: 'Facture Achat', route: '/facture-achat' },
        ]
    },
    {
        section: 'Ventes', items: [
            { icon: '👥', label: 'Clients', route: '/clients' },
            { icon: '📋', label: 'Devis Vente', route: '/devis-vente' },
            { icon: '📦', label: 'Bon de Commande', route: '/bc-vente' },
            { icon: '🚛', label: 'Bon de Livraison', route: '/bl-vente' },
            { icon: '🧾', label: 'Facture Vente', route: '/facture-vente' },
        ]
    },
    {
        section: 'Gestion', items: [
            { icon: '📦', label: 'Stock', route: '/stock' },
            { icon: '💰', label: 'Caisse', route: '/caisse' },
            { icon: '💳', label: 'Règlements', route: '/reglements' },
        ]
    },
    {
        section: 'Configuration', items: [
            { icon: '⚙️', label: 'Paramètres', route: '/parametres' },
        ]
    },
];

function buildSidebar() {
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = NAV_ITEMS.map(section => `
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

function registerRoutes() {
    registerRoute('/', renderDashboard);
    registerRoute('/parametres', renderParametres);
    registerRoute('/categories', renderCategories);
    registerRoute('/produits', renderProduits);
    registerRoute('/fournisseurs', renderFournisseurs);
    registerRoute('/clients', renderClients);
    registerRoute('/devis-achat', renderDevisAchat);
    registerRoute('/bc-achat', renderBcAchat);
    registerRoute('/bl-achat', renderBlAchat);
    registerRoute('/facture-achat', renderFactureAchat);
    registerRoute('/devis-vente', renderDevisVente);
    registerRoute('/bc-vente', renderBcVente);
    registerRoute('/bl-vente', renderBlVente);
    registerRoute('/facture-vente', renderFactureVente);
    registerRoute('/stock', renderStock);
    registerRoute('/caisse', renderCaisse);
    registerRoute('/reglements', renderReglements);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    buildSidebar();
    registerRoutes();
    initRouter();
});
