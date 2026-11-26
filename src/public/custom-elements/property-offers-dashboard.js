// ============================================================
//  property-offers-dashboard.js
//  Sharon Homes — Property Offers Admin Dashboard
//  Wix Custom Element  ·  tag: <property-offers-dashboard>
//
//  PHASE 1  — Design + full interactivity, mock data
//  PHASE 2  — Wire data via $w('#el').setAttribute(...)
//
//  Wix page → element  : setAttribute('offers', JSON)
//                        setAttribute('editdata', JSON)   ← {property,countries,states,cities}
//                        setAttribute('states',   JSON)   ← after fetchStates event
//                        setAttribute('cities',   JSON)   ← after fetchCities event
//                        setAttribute('saveresult',JSON)  ← {success,error?}
//                        setAttribute('username', 'Granit')
//                        setAttribute('initials', 'G')
//
//  Element → Wix page  : 'statusChange'  { id, status }
//                        'editOffer'     { id }
//                        'fetchStates'   { countryCode }
//                        'fetchCities'   { countryCode, stateCode }
//                        'saveOffer'     { id, formData }
// ============================================================

const _MOCK_OFFERS = [
  {
    id: 'po-001', num: 1,
    propertyName: 'Sea View Villa Peyia',        propertyType: 'Villa',
    bedrooms: 4, city: 'Paphos',   country: 'Cyprus',
    minPrice: 850000,  maxPrice: 1100000,
    status: 'pending',  date: '2026-02-10',
    requestId: 'req-001', offerRequestId: 'po-001',
    rooms: 4, minArea: 320,
    description: 'Stunning 4-bedroom villa with panoramic sea views in Peyia.'
  },
  {
    id: 'po-002', num: 2,
    propertyName: 'Modern 3BR Apartment Germasogeia', propertyType: 'Apartment',
    bedrooms: 3, city: 'Limassol', country: 'Cyprus',
    minPrice: 420000,  maxPrice: 420000,
    status: 'approved', date: '2026-01-28',
    requestId: 'req-002', offerRequestId: 'po-002',
    rooms: 3, minArea: 165,
    description: 'Newly built apartment in the heart of Germasogeia.'
  },
  {
    id: 'po-003', num: 3,
    propertyName: 'Athens Kolonaki Investment Flat', propertyType: 'Apartment',
    bedrooms: 2, city: 'Athens',   country: 'Greece',
    minPrice: 650000,  maxPrice: 900000,
    status: 'pending',  date: '2026-01-18',
    requestId: 'req-003', offerRequestId: 'po-003',
    rooms: 2, minArea: 120,
    description: 'Premium investment property in the prestigious Kolonaki district.'
  },
  {
    id: 'po-004', num: 4,
    propertyName: 'Mykonos Luxury Villa',         propertyType: 'Villa',
    bedrooms: 5, city: 'Mykonos',  country: 'Greece',
    minPrice: 2800000, maxPrice: null,
    status: 'rejected', date: '2025-12-05',
    requestId: '',     offerRequestId: 'po-004',
    rooms: 5, minArea: 480,
    description: 'Exclusive 5-bedroom villa with infinity pool and panoramic sea views.'
  },
  {
    id: 'po-005', num: 5,
    propertyName: 'Tel Aviv Prime Plot',          propertyType: 'Plot',
    bedrooms: 0, city: 'Tel Aviv', country: 'Israel',
    minPrice: 1500000, maxPrice: 2000000,
    status: 'approved', date: '2026-01-05',
    requestId: 'req-005', offerRequestId: 'po-005',
    rooms: 0, minArea: 800,
    description: 'Prime development plot in central Tel Aviv with planning permission.'
  }
];

// ── CUSTOM ELEMENT ────────────────────────────────────────────

class PropertyOffersDashboard extends HTMLElement {

  constructor() {
    super();
    this._offers          = _MOCK_OFFERS.slice();
    this._activeId        = null;
    this._reqPage         = 1;
    this._REQ_PER_PAGE    = 10;
    this._editCountryCode = '';   // isoCode of currently selected country in edit form
    this._galleryUrls     = [];   // current gallery (Wix URLs + blob previews)
    this._pendingUploadMap = {};   // id → {file, blobUrl} awaiting upload
    this._toastTimer      = null;
    this._debounce        = null;
    this._connected       = false;
  }

  // ── Wix communication ────────────────────────────────────

  static get observedAttributes() {
    return ['offers', 'editdata', 'states', 'cities', 'saveresult', 'uploadurls', 'username', 'initials'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.log('[POD] attributeChangedCallback:', name, '| _connected:', this._connected, '| same:', oldValue === newValue, '| len:', newValue?.length);

    if (!this._connected) {
      console.warn('[POD] attributeChangedCallback SKIPPED (not connected yet):', name);
      return;
    }
    // editdata always re-processes even if value appears same (fresh fetch)
    if (name !== 'editdata' && oldValue === newValue) return;

    switch (name) {
      case 'offers':
        try {
          this._offers = JSON.parse(newValue);
          console.log('[POD] offers received:', this._offers.length, 'items');
          if (this._offers.length) console.log('[POD] first offer sample:', JSON.stringify(this._offers[0]));
          this._renderOffers();
        } catch (e) { console.error('[POD] invalid offers JSON', e); }
        break;

      case 'editdata':
        if (!newValue) return;
        try {
          const data = JSON.parse(newValue);
          console.log('[POD] editdata received, keys:', Object.keys(data));
          this._populateEditForm(data);
        } catch (e) { console.error('[POD] invalid editdata JSON', e); }
        break;

      case 'states':
        if (!newValue) return;
        try {
          const states = JSON.parse(newValue);
          console.log('[POD] states received:', states.length);
          this._populateStateSelectEdit(states, '');
        } catch (e) { console.error('[POD] invalid states JSON', e); }
        break;

      case 'cities':
        if (!newValue) return;
        try {
          const cities = JSON.parse(newValue);
          console.log('[POD] cities received:', cities.length);
          this._populateCitySelectEdit(cities, '');
        } catch (e) { console.error('[POD] invalid cities JSON', e); }
        break;

      case 'uploadurls':
        if (!newValue) return;
        try {
          const uploadData = JSON.parse(newValue);
          console.log('[POD] uploadurls received — success:', uploadData.success, '| urls:', uploadData.urls?.length);
          if (uploadData.success) {
            this._doFileUploads(uploadData.urls);
          } else {
            this._galleryUploadStatus(uploadData.error || 'Upload failed.', true);
          }
        } catch (e) { console.error('[POD] invalid uploadurls JSON', e); }
        break;

      case 'saveresult':
        if (!newValue) return;
        try {
          const result = JSON.parse(newValue);
          console.log('[POD] saveresult received:', result);
          this._handleSaveResult(result);
        } catch (e) { console.error('[POD] invalid saveresult JSON', e); }
        break;

      case 'username':
        if (newValue) { const el = this.qs('.atb-uname'); if (el) el.textContent = newValue; }
        break;

      case 'initials':
        if (newValue) { const el = this.qs('.atb-avatar'); if (el) el.textContent = newValue.substring(0, 2).toUpperCase(); }
        break;
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────

  connectedCallback() {
    this._injectFonts();
    this._injectStyles();
    this._buildDOM();
    this._setupListeners();
    this._connected = true;
    console.log('[POD] connectedCallback complete — _connected now true');

    // Safety net: re-read attrs set before connectedCallback fired
    const earlyOffers = this.getAttribute('offers');
    if (earlyOffers) {
      console.log('[POD] re-processing early offers attr');
      try { this._offers = JSON.parse(earlyOffers); } catch (e) { console.error('[POD] early offers parse error', e); }
    }
    this._renderOffersWithSkeleton(700);
  }

  // ── DOM shortcuts ─────────────────────────────────────────

  qs(sel)  { return this.querySelector(sel); }
  qsa(sel) { return this.querySelectorAll(sel); }

  // ── Formatters ────────────────────────────────────────────

  _fmtEur(n) {
    if (n == null || n === '') return null;
    return '\u20ac' + Number(n).toLocaleString('en-EU');
  }

  _fmtDate(s) {
    if (!s) return '\u2014';
    return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  _badgeHtml(st) {
    const map = { approved: 's-approved', pending: 's-pending', rejected: 's-rejected' };
    const lc  = (st || '').toLowerCase();
    const label = lc.charAt(0).toUpperCase() + lc.slice(1);
    return `<span class="s-badge ${map[lc] || ''}">${label}</span>`;
  }

  _priceRange(o) {
    const mn = this._fmtEur(o.minPrice), mx = this._fmtEur(o.maxPrice);
    if (mn && mx && o.minPrice === o.maxPrice) return mn;
    if (mn && mx) return `${mn} \u2013 ${mx}`;
    if (mx)       return `Up to ${mx}`;
    if (mn)       return `From ${mn}`;
    return '\u2014';
  }

  // ── Toast ─────────────────────────────────────────────────

  _toast(msg, type) {
    const el = this.qs('#pod-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'pod-toast' + (type ? ' pod-toast-' + type : '');
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  // ── Modal helpers ─────────────────────────────────────────

  _openModal(id)  { this.qs('#' + id)?.classList.add('open'); }
  _closeModal(id) { this.qs('#' + id)?.classList.remove('open'); }

  // ── Skeleton builders ─────────────────────────────────────

  _skOfferRow(n) {
    return `<tr class="sk-row-${n}">
      <td><div class="sk sk-line sk-w60" style="margin-bottom:7px"></div><div class="sk sk-line-sm sk-w35"></div></td>
      <td class="col-loc"><div class="sk sk-line-sm sk-w25" style="margin-bottom:7px"></div><div class="sk sk-line sk-w45"></div></td>
      <td class="col-price"><div class="sk sk-line sk-w50"></div></td>
      <td><div class="sk sk-badge"></div></td>
      <td><div class="sk sk-line sk-w40"></div></td>
      <td><div class="sk sk-btn"></div></td>
    </tr>`;
  }

  _renderSkeletonOffers(count) {
    const tbody = this.qs('#offerTbody');
    if (tbody) tbody.innerHTML = Array.from({ length: count }, (_, i) => this._skOfferRow(i + 1)).join('');
  }

  _renderSkeletonViewModal() {
    const widths = [70, 80, 60, 90, 65, 75, 55, 80, 45, 70];
    const ig = this.qs('#vmodInfoGrid');
    if (ig) ig.innerHTML = Array.from({ length: 10 }, (_, i) =>
      `<div class="icard sk-row-${(i % 5) + 1}">
        <div class="sk sk-card-lbl sk-w35"></div>
        <div class="sk sk-card-val sk-w${widths[i]}"></div>
      </div>`
    ).join('');
    const vc = this.qs('#vmodComments');
    if (vc) vc.innerHTML = `
      <div class="sk sk-line sk-w100" style="margin-bottom:8px"></div>
      <div class="sk sk-line sk-w75"></div>`;
    ['#btnApprove','#btnReject','#btnEditOffer'].forEach(sel => {
      const btn = this.qs(sel); if (btn) btn.disabled = true;
    });
  }

  _renderSkeletonEditForm() {
    const body = this.qs('#emodBody');
    if (!body) return;
    const row = (w1, w2) => `
      <div class="eform-row" style="margin-bottom:16px">
        <div class="eform-field">
          <div class="sk sk-line-sm sk-w35" style="margin-bottom:6px"></div>
          <div class="sk sk-line sk-w${w1}" style="height:38px;border-radius:4px"></div>
        </div>
        <div class="eform-field">
          <div class="sk sk-line-sm sk-w35" style="margin-bottom:6px"></div>
          <div class="sk sk-line sk-w${w2}" style="height:38px;border-radius:4px"></div>
        </div>
      </div>`;
    body.innerHTML = `
      <div class="eform-section" style="animation:none">
        <div class="sk sk-line-sm sk-w20" style="margin-bottom:14px;height:9px"></div>
        ${row(80, 60)} ${row(70, 75)} ${row(50, 65)}
      </div>
      <div class="eform-section" style="animation:none">
        <div class="sk sk-line-sm sk-w20" style="margin-bottom:14px;height:9px"></div>
        ${row(60, 60)} ${row(55, 40)}
      </div>
      <div class="eform-section" style="animation:none">
        <div class="sk sk-line-sm sk-w20" style="margin-bottom:14px;height:9px"></div>
        ${row(70, 70)}
      </div>`;
    const saveBtn = this.qs('#btnSaveOffer');
    if (saveBtn) saveBtn.disabled = true;
  }

  // ── Offers table ──────────────────────────────────────────

  _getFilteredOffers() {
    const sv = (this.qs('#statusFilter')?.value || '').toLowerCase();
    const qv = (this.qs('#offerSearch')?.value || '').trim().toLowerCase();
    return this._offers.filter(o => {
      if (sv && (o.status || '').toLowerCase() !== sv) return false;
      if (qv) {
        const hay = [o.propertyName, o.city, o.country, o.propertyType, o.requestId].join(' ').toLowerCase();
        if (!hay.includes(qv)) return false;
      }
      return true;
    });
  }

  _renderOffers() {
    const tbody  = this.qs('#offerTbody');
    const list   = this._getFilteredOffers();

    console.log('[POD] _renderOffers: filtered', list.length, 'items | page', this._reqPage, '| perPage', this._REQ_PER_PAGE);

    const total = Math.max(1, Math.ceil(list.length / this._REQ_PER_PAGE));
    if (this._reqPage > total) this._reqPage = total;

    const pagPrev  = this.qs('#offerPagPrev');
    const pagNext  = this.qs('#offerPagNext');
    const pagInput = this.qs('#offerPagInput');
    const pagTotal = this.qs('#offerPagTotal');
    const pagInfo  = this.qs('#offerPagInfo');

    if (pagTotal) pagTotal.textContent = total;
    if (pagInput) { pagInput.value = this._reqPage; pagInput.max = total; }
    if (pagPrev)  pagPrev.disabled  = this._reqPage <= 1;
    if (pagNext)  pagNext.disabled  = this._reqPage >= total;
    if (pagInfo)  pagInfo.textContent = list.length ? `${list.length} result${list.length !== 1 ? 's' : ''}` : '';

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="tbl-empty">No offers found.<p>Try adjusting the filter or search term.</p></td></tr>`;
      return;
    }

    const slice = list.slice((this._reqPage - 1) * this._REQ_PER_PAGE, this._reqPage * this._REQ_PER_PAGE);

    tbody.innerHTML = slice.map(o => {
      const beds = o.bedrooms > 0
        ? `${o.bedrooms} bed`
        : (o.propertyType === 'Plot' ? 'Plot' : '\u2014');
      return `<tr>
        <td>
          <div class="buyer-name">${o.propertyName}</div>
          <div class="buyer-sub">${o.propertyType} &middot; ${beds}</div>
        </td>
        <td class="col-loc">
          <div class="loc-country">${o.country}</div>
          <div class="loc-city">${o.city}</div>
        </td>
        <td class="col-price"><div class="price-val">${this._priceRange(o)}</div></td>
        <td>${this._badgeHtml(o.status)}</td>
        <td class="req-date">${this._fmtDate(o.date)}</td>
        <td>
          <div class="row-acts">
            <button class="btn-row-view" data-action="view" data-id="${o.id}">View</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    this.qsa('[data-action="view"]').forEach(btn =>
      btn.addEventListener('click', () => this._openViewModal(btn.dataset.id))
    );
  }

  _renderOffersWithSkeleton(delay) {
    this._renderSkeletonOffers(5);
    setTimeout(() => this._renderOffers(), delay || 700);
  }

  // ── View modal ────────────────────────────────────────────

  _openViewModal(id) {
    const o = this._offers.find(x => x.id === id);
    if (!o) { console.warn('[POD] _openViewModal: id not found:', id); return; }
    this._activeId = id;
    console.log('[POD] _openViewModal:', JSON.stringify(o));
    this.qs('#vmodTitle').textContent = `Property Offer #${o.num} Details`;
    this._openModal('viewModal');
    this._renderSkeletonViewModal();
    setTimeout(() => this._fillViewModal(o), 500);
  }

  _fillViewModal(o) {
    const fields = [
      { label: 'Property Name',    val: o.propertyName },
      { label: 'Property Type',    val: o.propertyType },
      { label: 'City',             val: o.city || '\u2014' },
      { label: 'Country',          val: o.country || '\u2014' },
      { label: 'Bedrooms',         val: o.bedrooms > 0 ? String(o.bedrooms) : '\u2014' },
      { label: 'Plot / Min Area',  val: o.minArea ? `${o.minArea} m\u00b2` : '\u2014' },
      { label: 'Price Range',      val: this._priceRange(o) },
      { label: 'Status',           html: this._badgeHtml(o.status) },
      { label: 'Listed Date',      val: this._fmtDate(o.date) },
      { label: 'Linked Request',   val: o.requestId || '\u2014' }
    ];

    this.qs('#vmodInfoGrid').innerHTML = fields.map(f => {
      const content = f.html ? f.html : (f.val ? f.val : '<span class="icard-val-empty">\u2014</span>');
      return `<div class="icard"><div class="icard-label">${f.label}</div><div class="icard-val">${content}</div></div>`;
    }).join('');

    const vc = this.qs('#vmodComments');
    if (vc) vc.textContent = o.description || '\u2014';

    const lc = (o.status || '').toLowerCase();
    const approve = this.qs('#btnApprove'), reject = this.qs('#btnReject'), edit = this.qs('#btnEditOffer');
    if (approve) approve.disabled = lc === 'approved';
    if (reject)  reject.disabled  = lc === 'rejected';
    if (edit)    edit.disabled    = false;
  }

  _changeStatus(newStatus) {
    const o = this._offers.find(x => x.id === this._activeId);
    if (!o) return;
    o.status = newStatus;
    this._renderOffers();
    this._openViewModal(this._activeId);
    this._toast(`Offer ${newStatus}.`, 'success');
    this.dispatchEvent(new CustomEvent('statusChange', {
      bubbles: true, detail: { id: this._activeId, status: newStatus }
    }));
  }

  // ── Edit modal ────────────────────────────────────────────

  _openEditModal(id) {
    this._activeId = id;
    this._galleryUrls = [];
    this._pendingUploadMap = {};
    this._closeModal('viewModal');
    this.qs('#emodTitle').textContent = 'Edit Property Offer';
    this._clearEditErrors();
    this._renderSkeletonEditForm();
    this._openModal('editModal');
    console.log('[POD] editOffer dispatched for id:', id);
    this.dispatchEvent(new CustomEvent('editOffer', {
      bubbles: true, detail: { id }
    }));
  }

  _populateEditForm({ property, countries, states, cities }) {
    console.log('[POD] _populateEditForm — property keys:', Object.keys(property || {}));
    const p = property || {};

    // Update modal title
    const titleEl = this.qs('#emodTitle');
    if (titleEl) titleEl.textContent = `Edit: ${p.title || 'Property Offer'}`;

    // Restore the full form HTML (replace skeleton)
    const body = this.qs('#emodBody');
    if (body) body.innerHTML = this._editFormHtml();
    this._bindEditFormListeners();

    // ── Country cascade
    const countryRaw = Array.isArray(p.country) ? (p.country[0] || '') : (p.country || '');
    const countryObj = (countries || []).find(c =>
      c.isoCode === countryRaw || c.name.toLowerCase() === countryRaw.toLowerCase()
    );
    const isoCode = countryObj?.isoCode || '';
    this._editCountryCode = isoCode;

    this._populateCountrySelectEdit(countries || [], isoCode);
    this._populateStateSelectEdit(states || [], p.state || '');
    this._populateCitySelectEdit(cities || [], p.stateCity || '');

    // ── All other fields
    const set = (id, val) => {
      const el = this.qs('#' + id);
      if (!el) return;
      if (el.type === 'checkbox') { el.checked = !!val; return; }
      el.value = (val != null && val !== '') ? String(val) : '';
    };

    const firstOf = v => Array.isArray(v) ? (v.find(Boolean) || '') : (v || '');
    const stripPct = v => String(v || '').replace('%', '').trim();

    set('ef-title',          p.title);
    set('ef-neighbourhood',  p.neighbourhood);
    set('ef-propertyType',   firstOf(p.propertyType));
    set('ef-dealType',       firstOf(p.dealType));
    set('ef-investmentOpp',  firstOf(p.investmentOpportunity));
    set('ef-propertyStatus', p.propertyStatus || '');
    set('ef-address',        typeof p.address === 'object' ? (p.address?.formatted || '') : (p.address || ''));
    set('ef-zipCode',        p.zipCode);
    set('ef-minBedrooms',    p.minBedrooms);
    set('ef-maxBedrooms',    p.maxBedrooms);
    set('ef-plotArea',       p.plotArea);
    set('ef-minPrice',       p.minPrice);
    set('ef-maxPrice',       p.maxPrice);
    set('ef-commission',     stripPct(p.commission));
    set('ef-developer',      p.developer1);
    set('ef-projectName',    p.projectName);
    set('ef-delivery',       p.delivery);
    set('ef-email',          p.email);
    set('ef-shortDesc',      p.shortDescription);
    set('ef-description',    p.description);
    set('ef-closeToSea',     p.closeToSea);
    set('ef-seaView',        p.seaView);
    set('ef-agreement',      p.agreement);

    if (p.availableDate) {
      const dateEl = this.qs('#ef-availableDate');
      if (dateEl) {
        try {
          dateEl.value = new Date(p.availableDate).toISOString().split('T')[0];
        } catch (_) {}
      }
    }

    // Gallery — extract URLs from the raw gallery field
    const toUrls = g => Array.isArray(g)
      ? g.map(x => typeof x === 'string' ? x : (x?.src || x?.image?.imageInfo || '')).filter(Boolean)
      : [];
    this._galleryUrls = toUrls(p.gallery);
    console.log('[POD] gallery URLs loaded:', this._galleryUrls.length);
    this._renderGalleryThumbnails();

    const saveBtn = this.qs('#btnSaveOffer');
    if (saveBtn) saveBtn.disabled = false;
  }

  _populateCountrySelectEdit(countries, selectedIsoCode) {
    const sel = this.qs('#ef-country');
    if (!sel) return;
    if (!countries.length) {
      sel.innerHTML = '<option value="">\u2014 No countries \u2014</option>';
      return;
    }
    sel.innerHTML = countries.map(c =>
      `<option value="${c.isoCode}"${c.isoCode === selectedIsoCode ? ' selected' : ''}>${c.name}</option>`
    ).join('');
  }

  _populateStateSelectEdit(states, selectedStateCode) {
    const sel = this.qs('#ef-state');
    if (!sel) return;
    if (!states.length) {
      sel.innerHTML = '<option value="">\u2014 No states \u2014</option>';
      sel.disabled = true;
      return;
    }
    sel.innerHTML = states.map(s =>
      `<option value="${s.isoCode}"${s.isoCode === selectedStateCode ? ' selected' : ''}>${s.name}</option>`
    ).join('');
    sel.disabled = false;
  }

  _populateCitySelectEdit(cities, selectedCity) {
    const sel = this.qs('#ef-city');
    if (!sel) return;
    if (!cities.length) {
      sel.innerHTML = '<option value="">\u2014 No cities \u2014</option>';
      sel.disabled = true;
      return;
    }
    sel.innerHTML = cities.map(c =>
      `<option value="${c.name}"${c.name === selectedCity ? ' selected' : ''}>${c.name}</option>`
    ).join('');
    sel.disabled = false;
  }

  _getEditFormData() {
    const get    = id => this.qs('#' + id)?.value ?? '';
    const getNum = id => { const v = get(id); return v === '' ? 0 : Number(v); };
    const getBool = id => !!(this.qs('#' + id)?.checked);
    const toArr  = v => v ? [v] : [];

    // Country: save as name (option text), not isoCode
    const countryEl   = this.qs('#ef-country');
    const countryText = countryEl?.options[countryEl.selectedIndex]?.text || '';
    const countryName = countryText.startsWith('\u2014') ? '' : countryText;

    // State: save as name (option text)
    const stateEl   = this.qs('#ef-state');
    const stateName = stateEl?.options[stateEl.selectedIndex]?.text || get('ef-state');

    // Commission: append %
    const commVal = get('ef-commission');
    const commission = commVal ? `${commVal}%` : '';

    return {
      title:                 get('ef-title').trim(),
      neighbourhood:         get('ef-neighbourhood').trim(),
      country:               countryName ? [countryName] : [],
      state:                 stateName.startsWith('\u2014') ? '' : stateName,
      stateCity:             get('ef-city'),
      address:               get('ef-address').trim() || null,
      zipCode:               get('ef-zipCode'),
      propertyType:          toArr(get('ef-propertyType')),
      dealType:              toArr(get('ef-dealType')),
      investmentOpportunity: toArr(get('ef-investmentOpp')),
      propertyStatus:        get('ef-propertyStatus') || null,
      minBedrooms:           getNum('ef-minBedrooms'),
      maxBedrooms:           getNum('ef-maxBedrooms'),
      plotArea:              getNum('ef-plotArea'),
      minPrice:              getNum('ef-minPrice'),
      maxPrice:              getNum('ef-maxPrice'),
      commission,
      developer1:            get('ef-developer').trim(),
      projectName:           get('ef-projectName').trim(),
      delivery:              get('ef-delivery').trim(),
      email:                 get('ef-email').trim(),
      shortDescription:      get('ef-shortDesc').trim(),
      description:           get('ef-description').trim(),
      availableDate:         get('ef-availableDate') ? new Date(get('ef-availableDate')) : null,
      agreement:             getBool('ef-agreement'),
      closeToSea:            getBool('ef-closeToSea'),
      seaView:               getBool('ef-seaView'),
      email_sent_to_buyer:   false,
      // Send as gallery objects (same format as old edit page)
      gallery: this._galleryUrls
        .filter(u => !u.startsWith('blob:'))   // exclude still-uploading previews
        .map(u => ({ type: 'image', src: u, title: '', description: '' }))
    };
  }

  _validateEditForm(data) {
    const errors = {};
    if (!data.title?.trim()) errors['ef-title'] = 'Property title is required';
    if (!data.country?.length) errors['ef-country'] = 'Country is required';
    if (!data.stateCity) errors['ef-city'] = 'City is required';
    if (data.minBedrooms < 0) errors['ef-minBedrooms'] = 'Must be 0 or more';
    if (data.maxBedrooms < 0) errors['ef-maxBedrooms'] = 'Must be 0 or more';
    if (data.minBedrooms > 0 && data.maxBedrooms > 0 && data.maxBedrooms < data.minBedrooms)
      errors['ef-maxBedrooms'] = 'Max must be \u2265 min bedrooms';
    if (data.minPrice < 0) errors['ef-minPrice'] = 'Must be \u2265 0';
    if (data.maxPrice < 0) errors['ef-maxPrice'] = 'Must be \u2265 0';
    if (data.minPrice > 0 && data.maxPrice > 0 && data.maxPrice < data.minPrice)
      errors['ef-maxPrice'] = 'Max must be \u2265 min price';
    return { valid: Object.keys(errors).length === 0, errors };
  }

  _saveEdit() {
    this._clearEditErrors();
    const data = this._getEditFormData();
    const { valid, errors } = this._validateEditForm(data);

    if (!valid) {
      this._showEditErrors(errors);
      return;
    }

    const saveBtn = this.qs('#btnSaveOffer');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving\u2026'; }

    console.log('[POD] saveOffer dispatched:', JSON.stringify(data));
    this.dispatchEvent(new CustomEvent('saveOffer', {
      bubbles: true,
      detail: { id: this._activeId, formData: data }
    }));
  }

  _handleSaveResult(result) {
    const saveBtn = this.qs('#btnSaveOffer');
    if (result.success) {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
      this._closeEditModal();
      this._toast('Property offer updated successfully.', 'success');
    } else {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
      const summary = this.qs('#eformErrSummary');
      if (summary) {
        summary.textContent = result.error || 'Failed to save. Please try again.';
        summary.style.display = 'block';
      }
    }
  }

  _closeEditModal() {
    this._closeModal('editModal');
    this._clearEditErrors();
  }

  _clearEditErrors() {
    this.qsa('.eform-input.err, .eform-select.err, .eform-textarea.err')
        .forEach(el => el.classList.remove('err'));
    this.qsa('.eform-error').forEach(el => el.remove());
    const s = this.qs('#eformErrSummary');
    if (s) { s.textContent = ''; s.style.display = 'none'; }
  }

  _showEditErrors(errors) {
    Object.entries(errors).forEach(([fieldId, msg]) => {
      const el = this.qs('#' + fieldId);
      if (!el) return;
      el.classList.add('err');
      const errEl = document.createElement('span');
      errEl.className = 'eform-error';
      errEl.textContent = msg;
      el.parentNode.appendChild(errEl);
    });
    const summary = this.qs('#eformErrSummary');
    if (summary) {
      const n = Object.keys(errors).length;
      summary.textContent = `Please fix ${n} error${n > 1 ? 's' : ''} before saving.`;
      summary.style.display = 'block';
    }
    const firstErr = this.qs('.eform-input.err, .eform-select.err');
    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Edit form HTML (rendered into emodBody) ───────────────

  _editFormHtml() {
    const sel = (id, label, opts, req) => `
      <div class="eform-field">
        <label class="eform-label" for="${id}">${label}${req ? ' <span class="req-star">*</span>' : ''}</label>
        <select id="${id}" class="eform-select">
          <option value="">\u2014 Select \u2014</option>
          ${opts.map(o => Array.isArray(o)
            ? `<option value="${o[0]}">${o[1]}</option>`
            : `<option value="${o}">${o}</option>`
          ).join('')}
        </select>
      </div>`;

    const inp = (id, label, type, placeholder, req, extra) => `
      <div class="eform-field">
        <label class="eform-label" for="${id}">${label}${req ? ' <span class="req-star">*</span>' : ''}${extra ? ` <span class="eform-opt">${extra}</span>` : ''}</label>
        <input type="${type}" id="${id}" class="eform-input" placeholder="${placeholder}">
      </div>`;

    const chk = (id, label) =>
      `<label class="check-label"><input type="checkbox" id="${id}"> ${label}</label>`;

    return `
      <!-- Error banner -->
      <div class="eform-err-summary" id="eformErrSummary" style="display:none" role="alert"></div>

      <!-- 1. Property Information -->
      <div class="eform-section">
        <div class="eform-sec-title">Property Information</div>
        <div class="eform-row">
          <div class="eform-field eform-full">
            <label class="eform-label" for="ef-title">Property Title <span class="req-star">*</span></label>
            <input type="text" id="ef-title" class="eform-input" placeholder="e.g. Sea View Villa Peyia">
          </div>
        </div>
        <div class="eform-row">
          ${sel('ef-propertyType', 'Property Type', ['Detached House','Apartment','Villa','Hotel','Plot','Office Building','Shop'])}
          ${inp('ef-neighbourhood', 'Neighbourhood', 'text', 'e.g. Sea Caves', false, '(optional)')}
        </div>
        <div class="eform-row">
          ${sel('ef-dealType', 'Deal Type', ['Sale','Rent','Rent to Buy'])}
          ${sel('ef-investmentOpp', 'Investment Opportunity', ['Yes','No'])}
        </div>
        <div class="eform-row">
          ${sel('ef-propertyStatus', 'Property Status', ['Active','Under Offer','Sold','Off Market'])}
          <div class="eform-field">
            <label class="eform-label">Features</label>
            <div class="check-row">
              ${chk('ef-closeToSea', 'Close to Sea')}
              ${chk('ef-seaView', 'Sea View')}
              ${chk('ef-agreement', 'Agreement')}
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Location -->
      <div class="eform-section">
        <div class="eform-sec-title">Location</div>
        <div class="eform-row">
          <div class="eform-field">
            <label class="eform-label" for="ef-country">Country <span class="req-star">*</span></label>
            <select id="ef-country" class="eform-select"><option value="">Loading\u2026</option></select>
          </div>
          <div class="eform-field">
            <label class="eform-label" for="ef-state">State / Region</label>
            <select id="ef-state" class="eform-select" disabled><option value="">\u2014 Select Country First \u2014</option></select>
          </div>
        </div>
        <div class="eform-row">
          <div class="eform-field">
            <label class="eform-label" for="ef-city">City <span class="req-star">*</span></label>
            <select id="ef-city" class="eform-select" disabled><option value="">\u2014 Select State First \u2014</option></select>
          </div>
          ${inp('ef-zipCode', 'Zip Code', 'text', 'e.g. 8260', false)}
        </div>
        <div class="eform-row">
          <div class="eform-field eform-full">
            <label class="eform-label" for="ef-address">Street Address</label>
            <input type="text" id="ef-address" class="eform-input" placeholder="Full street address">
          </div>
        </div>
      </div>

      <!-- 3. Specifications -->
      <div class="eform-section">
        <div class="eform-sec-title">Specifications</div>
        <div class="eform-row">
          ${inp('ef-minBedrooms', 'Min Bedrooms', 'number', 'e.g. 2', false)}
          ${inp('ef-maxBedrooms', 'Max Bedrooms', 'number', 'e.g. 4', false)}
        </div>
        <div class="eform-row">
          <div class="eform-field">
            <label class="eform-label" for="ef-plotArea">Plot Area <span class="eform-unit">m\u00b2</span></label>
            <input type="number" id="ef-plotArea" class="eform-input" min="0" placeholder="e.g. 450">
          </div>
        </div>
      </div>

      <!-- 4. Pricing -->
      <div class="eform-section">
        <div class="eform-sec-title">Pricing</div>
        <div class="eform-row">
          <div class="eform-field">
            <label class="eform-label" for="ef-minPrice">Min Price <span class="eform-unit">&euro;</span></label>
            <input type="number" id="ef-minPrice" class="eform-input" min="0" step="1000" placeholder="e.g. 500000">
          </div>
          <div class="eform-field">
            <label class="eform-label" for="ef-maxPrice">Max Price <span class="eform-unit">&euro;</span></label>
            <input type="number" id="ef-maxPrice" class="eform-input" min="0" step="1000" placeholder="e.g. 800000">
          </div>
        </div>
        <div class="eform-row">
          <div class="eform-field">
            <label class="eform-label" for="ef-commission">Commission <span class="eform-unit">%</span></label>
            <input type="number" id="ef-commission" class="eform-input" min="0" max="100" step="0.5" placeholder="e.g. 2">
          </div>
        </div>
      </div>

      <!-- 5. Developer & Project -->
      <div class="eform-section">
        <div class="eform-sec-title">Developer &amp; Project</div>
        <div class="eform-row">
          ${inp('ef-developer',   'Developer Name', 'text', 'Developer or seller name', false)}
          ${inp('ef-projectName', 'Project Name',   'text', 'Project or development name', false)}
        </div>
        <div class="eform-row">
          ${inp('ef-delivery',      'Delivery / Completion', 'text', 'e.g. Q2 2026 or Ready', false)}
          <div class="eform-field">
            <label class="eform-label" for="ef-availableDate">Available Date</label>
            <input type="date" id="ef-availableDate" class="eform-input">
          </div>
        </div>
        <div class="eform-row">
          <div class="eform-field eform-full">
            <label class="eform-label" for="ef-email">Contact Email</label>
            <input type="email" id="ef-email" class="eform-input" placeholder="developer@example.com">
          </div>
        </div>
      </div>

      <!-- 6. Descriptions -->
      <div class="eform-section">
        <div class="eform-sec-title">Descriptions</div>
        <div class="eform-row">
          <div class="eform-field eform-full">
            <label class="eform-label" for="ef-shortDesc">Short Description</label>
            <textarea id="ef-shortDesc" class="eform-textarea" rows="2" placeholder="Brief overview for listings\u2026"></textarea>
          </div>
        </div>
        <div class="eform-row">
          <div class="eform-field eform-full">
            <label class="eform-label" for="ef-description">Full Description</label>
            <textarea id="ef-description" class="eform-textarea" rows="4" placeholder="Detailed property description\u2026"></textarea>
          </div>
        </div>
      </div>

      <!-- 7. Gallery -->
      <div class="eform-section">
        <div class="eform-sec-title">Gallery</div>
        <div class="gallery-grid" id="galleryGrid"></div>
        <div class="gallery-bar">
          <button type="button" class="btn-add-images" id="btnAddImages">&#43; Add Images</button>
          <span class="gallery-status" id="galleryStatus"></span>
        </div>
        <input type="file" id="galleryFileInput" accept="image/*" multiple style="display:none">
      </div>`;
  }

  // Re-bind cascade + clear-error listeners after form HTML is injected
  _bindEditFormListeners() {
    // Country change → fetch states
    this.qs('#ef-country')?.addEventListener('change', () => {
      const isoCode = this.qs('#ef-country')?.value || '';
      this._editCountryCode = isoCode;
      // Clear dependent dropdowns
      const stSel = this.qs('#ef-state'), ctSel = this.qs('#ef-city');
      if (stSel) { stSel.innerHTML = '<option value="">Loading\u2026</option>'; stSel.disabled = true; }
      if (ctSel) { ctSel.innerHTML = '<option value="">\u2014 Select State First \u2014</option>'; ctSel.disabled = true; }
      // Clear errors
      this.qs('#ef-country')?.classList.remove('err');
      this.qs('#ef-country')?.parentNode.querySelector('.eform-error')?.remove();
      if (!isoCode) return;
      console.log('[POD] fetchStates dispatched for:', isoCode);
      this.dispatchEvent(new CustomEvent('fetchStates', { bubbles: true, detail: { countryCode: isoCode } }));
    });

    // State change → fetch cities
    this.qs('#ef-state')?.addEventListener('change', () => {
      const stateCode = this.qs('#ef-state')?.value || '';
      const ctSel = this.qs('#ef-city');
      if (ctSel) { ctSel.innerHTML = '<option value="">Loading\u2026</option>'; ctSel.disabled = true; }
      if (!stateCode || !this._editCountryCode) return;
      console.log('[POD] fetchCities dispatched for:', this._editCountryCode, stateCode);
      this.dispatchEvent(new CustomEvent('fetchCities', {
        bubbles: true,
        detail: { countryCode: this._editCountryCode, stateCode }
      }));
    });

    // City change → clear error
    this.qs('#ef-city')?.addEventListener('change', () => {
      this.qs('#ef-city')?.classList.remove('err');
      this.qs('#ef-city')?.parentNode.querySelector('.eform-error')?.remove();
    });

    // Gallery — add images button
    this.qs('#btnAddImages')?.addEventListener('click', () => {
      this.qs('#galleryFileInput')?.click();
    });

    this.qs('#galleryFileInput')?.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      e.target.value = '';  // reset so same files can be re-selected

      this._galleryUploadStatus(`Uploading ${files.length} image${files.length > 1 ? 's' : ''}...`);

      // Show blob previews immediately
      const blobUrls = files.map(f => URL.createObjectURL(f));
      this._galleryUrls.push(...blobUrls);
      this._renderGalleryThumbnails();

      // Map id → {file, blobUrl} for when upload URLs come back
      const fileInfos = files.map((f, i) => {
        const id = `upload_${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`;
        this._pendingUploadMap[id] = { file: f, blobUrl: blobUrls[i] };
        return { id, name: f.name, type: f.type };
      });

      console.log('[POD] requestUploadUrls dispatched for', fileInfos.length, 'files');
      this.dispatchEvent(new CustomEvent('requestUploadUrls', {
        bubbles: true,
        detail: { files: fileInfos }
      }));
    });

    // Text field input → clear error
    ['ef-title','ef-minBedrooms','ef-maxBedrooms','ef-minPrice','ef-maxPrice'].forEach(id => {
      this.qs('#' + id)?.addEventListener('input', () => {
        this.qs('#' + id)?.classList.remove('err');
        this.qs('#' + id)?.parentNode.querySelector('.eform-error')?.remove();
      });
    });
  }

  // ── Gallery methods ──────────────────────────────────────────

  _wixUrlToDisplay(url) {
    if (!url) return '';
    if (url.startsWith('blob:') || url.startsWith('http')) return url;
    if (url.startsWith('wix:image://v1/')) {
      // wix:image://v1/FILEID/slug.jpg#originWidth=W&originHeight=H
      // Converts to: https://static.wixstatic.com/media/FILEID/v1/fill/w_80,h_80,al_c,q_80/slug.jpg
      const core    = url.replace('wix:image://v1/', '').split('#')[0];
      const slashAt = core.indexOf('/');
      if (slashAt > -1) {
        const fileId = core.substring(0, slashAt);
        const slug   = core.substring(slashAt + 1);
        return `https://static.wixstatic.com/media/${fileId}/v1/fill/w_80,h_80,al_c,q_80/${slug}`;
      }
      // No slash — just use the fileId directly
      return `https://static.wixstatic.com/media/${core}`;
    }
    return url;
  }

  _renderGalleryThumbnails() {
    const grid = this.qs('#galleryGrid');
    if (!grid) return;
    if (!this._galleryUrls.length) {
      grid.innerHTML = '<div class="gallery-empty">No images added yet</div>';
      return;
    }
    grid.innerHTML = this._galleryUrls.map((url, i) => {
      const isUploading = url.startsWith('blob:');
      return `<div class="gallery-thumb" data-idx="${i}">
        <img src="${this._wixUrlToDisplay(url)}" alt="Image ${i + 1}" loading="lazy">
        ${isUploading ? '<div class="gallery-uploading-overlay"><span>Uploading…</span></div>' : ''}
        <button type="button" class="gallery-remove" data-idx="${i}" aria-label="Remove">&times;</button>
      </div>`;
    }).join('');

    this.qsa('.gallery-remove').forEach(btn =>
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const removed = this._galleryUrls.splice(idx, 1)[0];
        if (removed?.startsWith('blob:')) URL.revokeObjectURL(removed);
        this._renderGalleryThumbnails();
      })
    );
  }

  _galleryUploadStatus(msg, isError) {
    const el = this.qs('#galleryStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? 'var(--err)' : 'var(--gold)';
    if (!isError) {
      clearTimeout(this._galleryStatusTimer);
      this._galleryStatusTimer = setTimeout(() => { if (el) el.textContent = ''; }, 3500);
    }
  }

  async _doFileUploads(urls) {
    // urls: [{id, fileName, uploadUrl}]
    // Upload via PUT with filename as query param + raw file body + Content-Type header
    // (as per wix-media-backend getUploadUrl documentation)
    let done = 0, failed = 0;

    for (const { id, fileName, uploadUrl } of urls) {
      const pending = this._pendingUploadMap[id];
      if (!pending) continue;

      try {
        const putUrl = `${uploadUrl}?filename=${encodeURIComponent(fileName)}`;
        const res = await fetch(putUrl, {
          method: 'PUT',
          headers: { 'Content-Type': pending.file.type },
          body: pending.file   // raw file content — NOT FormData
        });

        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

        const result = await res.json();
        // Construct wix:image URL from response fields (Wix Media Manager format)
        const raw    = Array.isArray(result) ? result[0] : result;
        const wixUrl = raw?.file_name
          ? `wix:image://v1/${raw.file_name}/${raw.original_file_name}#originWidth=${raw.width || 0}&originHeight=${raw.height || 0}`
          : (raw?.file_url || raw?.fileUrl || raw?.url);  // fallback

        if (wixUrl) {
          const idx = this._galleryUrls.indexOf(pending.blobUrl);
          if (idx !== -1) this._galleryUrls[idx] = wixUrl;
          URL.revokeObjectURL(pending.blobUrl);
          done++;
          console.log('[POD] gallery upload done:', fileName, '→', wixUrl);
        } else {
          throw new Error('No Wix URL in upload response: ' + JSON.stringify(raw));
        }

      } catch (err) {
        console.error('[POD] gallery upload failed for', fileName, err);
        const idx = this._galleryUrls.indexOf(pending.blobUrl);
        if (idx !== -1) this._galleryUrls.splice(idx, 1);
        URL.revokeObjectURL(pending.blobUrl);
        failed++;
      }

      delete this._pendingUploadMap[id];
    }

    this._renderGalleryThumbnails();
    if (failed > 0) {
      this._galleryUploadStatus(`${failed} upload${failed > 1 ? 's' : ''} failed. Please retry.`, true);
    } else if (done > 0) {
      this._galleryUploadStatus(`${done} image${done > 1 ? 's' : ''} uploaded successfully.`);
    }
  }

  // ── DOM construction ──────────────────────────────────────

  _buildDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'pod-root';
    wrap.innerHTML = this._html();
    this.appendChild(wrap);
    const u = this.getAttribute('username'), i = this.getAttribute('initials');
    if (u) this.qs('.atb-uname').textContent = u;
    if (i) this.qs('.atb-avatar').textContent = i.substring(0, 2).toUpperCase();
  }

  _html() {
    return /* html */ `
      <!-- TOPBAR -->
      <header class="admin-topbar" role="banner">
        <div class="atb-inner">
          <div class="atb-left">
            <span class="atb-wordmark">Sharon Homes</span>
            <span class="atb-sep"></span>
            <span class="atb-badge">Admin</span>
          </div>
          <nav class="atb-crumb" aria-label="Breadcrumb">
            <a href="#">Dashboard</a>
            <span class="atb-crumb-sep">&#8250;</span>
            <span class="atb-crumb-current">Property Offers</span>
          </nav>
          <div class="atb-right">
            <div class="atb-notif" role="button" tabindex="0" aria-label="Notifications">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span class="atb-notif-dot"></span>
            </div>
            <div class="atb-user" role="button" tabindex="0" aria-label="User menu">
              <div class="atb-avatar">G</div>
              <span class="atb-uname">Granit</span>
            </div>
          </div>
        </div>
      </header>

      <!-- MAIN -->
      <main class="admin-page">
        <div class="pod-container">
          <div class="admin-title-card">
            <h1>Property Offers</h1>
          </div>
          <div class="admin-panel">
            <div class="panel-hd">
              <span class="panel-hd-title">Property Offers Management</span>
              <select class="ctl ctl-select" id="statusFilter" aria-label="Filter by status">
                <option value="">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
              <input type="text" class="ctl ctl-input" id="offerSearch"
                     placeholder="Search offers&#8230;" aria-label="Search offers">
              <button class="pod-btn pod-btn-sm pod-btn-secondary" id="btnReset">Reset</button>
            </div>
            <table class="req-table" aria-label="Property offers">
              <thead>
                <tr>
                  <th>Property</th>
                  <th class="col-loc">Location</th>
                  <th class="col-price">Price Range</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="offerTbody"></tbody>
            </table>
            <div class="req-pag" id="offerPag">
              <button class="pag-btn" id="offerPagPrev" aria-label="Previous">&#8249;</button>
              <input  type="number" class="pag-inp" id="offerPagInput" value="1" min="1" aria-label="Page">
              <span>/ <span id="offerPagTotal">1</span></span>
              <button class="pag-btn" id="offerPagNext" aria-label="Next">&#8250;</button>
              <span class="req-pag-info" id="offerPagInfo"></span>
            </div>
          </div>
        </div>
      </main>

      <!-- VIEW MODAL -->
      <div class="modal-overlay" id="viewModal" role="dialog" aria-modal="true" aria-labelledby="vmodTitle">
        <div class="modal modal-lg">
          <button class="modal-close" id="viewModalClose" aria-label="Close">&times;</button>
          <h2 class="vmod-title" id="vmodTitle">Property Offer Details</h2>
          <div class="vmod-rule"></div>
          <div class="info-grid" id="vmodInfoGrid"></div>
          <div class="comments-box">
            <div class="comments-lbl">Description</div>
            <div class="comments-txt" id="vmodComments"></div>
          </div>
          <div class="vmod-actions">
            <button class="btn-approve"  id="btnApprove">Approve Offer</button>
            <button class="btn-reject"   id="btnReject">Reject Offer</button>
            <button class="btn-edit-req" id="btnEditOffer">Edit Offer</button>
          </div>
        </div>
      </div>

      <!-- EDIT MODAL -->
      <div class="modal-overlay" id="editModal" role="dialog" aria-modal="true" aria-labelledby="emodTitle">
        <div class="modal modal-edit">
          <button class="modal-close" id="editModalClose" aria-label="Close">&times;</button>
          <div class="emod-header">
            <button class="emod-back" id="btnBackToView" type="button">&#8592; Back to Details</button>
            <h2 class="emod-title" id="emodTitle">Edit Property Offer</h2>
            <div class="emod-rule"></div>
          </div>
          <div class="emod-body" id="emodBody">
            <!-- Populated dynamically: skeleton on open, form after editdata arrives -->
          </div>
          <div class="emod-footer">
            <button class="btn-save-req" id="btnSaveOffer" disabled>Save Changes</button>
            <button class="btn-cancel-edit" id="btnCancelEdit" type="button">Cancel</button>
          </div>
        </div>
      </div>

      <!-- TOAST -->
      <div class="pod-toast" id="pod-toast" role="status" aria-live="polite"></div>
    `;
  }

  // ── Event wiring ──────────────────────────────────────────

  _setupListeners() {
    // Toolbar
    this.qs('#statusFilter').addEventListener('change', () => { this._reqPage = 1; this._renderOffersWithSkeleton(300); });
    this.qs('#offerSearch').addEventListener('input', () => {
      clearTimeout(this._debounce);
      this._renderSkeletonOffers(5);
      this._reqPage = 1;
      this._debounce = setTimeout(() => this._renderOffers(), 350);
    });
    this.qs('#btnReset').addEventListener('click', () => {
      this.qs('#statusFilter').value = '';
      this.qs('#offerSearch').value  = '';
      this._reqPage = 1;
      this._renderOffersWithSkeleton(400);
    });

    // Offers pagination
    this.qs('#offerPagPrev').addEventListener('click', () => {
      if (this._reqPage > 1) { this._reqPage--; this._renderOffers(); }
    });
    this.qs('#offerPagNext').addEventListener('click', () => {
      const total = Math.ceil(this._getFilteredOffers().length / this._REQ_PER_PAGE);
      if (this._reqPage < total) { this._reqPage++; this._renderOffers(); }
    });
    this.qs('#offerPagInput').addEventListener('change', () => {
      const total = Math.ceil(this._getFilteredOffers().length / this._REQ_PER_PAGE);
      this._reqPage = Math.max(1, Math.min(parseInt(this.qs('#offerPagInput').value) || 1, total));
      this._renderOffers();
    });

    // View modal
    this.qs('#viewModalClose').addEventListener('click', () => this._closeModal('viewModal'));
    this.qs('#viewModal').addEventListener('click', e => { if (e.target.id === 'viewModal') this._closeModal('viewModal'); });
    this.qs('#btnApprove').addEventListener('click',   () => this._changeStatus('approved'));
    this.qs('#btnReject').addEventListener('click',    () => this._changeStatus('rejected'));
    this.qs('#btnEditOffer').addEventListener('click', () => this._openEditModal(this._activeId));

    // Edit modal
    this.qs('#editModalClose').addEventListener('click', () => this._closeEditModal());
    this.qs('#editModal').addEventListener('click', e => { if (e.target.id === 'editModal') this._closeEditModal(); });
    this.qs('#btnBackToView').addEventListener('click', () => { this._closeEditModal(); this._openViewModal(this._activeId); });
    this.qs('#btnSaveOffer').addEventListener('click',   () => this._saveEdit());
    this.qs('#btnCancelEdit').addEventListener('click',  () => this._closeEditModal());

    // Escape key — close innermost modal first
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (this.qs('#editModal.open'))  { this._closeEditModal(); return; }
      if (this.qs('#viewModal.open'))  { this._closeModal('viewModal'); }
    });
  }

  // ── Font & style injection ────────────────────────────────

  _injectFonts() {
    if (document.querySelector('#pod-fonts')) return;
    const link = document.createElement('link');
    link.id   = 'pod-fonts'; link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;500&display=swap';
    document.head.appendChild(link);
  }

  _injectStyles() {
    const style = document.createElement('style');
    style.textContent = POD_CSS;
    this.insertBefore(style, this.firstChild);
  }
}

// ── CSS ───────────────────────────────────────────────────────

const POD_CSS = `

/* TOKENS */
.pod-root {
  --bg:        #FAF8F5;
  --surface:   #FFFFFF;
  --ink:       #1A1A1A;
  --ink-2:     #444441;
  --ink-3:     #888780;
  --line:      rgba(26,26,26,0.12);
  --gold:      #B8985A;
  --gold-dark: #8C7140;
  --dark:      #1A1A1A;
  --err:       #C62828;
  --err-bg:    #FFEBEE;
  --sans:      'Inter', system-ui, -apple-system, sans-serif;
  --serif:     'Playfair Display', Georgia, 'Times New Roman', serif;
  --tf:        0.2s ease;
  display: block;
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.7;
  color: var(--ink);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

/* RESET */
.pod-root *, .pod-root *::before, .pod-root *::after { margin:0;padding:0;box-sizing:border-box; }
.pod-root a      { color:inherit; text-decoration:none; }
.pod-root button { font-family:inherit; cursor:pointer; }
.pod-root input, .pod-root select, .pod-root textarea { font-family:inherit; }
.pod-root table  { border-collapse:collapse; }

/* LAYOUT */
.pod-root .pod-container { max-width:1240px; margin:0 auto; padding:0 32px; }

/* SHARED BUTTONS */
.pod-root .pod-btn { display:inline-flex;align-items:center;justify-content:center;padding:14px 28px;border-radius:4px;font-size:13px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;transition:all var(--tf);border:1px solid transparent;white-space:nowrap; }
.pod-root .pod-btn-primary   { background:var(--gold);color:var(--ink);border-color:var(--gold); }
.pod-root .pod-btn-primary:hover { background:var(--gold-dark);border-color:var(--gold-dark); }
.pod-root .pod-btn-secondary { background:transparent;color:var(--ink);border-color:var(--ink); }
.pod-root .pod-btn-secondary:hover { background:var(--ink);color:var(--bg); }
.pod-root .pod-btn-sm { padding:10px 20px;font-size:11px; }

/* TOPBAR */
.pod-root .admin-topbar { height:56px;background:var(--dark);border-bottom:1px solid rgba(255,255,255,0.07); }
.pod-root .atb-inner    { max-width:1240px;margin:0 auto;padding:0 32px;height:100%;display:flex;align-items:center; }
.pod-root .atb-left     { display:flex;align-items:center;gap:14px;flex-shrink:0; }
.pod-root .atb-wordmark { font-family:var(--serif);font-size:15px;font-weight:400;color:rgba(255,255,255,0.9);letter-spacing:0.01em; }
.pod-root .atb-sep      { width:1px;height:16px;background:rgba(255,255,255,0.15);flex-shrink:0; }
.pod-root .atb-badge    { font-size:10px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold);background:rgba(184,152,90,0.12);border:1px solid rgba(184,152,90,0.3);border-radius:3px;padding:3px 8px; }
.pod-root .atb-crumb    { flex:1;display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;color:rgba(255,255,255,0.4); }
.pod-root .atb-crumb a  { color:rgba(255,255,255,0.4);transition:color var(--tf); }
.pod-root .atb-crumb a:hover { color:rgba(255,255,255,0.7); }
.pod-root .atb-crumb-sep     { font-size:10px;color:rgba(255,255,255,0.2); }
.pod-root .atb-crumb-current { color:rgba(255,255,255,0.85);font-weight:500; }
.pod-root .atb-right    { display:flex;align-items:center;gap:16px;flex-shrink:0; }
.pod-root .atb-notif    { position:relative;width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background var(--tf); }
.pod-root .atb-notif:hover { background:rgba(255,255,255,0.08); }
.pod-root .atb-notif svg   { color:rgba(255,255,255,0.5); }
.pod-root .atb-notif-dot   { position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--gold);border:1.5px solid var(--dark); }
.pod-root .atb-user    { display:flex;align-items:center;gap:10px;padding:5px 12px 5px 6px;border-radius:24px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);cursor:pointer;transition:background var(--tf); }
.pod-root .atb-user:hover { background:rgba(255,255,255,0.08); }
.pod-root .atb-avatar  { width:26px;height:26px;border-radius:50%;background:var(--gold);color:var(--ink);font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.pod-root .atb-uname   { font-size:12px;font-weight:500;color:rgba(255,255,255,0.75);white-space:nowrap; }

/* ADMIN PAGE */
.pod-root .admin-page        { background:var(--bg);padding:40px 0 96px;min-height:calc(100vh - 56px); }
.pod-root .admin-title-card  { background:var(--surface);border:0.5px solid var(--line);border-radius:8px;padding:24px 36px;margin-bottom:20px; }
.pod-root .admin-title-card h1 { font-family:var(--serif);font-size:30px;font-weight:400;line-height:1.2; }
.pod-root .admin-panel       { background:var(--surface);border:0.5px solid var(--line);border-radius:8px;overflow:hidden; }

/* PANEL TOOLBAR */
.pod-root .panel-hd { padding:18px 24px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:0.5px solid var(--line); }
.pod-root .panel-hd-title { font-size:15px;font-weight:600;color:var(--ink);margin-right:auto;white-space:nowrap; }
.pod-root .ctl { padding:9px 12px;border:0.5px solid var(--line);border-radius:4px;font-family:inherit;font-size:12px;color:var(--ink);background:var(--bg);outline:none;transition:border-color var(--tf); }
.pod-root .ctl:focus { border-color:var(--gold); }
.pod-root .ctl-select { appearance:none;-webkit-appearance:none;padding-right:28px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23888780' d='M5 6L0 0h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;background-color:var(--bg);cursor:pointer; }
.pod-root .ctl-input { width:190px; }

/* OFFERS TABLE */
.pod-root .req-table { width:100%;border-collapse:collapse; }
.pod-root .req-table thead tr { background:var(--dark); }
.pod-root .req-table thead th { padding:14px 20px;text-align:left;font-size:11px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#fff;white-space:nowrap; }
.pod-root .req-table tbody tr { border-bottom:0.5px solid var(--line);transition:background var(--tf); }
.pod-root .req-table tbody tr:last-child { border-bottom:none; }
.pod-root .req-table tbody tr:hover  { background:#FDFCF9; }
.pod-root .req-table tbody td { padding:20px;vertical-align:middle;font-size:13px;color:var(--ink); }
.pod-root .buyer-name  { font-weight:600;font-size:14px;margin-bottom:3px; }
.pod-root .buyer-sub   { font-size:11px;color:var(--ink-3);line-height:1.5; }
.pod-root .loc-country { font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-3);margin-bottom:2px; }
.pod-root .loc-city    { font-size:13px;color:var(--ink-2); }
.pod-root .price-val   { font-size:13px;font-weight:500; }
.pod-root .req-date    { font-size:13px;color:var(--ink-2);white-space:nowrap; }

/* STATUS BADGES */
.pod-root .s-badge    { display:inline-flex;align-items:center;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;white-space:nowrap; }
.pod-root .s-approved { background:#E8F5E9;color:#2E7D32; }
.pod-root .s-pending  { background:#FFF8E1;color:#E65100; }
.pod-root .s-rejected { background:#FFEBEE;color:#C62828; }

/* ROW ACTION */
.pod-root .row-acts      { display:flex;flex-direction:column;gap:8px; }
.pod-root .btn-row-view  { padding:8px 18px;background:var(--gold);color:var(--ink);border:none;border-radius:4px;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;transition:background var(--tf); }
.pod-root .btn-row-view:hover { background:var(--gold-dark); }

/* EMPTY STATE */
.pod-root .tbl-empty   { padding:56px 24px;text-align:center;color:var(--ink-3);font-size:14px; }
.pod-root .tbl-empty p { margin-top:6px;font-size:12px; }

/* PAGINATION */
.pod-root .req-pag { display:flex;align-items:center;justify-content:center;gap:8px;padding:16px 24px;border-top:0.5px solid var(--line);font-size:13px;color:var(--ink-2); }
.pod-root .req-pag-info { margin-left:10px;font-size:11px;letter-spacing:0.06em;color:var(--ink-3); }
.pod-root .pag-btn { width:30px;height:30px;border:0.5px solid var(--line);border-radius:4px;background:transparent;cursor:pointer;font-size:18px;color:var(--ink-2);display:flex;align-items:center;justify-content:center;transition:all var(--tf);font-family:inherit;line-height:1; }
.pod-root .pag-btn:hover:not([disabled]) { border-color:var(--ink);color:var(--ink); }
.pod-root .pag-btn[disabled]             { opacity:0.3;cursor:not-allowed; }
.pod-root .pag-inp { width:44px;height:30px;border:1.5px solid var(--gold);border-radius:4px;text-align:center;font-size:13px;font-family:inherit;color:var(--ink);outline:none; }

/* MODAL BASE */
.pod-root .modal-overlay { display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100;align-items:flex-start;justify-content:center;padding:60px 16px;overflow-y:auto; }
.pod-root .modal-overlay.open { display:flex; }
.pod-root .modal { background:var(--surface);border-radius:8px;padding:48px;width:100%;max-width:640px;position:relative;margin:auto; }
.pod-root .modal-close { position:absolute;top:20px;right:20px;background:none;border:none;font-size:22px;line-height:1;color:var(--ink-3);cursor:pointer;padding:4px;transition:color var(--tf);z-index:2; }
.pod-root .modal-close:hover { color:var(--ink); }

/* VIEW MODAL */
.pod-root .modal-lg { max-width:720px; }
.pod-root .vmod-title { font-family:var(--serif);font-size:24px;font-weight:400;text-align:center;margin-bottom:6px; }
.pod-root .vmod-rule  { width:36px;height:2px;background:var(--gold);margin:0 auto 24px; }
.pod-root .info-grid  { display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px; }
.pod-root .icard      { background:var(--bg);border-radius:6px;padding:13px 16px 13px 18px;border-left:3px solid var(--gold); }
.pod-root .icard-label { font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-3);font-weight:500;margin-bottom:5px; }
.pod-root .icard-val   { font-size:14px;font-weight:600;color:var(--ink);line-height:1.4;word-break:break-word; }
.pod-root .icard-val-empty { font-style:italic;font-weight:400;color:var(--ink-3);font-size:12px; }
.pod-root .comments-box { background:var(--bg);border:0.5px solid var(--line);border-radius:6px;padding:16px 20px;margin-bottom:24px; }
.pod-root .comments-lbl { font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-3);font-weight:500;margin-bottom:6px; }
.pod-root .comments-txt { font-size:14px;color:var(--ink-2);line-height:1.7;font-style:italic; }
.pod-root .vmod-actions { display:flex;gap:10px;justify-content:center;padding-top:20px;border-top:0.5px solid var(--line);flex-wrap:wrap; }
.pod-root .btn-approve { padding:10px 22px;background:#2E7D32;color:#fff;border:1px solid #2E7D32;border-radius:4px;font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:all var(--tf); }
.pod-root .btn-approve:hover:not([disabled]) { background:#1B5E20;border-color:#1B5E20; }
.pod-root .btn-approve[disabled] { opacity:0.35;cursor:not-allowed; }
.pod-root .btn-reject  { padding:10px 22px;background:#C62828;color:#fff;border:1px solid #C62828;border-radius:4px;font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:all var(--tf); }
.pod-root .btn-reject:hover:not([disabled]) { background:#B71C1C;border-color:#B71C1C; }
.pod-root .btn-reject[disabled] { opacity:0.35;cursor:not-allowed; }
.pod-root .btn-edit-req { padding:10px 22px;background:var(--ink);color:var(--bg);border:1px solid var(--ink);border-radius:4px;font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:all var(--tf); }
.pod-root .btn-edit-req:hover:not([disabled]) { background:var(--ink-2);border-color:var(--ink-2); }
.pod-root .btn-edit-req[disabled] { opacity:0.35;cursor:not-allowed; }

/* EDIT MODAL */
.pod-root .modal-edit { max-width:820px;padding:0;display:flex;flex-direction:column;max-height:min(90vh,900px);overflow:hidden; }
.pod-root .emod-header  { padding:36px 48px 0;flex-shrink:0;background:var(--surface); }
.pod-root .emod-back    { display:inline-flex;align-items:center;gap:6px;background:none;border:none;font-size:12px;font-weight:500;letter-spacing:0.06em;color:var(--gold);cursor:pointer;padding:0 0 14px;transition:color var(--tf);font-family:inherit; }
.pod-root .emod-back:hover { color:var(--gold-dark); }
.pod-root .emod-title   { font-family:var(--serif);font-size:24px;font-weight:400;text-align:center;margin-bottom:6px; }
.pod-root .emod-rule    { width:36px;height:2px;background:var(--gold);margin:0 auto; }
.pod-root .emod-body    { overflow-y:auto;padding:24px 48px 8px;flex:1;scrollbar-width:thin;scrollbar-color:var(--gold) var(--bg); }
.pod-root .emod-body::-webkit-scrollbar        { width:5px; }
.pod-root .emod-body::-webkit-scrollbar-track  { background:var(--bg); }
.pod-root .emod-body::-webkit-scrollbar-thumb  { background:var(--gold);border-radius:3px; }
.pod-root .emod-footer  { padding:20px 48px 32px;border-top:0.5px solid var(--line);flex-shrink:0;background:var(--surface);display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap; }

/* EDIT FORM */
.pod-root .eform-err-summary { background:var(--err-bg);border:1px solid rgba(198,40,40,0.25);border-radius:5px;color:var(--err);font-size:12px;font-weight:500;padding:10px 16px;margin-bottom:20px; }
.pod-root .eform-section     { margin-bottom:22px; }
.pod-root .eform-section:last-child { margin-bottom:0; }
.pod-root .eform-sec-title   { font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:14px;padding-bottom:9px;border-bottom:0.5px solid var(--line); }
.pod-root .eform-row         { display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px; }
.pod-root .eform-row:last-child { margin-bottom:0; }
.pod-root .eform-field       { display:flex;flex-direction:column;gap:6px;position:relative; }
.pod-root .eform-full        { grid-column:1 / -1; }
.pod-root .eform-label       { font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-3);font-weight:500;line-height:1; }
.pod-root .req-star          { color:var(--gold);margin-left:2px; }
.pod-root .eform-opt         { letter-spacing:0;text-transform:none;font-size:10px;opacity:0.7; }
.pod-root .eform-unit        { letter-spacing:0;text-transform:none; }
.pod-root .eform-input, .pod-root .eform-select, .pod-root .eform-textarea {
  width:100%;padding:11px 14px;border:0.5px solid var(--line);border-radius:4px;
  font-family:inherit;font-size:14px;color:var(--ink);background:var(--bg);
  outline:none;transition:border-color var(--tf),box-shadow var(--tf);line-height:1.5; }
.pod-root .eform-input:focus,   .pod-root .eform-select:focus,  .pod-root .eform-textarea:focus {
  border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,152,90,0.12); }
.pod-root .eform-input.err,    .pod-root .eform-select.err,    .pod-root .eform-textarea.err {
  border-color:var(--err);box-shadow:0 0 0 3px rgba(198,40,40,0.1); }
.pod-root .eform-select { appearance:none;-webkit-appearance:none;padding-right:32px;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23888780' d='M5 6L0 0h10z'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 12px center;background-color:var(--bg);cursor:pointer; }
.pod-root .eform-select:disabled { opacity:0.5;cursor:not-allowed; }
.pod-root .eform-textarea { resize:vertical;min-height:80px; }
.pod-root .eform-error { font-size:11px;color:var(--err);font-weight:500;display:flex;align-items:center;gap:4px; }
.pod-root .eform-error::before { content:'!';display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:var(--err);color:#fff;font-size:9px;font-weight:700;flex-shrink:0; }

/* CHECKBOXES */
.pod-root .check-row   { display:flex;flex-wrap:wrap;gap:12px;padding:8px 0; }
.pod-root .check-label { display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ink-2);cursor:pointer; }
.pod-root .check-label input[type="checkbox"] { width:15px;height:15px;accent-color:var(--gold);cursor:pointer; }

/* GALLERY NOTE */
.pod-root .gallery-note { display:flex;align-items:center;gap:10px;background:var(--bg);border:0.5px solid var(--line);border-radius:6px;padding:12px 16px;font-size:12px;color:var(--ink-3); }
.pod-root .gallery-note svg { flex-shrink:0;color:var(--gold); }

/* EDIT FOOTER BUTTONS */
.pod-root .btn-save-req    { padding:13px 44px;background:var(--gold);color:var(--ink);border:none;border-radius:4px;font-size:13px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:background var(--tf); }
.pod-root .btn-save-req:hover:not([disabled]) { background:var(--gold-dark); }
.pod-root .btn-save-req[disabled] { opacity:0.45;cursor:not-allowed; }
.pod-root .btn-cancel-edit { padding:13px 28px;background:transparent;color:var(--ink);border:1px solid var(--line);border-radius:4px;font-size:13px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:all var(--tf); }
.pod-root .btn-cancel-edit:hover { border-color:var(--ink);background:var(--ink);color:var(--bg); }

/* TOAST */
.pod-root .pod-toast { position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(14px);background:var(--ink);color:var(--bg);padding:12px 28px;border-radius:6px;font-size:13px;font-weight:500;z-index:9999;opacity:0;transition:opacity 0.3s ease,transform 0.3s ease;pointer-events:none;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.2); }
.pod-root .pod-toast.show              { opacity:1;transform:translateX(-50%) translateY(0); }
.pod-root .pod-toast.pod-toast-success { background:#2E7D32; }

/* SKELETON */
@keyframes pod-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
.pod-root .sk { display:block;border-radius:4px;background:linear-gradient(90deg,#E8E5DF 25%,#F0EDE6 50%,#E8E5DF 75%);background-size:200% 100%;animation:pod-shimmer 1.4s ease-in-out infinite; }
.pod-root .sk-w20{width:20%} .pod-root .sk-w25{width:25%} .pod-root .sk-w35{width:35%}
.pod-root .sk-w40{width:40%} .pod-root .sk-w45{width:45%} .pod-root .sk-w50{width:50%}
.pod-root .sk-w55{width:55%} .pod-root .sk-w60{width:60%} .pod-root .sk-w70{width:70%}
.pod-root .sk-w75{width:75%} .pod-root .sk-w80{width:80%} .pod-root .sk-w100{width:100%}
.pod-root .sk-line    { height:11px; } .pod-root .sk-line-sm { height:9px; }
.pod-root .sk-badge   { height:22px;width:72px;border-radius:20px; }
.pod-root .sk-btn     { height:32px;width:82px;border-radius:4px; }
.pod-root .sk-card-lbl{ height:9px;margin-bottom:8px; } .pod-root .sk-card-val{ height:13px; }
.pod-root .sk-row-1 .sk{animation-delay:0s} .pod-root .sk-row-2 .sk{animation-delay:.1s}
.pod-root .sk-row-3 .sk{animation-delay:.2s} .pod-root .sk-row-4 .sk{animation-delay:.3s}
.pod-root .sk-row-5 .sk{animation-delay:.4s}

/* GALLERY */
.pod-root .gallery-grid         { display:flex;flex-wrap:wrap;gap:10px;min-height:40px;margin-bottom:12px; }
.pod-root .gallery-empty        { font-size:12px;color:var(--ink-3);padding:10px 0; }
.pod-root .gallery-thumb        { position:relative;width:80px;height:80px;border-radius:6px;overflow:hidden;border:0.5px solid var(--line);flex-shrink:0; }
.pod-root .gallery-thumb img    { width:100%;height:100%;object-fit:cover;display:block; }
.pod-root .gallery-remove       { position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.65);color:#fff;border:none;cursor:pointer;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;padding:0;transition:background var(--tf); }
.pod-root .gallery-remove:hover { background:rgba(198,40,40,0.9); }
.pod-root .gallery-uploading-overlay { position:absolute;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center; }
.pod-root .gallery-uploading-overlay span { color:#fff;font-size:9px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;text-align:center;line-height:1.3; }
.pod-root .gallery-bar          { display:flex;align-items:center;gap:14px;flex-wrap:wrap; }
.pod-root .btn-add-images       { padding:9px 18px;background:transparent;color:var(--gold);border:1px solid var(--gold);border-radius:4px;font-size:11px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:all var(--tf); }
.pod-root .btn-add-images:hover { background:var(--gold);color:var(--ink); }
.pod-root .gallery-status       { font-size:11px;font-weight:500;color:var(--gold); }

/* RESPONSIVE */
@media(max-width:900px){
  .pod-root .col-loc,.pod-root .col-price{display:none}
  .pod-root .info-grid{grid-template-columns:1fr}
}
@media(max-width:700px){
  .pod-root .eform-row{grid-template-columns:1fr}
  .pod-root .emod-header{padding:28px 20px 0}
  .pod-root .emod-body{padding:20px 20px 8px}
  .pod-root .emod-footer{padding:16px 20px 24px}
}
@media(max-width:640px){
  .pod-root .pod-container{padding:0 16px}
  .pod-root .panel-hd{flex-direction:column;align-items:flex-start}
  .pod-root .ctl-input{width:100%}
  .pod-root .modal-edit,.pod-root .modal-lg{max-width:100%}
  .pod-root .vmod-actions{flex-direction:column}
  .pod-root .atb-crumb,.pod-root .atb-uname{display:none}
}
`;

// ── REGISTER ──────────────────────────────────────────────────
customElements.define('property-offers-dashboard', PropertyOffersDashboard);