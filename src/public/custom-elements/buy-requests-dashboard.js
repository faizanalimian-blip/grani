// ============================================================
//  buy-requests-dashboard.js
//  Sharon Homes — Buy Requests Admin Dashboard
//  Wix Custom Element  ·  tag: <buy-requests-dashboard>
//
//  PHASE 1  — Design + full interactivity, mock data
//  PHASE 2  — Wire data via $w('#el').setAttribute(...)
//
//  Wix page → element   : setAttribute('requests', JSON)
//                         setAttribute('properties', JSON)
//                         setAttribute('username', 'Granit')
//                         setAttribute('initials', 'G')
//
//  Element → Wix page   : 'statusChange'    { id, status }
//                         'saveRequest'     { request }     ← full edit save
//                         'assignProperties'{ requestId, propertyIds[] }
// ============================================================

// ── MOCK DATA (swap for real data in Phase 2) ────────────────

const _MOCK_REQUESTS = [
  {
    id: 'cdadd60b-ed0d-464c-8cf2-b2ae66336db7', num: 1,
    buyerName: 'Granit Sharon',        country: 'Cyprus', city: 'Paphos',
    neighbourhood: '',                 propertyType: 'Villa',
    minBeds: 4, maxBeds: 4,            minArea: '',
    minPrice: null,  maxPrice: 990000, status: 'approved', date: '2026-01-21',
    comments: 'A refined four-bedroom detached villa in the Sea Caves hills of Peyia.'
  },
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', num: 2,
    buyerName: 'Michael & Sarah Cohen', country: 'Cyprus', city: 'Limassol',
    neighbourhood: 'Germasogeia',       propertyType: 'Apartment',
    minBeds: 2, maxBeds: 3,             minArea: 120,
    minPrice: 300000, maxPrice: 500000, status: 'approved', date: '2025-12-31',
    comments: 'Looking for a modern seafront apartment with sea views. Flexible on exact location within Limassol.'
  },
  {
    id: 'f9e8d7c6-b5a4-3210-9876-543210fedcba', num: 3,
    buyerName: 'Klaus M\u00fcller',    country: 'Greece', city: 'Athens',
    neighbourhood: 'Kolonaki',          propertyType: 'Apartment',
    minBeds: 3, maxBeds: 4,             minArea: 200,
    minPrice: 600000, maxPrice: 1200000, status: 'pending', date: '2026-01-15',
    comments: 'Investment property in central Athens. Interested in income-producing assets with strong rental yield.'
  },
  {
    id: '11223344-5566-7788-99aa-bbccddeeff00', num: 4,
    buyerName: 'David & Rachel Levi',  country: 'Cyprus', city: 'Larnaca',
    neighbourhood: '',                  propertyType: 'Villa',
    minBeds: 3, maxBeds: 5,             minArea: 250,
    minPrice: 400000, maxPrice: 750000, status: 'pending', date: '2026-01-28',
    comments: 'Family relocation from Israel. Need villa with private garden and pool, good schools nearby.'
  },
  {
    id: '99887766-5544-3322-1100-ffeeddccbbaa', num: 5,
    buyerName: 'Anna Bergstr\u00f6m', country: 'Greece', city: 'Mykonos',
    neighbourhood: 'Ornos',             propertyType: 'Villa',
    minBeds: 2, maxBeds: 3,             minArea: 150,
    minPrice: 800000, maxPrice: 1500000, status: 'rejected', date: '2025-11-20',
    comments: 'Luxury holiday home with sea view and private pool. Off-plan considered if delivery within 18 months.'
  }
];

const _MOCK_PROPERTIES = [
  { id:'p1', name:'Delightful 6BR Villa in Tala',   type:'Villa',     city:'Paphos',   country:'Cyprus', address:'Tala Village',    zip:'8260', dealType:'Sale', investment:'Yes', status:'Approved', price:null,    minPrice:1200000, maxPrice:null, commission:null,   minBeds:6, maxBeds:6, plotArea:'850 m\u00b2', coveredArea:'420 m\u00b2' },
  { id:'p2', name:'Sunset View Residence Tala',     type:'Villa',     city:'Paphos',   country:'Cyprus', address:'Tala Village',    zip:'8260', dealType:'Sale', investment:'Yes', status:'Approved', price:null,    minPrice:890000,  maxPrice:null, commission:'2%',   minBeds:4, maxBeds:4, plotArea:'650 m\u00b2', coveredArea:'320 m\u00b2' },
  { id:'p3', name:'4BR Tala Seaview Home',          type:'Villa',     city:'Paphos',   country:'Cyprus', address:'Tala Sea Caves',  zip:'8260', dealType:'Sale', investment:'No',  status:'Approved', price:750000,  minPrice:null,    maxPrice:null, commission:'2%',   minBeds:4, maxBeds:4, plotArea:'580 m\u00b2', coveredArea:'280 m\u00b2' },
  { id:'p4', name:'4BR Seaview Villa in Tala',      type:'Villa',     city:'Paphos',   country:'Cyprus', address:'Tala',            zip:'8266', dealType:'Sale', investment:'Yes', status:'Approved', price:820000,  minPrice:null,    maxPrice:null, commission:'2%',   minBeds:4, maxBeds:4, plotArea:'600 m\u00b2', coveredArea:'310 m\u00b2' },
  { id:'p5', name:'Luxury Bedroom Renovated Villa', type:'Villa',     city:'Paphos',   country:'Cyprus', address:'N/A',             zip:'8260', dealType:'Sale', investment:'Yes', status:'Approved', price:null,    minPrice:1050000, maxPrice:null, commission:null,   minBeds:5, maxBeds:5, plotArea:'N/A',         coveredArea:'N/A'         },
  { id:'p6', name:'Modern 3BR Apartment Limassol',  type:'Apartment', city:'Limassol', country:'Cyprus', address:'Germasogeia',     zip:'3101', dealType:'Sale', investment:'Yes', status:'Approved', price:450000,  minPrice:null,    maxPrice:null, commission:'2%',   minBeds:3, maxBeds:3, plotArea:'N/A',         coveredArea:'165 m\u00b2' },
  { id:'p7', name:'Seafront Penthouse Limassol',    type:'Apartment', city:'Limassol', country:'Cyprus', address:'Molos Promenade', zip:'3030', dealType:'Sale', investment:'Yes', status:'Approved', price:2100000, minPrice:null,    maxPrice:null, commission:'1.5%', minBeds:4, maxBeds:4, plotArea:'N/A',         coveredArea:'380 m\u00b2' },
  { id:'p8', name:'Classic Athenian Apartment',     type:'Apartment', city:'Athens',   country:'Greece', address:'Kolonaki',        zip:'10676',dealType:'Sale', investment:'Yes', status:'Approved', price:680000,  minPrice:null,    maxPrice:null, commission:'2%',   minBeds:3, maxBeds:3, plotArea:'N/A',         coveredArea:'195 m\u00b2' }
];

// ── CUSTOM ELEMENT ────────────────────────────────────────────

class BuyRequestsDashboard extends HTMLElement {

  constructor() {
    super();
    // State
    this._requests   = _MOCK_REQUESTS.slice();
    this._properties = _MOCK_PROPERTIES.slice();
    this._countries  = [];         // [{isoCode, name}] from csc.web.js
    this._citiesMap  = {};         // { isoCode: [{name, ...}] }
    this._activeId   = null;       // active request id (view / edit / assign)
    this._selected   = new Set();  // selected property ids in assign modal
    this._reqPage    = 1;
    this._REQ_PER_PAGE = 10;
    this._propPage   = 1;
    this._propQuery  = '';
    this._openDetId  = null;       // expanded detail row in assign modal
    this._PER_PAGE   = 5;
    this._toastTimer = null;
    this._debounce   = null;
    this._connected  = false;
  }

  // ── Wix communication (Phase 2 hooks) ────────────────────

  static get observedAttributes() {
    return ['requests', 'properties', 'username', 'initials', 'countries', 'citiesmap'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._connected || oldValue === newValue) return;

    if (name === 'requests' && newValue) {
      try {
        this._requests = JSON.parse(newValue);
        console.log('[BRD] requests received:', this._requests.length, 'items');
        if (this._requests.length) console.log('[BRD] first record sample:', JSON.stringify(this._requests[0]));
        this._renderRequests();
      } catch (e) { console.error('[BRD] invalid requests JSON', e); }
    }

    if (name === 'properties' && newValue) {
      try {
        this._properties = JSON.parse(newValue);
        console.log('[BRD] properties received:', this._properties.length, 'items');
      } catch (e) { console.error('[BRD] invalid properties JSON', e); }
    }

    if (name === 'username' && newValue) {
      const el = this.qs('.atb-uname');
      if (el) el.textContent = newValue;
    }

    if (name === 'initials' && newValue) {
      const el = this.qs('.atb-avatar');
      if (el) el.textContent = newValue.substring(0, 2).toUpperCase();
    }

    if (name === 'countries' && newValue) {
      try {
        this._countries = JSON.parse(newValue);
        console.log('[BRD] countries received:', this._countries.map(c => c.isoCode + ':' + c.name).join(', '));
        this._populateCountrySelect();
      } catch (e) { console.error('[BRD] invalid countries JSON', e); }
    }

    if (name === 'citiesmap' && newValue) {
      try {
        this._citiesMap = JSON.parse(newValue);
        const counts = Object.entries(this._citiesMap).map(([k,v]) => k + ':' + v.length).join(', ');
        console.log('[BRD] citiesmap received:', counts);
      } catch (e) { console.error('[BRD] invalid citiesmap JSON', e); }
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────

  connectedCallback() {
    this._injectFonts();
    this._injectStyles();
    this._buildDOM();
    this._setupListeners();
    this._connected = true;
    console.log('[BRD] connectedCallback complete — _connected now true');

    // Safety net: if setAttribute was called before connectedCallback fired,
    // the _connected guard would have blocked it. Re-read those attrs now.
    const earlyReqs   = this.getAttribute('requests');
    const earlyProps  = this.getAttribute('properties');
    const earlyCtries = this.getAttribute('countries');
    const earlyCities = this.getAttribute('citiesmap');
    if (earlyReqs)   { console.log('[BRD] re-processing early requests attr'); try { this._requests   = JSON.parse(earlyReqs);   } catch(e){ console.error('[BRD] early requests parse error', e); } }
    if (earlyProps)  { console.log('[BRD] re-processing early properties attr'); try { this._properties = JSON.parse(earlyProps);  } catch(e){ console.error('[BRD] early properties parse error', e); } }
    if (earlyCtries) { console.log('[BRD] re-processing early countries attr'); try { this._countries  = JSON.parse(earlyCtries); } catch(e){ console.error('[BRD] early countries parse error', e); } }
    if (earlyCities) { console.log('[BRD] re-processing early citiesmap attr'); try { this._citiesMap  = JSON.parse(earlyCities); } catch(e){ console.error('[BRD] early citiesmap parse error', e); } }

    this._renderRequestsWithSkeleton(700);
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
    const label = st.charAt(0).toUpperCase() + st.slice(1);
    return `<span class="s-badge ${map[st] || ''}">${label}</span>`;
  }

  _priceRange(r) {
    const mn = this._fmtEur(r.minPrice), mx = this._fmtEur(r.maxPrice);
    if (mn && mx) return `${mn} \u2013 ${mx}`;
    if (mx)       return `Up to ${mx}`;
    if (mn)       return `From ${mn}`;
    return '\u2014';
  }

  // ── Toast ─────────────────────────────────────────────────

  _toast(msg, type) {
    const el = this.qs('#brd-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'brd-toast' + (type ? ' brd-toast-' + type : '');
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  // ── Modal helpers ─────────────────────────────────────────

  _openModal(id)  { this.qs('#' + id)?.classList.add('open'); }
  _closeModal(id) { this.qs('#' + id)?.classList.remove('open'); }

  // ── Skeleton builders ─────────────────────────────────────

  _skReqRow(n) {
    return `<tr class="sk-row-${n}">
      <td><div class="sk sk-line sk-w60" style="margin-bottom:7px"></div><div class="sk sk-line-sm sk-w35"></div></td>
      <td class="col-loc"><div class="sk sk-line-sm sk-w25" style="margin-bottom:7px"></div><div class="sk sk-line sk-w45"></div></td>
      <td class="col-price"><div class="sk sk-line sk-w50"></div></td>
      <td><div class="sk sk-badge"></div></td>
      <td><div class="sk sk-line sk-w40"></div></td>
      <td><div class="sk sk-btn" style="margin-bottom:8px"></div><div class="sk sk-btn"></div></td>
    </tr>`;
  }

  _skPropRow(n) {
    return `<tr class="sk-row-${n}">
      <td><div class="sk sk-chk"></div></td>
      <td><div class="sk sk-line sk-w70"></div></td>
      <td><div class="sk sk-line sk-w40"></div></td>
      <td><div class="sk sk-line sk-w40"></div></td>
      <td style="text-align:right"><div class="sk sk-btn" style="margin-left:auto"></div></td>
    </tr>`;
  }

  _renderSkeletonRequests(count) {
    this.qs('#reqTbody').innerHTML = Array.from({ length: count }, (_, i) => this._skReqRow(i + 1)).join('');
  }

  _renderSkeletonProps(count) {
    this.qs('#propTbody').innerHTML = Array.from({ length: count }, (_, i) => this._skPropRow(i + 1)).join('');
  }

  _renderSkeletonViewModal() {
    const widths = [70, 80, 60, 90, 65, 75, 55, 80, 45, 70];
    this.qs('#vmodInfoGrid').innerHTML = Array.from({ length: 10 }, (_, i) =>
      `<div class="icard sk-row-${(i % 5) + 1}">
        <div class="sk sk-card-lbl sk-w35"></div>
        <div class="sk sk-card-val sk-w${widths[i]}"></div>
      </div>`
    ).join('');
    this.qs('#vmodComments').innerHTML = `
      <div class="sk sk-line sk-w100" style="margin-bottom:8px"></div>
      <div class="sk sk-line sk-w80" style="margin-bottom:8px"></div>
      <div class="sk sk-line sk-w55"></div>`;
    this.qs('#btnApprove').disabled = true;
    this.qs('#btnReject').disabled  = true;
    this.qs('#btnEditReq').disabled = true;
  }

  // ── Requests table ────────────────────────────────────────

  _getFilteredRequests() {
    const sv = this.qs('#statusFilter').value;
    const qv = this.qs('#reqSearch').value.trim().toLowerCase();
    return this._requests.filter(r => {
      if (sv && r.status !== sv) return false;
      if (qv) {
        const hay = [r.buyerName, r.city, r.country, r.propertyType, r.neighbourhood].join(' ').toLowerCase();
        if (!hay.includes(qv)) return false;
      }
      return true;
    });
  }

  _renderRequests() {
    const tbody = this.qs('#reqTbody');
    const list  = this._getFilteredRequests();

    // ── Pagination controls
    console.log('[BRD] _renderRequests: filtered', list.length, 'items | page', this._reqPage, '| perPage', this._REQ_PER_PAGE);
    const total = Math.max(1, Math.ceil(list.length / this._REQ_PER_PAGE));
    if (this._reqPage > total) this._reqPage = total;

    const pagPrev  = this.qs('#reqPagPrev');
    const pagNext  = this.qs('#reqPagNext');
    const pagInput = this.qs('#reqPagInput');
    const pagTotal = this.qs('#reqPagTotal');
    const pagInfo  = this.qs('#reqPagInfo');

    if (pagTotal) pagTotal.textContent = total;
    if (pagInput) { pagInput.value = this._reqPage; pagInput.max = total; }
    if (pagPrev)  pagPrev.disabled  = this._reqPage <= 1;
    if (pagNext)  pagNext.disabled  = this._reqPage >= total;
    if (pagInfo)  pagInfo.textContent = list.length ? `${list.length} result${list.length !== 1 ? 's' : ''}` : '';

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="tbl-empty">
        No requests found.<p>Try adjusting the filter or search term.</p>
      </td></tr>`;
      return;
    }

    const slice = list.slice((this._reqPage - 1) * this._REQ_PER_PAGE, this._reqPage * this._REQ_PER_PAGE);

    tbody.innerHTML = slice.map(r => {
      const beds = r.minBeds === r.maxBeds ? `${r.minBeds} bed` : `${r.minBeds}\u2013${r.maxBeds} bed`;
      return `<tr>
        <td>
          <div class="buyer-name">${r.buyerName}</div>
          <div class="buyer-sub">${r.propertyType} &middot; ${beds}</div>
        </td>
        <td class="col-loc">
          <div class="loc-country">${r.country}</div>
          <div class="loc-city">${r.city}${r.neighbourhood ? ', ' + r.neighbourhood : ''}</div>
        </td>
        <td class="col-price"><div class="price-val">${this._priceRange(r)}</div></td>
        <td>${this._badgeHtml(r.status)}</td>
        <td class="req-date">${this._fmtDate(r.date)}</td>
        <td>
          <div class="row-acts">
            <button class="btn-row-view"   data-action="view"   data-id="${r.id}">View</button>
            <button class="btn-row-assign" data-action="assign" data-id="${r.id}">Assign</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    this.qsa('[data-action="view"]').forEach(btn =>
      btn.addEventListener('click', () => this._openViewModal(btn.dataset.id))
    );
    this.qsa('[data-action="assign"]').forEach(btn =>
      btn.addEventListener('click', () => this._openAssignModal(btn.dataset.id))
    );
  }

  _renderRequestsWithSkeleton(delay) {
    this._renderSkeletonRequests(5);
    setTimeout(() => this._renderRequests(), delay || 700);
  }

  // ── View modal ────────────────────────────────────────────

  _openViewModal(id) {
    const r = this._requests.find(x => x.id === id);
    if (!r) { console.warn('[BRD] _openViewModal: id not found:', id); return; }
    console.log('[BRD] _openViewModal:', JSON.stringify(r));
    this._activeId = id;
    this.qs('#vmodTitle').textContent = `Buy Request #${r.num} Details`;
    this._openModal('viewModal');
    this._renderSkeletonViewModal();
    setTimeout(() => this._fillViewModal(r), 550);
  }

  _fillViewModal(r) {
    const fields = [
      { label: 'Request ID',    val: r.id },
      { label: 'Cities',        val: r.city || '\u2014' },
      { label: 'Neighbourhood', val: r.neighbourhood || '' },
      { label: 'Property Type', val: r.propertyType || '\u2014' },
      { label: 'Rooms',         val: r.minBeds != null ? `${r.minBeds} \u2013 ${r.maxBeds}` : '' },
      { label: 'Minimum Area',  val: r.minArea ? `${r.minArea} m\u00b2` : '' },
      { label: 'Budget Range',  val: this._priceRange(r) },
      { label: 'Status',        html: this._badgeHtml(r.status) },
      { label: 'Created Date',  val: this._fmtDate(r.date) },
      { label: 'Country',       val: r.country || '\u2014' }
    ];

    this.qs('#vmodInfoGrid').innerHTML = fields.map(f => {
      const content = f.html ? f.html : (f.val ? f.val : '<span class="icard-val-empty">\u2014</span>');
      return `<div class="icard">
        <div class="icard-label">${f.label}</div>
        <div class="icard-val">${content}</div>
      </div>`;
    }).join('');

    this.qs('#vmodComments').textContent = r.comments || '\u2014';
    this.qs('#btnApprove').disabled = (r.status === 'approved');
    this.qs('#btnReject').disabled  = (r.status === 'rejected');
    this.qs('#btnEditReq').disabled = false;
  }

  _changeStatus(newStatus) {
    const r = this._requests.find(x => x.id === this._activeId);
    if (!r) return;
    r.status = newStatus;
    this._renderRequests();
    this._openViewModal(this._activeId);
    this._toast(`Request ${newStatus}.`, 'success');
    this.dispatchEvent(new CustomEvent('statusChange', {
      detail: { id: this._activeId, status: newStatus }
    }));
  }

  // ── Edit modal ────────────────────────────────────────────

  _openEditModal(id) {
    const r = this._requests.find(x => x.id === id);
    if (!r) return;
    this._activeId = id;
    this._closeModal('viewModal');
    this.qs('#emodTitle').textContent = `Edit Buy Request #${r.num}`;
    this._clearEditErrors();
    this._fillEditForm(r);
    this._openModal('editModal');
    // Focus first input after modal opens
    setTimeout(() => this.qs('#ef-buyerName')?.focus(), 60);
  }

  _fillEditForm(r) {
    const set = (id, val) => {
      const el = this.qs('#' + id);
      if (el) el.value = (val != null && val !== '') ? val : '';
    };

    // Resolve isoCode from stored country value.
    // Handles legacy isoCode records ("CY") and correct name records ("Cyprus").
    const isoCode =
      this._countries.find(c => c.isoCode === r.country)?.isoCode  // legacy: "CY"
      || this._countries.find(c => c.name  === r.country)?.isoCode  // correct: "Cyprus"
      || '';
    this._populateCountrySelect(isoCode);
    this._populateCitySelect(isoCode, r.city);

    set('ef-buyerName',     r.buyerName);
    set('ef-neighbourhood', r.neighbourhood);
    set('ef-propertyType',  r.propertyType);
    set('ef-minBeds',       r.minBeds);
    set('ef-maxBeds',       r.maxBeds);
    set('ef-minArea',       r.minArea);
    set('ef-minPrice',      r.minPrice);
    set('ef-maxPrice',      r.maxPrice);
    set('ef-status',        r.status);
    set('ef-date',          r.date);
    set('ef-comments',      r.comments);
  }

  _getEditFormData() {
    const get    = id => this.qs('#' + id)?.value ?? '';
    const getNum = id => { const v = get(id); return v === '' ? null : Number(v); };
    const r      = this._requests.find(x => x.id === this._activeId);

    return {
      id:            this._activeId,
      num:           r?.num,
      buyerName:     get('ef-buyerName').trim(),
      country:       (() => {
        const sel = this.qs('#ef-country');
        const txt = sel?.options[sel.selectedIndex]?.text || '';
        return txt.startsWith('—') ? '' : txt;  // save name e.g. "Cyprus"
      })(),
      city:          get('ef-city'),
      neighbourhood: get('ef-neighbourhood').trim(),
      propertyType:  get('ef-propertyType'),
      minBeds:       getNum('ef-minBeds'),
      maxBeds:       getNum('ef-maxBeds'),
      minArea:       getNum('ef-minArea'),
      minPrice:      getNum('ef-minPrice'),
      maxPrice:      getNum('ef-maxPrice'),
      status:        get('ef-status'),
      date:          get('ef-date'),
      comments:      get('ef-comments').trim()
    };
  }

  _validateEditForm(data) {
    const errors = {};
    if (!data.buyerName)  errors.buyerName = 'Buyer name is required';
    if (!data.country)    errors.country   = 'Country is required';
    if (!data.city)       errors.city      = 'City is required';
    if (data.minBeds !== null && data.minBeds < 1)  errors.minBeds = 'Must be at least 1';
    if (data.maxBeds !== null && data.maxBeds < 1)  errors.maxBeds = 'Must be at least 1';
    if (data.minBeds !== null && data.maxBeds !== null && data.maxBeds < data.minBeds)
      errors.maxBeds = 'Max must be \u2265 min bedrooms';
    if (data.minPrice != null && data.minPrice < 0) errors.minPrice = 'Must be \u2265 0';
    if (data.maxPrice != null && data.maxPrice < 0) errors.maxPrice = 'Must be \u2265 0';
    if (data.minPrice != null && data.maxPrice != null && data.maxPrice < data.minPrice)
      errors.maxPrice = 'Max must be \u2265 min price';
    return { valid: Object.keys(errors).length === 0, errors };
  }

  _clearEditErrors() {
    this.qsa('.eform-input.err, .eform-select.err, .eform-textarea.err')
        .forEach(el => el.classList.remove('err'));
    this.qsa('.eform-error').forEach(el => el.remove());
    const summary = this.qs('#eformErrSummary');
    if (summary) { summary.textContent = ''; summary.style.display = 'none'; }
  }

  _showEditErrors(errors) {
    const fieldIds = Object.keys(errors);
    fieldIds.forEach(field => {
      const inputEl = this.qs('#ef-' + field);
      if (!inputEl) return;
      inputEl.classList.add('err');
      const errEl = document.createElement('span');
      errEl.className = 'eform-error';
      errEl.textContent = errors[field];
      inputEl.parentNode.appendChild(errEl);
    });
    // Summary banner
    const summary = this.qs('#eformErrSummary');
    if (summary) {
      summary.textContent = `Please fix ${fieldIds.length} error${fieldIds.length > 1 ? 's' : ''} before saving.`;
      summary.style.display = 'block';
    }
    // Scroll to first problem field
    const firstErrEl = this.qs('.eform-input.err, .eform-select.err');
    if (firstErrEl) firstErrEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  _saveEdit() {
    this._clearEditErrors();
    const data = this._getEditFormData();
    const { valid, errors } = this._validateEditForm(data);

    if (!valid) {
      this._showEditErrors(errors);
      return;
    }

    // ── Show saving state
    const saveBtn = this.qs('#btnSaveReq');
    const origTxt = saveBtn.textContent;
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving\u2026';

    // ── Optimistic local update
    const idx = this._requests.findIndex(x => x.id === this._activeId);
    if (idx !== -1) this._requests[idx] = { ...this._requests[idx], ...data };

    // Simulate brief async (Phase 2: page code handles real persistence)
    setTimeout(() => {
      saveBtn.disabled    = false;
      saveBtn.textContent = origTxt;
      this._closeEditModal();
      this._renderRequests();
      this._toast('Request updated successfully.', 'success');

      // ── Phase 2: fire to Wix page code
      console.log('[BRD] saveRequest dispatched:', JSON.stringify(data));
      this.dispatchEvent(new CustomEvent('saveRequest', {
        bubbles: true,
        detail: { request: data }
      }));
    }, 480);
  }

  _closeEditModal() {
    this._closeModal('editModal');
    this._clearEditErrors();
  }

  // ── Country / City cascade ────────────────────────────────

  /**
   * Populate the country <select> from this._countries.
   * @param {string} [selectedIsoCode]  — pre-select this country
   */
  _populateCountrySelect(selectedIsoCode) {
    const sel = this.qs('#ef-country');
    if (!sel) return;
    if (!this._countries.length) {
      sel.innerHTML = '<option value="">Loading…</option>';
      return;
    }
    sel.innerHTML = this._countries.map(c =>
      `<option value="${c.isoCode}"${c.isoCode === selectedIsoCode ? ' selected' : ''}>${c.name}</option>`
    ).join('');
  }

  /**
   * Populate the city <select> for a given country isoCode.
   * @param {string} isoCode     — country code
   * @param {string} [currentCity] — pre-select this city name
   */
  _populateCitySelect(isoCode, currentCity) {
    const sel = this.qs('#ef-city');
    if (!sel) return;
    if (!isoCode) {
      sel.innerHTML = '<option value="">— Select Country First —</option>';
      return;
    }
    const cities = this._citiesMap[isoCode] || [];
    if (!cities.length) {
      sel.innerHTML = '<option value="">No cities available</option>';
      return;
    }
    sel.innerHTML = cities.map(c =>
      `<option value="${c.name}"${c.name === currentCity ? ' selected' : ''}>${c.name}</option>`
    ).join('');
  }

  // ── Assign modal ──────────────────────────────────────────

  _getFilteredProps() {
    const q = this._propQuery.toLowerCase();
    if (!q) return this._properties;
    return this._properties.filter(p =>
      [p.name, p.type, p.city, p.country].join(' ').toLowerCase().includes(q)
    );
  }

  _detLine(k, v) {
    const val = (v != null && v !== '') ? v : 'N/A';
    return `<div class="det-line"><span class="det-k">${k}</span><span class="det-v">${val}</span></div>`;
  }

  _renderProperties() {
    const list  = this._getFilteredProps();
    const total = Math.max(1, Math.ceil(list.length / this._PER_PAGE));
    if (this._propPage > total) this._propPage = total;

    this.qs('#pagTotal').textContent = total;
    this.qs('#pagInput').value       = this._propPage;
    this.qs('#pagInput').max         = total;
    this.qs('#pagPrev').disabled     = this._propPage <= 1;
    this.qs('#pagNext').disabled     = this._propPage >= total;

    const slice = list.slice((this._propPage - 1) * this._PER_PAGE, this._propPage * this._PER_PAGE);
    const tbody = this.qs('#propTbody');

    if (!slice.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="tbl-empty">No properties match your search.</td></tr>`;
      return;
    }

    tbody.innerHTML = slice.map(p => {
      const chk = this._selected.has(p.id) ? 'checked' : '';
      return `
        <tr class="prop-row" id="prow-${p.id}">
          <td><input type="checkbox" class="prop-chk" ${chk} data-propid="${p.id}" aria-label="Select ${p.name}"></td>
          <td class="prop-nm">${p.name}</td>
          <td class="prop-ty">${p.type}</td>
          <td class="prop-cy">${p.city}</td>
          <td class="td-act">
            <button class="btn-show-det" data-propid="${p.id}" aria-expanded="false">Show Details</button>
          </td>
        </tr>
        <tr class="det-row" id="drow-${p.id}">
          <td class="det-cell" colspan="5">
            <div class="det-inner">
              <div class="det-section">
                <div class="det-sec-title">Location</div>
                ${this._detLine('Country', p.country)}
                ${this._detLine('City', p.city)}
                ${this._detLine('Address', p.address)}
                ${this._detLine('Zip Code', p.zip)}
              </div>
              <div class="det-section">
                <div class="det-sec-title">Property Details</div>
                ${this._detLine('Type', p.type)}
                ${this._detLine('Deal Type', p.dealType)}
                ${this._detLine('Investment', p.investment)}
                ${this._detLine('Status', p.status)}
              </div>
              <div class="det-section">
                <div class="det-sec-title">Pricing</div>
                ${this._detLine('Price',     p.price    ? this._fmtEur(p.price)    : null)}
                ${this._detLine('Min Price', p.minPrice ? this._fmtEur(p.minPrice) : null)}
                ${this._detLine('Max Price', p.maxPrice ? this._fmtEur(p.maxPrice) : null)}
                ${this._detLine('Commission', p.commission)}
              </div>
              <div class="det-section">
                <div class="det-sec-title">Specifications</div>
                ${this._detLine('Min Bedrooms', p.minBeds)}
                ${this._detLine('Max Bedrooms', p.maxBeds)}
                ${this._detLine('Plot Area', p.plotArea)}
                ${this._detLine('Covered Area', p.coveredArea)}
              </div>
            </div>
          </td>
        </tr>`;
    }).join('');

    this.qsa('.prop-chk').forEach(chk =>
      chk.addEventListener('change', () => {
        if (chk.checked) this._selected.add(chk.dataset.propid);
        else             this._selected.delete(chk.dataset.propid);
        this._updateSelInfo();
      })
    );

    this.qsa('.btn-show-det').forEach(btn =>
      btn.addEventListener('click', () => this._toggleDetails(btn.dataset.propid, btn))
    );

    this._updateSelInfo();
  }

  _renderPropertiesWithSkeleton(delay) {
    this._renderSkeletonProps(5);
    setTimeout(() => this._renderProperties(), delay || 550);
  }

  _toggleDetails(propId, btn) {
    if (this._openDetId && this._openDetId !== propId) {
      const prevRow = this.qs('#drow-' + this._openDetId);
      const prevBtn = this.qs('#prow-' + this._openDetId + ' .btn-show-det');
      if (prevRow) prevRow.classList.remove('det-open');
      if (prevBtn) {
        prevBtn.classList.remove('det-open');
        prevBtn.textContent = 'Show Details';
        prevBtn.setAttribute('aria-expanded', 'false');
      }
    }
    const row    = this.qs('#drow-' + propId);
    if (!row) return;
    const isOpen = row.classList.toggle('det-open');
    btn.classList.toggle('det-open', isOpen);
    btn.textContent = isOpen ? 'Hide Details' : 'Show Details';
    btn.setAttribute('aria-expanded', String(isOpen));
    this._openDetId = isOpen ? propId : null;
  }

  _updateSelInfo() {
    const n = this._selected.size;
    this.qs('#selInfo').textContent = n > 0 ? `${n} propert${n === 1 ? 'y' : 'ies'} selected` : '';
    this.qs('#btnAssignNow').disabled = (n === 0);
  }

  _openAssignModal(reqId) {
    this._activeId    = reqId;
    this._selected.clear();
    this._propPage    = 1;
    this._propQuery   = '';
    this._openDetId   = null;
    this.qs('#propSearch').value = '';
    this._openModal('assignModal');
    this._renderPropertiesWithSkeleton(600);
  }

  _closeAssignModal() {
    this._closeModal('assignModal');
    this._selected.clear();
  }

  // ── DOM construction ──────────────────────────────────────

  _buildDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'brd-root';
    wrap.innerHTML = this._html();
    this.appendChild(wrap);

    const uname = this.getAttribute('username');
    const init  = this.getAttribute('initials');
    if (uname) this.qs('.atb-uname').textContent = uname;
    if (init)  this.qs('.atb-avatar').textContent = init.substring(0, 2).toUpperCase();
  }

  _html() {
    return /* html */ `
      <!-- ╔═ ADMIN TOPBAR ═══════════════════════════════╗ -->
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
            <span class="atb-crumb-current">Buy Requests</span>
          </nav>
          <div class="atb-right">
            <div class="atb-notif" role="button" tabindex="0" aria-label="Notifications" title="Notifications">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

      <!-- ╔═ MAIN CONTENT ════════════════════════════════╗ -->
      <main class="admin-page">
        <div class="brd-container">
          <div class="admin-title-card">
            <h1>Buy Requests</h1>
          </div>
          <div class="admin-panel">
            <div class="panel-hd">
              <span class="panel-hd-title">Buy Requests Management</span>
              <select class="ctl ctl-select" id="statusFilter" aria-label="Filter by status">
                <option value="">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
              <input type="text" class="ctl ctl-input" id="reqSearch"
                     placeholder="Search requests&#8230;" aria-label="Search requests">
              <button class="brd-btn brd-btn-sm brd-btn-secondary" id="btnReset">Reset</button>
            </div>
            <table class="req-table" aria-label="Buy requests">
              <thead>
                <tr>
                  <th>Request Details</th>
                  <th class="col-loc">Location</th>
                  <th class="col-price">Price Range</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="reqTbody"></tbody>
            </table>

            <!-- Requests pagination -->
            <div class="req-pag" id="reqPag">
              <button class="pag-btn" id="reqPagPrev" aria-label="Previous page">&#8249;</button>
              <input  type="number"   class="pag-inp" id="reqPagInput" value="1" min="1" aria-label="Page number">
              <span>/ <span id="reqPagTotal">1</span></span>
              <button class="pag-btn" id="reqPagNext" aria-label="Next page">&#8250;</button>
              <span class="req-pag-info" id="reqPagInfo"></span>
            </div>

          </div>
        </div>
      </main>

      <!-- ╔═ VIEW MODAL ═══════════════════════════════════╗ -->
      <div class="modal-overlay" id="viewModal" role="dialog" aria-modal="true" aria-labelledby="vmodTitle">
        <div class="modal modal-lg">
          <button class="modal-close" id="viewModalClose" aria-label="Close">&times;</button>
          <h2 class="vmod-title" id="vmodTitle">Buy Request Details</h2>
          <div class="vmod-rule"></div>
          <div class="info-grid" id="vmodInfoGrid"></div>
          <div class="comments-box">
            <div class="comments-lbl">Comments</div>
            <div class="comments-txt" id="vmodComments"></div>
          </div>
          <div class="vmod-actions">
            <button class="btn-approve"  id="btnApprove">Approve Request</button>
            <button class="btn-reject"   id="btnReject">Reject Request</button>
            <button class="btn-edit-req" id="btnEditReq">Edit Request</button>
          </div>
        </div>
      </div>

      <!-- ╔═ EDIT MODAL ═══════════════════════════════════╗ -->
      <div class="modal-overlay" id="editModal" role="dialog" aria-modal="true" aria-labelledby="emodTitle">
        <div class="modal modal-edit">

          <button class="modal-close" id="editModalClose" aria-label="Close">&times;</button>

          <!-- Fixed header -->
          <div class="emod-header">
            <button class="emod-back" id="btnBackToView" type="button">&#8592; Back to Details</button>
            <h2 class="emod-title" id="emodTitle">Edit Buy Request</h2>
            <div class="emod-rule"></div>
          </div>

          <!-- Scrollable form body -->
          <div class="emod-body">

            <!-- Error summary banner -->
            <div class="eform-err-summary" id="eformErrSummary" style="display:none" role="alert"></div>

            <!-- ── SECTION: Buyer Information -->
            <div class="eform-section">
              <div class="eform-sec-title">Buyer Information</div>
              <div class="eform-row">
                <div class="eform-field eform-full">
                  <label class="eform-label" for="ef-buyerName">Buyer Name <span class="req-star">*</span></label>
                  <input type="text" id="ef-buyerName" class="eform-input" placeholder="Full name or couple name" autocomplete="off">
                </div>
              </div>
            </div>

            <!-- ── SECTION: Location -->
            <div class="eform-section">
              <div class="eform-sec-title">Location</div>
              <div class="eform-row">
                <div class="eform-field">
                  <label class="eform-label" for="ef-country">Country <span class="req-star">*</span></label>
                  <select id="ef-country" class="eform-select">
                    <option value="">— Select Country —</option>
                  </select>
                </div>
                <div class="eform-field">
                  <label class="eform-label" for="ef-city">City <span class="req-star">*</span></label>
                  <select id="ef-city" class="eform-select">
                    <option value="">— Select Country First —</option>
                  </select>
                </div>
              </div>
              <div class="eform-row">
                <div class="eform-field eform-full">
                  <label class="eform-label" for="ef-neighbourhood">Neighbourhood <span class="eform-opt">(optional)</span></label>
                  <input type="text" id="ef-neighbourhood" class="eform-input" placeholder="e.g. Germasogeia" autocomplete="off">
                </div>
              </div>
            </div>

            <!-- ── SECTION: Property Preferences -->
            <div class="eform-section">
              <div class="eform-sec-title">Property Preferences</div>
              <div class="eform-row">
                <div class="eform-field">
                  <label class="eform-label" for="ef-propertyType">Property Type</label>
                  <select id="ef-propertyType" class="eform-select">
                    <option value="Detached House">Detached House</option>
                    <option value="Apartment">Apartment</option>
                    <option value="Villa">Villa</option>
                    <option value="Hotel">Hotel</option>
                    <option value="Plot">Plot</option>
                    <option value="Office Building">Office Building</option>
                    <option value="Shop">Shop</option>
                  </select>
                </div>
                <div class="eform-field">
                  <label class="eform-label" for="ef-minArea">Minimum Area <span class="eform-unit">m²</span></label>
                  <input type="number" id="ef-minArea" class="eform-input" placeholder="e.g. 120" min="0">
                </div>
              </div>
              <div class="eform-row">
                <div class="eform-field">
                  <label class="eform-label" for="ef-minBeds">Min Bedrooms <span class="req-star">*</span></label>
                  <input type="number" id="ef-minBeds" class="eform-input" placeholder="e.g. 2" min="1" max="20">
                </div>
                <div class="eform-field">
                  <label class="eform-label" for="ef-maxBeds">Max Bedrooms <span class="req-star">*</span></label>
                  <input type="number" id="ef-maxBeds" class="eform-input" placeholder="e.g. 4" min="1" max="20">
                </div>
              </div>
            </div>

            <!-- ── SECTION: Budget -->
            <div class="eform-section">
              <div class="eform-sec-title">Budget</div>
              <div class="eform-row">
                <div class="eform-field">
                  <label class="eform-label" for="ef-minPrice">Min Price <span class="eform-unit eform-opt">&euro; (optional)</span></label>
                  <input type="number" id="ef-minPrice" class="eform-input" placeholder="e.g. 300000" min="0" step="1000">
                </div>
                <div class="eform-field">
                  <label class="eform-label" for="ef-maxPrice">Max Price <span class="eform-unit eform-opt">&euro; (optional)</span></label>
                  <input type="number" id="ef-maxPrice" class="eform-input" placeholder="e.g. 750000" min="0" step="1000">
                </div>
              </div>
            </div>

            <!-- ── SECTION: Request Details -->
            <div class="eform-section">
              <div class="eform-sec-title">Request Details</div>
              <div class="eform-row">
                <div class="eform-field">
                  <label class="eform-label" for="ef-status">Status</label>
                  <select id="ef-status" class="eform-select">
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div class="eform-field">
                  <label class="eform-label" for="ef-date">Request Date</label>
                  <input type="date" id="ef-date" class="eform-input">
                </div>
              </div>
            </div>

            <!-- ── SECTION: Comments -->
            <div class="eform-section">
              <div class="eform-sec-title">Comments &amp; Notes</div>
              <div class="eform-row">
                <div class="eform-field eform-full">
                  <label class="eform-label" for="ef-comments">Comments <span class="eform-opt">(optional)</span></label>
                  <textarea id="ef-comments" class="eform-textarea" rows="4"
                            placeholder="Buyer preferences, special requirements, notes&#8230;"></textarea>
                </div>
              </div>
            </div>

          </div><!-- /emod-body -->

          <!-- Fixed footer -->
          <div class="emod-footer">
            <button class="btn-save-req"    id="btnSaveReq">Save Changes</button>
            <button class="btn-cancel-edit" id="btnCancelEdit" type="button">Cancel</button>
          </div>

        </div>
      </div>

      <!-- ╔═ ASSIGN MODAL ═════════════════════════════════╗ -->
      <div class="modal-overlay" id="assignModal" role="dialog" aria-modal="true" aria-labelledby="amodTitle">
        <div class="modal modal-xl">
          <button class="modal-close" id="assignModalClose" aria-label="Close">&times;</button>
          <h2 class="amod-title" id="amodTitle">Assign Properties</h2>
          <div class="amod-rule"></div>
          <div class="asearch-lbl">Search Properties</div>
          <div class="asearch-row">
            <input type="text" class="asearch-input" id="propSearch"
                   placeholder="Search by name, city or type&#8230;" aria-label="Search properties">
            <button class="brd-btn brd-btn-sm brd-btn-primary"   id="btnPropSearch">Search</button>
            <button class="brd-btn brd-btn-sm brd-btn-secondary" id="btnPropReset">Reset</button>
          </div>
          <table class="prop-table" aria-label="Available properties">
            <thead>
              <tr>
                <th class="th-chk"></th>
                <th>Property Name</th>
                <th>Property Type</th>
                <th>State / City</th>
                <th class="th-act">Details</th>
              </tr>
            </thead>
            <tbody id="propTbody"></tbody>
          </table>
          <div class="apag">
            <button class="pag-btn" id="pagPrev" aria-label="Previous page">&#8249;</button>
            <input  type="number"   class="pag-inp" id="pagInput" value="1" min="1" aria-label="Page number">
            <span>/ <span id="pagTotal">1</span></span>
            <button class="pag-btn" id="pagNext" aria-label="Next page">&#8250;</button>
          </div>
          <p class="sel-info" id="selInfo" aria-live="polite"></p>
          <div class="assign-footer">
            <button class="btn-assign-now" id="btnAssignNow" disabled>Assign Now</button>
          </div>
        </div>
      </div>

      <!-- ╔═ TOAST ════════════════════════════════════════╗ -->
      <div class="brd-toast" id="brd-toast" role="status" aria-live="polite"></div>
    `;
  }

  // ── Event wiring ──────────────────────────────────────────

  _setupListeners() {
    // ── Requests toolbar
    this.qs('#statusFilter').addEventListener('change', () => { this._reqPage = 1; this._renderRequestsWithSkeleton(300); });

    this.qs('#reqSearch').addEventListener('input', () => {
      clearTimeout(this._debounce);
      this._renderSkeletonRequests(5);
      this._reqPage = 1;
      this._debounce = setTimeout(() => this._renderRequests(), 350);
    });

    this.qs('#btnReset').addEventListener('click', () => {
      this.qs('#statusFilter').value = '';
      this.qs('#reqSearch').value    = '';
      this._reqPage = 1;
      this._renderRequestsWithSkeleton(400);
    });

    // ── Requests pagination
    this.qs('#reqPagPrev').addEventListener('click', () => {
      if (this._reqPage > 1) { this._reqPage--; this._renderRequests(); }
    });
    this.qs('#reqPagNext').addEventListener('click', () => {
      const total = Math.ceil(this._getFilteredRequests().length / this._REQ_PER_PAGE);
      if (this._reqPage < total) { this._reqPage++; this._renderRequests(); }
    });
    this.qs('#reqPagInput').addEventListener('change', () => {
      const total = Math.ceil(this._getFilteredRequests().length / this._REQ_PER_PAGE);
      this._reqPage = Math.max(1, Math.min(parseInt(this.qs('#reqPagInput').value) || 1, total));
      this._renderRequests();
    });

    // ── View modal
    this.qs('#viewModalClose').addEventListener('click', () => this._closeModal('viewModal'));
    this.qs('#viewModal').addEventListener('click', e => {
      if (e.target.id === 'viewModal') this._closeModal('viewModal');
    });
    this.qs('#btnApprove').addEventListener('click', () => this._changeStatus('approved'));
    this.qs('#btnReject').addEventListener('click',  () => this._changeStatus('rejected'));
    this.qs('#btnEditReq').addEventListener('click', () => this._openEditModal(this._activeId));

    // ── Edit modal
    this.qs('#editModalClose').addEventListener('click', () => this._closeEditModal());
    this.qs('#editModal').addEventListener('click', e => {
      if (e.target.id === 'editModal') this._closeEditModal();
    });
    this.qs('#btnBackToView').addEventListener('click', () => {
      this._closeEditModal();
      this._openViewModal(this._activeId);
    });
    this.qs('#btnSaveReq').addEventListener('click',    () => this._saveEdit());
    this.qs('#btnCancelEdit').addEventListener('click', () => this._closeEditModal());

    // Clear field errors on input (text fields)
    ['ef-buyerName','ef-minBeds','ef-maxBeds','ef-minPrice','ef-maxPrice'].forEach(id => {
      const el = this.qs('#' + id);
      if (!el) return;
      el.addEventListener('input', () => {
        el.classList.remove('err');
        const errMsg = el.parentNode.querySelector('.eform-error');
        if (errMsg) errMsg.remove();
      });
    });

    // Country change → reload cities cascade
    this.qs('#ef-country').addEventListener('change', () => {
      const cSel = this.qs('#ef-country');
      cSel.classList.remove('err');
      const errMsg = cSel.parentNode.querySelector('.eform-error');
      if (errMsg) errMsg.remove();
      this._populateCitySelect(cSel.value, '');
    });

    // City change → clear error
    this.qs('#ef-city').addEventListener('change', () => {
      const citySel = this.qs('#ef-city');
      citySel.classList.remove('err');
      const errMsg = citySel.parentNode.querySelector('.eform-error');
      if (errMsg) errMsg.remove();
    });

    // ── Assign modal
    this.qs('#assignModalClose').addEventListener('click', () => this._closeAssignModal());
    this.qs('#assignModal').addEventListener('click', e => {
      if (e.target.id === 'assignModal') this._closeAssignModal();
    });

    const doSearch = () => {
      this._propQuery = this.qs('#propSearch').value.trim();
      this._propPage  = 1;
      this._openDetId = null;
      this._renderPropertiesWithSkeleton(400);
    };
    this.qs('#btnPropSearch').addEventListener('click', doSearch);
    this.qs('#propSearch').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

    this.qs('#btnPropReset').addEventListener('click', () => {
      this._propQuery = '';
      this._propPage  = 1;
      this._openDetId = null;
      this.qs('#propSearch').value = '';
      this._renderPropertiesWithSkeleton(400);
    });

    this.qs('#pagPrev').addEventListener('click', () => {
      if (this._propPage > 1) {
        this._propPage--;
        this._openDetId = null;
        this._renderPropertiesWithSkeleton(300);
      }
    });

    this.qs('#pagNext').addEventListener('click', () => {
      const total = Math.ceil(this._getFilteredProps().length / this._PER_PAGE);
      if (this._propPage < total) {
        this._propPage++;
        this._openDetId = null;
        this._renderPropertiesWithSkeleton(300);
      }
    });

    this.qs('#pagInput').addEventListener('change', () => {
      const total    = Math.ceil(this._getFilteredProps().length / this._PER_PAGE);
      this._propPage = Math.max(1, Math.min(parseInt(this.qs('#pagInput').value) || 1, total));
      this._openDetId = null;
      this._renderPropertiesWithSkeleton(300);
    });

    this.qs('#btnAssignNow').addEventListener('click', () => {
      const n           = this._selected.size;
      const selectedIds = Array.from(this._selected);

      // Enrich event with buyer info + property titles/urls so page code can send email
      const request      = this._requests.find(x => x.id === this._activeId);
      const propertyData = selectedIds.map(pid => {
        const p = this._properties.find(x => x.id === pid);
        return { id: pid, name: p?.name || '', url: p?.url || '' };
      });

      console.log('[BRD] assignProperties dispatching:', {
        requestId:   this._activeId,
        buyerEmail:  request?.email,
        properties:  propertyData.map(p => p.name)
      });

      this._toast(`${n} propert${n === 1 ? 'y' : 'ies'} successfully assigned.`, 'success');
      this._closeAssignModal();
      this.dispatchEvent(new CustomEvent('assignProperties', {
        detail: {
          requestId:    this._activeId,
          propertyIds:  selectedIds,
          propertyData,                      // [{id, name, url}]
          buyerName:    request?.buyerName || '',
          buyerEmail:   request?.email     || ''
        }
      }));
    });

    // ── Global Escape key
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      // Close innermost open modal first
      if (this.qs('#editModal.open'))   { this._closeEditModal(); return; }
      if (this.qs('#viewModal.open'))   { this._closeModal('viewModal'); return; }
      if (this.qs('#assignModal.open')) { this._closeAssignModal(); }
    });
  }

  // ── Font injection ────────────────────────────────────────

  _injectFonts() {
    if (document.querySelector('#brd-fonts')) return;
    const link   = document.createElement('link');
    link.id      = 'brd-fonts';
    link.rel     = 'stylesheet';
    link.href    = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;500&display=swap';
    document.head.appendChild(link);
  }

  // ── Style injection ───────────────────────────────────────

  _injectStyles() {
    const style = document.createElement('style');
    style.textContent = BRD_CSS;
    this.insertBefore(style, this.firstChild);
  }
}

// ── CSS ───────────────────────────────────────────────────────

const BRD_CSS = `

/* ── TOKENS ─────────────────────────────────────────────── */
.brd-root {
  --bg:        #FAF8F5;
  --surface:   #FFFFFF;
  --ink:       #1A1A1A;
  --ink-2:     #444441;
  --ink-3:     #888780;
  --line:      rgba(26, 26, 26, 0.12);
  --gold:      #B8985A;
  --gold-dark: #8C7140;
  --dark:      #1A1A1A;
  --err:       #C62828;
  --err-bg:    #FFEBEE;
  --sans:      'Inter', system-ui, -apple-system, sans-serif;
  --serif:     'Playfair Display', Georgia, 'Times New Roman', serif;
  --tf:        0.2s ease;
  --tc:        0.3s ease;

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

/* ── RESET (scoped) ─────────────────────────────────────── */
.brd-root *, .brd-root *::before, .brd-root *::after {
  margin: 0; padding: 0; box-sizing: border-box;
}
.brd-root a          { color: inherit; text-decoration: none; }
.brd-root button     { font-family: inherit; cursor: pointer; }
.brd-root input,
.brd-root select,
.brd-root textarea   { font-family: inherit; }
.brd-root table      { border-collapse: collapse; }

/* ── LAYOUT ─────────────────────────────────────────────── */
.brd-root .brd-container {
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 32px;
}

/* ── SHARED BUTTONS ─────────────────────────────────────── */
.brd-root .brd-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14px 28px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--tf);
  border: 1px solid transparent;
  white-space: nowrap;
}
.brd-root .brd-btn-primary {
  background: var(--gold); color: var(--ink); border-color: var(--gold);
}
.brd-root .brd-btn-primary:hover {
  background: var(--gold-dark); border-color: var(--gold-dark);
}
.brd-root .brd-btn-secondary {
  background: transparent; color: var(--ink); border-color: var(--ink);
}
.brd-root .brd-btn-secondary:hover {
  background: var(--ink); color: var(--bg);
}
.brd-root .brd-btn-sm { padding: 10px 20px; font-size: 11px; }

/* ── ADMIN TOPBAR ───────────────────────────────────────── */
.brd-root .admin-topbar {
  height: 56px;
  background: var(--dark);
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.brd-root .atb-inner {
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 32px;
  height: 100%;
  display: flex;
  align-items: center;
}
.brd-root .atb-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}
.brd-root .atb-wordmark {
  font-family: var(--serif);
  font-size: 15px;
  font-weight: 400;
  color: rgba(255,255,255,0.9);
  letter-spacing: 0.01em;
}
.brd-root .atb-sep {
  width: 1px;
  height: 16px;
  background: rgba(255,255,255,0.15);
  flex-shrink: 0;
}
.brd-root .atb-badge {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--gold);
  background: rgba(184,152,90,0.12);
  border: 1px solid rgba(184,152,90,0.3);
  border-radius: 3px;
  padding: 3px 8px;
}
.brd-root .atb-crumb {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255,255,255,0.4);
}
.brd-root .atb-crumb a { color: rgba(255,255,255,0.4); transition: color var(--tf); }
.brd-root .atb-crumb a:hover { color: rgba(255,255,255,0.7); }
.brd-root .atb-crumb-sep     { font-size: 10px; color: rgba(255,255,255,0.2); }
.brd-root .atb-crumb-current { color: rgba(255,255,255,0.85); font-weight: 500; }
.brd-root .atb-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}
.brd-root .atb-notif {
  position: relative;
  width: 32px; height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background var(--tf);
}
.brd-root .atb-notif:hover      { background: rgba(255,255,255,0.08); }
.brd-root .atb-notif svg        { color: rgba(255,255,255,0.5); }
.brd-root .atb-notif-dot {
  position: absolute;
  top: 6px; right: 6px;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--gold);
  border: 1.5px solid var(--dark);
}
.brd-root .atb-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 12px 5px 6px;
  border-radius: 24px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
  cursor: pointer;
  transition: background var(--tf);
}
.brd-root .atb-user:hover { background: rgba(255,255,255,0.08); }
.brd-root .atb-avatar {
  width: 26px; height: 26px;
  border-radius: 50%;
  background: var(--gold);
  color: var(--ink);
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  letter-spacing: 0;
}
.brd-root .atb-uname {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255,255,255,0.75);
  white-space: nowrap;
}

/* ── ADMIN PAGE ─────────────────────────────────────────── */
.brd-root .admin-page {
  background: var(--bg);
  padding: 40px 0 96px;
  min-height: calc(100vh - 56px);
}
.brd-root .admin-title-card {
  background: var(--surface);
  border: 0.5px solid var(--line);
  border-radius: 8px;
  padding: 24px 36px;
  margin-bottom: 20px;
}
.brd-root .admin-title-card h1 {
  font-family: var(--serif);
  font-size: 30px;
  font-weight: 400;
  line-height: 1.2;
}
.brd-root .admin-panel {
  background: var(--surface);
  border: 0.5px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}

/* ── PANEL TOOLBAR ──────────────────────────────────────── */
.brd-root .panel-hd {
  padding: 18px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  border-bottom: 0.5px solid var(--line);
}
.brd-root .panel-hd-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  margin-right: auto;
  white-space: nowrap;
}
.brd-root .ctl {
  padding: 9px 12px;
  border: 0.5px solid var(--line);
  border-radius: 4px;
  font-family: inherit;
  font-size: 12px;
  color: var(--ink);
  background: var(--bg);
  outline: none;
  transition: border-color var(--tf);
}
.brd-root .ctl:focus { border-color: var(--gold); }
.brd-root .ctl-select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 28px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23888780' d='M5 6L0 0h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-color: var(--bg);
  cursor: pointer;
}
.brd-root .ctl-input { width: 190px; }

/* ── REQUESTS TABLE ─────────────────────────────────────── */
.brd-root .req-table { width: 100%; border-collapse: collapse; }
.brd-root .req-table thead tr { background: var(--dark); }
.brd-root .req-table thead th {
  padding: 14px 20px;
  text-align: left;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #fff;
  white-space: nowrap;
}
.brd-root .req-table tbody tr {
  border-bottom: 0.5px solid var(--line);
  transition: background var(--tf);
}
.brd-root .req-table tbody tr:last-child { border-bottom: none; }
.brd-root .req-table tbody tr:hover      { background: #FDFCF9; }
.brd-root .req-table tbody td {
  padding: 20px;
  vertical-align: middle;
  font-size: 13px;
  color: var(--ink);
}
.brd-root .buyer-name  { font-weight: 600; font-size: 14px; margin-bottom: 3px; }
.brd-root .buyer-sub   { font-size: 11px; color: var(--ink-3); line-height: 1.5; }
.brd-root .loc-country { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 2px; }
.brd-root .loc-city    { font-size: 13px; color: var(--ink-2); }
.brd-root .price-val   { font-size: 13px; font-weight: 500; }
.brd-root .req-date    { font-size: 13px; color: var(--ink-2); white-space: nowrap; }

/* Status badges */
.brd-root .s-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
}
.brd-root .s-approved { background: #E8F5E9; color: #2E7D32; }
.brd-root .s-pending  { background: #FFF8E1; color: #E65100; }
.brd-root .s-rejected { background: #FFEBEE; color: #C62828; }

/* Row action buttons */
.brd-root .row-acts       { display: flex; flex-direction: column; gap: 8px; }
.brd-root .btn-row-view   { padding: 8px 18px; background: var(--gold); color: var(--ink); border: none; border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background var(--tf); }
.brd-root .btn-row-view:hover   { background: var(--gold-dark); }
.brd-root .btn-row-assign { padding: 8px 18px; background: var(--ink);  color: var(--bg);  border: none; border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background var(--tf); }
.brd-root .btn-row-assign:hover { background: var(--ink-2); }

.brd-root .tbl-empty   { padding: 56px 24px; text-align: center; color: var(--ink-3); font-size: 14px; }
.brd-root .tbl-empty p { margin-top: 6px; font-size: 12px; }

/* ── MODAL BASE ─────────────────────────────────────────── */
.brd-root .modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 100;
  align-items: flex-start;
  justify-content: center;
  padding: 60px 16px;
  overflow-y: auto;
}
.brd-root .modal-overlay.open { display: flex; }
.brd-root .modal {
  background: var(--surface);
  border-radius: 8px;
  padding: 48px;
  width: 100%;
  max-width: 640px;
  position: relative;
  margin: auto;
}
.brd-root .modal-close {
  position: absolute;
  top: 20px;
  right: 20px;
  background: none;
  border: none;
  font-size: 22px;
  line-height: 1;
  color: var(--ink-3);
  cursor: pointer;
  padding: 4px;
  transition: color var(--tf);
  z-index: 2;
}
.brd-root .modal-close:hover { color: var(--ink); }

/* ── VIEW MODAL ─────────────────────────────────────────── */
.brd-root .modal-lg { max-width: 720px; }
.brd-root .vmod-title {
  font-family: var(--serif);
  font-size: 24px;
  font-weight: 400;
  text-align: center;
  margin-bottom: 6px;
}
.brd-root .vmod-rule {
  width: 36px; height: 2px;
  background: var(--gold);
  margin: 0 auto 24px;
}
.brd-root .info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
}
.brd-root .icard {
  background: var(--bg);
  border-radius: 6px;
  padding: 13px 16px 13px 18px;
  border-left: 3px solid var(--gold);
}
.brd-root .icard-label {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-3);
  font-weight: 500;
  margin-bottom: 5px;
}
.brd-root .icard-val {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.4;
  word-break: break-word;
}
.brd-root .icard-val-empty {
  font-style: italic;
  font-weight: 400;
  color: var(--ink-3);
  font-size: 12px;
}
.brd-root .comments-box {
  background: var(--bg);
  border: 0.5px solid var(--line);
  border-radius: 6px;
  padding: 16px 20px;
  margin-bottom: 24px;
}
.brd-root .comments-lbl {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-3);
  font-weight: 500;
  margin-bottom: 6px;
}
.brd-root .comments-txt {
  font-size: 14px;
  color: var(--ink-2);
  line-height: 1.7;
  font-style: italic;
}
.brd-root .vmod-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  padding-top: 20px;
  border-top: 0.5px solid var(--line);
  flex-wrap: wrap;
}
.brd-root .btn-approve {
  padding: 10px 22px;
  background: #2E7D32; color: #fff;
  border: 1px solid #2E7D32; border-radius: 4px;
  font-size: 12px; font-weight: 500;
  letter-spacing: 0.08em; text-transform: uppercase;
  cursor: pointer; font-family: inherit;
  transition: all var(--tf);
}
.brd-root .btn-approve:hover:not([disabled]) { background: #1B5E20; border-color: #1B5E20; }
.brd-root .btn-approve[disabled] { opacity: 0.35; cursor: not-allowed; }
.brd-root .btn-reject {
  padding: 10px 22px;
  background: #C62828; color: #fff;
  border: 1px solid #C62828; border-radius: 4px;
  font-size: 12px; font-weight: 500;
  letter-spacing: 0.08em; text-transform: uppercase;
  cursor: pointer; font-family: inherit;
  transition: all var(--tf);
}
.brd-root .btn-reject:hover:not([disabled]) { background: #B71C1C; border-color: #B71C1C; }
.brd-root .btn-reject[disabled] { opacity: 0.35; cursor: not-allowed; }
.brd-root .btn-edit-req {
  padding: 10px 22px;
  background: var(--ink); color: var(--bg);
  border: 1px solid var(--ink); border-radius: 4px;
  font-size: 12px; font-weight: 500;
  letter-spacing: 0.08em; text-transform: uppercase;
  cursor: pointer; font-family: inherit;
  transition: all var(--tf);
}
.brd-root .btn-edit-req:hover:not([disabled]) { background: var(--ink-2); border-color: var(--ink-2); }
.brd-root .btn-edit-req[disabled] { opacity: 0.35; cursor: not-allowed; }

/* ── EDIT MODAL ─────────────────────────────────────────── */
.brd-root .modal-edit {
  max-width: 780px;
  padding: 0;
  display: flex;
  flex-direction: column;
  max-height: min(90vh, 880px);
  overflow: hidden;
}

/* Edit modal: fixed header */
.brd-root .emod-header {
  padding: 36px 48px 0;
  flex-shrink: 0;
  background: var(--surface);
}
.brd-root .emod-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: var(--gold);
  cursor: pointer;
  padding: 0 0 14px;
  transition: color var(--tf);
  font-family: inherit;
}
.brd-root .emod-back:hover { color: var(--gold-dark); }
.brd-root .emod-title {
  font-family: var(--serif);
  font-size: 24px;
  font-weight: 400;
  text-align: center;
  margin-bottom: 6px;
}
.brd-root .emod-rule {
  width: 36px; height: 2px;
  background: var(--gold);
  margin: 0 auto 0;
}

/* Edit modal: scrollable body */
.brd-root .emod-body {
  overflow-y: auto;
  padding: 24px 48px 8px;
  flex: 1;
  scrollbar-width: thin;
  scrollbar-color: var(--gold) var(--bg);
}
.brd-root .emod-body::-webkit-scrollbar        { width: 5px; }
.brd-root .emod-body::-webkit-scrollbar-track  { background: var(--bg); }
.brd-root .emod-body::-webkit-scrollbar-thumb  { background: var(--gold); border-radius: 3px; }

/* Edit modal: fixed footer */
.brd-root .emod-footer {
  padding: 20px 48px 32px;
  border-top: 0.5px solid var(--line);
  flex-shrink: 0;
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* Error summary */
.brd-root .eform-err-summary {
  background: var(--err-bg);
  border: 1px solid rgba(198, 40, 40, 0.25);
  border-radius: 5px;
  color: var(--err);
  font-size: 12px;
  font-weight: 500;
  padding: 10px 16px;
  margin-bottom: 20px;
}

/* Form sections */
.brd-root .eform-section {
  margin-bottom: 22px;
}
.brd-root .eform-section:last-child { margin-bottom: 0; }
.brd-root .eform-sec-title {
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--gold);
  font-weight: 600;
  margin-bottom: 14px;
  padding-bottom: 9px;
  border-bottom: 0.5px solid var(--line);
}

/* Form rows & fields */
.brd-root .eform-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 12px;
}
.brd-root .eform-row:last-child { margin-bottom: 0; }
.brd-root .eform-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}
.brd-root .eform-full { grid-column: 1 / -1; }
.brd-root .eform-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-3);
  font-weight: 500;
  line-height: 1;
}
.brd-root .req-star  { color: var(--gold); margin-left: 2px; }
.brd-root .eform-opt  { letter-spacing: 0; text-transform: none; font-size: 10px; color: var(--ink-3); opacity: 0.7; }
.brd-root .eform-unit { letter-spacing: 0; text-transform: none; }

/* Inputs, selects, textarea */
.brd-root .eform-input,
.brd-root .eform-select,
.brd-root .eform-textarea {
  width: 100%;
  padding: 11px 14px;
  border: 0.5px solid var(--line);
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
  color: var(--ink);
  background: var(--bg);
  outline: none;
  transition: border-color var(--tf), box-shadow var(--tf);
  line-height: 1.5;
}
.brd-root .eform-input:focus,
.brd-root .eform-select:focus,
.brd-root .eform-textarea:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(184, 152, 90, 0.12);
}
.brd-root .eform-input.err,
.brd-root .eform-select.err,
.brd-root .eform-textarea.err {
  border-color: var(--err);
  box-shadow: 0 0 0 3px rgba(198, 40, 40, 0.1);
}
.brd-root .eform-select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 32px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23888780' d='M5 6L0 0h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-color: var(--bg);
  cursor: pointer;
}
.brd-root .eform-textarea {
  resize: vertical;
  min-height: 96px;
}
.brd-root .eform-error {
  font-size: 11px;
  color: var(--err);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}
.brd-root .eform-error::before {
  content: '!';
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--err);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  flex-shrink: 0;
}

/* Edit footer buttons */
.brd-root .btn-save-req {
  padding: 13px 44px;
  background: var(--gold);
  color: var(--ink);
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  font-family: inherit;
  transition: background var(--tf);
}
.brd-root .btn-save-req:hover:not([disabled]) { background: var(--gold-dark); }
.brd-root .btn-save-req[disabled] { opacity: 0.45; cursor: not-allowed; }
.brd-root .btn-cancel-edit {
  padding: 13px 28px;
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  font-family: inherit;
  transition: all var(--tf);
}
.brd-root .btn-cancel-edit:hover { border-color: var(--ink); background: var(--ink); color: var(--bg); }

/* ── ASSIGN MODAL ───────────────────────────────────────── */
.brd-root .modal-xl { max-width: 920px; padding: 40px; }
.brd-root .amod-title {
  font-family: var(--serif);
  font-size: 24px;
  font-weight: 400;
  text-align: center;
  margin-bottom: 6px;
}
.brd-root .amod-rule {
  width: 36px; height: 2px;
  background: var(--gold);
  margin: 0 auto 24px;
}
.brd-root .asearch-lbl {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--gold);
  font-weight: 500;
  margin-bottom: 8px;
}
.brd-root .asearch-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 24px;
}
.brd-root .asearch-input {
  flex: 1;
  padding: 11px 16px;
  border: 1.5px solid var(--gold);
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
  color: var(--ink);
  background: var(--bg);
  outline: none;
  transition: border-color var(--tf);
}
.brd-root .asearch-input:focus { border-color: var(--gold-dark); }

/* Properties table */
.brd-root .prop-table { width: 100%; border-collapse: collapse; }
.brd-root .prop-table thead tr { background: var(--dark); }
.brd-root .prop-table thead th {
  padding: 13px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #fff;
}
.brd-root .prop-table thead th.th-chk { width: 44px; }
.brd-root .prop-table thead th.th-act { width: 130px; text-align: right; }
.brd-root .prop-table tbody .prop-row  { border-bottom: 0.5px solid var(--line); transition: background var(--tf); }
.brd-root .prop-table tbody .prop-row:hover { background: var(--bg); }
.brd-root .prop-table tbody td { padding: 14px 16px; font-size: 14px; color: var(--ink); vertical-align: middle; }
.brd-root .prop-chk { width: 17px; height: 17px; accent-color: var(--gold); cursor: pointer; }
.brd-root .prop-nm  { font-weight: 500; line-height: 1.4; }
.brd-root .prop-ty,
.brd-root .prop-cy  { color: var(--ink-2); }
.brd-root .td-act   { text-align: right; }
.brd-root .btn-show-det {
  padding: 7px 13px;
  background: transparent;
  color: var(--gold);
  border: 1px solid var(--gold);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  font-family: inherit;
  transition: all var(--tf);
  white-space: nowrap;
}
.brd-root .btn-show-det:hover    { background: var(--gold); color: var(--ink); }
.brd-root .btn-show-det.det-open { background: var(--ink); color: var(--bg); border-color: var(--ink); }

/* Expandable detail row */
.brd-root .det-row             { display: none; }
.brd-root .det-row.det-open    { display: table-row; }
.brd-root .det-cell            { padding: 0 !important; background: var(--bg); border-bottom: 0.5px solid var(--line); }
.brd-root .det-inner {
  padding: 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  animation: brd-fadeDown 0.2s ease;
}
@keyframes brd-fadeDown {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.brd-root .det-section {
  background: var(--surface);
  border: 0.5px solid var(--line);
  border-radius: 6px;
  padding: 16px 18px;
}
.brd-root .det-sec-title {
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--gold);
  font-weight: 500;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 0.5px solid var(--line);
}
.brd-root .det-line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 5px 0;
  border-bottom: 0.5px solid var(--line);
  font-size: 12px;
  gap: 8px;
}
.brd-root .det-line:last-child { border-bottom: none; }
.brd-root .det-k { color: var(--ink-3); flex-shrink: 0; }
.brd-root .det-v { color: var(--ink); font-weight: 500; text-align: right; }

/* Pagination */
.brd-root .apag {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 0;
  border-top: 0.5px solid var(--line);
  border-bottom: 0.5px solid var(--line);
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--ink-2);
}
.brd-root .pag-btn {
  width: 30px; height: 30px;
  border: 0.5px solid var(--line);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  color: var(--ink-2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--tf);
  font-family: inherit;
  line-height: 1;
}
.brd-root .pag-btn:hover:not([disabled]) { border-color: var(--ink); color: var(--ink); }
.brd-root .pag-btn[disabled]             { opacity: 0.3; cursor: not-allowed; }
.brd-root .pag-inp {
  width: 44px; height: 30px;
  border: 1.5px solid var(--gold);
  border-radius: 4px;
  text-align: center;
  font-size: 13px;
  font-family: inherit;
  color: var(--ink);
  outline: none;
}
.brd-root .sel-info {
  text-align: center;
  font-size: 12px;
  color: var(--gold);
  font-weight: 500;
  min-height: 18px;
  margin-bottom: 10px;
}
.brd-root .assign-footer { text-align: center; }
.brd-root .btn-assign-now {
  padding: 13px 48px;
  background: var(--gold);
  color: var(--ink);
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  font-family: inherit;
  transition: background var(--tf);
}
.brd-root .btn-assign-now:hover:not([disabled]) { background: var(--gold-dark); }
.brd-root .btn-assign-now[disabled]             { opacity: 0.4; cursor: not-allowed; }

/* ── TOAST ──────────────────────────────────────────────── */
.brd-root .brd-toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%) translateY(14px);
  background: var(--ink);
  color: var(--bg);
  padding: 12px 28px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  z-index: 9999;
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}
.brd-root .brd-toast.show              { opacity: 1; transform: translateX(-50%) translateY(0); }
.brd-root .brd-toast.brd-toast-success { background: #2E7D32; }

/* ── SKELETON ───────────────────────────────────────────── */
@keyframes brd-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.brd-root .sk {
  display: block;
  border-radius: 4px;
  background: linear-gradient(90deg, #E8E5DF 25%, #F0EDE6 50%, #E8E5DF 75%);
  background-size: 200% 100%;
  animation: brd-shimmer 1.4s ease-in-out infinite;
}
.brd-root .sk-w20  { width: 20%; }  .brd-root .sk-w25  { width: 25%; }
.brd-root .sk-w30  { width: 30%; }  .brd-root .sk-w35  { width: 35%; }
.brd-root .sk-w40  { width: 40%; }  .brd-root .sk-w45  { width: 45%; }
.brd-root .sk-w50  { width: 50%; }  .brd-root .sk-w55  { width: 55%; }
.brd-root .sk-w60  { width: 60%; }  .brd-root .sk-w65  { width: 65%; }
.brd-root .sk-w70  { width: 70%; }  .brd-root .sk-w75  { width: 75%; }
.brd-root .sk-w80  { width: 80%; }  .brd-root .sk-w90  { width: 90%; }
.brd-root .sk-w100 { width: 100%; }
.brd-root .sk-line     { height: 11px; }
.brd-root .sk-line-sm  { height: 9px; }
.brd-root .sk-badge    { height: 22px; width: 72px; border-radius: 20px; }
.brd-root .sk-btn      { height: 32px; width: 82px; border-radius: 4px; }
.brd-root .sk-chk      { width: 17px; height: 17px; border-radius: 3px; flex-shrink: 0; }
.brd-root .sk-card-lbl { height: 9px;  margin-bottom: 8px; }
.brd-root .sk-card-val { height: 13px; }
.brd-root .sk-row-1 .sk { animation-delay: 0s;  }
.brd-root .sk-row-2 .sk { animation-delay: .1s; }
.brd-root .sk-row-3 .sk { animation-delay: .2s; }
.brd-root .sk-row-4 .sk { animation-delay: .3s; }
.brd-root .sk-row-5 .sk { animation-delay: .4s; }

/* ── REQUESTS PAGINATION ───────────────────────────────────── */
.brd-root .req-pag {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 24px;
  border-top: 0.5px solid var(--line);
  font-size: 13px;
  color: var(--ink-2);
}
.brd-root .req-pag-info {
  margin-left: 10px;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--ink-3);
}

/* ── RESPONSIVE ─────────────────────────────────────────── */
@media (max-width: 900px) {
  .brd-root .col-loc,
  .brd-root .col-price    { display: none; }
  .brd-root .info-grid    { grid-template-columns: 1fr; }
  .brd-root .det-inner    { grid-template-columns: 1fr; }
}
@media (max-width: 700px) {
  .brd-root .eform-row    { grid-template-columns: 1fr; }
  .brd-root .emod-header  { padding: 28px 20px 0; }
  .brd-root .emod-body    { padding: 20px 20px 8px; }
  .brd-root .emod-footer  { padding: 16px 20px 24px; }
}
@media (max-width: 640px) {
  .brd-root .brd-container { padding: 0 16px; }
  .brd-root .panel-hd      { flex-direction: column; align-items: flex-start; }
  .brd-root .ctl-input     { width: 100%; }
  .brd-root .modal-xl,
  .brd-root .modal-lg,
  .brd-root .modal-edit    { max-width: 100%; }
  .brd-root .vmod-actions  { flex-direction: column; }
  .brd-root .atb-crumb     { display: none; }
  .brd-root .atb-uname     { display: none; }
}
`;

// ── REGISTER ──────────────────────────────────────────────────
customElements.define('buy-requests-dashboard', BuyRequestsDashboard);