// Super Admin Setup - Hidden page (accessible via #/super-admin-setup)
import { createSuperAdmin } from '../data/auth.js';
import { showToast } from '../utils/helpers.js';

export function renderSuperAdminSetup() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
    <div style="max-width:500px;margin:60px auto;">
      <div style="text-align:center;margin-bottom:30px;">
        <div style="font-size:2.5rem;margin-bottom:10px;">🔐</div>
        <h1 style="font-size:1.5rem;font-weight:700;">Créer Super Admin</h1>
        <p style="color:var(--text-secondary);font-size:0.88rem;margin-top:6px;">Page de configuration initiale</p>
      </div>
      <div class="card" style="padding:28px;">
        <form id="sa-form">
          <div class="form-group">
            <label class="form-label">Nom complet</label>
            <input class="form-input" id="sa-name" placeholder="Nom du Super Admin" required/>
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" type="email" id="sa-email" placeholder="admin@example.com" required/>
          </div>
          <div class="form-group">
            <label class="form-label">Mot de passe</label>
            <input class="form-input" type="password" id="sa-password" placeholder="Minimum 6 caractères" required minlength="6"/>
          </div>
          <div class="form-group">
            <label class="form-label">Confirmer mot de passe</label>
            <input class="form-input" type="password" id="sa-password2" placeholder="Retapez le mot de passe" required minlength="6"/>
          </div>
          <div id="sa-error" style="color:var(--danger);font-size:0.85rem;margin-bottom:12px;display:none;"></div>
          <div id="sa-success" style="color:var(--success);font-size:0.85rem;margin-bottom:12px;display:none;"></div>
          <button type="submit" class="btn btn-primary" id="sa-btn" style="width:100%;justify-content:center;padding:12px;font-size:1rem;">
            Créer le Super Admin
          </button>
        </form>
      </div>
    </div>
    `;

    document.getElementById('sa-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('sa-name').value.trim();
        const email = document.getElementById('sa-email').value.trim();
        const pass = document.getElementById('sa-password').value;
        const pass2 = document.getElementById('sa-password2').value;
        const errorDiv = document.getElementById('sa-error');
        const successDiv = document.getElementById('sa-success');
        const btn = document.getElementById('sa-btn');

        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';

        if (!name || !email || !pass) {
            errorDiv.textContent = 'Tous les champs sont requis.';
            errorDiv.style.display = 'block';
            return;
        }
        if (pass !== pass2) {
            errorDiv.textContent = 'Les mots de passe ne correspondent pas.';
            errorDiv.style.display = 'block';
            return;
        }
        if (pass.length < 6) {
            errorDiv.textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
            errorDiv.style.display = 'block';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Création en cours...';

        try {
            await createSuperAdmin(email, pass, name);
            successDiv.textContent = `Super Admin "${name}" créé avec succès ! Vous êtes maintenant connecté.`;
            successDiv.style.display = 'block';
            btn.textContent = 'Créé ✓';
            showToast('Super Admin créé avec succès');
            // Redirect to dashboard after 2s
            setTimeout(() => {
                window.location.hash = '/';
                window.location.reload();
            }, 2000);
        } catch (err) {
            let msg = 'Erreur: ' + err.message;
            if (err.code === 'auth/email-already-in-use') {
                msg = 'Cet email est déjà utilisé.';
            }
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Créer le Super Admin';
        }
    });
}
