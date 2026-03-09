// Router - Hash-based SPA routing
import { hasMenuAccess, isAuthenticated } from './data/auth.js';

const routes = {};
const routePerms = {};
let currentRoute = null;
let routerInitialized = false;
let handleRoute = null;

export function registerRoute(path, handler, permKey) {
    routes[path] = handler;
    if (permKey) routePerms[path] = permKey;
}

export function navigateTo(path) {
    window.location.hash = path;
}

export function initRouter() {
    handleRoute = () => {
        const hash = window.location.hash.slice(1) || '/';
        const path = hash.split('?')[0];

        // Update active nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.route === path);
        });

        if (routes[path]) {
            // Check permission if a permKey is set for this route
            const permKey = routePerms[path];
            if (permKey && isAuthenticated() && !hasMenuAccess(permKey)) {
                const content = document.getElementById('page-content');
                if (content) {
                    content.innerHTML = '<div class="empty-state"><div class="icon">🔒</div><div class="title">Accès refusé</div><div class="desc">Vous n\'avez pas les permissions pour accéder à cette page.</div></div>';
                }
                return;
            }
            currentRoute = path;
            const content = document.getElementById('page-content');
            if (content) {
                content.innerHTML = '<div class="spinner"></div>';
                routes[path]();
            }
        }
    };

    if (!routerInitialized) {
        window.addEventListener('hashchange', handleRoute);
        routerInitialized = true;
    }
    handleRoute();
}

export function getQueryParam(key) {
    const hash = window.location.hash;
    const qIndex = hash.indexOf('?');
    if (qIndex === -1) return null;
    const params = new URLSearchParams(hash.slice(qIndex + 1));
    return params.get(key);
}
