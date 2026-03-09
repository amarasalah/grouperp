// Bon de Commande Globale (BCG) Page
import { getAll, add, update, remove, getSettings, getNextNumber } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatDate, todayISO } from '../utils/helpers.js';
import { isSuperAdmin } from '../data/auth.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';

export async function renderBcg() {
    const content = document.getElementById('page-content');
    let bcgs = await getAll('bcg').catch(() => []);
    const types = await getAll('types').catch(() => []);
    const produits = await getAll('produits').catch(() => []);
    const blAchats = await getAll('bl_achat').catch(() => []);
    const blVentes = await getAll('bl_vente').catch(() => []);
    // IDs of products already in any BL Achat or BL Vente (used — not available)
    const usedInBLIds = new Set();
    blAchats.forEach(bl => (bl.lignes || []).forEach(l => { if (l.produitId) usedInBLIds.add(l.produitId); }));
    blVentes.forEach(bl => (bl.lignes || []).forEach(l => { if (l.produitId) usedInBLIds.add(l.produitId); }));
    let currentPage = 1, currentFilters = {};

    function render(filters = currentFilters, page = currentPage) {
        currentFilters = filters; currentPage = page;
        const filtered = applyFilters(bcgs, { ...filters, searchFields: ['numero', 'description'], statusField: 'statut' });
        const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));

        // Calculate stats per BCG using typesQty
        const bcgStats = paged.map(b => {
            const typeIds = (b.typesQty || []).map(tq => tq.typeId);
            const prodsInBcg = produits.filter(p => typeIds.includes(p.typeId));
            const totalTarget = b.totalProduits || 0;
            const totalProduced = prodsInBcg.length;
            const totalAvailable = prodsInBcg.filter(p => !usedInBLIds.has(p.id)).length;
            return { ...b, typeIds, totalTarget, totalProduced, totalAvailable };
        });

        content.innerHTML = `
        <div class="page-header">
          <div>
            <h1 class="page-title">📋 Bon de Commande Globale</h1>
            <p class="page-subtitle">Gestion des commandes globales de production</p>
          </div>
          ${isSuperAdmin() ? '<button class="btn btn-primary" id="add-bcg-btn">+ Nouveau BCG</button>' : ''}
        </div>

        ${filterBarHTML({ showStatus: true, statusOptions: ['Active', 'Terminé', 'Annulé'] })}

        ${bcgStats.length ? `<div class="table-wrapper"><table class="data-table">
          <thead><tr><th>N° BCG</th><th>Date</th><th>Description</th><th>Total</th><th>Créés</th><th>Disponibles</th><th>Progression</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            ${bcgStats.map(b => {
                const pct = b.totalTarget > 0 ? Math.round(b.totalProduced / b.totalTarget * 100) : 0;
                return `<tr>
                  <td><strong style="color:var(--accent)">${b.numero || '-'}</strong></td>
                  <td>${formatDate(b.date)}</td>
                  <td>${b.description || '-'}</td>
                  <td><strong>${b.totalTarget}</strong></td>
                  <td>${b.totalProduced}</td>
                  <td><span style="font-weight:600;color:${b.totalAvailable===0?'var(--text-muted)':'var(--success)'}">${b.totalAvailable}</span></td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div style="flex:1;height:8px;background:var(--bg-input);border-radius:4px;overflow:hidden;min-width:80px;">
                        <div style="width:${Math.min(pct, 100)}%;height:100%;background:${pct >= 100 ? 'var(--success)' : 'var(--accent)'};border-radius:4px;"></div>
                      </div>
                      <span style="font-size:0.8rem;font-weight:600;color:${pct >= 100 ? 'var(--success)' : 'var(--text-secondary)'}">${b.totalProduced}/${b.totalTarget}</span>
                    </div>
                  </td>
                  <td><span class="badge ${b.statut === 'Active' ? 'badge-success' : b.statut === 'Annulé' ? 'badge-danger' : 'badge-warning'}">${b.statut || 'Active'}</span></td>
                  <td class="actions">
                    <button class="btn btn-sm btn-secondary view-bcg" data-id="${b.id}">👁️</button>
                    <button class="btn btn-sm btn-primary enter-bcg" data-id="${b.id}" title="Entrer dans ce BCG">🔑</button>
                    ${isSuperAdmin() ? `<button class="btn btn-sm btn-secondary edit-bcg" data-id="${b.id}">✏️</button><button class="btn btn-sm btn-danger delete-bcg" data-id="${b.id}">🗑️</button>` : ''}
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table></div>` : '<div class="empty-state"><div class="icon">📋</div><div class="title">Aucun BCG</div><div class="desc">Créez un Bon de Commande Globale pour commencer</div></div>'}
        <div id="pagination-controls" class="pagination-container"></div>
        `;

        paginate(filtered, page, 'pagination-controls', p => render(filters, p));
        wireFilters((f, p) => render(f, p));

        document.getElementById('add-bcg-btn')?.addEventListener('click', () => openForm());
        document.querySelectorAll('.view-bcg').forEach(b => {
            b.onclick = () => {
                const bcg = bcgs.find(x => x.id === b.dataset.id);
                if (bcg) viewBcg(bcg);
            };
        });
        document.querySelectorAll('.enter-bcg').forEach(b => {
            b.onclick = () => {
                sessionStorage.setItem('selectedBcgId', b.dataset.id);
                const bcg = bcgs.find(x => x.id === b.dataset.id);
                showToast(`BCG ${bcg?.numero || ''} sélectionné`);
                window.location.hash = '/';
                // Force re-render of sidebar to show BCG context
                window.location.reload();
            };
        });
        document.querySelectorAll('.edit-bcg').forEach(b => {
            b.onclick = () => {
                const bcg = bcgs.find(x => x.id === b.dataset.id);
                if (bcg) openForm(bcg);
            };
        });
        document.querySelectorAll('.delete-bcg').forEach(b => {
            b.onclick = async () => {
                if (await confirmDialog('Supprimer ce BCG ?')) {
                    await remove('bcg', b.dataset.id);
                    bcgs = bcgs.filter(x => x.id !== b.dataset.id);
                    render();
                    showToast('BCG supprimé');
                }
            };
        });
    }

    function openForm(bcg = null) {
        const isEdit = !!bcg;
        const existingTypes = bcg?.typesQty || [];

        const typeRows = types.map(t => {
            const existing = existingTypes.find(et => et.typeId === t.id);
            const itemsOfType = produits.filter(p => p.typeId === t.id);
            const availableOfType = itemsOfType.filter(p => !usedInBLIds.has(p.id)).length;
            return `<tr>
              <td><input type="checkbox" class="bcg-type-check" data-type-id="${t.id}" data-type-name="${t.nom}" data-type-prefix="${t.prefix || ''}" ${existing ? 'checked' : ''} style="accent-color:var(--accent);width:16px;height:16px;"/></td>
              <td><strong style="color:var(--accent)">${t.nom}</strong></td>
              <td><code style="background:rgba(79,140,255,0.15);padding:2px 8px;border-radius:4px">${t.prefix || '-'}</code></td>
              <td><span style="font-size:0.85rem;color:var(--text-secondary)">${itemsOfType.length} créés / <strong style="color:var(--success)">${availableOfType} disponibles</strong></span></td>
              <td><input class="form-input bcg-type-qty" data-type-id="${t.id}" type="number" min="0" value="${existing?.quantite || 0}" style="width:100px;"/></td>
            </tr>`;
        }).join('');

        showModal(isEdit ? `Modifier BCG - ${bcg.numero}` : 'Nouveau Bon de Commande Globale', `
          <form id="bcg-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Date</label>
                <input class="form-input" type="date" name="date" value="${bcg?.date || todayISO()}"/>
              </div>
              <div class="form-group">
                <label class="form-label">Statut</label>
                <select class="form-select" name="statut">
                  <option value="Active" ${bcg?.statut === 'Active' || !bcg ? 'selected' : ''}>Active</option>
                  <option value="Terminé" ${bcg?.statut === 'Terminé' ? 'selected' : ''}>Terminé</option>
                  <option value="Annulé" ${bcg?.statut === 'Annulé' ? 'selected' : ''}>Annulé</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea class="form-input" name="description" rows="2" placeholder="Description du BCG...">${bcg?.description || ''}</textarea>
            </div>
            <h4 style="margin:16px 0 8px">Types & Quantités</h4>
            <div style="padding:10px;background:var(--bg-input);border-radius:var(--radius-sm);margin-bottom:12px;font-size:0.9rem;">
              Total: <strong id="bcg-total-sum" style="color:var(--accent);font-size:1.1rem;">0</strong> poteaux
            </div>
            ${types.length ? `<div class="table-wrapper" style="max-height:300px;overflow-y:auto;">
              <table class="data-table">
                <thead><tr><th style="width:40px">✓</th><th>Type</th><th>Préfixe</th><th>Disponible</th><th>Quantité BCG</th></tr></thead>
                <tbody>${typeRows}</tbody>
              </table>
            </div>` : '<p style="color:var(--text-muted)">Aucun type. Créez des types d\'abord.</p>'}
          </form>
        `, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button>
           <button class="btn btn-primary" id="save-bcg">${isEdit ? 'Modifier' : 'Créer'}</button>`);

        document.querySelector('.modal-container').style.maxWidth = '750px';

        // Auto-update total sum
        function updateTotalSum() {
            let sum = 0;
            document.querySelectorAll('.bcg-type-check:checked').forEach(cb => {
                const tid = cb.dataset.typeId;
                sum += parseInt(document.querySelector(`.bcg-type-qty[data-type-id="${tid}"]`)?.value) || 0;
            });
            const el = document.getElementById('bcg-total-sum');
            if (el) el.textContent = sum;
        }
        document.querySelectorAll('.bcg-type-check, .bcg-type-qty').forEach(el => {
            el.addEventListener('change', updateTotalSum);
            el.addEventListener('input', updateTotalSum);
        });
        updateTotalSum();

        document.getElementById('save-bcg').onclick = async () => {
            const f = document.getElementById('bcg-form');
            const date = f.querySelector('[name="date"]').value;
            const statut = f.querySelector('[name="statut"]').value;
            const description = f.querySelector('[name="description"]').value;

            // Collect selected types with quantities
            const typesQty = [];
            let totalProduits = 0;
            document.querySelectorAll('.bcg-type-check:checked').forEach(cb => {
                const typeId = cb.dataset.typeId;
                const typeNom = cb.dataset.typeName;
                const typePrefix = cb.dataset.typePrefix;
                const qty = parseInt(document.querySelector(`.bcg-type-qty[data-type-id="${typeId}"]`)?.value) || 0;
                if (qty > 0) {
                    typesQty.push({ typeId, typeNom, typePrefix, quantite: qty });
                    totalProduits += qty;
                }
            });

            if (!typesQty.length) {
                showToast('Sélectionnez au moins un type avec une quantité > 0', 'error');
                return;
            }

            const data = { date, statut, description, totalProduits, typesQty };

            if (isEdit) {
                await update('bcg', bcg.id, data);
                Object.assign(bcg, data);
            } else {
                data.numero = await getNextNumber('bcgPrefix');
                if (data.numero.startsWith('DOC-')) {
                    const count = bcgs.length + 1;
                    data.numero = `BCG-${String(count).padStart(3, '0')}`;
                }
                const id = await add('bcg', data);
                bcgs.unshift({ id, ...data });
            }
            hideModal();
            render();
            showToast(isEdit ? 'BCG modifié' : 'BCG créé');
        };
    }

    function viewBcg(b) {
        const typeIds = (b.typesQty || []).map(tq => tq.typeId);
        const prodsInBcg = produits.filter(p => typeIds.includes(p.typeId));
        const totalTarget = b.totalProduits || 0;
        const totalProduced = prodsInBcg.length;
        const totalAvailable = prodsInBcg.filter(p => !usedInBLIds.has(p.id)).length;
        const totalPct = totalTarget > 0 ? Math.round(totalProduced / totalTarget * 100) : 0;
        const remaining = totalTarget - totalProduced;

        // Per-type breakdown using typesQty config
        const typeDetails = (b.typesQty || []).map(tq => {
            const tp = types.find(t => t.id === tq.typeId);
            const items = produits.filter(p => p.typeId === tq.typeId);
            const available = items.filter(p => !usedInBLIds.has(p.id)).length;
            const pct = tq.quantite > 0 ? Math.round(items.length / tq.quantite * 100) : 0;
            const leftToCreate = tq.quantite - items.length;
            return `<tr>
              <td><strong style="color:var(--accent)">${tp?.nom || tq.typeNom || '-'}</strong></td>
              <td><code style="background:rgba(79,140,255,0.15);padding:2px 6px;border-radius:4px">${tp?.prefix || tq.typePrefix || '-'}</code></td>
              <td><strong>${tq.quantite}</strong></td>
              <td>${items.length}</td>
              <td><span style="color:var(--success);font-weight:600">${available}</span></td>
              <td>${leftToCreate > 0 ? `<span style="color:var(--warning)">${leftToCreate}</span>` : '<span style="color:var(--success)">✓</span>'}</td>
              <td>
                <div style="height:6px;background:var(--bg-input);border-radius:3px;overflow:hidden;min-width:60px;">
                  <div style="width:${Math.min(pct,100)}%;height:100%;background:${pct>=100?'var(--success)':'var(--accent)'};"></div>
                </div>
              </td>
            </tr>`;
        }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Aucun type configuré</td></tr>';

        showModal(`BCG - ${b.numero}`, `
          <div class="doc-info">
            <div class="doc-info-box"><p><strong>Date:</strong> ${formatDate(b.date)}</p><p><strong>Statut:</strong> <span class="badge ${b.statut === 'Active' ? 'badge-success' : 'badge-warning'}">${b.statut}</span></p></div>
            <div class="doc-info-box">
              <p><strong>Total configuré:</strong> <strong style="color:var(--accent);font-size:1.2rem;">${totalTarget}</strong> poteaux</p>
              <p><strong>Créés:</strong> ${totalProduced} — <strong style="color:var(--success)">${totalAvailable} disponibles</strong> — ${remaining > 0 ? `<span style="color:var(--warning)">${remaining} restant(s) à créer</span>` : '<span style="color:var(--success)">✓ Complet</span>'}</p>
            </div>
          </div>
          <div style="margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
              <span style="font-size:0.85rem;color:var(--text-secondary);">Progression création:</span>
              <div style="flex:1;height:12px;background:var(--bg-input);border-radius:6px;overflow:hidden;">
                <div style="width:${Math.min(totalPct,100)}%;height:100%;background:${totalPct>=100?'var(--success)':'var(--accent)'};border-radius:6px;"></div>
              </div>
              <span style="font-size:0.9rem;font-weight:700;color:${totalPct>=100?'var(--success)':'var(--text-secondary)'}">${totalProduced}/${totalTarget} (${totalPct}%)</span>
            </div>
          </div>
          ${b.description ? `<p style="margin-bottom:16px;color:var(--text-secondary);font-style:italic">${b.description}</p>` : ''}
          <h4 style="margin:12px 0 8px">Répartition par Type</h4>
          <div class="table-wrapper"><table class="data-table">
            <thead><tr><th>Type</th><th>Préfixe</th><th>Qté BCG</th><th>Créés</th><th>Disponibles</th><th>À créer</th><th>%</th></tr></thead>
            <tbody>${typeDetails}</tbody>
          </table></div>
        `, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button>`);
        document.querySelector('.modal-container').style.maxWidth = '750px';
    }

    render();
}
