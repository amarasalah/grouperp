// Utility Helpers
export function formatCurrency(amount) {
    if (amount == null || isNaN(amount)) return '0,000 DT';
    return new Intl.NumberFormat('fr-TN', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3
    }).format(amount) + ' DT';
}

export function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

export function todayISO() {
    return new Date().toISOString().split('T')[0];
}

export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Convert Firestore Timestamp to Date string
export function tsToDate(ts) {
    if (!ts) return '';
    if (ts.toDate) return ts.toDate().toISOString();
    if (ts.seconds) return new Date(ts.seconds * 1000).toISOString();
    return ts;
}

// Show toast notification
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✓', error: '✗', info: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(60px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Show/hide modal
export function showModal(title, bodyHTML, footerHTML = '') {
    const overlay = document.getElementById('modal-overlay');
    const container = document.getElementById('modal-container');
    container.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${title}</h3>
      <button class="modal-close" onclick="document.getElementById('modal-overlay').classList.add('hidden')">&times;</button>
    </div>
    <div class="modal-body">${bodyHTML}</div>
    ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
  `;
    overlay.classList.remove('hidden');
}

export function hideModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

// Confirm dialog
export function confirmDialog(message) {
    return new Promise((resolve) => {
        showModal('Confirmation', `<p style="font-size:0.95rem;">${message}</p>`,
            `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Annuler</button>
       <button class="btn btn-danger" id="confirm-yes-btn">Confirmer</button>`
        );
        setTimeout(() => {
            document.getElementById('confirm-yes-btn').addEventListener('click', () => {
                hideModal();
                resolve(true);
            });
        }, 50);
    });
}

// Number to words in French (simplified)
export function numberToWords(n) {
    if (n === 0) return 'zéro';
    const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
        'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

    function convert(n) {
        if (n < 20) return units[n];
        if (n < 100) {
            const t = Math.floor(n / 10);
            const u = n % 10;
            if (t === 7 || t === 9) return tens[t] + '-' + units[10 + u];
            if (u === 0) return tens[t] + (t === 8 ? 's' : '');
            if (u === 1 && t !== 8) return tens[t] + ' et un';
            return tens[t] + '-' + units[u];
        }
        if (n < 1000) {
            const h = Math.floor(n / 100);
            const rest = n % 100;
            let s = h === 1 ? 'cent' : units[h] + ' cent';
            if (rest === 0 && h > 1) s += 's';
            else if (rest > 0) s += ' ' + convert(rest);
            return s;
        }
        if (n < 1000000) {
            const k = Math.floor(n / 1000);
            const rest = n % 1000;
            let s = k === 1 ? 'mille' : convert(k) + ' mille';
            if (rest > 0) s += ' ' + convert(rest);
            return s;
        }
        if (n < 1000000000) {
            const m = Math.floor(n / 1000000);
            const rest = n % 1000000;
            let s = convert(m) + (m === 1 ? ' million' : ' millions');
            if (rest > 0) s += ' ' + convert(rest);
            return s;
        }
        return String(n);
    }

    const intPart = Math.floor(Math.abs(n));
    const decPart = Math.round((Math.abs(n) - intPart) * 1000);
    let result = convert(intPart) + ' dinars';
    if (decPart > 0) result += ' et ' + convert(decPart) + ' millimes';
    return result.charAt(0).toUpperCase() + result.slice(1);
}

// Create a print-ready document header
export function printDocumentHeader(settings, docType, docNumber, date) {
    return `
    <div class="print-header" style="display:block; margin-bottom:30px; border-bottom:2px solid #333; padding-bottom:15px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <h2 style="margin:0; font-size:1.3rem;">${settings.companyName || 'Groupement'}</h2>
          <p style="margin:3px 0; font-size:0.85rem; color:#666;">${settings.companyAddress || ''}</p>
          <p style="margin:3px 0; font-size:0.85rem; color:#666;">Tél: ${settings.companyPhone || ''} | Email: ${settings.companyEmail || ''}</p>
          <p style="margin:3px 0; font-size:0.85rem; color:#666;">RC: ${settings.companyRC || ''} | NIF: ${settings.companyNIF || ''} | AI: ${settings.companyAI || ''} | NIS: ${settings.companyNIS || ''}</p>
        </div>
        <div style="text-align:right;">
          <h3 style="margin:0; color:#4f8cff; font-size:1.2rem;">${docType}</h3>
          <p style="margin:5px 0; font-size:1rem; font-weight:700;">N° ${docNumber}</p>
          <p style="margin:3px 0; font-size:0.88rem;">Date: ${formatDate(date)}</p>
        </div>
      </div>
    </div>
  `;
}
