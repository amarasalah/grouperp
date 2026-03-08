// Categories Page - with search & pagination
import { getAll, add, update, remove } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog } from '../utils/helpers.js';
import { paginate, filterBarHTML, wireFilters } from '../utils/pagination.js';

export async function renderCategories() {
  const content = document.getElementById('page-content');
  let categories = await getAll('categories').catch(() => []);
  let currentPage = 1, currentFilters = {};

  function render(filters = currentFilters, page = currentPage) {
    currentFilters = filters; currentPage = page;
    let filtered = [...categories];
    if (filters.search) { const q = filters.search.toLowerCase(); filtered = filtered.filter(c => (c.nom || '').toLowerCase().includes(q) || (c.prefix || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)); }
    const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));

    content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">📂 Catégories</h1><p class="page-subtitle">Catégories de poteaux béton</p></div>
        <button class="btn btn-primary" id="add-cat-btn">+ Nouvelle Catégorie</button></div>
      ${filterBarHTML({ showDate: false, showStatus: false })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Nom</th><th>Préfixe ID</th><th>Description</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(c => `<tr><td><strong style="color:var(--accent)">${c.nom}</strong></td><td><code style="background:rgba(79,140,255,0.15);padding:2px 8px;border-radius:4px">${c.prefix || '-'}</code></td><td>${c.description || '-'}</td>
          <td class="actions"><button class="btn btn-sm btn-secondary edit-cat" data-id="${c.id}">✏️</button><button class="btn btn-sm btn-danger delete-cat" data-id="${c.id}">🗑️</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">📂</div><div class="title">Aucune catégorie</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;

    paginate(filtered, page, 'pagination-controls', p => render(filters, p));
    wireFilters((f, p) => render(f, p));
    document.getElementById('add-cat-btn').onclick = () => openForm();
    document.querySelectorAll('.edit-cat').forEach(b => b.onclick = () => { const c = categories.find(x => x.id === b.dataset.id); if (c) openForm(c); });
    document.querySelectorAll('.delete-cat').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ?')) { await remove('categories', b.dataset.id); categories = categories.filter(x => x.id !== b.dataset.id); render({}, 1); showToast('Supprimée'); } });
  }

  function openForm(cat = null) {
    const isEdit = !!cat;
    showModal(isEdit ? 'Modifier Catégorie' : 'Nouvelle Catégorie', `<form id="cat-form">
      <div class="form-group"><label class="form-label">Nom *</label><input class="form-input" name="nom" value="${cat?.nom || ''}" required/></div>
      <div class="form-group"><label class="form-label">Préfixe ID *</label><input class="form-input" name="prefix" value="${cat?.prefix || ''}" placeholder="ex: PB9, PB12" required style="text-transform:uppercase"/>
        <small style="color:var(--text-muted)">Ex: PB9 → PB9-0001, PB9-0002...</small></div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-input" name="description" rows="3">${cat?.description || ''}</textarea></div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-cat">${isEdit ? 'Modifier' : 'Ajouter'}</button>`);
    document.getElementById('save-cat').onclick = async () => {
      const f = document.getElementById('cat-form'), nom = f.querySelector('[name="nom"]').value.trim(), prefix = f.querySelector('[name="prefix"]').value.trim().toUpperCase();
      if (!nom || !prefix) { showToast('Nom et préfixe requis', 'error'); return; }
      const data = { nom, prefix, description: f.querySelector('[name="description"]').value };
      if (isEdit) { await update('categories', cat.id, data); Object.assign(cat, data); } else { const id = await add('categories', data); categories.push({ id, ...data }); }
      hideModal(); render({}, 1); showToast(isEdit ? 'Modifiée' : 'Ajoutée');
    };
  }
  render();
}
