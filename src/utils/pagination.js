// Pagination & Filter Utilities
const ITEMS_PER_PAGE = 15;

/**
 * Renders pagination controls and returns the paginated slice
 * @param {Array} items - Full array of items
 * @param {number} currentPage - Current page (1-indexed)
 * @param {string} containerId - ID of the pagination container element
 * @param {Function} onPageChange - Callback when page changes
 * @returns {Array} - Sliced array for current page
 */
export function paginate(items, currentPage, containerId, onPageChange) {
    const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
    const page = Math.min(Math.max(1, currentPage), totalPages);
    const start = (page - 1) * ITEMS_PER_PAGE;
    const paged = items.slice(start, start + ITEMS_PER_PAGE);

    // Render after DOM is ready
    setTimeout(() => {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (totalPages <= 1) { container.innerHTML = `<span class="pagination-info">${items.length} élément(s)</span>`; return; }

        let html = `<span class="pagination-info">${items.length} élément(s) — Page ${page}/${totalPages}</span><div class="pagination-buttons">`;
        html += `<button class="pagination-btn" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">‹</button>`;

        // Show smart page numbers 
        const range = getPageRange(page, totalPages);
        for (const p of range) {
            if (p === '...') { html += `<span class="pagination-ellipsis">…</span>`; }
            else { html += `<button class="pagination-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`; }
        }

        html += `<button class="pagination-btn" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">›</button></div>`;
        container.innerHTML = html;

        container.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.onclick = () => { const p = parseInt(btn.dataset.page); if (p >= 1 && p <= totalPages) onPageChange(p); };
        });
    }, 0);

    return paged;
}

function getPageRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
    pages.push(1);
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
}

/**
 * Renders a filter bar with date range and status filter
 * @param {Object} options
 * @returns {string} HTML string for the filter bar
 */
export function filterBarHTML(options = {}) {
    const { showStatus = false, statusOptions = [], showDate = true, showSearch = true, extraFilters = '' } = options;
    return `<div class="filter-bar">
    ${showSearch ? `<input type="text" class="filter-search" placeholder="Rechercher..."/>` : ''}
    ${showDate ? `<div class="filter-group"><label>Du:</label><input type="date" class="filter-date-from form-input"/></div>
      <div class="filter-group"><label>Au:</label><input type="date" class="filter-date-to form-input"/></div>` : ''}
    ${showStatus ? `<div class="filter-group"><label>Statut:</label><select class="filter-status form-select"><option value="">Tous</option>${statusOptions.map(s => `<option value="${s}">${s}</option>`).join('')}</select></div>` : ''}
    ${extraFilters}
    <button class="btn btn-sm btn-secondary filter-reset-btn">Réinitialiser</button>
  </div>`;
}

/**
 * Applies filters to an array of items
 * @param {Array} items - Items to filter
 * @param {Object} filters - { search, dateFrom, dateTo, status, statusField, searchFields }
 * @returns {Array} Filtered items
 */
export function applyFilters(items, filters) {
    let result = [...items];
    const { search, dateFrom, dateTo, status, statusField = 'statut', searchFields = [] } = filters;

    if (search) {
        const q = search.toLowerCase();
        result = result.filter(item => {
            if (searchFields.length) return searchFields.some(f => String(item[f] || '').toLowerCase().includes(q));
            return JSON.stringify(item).toLowerCase().includes(q);
        });
    }
    if (dateFrom) result = result.filter(item => (item.date || '') >= dateFrom);
    if (dateTo) result = result.filter(item => (item.date || '') <= dateTo);
    if (status) {
        result = result.filter(item => {
            const val = item[statusField];
            if (typeof val === 'boolean') return status === 'Oui' ? val === true : val === false;
            return val === status;
        });
    }

    return result;
}

/**
 * Wires up filter controls and calls render on change
 * @param {Function} renderFn - Function to call when filters change
 */
export function wireFilters(renderFn) {
    const search = document.querySelector('.filter-search');
    const dateFrom = document.querySelector('.filter-date-from');
    const dateTo = document.querySelector('.filter-date-to');
    const status = document.querySelector('.filter-status');
    const reset = document.querySelector('.filter-reset-btn');

    const getFilters = () => ({
        search: search?.value || '',
        dateFrom: dateFrom?.value || '',
        dateTo: dateTo?.value || '',
        status: status?.value || ''
    });

    search?.addEventListener('input', () => renderFn(getFilters(), 1));
    dateFrom?.addEventListener('change', () => renderFn(getFilters(), 1));
    dateTo?.addEventListener('change', () => renderFn(getFilters(), 1));
    status?.addEventListener('change', () => renderFn(getFilters(), 1));
    reset?.addEventListener('click', () => {
        if (search) search.value = '';
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        if (status) status.value = '';
        renderFn({}, 1);
    });
}
