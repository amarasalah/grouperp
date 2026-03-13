// Users Management Page - Super admin creates users with role assignment
import { getAll, update, remove } from '../data/store.js';
import { createAuthUser, isSuperAdmin, getCurrentProfile } from '../data/auth.js';
import { showToast, showModal, hideModal, confirmDialog, formatDate } from '../utils/helpers.js';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../data/firebase.js';

export async function renderUsers() {
    const content = document.getElementById('page-content');
    let users = await getAll('app_users').catch(() => []);
    const roles = await getAll('roles').catch(() => []);

    function render() {
        content.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title">👤 Gestion des Utilisateurs</h1><p class="page-subtitle">Créer et gérer les comptes utilisateurs</p></div>
            <button class="btn btn-primary" id="add-user-btn">+ Nouvel Utilisateur</button>
        </div>
        ${users.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr>
            <th>Nom</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Actions</th>
        </tr></thead><tbody>
            ${users.map(u => {
                const role = roles.find(r => r.id === u.roleId);
                return `<tr>
                    <td><strong style="color:var(--accent)">${u.displayName || u.email || ''}</strong></td>
                    <td>${u.email || '-'}</td>
                    <td><span class="badge ${role?.isSuperAdmin ? 'badge-danger' : 'badge-info'}">${role?.name || u.roleName || '-'}</span></td>
                    <td><span class="badge ${u.active !== false ? 'badge-success' : 'badge-warning'}">${u.active !== false ? 'Actif' : 'Inactif'}</span></td>
                    <td class="actions">
                        <button class="btn btn-sm btn-secondary edit-user" data-id="${u.id}">✏️</button>
                        <button class="btn btn-sm btn-${u.active !== false ? 'warning' : 'success'} toggle-user" data-id="${u.id}">${u.active !== false ? '🔒' : '🔓'}</button>
                    </td>
                </tr>`;
            }).join('')}
        </tbody></table></div>` : `<div class="empty-state"><div class="icon">👤</div><div class="title">Aucun utilisateur</div><div class="desc">Créez un utilisateur pour commencer</div></div>`}`;

        document.getElementById('add-user-btn').onclick = () => openCreateForm();
        document.querySelectorAll('.edit-user').forEach(b => b.onclick = () => {
            const u = users.find(x => x.id === b.dataset.id);
            if (u) openEditForm(u);
        });
        document.querySelectorAll('.toggle-user').forEach(b => b.onclick = async () => {
            const u = users.find(x => x.id === b.dataset.id);
            if (!u) return;
            const newStatus = u.active === false ? true : false;
            const label = newStatus ? 'activer' : 'désactiver';
            if (await confirmDialog(`Voulez-vous ${label} cet utilisateur ?`)) {
                await setDoc(doc(db, 'app_users', u.id), { active: newStatus, updatedAt: serverTimestamp() }, { merge: true });
                u.active = newStatus;
                render();
                showToast(`Utilisateur ${newStatus ? 'activé' : 'désactivé'}`);
            }
        });
    }

    function openCreateForm() {
        showModal('Nouvel Utilisateur', `<form id="user-form">
            <div class="form-row">
                <div class="form-group"><label class="form-label">Nom Complet *</label><input class="form-input" name="displayName" required placeholder="Nom et prénom"/></div>
                <div class="form-group"><label class="form-label">Email *</label><input class="form-input" type="email" name="email" required placeholder="email@exemple.com"/></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Mot de passe *</label><input class="form-input" type="password" name="password" required placeholder="Min 6 caractères" minlength="6"/></div>
                <div class="form-group"><label class="form-label">Confirmer le mot de passe *</label><input class="form-input" type="password" name="password2" required placeholder="Retaper le mot de passe"/></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Rôle *</label><select class="form-select" name="roleId" required>
                    <option value="">-- Sélectionner un rôle --</option>
                    ${roles.map(r => `<option value="${r.id}">${r.name}${r.isSuperAdmin ? ' (Super Admin)' : ''}</option>`).join('')}
                </select></div>
                <div class="form-group"><label class="form-label">Téléphone</label><input class="form-input" name="phone" placeholder="Numéro de téléphone"/></div>
            </div>
        </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button>
        <button class="btn btn-primary" id="save-user">Créer</button>`);

        document.getElementById('save-user').onclick = async () => {
            const f = document.getElementById('user-form');
            const displayName = f.querySelector('[name="displayName"]').value.trim();
            const email = f.querySelector('[name="email"]').value.trim();
            const password = f.querySelector('[name="password"]').value;
            const password2 = f.querySelector('[name="password2"]').value;
            const roleId = f.querySelector('[name="roleId"]').value;
            const phone = f.querySelector('[name="phone"]').value.trim();

            if (!displayName) { showToast('Nom requis', 'error'); return; }
            if (!email) { showToast('Email requis', 'error'); return; }
            if (!password || password.length < 6) { showToast('Mot de passe min 6 caractères', 'error'); return; }
            if (password !== password2) { showToast('Les mots de passe ne correspondent pas', 'error'); return; }
            if (!roleId) { showToast('Rôle requis', 'error'); return; }

            const role = roles.find(r => r.id === roleId);
            const btn = document.getElementById('save-user');
            btn.disabled = true;
            btn.textContent = 'Création...';

            try {
                const uid = await createAuthUser(email, password, {
                    displayName,
                    roleName: role?.name || '',
                    roleId,
                    phone,
                });
                users.unshift({ id: uid, displayName, email, roleId, roleName: role?.name || '', phone, active: true });
                hideModal();
                render();
                showToast(`Utilisateur "${displayName}" créé avec le rôle "${role?.name}"`);
            } catch (err) {
                let msg = 'Erreur: ' + err.message;
                if (err.code === 'auth/email-already-in-use') msg = 'Cet email est déjà utilisé';
                if (err.code === 'auth/weak-password') msg = 'Mot de passe trop faible (min 6 car.)';
                if (err.code === 'auth/invalid-email') msg = 'Email invalide';
                showToast(msg, 'error');
                btn.disabled = false;
                btn.textContent = 'Créer';
            }
        };
    }

    function openEditForm(user) {
        showModal(`Modifier - ${user.displayName || user.email}`, `<form id="user-edit-form">
            <div class="form-row">
                <div class="form-group"><label class="form-label">Nom Complet</label><input class="form-input" name="displayName" value="${user.displayName || ''}" required/></div>
                <div class="form-group"><label class="form-label">Email</label><input class="form-input" type="email" value="${user.email || ''}" disabled style="opacity:0.6"/></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Rôle *</label><select class="form-select" name="roleId" required>
                    <option value="">-- Sélectionner --</option>
                    ${roles.map(r => `<option value="${r.id}" ${user.roleId === r.id ? 'selected' : ''}>${r.name}${r.isSuperAdmin ? ' (Super Admin)' : ''}</option>`).join('')}
                </select></div>
                <div class="form-group"><label class="form-label">Téléphone</label><input class="form-input" name="phone" value="${user.phone || ''}"/></div>
            </div>
        </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button>
        <button class="btn btn-primary" id="save-user-edit">Modifier</button>`);

        document.getElementById('save-user-edit').onclick = async () => {
            const f = document.getElementById('user-edit-form');
            const displayName = f.querySelector('[name="displayName"]').value.trim();
            const roleId = f.querySelector('[name="roleId"]').value;
            const phone = f.querySelector('[name="phone"]').value.trim();

            if (!displayName) { showToast('Nom requis', 'error'); return; }
            if (!roleId) { showToast('Rôle requis', 'error'); return; }

            const role = roles.find(r => r.id === roleId);
            try {
                await setDoc(doc(db, 'app_users', user.id), {
                    displayName,
                    roleId,
                    roleName: role?.name || '',
                    phone,
                    updatedAt: serverTimestamp()
                }, { merge: true });
                user.displayName = displayName;
                user.roleId = roleId;
                user.roleName = role?.name || '';
                user.phone = phone;
                hideModal();
                render();
                showToast('Utilisateur modifié');
            } catch (err) {
                showToast('Erreur: ' + err.message, 'error');
            }
        };
    }

    render();
}
