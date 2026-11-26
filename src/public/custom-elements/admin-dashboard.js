// ============================================================
//  admin-dashboard.js
//  Sharon Homes — Admin Dashboard
//  Wix Custom Element  ·  tag: <admin-dashboard>
//
//  Wix page → element   : setAttribute('data',     JSON)
//                         setAttribute('feed',     JSON)
//                         setAttribute('username', 'Granit')
//                         setAttribute('initials', 'G')
//
//  Element → Wix page   : 'navigate' { page: 'offers'|'requests' }
// ============================================================

// ── MOCK DATA (loading state — replaced by real data on setAttribute) ──────

const _MOCK_DB = {
  totalProperties: 215,
  approved:        211,
  pending:         4,
  villaCount:      100,
  aptCount:        98,
  otherCount:      17,
  avgPrice:        747523,
  avgVilla:        914700,
  avgApt:          548248,
  maxPrice:        19500000,
  invOpportunity:  208,
  transComplete:   215,
  buyTotal:        4,
  buyApproved:     4,
  buyPending:  0,
  cyprus:          210,
  greece:          3,
  monthLabels: ['Jul 25','Aug 25','Sep 25','Dec 25','Jan 26','Mar 26','Apr 26','May 26'],
  monthValues: [21, 44, 42, 62, 6, 5, 5, 11],
  priceBuckets: [
    { label:'<250K',    val:32,  max:86, colorClass:'bar-fill-gold',  tip:'<250K: 32 properties &middot; 14.9% of catalogue' },
    { label:'250K-500K',val:86,  max:86, colorClass:'bar-fill-gold',  tip:'250K-500K: 86 properties &middot; 40.0% of catalogue' },
    { label:'500K-1M',  val:64,  max:86, colorClass:'bar-fill-ink',   tip:'500K-1M: 64 properties &middot; 29.8% of catalogue' },
    { label:'1M-2M',    val:16,  max:86, colorClass:'bar-fill-amber', tip:'1M-2M: 16 properties &middot; 7.4% of catalogue' },
    { label:'>2M',      val:11,  max:86, colorClass:'bar-fill-muted', tip:'&gt;2M: 11 properties &middot; 5.1% of catalogue' }
  ],
  bedroomBuckets: [
    { label:'1 BR',  val:80, max:80, colorClass:'bar-fill-gold',  tip:'1 BR: 80 properties &middot; 37.2%' },
    { label:'2 BR',  val:30, max:80, colorClass:'bar-fill-ink',   tip:'2 BR: 30 properties &middot; 14.0%' },
    { label:'3 BR',  val:67, max:80, colorClass:'bar-fill-gold',  tip:'3 BR: 67 properties &middot; 31.2%' },
    { label:'4 BR',  val:20, max:80, colorClass:'bar-fill-ink',   tip:'4 BR: 20 properties &middot; 9.3%' },
    { label:'5+ BR', val:3,  max:80, colorClass:'bar-fill-muted', tip:'5+ BR: 3 properties &middot; 1.4%' }
  ],
  quickStats: [
    { num:4,   label:'Sea View',    tip:'Properties with sea view tag' },
    { num:4,   label:'Sea Front',   tip:'Properties close to the sea' },
    { num:633, label:'Translations',tip:'633 translation records across 211 properties x 3 languages' },
    { num:3,   label:'Languages',   tip:'English, German and Hebrew' }
  ]
};

const _MOCK_FEED = [
  { emoji:'🏠', title:'Sunset View Residence Tala',           badge:'Villa',     date:'2026-05-12' },
  { emoji:'🌊', title:'Delightful 6BR Villa in Tala',         badge:'Villa',     date:'2026-05-12' },
  { emoji:'🏢', title:'4BR Tala Seaview Home',                badge:'Villa',     date:'2026-05-12' },
  { emoji:'🌿', title:'4BR Seaview Villa in Tala',            badge:'Villa',     date:'2026-05-12' },
  { emoji:'🏡', title:'Luxury Bedroom Renovated Villa',       badge:'Villa',     date:'2026-05-07' },
  { emoji:'🛖', title:'Renovated 2 Bedroom Flat | Universal', badge:'Apartment', date:'2026-05-05' }
];

// ── CUSTOM ELEMENT ────────────────────────────────────────────────────────

class AdminDashboard extends HTMLElement {

  constructor() {
    super();
    this._db           = Object.assign({}, _MOCK_DB);
    this._feed         = _MOCK_FEED.slice();
    this._donutPaths   = [];
    this._monthRects   = [];
    this._connected    = false;
    this._resizeObs    = null;
    this._pendingAttrs = {};   // queues setAttribute calls that arrive before boot
  }

  // ── Wix attribute comms ───────────────────────────────────────────────────

  static get observedAttributes() {
    return ['data', 'feed', 'username', 'initials'];
  }

  attributeChangedCallback(name, old, val) {
    if (old === val) return;
    if (!this._connected) {
      // DOM not ready yet — queue and apply after _boot() finishes
      this._pendingAttrs[name] = val;
      return;
    }
    this._applyAttr(name, val);
  }

  _applyAttr(name, val) {
    if (name === 'data' && val) {
      try { Object.assign(this._db, JSON.parse(val)); this._refresh(); }
      catch(e) { console.error('[AD] bad data JSON', e); }
    }
    if (name === 'feed' && val) {
      try { this._feed = JSON.parse(val); this._buildFeed(); }
      catch(e) { console.error('[AD] bad feed JSON', e); }
    }
    if (name === 'username') {
      const el = this.qs('.atb-uname');
      if (el) el.textContent = val;
    }
    if (name === 'initials') {
      const el = this.qs('.atb-avatar');
      if (el) el.textContent = val.substring(0, 2).toUpperCase();
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connectedCallback() {
    this._injectFonts();
    this._injectStyles();
    this._buildDOM();
    this._connected = true;
    this._boot();
  }

  disconnectedCallback() {
    if (this._resizeObs) this._resizeObs.disconnect();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  qs(s)  { return this.querySelector(s); }
  qsa(s) { return this.querySelectorAll(s); }

  // ── Refresh (called when real data arrives via setAttribute) ──────────────

  _refresh() {
    this._runCountUps();
    this._buildBars();
    this._initBarTooltips(); // re-attach after bar innerHTML rebuild
    this._buildFeed();
    setTimeout(() => {
      this._drawMonthly(-1);
      this._initDonut();
      this._animateBars();
      this._animateSplit();
    }, 100);
  }

  // ── Boot sequence ─────────────────────────────────────────────────────────

  _boot() {
    const u = this.getAttribute('username');
    const i = this.getAttribute('initials');
    if (u) this.qs('.atb-uname').textContent = u;
    if (i) this.qs('.atb-avatar').textContent = i.substring(0, 2).toUpperCase();

    this._buildBars();
    this._buildFeed();
    this._runCountUps();

    setTimeout(() => {
      this._drawMonthly(-1);
      this._initDonut();
      this._animateBars();
      this._animateSplit();
      this._initBarTooltips();
      this._initCountrySplit();
      this._initLegendSync();
      this._initMonthlyChart();
    }, 250);

    this._resizeObs = new ResizeObserver(() => this._drawMonthly(this._hiIdx || -1));
    this._resizeObs.observe(this.qs('#dash-monthlyChart'));

    // Flush any setAttribute calls that arrived before DOM was ready
    Object.entries(this._pendingAttrs).forEach(([n, v]) => this._applyAttr(n, v));
    this._pendingAttrs = {};
  }

  // ── Count-up animation ────────────────────────────────────────────────────

  _countUp(el, target, dur, pre) {
    if (!el) return;
    pre = pre || '';
    const t0   = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    const tick = now => {
      const p = Math.min((now - t0) / dur, 1);
      el.textContent = pre + Math.floor(ease(p) * target).toLocaleString('en-EU');
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = pre + target.toLocaleString('en-EU');
    };
    requestAnimationFrame(tick);
  }

  _runCountUps() {
    const db = this._db;
    const kpis = [
      ['dash-kpi-total',    db.totalProperties, 1400, ''],
      ['dash-kpi-approved', db.approved,         1400, ''],
      ['dash-kpi-avg',      db.avgPrice,         1600, '\u20ac'],
      ['dash-kpi-br',       db.buyTotal,          800, ''],
      ['dash-kpi-villa',    db.villaCount,       1100, ''],
      ['dash-kpi-apt',      db.aptCount,         1100, ''],
      ['dash-kpi-trans',    db.transComplete,    1400, ''],
      ['dash-kpi-inv',      db.invOpportunity,   1400, ''],
    ];
    kpis.forEach(([id, val, dur, pre], i) => {
      setTimeout(() => this._countUp(this.qs('#' + id), val, dur, pre), 80 + i * 40);
    });
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────

  _showTip(x, y, html) {
    const t = this.qs('#dash-tip');
    if (!t) return;
    t.innerHTML = html;
    t.style.left = (x + 14) + 'px';
    t.style.top  = (y - 38) + 'px';
    t.classList.add('show');
  }
  _moveTip(x, y) {
    const t = this.qs('#dash-tip');
    if (!t) return;
    t.style.left = (x + 14) + 'px';
    t.style.top  = (y - 38) + 'px';
  }
  _hideTip() { this.qs('#dash-tip')?.classList.remove('show'); }

  // ── Navigation ────────────────────────────────────────────────────────────

  _nav(page) {
    this.dispatchEvent(new CustomEvent('navigate', { detail: { page }, bubbles: true }));
  }

  // ── Bar chart build ───────────────────────────────────────────────────────

  _buildBars() {
    const db = this._db;

    const pEl = this.qs('#dash-price-bars');
    if (pEl) {
      pEl.innerHTML = db.priceBuckets.map(b => `
        <div class="bar-item" data-tip="${b.tip}">
          <span class="bar-label">${b.label}</span>
          <div class="bar-track"><div class="bar-fill ${b.colorClass}" data-val="${b.val}" data-max="${b.max}" style="width:0"></div></div>
          <span class="bar-val">${b.val}</span>
        </div>`).join('');
    }

    const bEl = this.qs('#dash-bed-bars');
    if (bEl) {
      bEl.innerHTML = db.bedroomBuckets.map(b => `
        <div class="bar-item" data-tip="${b.tip}">
          <span class="bar-label">${b.label}</span>
          <div class="bar-track"><div class="bar-fill ${b.colorClass}" data-val="${b.val}" data-max="${b.max}" style="width:0"></div></div>
          <span class="bar-val">${b.val}</span>
        </div>`).join('');
    }

    const qEl = this.qs('#dash-qs-grid');
    if (qEl) {
      qEl.innerHTML = db.quickStats.map(s => `
        <div class="qs-item" title="${s.tip}">
          <div class="qs-num">${s.num}</div>
          <div class="qs-label">${s.label}</div>
        </div>`).join('');
    }

    this.qsa('.pc-villa-price').forEach(e => e.textContent = '\u20ac' + Math.round(db.avgVilla / 1000) + 'K');
    this.qsa('.pc-apt-price').forEach(e  => e.textContent = '\u20ac' + Math.round(db.avgApt   / 1000) + 'K');
    this.qsa('.pc-villa-count').forEach(e => e.textContent = db.villaCount + ' listings');
    this.qsa('.pc-apt-count').forEach(e  => e.textContent = db.aptCount   + ' listings');

    const total  = db.cyprus + db.greece;
    const cypPct = Math.round(db.cyprus / total * 100);
    this.qsa('.cs-cyprus-val').forEach(e => e.textContent = '\u00a0' + db.cyprus);
    this.qsa('.cs-cyprus-pct').forEach(e => e.textContent = '\u00a0(' + cypPct + '%)');
    this.qsa('.cs-greece-val').forEach(e => e.textContent = '\u00a0' + db.greece);

    const kpiAvgSub = this.qs('#dash-avg-sub');
    if (kpiAvgSub) {
      const maxK = db.maxPrice >= 1000000
        ? '\u20ac' + (db.maxPrice / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
        : '\u20ac' + Math.round(db.maxPrice / 1000) + 'K';
      kpiAvgSub.innerHTML = `Max&nbsp;<strong>${maxK}</strong>&nbsp;&middot;&nbsp;Min&nbsp;<strong>\u20ac160K</strong>`;
    }

    const donutTotal = db.villaCount + db.aptCount + db.otherCount;
    [db.villaCount, db.aptCount, db.otherCount].forEach((v, i) => {
      const vEl = this.qs('#dash-legend-val-' + i);
      const pEl2 = this.qs('#dash-legend-pct-' + i);
      if (vEl)  vEl.textContent  = v;
      if (pEl2) pEl2.textContent = '(' + Math.round(v / donutTotal * 100) + '%)';
    });

    // KPI sub-pills that reference live counts
    const appPct = Math.round(db.approved / db.totalProperties * 100 * 10) / 10;
    const invPct = Math.round(db.invOpportunity / db.totalProperties * 100 * 10) / 10;
    const appPill = this.qs('#dash-approved-pct');
    const invPill = this.qs('#dash-inv-pct');
    const pendPill = this.qs('#dash-pending-pill');
    const brPill   = this.qs('#dash-br-pill');
    if (appPill)  appPill.textContent  = appPct + '% approved';
    if (invPill)  invPill.textContent  = invPct + '% of portfolio';
    if (pendPill) pendPill.textContent = db.pending + ' pending';
    if (brPill) {
    const pending = db.buyPending || 0;
    if (pending > 0) {
        brPill.textContent     = db.buyApproved + ' approved · ' + pending + ' pending';
        brPill.className       = 'kpi-pill kpi-pill-amber';
    } else {
        brPill.textContent     = 'All ' + db.buyApproved + ' approved';
        brPill.className       = 'kpi-pill kpi-pill-green';
    }
    }
  }

  // ── Feed build ────────────────────────────────────────────────────────────

  _buildFeed() {
    const el = this.qs('#dash-feed');
    if (!el) return;
    el.innerHTML = this._feed.map(item => `
      <div class="feed-item" tabindex="0">
        <div class="feed-dot">${item.emoji}</div>
        <div class="feed-body">
          <div class="feed-title">${item.title}<span class="feed-badge">${item.badge}</span></div>
          <div class="feed-meta">Added ${item.date}</div>
        </div>
        <div class="feed-arrow">&#8594;</div>
      </div>`).join('');
  }

  // ── Animate CSS bars ──────────────────────────────────────────────────────

  _animateBars() {
    this.qsa('.bar-fill[data-val]').forEach(el => {
      const v = +el.dataset.val, m = +el.dataset.max;
      setTimeout(() => { el.style.width = (v / m * 100) + '%'; }, 150);
    });
  }

  // ── Country split ─────────────────────────────────────────────────────────

  _animateSplit() {
    const db    = this._db;
    const total = db.cyprus + db.greece;
    setTimeout(() => {
      const cy = this.qs('#dash-cs-cyprus');
      const gr = this.qs('#dash-cs-greece');
      if (cy) cy.style.width = (db.cyprus / total * 100) + '%';
      if (gr) gr.style.width = (db.greece / total * 100) + '%';
    }, 400);
  }

  // ── Bar tooltips ──────────────────────────────────────────────────────────

  _initBarTooltips() {
    this.qsa('.bar-item[data-tip]').forEach(item => {
      item.addEventListener('mouseenter', e => this._showTip(e.clientX, e.clientY, item.dataset.tip));
      item.addEventListener('mousemove',  e => this._moveTip(e.clientX, e.clientY));
      item.addEventListener('mouseleave', ()  => this._hideTip());
    });
  }

  // ── Country split tooltip ─────────────────────────────────────────────────

  _initCountrySplit() {
    const wrap = this.qs('.cs-wrap');
    if (!wrap) return;
    wrap.addEventListener('mouseenter', e =>
      this._showTip(e.clientX, e.clientY,
        `Cyprus <strong>${this._db.cyprus}</strong> &middot; Greece <strong>${this._db.greece}</strong>`));
    wrap.addEventListener('mousemove',  e => this._moveTip(e.clientX, e.clientY));
    wrap.addEventListener('mouseleave', ()  => this._hideTip());
  }

  // ── Monthly canvas chart ──────────────────────────────────────────────────

  _setupCanvas(canvas) {
    const dpr  = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w: rect.width, h: rect.height };
  }

  _drawMonthly(hiIdx) {
    hiIdx = (hiIdx === undefined) ? -1 : hiIdx;
    this._hiIdx = hiIdx;
    const canvas = this.qs('#dash-monthlyChart');
    if (!canvas) return;
    const { ctx, w, h } = this._setupCanvas(canvas);
    const db     = this._db;
    const vals   = db.monthValues;
    const labels = db.monthLabels;
    const maxV   = Math.max(...vals);
    const pad    = { top:26, right:8, bottom:42, left:32 };
    const cw     = w - pad.left - pad.right;
    const ch     = h - pad.top  - pad.bottom;
    const gap    = cw / labels.length;
    const bw     = gap * 0.52;

    ctx.clearRect(0, 0, w, h);
    this._monthRects = [];

    for (let i = 0; i <= 4; i++) {
      const gy = pad.top + ch - (ch * i / 4);
      ctx.beginPath(); ctx.strokeStyle = 'rgba(26,26,26,.07)'; ctx.lineWidth = 1;
      ctx.moveTo(pad.left, gy); ctx.lineTo(pad.left + cw, gy); ctx.stroke();
      ctx.fillStyle = '#888780'; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxV * i / 4), pad.left - 4, gy + 3);
    }

    vals.forEach((v, i) => {
      const bh   = (v / maxV) * ch;
      const bx   = pad.left + gap * i + (gap - bw) / 2;
      const by   = pad.top + ch - bh;
      const isHi = (i === hiIdx);

      this._monthRects.push({ x:bx, y:pad.top, w:bw, h:ch, bh, label:labels[i], value:v });

      ctx.fillStyle = isHi ? 'rgba(184,152,90,.18)' : 'rgba(184,152,90,.07)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, pad.top, bw, ch, 3);
      else ctx.rect(bx, pad.top, bw, ch);
      ctx.fill();

      const g = ctx.createLinearGradient(0, by, 0, by + bh);
      if (isHi) { g.addColorStop(0, '#D4B870'); g.addColorStop(1, '#A07840'); }
      else       { g.addColorStop(0, '#C8A86A'); g.addColorStop(1, '#8C7140'); }
      ctx.fillStyle = g;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 3);
      else ctx.rect(bx, by, bw, bh);
      ctx.fill();

      ctx.fillStyle = isHi ? '#B8985A' : '#1A1A1A';
      ctx.font      = isHi ? '700 11px Inter,sans-serif' : '600 10px Inter,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(v, bx + bw / 2, by - 6);

      ctx.fillStyle = isHi ? '#1A1A1A' : '#888780';
      ctx.font      = isHi ? '600 10px Inter,sans-serif' : '10px Inter,sans-serif';
      ctx.fillText(labels[i], bx + bw / 2, pad.top + ch + 16);
    });
  }

  _initMonthlyChart() {
    const canvas = this.qs('#dash-monthlyChart');
    if (!canvas) return;
    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      let found = -1;
      this._monthRects.forEach((b, i) => {
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) found = i;
      });
      if (found >= 0) {
        const b = this._monthRects[found];
        this._drawMonthly(found);
        this._showTip(e.clientX, e.clientY, `<strong>${b.label}</strong> &mdash; ${b.value} listings added`);
        canvas.style.cursor = 'pointer';
      } else {
        this._drawMonthly(-1);
        this._hideTip();
        canvas.style.cursor = 'crosshair';
      }
    });
    canvas.addEventListener('mouseleave', () => { this._drawMonthly(-1); this._hideTip(); });
  }

  // ── SVG Donut ─────────────────────────────────────────────────────────────

  _polarToCart(cx, cy, r, deg) {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  _annularPath(startDeg, endDeg) {
    const GAP = 2.2, OR = 88, IR = 54, CX = 100, CY = 100;
    const s  = startDeg + GAP / 2;
    const e  = endDeg   - GAP / 2;
    const lg = (e - s > 180) ? 1 : 0;
    const o1 = this._polarToCart(CX, CY, OR, s);
    const o2 = this._polarToCart(CX, CY, OR, e);
    const i1 = this._polarToCart(CX, CY, IR, s);
    const i2 = this._polarToCart(CX, CY, IR, e);
    const f  = n => n.toFixed(3);
    return [
      `M ${f(o1.x)} ${f(o1.y)}`,
      `A ${OR} ${OR} 0 ${lg} 1 ${f(o2.x)} ${f(o2.y)}`,
      `L ${f(i2.x)} ${f(i2.y)}`,
      `A ${IR} ${IR} 0 ${lg} 0 ${f(i1.x)} ${f(i1.y)}`,
      'Z'
    ].join(' ');
  }

  _setDonutCentre(num, lbl, pct) {
    const nEl = this.qs('#dash-donut-num');
    const lEl = this.qs('#dash-donut-lbl');
    const pEl = this.qs('#dash-donut-pct');
    if (nEl) nEl.textContent = num;
    if (lEl) lEl.textContent = lbl;
    if (pEl) {
      if (pct !== null) { pEl.textContent = pct + '%'; pEl.style.display = ''; }
      else              { pEl.style.display = 'none'; }
    }
  }

  _initDonut() {
    const db   = this._db;
    const segs = [
      { v: db.villaCount, c: '#B8985A', label: 'Villas',     page: 'offers' },
      { v: db.aptCount,   c: '#1A1A1A', label: 'Apartments', page: 'offers' },
      { v: db.otherCount, c: '#C8B89A', label: 'Other',      page: 'offers' }
    ];
    const total = segs.reduce((s, x) => s + x.v, 0);
    const g     = this.qs('#dash-donut-segs');
    if (!g) return;
    g.innerHTML     = '';
    this._donutPaths = [];

    let deg = 0;
    segs.forEach((seg, i) => {
      const sweep  = (seg.v / total) * 360;
      const endDeg = deg + sweep;
      const midRad = ((deg + endDeg) / 2 - 90) * Math.PI / 180;
      const tx     = (Math.cos(midRad) * 8).toFixed(3);
      const ty     = (Math.sin(midRad) * 8).toFixed(3);
      const pct    = Math.round(seg.v / total * 100);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', this._annularPath(deg, endDeg));
      path.setAttribute('fill', seg.c);
      path.setAttribute('class', 'donut-seg');
      path.style.cursor = 'pointer';

      const allPaths = this._donutPaths;
      const activate = () => {
        path.setAttribute('transform', `translate(${tx},${ty})`);
        allPaths.forEach((p, j) => { if (j !== i) p.style.opacity = '0.45'; });
        this._setDonutCentre(seg.v, seg.label.toUpperCase(), pct);
      };
      const deactivate = () => {
        path.setAttribute('transform', '');
        allPaths.forEach(p => { p.style.opacity = '1'; });
        this._setDonutCentre(total, 'LISTINGS', null);
      };

      path.addEventListener('mouseenter', activate);
      path.addEventListener('mouseleave', deactivate);
      path.addEventListener('click', () => this._nav(seg.page));
      path._activate   = activate;
      path._deactivate = deactivate;

      g.appendChild(path);
      this._donutPaths.push(path);
      deg += sweep;
    });

    this._setDonutCentre(total, 'LISTINGS', null);
  }

  _initLegendSync() {
    this.qsa('.legend-item[data-seg]').forEach(item => {
      const idx = +item.dataset.seg;
      item.addEventListener('mouseenter', () => {
        const p = this._donutPaths[idx];
        if (p && p._activate) p._activate();
      });
      item.addEventListener('mouseleave', () => {
        const p = this._donutPaths[idx];
        if (p && p._deactivate) p._deactivate();
      });
    });
  }

  // ── DOM construction ──────────────────────────────────────────────────────

  _buildDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'dash-root';
    wrap.innerHTML = this._html();
    this.appendChild(wrap);
  }

  _html() {
    const db = this._db;
    return /* html */`

      <header class="admin-topbar" role="banner">
        <div class="atb-inner">
          <div class="atb-left">
            <span class="atb-wordmark">Sharon Homes</span>
            <span class="atb-sep"></span>
            <span class="atb-badge">Admin</span>
          </div>
          <nav class="atb-crumb" aria-label="Breadcrumb">
            <a href="#">Admin</a>
            <span class="atb-crumb-sep">&#8250;</span>
            <span class="atb-crumb-current">Dashboard</span>
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

      <div class="dash-tip" id="dash-tip"></div>

      <main class="dash-page">
        <div class="dash-container">

          <div class="dash-title">Dashboard</div>
          <div class="dash-sub">Live data from Sharon Homes platform &middot; ${db.totalProperties} listings across Cyprus &amp; Greece</div>

          <div class="section-lbl">Portfolio Overview</div>
          <div class="kpi-grid">

            <div class="kpi-card" data-nav="offers" title="Go to Property Offers">
              <div class="kpi-icon kpi-icon-gold">🏘</div>
              <div class="kpi-num" id="dash-kpi-total">0</div>
              <div class="kpi-label">Total Listings</div>
              <div class="kpi-sub"><span class="kpi-pill kpi-pill-green" id="dash-approved-pct">98.1% approved</span></div>
              <div class="kpi-nav-hint">View all &#8594;</div>
            </div>

            <div class="kpi-card kpi-green" data-nav="offers" title="View approved listings">
              <div class="kpi-icon kpi-icon-green">&#10003;</div>
              <div class="kpi-num" id="dash-kpi-approved">0</div>
              <div class="kpi-label">Approved</div>
              <div class="kpi-sub"><span class="kpi-pill kpi-pill-amber" id="dash-pending-pill">${db.pending} pending</span></div>
              <div class="kpi-nav-hint">Filter approved &#8594;</div>
            </div>

            <div class="kpi-card" title="Average listing price">
              <div class="kpi-icon kpi-icon-gold">&#8364;</div>
              <div class="kpi-num" id="dash-kpi-avg">0</div>
              <div class="kpi-label">Avg List Price</div>
              <div class="kpi-sub" id="dash-avg-sub">Max&nbsp;<strong>&#8364;19.5M</strong>&nbsp;&middot;&nbsp;Min&nbsp;<strong>&#8364;160K</strong></div>
            </div>

            <div class="kpi-card kpi-ink" data-nav="requests" title="Go to Buy Requests">
              <div class="kpi-icon kpi-icon-ink">&#128442;</div>
              <div class="kpi-num" id="dash-kpi-br">0</div>
              <div class="kpi-label">Buy Requests</div>
              <div class="kpi-sub"><span class="kpi-pill kpi-pill-green" id="dash-br-pill">All ${db.buyApproved} approved</span></div>
              <div class="kpi-nav-hint">Manage &#8594;</div>
            </div>

          </div>

          <div class="kpi-grid">

            <div class="kpi-card" data-nav="offers" title="View all villas">
              <div class="kpi-icon kpi-icon-gold">&#127969;</div>
              <div class="kpi-num" id="dash-kpi-villa">0</div>
              <div class="kpi-label">Villas</div>
              <div class="kpi-sub">Avg&nbsp;<strong><span class="pc-villa-price">&#8364;915K</span></strong></div>
              <div class="kpi-nav-hint">View villas &#8594;</div>
            </div>

            <div class="kpi-card kpi-ink" data-nav="offers" title="View all apartments">
              <div class="kpi-icon kpi-icon-ink">&#127970;</div>
              <div class="kpi-num" id="dash-kpi-apt">0</div>
              <div class="kpi-label">Apartments</div>
              <div class="kpi-sub">Avg&nbsp;<strong><span class="pc-apt-price">&#8364;548K</span></strong></div>
              <div class="kpi-nav-hint">View apartments &#8594;</div>
            </div>

            <div class="kpi-card kpi-green" title="All properties translated into EN, DE and HE">
              <div class="kpi-icon kpi-icon-green">&#127760;</div>
              <div class="kpi-num" id="dash-kpi-trans">0</div>
              <div class="kpi-label">Fully Translated</div>
              <div class="kpi-sub"><span class="kpi-pill kpi-pill-green">EN &middot; DE &middot; HE</span></div>
            </div>

            <div class="kpi-card" title="Properties flagged as investment opportunities">
              <div class="kpi-icon kpi-icon-gold">&#128200;</div>
              <div class="kpi-num" id="dash-kpi-inv">0</div>
              <div class="kpi-label">Investment Listings</div>
              <div class="kpi-sub"><span class="kpi-pill kpi-pill-gold" id="dash-inv-pct">96.7% of portfolio</span></div>
            </div>

          </div>

          <div class="section-lbl" style="margin-top:6px;">Monthly Trend &amp; Portfolio Mix</div>
          <div class="chart-row chart-row-2">

            <div class="chart-card">
              <div class="chart-title">Monthly Listings Added</div>
              <div class="chart-sub">Hover bars to inspect &mdash; 8 most active months</div>
              <div class="canvas-wrap" style="height:200px;">
                <canvas id="dash-monthlyChart" style="height:200px;cursor:crosshair;"></canvas>
              </div>
            </div>

            <div class="chart-card">
              <div class="chart-title">Portfolio Mix</div>
              <div class="chart-sub">Hover segments to explore &mdash; click to filter</div>
              <div class="donut-wrap">
                <div class="donut-svg-side">
                  <svg id="dash-donutChart" viewBox="0 0 200 200" width="170" height="170"
                       style="overflow:visible;display:block;" aria-label="Portfolio mix donut chart">
                    <g id="dash-donut-segs"></g>
                    <text id="dash-donut-num" x="100" y="89" text-anchor="middle"
                          font-family="Playfair Display,Georgia,serif" font-size="28"
                          font-weight="600" fill="#1A1A1A">${db.totalProperties}</text>
                    <text id="dash-donut-lbl" x="100" y="111" text-anchor="middle"
                          font-family="Inter,system-ui,sans-serif" font-size="9"
                          font-weight="500" fill="#888780" letter-spacing="0.14em">LISTINGS</text>
                    <text id="dash-donut-pct" x="100" y="127" text-anchor="middle"
                          font-family="Inter,system-ui,sans-serif" font-size="12"
                          font-weight="700" fill="#B8985A" style="display:none"></text>
                  </svg>
                </div>
                <div class="donut-legend">
                  <div class="legend-item" data-seg="0">
                    <div class="legend-dot" style="background:#B8985A"></div>
                    <span class="legend-label">Villas</span>
                    <span class="legend-val" id="dash-legend-val-0">${db.villaCount}</span>
                    <span class="legend-pct" id="dash-legend-pct-0">(47%)</span>
                  </div>
                  <div class="legend-item" data-seg="1">
                    <div class="legend-dot" style="background:#1A1A1A"></div>
                    <span class="legend-label">Apartments</span>
                    <span class="legend-val" id="dash-legend-val-1">${db.aptCount}</span>
                    <span class="legend-pct" id="dash-legend-pct-1">(46%)</span>
                  </div>
                  <div class="legend-item" data-seg="2">
                    <div class="legend-dot" style="background:#C8B89A"></div>
                    <span class="legend-label">Other</span>
                    <span class="legend-val" id="dash-legend-val-2">${db.otherCount}</span>
                    <span class="legend-pct" id="dash-legend-pct-2">(7%)</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div class="section-lbl">Price &amp; Bedroom Distribution</div>
          <div class="chart-row chart-row-2">

            <div class="chart-card">
              <div class="chart-title">Price Range Breakdown</div>
              <div class="chart-sub">Hover rows for detail</div>
              <div class="bar-list" id="dash-price-bars"></div>
            </div>

            <div class="chart-card">
              <div class="chart-title">Bedroom Count</div>
              <div class="chart-sub">Hover rows for percentage breakdown</div>
              <div class="bar-list" id="dash-bed-bars" style="margin-bottom:22px;"></div>
              <div class="chart-title">Average Price by Type</div>
              <div style="margin-top:10px;">
                <div class="pc-row" data-nav="offers" title="View all villas">
                  <div>
                    <div class="pc-type">Villa</div>
                    <div class="pc-price pc-villa-price">&#8364;915K</div>
                  </div>
                  <span style="font-size:11px;color:var(--ink-3)" class="pc-villa-count">${db.villaCount} listings</span>
                </div>
                <div class="pc-row pc-apt" data-nav="offers" title="View all apartments">
                  <div>
                    <div class="pc-type">Apartment</div>
                    <div class="pc-price pc-apt-price">&#8364;548K</div>
                  </div>
                  <span style="font-size:11px;color:var(--ink-3)" class="pc-apt-count">${db.aptCount} listings</span>
                </div>
              </div>
            </div>

          </div>

          <div class="section-lbl">Activity &amp; Market</div>
          <div class="chart-row chart-row-2">

            <div class="chart-card">
              <div class="chart-title">Most Recently Added</div>
              <div class="chart-sub">Latest listings &mdash; click to open</div>
              <div class="feed" id="dash-feed"></div>
            </div>

            <div class="chart-card">
              <div class="chart-title">Market Geography</div>
              <div class="chart-sub">Hover the bar to see exact breakdown</div>
              <div class="cs-wrap">
                <div id="dash-cs-cyprus" class="cs-bar cs-cyprus" style="width:0;">99% Cyprus</div>
                <div id="dash-cs-greece" class="cs-bar cs-greece" style="width:0;">&nbsp;Greece</div>
              </div>
              <div style="display:flex;gap:20px;margin-bottom:24px;">
                <div class="legend-item" style="cursor:default;">
                  <div class="legend-dot" style="background:#B8985A;margin-right:8px;"></div>
                  <span class="legend-label">Cyprus</span>
                  <span class="legend-val cs-cyprus-val">&nbsp;${db.cyprus}</span>
                  <span class="legend-pct cs-cyprus-pct">&nbsp;(99%)</span>
                </div>
                <div class="legend-item" style="cursor:default;">
                  <div class="legend-dot" style="background:#1A1A1A;margin-right:8px;"></div>
                  <span class="legend-label">Greece</span>
                  <span class="legend-val cs-greece-val">&nbsp;${db.greece}</span>
                </div>
              </div>
              <div class="chart-title">Platform Stats</div>
              <div class="qs-grid" id="dash-qs-grid" style="margin-top:10px;"></div>
            </div>

          </div>

        </div>
      </main>
    `;
  }

  // ── Nav listeners ─────────────────────────────────────────────────────────

  _setupNavListeners() {
    this.qsa('[data-nav]').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => this._nav(el.dataset.nav));
    });
  }

  // ── Font + Style injection ────────────────────────────────────────────────

  _injectFonts() {
    if (document.querySelector('#dash-fonts')) return;
    const l = document.createElement('link');
    l.id = 'dash-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;500&display=swap';
    document.head.appendChild(l);
  }

  _injectStyles() {
    const s = document.createElement('style');
    s.textContent = DASH_CSS;
    this.insertBefore(s, this.firstChild);
  }
}

// ── CSS ───────────────────────────────────────────────────────────────────

const DASH_CSS = `
.dash-root{
  --bg:#FAF8F5;--surface:#FFFFFF;--ink:#1A1A1A;--ink-2:#444441;--ink-3:#888780;
  --line:rgba(26,26,26,0.12);--gold:#B8985A;--gold-dark:#8C7140;--dark:#1A1A1A;
  --sans:'Inter',system-ui,-apple-system,sans-serif;
  --serif:'Playfair Display',Georgia,'Times New Roman',serif;
  --tf:0.2s ease;
  display:block;font-family:var(--sans);font-size:14px;font-weight:400;
  line-height:1.7;color:var(--ink);background:var(--bg);
  -webkit-font-smoothing:antialiased;min-height:100vh;
}
.dash-root *,.dash-root *::before,.dash-root *::after{margin:0;padding:0;box-sizing:border-box;}
.dash-root a{color:inherit;text-decoration:none;}

.dash-root .admin-topbar{position:relative;background:var(--dark);border-bottom:1px solid rgba(255,255,255,.06);height:56px;display:flex;align-items:center;}
.dash-root .atb-inner{max-width:1240px;margin:0 auto;padding:0 32px;width:100%;display:flex;align-items:center;}
.dash-root .atb-left{display:flex;align-items:center;gap:12px;flex-shrink:0;}
.dash-root .atb-wordmark{font-family:var(--serif);font-size:16px;font-weight:400;color:#fff;letter-spacing:.04em;white-space:nowrap;}
.dash-root .atb-sep{width:1px;height:16px;background:rgba(255,255,255,.15);flex-shrink:0;}
.dash-root .atb-badge{font-size:10px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);background:rgba(184,152,90,.12);border:1px solid rgba(184,152,90,.3);border-radius:3px;padding:3px 8px;}
.dash-root .atb-crumb{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;color:rgba(255,255,255,.4);}
.dash-root .atb-crumb a{color:rgba(255,255,255,.4);transition:color var(--tf);}
.dash-root .atb-crumb a:hover{color:rgba(255,255,255,.7);}
.dash-root .atb-crumb-sep{font-size:10px;color:rgba(255,255,255,.2);}
.dash-root .atb-crumb-current{color:rgba(255,255,255,.85);font-weight:500;}
.dash-root .atb-right{display:flex;align-items:center;gap:16px;flex-shrink:0;}
.dash-root .atb-notif{position:relative;width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background var(--tf);}
.dash-root .atb-notif:hover{background:rgba(255,255,255,.08);}
.dash-root .atb-notif svg{color:rgba(255,255,255,.5);}
.dash-root .atb-notif-dot{position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--gold);border:1.5px solid var(--dark);}
.dash-root .atb-user{display:flex;align-items:center;gap:10px;padding:5px 12px 5px 6px;border-radius:24px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);cursor:pointer;transition:background var(--tf);}
.dash-root .atb-user:hover{background:rgba(255,255,255,.08);}
.dash-root .atb-avatar{width:26px;height:26px;border-radius:50%;background:var(--gold);color:var(--ink);font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.dash-root .atb-uname{font-size:12px;font-weight:500;color:rgba(255,255,255,.75);white-space:nowrap;}

.dash-root .dash-page{background:var(--bg);padding:36px 0 80px;min-height:calc(100vh - 56px);}
.dash-root .dash-container{max-width:1240px;margin:0 auto;padding:0 32px;}
.dash-root .dash-title{font-family:var(--serif);font-size:28px;font-weight:400;color:var(--ink);margin-bottom:4px;}
.dash-root .dash-sub{font-size:12px;color:var(--ink-3);letter-spacing:.04em;margin-bottom:28px;}
.dash-root .section-lbl{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-3);font-weight:500;margin-bottom:12px;margin-top:4px;}

.dash-root .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:14px;}
.dash-root .kpi-card{background:var(--surface);border:0.5px solid var(--line);border-radius:8px;padding:22px 22px 18px;position:relative;overflow:hidden;cursor:pointer;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease;}
.dash-root .kpi-card::before{content:'';position:absolute;top:0;left:0;width:3px;height:100%;background:var(--gold);transition:width .22s ease;}
.dash-root .kpi-card:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(0,0,0,.09);border-color:rgba(184,152,90,.35);}
.dash-root .kpi-card:hover::before{width:5px;}
.dash-root .kpi-card:active{transform:translateY(-2px);}
.dash-root .kpi-card.kpi-green::before{background:#2E7D32;}
.dash-root .kpi-card.kpi-green:hover{border-color:rgba(46,125,50,.3);}
.dash-root .kpi-card.kpi-ink::before{background:var(--ink);}
.dash-root .kpi-card.kpi-ink:hover{border-color:rgba(26,26,26,.25);}
.dash-root .kpi-icon{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;margin-bottom:14px;transition:transform .22s ease;}
.dash-root .kpi-card:hover .kpi-icon{transform:scale(1.12);}
.dash-root .kpi-icon-gold{background:rgba(184,152,90,.1);}
.dash-root .kpi-icon-green{background:rgba(46,125,50,.08);}
.dash-root .kpi-icon-ink{background:rgba(26,26,26,.06);}
.dash-root .kpi-num{font-family:var(--serif);font-size:36px;font-weight:400;line-height:1;color:var(--ink);margin-bottom:5px;letter-spacing:-.02em;}
.dash-root .kpi-label{font-size:11px;color:var(--ink-3);font-weight:500;letter-spacing:.06em;text-transform:uppercase;}
.dash-root .kpi-sub{font-size:11px;color:var(--ink-3);margin-top:7px;display:flex;align-items:center;gap:5px;}
.dash-root .kpi-pill{display:inline-flex;align-items:center;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;letter-spacing:.04em;white-space:nowrap;}
.dash-root .kpi-pill-green{background:#E8F5E9;color:#2E7D32;}
.dash-root .kpi-pill-amber{background:#FFF8E1;color:#E65100;}
.dash-root .kpi-pill-gold{background:rgba(184,152,90,.12);color:var(--gold-dark);}
.dash-root .kpi-nav-hint{position:absolute;bottom:14px;right:16px;font-size:10px;color:var(--gold);font-weight:500;letter-spacing:.06em;opacity:0;transform:translateX(-4px);transition:opacity .2s ease,transform .2s ease;pointer-events:none;}
.dash-root .kpi-card:hover .kpi-nav-hint{opacity:1;transform:translateX(0);}

.dash-root .chart-row{display:grid;gap:14px;margin-bottom:14px;}
.dash-root .chart-row-2{grid-template-columns:1.55fr 1fr;}
.dash-root .chart-card{background:var(--surface);border:0.5px solid var(--line);border-radius:8px;padding:24px;transition:box-shadow .22s ease;}
.dash-root .chart-card:hover{box-shadow:0 6px 24px rgba(0,0,0,.06);}
.dash-root .chart-title{font-size:13px;font-weight:600;color:var(--ink);letter-spacing:.03em;margin-bottom:3px;}
.dash-root .chart-sub{font-size:11px;color:var(--ink-3);margin-bottom:18px;}
.dash-root canvas{display:block;width:100%;}
.dash-root .canvas-wrap{position:relative;}

.dash-root .bar-list{display:flex;flex-direction:column;gap:11px;}
.dash-root .bar-item{display:grid;grid-template-columns:76px 1fr 42px;align-items:center;gap:10px;cursor:pointer;border-radius:4px;padding:4px 4px 4px 0;transition:background .18s ease;}
.dash-root .bar-item:hover{background:rgba(184,152,90,.05);}
.dash-root .bar-item:hover .bar-label{color:var(--ink);font-weight:600;}
.dash-root .bar-item:hover .bar-val{color:var(--gold);}
.dash-root .bar-label{font-size:11px;color:var(--ink-2);font-weight:500;text-align:right;white-space:nowrap;transition:color .18s ease;}
.dash-root .bar-track{height:18px;background:var(--bg);border-radius:3px;overflow:hidden;transition:background .18s ease;}
.dash-root .bar-item:hover .bar-track{background:rgba(184,152,90,.08);}
.dash-root .bar-fill{height:100%;border-radius:3px;transition:width 1.2s cubic-bezier(.16,1,.3,1),filter .18s ease;width:0;}
.dash-root .bar-item:hover .bar-fill{filter:brightness(1.15);}
.dash-root .bar-fill-gold{background:var(--gold);}
.dash-root .bar-fill-green{background:#2E7D32;}
.dash-root .bar-fill-ink{background:var(--ink);}
.dash-root .bar-fill-amber{background:#E65100;}
.dash-root .bar-fill-muted{background:var(--ink-3);}
.dash-root .bar-val{font-size:12px;color:var(--ink);font-weight:600;transition:color .18s ease;}

.dash-root .donut-wrap{display:flex;flex-direction:row;align-items:center;gap:24px;}
.dash-root .donut-svg-side{flex-shrink:0;position:relative;}
.dash-root .donut-legend{flex:1;display:flex;flex-direction:column;gap:4px;}
.dash-root .donut-seg{transition:transform .22s cubic-bezier(.34,1.4,.64,1),opacity .2s ease;cursor:pointer;}
.dash-root .legend-item{display:flex;align-items:center;cursor:pointer;border-radius:6px;padding:9px 10px;transition:background .18s ease;}
.dash-root .legend-item:hover{background:rgba(184,152,90,.07);}
.dash-root .legend-dot{width:11px;height:11px;border-radius:3px;flex-shrink:0;margin-right:10px;transition:transform .18s ease;}
.dash-root .legend-item:hover .legend-dot{transform:scale(1.3);}
.dash-root .legend-label{font-size:13px;color:var(--ink-2);flex:1;transition:color .18s ease;}
.dash-root .legend-item:hover .legend-label{color:var(--ink);font-weight:500;}
.dash-root .legend-val{font-size:13px;font-weight:600;color:var(--ink);}
.dash-root .legend-pct{font-size:11px;color:var(--ink-3);margin-left:5px;}

.dash-root .pc-row{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--bg);border-radius:6px;border-left:3px solid var(--gold);margin-bottom:10px;cursor:pointer;transition:background .2s ease,transform .2s ease,box-shadow .2s ease;}
.dash-root .pc-row:hover{background:rgba(184,152,90,.07);transform:translateX(3px);box-shadow:0 2px 8px rgba(0,0,0,.05);}
.dash-root .pc-row.pc-apt{border-left-color:var(--ink);}
.dash-root .pc-row.pc-apt:hover{background:rgba(26,26,26,.04);}
.dash-root .pc-type{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);font-weight:500;margin-bottom:2px;}
.dash-root .pc-price{font-family:var(--serif);font-size:20px;font-weight:400;color:var(--ink);}

.dash-root .feed{display:flex;flex-direction:column;}
.dash-root .feed-item{display:flex;align-items:center;gap:12px;padding:13px 8px 13px 0;border-bottom:0.5px solid var(--line);cursor:pointer;border-radius:6px;transition:background .18s ease,padding-left .18s ease;outline:none;}
.dash-root .feed-item:last-child{border-bottom:none;}
.dash-root .feed-item:hover,.dash-root .feed-item:focus{background:rgba(184,152,90,.06);padding-left:10px;}
.dash-root .feed-dot{width:32px;height:32px;border-radius:50%;background:rgba(184,152,90,.1);border:1px solid rgba(184,152,90,.2);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;transition:transform .18s ease,background .18s ease;}
.dash-root .feed-item:hover .feed-dot{transform:scale(1.1);background:rgba(184,152,90,.18);}
.dash-root .feed-body{flex:1;min-width:0;}
.dash-root .feed-title{font-size:13px;font-weight:500;color:var(--ink);margin-bottom:3px;line-height:1.4;}
.dash-root .feed-meta{font-size:11px;color:var(--ink-3);}
.dash-root .feed-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:500;background:rgba(184,152,90,.1);color:var(--gold-dark);margin-left:6px;}
.dash-root .feed-arrow{font-size:14px;color:var(--gold);opacity:0;transform:translateX(-4px);transition:opacity .18s ease,transform .18s ease;flex-shrink:0;}
.dash-root .feed-item:hover .feed-arrow,.dash-root .feed-item:focus .feed-arrow{opacity:1;transform:translateX(0);}

.dash-root .qs-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.dash-root .qs-item{background:var(--bg);border-radius:6px;padding:14px;text-align:center;cursor:pointer;border:0.5px solid transparent;transition:border-color .2s ease,transform .2s ease,box-shadow .2s ease;}
.dash-root .qs-item:hover{border-color:rgba(184,152,90,.3);transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.06);}
.dash-root .qs-num{font-family:var(--serif);font-size:24px;font-weight:400;color:var(--gold);line-height:1;margin-bottom:4px;transition:transform .2s ease;}
.dash-root .qs-item:hover .qs-num{transform:scale(1.1);}
.dash-root .qs-label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);font-weight:500;}

.dash-root .cs-wrap{border-radius:6px;overflow:hidden;height:30px;display:flex;margin-bottom:14px;cursor:pointer;}
.dash-root .cs-bar{display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff;transition:width 1.3s cubic-bezier(.16,1,.3,1),filter .2s ease;}
.dash-root .cs-cyprus{background:var(--gold);}
.dash-root .cs-greece{background:var(--ink);}
.dash-root .cs-wrap:hover .cs-cyprus{filter:brightness(1.1);}
.dash-root .cs-wrap:hover .cs-greece{filter:brightness(1.2);}

.dash-root .dash-tip{position:fixed;z-index:9999;background:var(--dark);color:#FAF8F5;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:500;pointer-events:none;opacity:0;transition:opacity .12s ease;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.25);border-left:3px solid var(--gold);}
.dash-root .dash-tip.show{opacity:1;}

@media(max-width:1100px){
  .dash-root .kpi-grid{grid-template-columns:repeat(2,1fr);}
  .dash-root .chart-row-2{grid-template-columns:1fr;}
}
@media(max-width:640px){
  .dash-root .dash-container{padding:0 16px;}
  .dash-root .kpi-grid{grid-template-columns:1fr 1fr;}
  .dash-root .kpi-num{font-size:26px;}
  .dash-root .chart-card{padding:18px;}
  .dash-root .atb-crumb,.dash-root .atb-uname{display:none;}
  .dash-root .donut-wrap{flex-direction:column;}
}
`;

// ── Wire nav after DOM is built ───────────────────────────────────────────

const _origConnected = AdminDashboard.prototype.connectedCallback;
AdminDashboard.prototype.connectedCallback = function() {
  _origConnected.call(this);
  this._setupNavListeners();
};

// ── Register ──────────────────────────────────────────────────────────────

customElements.define('admin-dashboard', AdminDashboard);