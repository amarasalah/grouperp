// BL Vente Page - created from BC Vente conversion, validate for stock sortie
import { getAll, update, remove, getSettings, updateStock } from '../data/store.js';
import { showToast, showModal, hideModal, confirmDialog, formatDate, formatCurrency, printDocumentHeader } from '../utils/helpers.js';
import { paginate, filterBarHTML, applyFilters, wireFilters } from '../utils/pagination.js';

export async function renderBlVente() {
    const content = document.getElementById('page-content');
    let bls = await getAll('bl_vente').catch(() => []);
    const settings = await getSettings();
    let currentPage = 1, currentFilters = {};

    function render(filters = currentFilters, page = currentPage) {
        currentFilters = filters; currentPage = page;
        const filtered = applyFilters(bls, { ...filters, searchFields: ['numero', 'clientNom', 'bcRef'] });
        const paged = paginate(filtered, page, 'pagination-controls', p => render(filters, p));
        content.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">🚛 Bon de Livraison Vente</h1><p class="page-subtitle">Livraisons clients — créés à partir des BC Vente</p></div></div>
      ${filterBarHTML({ showStatus: true, statusOptions: ['En attente', 'Livré'] })}
      ${paged.length ? `<div class="table-wrapper"><table class="data-table"><thead><tr><th>N° BL</th><th>Date</th><th>Client</th><th>Réf. BC</th><th>Nb Poteaux</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
        ${paged.map(b => `<tr><td><strong style="color:var(--accent)">${b.numero || ''}</strong></td><td>${formatDate(b.date)}</td><td>${b.clientNom || '-'}</td><td>${b.bcRef || '-'}</td><td>${(b.lignes || []).length}</td>
          <td><span class="badge ${b.statut === 'Livré' ? 'badge-success' : 'badge-warning'}">${b.statut || 'En attente'}</span></td>
          <td class="actions"><button class="btn btn-sm btn-secondary view-blv" data-id="${b.id}">👁️</button>${b.statut !== 'Livré' ? `<button class="btn btn-sm btn-success validate-blv" data-id="${b.id}">✓</button>` : ''}<button class="btn btn-sm btn-danger delete-blv" data-id="${b.id}">🗑️</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty-state"><div class="icon">🚛</div><div class="title">Aucun BL vente</div><div class="desc">Les BL vente sont créés depuis la page Bon de Commande Vente</div></div>`}
      <div id="pagination-controls" class="pagination-container"></div>`;
        paginate(filtered, page, 'pagination-controls', p => render(filters, p));
        wireFilters((f, p) => render(f, p));
        document.querySelectorAll('.view-blv').forEach(b => b.onclick = () => { const bl = bls.find(x => x.id === b.dataset.id); if (bl) viewBl(bl); });
        document.querySelectorAll('.validate-blv').forEach(b => b.onclick = async () => {
            const bl = bls.find(x => x.id === b.dataset.id);
            if (bl && await confirmDialog('Valider la livraison ? Stock sera mis à jour.')) {
                try { for (const l of (bl.lignes || [])) { if (l.produitId) await updateStock(l.produitId, 1, 'sortie', bl.numero); } } catch (e) { console.warn('Stock update error:', e); }
                await update('bl_vente', bl.id, { statut: 'Livré' }); bl.statut = 'Livré'; render(); showToast('BL livré');
            }
        });
        document.querySelectorAll('.delete-blv').forEach(b => b.onclick = async () => { if (await confirmDialog('Supprimer ?')) { await remove('bl_vente', b.dataset.id); bls = bls.filter(x => x.id !== b.dataset.id); render(); showToast('Supprimé'); } });
    }

    function viewBl(b) {
        const nbPoteaux = (b.lignes || []).length;
        // Compute taxes (fallback for older records)
        const ht = b.totalHT || (b.lignes || []).reduce((s, l) => s + (l.montant || l.prixUnitaire || 0), 0);
        const fodec = b.fodec ?? ht * 0.01;
        const baseTva = b.baseTva ?? (ht + fodec);
        const tva = b.totalTVA ?? baseTva * 0.19;
        const dedTva = b.dedTva ?? tva * 0.25;
        const dedRsIs = b.dedRsIs ?? (ht + fodec + tva) * 0.01;
        const net = b.totalTTC ?? (ht + fodec + tva - dedTva - dedRsIs);

        // Group products by reference prefix for compact display
        const refList = (b.lignes || []).map(l => l.produitRef || l.reference || '').join('-');

        const printContent = `
        <div class="bl-print-container" style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
            <div style="flex: 1;">
              <div style="background: #1a3a6e; color: white; padding: 8px 15px; display: inline-block; font-weight: bold; font-size: 1.1rem;">
                ${settings.companyName || 'S.I.E'}
              </div>
              <p style="font-size: 0.75rem; color: #666; margin: 5px 0;">${settings.companyActivity || 'GROUPEMENT DE PRESTATAIRES'}</p>
            </div>
            <div style="text-align: right;">
              <div style="background: #1a3a6e; color: white; padding: 12px 25px; font-size: 1.3rem; font-weight: bold;">
                BON DE LIVRAISON
              </div>
              <p style="font-size: 1rem; margin: 8px 0;"><strong>N° ${b.numero}</strong></p>
            </div>
          </div>

          <!-- Date & Info Row -->
          <div style="display: flex; justify-content: space-between; border: 1px solid #ccc; padding: 8px 12px; margin-bottom: 15px; font-size: 0.9rem;">
            <span><strong>Date:</strong> ${formatDate(b.date)}</span>
            <span><strong>DISTRICT:</strong> ${b.district || 'LE BARDO'}</span>
            <span><strong>N° ORDRE:</strong> ${b.ordreNum || b.bcRef || '-'}</span>
            <span><strong>MARCHE STEG N°:</strong> ${b.marcheNum || '-'}</span>
          </div>

          <!-- Client Box -->
          <div style="border: 2px solid #1a3a6e; padding: 12px; margin-bottom: 20px;">
            <div style="background: #1a3a6e; color: white; padding: 5px 10px; display: inline-block; margin: -12px -12px 10px -12px; font-weight: bold;">CLIENT</div>
            <p style="margin: 3px 0;"><strong>Société:</strong> ${b.clientNom || '-'}</p>
            <p style="margin: 3px 0;"><strong>Matricule Fiscal:</strong> ${b.clientMF || '-'}</p>
            <p style="margin: 3px 0;"><strong>Adresse:</strong> ${b.clientAdresse || '-'}</p>
            <p style="margin: 3px 0;"><strong>Email:</strong> ${b.clientEmail || '-'} | <strong>Mobile:</strong> ${b.clientTel || '-'}</p>
          </div>

          <!-- Products Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 0.9rem;">
            <thead>
              <tr style="background: #f0f0f0;">
                <th style="border: 1px solid #ccc; padding: 8px; text-align: center; width: 40px;">#</th>
                <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Référence</th>
                <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Désignation</th>
                <th style="border: 1px solid #ccc; padding: 8px; text-align: center; width: 80px;">Quantité</th>
                <th style="border: 1px solid #ccc; padding: 8px; text-align: center; width: 60px;">Unité</th>
              </tr>
            </thead>
            <tbody>
              ${(b.lignes || []).map((l, i) => `
              <tr>
                <td style="border: 1px solid #ccc; padding: 6px; text-align: center;">${i + 1}</td>
                <td style="border: 1px solid #ccc; padding: 6px;">${l.produitRef || l.reference || '-'}</td>
                <td style="border: 1px solid #ccc; padding: 6px;">${l.designation || l.categorieNom || '-'}</td>
                <td style="border: 1px solid #ccc; padding: 6px; text-align: center;">1</td>
                <td style="border: 1px solid #ccc; padding: 6px; text-align: center;">pcs</td>
              </tr>`).join('')}
            </tbody>
          </table>

          <!-- Summary Box -->
          <div style="border: 2px solid #1a3a6e; padding: 10px; margin-bottom: 15px;">
            <p style="margin: 3px 0;"><strong>DISTRICT:</strong> ${b.district || 'LE BARDO'}</p>
            <p style="margin: 3px 0;"><strong>N° ORDRE:</strong> ${b.ordreNum || b.bcRef || '-'}</p>
            <p style="margin: 10px 0; font-size: 1.1rem; font-weight: bold; color: #1a3a6e;">
              QUANTITE TOTALE LIVREE : ${nbPoteaux} POTEAUX
            </p>
          </div>

          <!-- Tax Breakdown -->
          <table style="width: 350px; margin-left: auto; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 15px;">
            <tr><td style="border: 1px solid #ccc; padding: 6px;"><strong>TOTAL HT</strong></td><td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${formatCurrency(ht)}</td></tr>
            <tr><td style="border: 1px solid #ccc; padding: 6px;">Fodec</td><td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${formatCurrency(fodec)}</td></tr>
            <tr><td style="border: 1px solid #ccc; padding: 6px;">BASE TVA</td><td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${formatCurrency(baseTva)}</td></tr>
            <tr><td style="border: 1px solid #ccc; padding: 6px;">TOTAL TVA</td><td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${formatCurrency(tva)}</td></tr>
            <tr><td style="border: 1px solid #ccc; padding: 6px;">déduction TVA 25 %</td><td style="border: 1px solid #ccc; padding: 6px; text-align: right; color: #e63946;">-${formatCurrency(dedTva)}</td></tr>
            <tr><td style="border: 1px solid #ccc; padding: 6px;">DEDUCTION RS/IS 1%</td><td style="border: 1px solid #ccc; padding: 6px; text-align: right; color: #e63946;">-${formatCurrency(dedRsIs)}</td></tr>
            <tr style="background: #1a3a6e; color: white;"><td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">NET À PAYER</td><td style="border: 1px solid #ccc; padding: 8px; text-align: right; font-weight: bold; font-size: 1.05rem;">${formatCurrency(net)}</td></tr>
          </table>

          <!-- Transport Info -->
          <div style="display: flex; gap: 15px; font-size: 0.9rem; margin-bottom: 20px; flex-wrap: wrap;">
            <span><strong>TRANSPORTEUR:</strong> ${b.transporteur || 'SSTL'}</span>
            <span><strong>CAMION:</strong> ${b.camion || '-'}</span>
            <span><strong>CHAUFFEUR:</strong> ${b.chauffeur || '-'}</span>
            <span><strong>CIN:</strong> ${b.chauffeurCIN || '-'}</span>
            <span><strong>GSM:</strong> ${b.chauffeurGSM || '-'}</span>
          </div>

          <!-- Market Reference -->
          <p style="text-align: center; font-weight: bold; margin: 15px 0; color: #1a3a6e;">
            MARCHE STEG N° ${b.marcheNum || '-'} / GIE SRREP PREFA-SREP BETON
          </p>

          <!-- Footer -->
          <div style="display: flex; justify-content: space-between; border-top: 2px solid #1a3a6e; padding-top: 15px; font-size: 0.75rem; color: #666;">
            <div>
              <p style="margin: 2px 0;"><strong>GIE AD200492 NEA</strong></p>
              <p style="margin: 2px 0;">${settings.companyAddress || ''}</p>
            </div>
            <div style="text-align: center;">
              <p style="margin: 2px 0;"><strong>INFORMATIONS DE CONTACT</strong></p>
              <p style="margin: 2px 0;">Tél: ${settings.companyPhone || ''}</p>
              <p style="margin: 2px 0;">Email: ${settings.companyEmail || ''}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 2px 0;"><strong>INFORMATIONS BANCAIRES</strong></p>
              <p style="margin: 2px 0;">${settings.bankInfo || 'Banque Internationale Arabe de Tunisie'}</p>
              <p style="margin: 2px 0;">IBAN: ${settings.bankIBAN || '-'}</p>
            </div>
          </div>
        </div>
        `;
        
        showModal(`BL Vente - ${b.numero}`, printContent,
            `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button><button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer</button>`);
    }
    render();
}
