// Users Management Page
import { getAll, update, remove } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatDate } from '../utils/helpers.js';
import { isSuperAdmin, createUser, getUserProfile } from '../data/auth.js';
import { paginate, filterBarHTML, wireFilters } from '../utils/pagination.js';

export async function renderUsers() {
    if (!isSuperAdmin()) {
        document.getElementById('page-content').innerHTML = '<div class="empty-state"><div class="icon">🔒</div><div class="title">Accès refusé</div></div>';
        return;
    }

    const content = document.getElementById('page-content');
    let users = await getAll('users').catch(() => []);
    let roles = await getAll('roles').catch(() => []);
    let currentPage = 1, currentFilters = {};

    function render(filters = currentFilters, page = currentPage) {
        currentFilters = filters; currentPage = page;
        let filtered = [...users];
        if (filters.search) {
            const q = filters.search.toLowerCase();
            filtered = filtered.filter(u =>
                (u.displayName || '').toLowerCase().includes(q) ||
                (u.email || '').toLowerCase().includes(q) ||
                (u.roleName || '').toLowerCase().includes(q)
            );
        }
        const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));

        content.innerHTML = `
        <div class="page-header">
          <div><h1 class="page-title">👤 Gestion des Utilisateurs</h1><p class="page-subtitle">Créer et gérer les comptes utilisateurs</p></div>
          <button class="btn btn-primary" id="add-user-btn">+ Nouvel Utilisateur</button>
        </div>
        ${filterBarHTML({ showDate: false, showStatus: false })}
        ${paged.length ? `<div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Type</th><th>Actions</th></tr></thead>
          <tbody>
            ${paged.map(u => `<tr>
              <td><strong style="color:var(--accent)">${u.displayName || '-'}</strong></td>
              <td>${u.email || '-'}</td>
              <td><span class="badge badge-info">${u.roleName || '-'}</span></td>
              <td>${u.isSuperAdmin ? '<span class="badge badge-danger">Super Admin</span>' : '<span class="badge badge-default">Standard</span>'}</td>
              <td class="actions">
                <button class="btn btn-sm btn-secondary edit-user" data-id="${u.id}">✏️</button>
                ${u.id !== getUserProfile()?.uid ? `<button class="btn btn-sm btn-danger delete-user" data-id="${u.id}">🗑️</button>` : ''}
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>` : '<div class="empty-state"><div class="icon">👤</div><div class="title">Aucun utilisateur</div></div>'}
        <div id="pagination-controls" class="pagination-container"></div>
        `;

        paginate(filtered, page, 'pagination-controls', p => render(filters, p));
        wireFilters((f, p) => render(f, p));

        document.getElementById('add-user-btn').onclick = () => openCreateForm();
        document.querySelectorAll('.edit-user').forEach(b => {
            b.onclick = () => {
                const u = users.find(x => x.id === b.dataset.id);
                if (u) openEditForm(u);
            };
        });
        document.querySelectorAll('.delete-user').forEach(b => {
            b.onclick = async () => {
                if (await confirmDialog('Supprimer cet utilisateur de la base ? (Le compte Auth restera actif)')) {
                    await remove('users', b.dataset.id);
                    users = users.filter(x => x.id !== b.dataset.id);
                    render();
                    showToast('Utilisateur supprimé');
                }
            };
        });
    }

    function openCreateForm() {
        showModal('Nouvel Utilisateur', `
          <form id="user-form">
            <div class="form-group">
              <label class="form-label">Nom complet *</label>
              <input class="form-input" id="u-name" placeholder="Nom et prénom" required/>
            </div>
            <div class="form-group">
              <label class="form-label">Email *</label>
              <input class="form-input" type="email" id="u-email" placeholder="email@example.com" required/>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Mot de passe *</label>
                <input class="form-input" type="password" id="u-pass" placeholder="Min. 6 caractères" required minlength="6"/>
              </div>
              <div class="form-group">
                <label class="form-label">Confirmer mot de passe *</label>
                <input class="form-input" type="password" id="u-pass2" placeholder="Retapez" required minlength="6"/>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Rôle *</label>
              <select class="form-select" id="u-role" required>
                <option value="">-- Sélectionner un rôle --</option>
                ${roles.filter(r => !r.isSuperAdmin).map(r => `<option value="${r.id}" data-name="${r.nom}">${r.nom}</option>`).join('')}
              </select>
            </div>
            <div id="u-error" style="color:var(--danger);font-size:0.85rem;display:none;margin-bottom:8px;"></div>
          </form>
        `, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button>
           <button class="btn btn-primary" id="save-user">Créer</button>`);

        document.getElementById('save-user').onclick = async () => {
            const name = document.getElementById('u-name').value.trim();
            const email = document.getElementById('u-email').value.trim();
            const pass = document.getElementById('u-pass').value;
            const pass2 = document.getElementById('u-pass2').value;
            const roleSelect = document.getElementById('u-role');
            const roleId = roleSelect.value;
            const roleName = roleSelect.selectedOptions[0]?.dataset?.name || '';
            const errorDiv = document.getElementById('u-error');

            errorDiv.style.display = 'none';

            if (!name || !email || !pass || !roleId) {
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
                errorDiv.textContent = 'Mot de passe: minimum 6 caractères.';
                errorDiv.style.display = 'block';
                return;
            }

            try {
                const uid = await createUser(email, pass, name, roleId, roleName);
                users.push({ id: uid, email, displayName: name, roleId, roleName });
                hideModal();
                render();
                showToast(`Utilisateur "${name}" créé`);
                // Note: createUser logs in as the new user. 
                // The admin will be logged out. Show warning.
                showToast('Vous avez été déconnecté. Reconnectez-vous.', 'info');
            } catch (err) {
                let msg = 'Erreur: ' + err.message;
                if (err.code === 'auth/email-already-in-use') msg = 'Cet email est déjà utilisé.';
                if (err.code === 'auth/weak-password') msg = 'Mot de passe trop faible.';
                errorDiv.textContent = msg;
                errorDiv.style.display = 'block';
            }
        };
    }

    function openEditForm(user) {
        showModal(`Modifier: ${user.displayName}`, `
          <form id="user-edit-form">
            <div class="form-group">
              <label class="form-label">Nom complet</label>
              <input class="form-input" id="ue-name" value="${user.displayName || ''}" required/>
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input class="form-input" value="${user.email || ''}" disabled style="opacity:0.6"/>
              <small style="color:var(--text-muted)">L'email ne peut pas être modifié ici</small>
            </div>
            <div class="form-group">
              <label class="form-label">Rôle</label>
              <select class="form-select" id="ue-role">
                <option value="">-- Aucun rôle --</option>
                ${roles.map(r => `<option value="${r.id}" data-name="${r.nom}" ${user.roleId === r.id ? 'selected' : ''}>${r.nom}${r.isSuperAdmin ? ' (Super Admin)' : ''}</option>`).join('')}
              </select>
            </div>
          </form>
        `, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button>
           <button class="btn btn-primary" id="save-user-edit">Enregistrer</button>`);

        document.getElementById('save-user-edit').onclick = async () => {
            const name = document.getElementById('ue-name').value.trim();
            const roleSelect = document.getElementById('ue-role');
            const roleId = roleSelect.value;
            const roleName = roleSelect.selectedOptions[0]?.dataset?.name || '';
            const selectedRole = roles.find(r => r.id === roleId);

            if (!name) { showToast('Nom requis', 'error'); return; }

            const data = {
                displayName: name,
                roleId,
                roleName,
                isSuperAdmin: selectedRole?.isSuperAdmin || false
            };

            await update('users', user.id, data);
            Object.assign(user, data);
            hideModal();
            render();
            showToast('Utilisateur modifié');
        };
    }

    render();
}
