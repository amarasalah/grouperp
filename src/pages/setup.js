// Hidden Super Admin Setup Page — only works when no users exist
import { auth, db } from '../data/firebase.js';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { bootstrapSuperAdmin } from '../data/auth.js';
import { showToast } from '../utils/helpers.js';

export function renderSetup() {
    const app = document.getElementById('app');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');

    if (sidebar) sidebar.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';

    const existing = document.getElementById('setup-container');
    if (existing) existing.remove();

    const setupDiv = document.createElement('div');
    setupDiv.id = 'setup-container';
    setupDiv.innerHTML = `
    <div class="login-wrapper">
      <div class="login-card">
        <div class="login-header" style="background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%)">
          <span class="login-logo">\u{1F6E1}\uFE0F</span>
          <h1 class="login-title">Super Admin</h1>
          <p class="login-subtitle">Configuration initiale du syst\u00E8me</p>
        </div>
        <div id="setup-body" class="login-form">
          <div style="text-align:center;padding:20px">
            <div class="spinner"></div>
            <p style="color:var(--text-muted);margin-top:12px">V\u00E9rification...</p>
          </div>
        </div>
        <div class="login-footer">
          <a href="#/" style="color:var(--accent);text-decoration:none;font-weight:600">\u2190 Retour \u00E0 la connexion</a>
        </div>
      </div>
    </div>`;
    app.parentElement.insertBefore(setupDiv, app);

    checkAndRender(setupDiv);
}

async function checkAndRender(setupDiv) {
    const body = document.getElementById('setup-body');
    if (!body) return;

    try {
        const usersSnap = await getDocs(collection(db, 'app_users'));
        if (usersSnap.size > 0) {
            body.innerHTML = `
                <div style="text-align:center;padding:24px">
                    <div style="font-size:2.5rem;margin-bottom:12px">\u{1F6AB}</div>
                    <h3 style="color:var(--danger);margin-bottom:8px">Configuration d\u00E9j\u00E0 effectu\u00E9e</h3>
                    <p style="color:var(--text-muted);font-size:0.88rem">Un super admin existe d\u00E9j\u00E0. Cette page n'est plus accessible.</p>
                    <a href="#/" class="btn btn-primary" style="margin-top:16px;display:inline-block">Retour \u00E0 la connexion</a>
                </div>`;
            return;
        }
    } catch (e) {
        // If collection doesn't exist yet, that's fine — proceed
    }

    // Show form
    body.innerHTML = `
        <form id="setup-form">
            <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:16px;padding:10px 12px;background:var(--bg-primary);border-radius:var(--radius-sm);border:1px solid var(--border-color)">
                \u26A0\uFE0F Cette page cr\u00E9e le premier compte Super Admin. Elle sera d\u00E9sactiv\u00E9e apr\u00E8s la cr\u00E9ation.
            </p>
            <div class="form-group">
                <label class="form-label">Nom Complet *</label>
                <input class="form-input" type="text" id="setup-name" required placeholder="Nom et pr\u00E9nom"/>
            </div>
            <div class="form-group">
                <label class="form-label">Email *</label>
                <input class="form-input" type="email" id="setup-email" required placeholder="admin@groupement.com" autocomplete="username"/>
            </div>
            <div class="form-group">
                <label class="form-label">Mot de passe *</label>
                <input class="form-input" type="password" id="setup-password" required placeholder="Min 6 caract\u00E8res" minlength="6" autocomplete="new-password"/>
            </div>
            <div class="form-group">
                <label class="form-label">Confirmer le mot de passe *</label>
                <input class="form-input" type="password" id="setup-password2" required placeholder="Retaper le mot de passe" autocomplete="new-password"/>
            </div>
            <div id="setup-error" style="display:none;color:var(--danger);font-size:0.85rem;margin-bottom:12px;padding:8px 12px;background:var(--danger-bg);border-radius:var(--radius-sm)"></div>
            <button type="submit" class="btn btn-primary login-btn" id="setup-submit" style="background:linear-gradient(135deg,#ef4444,#dc2626)">
                <span id="setup-btn-text">\u{1F6E1}\uFE0F Cr\u00E9er le Super Admin</span>
            </button>
        </form>`;

    document.getElementById('setup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('setup-name').value.trim();
        const email = document.getElementById('setup-email').value.trim();
        const password = document.getElementById('setup-password').value;
        const password2 = document.getElementById('setup-password2').value;
        const errorDiv = document.getElementById('setup-error');
        const btn = document.getElementById('setup-submit');
        const btnText = document.getElementById('setup-btn-text');

        errorDiv.style.display = 'none';

        if (!name) { showErr(errorDiv, 'Nom requis'); return; }
        if (!email) { showErr(errorDiv, 'Email requis'); return; }
        if (password.length < 6) { showErr(errorDiv, 'Mot de passe min 6 caract\u00E8res'); return; }
        if (password !== password2) { showErr(errorDiv, 'Les mots de passe ne correspondent pas'); return; }

        btn.disabled = true;
        btnText.textContent = 'Cr\u00E9ation en cours...';

        try {
            // 1. Bootstrap the super_admin role
            await bootstrapSuperAdmin();

            // 2. Create Firebase Auth user
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            const uid = cred.user.uid;

            // 3. Create Firestore user profile with super_admin role
            await setDoc(doc(db, 'app_users', uid), {
                displayName: name,
                email,
                uid,
                roleId: 'super_admin',
                roleName: 'Super Admin',
                phone: '',
                active: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // 4. Show success and redirect
            body.innerHTML = `
                <div style="text-align:center;padding:24px">
                    <div style="font-size:2.5rem;margin-bottom:12px">\u2705</div>
                    <h3 style="color:var(--success);margin-bottom:8px">Super Admin cr\u00E9\u00E9 avec succ\u00E8s!</h3>
                    <p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:4px"><strong>${name}</strong></p>
                    <p style="color:var(--text-muted);font-size:0.85rem">${email}</p>
                    <p style="color:var(--text-muted);font-size:0.82rem;margin-top:12px">Redirection automatique...</p>
                </div>`;

            setTimeout(() => {
                window.location.hash = '/';
                window.location.reload();
            }, 2000);

        } catch (err) {
            let msg = 'Erreur: ' + err.message;
            if (err.code === 'auth/email-already-in-use') msg = 'Cet email est d\u00E9j\u00E0 utilis\u00E9';
            if (err.code === 'auth/weak-password') msg = 'Mot de passe trop faible';
            if (err.code === 'auth/invalid-email') msg = 'Email invalide';
            showErr(errorDiv, msg);
            btn.disabled = false;
            btnText.textContent = '\u{1F6E1}\uFE0F Cr\u00E9er le Super Admin';
        }
    });
}

function showErr(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
}
