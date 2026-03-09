// Login Page
import { login } from '../data/auth.js';
import { showToast } from '../utils/helpers.js';

export function renderLogin(onSuccess) {
    const app = document.getElementById('app');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');

    // Hide sidebar and main content
    if (sidebar) sidebar.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';

    // Remove existing login screen if any
    const existing = document.getElementById('login-screen');
    if (existing) existing.remove();

    const loginDiv = document.createElement('div');
    loginDiv.id = 'login-screen';
    loginDiv.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg-primary);padding:20px;">
      <div style="width:100%;max-width:420px;">
        <div style="text-align:center;margin-bottom:36px;">
          <div style="font-size:3rem;margin-bottom:12px;filter:drop-shadow(0 0 12px var(--accent));">⚡</div>
          <h1 style="font-size:2rem;font-weight:800;color:var(--text-primary);">Group<span style="color:var(--accent);">ERP</span></h1>
          <p style="color:var(--text-secondary);margin-top:6px;font-size:0.9rem;">Système de Gestion & Facturation</p>
        </div>
        <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:32px;box-shadow:var(--shadow-lg);">
          <h2 style="font-size:1.2rem;font-weight:700;margin-bottom:24px;text-align:center;color:var(--text-primary);">Connexion</h2>
          <form id="login-form">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input class="form-input" type="email" id="login-email" placeholder="votre@email.com" required autocomplete="email" style="font-size:1rem;padding:12px 14px;"/>
            </div>
            <div class="form-group">
              <label class="form-label">Mot de passe</label>
              <input class="form-input" type="password" id="login-password" placeholder="••••••••" required autocomplete="current-password" style="font-size:1rem;padding:12px 14px;"/>
            </div>
            <div id="login-error" style="color:var(--danger);font-size:0.85rem;margin-bottom:12px;display:none;"></div>
            <button type="submit" class="btn btn-primary" id="login-btn" style="width:100%;padding:12px;font-size:1rem;justify-content:center;margin-top:8px;">
              Se Connecter
            </button>
          </form>
        </div>
        <p style="text-align:center;margin-top:20px;color:var(--text-muted);font-size:0.8rem;">
          Groupement des Poteaux Béton &copy; ${new Date().getFullYear()}
        </p>
      </div>
    </div>
    `;
    app.parentElement.insertBefore(loginDiv, app);

    // Wire form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        const btn = document.getElementById('login-btn');

        if (!email || !password) {
            errorDiv.textContent = 'Veuillez remplir tous les champs.';
            errorDiv.style.display = 'block';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Connexion...';
        errorDiv.style.display = 'none';

        try {
            await login(email, password);
            // Success — auth state listener will handle the rest
            if (onSuccess) onSuccess();
        } catch (err) {
            let msg = 'Erreur de connexion.';
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                msg = 'Email ou mot de passe incorrect.';
            } else if (err.code === 'auth/too-many-requests') {
                msg = 'Trop de tentatives. Réessayez plus tard.';
            } else if (err.code === 'auth/invalid-email') {
                msg = 'Adresse email invalide.';
            }
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Se Connecter';
        }
    });

    // Focus email field
    setTimeout(() => document.getElementById('login-email')?.focus(), 100);
}

export function removeLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) loginScreen.remove();
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    if (sidebar) sidebar.style.display = '';
    if (mainContent) mainContent.style.display = '';
}
