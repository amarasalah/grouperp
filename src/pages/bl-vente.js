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
        const lignes = b.lignes || [];
        const nbPoteaux = lignes.length;

        // Compute taxes (fallback for older records)
        const ht = b.totalHT || lignes.reduce((s, l) => s + (l.montant || l.prixUnitaire || 0), 0);
        const fodec = b.fodec ?? ht * 0.01;
        const baseTva = b.baseTva ?? (ht + fodec);
        const tva = b.totalTVA ?? baseTva * 0.19;
        const dedTva = b.dedTva ?? tva * 0.25;
        const dedRsIs = b.dedRsIs ?? (ht + fodec + tva) * 0.01;
        const net = b.totalTTC ?? (ht + fodec + tva - dedTva - dedRsIs);

        // Group products by category for compact table display
        const grouped = {};
        lignes.forEach(l => {
            const key = l.categorieId || l.categorieNom || 'default';
            if (!grouped[key]) grouped[key] = { designation: l.categorieNom || l.designation || '-', refs: [], prix: l.prixUnitaire || 0 };
            grouped[key].refs.push(l.produitRef || l.reference || '');
        });
        const groupRows = Object.values(grouped);

        // Inline G.I.E SVG logo
        const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 160" width="200" height="67">
          <clipPath id="cl"><rect x="0" y="0" width="80" height="160"/></clipPath>
          <clipPath id="cr"><rect x="80" y="0" width="80" height="160"/></clipPath>
          <circle cx="80" cy="80" r="75" fill="#C0242A" clip-path="url(#cl)"/>
          <circle cx="80" cy="80" r="75" fill="#1A3A6E" clip-path="url(#cr)"/>
          <polyline points="10,80 32,80 44,52 55,108 66,44 78,116 88,66 100,80 122,80 145,80 158,80" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
          <text x="175" y="78" font-family="Arial Black,Arial" font-weight="900" font-size="64" fill="#1A3A6E">G.I.E</text>
          <line x1="175" y1="96" x2="475" y2="96" stroke="#5BB3D8" stroke-width="3"/>
          <text x="172" y="92" font-family="Arial" font-size="13" fill="#5BB3D8">+</text>
          <text x="265" y="92" font-family="Arial" font-size="13" fill="#5BB3D8">+</text>
          <text x="360" y="92" font-family="Arial" font-size="13" fill="#5BB3D8">+</text>
          <text x="468" y="92" font-family="Arial" font-size="13" fill="#5BB3D8">+</text>
          <text x="175" y="128" font-family="Arial Black,Arial" font-weight="900" font-size="19" fill="#C0242A">SIREP PREFA &amp; SIREP BETON</text>
        </svg>`;

        // Watermark SVG (large faded background)
        const watermarkSvg = `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);opacity:0.04;pointer-events:none;z-index:0;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 160" width="600" height="200">
            <clipPath id="wl"><rect x="0" y="0" width="80" height="160"/></clipPath>
            <clipPath id="wr"><rect x="80" y="0" width="80" height="160"/></clipPath>
            <circle cx="80" cy="80" r="75" fill="#C0242A" clip-path="url(#wl)"/>
            <circle cx="80" cy="80" r="75" fill="#1A3A6E" clip-path="url(#wr)"/>
            <polyline points="10,80 32,80 44,52 55,108 66,44 78,116 88,66 100,80 122,80 145,80 158,80" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="175" y="78" font-family="Arial Black,Arial" font-weight="900" font-size="64" fill="#1A3A6E">G.I.E</text>
            <text x="175" y="128" font-family="Arial Black,Arial" font-weight="900" font-size="19" fill="#C0242A">SIREP PREFA &amp; SIREP BETON</text>
          </svg>
        </div>`;

        const printContent = `
        <style>
          .bl-doc { font-family: Arial, sans-serif; font-size: 12px; color: #222; position: relative; }
          .bl-doc table { border-collapse: collapse; width: 100%; }
          .bl-doc th { background: #e8edf5; color: #1a3a6e; border: 1px solid #bbb; padding: 7px 8px; text-align: left; }
          .bl-doc td { border: 1px solid #bbb; padding: 6px 8px; }
          .bl-doc .hdr-title { background: #1a3a6e; color: white; padding: 14px 28px; font-size: 20px; font-weight: bold; letter-spacing: 1px; text-align: center; }
          .bl-doc .hdr-num { color: #1a3a6e; font-weight: bold; font-size: 14px; margin: 6px 0 0; text-align: center; }
          .bl-doc .client-box { border: 1.5px solid #1a3a6e; padding: 10px 12px; font-size: 11.5px; }
          .bl-doc .client-box .label { background: #1a3a6e; color: white; font-weight: bold; padding: 3px 8px; display: inline-block; margin: -10px -12px 8px; font-size: 12px; }
          .bl-doc .info-box { border: 1px solid #ccc; padding: 7px 12px; font-size: 11.5px; }
          .bl-doc .summary-box { border: 1.5px solid #1a3a6e; padding: 8px 14px; margin: 12px 0; }
          .bl-doc .tax-table td:last-child { text-align: right; }
          .bl-doc .net-row td { background: #1a3a6e; color: white; font-weight: bold; font-size: 13px; padding: 8px; }
          .bl-doc .footer-row { display: flex; justify-content: space-between; border-top: 2px solid #1a3a6e; padding-top: 10px; font-size: 10.5px; color: #555; margin-top: 8px; }
          .bl-doc .refs-text { font-size: 10px; color: #444; word-break: break-all; padding: 4px 8px; border-top: none; border: 1px solid #bbb; border-top: 0; }
          @media print {
            .bl-doc { padding: 0; }
            .modal-container { max-width: 100% !important; }
          }
        </style>
        <div class="bl-doc" style="position:relative;overflow:hidden;">
          ${watermarkSvg}
          <div style="position:relative;z-index:1;">

          <!-- HEADER -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:10px;">
              ${logoSvg}
            </div>
            <div style="text-align:right;">
              <div class="hdr-title">BON DE LIVRAISON</div>
              <div class="hdr-num">N° ${b.numero}</div>
            </div>
          </div>

          <!-- CLIENT + INFO ROW -->
          <div style="display:flex;gap:12px;margin-bottom:12px;">
            <div class="client-box" style="flex:1.2;">
              <div class="label">CLIENT</div>
              <p style="margin:2px 0;"><strong>${b.clientNom || '-'}</strong></p>
              <p style="margin:2px 0;">MF: ${b.clientMF || '-'}</p>
              <p style="margin:2px 0;">${b.clientAdresse || ''}</p>
              <p style="margin:2px 0;">Tél: ${b.clientTel || '-'}</p>
              <p style="margin:2px 0;">Email: ${b.clientEmail || '-'}</p>
            </div>
            <div class="info-box" style="flex:1;font-size:11.5px;">
              <p style="margin:3px 0;"><strong>Date:</strong> ${formatDate(b.date)}</p>
              <p style="margin:3px 0;"><strong>DISTRICT:</strong> ${b.district || 'LE BARDO'}</p>
              <p style="margin:3px 0;"><strong>N° ORDRE:</strong> ${b.ordreNum || b.bcRef || '-'}</p>
              <p style="margin:3px 0;"><strong>MARCHE STEG N°:</strong> ${b.marcheNum || '-'}</p>
            </div>
          </div>

          <!-- PRODUCTS TABLE (grouped by category) -->
          <table style="margin-bottom:0;">
            <thead>
              <tr>
                <th style="width:35px;text-align:center;">#</th>
                <th style="width:80px;">Référence</th>
                <th>Désignation</th>
                <th style="width:70px;text-align:center;">Quantité</th>
                <th style="width:55px;text-align:center;">Unité</th>
              </tr>
            </thead>
            <tbody>
              ${groupRows.map((g, i) => `
              <tr>
                <td style="text-align:center;">${i + 1}</td>
                <td>${g.refs[0] ? g.refs[0].split('-')[0] || '-' : '-'}</td>
                <td>POTEAU ${g.designation}</td>
                <td style="text-align:center;font-weight:bold;">${g.refs.length}</td>
                <td style="text-align:center;">pcs</td>
              </tr>
              <tr><td colspan="5" class="refs-text">${g.refs.join('-')}</td></tr>`).join('')}
            </tbody>
          </table>

          <!-- SUMMARY BOX -->
          <div class="summary-box">
            <p style="margin:2px 0;"><strong>DISTRICT</strong> ${b.district || 'LE BARDO'}</p>
            <p style="margin:2px 0;"><strong>N° ORDRE:</strong> ${b.ordreNum || b.bcRef || '-'}</p>
            <p style="margin:8px 0 2px;font-size:14px;font-weight:bold;color:#1a3a6e;">
              QUANTITE TOTALE LIVREE : ${nbPoteaux} POTEAUX
            </p>
          </div>

          <!-- TRANSPORT + TAX side by side -->
          <div style="display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;">
            <div style="flex:1.2;font-size:11.5px;">
              <p style="margin:4px 0;"><strong>TRANSPORTEUR :</strong> ${b.transporteur || 'SSTL'} &nbsp;&nbsp; <strong>CAMION :</strong> ${b.camion || '-'}</p>
              <p style="margin:4px 0;"><strong>CHAUFFEUR :</strong> ${b.chauffeur || '-'} &nbsp;&nbsp; <strong>CIN :</strong> ${b.chauffeurCIN || '-'} &nbsp;&nbsp; <strong>GSM :</strong> ${b.chauffeurGSM || '-'}</p>
            </div>
            <div style="flex:1;">
              <table class="tax-table" style="font-size:11px;">
                <tr><td>TOTAL HT</td><td>${formatCurrency(ht)}</td></tr>
                <tr><td>Fodec</td><td>${formatCurrency(fodec)}</td></tr>
                <tr><td>BASE TVA</td><td>${formatCurrency(baseTva)}</td></tr>
                <tr><td>TOTAL TVA</td><td>${formatCurrency(tva)}</td></tr>
                <tr><td style="color:#c0242a;">déduction TVA 25 %</td><td style="color:#c0242a;">-${formatCurrency(dedTva)}</td></tr>
                <tr><td style="color:#c0242a;">DEDUCTION RS/IS 1%</td><td style="color:#c0242a;">-${formatCurrency(dedRsIs)}</td></tr>
                <tr class="net-row"><td>NET À PAYER</td><td>${formatCurrency(net)}</td></tr>
              </table>
            </div>
          </div>

          <!-- MARKET REF -->
          <p style="text-align:center;font-weight:bold;font-size:11.5px;color:#1a3a6e;margin:10px 0 14px;">
            MARCHE STEG N° ${b.marcheNum || '-'} / GIE SIREP PREFA-SIREP BETON
          </p>

          <!-- FOOTER -->
          <div class="footer-row">
            <div>
              <p style="margin:1px 0;font-weight:bold;">${settings.companyName || 'GIE AD200492 NEA'}</p>
              <p style="margin:1px 0;">${settings.companyAddress || ''}</p>
              <p style="margin:1px 0;">RC: ${settings.companyRC || '-'} | NIF: ${settings.companyNIF || '-'}</p>
              <p style="margin:1px 0;">Code TVA: ${settings.companyTVA || '-'}</p>
            </div>
            <div style="text-align:center;">
              <p style="margin:1px 0;font-weight:bold;">INFORMATIONS DE CONTACT</p>
              <p style="margin:1px 0;">BEN SAID LASSAAD</p>
              <p style="margin:1px 0;">Tél: ${settings.companyPhone || '-'}</p>
              <p style="margin:1px 0;">Email: ${settings.companyEmail || '-'}</p>
              <p style="margin:1px 0;">${settings.companyWebsite || 'www.sireprefa.com.tn'}</p>
            </div>
            <div style="text-align:right;">
              <p style="margin:1px 0;font-weight:bold;">INFORMATIONS BANCAIRES</p>
              <p style="margin:1px 0;">${settings.bankInfo || 'Banque BIAT-Banque Internationale Arabe de Tunisie'}</p>
              <p style="margin:1px 0;">IBAN: ${settings.bankIBAN || 'TN59 0870 5000 4110 5166 7975'}</p>
            </div>
          </div>

          <!-- PAGE -->
          <p style="text-align:center;font-size:10px;color:#999;margin-top:8px;">Page 1 / 1</p>

          </div><!-- end z-index wrapper -->
        </div>`;

        showModal(`BL Vente - ${b.numero}`, printContent,
            `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Fermer</button>
             <button class="btn btn-primary" id="print-bl-btn">🖨️ Imprimer</button>`);
        document.querySelector('.modal-container').style.maxWidth = '820px';

        document.getElementById('print-bl-btn').onclick = () => {
            const content = document.querySelector('.bl-doc').outerHTML;
            const win = window.open('', '_blank', 'width=900,height=700');
            win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>BL ${b.numero}</title>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { font-family: Arial, sans-serif; font-size: 12px; color: #222; padding: 20px; background: white; }
              table { border-collapse: collapse; width: 100%; }
              th { background: #e8edf5 !important; color: #1a3a6e !important; border: 1px solid #bbb; padding: 7px 8px; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              td { border: 1px solid #bbb; padding: 6px 8px; }
              .hdr-title { background: #1a3a6e !important; color: white !important; padding: 14px 28px; font-size: 20px; font-weight: bold; letter-spacing: 1px; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .hdr-num { color: #1a3a6e; font-weight: bold; font-size: 14px; margin: 6px 0 0; text-align: center; }
              .client-box { border: 1.5px solid #1a3a6e; padding: 10px 12px; font-size: 11.5px; }
              .client-box .label { background: #1a3a6e !important; color: white !important; font-weight: bold; padding: 3px 8px; display: inline-block; margin: -10px -12px 8px; font-size: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .info-box { border: 1px solid #ccc; padding: 7px 12px; font-size: 11.5px; }
              .summary-box { border: 1.5px solid #1a3a6e; padding: 8px 14px; margin: 12px 0; }
              .tax-table td:last-child { text-align: right; }
              .net-row td { background: #1a3a6e !important; color: white !important; font-weight: bold; font-size: 13px; padding: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .footer-row { display: flex; justify-content: space-between; border-top: 2px solid #1a3a6e; padding-top: 10px; font-size: 10.5px; color: #555; margin-top: 8px; }
              .refs-text { font-size: 10px; color: #444; word-break: break-all; padding: 4px 8px; border: 1px solid #bbb; border-top: 0; }
              @media print { body { padding: 10px; } }
            </style></head><body>${content}</body></html>`);
            win.document.close();
            win.focus();
            setTimeout(() => { win.print(); }, 300);
        };
    }
    render();
}
