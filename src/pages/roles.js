// Roles Management Page
import { getAll, add, update, remove } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog } from '../utils/helpers.js';
import { isSuperAdmin } from '../data/auth.js';

// All menu keys that can have permissions
const MENU_KEYS = [
    { key: 'dashboard', label: 'Tableau de Bord' },
    { key: 'types', label: 'Types' },
    { key: 'produits', label: 'Produits (Poteaux)' },
    { key: 'fournisseurs', label: 'Fournisseurs' },
    { key: 'devis_achat', label: 'Devis Achat' },
    { key: 'bc_achat', label: 'BC Achat' },
    { key: 'bl_achat', label: 'BL Achat' },
    { key: 'facture_achat', label: 'Facture Achat' },
    { key: 'clients', label: 'Clients' },
    { key: 'devis_vente', label: 'Devis Vente' },
    { key: 'bc_vente', label: 'BC Vente' },
    { key: 'bl_vente', label: 'BL Vente' },
    { key: 'facture_vente', label: 'Facture Vente' },
    { key: 'stock', label: 'Stock' },
    { key: 'caisse', label: 'Caisse' },
    { key: 'reglements', label: 'Règlements' },
    { key: 'bcg', label: 'Bon Commande Globale' },
    { key: 'stats', label: 'Statistiques' },
    { key: 'roles', label: 'Rôles' },
    { key: 'users', label: 'Utilisateurs' },
    { key: 'parametres', label: 'Paramètres' },
];

const CRUD_ACTIONS = ['view', 'create', 'edit', 'delete'];

export async function renderRoles() {
    if (!isSuperAdmin()) {
        document.getElementById('page-content').innerHTML = '<div class="empty-state"><div class="icon">🔒</div><div class="title">Accès refusé</div></div>';
        return;
    }

    const content = document.getElementById('page-content');
    let roles = await getAll('roles').catch(() => []);

    function render() {
        content.innerHTML = `
        <div class="page-header">
          <div><h1 class="page-title">🔐 Gestion des Rôles</h1><p class="page-subtitle">Définir les permissions par rôle</p></div>
          <button class="btn btn-primary" id="add-role-btn">+ Nouveau Rôle</button>
        </div>
        ${roles.length ? `<div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Nom du Rôle</th><th>Type</th><th>Nb Permissions</th><th>Actions</th></tr></thead>
          <tbody>
            ${roles.map(r => {
                const permCount = r.isSuperAdmin ? 'Toutes' : Object.values(r.permissions || {}).filter(p => p.view).length;
                return `<tr>
                  <td><strong style="color:var(--accent)">${r.nom || r.id}</strong></td>
                  <td>${r.isSuperAdmin ? '<span class="badge badge-danger">Super Admin</span>' : '<span class="badge badge-info">Standard</span>'}</td>
                  <td>${permCount}</td>
                  <td class="actions">
                    ${r.isSuperAdmin ? '' : `<button class="btn btn-sm btn-secondary edit-role" data-id="${r.id}">✏️</button><button class="btn btn-sm btn-danger delete-role" data-id="${r.id}">🗑️</button>`}
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table></div>` : '<div class="empty-state"><div class="icon">🔐</div><div class="title">Aucun rôle</div><div class="desc">Créez un rôle pour commencer</div></div>'}
        `;

        document.getElementById('add-role-btn').onclick = () => openForm();
        document.querySelectorAll('.edit-role').forEach(b => {
            b.onclick = () => {
                const r = roles.find(x => x.id === b.dataset.id);
                if (r) openForm(r);
            };
        });
        document.querySelectorAll('.delete-role').forEach(b => {
            b.onclick = async () => {
                if (await confirmDialog('Supprimer ce rôle ?')) {
                    await remove('roles', b.dataset.id);
                    roles = roles.filter(x => x.id !== b.dataset.id);
                    render();
                    showToast('Rôle supprimé');
                }
            };
        });
    }

    function openForm(role = null) {
        const isEdit = !!role;
        const perms = role?.permissions || {};

        const permRows = MENU_KEYS.map(m => {
            const p = perms[m.key] || {};
            return `<tr>
              <td style="font-weight:600;font-size:0.88rem;">${m.label}</td>
              ${CRUD_ACTIONS.map(a => `<td style="text-align:center">
                <input type="checkbox" class="perm-check" data-menu="${m.key}" data-action="${a}" ${p[a] ? 'checked' : ''} style="accent-color:var(--accent);width:16px;height:16px;"/>
              </td>`).join('')}
            </tr>`;
        }).join('');

        showModal(isEdit ? `Modifier: ${role.nom}` : 'Nouveau Rôle', `
          <form id="role-form">
            <div class="form-group">
              <label class="form-label">Nom du Rôle *</label>
              <input class="form-input" id="role-nom" value="${role?.nom || ''}" placeholder="Ex: Gestionnaire, Comptable..." required/>
            </div>
            <h4 style="margin:16px 0 8px;">Permissions par menu</h4>
            <div style="margin-bottom:8px;display:flex;gap:8px;">
              <button type="button" class="btn btn-sm btn-secondary" id="check-all-perms">Tout cocher</button>
              <button type="button" class="btn btn-sm btn-secondary" id="uncheck-all-perms">Tout décocher</button>
              <button type="button" class="btn btn-sm btn-secondary" id="check-view-only">Vue seulement</button>
            </div>
            <div class="table-wrapper" style="max-height:400px;overflow-y:auto;">
              <table class="data-table">
                <thead><tr><th>Menu</th><th style="text-align:center;width:70px">Voir</th><th style="text-align:center;width:70px">Créer</th><th style="text-align:center;width:70px">Modifier</th><th style="text-align:center;width:70px">Suppr.</th></tr></thead>
                <tbody>${permRows}</tbody>
              </table>
            </div>
          </form>
        `, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button>
           <button class="btn btn-primary" id="save-role">${isEdit ? 'Modifier' : 'Créer'}</button>`);

        document.querySelector('.modal-container').style.maxWidth = '800px';

        // Bulk check/uncheck
        document.getElementById('check-all-perms').onclick = () => {
            document.querySelectorAll('.perm-check').forEach(c => c.checked = true);
        };
        document.getElementById('uncheck-all-perms').onclick = () => {
            document.querySelectorAll('.perm-check').forEach(c => c.checked = false);
        };
        document.getElementById('check-view-only').onclick = () => {
            document.querySelectorAll('.perm-check').forEach(c => {
                c.checked = c.dataset.action === 'view';
            });
        };

        document.getElementById('save-role').onclick = async () => {
            const nom = document.getElementById('role-nom').value.trim();
            if (!nom) { showToast('Nom requis', 'error'); return; }

            // Collect permissions
            const permissions = {};
            MENU_KEYS.forEach(m => {
                permissions[m.key] = {};
                CRUD_ACTIONS.forEach(a => {
                    const cb = document.querySelector(`.perm-check[data-menu="${m.key}"][data-action="${a}"]`);
                    permissions[m.key][a] = cb?.checked || false;
                });
            });

            const data = { nom, permissions, isSuperAdmin: false };

            if (isEdit) {
                await update('roles', role.id, data);
                Object.assign(role, data);
            } else {
                const id = await add('roles', data);
                roles.push({ id, ...data });
            }
            hideModal();
            render();
            showToast(isEdit ? 'Rôle modifié' : 'Rôle créé');
        };
    }

    render();
}
