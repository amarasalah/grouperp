// Clients Page - with updated form fields and search & pagination
import { getAll, add, update, remove } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatCurrency, formatDate } from '../utils/helpers.js';
import { paginate, filterBarHTML, wireFilters } from '../utils/pagination.js';

export async function renderClients() {
  const content = document.getElementById('page-content');
  let clients = await getAll('clients').catch(() => []);
  let currentPage = 1, currentFilters = {};

  function render(filters = currentFilters, page = currentPage) {
    currentFilters = filters; currentPage = page;
    let filtered = [...clients];
    if (filters.search) { const q = filters.search.toLowerCase(); filtered = filtered.filter(c => (c.raisonSociale || '').toLowerCase().includes(q) || (c.telephone || '').includes(q) || (c.adresse || '').toLowerCase().includes(q)); }
    const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));

    content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">👥 Clients</h1><p class="page-subtitle">Gestion des clients</p></div>
        <button class="btn btn-primary" id="add-cl-btn">+ Nouveau Client</button></div>
      ${filterBarHTML({ showDate: false, showStatus: false })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Nom</th><th>Téléphone</th><th>Adresse</th><th>Matricule Fiscale</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(c => `<tr><td><strong style="color:var(--accent)">${c.raisonSociale}</strong></td><td>${c.telephone || '-'}</td><td>${c.adresse || '-'}</td><td>${c.matriculeFiscale || '-'}</td>
          <td class="actions"><button class="btn btn-sm btn-secondary edit-cl" data-id="${c.id}">✏️</button><button class="btn btn-sm btn-danger delete-cl" data-id="${c.id}">🗑️</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">👥</div><div class="title">Aucun client</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;

    paginate(filtered, page, 'pagination-controls', p => render(filters, p));
    wireFilters((f, p) => render(f, p));
    document.getElementById('add-cl-btn').onclick = () => openForm();
    document.querySelectorAll('.edit-cl').forEach(b => b.onclick = () => { const c = clients.find(x => x.id === b.dataset.id); if (c) openForm(c); });
    document.querySelectorAll('.delete-cl').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ?')) { await remove('clients', b.dataset.id); clients = clients.filter(x => x.id !== b.dataset.id); render({}, 1); showToast('Supprimé'); } });
  }

  function openForm(cl = null) {
    const e = !!cl;
    showModal(e ? 'Modifier Client' : 'Nouveau Client', `<form id="cl-form">
      <div class="form-group"><label class="form-label">Nom / Raison Sociale *</label><input class="form-input" name="raisonSociale" value="${cl?.raisonSociale || ''}" required/></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Téléphone</label><input class="form-input" name="telephone" value="${cl?.telephone || ''}"/></div>
        <div class="form-group"><label class="form-label">Matricule Fiscale</label><input class="form-input" name="matriculeFiscale" value="${cl?.matriculeFiscale || ''}"/></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">RIB Compte Bancaire</label><input class="form-input" name="rib" value="${cl?.rib || ''}" placeholder="XX XXXXX XXXXXXXXXXXX XX"/></div></div>
      <div class="form-group"><label class="form-label">Adresse</label><textarea class="form-input" name="adresse" rows="2">${cl?.adresse || ''}</textarea></div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-input" name="description" rows="2">${cl?.description || ''}</textarea></div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-cl">${e ? 'Modifier' : 'Ajouter'}</button>`);
    document.getElementById('save-cl').onclick = async () => {
      const f = document.getElementById('cl-form'), rs = f.querySelector('[name="raisonSociale"]').value.trim();
      if (!rs) { showToast('Nom requis', 'error'); return; }
      const data = { raisonSociale: rs, telephone: f.querySelector('[name="telephone"]').value, matriculeFiscale: f.querySelector('[name="matriculeFiscale"]').value, rib: f.querySelector('[name="rib"]').value, adresse: f.querySelector('[name="adresse"]').value, description: f.querySelector('[name="description"]').value };
      if (e) { await update('clients', cl.id, data); Object.assign(cl, data); } else { const id = await add('clients', data); clients.push({ id, ...data }); }
      hideModal(); render({}, 1); showToast(e ? 'Modifié' : 'Ajouté');
    };
  }
  render();
}
