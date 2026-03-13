// Paramètres (Settings) Page
import { getSettings, saveSettings } from '../data/store.js';
import { showToast } from '../utils/helpers.js';

export async function renderParametres() {
    const content = document.getElementById('page-content');
    const settings = await getSettings();

    content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">⚙️ Paramètres</h1>
        <p class="page-subtitle">Configuration générale du système</p>
      </div>
    </div>

    <form id="settings-form">
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3 class="card-title">🏢 Informations de l'Entreprise</h3>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Raison Sociale</label>
            <input class="form-input" name="companyName" value="${settings.companyName || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Téléphone</label>
            <input class="form-input" name="companyPhone" value="${settings.companyPhone || ''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Adresse</label>
          <textarea class="form-textarea" name="companyAddress" rows="2">${settings.companyAddress || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" name="companyEmail" value="${settings.companyEmail || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">RC (Registre du Commerce)</label>
            <input class="form-input" name="companyRC" value="${settings.companyRC || ''}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">NIF</label>
            <input class="form-input" name="companyNIF" value="${settings.companyNIF || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Article d'Imposition (AI)</label>
            <input class="form-input" name="companyAI" value="${settings.companyAI || ''}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">NIS</label>
            <input class="form-input" name="companyNIS" value="${settings.companyNIS || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Code TVA</label>
            <input class="form-input" name="companyTVA" value="${settings.companyTVA || ''}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Activité / Groupement</label>
            <input class="form-input" name="companyActivity" value="${settings.companyActivity || ''}" placeholder="ex: GROUPEMENT DE PRESTATAIRES" />
          </div>
          <div class="form-group">
            <label class="form-label">Site Web</label>
            <input class="form-input" name="companyWebsite" value="${settings.companyWebsite || ''}" placeholder="ex: www.sireprefa.com.tn" />
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3 class="card-title">🏦 Informations Bancaires</h3>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Banque</label>
            <input class="form-input" name="bankInfo" value="${settings.bankInfo || ''}" placeholder="ex: Banque BIAT-Banque Internationale Arabe de Tunisie" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">IBAN</label>
            <input class="form-input" name="bankIBAN" value="${settings.bankIBAN || ''}" placeholder="ex: TN59 0870 5000 4110 5166 7975" />
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3 class="card-title">💰 Taxes</h3>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Taux de TVA (%)</label>
            <input class="form-input" type="number" step="0.01" name="taxRate" value="${settings.taxRate || 19}" />
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3 class="card-title">🔢 Numérotation des Documents</h3>
        </div>
        <h4 style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:12px;">Achats</h4>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Préfixe Devis Achat</label>
            <input class="form-input" name="devisAchatPrefix" value="${settings.devisAchatPrefix || 'DA'}" />
          </div>
          <div class="form-group">
            <label class="form-label">Prochain N° Devis Achat</label>
            <input class="form-input" type="number" name="devisAchatSeq" value="${settings.devisAchatSeq || 1}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Préfixe BC Achat</label>
            <input class="form-input" name="bcAchatPrefix" value="${settings.bcAchatPrefix || 'BCA'}" />
          </div>
          <div class="form-group">
            <label class="form-label">Prochain N° BC Achat</label>
            <input class="form-input" type="number" name="bcAchatSeq" value="${settings.bcAchatSeq || 1}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Préfixe BL Achat</label>
            <input class="form-input" name="blAchatPrefix" value="${settings.blAchatPrefix || 'BLA'}" />
          </div>
          <div class="form-group">
            <label class="form-label">Prochain N° BL Achat</label>
            <input class="form-input" type="number" name="blAchatSeq" value="${settings.blAchatSeq || 1}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Préfixe Facture Achat</label>
            <input class="form-input" name="factureAchatPrefix" value="${settings.factureAchatPrefix || 'FA'}" />
          </div>
          <div class="form-group">
            <label class="form-label">Prochain N° Facture Achat</label>
            <input class="form-input" type="number" name="factureAchatSeq" value="${settings.factureAchatSeq || 1}" />
          </div>
        </div>
        <h4 style="font-size:0.9rem; color:var(--text-secondary); margin:16px 0 12px;">Ventes</h4>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Préfixe Devis Vente</label>
            <input class="form-input" name="devisVentePrefix" value="${settings.devisVentePrefix || 'DV'}" />
          </div>
          <div class="form-group">
            <label class="form-label">Prochain N° Devis Vente</label>
            <input class="form-input" type="number" name="devisVenteSeq" value="${settings.devisVenteSeq || 1}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Préfixe BC Vente</label>
            <input class="form-input" name="bcVentePrefix" value="${settings.bcVentePrefix || 'BCV'}" />
          </div>
          <div class="form-group">
            <label class="form-label">Prochain N° BC Vente</label>
            <input class="form-input" type="number" name="bcVenteSeq" value="${settings.bcVenteSeq || 1}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Préfixe BL Vente</label>
            <input class="form-input" name="blVentePrefix" value="${settings.blVentePrefix || 'BLV'}" />
          </div>
          <div class="form-group">
            <label class="form-label">Prochain N° BL Vente</label>
            <input class="form-input" type="number" name="blVenteSeq" value="${settings.blVenteSeq || 1}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Préfixe Facture Vente</label>
            <input class="form-input" name="factureVentePrefix" value="${settings.factureVentePrefix || 'FV'}" />
          </div>
          <div class="form-group">
            <label class="form-label">Prochain N° Facture Vente</label>
            <input class="form-input" type="number" name="factureVenteSeq" value="${settings.factureVenteSeq || 1}" />
          </div>
        </div>
      </div>

      <button type="submit" class="btn btn-primary" style="min-width:200px;">
        💾 Enregistrer les Paramètres
      </button>
    </form>
  `;

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = Object.fromEntries(fd.entries());
        // Convert numeric fields
        data.taxRate = parseFloat(data.taxRate) || 19;
        ['devisAchatSeq', 'bcAchatSeq', 'blAchatSeq', 'factureAchatSeq',
            'devisVenteSeq', 'bcVenteSeq', 'blVenteSeq', 'factureVenteSeq'].forEach(k => {
                data[k] = parseInt(data[k]) || 1;
            });
        try {
            await saveSettings(data);
            showToast('Paramètres enregistrés avec succès');
        } catch (err) {
            showToast('Erreur: ' + err.message, 'error');
        }
    });
}
