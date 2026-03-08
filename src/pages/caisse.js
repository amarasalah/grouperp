// Caisse Page - with search, date filter & pagination
import { getAll, add, addCaisseMovement } from '../data/store.js';
import { showToast, showModal, hideModal, formatCurrency, formatDate, todayISO } from '../utils/helpers.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';

export async function renderCaisse() {
  const content = document.getElementById('page-content');
  let mouvements = await getAll('caisse').catch(() => []);
  let currentPage = 1, currentFilters = {};

  function render(filters = currentFilters, page = currentPage) {
    currentFilters = filters; currentPage = page;
    const statusMap = { 'Entrée': 'entree', 'Sortie': 'sortie' };
    const mappedStatus = filters.status ? statusMap[filters.status] || filters.status : '';
    const filtered = applyFilters(mouvements, { ...filters, status: mappedStatus, statusField: 'type', searchFields: ['description', 'reference'] });
    const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));

    const totalEntrees = mouvements.filter(m => m.type === 'entree').reduce((s, m) => s + (m.montant || 0), 0);
    const totalSorties = mouvements.filter(m => m.type === 'sortie').reduce((s, m) => s + (m.montant || 0), 0);
    const solde = totalEntrees - totalSorties;

    content.innerHTML = `
    <div class="page-header"><div><h1 class="page-title">💰 Caisse</h1><p class="page-subtitle">Suivi de la trésorerie</p></div>
      <button class="btn btn-primary" id="add-caisse-btn">+ Nouveau Mouvement</button></div>

    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-icon green">📥</div><div class="kpi-info"><div class="kpi-label">Total Entrées</div><div class="kpi-value" style="color:var(--success)">${formatCurrency(totalEntrees)}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon red">📤</div><div class="kpi-info"><div class="kpi-label">Total Sorties</div><div class="kpi-value" style="color:var(--danger)">${formatCurrency(totalSorties)}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon blue">💰</div><div class="kpi-info"><div class="kpi-label">Solde Caisse</div><div class="kpi-value" style="color:${solde >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(solde)}</div></div></div>
    </div>

    <div class="card">
      <div class="card-header"><h3 class="card-title">📜 Journal de Caisse</h3></div>
      ${filterBarHTML({ showStatus: true, statusOptions: ['Entrée', 'Sortie'] })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Référence</th><th>Montant</th></tr></thead><tbody>
        ${paged.map(m => `<tr><td>${formatDate(m.date)}</td>
          <td><span class="badge ${m.type === 'entree' ? 'badge-success' : 'badge-danger'}">${m.type === 'entree' ? 'Entrée' : 'Sortie'}</span></td>
          <td>${m.description || '-'}</td><td>${m.reference || '-'}</td>
          <td style="font-weight:600;color:${m.type === 'entree' ? 'var(--success)' : 'var(--danger)'}">
            ${m.type === 'entree' ? '+' : '−'} ${formatCurrency(m.montant)}</td></tr>`).join('')}
      </tbody></table></div>`: '<div class="empty-state"><div class="icon">💰</div><div class="title">Caisse vide</div><div class="desc">Aucun mouvement enregistré</div></div>'}
      <div id="pagination-controls" class="pagination-container"></div>
    </div>
  `;

    paginate(filtered, page, 'pagination-controls', p => render(filters, p));
    wireFilters((f, p) => render(f, p));

    document.getElementById('add-caisse-btn').addEventListener('click', () => {
      showModal('Nouveau Mouvement de Caisse', `<form id="caisse-form">
      <div class="form-row"><div class="form-group"><label class="form-label">Type *</label><select class="form-select" name="type" required><option value="entree">Entrée</option><option value="sortie">Sortie</option></select></div>
        <div class="form-group"><label class="form-label">Montant (DT) *</label><input class="form-input" type="number" step="0.001" name="montant" required/></div></div>
      <div class="form-group"><label class="form-label">Description</label><input class="form-input" name="description"/></div>
      <div class="form-group"><label class="form-label">Référence</label><input class="form-input" name="reference" placeholder="N° facture, etc."/></div>
    </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-caisse">Enregistrer</button>`);

      document.getElementById('save-caisse').onclick = async () => {
        const fd = new FormData(document.getElementById('caisse-form'));
        const montant = parseFloat(fd.get('montant'));
        if (!montant || montant <= 0) { showToast('Montant invalide', 'error'); return; }
        try {
          await addCaisseMovement(montant, fd.get('type'), fd.get('description'), fd.get('reference'));
          hideModal(); renderCaisse(); showToast('Mouvement enregistré');
        } catch (err) { showToast('Erreur: ' + err.message, 'error'); }
      };
    });
  }
  render();
}
