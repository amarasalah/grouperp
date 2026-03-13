// Roles Management Page - Super admin creates roles with menu+CRUD permissions
import { getAll, add, update, remove } from '../data/store.js';
import { isSuperAdmin } from '../data/auth.js';
import { showToast, showModal, hideModal, confirmDialog } from '../utils/helpers.js';

// All available menu items (routes) that can be assigned to a role
const MENU_ITEMS = [
    { route: '/', label: 'Tableau de Bord', section: 'Principal' },
    { route: '/categories', label: 'Catégories', section: 'Catalogue' },
    { route: '/lots', label: 'Lots', section: 'Catalogue' },
    { route: '/produits', label: 'Produits (Poteaux)', section: 'Catalogue' },
    { route: '/fournisseurs', label: 'Fournisseurs', section: 'Achats' },
    { route: '/bl-achat', label: 'BL Achat', section: 'Achats' },
    { route: '/facture-achat', label: 'Facture Achat', section: 'Achats' },
    { route: '/clients', label: 'Clients', section: 'Ventes' },
    { route: '/bc-vente', label: 'Bon de Commande', section: 'Ventes' },
    { route: '/bl-vente', label: 'BL Vente', section: 'Ventes' },
    { route: '/facture-vente', label: 'Facture Vente', section: 'Ventes' },
    { route: '/stock', label: 'Stock', section: 'Gestion' },
    { route: '/caisse', label: 'Caisse', section: 'Gestion' },
    { route: '/reglements', label: 'Règlements', section: 'Gestion' },
    { route: '/parametres', label: 'Paramètres', section: 'Configuration' },
    { route: '/roles', label: 'Rôles', section: 'Administration' },
    { route: '/users', label: 'Utilisateurs', section: 'Administration' },
];

const CRUD_ACTIONS = ['view', 'create', 'edit', 'delete'];
const CRUD_LABELS = { view: 'Voir', create: 'Créer', edit: 'Modifier', delete: 'Supprimer' };

export async function renderRoles() {
    const content = document.getElementById('page-content');
    let roles = await getAll('roles').catch(() => []);

    function render() {
        content.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title">🛡️ Gestion des Rôles</h1><p class="page-subtitle">Créer des rôles et assigner les menus avec permissions CRUD</p></div>
            <button class="btn btn-primary" id="add-role-btn">+ Nouveau Rôle</button>
        </div>
        ${roles.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr>
            <th>Rôle</th><th>Description</th><th>Super Admin</th><th>Menus</th><th>Actions</th>
        </tr></thead><tbody>
            ${roles.map(r => {
                const menuCount = Object.keys(r.permissions || {}).filter(k => r.permissions[k]?.view).length;
                return `<tr>
                    <td><strong style="color:var(--accent)">${r.name || ''}</strong></td>
                    <td style="max-width:250px;white-space:normal">${r.description || '-'}</td>
                    <td>${r.isSuperAdmin ? '<span class="badge badge-danger">Oui</span>' : '<span class="badge badge-default">Non</span>'}</td>
                    <td><span class="badge badge-info">${menuCount} menu(s)</span></td>
                    <td class="actions">
                        <button class="btn btn-sm btn-secondary view-role" data-id="${r.id}">👁️</button>
                        ${!r.isSuperAdmin ? `<button class="btn btn-sm btn-secondary edit-role" data-id="${r.id}">✏️</button>
                        <button class="btn btn-sm btn-danger delete-role" data-id="${r.id}">🗑️</button>` : ''}
                    </td>
                </tr>`;
            }).join('')}
        </tbody></table></div>` : `<div class="empty-state"><div class="icon">🛡️</div><div class="title">Aucun rôle</div><div class="desc">Créez un rôle pour commencer</div></div>`}`;

        document.getElementById('add-role-btn').onclick = () => openForm();
        document.querySelectorAll('.view-role').forEach(b => b.onclick = () => {
            const r = roles.find(x => x.id === b.dataset.id);
            if (r) viewRole(r);
        });
        document.querySelectorAll('.edit-role').forEach(b => b.onclick = () => {
            const r = roles.find(x => x.id === b.dataset.id);
            if (r) openForm(r);
        });
        document.querySelectorAll('.delete-role').forEach(b => b.onclick = async () => {
            if (await confirmDialog('Supprimer ce rôle ?')) {
                await remove('roles', b.dataset.id);
                roles = roles.filter(x => x.id !== b.dataset.id);
                render();
                showToast('Rôle supprimé');
            }
        });
    }

    function openForm(role = null) {
        const isEdit = !!role;
        const perms = role?.permissions || {};

        // Group menu items by section
        const sections = {};
        MENU_ITEMS.forEach(m => {
            if (!sections[m.section]) sections[m.section] = [];
            sections[m.section].push(m);
        });

        const permissionsHTML = Object.entries(sections).map(([section, items]) => `
            <div style="margin-bottom:16px">
                <h4 style="margin-bottom:8px;color:var(--accent);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.5px">${section}</h4>
                <div class="table-wrapper"><table class="data-table" style="margin-bottom:0"><thead><tr>
                    <th style="width:40%">Menu</th>
                    ${CRUD_ACTIONS.map(a => `<th style="text-align:center;width:15%">${CRUD_LABELS[a]}</th>`).join('')}
                </tr></thead><tbody>
                    ${items.map(item => {
                        const p = perms[item.route] || {};
                        return `<tr data-route="${item.route}">
                            <td>
                                <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                                    <input type="checkbox" class="menu-toggle" data-route="${item.route}" ${p.view ? 'checked' : ''}/>
                                    <strong>${item.label}</strong>
                                </label>
                            </td>
                            ${CRUD_ACTIONS.map(a => `<td style="text-align:center">
                                <input type="checkbox" class="perm-cb" data-route="${item.route}" data-action="${a}" ${p[a] ? 'checked' : ''} ${a === 'view' ? 'disabled' : ''}/>
                            </td>`).join('')}
                        </tr>`;
                    }).join('')}
                </tbody></table></div>
            </div>
        `).join('');

        showModal(isEdit ? `Modifier Rôle - ${role.name}` : 'Nouveau Rôle', `<form id="role-form">
            <div class="form-row">
                <div class="form-group"><label class="form-label">Nom du Rôle *</label><input class="form-input" name="name" value="${role?.name || ''}" required placeholder="ex: Gestionnaire Achats"/></div>
                <div class="form-group"><label class="form-label">Description</label><input class="form-input" name="description" value="${role?.description || ''}" placeholder="Description du rôle"/></div>
            </div>
            <h4 style="margin:16px 0 8px">Permissions par Menu</h4>
            <p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:12px">Cochez les menus accessibles et les actions CRUD autorisées</p>
            ${permissionsHTML}
        </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button>
        <button class="btn btn-primary" id="save-role">${isEdit ? 'Modifier' : 'Créer'}</button>`);
        document.querySelector('.modal-container').style.maxWidth = '900px';

        // Wire menu toggle: when "view" checkbox changes, sync the menu-toggle and vice versa
        document.querySelectorAll('.menu-toggle').forEach(mt => {
            mt.onchange = () => {
                const route = mt.dataset.route;
                const viewCb = document.querySelector(`.perm-cb[data-route="${route}"][data-action="view"]`);
                if (viewCb) viewCb.checked = mt.checked;
                if (!mt.checked) {
                    // Uncheck all CRUD for this route
                    document.querySelectorAll(`.perm-cb[data-route="${route}"]`).forEach(cb => cb.checked = false);
                }
            };
        });

        // Save
        document.getElementById('save-role').onclick = async () => {
            const f = document.getElementById('role-form');
            const name = f.querySelector('[name="name"]').value.trim();
            const description = f.querySelector('[name="description"]').value.trim();
            if (!name) { showToast('Nom requis', 'error'); return; }

            // Collect permissions
            const permissions = {};
            MENU_ITEMS.forEach(item => {
                const menuChecked = document.querySelector(`.menu-toggle[data-route="${item.route}"]`)?.checked;
                if (menuChecked) {
                    const perm = {};
                    CRUD_ACTIONS.forEach(a => {
                        const cb = document.querySelector(`.perm-cb[data-route="${item.route}"][data-action="${a}"]`);
                        perm[a] = cb?.checked || false;
                    });
                    perm.view = true; // Always true if menu is checked
                    permissions[item.route] = perm;
                }
            });

            const data = { name, description, isSuperAdmin: false, permissions };

            if (isEdit) {
                await update('roles', role.id, data);
                Object.assign(role, data);
            } else {
                const id = await add('roles', data);
                roles.unshift({ id, ...data });
            }
            hideModal();
            render();
            showToast(isEdit ? 'Rôle modifié' : 'Rôle créé');
        };
    }

    function viewRole(role) {
        const perms = role.permissions || {};
        const rows = MENU_ITEMS.filter(m => perms[m.route]?.view).map(m => {
            const p = perms[m.route];
            return `<tr>
                <td><strong>${m.label}</strong> <small style="color:var(--text-muted)">${m.section}</small></td>
                ${CRUD_ACTIONS.map(a => `<td style="text-align:center">${p[a] ? '<span style="color:var(--success)">✓</span>' : '<span style="color:var(--text-muted)">—</span>'}</td>`).join('')}
            </tr>`;
        }).join('');

        showModal(`🛡️ Rôle - ${role.name}`, `
            <div class="doc-info" style="margin-bottom:16px">
                <div class="doc-info-box"><p><strong>Nom:</strong> ${role.name}</p><p><strong>Super Admin:</strong> ${role.isSuperAdmin ? 'Oui' : 'Non'}</p></div>
                <div class="doc-info-box"><p><strong>Description:</strong> ${role.description || '-'}</p></div>
            </div>
            <h4 style="margin:8px 0">Permissions</h4>
            ${rows ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Menu</th>${CRUD_ACTIONS.map(a => `<th style="text-align:center">${CRUD_LABELS[a]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>` : '<p style="color:var(--text-muted)">Aucune permission</p>'}
        `, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button>`);
        document.querySelector('.modal-container').style.maxWidth = '800px';
    }

    render();
}
