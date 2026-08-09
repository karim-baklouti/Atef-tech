(function () {
  'use strict';

  const state = {
    catalog: null,
    category: 'all',
    subcategory: 'all',
    query: '',
    sort: 'featured',
  };

  const els = {
    categoryList: document.getElementById('category-list'),
    productGrid: document.getElementById('product-grid'),
    resultCount: document.getElementById('result-count'),
    emptyState: document.getElementById('empty-state'),
    loadingState: document.getElementById('loading-state'),
    activeFilters: document.getElementById('active-filters'),
    searchInput: document.getElementById('search-input'),
    sortSelect: document.getElementById('sort-select'),
    clearFilters: document.getElementById('clear-filters'),
    brandName: document.getElementById('brand-name'),
    brandTagline: document.getElementById('brand-tagline'),
    footerContact: document.getElementById('footer-contact'),
    themeToggle: document.getElementById('theme-toggle'),
    themeIcon: document.getElementById('theme-icon'),
    modal: document.getElementById('product-modal'),
    modalBody: document.getElementById('modal-body'),
    modalClose: document.getElementById('modal-close'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    brandLink: document.getElementById('brand-link'),
  };

  function formatMoney(amount, symbol) {
    return `${symbol || '$'}${Number(amount).toFixed(2)}`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ---------- Theme ----------
  function initTheme() {
    const saved = localStorage.getItem('theme');
    const preferred = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(preferred);
    els.themeToggle.addEventListener('click', () => {
      const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
      setTheme(next);
      localStorage.setItem('theme', next);
    });
  }

  function setTheme(theme) {
    document.body.dataset.theme = theme;
    els.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  // ---------- Data loading ----------
  async function loadCatalog() {
    const res = await fetch('catalog.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load catalog.json');
    return res.json();
  }

  function renderBrand(site) {
    if (site.businessName) {
      els.brandName.textContent = site.businessName;
      document.title = site.businessName;
    }
    if (site.tagline) els.brandTagline.textContent = site.tagline;

    const contact = site.contact || {};
    const links = [];
    if (contact.email) links.push(`<a href="mailto:${escapeHtml(contact.email)}">Email</a>`);
    if (contact.whatsapp) links.push(`<a href="https://wa.me/${escapeHtml(contact.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>`);
    if (contact.instagram) links.push(`<a href="https://instagram.com/${escapeHtml(contact.instagram)}" target="_blank" rel="noopener">Instagram</a>`);
    if (contact.telegram) links.push(`<a href="https://t.me/${escapeHtml(contact.telegram)}" target="_blank" rel="noopener">Telegram</a>`);
    els.footerContact.innerHTML = links.length
      ? links.join(' · ')
      : `© ${new Date().getFullYear()} ${escapeHtml(site.businessName || 'Store')}`;
  }

  // ---------- Sidebar ----------
  function renderSidebar(categories) {
    els.categoryList.innerHTML = '';

    const allLi = document.createElement('li');
    const allBtn = document.createElement('button');
    allBtn.className = 'nav-btn' + (state.category === 'all' ? ' active' : '');
    allBtn.innerHTML = `<span>All Products</span><span class="count">${countAll(categories)}</span>`;
    allBtn.addEventListener('click', () => {
      state.category = 'all';
      state.subcategory = 'all';
      render();
    });
    allLi.appendChild(allBtn);
    els.categoryList.appendChild(allLi);

    categories.forEach((cat) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      const isActive = state.category === cat.slug;
      btn.className = 'nav-btn' + (isActive ? ' active' : '');
      btn.innerHTML = `<span>${escapeHtml(cat.displayName)}</span><span class="count">${countCategory(cat)}</span>`;
      btn.addEventListener('click', () => {
        state.category = cat.slug;
        state.subcategory = 'all';
        render();
      });
      li.appendChild(btn);

      if (isActive && cat.subcategories.length) {
        const subUl = document.createElement('ul');
        subUl.className = 'sub-list';
        cat.subcategories.forEach((sub) => {
          const subLi = document.createElement('li');
          const subBtn = document.createElement('button');
          subBtn.className = 'sub-btn' + (state.subcategory === sub.slug ? ' active' : '');
          subBtn.innerHTML = `<span>${escapeHtml(sub.displayName)}</span><span class="count">${sub.products.length}</span>`;
          subBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.subcategory = sub.slug;
            render();
          });
          subLi.appendChild(subBtn);
          subUl.appendChild(subLi);
        });
        li.appendChild(subUl);
      }

      els.categoryList.appendChild(li);
    });
  }

  function countAll(categories) {
    return categories.reduce((sum, c) => sum + countCategory(c), 0);
  }

  function countCategory(cat) {
    return cat.subcategories.reduce((sum, s) => sum + s.products.length, 0);
  }

  // ---------- Filtering / sorting ----------
  function getFilteredProducts() {
    let list = state.catalog.products.slice();

    if (state.category !== 'all') {
      list = list.filter((p) => p.categorySlug === state.category);
    }
    if (state.subcategory !== 'all') {
      list = list.filter((p) => p.subcategorySlug === state.subcategory);
    }
    if (state.query.trim()) {
      const q = state.query.trim().toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }

    switch (state.sort) {
      case 'price-asc':
        list.sort((a, b) => a.finalPrice - b.finalPrice);
        break;
      case 'price-desc':
        list.sort((a, b) => b.finalPrice - a.finalPrice);
        break;
      case 'discount':
        list.sort((a, b) => b.discount - a.discount);
        break;
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        list.sort((a, b) => (b.featured === a.featured ? 0 : b.featured ? 1 : -1));
    }

    return list;
  }

  // ---------- Active filter chips ----------
  function renderActiveFilters(categories) {
    const chips = [];
    if (state.category !== 'all') {
      const cat = categories.find((c) => c.slug === state.category);
      chips.push({ label: cat ? cat.displayName : state.category, onClear: () => { state.category = 'all'; state.subcategory = 'all'; render(); } });
    }
    if (state.subcategory !== 'all') {
      const cat = categories.find((c) => c.slug === state.category);
      const sub = cat && cat.subcategories.find((s) => s.slug === state.subcategory);
      chips.push({ label: sub ? sub.displayName : state.subcategory, onClear: () => { state.subcategory = 'all'; render(); } });
    }
    if (state.query.trim()) {
      chips.push({ label: `"${state.query.trim()}"`, onClear: () => { state.query = ''; els.searchInput.value = ''; render(); } });
    }

    els.activeFilters.innerHTML = '';
    if (!chips.length) {
      els.activeFilters.hidden = true;
      return;
    }
    els.activeFilters.hidden = false;
    chips.forEach((chip) => {
      const el = document.createElement('span');
      el.className = 'filter-chip';
      el.innerHTML = `${escapeHtml(chip.label)} <button aria-label="Remove filter">×</button>`;
      el.querySelector('button').addEventListener('click', chip.onClear);
      els.activeFilters.appendChild(el);
    });
  }

  // ---------- Product grid ----------
  function renderProducts(list) {
    els.productGrid.innerHTML = '';
    els.resultCount.textContent = `${list.length} product${list.length === 1 ? '' : 's'}`;

    if (!list.length) {
      els.emptyState.hidden = false;
      return;
    }
    els.emptyState.hidden = true;

    const symbol = (state.catalog.site && state.catalog.site.currencySymbol) || '$';

    list.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `View ${p.name}`);

      const badge = p.discount > 0 ? `<span class="badge">-${p.discount}%</span>` : '';
      const stockBadge = !p.inStock ? `<span class="badge out-of-stock">Sold out</span>` : '';
      const priceHtml = p.discount > 0
        ? `<span class="price-final">${formatMoney(p.finalPrice, symbol)}</span><span class="price-original">${formatMoney(p.price, symbol)}</span>`
        : `<span class="price-final">${formatMoney(p.price, symbol)}</span>`;

      card.innerHTML = `
        <div class="product-media">
          ${badge}${stockBadge}
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.src='assets/img/placeholder.svg'" />
        </div>
        <div class="product-info">
          <span class="product-category">${escapeHtml(p.categoryName)} · ${escapeHtml(p.subcategoryName)}</span>
          <h3 class="product-name">${escapeHtml(p.name)}</h3>
          <p class="product-desc">${escapeHtml(p.description)}</p>
          <div class="price-row">${priceHtml}</div>
        </div>
      `;

      card.addEventListener('click', () => openModal(p));
      card.addEventListener('keypress', (e) => { if (e.key === 'Enter') openModal(p); });

      els.productGrid.appendChild(card);
    });
  }

  // ---------- Modal ----------
  function openModal(p) {
    const symbol = (state.catalog.site && state.catalog.site.currencySymbol) || '$';
    const priceHtml = p.discount > 0
      ? `<span class="price-final">${formatMoney(p.finalPrice, symbol)}</span> <span class="price-original">${formatMoney(p.price, symbol)}</span>`
      : `<span class="price-final">${formatMoney(p.price, symbol)}</span>`;

    const specsRows = Object.entries(p.specs || {})
      .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
      .join('');

    const tags = (p.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');

    const contact = (state.catalog.site && state.catalog.site.contact) || {};
    const orderHref = contact.email
      ? `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent('Order inquiry: ' + p.name)}`
      : null;

    els.modalBody.innerHTML = `
      <div class="modal-grid">
        <div class="modal-media">
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.src='assets/img/placeholder.svg'" />
        </div>
        <div class="modal-details">
          <span class="product-category">${escapeHtml(p.categoryName)} · ${escapeHtml(p.subcategoryName)}</span>
          <h2 id="modal-title">${escapeHtml(p.name)}</h2>
          <div class="price-row">${priceHtml}</div>
          ${!p.inStock ? '<p><strong>Currently sold out</strong></p>' : ''}
          <p>${escapeHtml(p.description)}</p>
          ${tags ? `<div class="tag-list">${tags}</div>` : ''}
          ${specsRows ? `<table class="spec-table">${specsRows}</table>` : ''}
          ${orderHref ? `<a class="contact-btn" href="${orderHref}">Enquire about this item</a>` : ''}
        </div>
      </div>
    `;

    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    els.modal.hidden = true;
    document.body.style.overflow = '';
  }

  // ---------- Render orchestration ----------
  function render() {
    renderSidebar(state.catalog.categories);
    renderActiveFilters(state.catalog.categories);
    renderProducts(getFilteredProducts());
  }

  function wireControls() {
    els.searchInput.addEventListener('input', (e) => {
      state.query = e.target.value;
      render();
    });
    els.sortSelect.addEventListener('change', (e) => {
      state.sort = e.target.value;
      render();
    });
    els.clearFilters.addEventListener('click', () => {
      state.category = 'all';
      state.subcategory = 'all';
      state.query = '';
      els.searchInput.value = '';
      render();
    });
    els.modalClose.addEventListener('click', closeModal);
    els.modalBackdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.modal.hidden) closeModal();
    });
    els.brandLink.addEventListener('click', (e) => {
      e.preventDefault();
      state.category = 'all';
      state.subcategory = 'all';
      state.query = '';
      els.searchInput.value = '';
      render();
    });
  }

  async function init() {
    initTheme();
    wireControls();
    try {
      state.catalog = await loadCatalog();
      els.loadingState.hidden = true;
      renderBrand(state.catalog.site || {});
      render();
    } catch (err) {
      els.loadingState.textContent = 'Could not load the catalog. If you just added products, run "npm run build" and refresh.';
      console.error(err);
    }
  }

  init();
})();
