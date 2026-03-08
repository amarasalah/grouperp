// Fournisseurs Page - with account view, stats, and updated form
import { getAll, add, update, remove } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatCurrency, formatDate } from '../utils/helpers.js';
import { paginate, filterBarHTML, wireFilters } from '../utils/pagination.js';

export async function renderFournisseurs() {
  const content = document.getElementById('page-content');
  let fournisseurs = await getAll('fournisseurs').catch(() => []);
  let currentPage = 1, currentFilters = {};

  function render(filters = currentFilters, page = currentPage) {
    currentFilters = filters; currentPage = page;
    let filtered = [...fournisseurs];
    if (filters.search) { const q = filters.search.toLowerCase(); filtered = filtered.filter(f => (f.raisonSociale || '').toLowerCase().includes(q) || (f.telephone || '').includes(q) || (f.adresse || '').toLowerCase().includes(q)); }
    const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));

    content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">🏭 Fournisseurs</h1><p class="page-subtitle">Gestion des fournisseurs</p></div>
        <button class="btn btn-primary" id="add-four-btn">+ Nouveau Fournisseur</button></div>
      ${filterBarHTML({ showDate: false, showStatus: false })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Nom</th><th>Téléphone</th><th>Adresse</th><th>Matricule Fiscale</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(f => `<tr><td><strong style="color:var(--accent);cursor:pointer" class="view-four" data-id="${f.id}">${f.raisonSociale}</strong></td><td>${f.telephone || '-'}</td><td>${f.adresse || '-'}</td><td>${f.matriculeFiscale || '-'}</td>
          <td class="actions"><button class="btn btn-sm btn-secondary view-four" data-id="${f.id}">👁️</button><button class="btn btn-sm btn-secondary edit-four" data-id="${f.id}">✏️</button><button class="btn btn-sm btn-danger delete-four" data-id="${f.id}">🗑️</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">🏭</div><div class="title">Aucun fournisseur</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;

    paginate(filtered, page, 'pagination-controls', p => render(filters, p));
    wireFilters((f, p) => render(f, p));
    document.getElementById('add-four-btn').onclick = () => openForm();
    document.querySelectorAll('.edit-four').forEach(b => b.onclick = () => { const f = fournisseurs.find(x => x.id === b.dataset.id); if (f) openForm(f); });
    document.querySelectorAll('.view-four').forEach(b => b.onclick = () => { const f = fournisseurs.find(x => x.id === b.dataset.id); if (f) viewAccount(f); });
    document.querySelectorAll('.delete-four').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ?')) { await remove('fournisseurs', b.dataset.id); fournisseurs = fournisseurs.filter(x => x.id !== b.dataset.id); render({}, 1); showToast('Supprimé'); } });
  }

  function openForm(four = null) {
    const e = !!four;
    showModal(e ? 'Modifier Fournisseur' : 'Nouveau Fournisseur', `<form id="four-form">
      <div class="form-group"><label class="form-label">Nom / Raison Sociale *</label><input class="form-input" name="raisonSociale" value="${four?.raisonSociale || ''}" required/></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Téléphone</label><input class="form-input" name="telephone" value="${four?.telephone || ''}"/></div>
        <div class="form-group"><label class="form-label">Matricule Fiscale</label><input class="form-input" name="matriculeFiscale" value="${four?.matriculeFiscale || ''}"/></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">RIB Compte Bancaire</label><input class="form-input" name="rib" value="${four?.rib || ''}" placeholder="XX XXXXX XXXXXXXXXXXX XX"/></div></div>
      <div class="form-group"><label class="form-label">Adresse</label><textarea class="form-input" name="adresse" rows="2">${four?.adresse || ''}</textarea></div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-input" name="description" rows="2">${four?.description || ''}</textarea></div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-four">${e ? 'Modifier' : 'Ajouter'}</button>`);
    document.getElementById('save-four').onclick = async () => {
      const f = document.getElementById('four-form'), rs = f.querySelector('[name="raisonSociale"]').value.trim();
      if (!rs) { showToast('Nom requis', 'error'); return; }
      const data = { raisonSociale: rs, telephone: f.querySelector('[name="telephone"]').value, matriculeFiscale: f.querySelector('[name="matriculeFiscale"]').value, rib: f.querySelector('[name="rib"]').value, adresse: f.querySelector('[name="adresse"]').value, description: f.querySelector('[name="description"]').value };
      if (e) { await update('fournisseurs', four.id, data); Object.assign(four, data); } else { const id = await add('fournisseurs', data); fournisseurs.push({ id, ...data }); }
      hideModal(); render({}, 1); showToast(e ? 'Modifié' : 'Ajouté');
    };
  }

  async function viewAccount(four) {
    // Load all related data for this fournisseur
    const [devisAll, bcAll, blAll, factAll, regAll] = await Promise.all([
      getAll('devis_achat').catch(() => []),
      getAll('bc_achat').catch(() => []),
      getAll('bl_achat').catch(() => []),
      getAll('factures_achat').catch(() => []),
      getAll('reglements').catch(() => [])
    ]);
    const devis = devisAll.filter(d => d.fournisseurId === four.id);
    const bcs = bcAll.filter(b => b.fournisseurId === four.id);
    const bls = blAll.filter(b => b.fournisseurId === four.id);
    const factures = factAll.filter(f => f.fournisseurId === four.id);
    const reglements = regAll.filter(r => r.tiersId === four.id || factures.some(f => f.id === r.factureId));
    const totalFacture = factures.reduce((s, f) => s + (f.totalTTC || 0), 0);
    const totalRegle = reglements.reduce((s, r) => s + (r.montant || 0), 0);

    showModal(`🏭 ${four.raisonSociale}`, `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div class="doc-info-box"><p><strong>Téléphone:</strong> ${four.telephone || '-'}</p><p><strong>Adresse:</strong> ${four.adresse || '-'}</p></div>
        <div class="doc-info-box"><p><strong>Matricule Fiscale:</strong> ${four.matriculeFiscale || '-'}</p><p><strong>RIB:</strong> ${four.rib || '-'}</p></div>
      </div>
      ${four.description ? `<p style="margin-bottom:16px;color:var(--text-secondary);font-style:italic">${four.description}</p>` : ''}

      <div class="kpi-grid" style="margin-bottom:16px">
        <div class="kpi-card"><div class="kpi-icon blue">📋</div><div class="kpi-info"><div class="kpi-label">Devis</div><div class="kpi-value">${devis.length}</div></div></div>
        <div class="kpi-card"><div class="kpi-icon orange">📦</div><div class="kpi-info"><div class="kpi-label">BC</div><div class="kpi-value">${bcs.length}</div></div></div>
        <div class="kpi-card"><div class="kpi-icon green">🚛</div><div class="kpi-info"><div class="kpi-label">BL</div><div class="kpi-value">${bls.length}</div></div></div>
        <div class="kpi-card"><div class="kpi-icon red">🧾</div><div class="kpi-info"><div class="kpi-label">Factures</div><div class="kpi-value">${factures.length}</div></div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
        <div style="padding:12px;background:var(--bg-card);border-radius:var(--radius-md);border:1px solid var(--border-color);text-align:center"><div style="font-size:0.8rem;color:var(--text-secondary)">Total Facturé</div><div style="font-size:1.2rem;font-weight:700;color:var(--warning)">${formatCurrency(totalFacture)}</div></div>
        <div style="padding:12px;background:var(--bg-card);border-radius:var(--radius-md);border:1px solid var(--border-color);text-align:center"><div style="font-size:0.8rem;color:var(--text-secondary)">Total Réglé</div><div style="font-size:1.2rem;font-weight:700;color:var(--success)">${formatCurrency(totalRegle)}</div></div>
        <div style="padding:12px;background:var(--bg-card);border-radius:var(--radius-md);border:1px solid var(--border-color);text-align:center"><div style="font-size:0.8rem;color:var(--text-secondary)">Solde</div><div style="font-size:1.2rem;font-weight:700;color:${totalFacture - totalRegle > 0 ? 'var(--danger)' : 'var(--success)'}">${formatCurrency(totalFacture - totalRegle)}</div></div>
      </div>

      ${factures.length ? `<h4 style="margin:8px 0">Dernières Factures</h4>
      <table class="data-table"><thead><tr><th>N°</th><th>Date</th><th>Total TTC</th><th>Réglé</th></tr></thead><tbody>
      ${factures.slice(0, 10).map(f => `<tr><td><strong style="color:var(--accent)">${f.numero}</strong></td><td>${formatDate(f.date)}</td><td>${formatCurrency(f.totalTTC)}</td><td><span class="badge ${f.regle ? 'badge-success' : 'badge-warning'}">${f.regle ? 'Oui' : 'Non'}</span></td></tr>`).join('')}
      </tbody></table>` : ''}

      ${reglements.length ? `<h4 style="margin:12px 0 8px">Derniers Règlements</h4>
      <table class="data-table"><thead><tr><th>Date</th><th>Facture</th><th>Montant</th><th>Mode</th></tr></thead><tbody>
      ${reglements.slice(0, 10).map(r => `<tr><td>${formatDate(r.date)}</td><td>${r.factureNumero || '-'}</td><td>${formatCurrency(r.montant)}</td><td>${r.modePaiement || '-'}</td></tr>`).join('')}
      </tbody></table>` : ''}
    `, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button>`);
    document.querySelector('.modal-container').style.maxWidth = '900px';
  }

  render();
}
