// Règlements Page - filters & pagination
import { getAll, add, update } from '../data/store.js';
import { showToast, showModal, hideModal, formatCurrency, formatDate, todayISO } from '../utils/helpers.js';
import { addCaisseMovement } from '../data/store.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';

export async function renderReglements() {
  const content = document.getElementById('page-content');
  let reglements = await getAll('reglements').catch(() => []);
  const facturesAchat = await getAll('factures_achat').catch(() => []);
  const facturesVente = await getAll('factures_vente').catch(() => []);

  // Combine all invoices
  const allFactures = [
    ...facturesAchat.map(f => ({ ...f, docType: 'Achat', collection: 'factures_achat' })),
    ...facturesVente.map(f => ({ ...f, docType: 'Vente', collection: 'factures_vente' }))
  ];

  let currentPage = 1, currentFilters = {}, activeTab = 'all';

  function render(filters = currentFilters, page = currentPage) {
    currentFilters = filters; currentPage = page;
    let filtered = applyFilters(reglements, { ...filters, searchFields: ['factureNumero', 'tiersNom', 'modePaiement'] });
    if (activeTab !== 'all') filtered = filtered.filter(r => r.typeFacture === (activeTab === 'achat' ? 'Achat' : 'Vente'));
    const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));

    content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">💳 Règlements</h1><p class="page-subtitle">Suivi des paiements fournisseurs et clients</p></div>
        <button class="btn btn-primary" id="add-reg-btn">+ Nouveau Règlement</button></div>

      <div class="tabs" id="reg-tabs">
        <button class="tab ${activeTab === 'all' ? 'active' : ''}" data-tab="all">Tous</button>
        <button class="tab ${activeTab === 'achat' ? 'active' : ''}" data-tab="achat">Achats</button>
        <button class="tab ${activeTab === 'vente' ? 'active' : ''}" data-tab="vente">Ventes</button>
      </div>

      ${filterBarHTML({ showStatus: false })}

      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Facture</th><th>Tiers</th><th>Montant</th><th>Mode</th></tr></thead><tbody id="reg-tbody">
        ${paged.map(r => `<tr data-type="${r.typeFacture || ''}"><td>${formatDate(r.date)}</td>
          <td><span class="badge ${r.typeFacture === 'Vente' ? 'badge-success' : 'badge-warning'}">${r.typeFacture || '-'}</span></td>
          <td><strong>${r.factureNumero || '-'}</strong></td><td>${r.tiersNom || '-'}</td>
          <td style="font-weight:600">${formatCurrency(r.montant)}</td><td>${r.modePaiement || '-'}</td></tr>`).join('')}
      </tbody></table></div>`: '<div class="empty-state"><div class="icon">💳</div><div class="title">Aucun règlement</div></div>'}
      <div id="pagination-controls" class="pagination-container"></div>

      <div class="card" style="margin-top:24px">
        <div class="card-header"><h3 class="card-title">📊 État des Factures</h3></div>
        ${allFactures.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>N°</th><th>Type</th><th>Tiers</th><th>Total TTC</th><th>Réglé</th><th>Reste</th></tr></thead><tbody>
          ${allFactures.map(f => {
      const paye = reglements.filter(r => r.factureId === f.id).reduce((s, r) => s + (r.montant || 0), 0);
      const reste = (f.totalTTC || 0) - paye;
      return `<tr><td><strong style="color:var(--accent)">${f.numero}</strong></td><td><span class="badge ${f.docType === 'Vente' ? 'badge-success' : 'badge-warning'}">${f.docType}</span></td>
              <td>${f.fournisseurNom || f.clientNom || '-'}</td><td>${formatCurrency(f.totalTTC)}</td><td>${formatCurrency(paye)}</td>
              <td style="color:${reste > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:600">${formatCurrency(reste)}</td></tr>`;
    }).join('')}</tbody></table></div>` : '<p style="color:var(--text-muted);padding:12px">Aucune facture</p>'}
      </div>
    `;

    paginate(filtered, page, 'pagination-controls', p => render(filters, p));
    wireFilters((f, p) => render(f, p));

    // Tabs
    document.querySelectorAll('#reg-tabs .tab').forEach(tab => {
      tab.onclick = () => { activeTab = tab.dataset.tab; render({}, 1); };
    });

    document.getElementById('add-reg-btn').addEventListener('click', () => {
      const unpaid = allFactures.filter(f => {
        const paye = reglements.filter(r => r.factureId === f.id).reduce((s, r) => s + (r.montant || 0), 0);
        return (f.totalTTC || 0) - paye > 0;
      });

      showModal('Nouveau Règlement', `<form id="reg-form">
        <div class="form-group"><label class="form-label">Facture à régler *</label>
          <select class="form-select" name="factureId" id="reg-facture" required>
            <option value="">-- Sélectionner --</option>
            ${unpaid.map(f => {
        const paye = reglements.filter(r => r.factureId === f.id).reduce((s, r) => s + (r.montant || 0), 0);
        return `<option value="${f.id}" data-type="${f.docType}" data-tiers="${f.fournisseurNom || f.clientNom || ''}" data-num="${f.numero}" data-reste="${(f.totalTTC || 0) - paye}" data-collection="${f.collection}">${f.numero} - ${f.docType} - ${f.fournisseurNom || f.clientNom} (Reste: ${formatCurrency((f.totalTTC || 0) - paye)})</option>`;
      }).join('')}
          </select></div>
        <div class="form-row"><div class="form-group"><label class="form-label">Montant (DT) *</label><input class="form-input" type="number" step="0.001" name="montant" id="reg-montant" required/></div>
          <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" name="date" value="${todayISO()}"/></div></div>
        <div class="form-row"><div class="form-group"><label class="form-label">Mode de Paiement</label>
          <select class="form-select" name="modePaiement"><option>Espèces</option><option>Chèque</option><option>Virement</option><option>Traite</option></select></div>
          <div class="form-group"><label class="form-label">Référence</label><input class="form-input" name="reference" placeholder="N° chèque, etc."/></div></div>
        <div class="form-group"><label class="form-label">Note</label><input class="form-input" name="note"/></div>
      </form>`, `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button><button class="btn btn-primary" id="save-reg">Enregistrer</button>`);

      document.getElementById('reg-facture').onchange = () => {
        const opt = document.getElementById('reg-facture').selectedOptions[0];
        if (opt?.value) document.getElementById('reg-montant').value = opt.dataset.reste;
      };

      document.getElementById('save-reg').onclick = async () => {
        const fd = new FormData(document.getElementById('reg-form'));
        const factureId = fd.get('factureId');
        const montant = parseFloat(fd.get('montant'));
        if (!factureId || !montant || montant <= 0) { showToast('Champs invalides', 'error'); return; }
        const opt = document.getElementById('reg-facture').selectedOptions[0];
        try {
          const data = {
            factureId, montant, date: fd.get('date'),
            modePaiement: fd.get('modePaiement'), reference: fd.get('reference'),
            note: fd.get('note'), typeFacture: opt.dataset.type,
            factureNumero: opt.dataset.num, tiersNom: opt.dataset.tiers
          };
          await add('reglements', data);
          // Update caisse
          await addCaisseMovement(montant, opt.dataset.type === 'Vente' ? 'entree' : 'sortie',
            `Règlement ${opt.dataset.type} - ${opt.dataset.num}`, opt.dataset.num);
          // Check if fully paid
          const allPaid = reglements.filter(r => r.factureId === factureId).reduce((s, r) => s + (r.montant || 0), 0) + montant;
          const facture = allFactures.find(f => f.id === factureId);
          if (facture && allPaid >= (facture.totalTTC || 0)) {
            await update(opt.dataset.collection, factureId, { regle: true });
          }
          hideModal(); renderReglements(); showToast('Règlement enregistré');
        } catch (err) { showToast('Erreur: ' + err.message, 'error'); }
      };
    });
  }
  render();
}
