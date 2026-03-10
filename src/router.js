// Router - Hash-based SPA routing
const routes = {};
let currentRoute = null;

export function registerRoute(path, handler) {
    routes[path] = handler;
}

export function navigateTo(path) {
    window.location.hash = path;
}

export function initRouter() {
    const handleRoute = () => {
        const hash = window.location.hash.slice(1) || '/';
        const path = hash.split('?')[0];

        // Update active nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.route === path);
        });

        if (routes[path]) {
            currentRoute = path;
            const content = document.getElementById('page-content');
            content.innerHTML = '<div class="spinner"></div>';
            routes[path]();
        }
    };

    window.addEventListener('hashchange', handleRoute);
    handleRoute();
}

export function getQueryParam(key) {
    const hash = window.location.hash;
    const qIndex = hash.indexOf('?');
    if (qIndex === -1) return null;
    const params = new URLSearchParams(hash.slice(qIndex + 1));
    return params.get(key);
}
