// Login Page
import { login, bootstrapSuperAdmin } from '../data/auth.js';
import { showToast } from '../utils/helpers.js';
import { db } from '../data/firebase.js';
import { collection, getDocs } from 'firebase/firestore';

export function renderLogin(onSuccess) {
    const app = document.getElementById('app');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');

    // Hide app layout, show login
    if (sidebar) sidebar.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';

    // Remove existing login if present
    const existing = document.getElementById('login-container');
    if (existing) existing.remove();

    const loginDiv = document.createElement('div');
    loginDiv.id = 'login-container';
    loginDiv.innerHTML = `
    <div class="login-wrapper">
      <div class="login-card">
        <div class="login-header">
          <span class="login-logo">⚡</span>
          <h1 class="login-title">Group<span class="accent">ERP</span></h1>
          <p class="login-subtitle">Système de Gestion & Facturation</p>
        </div>
        <form id="login-form" class="login-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" type="email" id="login-email" placeholder="admin@groupement.com" required autocomplete="username"/>
          </div>
          <div class="form-group">
            <label class="form-label">Mot de passe</label>
            <input class="form-input" type="password" id="login-password" placeholder="••••••••" required autocomplete="current-password"/>
          </div>
          <div id="login-error" style="display:none;color:var(--danger);font-size:0.85rem;margin-bottom:12px;padding:8px 12px;background:var(--danger-bg);border-radius:var(--radius-sm)"></div>
          <button type="submit" class="btn btn-primary login-btn" id="login-submit">
            <span id="login-btn-text">Se Connecter</span>
            <span id="login-spinner" class="spinner" style="display:none;width:18px;height:18px;margin:0"></span>
          </button>
        </form>
        <div class="login-footer">
          <p>Groupement des Poteaux B\u00E9ton \u00C9lectrique</p>
          <a href="#/setup" id="setup-link" style="display:none;color:var(--text-muted);font-size:0.75rem;text-decoration:underline;margin-top:8px">Premi\u00E8re configuration ?</a>
        </div>
      </div>
    </div>`;
    app.parentElement.insertBefore(loginDiv, app);

    // Bootstrap super admin on first load
    bootstrapSuperAdmin();

    // Show setup link if no users exist yet
    getDocs(collection(db, 'app_users')).then(snap => {
        const link = document.getElementById('setup-link');
        if (link && snap.size === 0) link.style.display = 'inline-block';
    }).catch(() => {
        const link = document.getElementById('setup-link');
        if (link) link.style.display = 'inline-block';
    });

    // Handle form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        const btnText = document.getElementById('login-btn-text');
        const submitBtn = document.getElementById('login-submit');

        errorDiv.style.display = 'none';
        btnText.textContent = 'Connexion...';
        submitBtn.disabled = true;

        try {
            await login(email, password);
            // Success — remove login, show app
            loginDiv.remove();
            if (sidebar) sidebar.style.display = '';
            if (mainContent) mainContent.style.display = '';
            if (onSuccess) onSuccess();
        } catch (err) {
            let msg = 'Erreur de connexion';
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                msg = 'Email ou mot de passe incorrect';
            } else if (err.code === 'auth/too-many-requests') {
                msg = 'Trop de tentatives. Réessayez plus tard.';
            } else if (err.code === 'auth/network-request-failed') {
                msg = 'Erreur réseau. Vérifiez votre connexion.';
            }
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
            btnText.textContent = 'Se Connecter';
            submitBtn.disabled = false;
        }
    });
}

export function hideLogin() {
    const loginDiv = document.getElementById('login-container');
    if (loginDiv) loginDiv.remove();
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    if (sidebar) sidebar.style.display = '';
    if (mainContent) mainContent.style.display = '';
}
