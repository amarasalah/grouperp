// Lots Page - Lot management with per-category pricing
import { getAll, add, update, remove } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatCurrency, formatDate, todayISO } from '../utils/helpers.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';

export async function renderLots() {
  const content = document.getElementById('page-content');
  let lots = await getAll('lots').catch(() => []);
  const categories = await getAll('categories').catch(() => []);
  const produits = await getAll('produits').catch(() => []);
  let currentPage = 1, currentFilters = {};

  function render(filters = currentFilters, page = currentPage) {
    currentFilters = filters; currentPage = page;
    const filtered = applyFilters(lots, { ...filters, searchFields: ['numero', 'note'] });
    const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));

    content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">📦 Lots</h1><p class="page-subtitle">Gestion des lots avec prix par catégorie</p></div>
        <button class="btn btn-primary" id="add-lot-btn">+ Nouveau Lot</button></div>
      ${filterBarHTML({ showDate: true, showStatus: false })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>N° Lot</th><th>Date</th><th>Max Produits</th><th>Produits Créés</th><th>Catégories</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(l => {
          const prodCount = produits.filter(p => p.lotId === l.id).length;
          const catCount = (l.prixParCategorie || []).length;
          return `<tr><td><strong style="color:var(--accent)">${l.numero || ''}</strong></td><td>${formatDate(l.date)}</td>
            <td><span class="badge badge-warning">${l.maxProduits || 0}</span></td>
            <td><span class="badge ${prodCount >= (l.maxProduits || 0) ? 'badge-danger' : 'badge-success'}">${prodCount}</span></td>
            <td>${catCount}</td>
            <td class="actions">
              <button class="btn btn-sm btn-secondary view-lot" data-id="${l.id}">👁️</button>
              <button class="btn btn-sm btn-secondary edit-lot" data-id="${l.id}">✏️</button>
              <button class="btn btn-sm btn-danger delete-lot" data-id="${l.id}">🗑️</button>
            </td></tr>`;
        }).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">📦</div><div class="title">Aucun lot</div><div class="desc">Créez un lot pour définir les prix par catégorie</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;

    paginate(filtered, page, 'pagination-controls', p => render(filters, p));
    wireFilters((f, p) => render(f, p));
    document.getElementById('add-lot-btn').onclick = () => openForm();
    document.querySelectorAll('.edit-lot').forEach(b => b.onclick = () => { const l = lots.find(x => x.id === b.dataset.id); if (l) openForm(l); });
    document.querySelectorAll('.view-lot').forEach(b => b.onclick = () => { const l = lots.find(x => x.id === b.dataset.id); if (l) viewLot(l); });
    document.querySelectorAll('.delete-lot').forEach(b => b.onclick = async () => {
      const l = lots.find(x => x.id === b.dataset.id);
      const prodCount = produits.filter(p => p.lotId === l?.id).length;
      if (prodCount > 0) { showToast(`Ce lot contient ${prodCount} produit(s), impossible de supprimer`, 'error'); return; }
      if (await confirmDialog('Supprimer ce lot ?')) {
        await remove('lots', b.dataset.id);
        lots = lots.filter(x => x.id !== b.dataset.id);
        render({}, 1); showToast('Lot supprimé');
      }
    });
  }

  function openForm(lot = null) {
    const isEdit = !!lot;
    const existingPrix = lot?.prixParCategorie || [];

    showModal(isEdit ? `Modifier Lot - ${lot.numero}` : 'Nouveau Lot', `<form id="lot-form">
      <div class="form-row">
        <div class="form-group"><label class="form-label">N° Lot *</label><input class="form-input" name="numero" value="${lot?.numero || ''}" placeholder="ex: LOT-001" required/></div>
        <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" name="date" value="${lot?.date || todayISO()}"/></div>
      </div>
      <div class="form-group"><label class="form-label">Nombre Max de Produits *</label><input class="form-input" type="number" name="maxProduits" min="1" value="${lot?.maxProduits || ''}" required placeholder="Limite de produits dans ce lot"/></div>
      <h4 style="margin:16px 0 8px">Prix par Catégorie</h4>
      <p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:12px">Définissez les prix d'achat et de vente pour chaque catégorie de ce lot</p>
      <div class="table-wrapper"><table class="data-table"><thead><tr><th>Catégorie</th><th>Prix Achat (DT)</th><th>Prix Vente (DT)</th></tr></thead><tbody>
        ${categories.map(c => {
          const existing = existingPrix.find(p => p.categorieId === c.id);
          return `<tr class="cat-prix-row" data-cat-id="${c.id}" data-cat-nom="${c.nom}">
            <td><strong style="color:var(--accent)">${c.nom}</strong> <code style="background:rgba(79,140,255,0.15);padding:2px 6px;border-radius:4px;font-size:0.8rem">${c.prefix || ''}</code></td>
            <td><input class="form-input cat-prix-achat" type="number" step="0.001" min="0" value="${existing?.prixAchat || 0}" style="width:120px"/></td>
            <td><input class="form-input cat-prix-vente" type="number" step="0.001" min="0" value="${existing?.prixVente || 0}" style="width:120px"/></td>
          </tr>`;
        }).join('')}
      </tbody></table></div>
      ${!categories.length ? '<p style="color:var(--danger);margin-top:8px">⚠️ Aucune catégorie. Créez des catégories d\'abord.</p>' : ''}
      <div class="form-group" style="margin-top:12px"><label class="form-label">Note</label><textarea class="form-input" name="note" rows="2">${lot?.note || ''}</textarea></div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-lot">${isEdit ? 'Modifier' : 'Créer'}</button>`);
    document.querySelector('.modal-container').style.maxWidth = '800px';

    document.getElementById('save-lot').onclick = async () => {
      const f = document.getElementById('lot-form');
      const numero = f.querySelector('[name="numero"]').value.trim();
      const date = f.querySelector('[name="date"]').value;
      const maxProduits = parseInt(f.querySelector('[name="maxProduits"]').value) || 0;
      const note = f.querySelector('[name="note"]').value;

      if (!numero) { showToast('N° Lot requis', 'error'); return; }
      if (maxProduits < 1) { showToast('Max produits doit être >= 1', 'error'); return; }

      // Check duplicate numero
      if (!isEdit && lots.some(l => l.numero === numero)) { showToast(`Lot "${numero}" existe déjà`, 'error'); return; }

      // Collect per-category prices
      const prixParCategorie = [];
      document.querySelectorAll('.cat-prix-row').forEach(row => {
        const catId = row.dataset.catId;
        const catNom = row.dataset.catNom;
        const prixAchat = parseFloat(row.querySelector('.cat-prix-achat').value) || 0;
        const prixVente = parseFloat(row.querySelector('.cat-prix-vente').value) || 0;
        if (prixAchat > 0 || prixVente > 0) {
          prixParCategorie.push({ categorieId: catId, categorieNom: catNom, prixAchat, prixVente });
        }
      });

      const data = { numero, date, maxProduits, prixParCategorie, note };

      if (isEdit) {
        await update('lots', lot.id, data);
        Object.assign(lot, data);
      } else {
        const id = await add('lots', data);
        lots.unshift({ id, ...data });
      }
      hideModal(); render({}, 1); showToast(isEdit ? 'Lot modifié' : 'Lot créé');
    };
  }

  function viewLot(lot) {
    const lotProds = produits.filter(p => p.lotId === lot.id);
    const prixRows = (lot.prixParCategorie || []).map(p => {
      const count = lotProds.filter(pr => pr.categorieId === p.categorieId).length;
      return `<tr><td><strong style="color:var(--accent)">${p.categorieNom}</strong></td><td>${formatCurrency(p.prixAchat)}</td><td>${formatCurrency(p.prixVente)}</td><td>${count}</td></tr>`;
    }).join('');

    showModal(`📦 Lot - ${lot.numero}`, `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div class="doc-info-box"><p><strong>N° Lot:</strong> ${lot.numero}</p><p><strong>Date:</strong> ${formatDate(lot.date)}</p></div>
        <div class="doc-info-box"><p><strong>Max Produits:</strong> ${lot.maxProduits}</p><p><strong>Produits Créés:</strong> ${lotProds.length}</p></div>
      </div>
      ${lot.note ? `<p style="margin-bottom:16px;color:var(--text-secondary);font-style:italic">${lot.note}</p>` : ''}
      <h4 style="margin:8px 0">Prix par Catégorie</h4>
      ${prixRows ? `<table class="data-table"><thead><tr><th>Catégorie</th><th>Prix Achat</th><th>Prix Vente</th><th>Nb Produits</th></tr></thead><tbody>${prixRows}</tbody></table>` : '<p style="color:var(--text-muted)">Aucun prix défini</p>'}
      ${lotProds.length ? `<h4 style="margin:16px 0 8px">Produits dans ce lot (${lotProds.length})</h4>
      <div style="max-height:200px;overflow-y:auto"><table class="data-table"><thead><tr><th>ID Poteau</th><th>Catégorie</th></tr></thead><tbody>
        ${lotProds.map(p => `<tr><td><strong style="color:var(--accent)">${p.reference}</strong></td><td>${p.categorieNom || '-'}</td></tr>`).join('')}
      </tbody></table></div>` : ''}
    `, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button>`);
    document.querySelector('.modal-container').style.maxWidth = '800px';
  }

  render();
}
