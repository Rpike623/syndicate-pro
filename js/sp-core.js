/**
 * deeltrack Core — Auth, Data Access, Org Scoping
 * Include this on every page: <script src="js/sp-core.js"></script>
 */

// ─── Inject Google Analytics ──────────────────────────────────────────────
(function injectGA() {
  if (document.querySelector('script[src*="js/dt-analytics.js"]')) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'js/dt-analytics.js';
  document.head.appendChild(s);
})();

// ─── Inject Global Design System CSS immediately ──────────────────────────
(function injectGlobalCSS() {
  if (document.getElementById('dt-global-css')) return;
  const link = document.createElement('link');
  link.id   = 'dt-global-css';
  link.rel  = 'stylesheet';
  // Resolve path — works whether page is at root or in subdir
  const scriptSrc = (document.currentScript || {}).src || '';
  let base = '';
  if (scriptSrc.includes('js/sp-core.js')) {
    base = scriptSrc.replace(/js\/sp-core\.js.*/, '');
  } else {
    // Fallback: derive from current page URL
    const loc = window.location.pathname;
    const dir = loc.endsWith('/') ? loc : loc.substring(0, loc.lastIndexOf('/') + 1);
    base = window.location.origin + dir;
  }
  link.href = base + 'css/dt-global.css?v=20260309b';
  document.head.appendChild(link);
// Inject Dark Mode Overrides
  const darkLink = document.createElement('link');
  darkLink.id   = 'dt-dark-overrides';
  darkLink.rel  = 'stylesheet';
  darkLink.href = base + 'css/dt-dark-overrides.css';
  document.head.appendChild(darkLink);

  // Inject contrast-fix.css LAST — must load after inline <style> blocks
  // to win the cascade and override per-page color conflicts
  if (!document.getElementById('dt-contrast-fix')) {
    const cfLink = document.createElement('link');
    cfLink.id  = 'dt-contrast-fix';
    cfLink.rel = 'stylesheet';
    cfLink.href = base + 'contrast-fix.css';
    document.head.appendChild(cfLink);
  }

  // Also inject Font Awesome if not present
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const fa = document.createElement('link');
    fa.rel = 'stylesheet';
    fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(fa);
  }
})();

// Use window.SP so all inline scripts and other modules can reliably access it
// (const/let in <script src> tags create script-scoped bindings that can fail
//  to propagate across script boundaries in some browser configurations)
window.SP = (function () {

  // ─── Session ────────────────────────────────────────────────────────────────

  function getSession() {
    try { return JSON.parse(localStorage.getItem('sp_session') || 'null'); } catch(e) { return null; }
  }

  function setSession(s) {
    localStorage.setItem('sp_session', JSON.stringify(s));
    // v2.0 Cross-tab notify
    window.dispatchEvent(new StorageEvent('storage', { key: 'sp_session', newValue: JSON.stringify(s) }));
  }

  function clearSession() {
    localStorage.removeItem('sp_session');
    // v2.0 Cross-tab logout eject
    window.dispatchEvent(new StorageEvent('storage', { key: 'sp_session', newValue: null }));
  }

  function isLoggedIn() {
    const s = getSession();
    if (!s || !s.loggedIn) return false;
    // Expire sessions after 30 days
    const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
    if (s.loginTime && (Date.now() - s.loginTime) > MAX_AGE) {
      clearSession();
      return false;
    }
    return true;
  }

  function isGP() {
    const s = getSession();
    return !!(s && s.loggedIn && s.role !== 'Investor');
  }

  function isInvestor() {
    const s = getSession();
    return !!(s && s.loggedIn && s.role === 'Investor');
  }

  // ─── Org scoping ────────────────────────────────────────────────────────────
  // v2.0 Hardening: Move toward cryptographic UUIDs. 
  // SimpleHash is preserved for legacy migration but flagged as insecure.

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // ── XSS Protection ────────────────────────────────────────────────────────
  // Escape HTML entities in user-supplied strings before inserting via innerHTML.
  // Use SP.esc(str) everywhere you interpolate user data into HTML.
  const _escMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#96;' };
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"'`/]/g, c => _escMap[c]);
  }
  // Alias
  const esc = escapeHtml;

  // DEPRECATED: simpleHash is collision-prone (32-bit). Kept only for legacy orgId lookups.
  // New orgs MUST use generateOrgId() instead.
  function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36);
  }

  // Generate a collision-safe orgId for new signups
  function generateOrgId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return 'org_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    }
    // Fallback for older browsers
    const arr = new Uint8Array(12);
    (typeof crypto !== 'undefined' ? crypto : window.crypto).getRandomValues(arr);
    return 'org_' + Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }

  // All demo accounts share one org so data flows freely between GP and LP views
  // NOTE: demo-gp2 is EXCLUDED from this list to test data isolation — it gets its own unique org
  const DEMO_EMAILS = ['gp@deeltrack.com','demo@deeltrack.com','philip@jchapmancpa.com','investor@deeltrack.com'];
  const DEMO_ORG_ID = 'deeltrack_demo';

  function getOrgId() {
    const s = getSession();
    if (!s) return null;
    // v2.0 Priority: Use stored orgId FIRST — this is the source of truth for all users
    // This ensures each GP gets their own unique orgId, not the shared demo org
    if (s.orgId) return s.orgId;
    // Legacy fallback: only use shared demo org for truly shared demo accounts
    // (demo-gp2 should never reach this line — it always has orgId set in session)
    if (s.email && DEMO_EMAILS.includes(s.email.toLowerCase())) return DEMO_ORG_ID;
    // Final fallback: derive from email hash
    return simpleHash(s.email.toLowerCase());
  }

  function makeOrgKey(key) {
    const orgId = getOrgId();
    if (!orgId) return key; // unscoped fallback
    return `sp_org_${orgId}_${key}`;
  }

  // ─── Storage helpers ────────────────────────────────────────────────────────

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(makeOrgKey(key));
      return raw ? JSON.parse(raw) : (fallback !== undefined ? fallback : null);
    } catch(e) { return fallback !== undefined ? fallback : null; }
  }

  function save(key, value) {
    localStorage.setItem(makeOrgKey(key), JSON.stringify(value));
  }

  // ─── Auth guards ────────────────────────────────────────────────────────────

  function requireGP() {
    // If already have a local session, check immediately
    if (isLoggedIn()) {
      if (isInvestor()) { window.location.href = 'investor-portal.html'; return false; }
      return true;
    }
    // No local session — wait up to 3s for Firebase to authenticate
    const start = Date.now();
    function check() {
      if (isLoggedIn()) {
        if (isInvestor()) { window.location.href = 'investor-portal.html'; return false; }
        return true;
      }
      if (Date.now() - start > 3000) { window.location.href = 'login.html'; return false; }
      setTimeout(check, 100);
    }
    setTimeout(check, 100);
    return true; // optimistic — let page load, redirect if check fails
  }

  function requireInvestor() {
    if (isLoggedIn()) {
      if (isGP()) { window.location.href = 'dashboard.html'; return false; }
      return true;
    }
    const start = Date.now();
    function check() {
      if (isLoggedIn()) {
        if (isGP()) { window.location.href = 'dashboard.html'; return false; }
        return true;
      }
      // If Firebase is still loading (SPFB exists but not ready), wait longer
      const spfbLoading = typeof SPFB !== 'undefined' && !SPFB.isReady();
      const timeout = spfbLoading ? 12000 : 8000;
      if (Date.now() - start > timeout) { window.location.href = 'login.html'; return false; }
      setTimeout(check, 150);
    }
    setTimeout(check, 150);
    return true;
  }

  function requireAuth() {
    if (isLoggedIn()) return true;
    const start = Date.now();
    function check() {
      if (isLoggedIn()) return true;
      if (Date.now() - start > 3000) { window.location.href = 'login.html'; return false; }
      setTimeout(check, 100);
    }
    setTimeout(check, 100);
    return true;
  }

  // ─── Deals ──────────────────────────────────────────────────────────────────

  function getDeals() {
    // Merge sp_deals + pipelineDeals for backwards compat, then unify
    const orgDeals = load('deals', null);
    if (orgDeals !== null) return orgDeals;
    // First load: migrate from legacy keys
    const legacy1 = JSON.parse(localStorage.getItem('sp_deals') || '[]');
    const legacy2 = JSON.parse(localStorage.getItem('pipelineDeals') || '[]');
    const merged = mergeLegacyDeals(legacy1, legacy2);
    save('deals', merged);
    return merged;
  }

  function mergeLegacyDeals(spDeals, pipelineDeals) {
    // sp_deals and pipelineDeals have different shapes — normalize both
    const out = [];
    const seen = new Set();

    spDeals.forEach(d => {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        out.push(normalizeSpDeal(d));
      }
    });

    pipelineDeals.forEach(d => {
      const id = d.id || ('pd_' + (d.name||'').replace(/\s+/g,'_').toLowerCase());
      if (!seen.has(id)) {
        seen.add(id);
        out.push(normalizePipelineDeal(d, id));
      }
    });

    return out;
  }

  function normalizeSpDeal(d) {
    // Spread all fields first so extended wizard data (wizardData, prefReturn,
    // purchasePrice, etc.) is preserved, then enforce required shape on top.
    return {
      ...d,
      id: d.id,
      name: d.name || 'Unnamed Deal',
      type: d.type || 'other',
      location: d.location || '',
      raise: d.raise || 0,
      irr: d.irr || 0,
      equity: d.equity || 0,
      units: d.units || 0,
      status: d.status || 'sourcing',
      added: d.added || new Date().toISOString().split('T')[0],
      investors: d.investors || [],
      documents: d.documents || [],
      notes: d.notes || '',
    };
  }

  function normalizePipelineDeal(d, id) {
    return {
      id,
      name: d.title || d.name || 'Unnamed Deal',
      type: (d.type || 'other').toLowerCase(),
      location: d.location || '',
      raise: parseFloat(d.raise || d.targetRaise || 0),
      irr: parseFloat(d.irr || d.targetIRR || 0),
      equity: parseFloat(d.equityMultiple || d.equity || 0),
      units: parseInt(d.units || 0),
      status: (d.stage || d.status || 'sourcing').toLowerCase(),
      added: d.dateAdded || d.added || new Date().toISOString().split('T')[0],
      investors: [],
      documents: [],
      notes: d.notes || d.description || '',
    };
  }

  function saveDeals(deals) {
    save('deals', deals);
  }

  function getDealById(id) {
    return getDeals().find(d => d.id === id) || null;
  }

  function getDealsForInvestor(investorId) {
    return getDeals().filter(d =>
      Array.isArray(d.investors) && d.investors.some(i => i.investorId === investorId)
    );
  }

  function getDealsForCurrentInvestor() {
    const inv = getCurrentInvestorRecord();
    if (!inv) return [];
    return getDealsForInvestor(inv.id);
  }

  // Add investor to a deal
  function addInvestorToDeal(dealId, entry) {
    // entry = { investorId, committed, ownership, status }
    const deals = getDeals();
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return false;
    if (!Array.isArray(deal.investors)) deal.investors = [];
    const existing = deal.investors.findIndex(i => i.investorId === entry.investorId);
    if (existing >= 0) {
      deal.investors[existing] = { ...deal.investors[existing], ...entry };
    } else {
      deal.investors.push(entry);
    }
    saveDeals(deals);
    return true;
  }

  function removeInvestorFromDeal(dealId, investorId) {
    const deals = getDeals();
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return false;
    deal.investors = (deal.investors || []).filter(i => i.investorId !== investorId);
    saveDeals(deals);
    return true;
  }

  // ─── Investors ──────────────────────────────────────────────────────────────

  function getInvestors() {
    const orgInvestors = load('investors', null);
    if (orgInvestors !== null) return orgInvestors;
    // Migrate legacy
    const legacy = JSON.parse(localStorage.getItem('sp_investors') || '[]');
    save('investors', legacy);
    return legacy;
  }

  function saveInvestors(investors) {
    save('investors', investors);
  }

  function getInvestorByEmail(email) {
    return getInvestors().find(i => i.email.toLowerCase() === email.toLowerCase()) || null;
  }

  function getInvestorById(id) {
    return getInvestors().find(i => i.id === id) || null;
  }

  // Returns the investor record for the currently logged-in investor user
  function getCurrentInvestorRecord() {
    const s = getSession();
    if (!s || !s.email) return null;
    return getInvestorByEmail(s.email);
  }

  // ─── Activity log ────────────────────────────────────────────────────────────

  function logActivity(icon, color, text) {
    const activity = load('activity', []);
    const now = new Date();
    const timeStr = 'Just now';
    activity.unshift({ icon, color, text, time: timeStr, ts: Date.now() });
    save('activity', activity.slice(0, 50));
  }

  function getActivity() {
    return load('activity', []);
  }

  // ─── Users (global, not org-scoped — credentials are cross-org) ─────────────

  function getUsers() {
    try { return JSON.parse(localStorage.getItem('sp_users') || '[]'); } catch(e) { return []; }
  }

  function saveUsers(users) {
    localStorage.setItem('sp_users', JSON.stringify(users));
  }

  function getUserByEmail(email) {
    return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  function createUser(email, _password, name, role, orgId) {
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) return false;
    // Never store plaintext passwords — use Firebase Auth for real auth
    users.push({ email, name, role, orgId });
    saveUsers(users);
    return true;
  }

  // ── Demo Account Registry ──────────────────────────────────────────────────
  // Hardcoded demo accounts — these are the ONLY accounts that can use local auth.
  // Real users MUST authenticate via Firebase Auth.
  const DEMO_ACCOUNTS = {
    'gp@deeltrack.com':         { name: 'Robert Pike',   role: 'General Partner', orgId: 'deeltrack_demo' },
    'demo@deeltrack.com':       { name: 'Robert Pike',   role: 'General Partner', orgId: 'deeltrack_demo' },
    'philip@jchapmancpa.com':   { name: 'Phil Chapman',  role: 'Investor',        orgId: 'deeltrack_demo' },
    'investor@deeltrack.com':   { name: 'Demo Investor', role: 'Investor',        orgId: 'deeltrack_demo' },
    'demo-gp2@deeltrack.com':   { name: 'Marcus Rivera', role: 'General Partner', orgId: 'marcus_rivera_org' },
  };
  const DEMO_PASSWORD = 'Demo1234!';

  function isDemoEmail(email) {
    return !!DEMO_ACCOUNTS[(email || '').toLowerCase()];
  }

  function authenticate(email, password) {
    const emailLc = (email || '').toLowerCase();

    // ONLY demo accounts can use local auth — reject everything else
    if (!DEMO_ACCOUNTS[emailLc]) {
      // Not a demo account — must use Firebase Auth (handled by login.html)
      return null;
    }

    if (password !== DEMO_PASSWORD) return null;

    const demo = DEMO_ACCOUNTS[emailLc];
    const session = {
      email: emailLc, name: demo.name, role: demo.role,
      orgId: demo.orgId, loggedIn: true, loginTime: Date.now(),
      isDemo: true, // Flag for UI to show demo indicators
    };
    setSession(session);

    // Seed rich demo data for both GP and Phil the Investor on first login
    if (['demo@deeltrack.com','gp@deeltrack.com','philip@jchapmancpa.com'].includes(emailLc)) {
      seedDemoData(session);
    }

    return session;
  }

  function logout() {
    clearSession();
    // Also sign out of Firebase Auth to prevent auto-re-login
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().signOut().catch(() => {}).finally(() => {
        window.location.href = 'login.html';
      });
    } else {
      window.location.href = 'login.html';
    }
  }

  // ─── Demo data seeding ──────────────────────────────────────────────────────
  function seedDemoData(session) {
    // Always seed under the shared demo org key
    const demoOrgKey = `sp_org_${DEMO_ORG_ID}_deals`;
    if (localStorage.getItem(demoOrgKey)) return; // already seeded locally

    // After SPData initializes, push all seed data to Firestore.
    // Also re-push on every subsequent spdata-ready in case prior push was interrupted.
    // Uses a localStorage flag to track whether Firestore has received the seed.
    const FS_SEED_KEY = `sp_org_${DEMO_ORG_ID}_fs_seeded`;
    function _pushSeedToFirestore() {
      if (localStorage.getItem(FS_SEED_KEY)) return; // already pushed
      if (typeof SPData === 'undefined' || !SPData.isReady()) return;
      console.log('[seed] Pushing seed data to Firestore...');
      try {
        SPData.saveDeals(SP.getDeals());
        SPData.saveInvestors(SP.getInvestors());
        SPData.saveDistributions(SP.getDistributions());
        SPData.saveCapitalCalls(SP.getCapitalCalls());
        if (SPData.saveSettings) SPData.saveSettings(SP.load('settings', {}));
        const k1s = SP.load('k1_vault', []);
        if (k1s.length) SP.save('k1_vault', k1s);
        const updates = SP.load('published_updates', []);
        if (updates.length) SP.save('published_updates', updates);
        localStorage.setItem(FS_SEED_KEY, '1'); // mark as pushed
        console.log('[seed] Firestore seed complete');
      } catch(e) { console.warn('[seed] Firestore push failed (will retry):', e.message); }
    }
    window.addEventListener('spdata-ready', _pushSeedToFirestore);

    // Settings
    save('settings', {
      firmName: 'Pike Capital Management LLC',
      firmDBA: 'Pike Capital',
      firmEntityType: 'LLC',
      firmEIN: '47-1234567',
      firmState: 'TX',
      firmAddress: '500 Throckmorton St, Suite 800, Fort Worth, TX 76102',
      firmEmail: 'robert@pikecapital.com',
      firmPhone: '(817) 555-0100',
      firmWebsite: 'https://pikecapital.com',
      gpFullName: 'Robert Pike',
      gpTitle: 'Managing Member',
      gpEmail: 'robert@pikecapital.com',
      gpPhone: '(817) 555-0101',
      defPref: '8',
      defPromote: '20',
      defGPEquity: '10',
      defHold: '5',
      defState: 'TX',
      defSEC: '506b',
    });

    // Investors
    const investors = [
      { id:'di1', firstName:'James', lastName:'Hartwell', email:'j.hartwell@demo.deeltrack.com', phone:'(214) 555-0101', address:'4521 Oak Blvd, Dallas, TX 75201', accredMethod:'cpa', accredStatus:'verified', accredDate:'2024-03-15', accredExpiry:'2026-03-15', minInvest:100000, maxInvest:500000, totalInvested:650000, deals:2, status:'active', notes:'High net worth individual. Prefers multifamily.' },
      { id:'di2', firstName:'Sarah', lastName:'Chen', email:'s.chen@demo.deeltrack.com', phone:'(713) 555-0202', address:'1800 Post Oak Blvd, Houston, TX 77056', accredMethod:'entity', accredStatus:'verified', accredDate:'2024-01-10', accredExpiry:'2026-01-10', minInvest:250000, maxInvest:1000000, totalInvested:1000000, deals:2, status:'active', notes:'Family office rep. Very responsive.' },
      { id:'di3', firstName:'Marcus', lastName:'Williams', email:'mwilliams@demo.deeltrack.com', phone:'(512) 555-0303', address:'200 W Cesar Chavez, Austin, TX 78701', accredMethod:'attorney', accredStatus:'verified', accredDate:'2024-06-01', accredExpiry:'2026-06-01', minInvest:50000, maxInvest:250000, totalInvested:250000, deals:1, status:'active', notes:'First-time syndication investor.' },
      { id:'di4', firstName:'Priya', lastName:'Patel', email:'ppatel@demo.deeltrack.com', phone:'(469) 555-0404', address:'5000 Granite Pkwy, Plano, TX 75024', accredMethod:'cpa', accredStatus:'verified', accredDate:'2025-01-15', accredExpiry:'2027-01-15', minInvest:500000, maxInvest:2000000, totalInvested:1000000, deals:1, status:'active', notes:'Prefers industrial. Long-term hold.' },
      { id:'i7', firstName:'Phil', lastName:'Chapman', email:'philip@jchapmancpa.com', phone:'(817) 555-9000', address:'Fort Worth, TX', accredMethod:'cpa', accredStatus:'verified', accredDate:'2025-01-01', accredExpiry:'2027-01-01', minInvest:50000, maxInvest:500000, totalInvested:1075000, deals:8, status:'active', notes:'High-level CPA investor.' },
    ];
    save('investors', investors);

    function makeOA(deal, gpName, gpRep) {
      // Use the professional SPDocs generator if available
      if (typeof SPDocs !== 'undefined' && SPDocs.generateOA) {
        const state = deal.state || 'TX';
        const minInv = deal.minInvestment || 50000;
        const addr = '500 Throckmorton St, Suite 800, Fort Worth, TX 76102';
        return SPDocs.generateOA(deal, gpName, gpRep, addr, state, minInv, []);
      }
      // Minimal fallback if sp-documents.js hasn't loaded yet
      const state = deal.state || 'TX';
      const equity = deal.totalEquity || deal.raise || 0;
      const pref = deal.prefReturn || 8;
      const promote = deal.gpPromote || 20;
      return '<div style="font-family:Times New Roman,serif;padding:40px;"><p style="text-align:center;font-weight:bold;">OPERATING AGREEMENT OF ' + (deal.companyName || gpName) + '</p><p style="text-align:center;">A ' + state + ' Limited Liability Company</p><p>Total Equity: $' + equity.toLocaleString() + ' · Pref: ' + pref + '% · Promote: ' + promote + '%</p><p style="font-size:9pt;border:1px solid #999;padding:8px;margin-top:24px;">DRAFT — This placeholder was generated because the full document generator was not available at seed time. Re-generate from Deal Detail to get the complete 12-article operating agreement.</p></div>';
    }

    const deals = [
      {
        id:'live_d1', name:'Pecan Hollow Apartments', type:'multifamily', raise:5500000, irr:19.4, equity:2.1,
        imageUrl:'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=400&fit=crop',
        status:'raising', location:'Fort Worth, TX', added:new Date().toISOString().split('T')[0], units:128, state:'TX',
        companyName:'Pecan Hollow Partners LLC', purchasePrice:24500000, loanAmount:19000000,
        totalEquity:5500000, gpEquity:10, lpEquity:90, prefReturn:8, gpPromote:20, acqFee:3, assetMgmtFee:2,
        investors:[
          {investorId:'i7',committed:250000,ownership:4.54,status:'active',linkedAt:new Date().toISOString(),subStatus:'signed'},
          {investorId:'di1',committed:300000,ownership:5.45,status:'active',linkedAt:new Date().toISOString(),subStatus:'funded'},
        ],
        documents:[], notes:'128-unit B+ value-add opportunity. 1980s build. Under market rents by $175/unit. Plans for $1.2M renovation cap-ex.'
      },
      {
        id:'d1', name:'Riverside Flats', type:'multifamily', raise:4200000, irr:18.5, equity:1.9,
        imageUrl:'https://images.unsplash.com/photo-1460317442991-0ec209397118?w=600&h=400&fit=crop',
        status:'operating', location:'Austin, TX', added:'2025-11-10', closeDate:'2025-11-15', units:96, state:'TX',
        companyName:'Riverside Flats Capital LLC', purchasePrice:21000000, loanAmount:16800000,
        totalEquity:4200000, gpEquity:10, lpEquity:90, prefReturn:8, gpPromote:20, acqFee:3, assetMgmtFee:2,
        // OA generated below after deals array is built
        investors:[
          {investorId:'di1',committed:250000,ownership:5.95,status:'active',linkedAt:'2025-11-15T10:00:00.000Z',subStatus:'signed'},
          {investorId:'di2',committed:500000,ownership:11.9,status:'active',linkedAt:'2025-11-15T10:00:00.000Z',subStatus:'funded'},
          {investorId:'di3',committed:250000,ownership:5.95,status:'active',linkedAt:'2025-11-20T10:00:00.000Z',subStatus:'signed'},
          {investorId:'i7',committed:200000,ownership:4.76,status:'active',linkedAt:'2025-11-18T10:00:00.000Z',subStatus:'funded'},
        ],
        documents:[], notes:'96-unit Class B multifamily. Value-add play with $200/unit rent upside.'
      },
      {
        id:'d2', name:'Meridian Industrial', type:'industrial', raise:7500000, irr:21.2, equity:2.1,
        imageUrl:'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&h=400&fit=crop',
        status:'closed', location:'Dallas, TX', added:'2025-12-01', closeDate:'2025-12-01', units:0, state:'TX',
        companyName:'Meridian Industrial Capital LLC', purchasePrice:37500000, loanAmount:30000000,
        totalEquity:7500000, gpEquity:10, lpEquity:90, prefReturn:8, gpPromote:20, acqFee:3, assetMgmtFee:2,
        investors:[
          {investorId:'di2',committed:500000,ownership:6.67,status:'active',linkedAt:'2025-12-10T10:00:00.000Z',subStatus:'funded'},
          {investorId:'di4',committed:1000000,ownership:13.33,status:'active',linkedAt:'2025-12-10T10:00:00.000Z',subStatus:'funded'},
        ],
        documents:[], notes:'750k SF industrial park. NNN leases in place.'
      },
      {
        id:'d3', name:'The Hudson Portfolio', type:'multifamily', raise:12000000, irr:16.8, equity:1.7,
        imageUrl:'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop',
        status:'operating', location:'Houston, TX', added:'2026-01-15', closeDate:'2026-01-20', units:248, state:'TX',
        companyName:'Hudson Portfolio Capital LLC', purchasePrice:60000000, loanAmount:48000000,
        totalEquity:12000000, gpEquity:10, lpEquity:90, prefReturn:8, gpPromote:20, acqFee:3, assetMgmtFee:2,
        // OA generated below after deals array is built
        investors:[
          {investorId:'di1',committed:400000,ownership:3.33,status:'active',linkedAt:'2026-01-20T10:00:00.000Z',subStatus:'funded'},
          {investorId:'di2',committed:500000,ownership:4.17,status:'active',linkedAt:'2026-01-20T10:00:00.000Z',subStatus:'funded'},
          {investorId:'i7',committed:300000,ownership:2.5,status:'active',linkedAt:'2026-01-22T10:00:00.000Z',subStatus:'funded'},
        ],
        documents:[], notes:'248-unit portfolio across 3 Houston submarkets.'
      },
      {
        id:'d4', name:'Parkview Commons', type:'multifamily', raise:3100000, irr:19.0, equity:1.95,
        imageUrl:'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=600&h=400&fit=crop',
        status:'dd', location:'San Antonio, TX', added:'2026-02-01', units:72, state:'TX',
        companyName:'Parkview Commons Capital LLC', purchasePrice:15500000, loanAmount:12400000,
        totalEquity:3100000, gpEquity:10, lpEquity:90, prefReturn:8, gpPromote:20, acqFee:3, assetMgmtFee:2,
        investors:[], documents:[], notes:'72-unit Class C value-add in San Antonio.',
        due: new Date(Date.now() + 5*86400000).toISOString().split('T')[0]
      },
      {
        id:'d5', name:'Westgate Retail Center', type:'retail', raise:5800000, irr:14.5, equity:1.6,
        imageUrl:'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=400&fit=crop',
        status:'loi', location:'Fort Worth, TX', added:'2026-02-10', units:0, state:'TX',
        companyName:'Westgate Retail Capital LLC', purchasePrice:29000000, loanAmount:23200000,
        totalEquity:5800000, gpEquity:10, lpEquity:90, prefReturn:7, gpPromote:20, acqFee:2.5, assetMgmtFee:2,
        investors:[], documents:[], notes:'42k SF anchored retail center.',
        due: new Date(Date.now() + 12*86400000).toISOString().split('T')[0]
      },
    ];

    // Generate professional OAs for ALL demo deals
    // If SPDocs isn't loaded yet, load it synchronously via XHR
    if (typeof SPDocs === 'undefined') {
      try {
        const script = document.createElement('script');
        script.src = 'js/sp-documents.js';
        script.async = false; // synchronous load
        document.head.appendChild(script);
      } catch(e) { console.warn('[seed] Could not load sp-documents.js:', e); }
    }
    const _gpName = 'Pike Capital Management LLC';
    const _gpRep = 'Robert Pike';
    deals.forEach(d => {
      d.generatedOA = makeOA(d, _gpName, _gpRep);
      d.oaGeneratedAt = new Date().toISOString();
    });

    save('deals', deals);

    // ── Distributions — pref-aware, status:'posted' so pref engine counts them ──
    // Riverside Flats (d1): 8% pref, 3 investors, closeDate 2025-11-15
    //   di1: $250k × 8% / 4 = $5,000 Q pref; di2: $500k × 8% / 4 = $10,000; di3: $250k × 8% / 4 = $5,000
    //   Q4 2025 total pref due = $20,000. Dist = $84,000 → $20k pref + $64k excess split 5.95/11.9/5.95 of LP 23.8%
    //   LP excess pool: $64,000 split among 23.8% LP ownership (di1:5.95, di2:11.9, di3:5.95 = 23.8 total)
    //   di1 excess: 64000*(5.95/23.8)=16000, di2: 32000, di3: 16000
    //   di1 total: 5000+16000=21000, di2: 10000+32000=42000, di3: 5000+16000=21000 = 84000 ✓
    save('distributions', [
      {
        id:'dd1', dealId:'d1', dealName:'Riverside Flats',
        period:'Q4 2025', quarter:'Q4', year:2025,
        totalAmount:100800, amount:100800,
        date:'2026-01-05', method:'Wire',
        status:'posted', prefAware:true,
        investorCount:3,
        recipients:[
          { investorId:'di1', ownership:5.95, invested:250000,
            prefPaidThisDist:5000, excessThisDist:16000, totalThisDist:21000,
            amount:21000, prefPaidToDate:5000, prefRemainingAfterDist:0 },
          { investorId:'di2', ownership:11.9, invested:500000,
            prefPaidThisDist:10000, excessThisDist:32000, totalThisDist:42000,
            amount:42000, prefPaidToDate:10000, prefRemainingAfterDist:0 },
          { investorId:'di3', ownership:5.95, invested:250000,
            prefPaidThisDist:5000, excessThisDist:16000, totalThisDist:21000,
            amount:21000, prefPaidToDate:5000, prefRemainingAfterDist:0 },
          { investorId:'i7', ownership:4.76, invested:200000,
            prefPaidThisDist:4000, excessThisDist:12800, totalThisDist:16800,
            amount:16800, prefPaidToDate:4000, prefRemainingAfterDist:0 },
        ]
      },
      // Q1 2026 Riverside Flats dist
      // Phil i7: $200k × 8%/4 = $4k pref; excess share 4.76/28.56 of $70k = ~11,660
      {
        id:'dd3', dealId:'d1', dealName:'Riverside Flats',
        period:'Q1 2026', quarter:'Q1', year:2026,
        totalAmount:105660, amount:105660,
        date:'2026-04-05', method:'Wire',
        status:'posted', prefAware:true,
        investorCount:3,
        recipients:[
          { investorId:'di1', ownership:5.95, invested:250000,
            prefPaidThisDist:5000, excessThisDist:17500, totalThisDist:22500,
            amount:22500, prefPaidToDate:10000, prefRemainingAfterDist:0 },
          { investorId:'di2', ownership:11.9, invested:500000,
            prefPaidThisDist:10000, excessThisDist:35000, totalThisDist:45000,
            amount:45000, prefPaidToDate:20000, prefRemainingAfterDist:0 },
          { investorId:'di3', ownership:5.95, invested:250000,
            prefPaidThisDist:5000, excessThisDist:17500, totalThisDist:22500,
            amount:22500, prefPaidToDate:10000, prefRemainingAfterDist:0 },
          { investorId:'i7', ownership:4.76, invested:200000,
            prefPaidThisDist:4000, excessThisDist:11660, totalThisDist:15660,
            amount:15660, prefPaidToDate:8000, prefRemainingAfterDist:0 },
        ]
      },
      // Meridian Industrial (d2): 8% pref, closeDate 2025-12-01
      //   di2: $500k×8%/4=$10k Q pref; di4: $1M×8%/4=$20k Q pref = $30k total
      //   Q4 2025 dist=$150,000 → $30k pref + $120k excess
      //   LP ownership: di2 6.67%, di4 13.33% (total 20%)
      //   di2 excess: 120000*(6.67/20)=40,020; di4 excess: 80,016 ≈ rounding to 120000
      //   di2 total: 10000+40020=50020, di4: 20000+79980=99980
      {
        id:'dd2', dealId:'d2', dealName:'Meridian Industrial',
        period:'Q4 2025', quarter:'Q4', year:2025,
        totalAmount:150000, amount:150000,
        date:'2026-01-08', method:'Wire',
        status:'posted', prefAware:true,
        investorCount:2,
        recipients:[
          { investorId:'di2', ownership:6.67, invested:500000,
            prefPaidThisDist:10000, excessThisDist:40020, totalThisDist:50020,
            amount:50020, prefPaidToDate:10000, prefRemainingAfterDist:0 },
          { investorId:'di4', ownership:13.33, invested:1000000,
            prefPaidThisDist:20000, excessThisDist:79980, totalThisDist:99980,
            amount:99980, prefPaidToDate:20000, prefRemainingAfterDist:0 },
        ]
      },
    ]);

    // Capital calls — include one for Phil's deal (Pecan Hollow)
    save('capitalCalls', [
      { id:'cc1', dealId:'d1', dealName:'Riverside Flats', callNumber:'Initial', amount:4200000, dueDate:'2025-11-20', purpose:'Property acquisition and closing costs', wireInstructions:'Chase Bank, Acct 9981-2200, ABA 021000021, Ref: RF-CC1', status:'received', sentAt:'2025-11-10T09:00:00.000Z', receivedAt:'2025-11-18T09:00:00.000Z' },
      { id:'cc2', dealId:'d4', dealName:'Parkview Commons', callNumber:'Initial', amount:3100000, dueDate:new Date(Date.now()+10*86400000).toISOString().split('T')[0], purpose:'Property acquisition — pending due diligence completion', wireInstructions:'Chase Bank, Acct 9981-3300, ABA 021000021, Ref: PC-CC1', status:'sent', sentAt:new Date().toISOString() },
      { id:'cc3', dealId:'live_d1', dealName:'Pecan Hollow Apartments', callNumber:'Initial', amount:5500000, dueDate:new Date(Date.now()+21*86400000).toISOString().split('T')[0], purpose:'Property acquisition — closing scheduled Q2 2026', wireInstructions:'Chase Bank, Acct 9981-1100, ABA 021000021, Ref: PH-CC1', status:'sent', sentAt:new Date(Date.now()-3*86400000).toISOString() },
      { id:'cc4', dealId:'d3', dealName:'The Hudson Portfolio', callNumber:'Renovation Cap-Ex', amount:2400000, dueDate:new Date(Date.now()-5*86400000).toISOString().split('T')[0], purpose:'Phase 1 renovation — units 101-148', wireInstructions:'Chase Bank, Acct 9981-4400, ABA 021000021, Ref: HP-CC2', status:'sent', sentAt:new Date(Date.now()-15*86400000).toISOString() },
    ]);

    // K-1 vault — Phil gets K-1s for his deals, other investors get theirs
    save('k1_vault', [
      { id:'k1_1', dealId:'d1', investorId:'i7', taxYear:2025, entityType:'Partnership', entityName:'Riverside Flats Capital LLC', entityEIN:'47-9876543', status:'sent', sentAt:'2026-02-15T10:00:00.000Z', ordinaryIncome:-2400, rentalIncome:32460, capitalGain:0, section199A:32460, fileData:null },
      { id:'k1_2', dealId:'d1', investorId:'di1', taxYear:2025, entityType:'Partnership', entityName:'Riverside Flats Capital LLC', entityEIN:'47-9876543', status:'sent', sentAt:'2026-02-15T10:00:00.000Z', ordinaryIncome:-3000, rentalIncome:42000, capitalGain:0, section199A:42000, fileData:null },
      { id:'k1_3', dealId:'d1', investorId:'di2', taxYear:2025, entityType:'Partnership', entityName:'Riverside Flats Capital LLC', entityEIN:'47-9876543', status:'sent', sentAt:'2026-02-15T10:00:00.000Z', ordinaryIncome:-6000, rentalIncome:87000, capitalGain:0, section199A:87000, fileData:null },
      { id:'k1_4', dealId:'d1', investorId:'di3', taxYear:2025, entityType:'Partnership', entityName:'Riverside Flats Capital LLC', entityEIN:'47-9876543', status:'sent', sentAt:'2026-02-15T10:00:00.000Z', ordinaryIncome:-3000, rentalIncome:42000, capitalGain:0, section199A:42000, fileData:null },
      { id:'k1_5', dealId:'d2', investorId:'di2', taxYear:2025, entityType:'Partnership', entityName:'Meridian Industrial Capital LLC', entityEIN:'47-5678901', status:'sent', sentAt:'2026-02-20T10:00:00.000Z', ordinaryIncome:0, rentalIncome:50020, capitalGain:0, section199A:50020, fileData:null },
      { id:'k1_6', dealId:'d2', investorId:'di4', taxYear:2025, entityType:'Partnership', entityName:'Meridian Industrial Capital LLC', entityEIN:'47-5678901', status:'sent', sentAt:'2026-02-20T10:00:00.000Z', ordinaryIncome:0, rentalIncome:99980, capitalGain:0, section199A:99980, fileData:null },
    ]);

    // Investor updates (GP → LP communications)
    save('published_updates', [
      {
        id:'upd1', dealName:'Riverside Flats', title:'Q4 2025 Quarterly Update — Riverside Flats',
        date:'2026-01-10', from:'Robert Pike',
        occupancy:'94.2', noi:'$482,000', collections:'97.8', capex:'$85,000',
        narrative:'Strong quarter at Riverside. We completed the first phase of interior renovations (32 units) and are seeing $125-$175/mo rent bumps on renovated units. Occupancy dipped briefly during turns but recovered quickly. Collections remain excellent.',
        highlights:'Rent growth tracking 12% above underwriting. Phase 1 reno on schedule and under budget by $22K.',
        concerns:'Insurance renewal came in 18% higher than projected. Exploring alternative carriers for Q2.'
      },
      {
        id:'upd2', dealName:'The Hudson Portfolio', title:'Acquisition Complete — The Hudson Portfolio',
        date:'2026-01-22', from:'Robert Pike',
        occupancy:'91.5', noi:'$1,240,000', collections:'96.1', capex:'$0',
        narrative:'Happy to report we successfully closed on The Hudson Portfolio — 248 units across three Houston submarkets. All three properties are stabilized with existing management in place. We\'ll be transitioning to our preferred PM company over the next 60 days.',
        highlights:'Closed at $242K/door, 8% below initial ask. Seller credits of $380K secured for deferred maintenance.',
        concerns:'Property 3 (Westheimer location) has 6 units down for maintenance. Targeting 95%+ occupancy by Q2.'
      },
      {
        id:'upd3', dealName:'Pecan Hollow Apartments', title:'Due Diligence Update — Pecan Hollow',
        date:'2026-03-01', from:'Robert Pike',
        narrative:'Inspection complete on Pecan Hollow. The property is in better shape than expected — roof was replaced in 2022, HVAC systems are 2019 vintage. Main cap-ex items: parking lot resurfacing ($180K), unit interiors ($850K for 128 units), and clubhouse renovation ($170K). Total reno budget: $1.2M, right in line with our underwriting. We\'re targeting a May closing.',
        highlights:'Property condition exceeded expectations. Reno budget confirmed at $1.2M.',
      },
    ]);

    // Activity log
    save('activity', [
      { icon:'fa-bullhorn', color:'blue', text:'Investor update posted: <strong>Due Diligence Update — Pecan Hollow</strong>', time:'Mar 1, 2026', ts:1740787200000 },
      { icon:'fa-file-invoice-dollar', color:'green', text:'K-1s sent to 4 investors for <strong>Riverside Flats</strong> (TY 2025)', time:'Feb 15, 2026', ts:1739577600000 },
      { icon:'fa-hand-holding-usd', color:'amber', text:'Capital call of <strong>$5,500,000</strong> issued for <strong>Pecan Hollow Apartments</strong>', time:'Mar 6, 2026', ts:1741219200000 },
      { icon:'fa-wallet', color:'purple', text:'Q1 2026 distribution of <strong>$90,000</strong> posted for <strong>Riverside Flats</strong> — 4 investors', time:'Apr 5, 2026', ts:1743811200000 },
      { icon:'fa-wallet', color:'purple', text:'Q4 distribution of <strong>$84,000</strong> sent to 4 investors from Riverside Flats', time:'Jan 5, 2026', ts:1736035200000 },
      { icon:'fa-wallet', color:'purple', text:'Q4 distribution of <strong>$150,000</strong> sent to 2 investors from Meridian Industrial', time:'Jan 8, 2026', ts:1736294400000 },
      { icon:'fa-bullhorn', color:'blue', text:'Investor update posted: <strong>Acquisition Complete — The Hudson Portfolio</strong>', time:'Jan 22, 2026', ts:1737504000000 },
      { icon:'fa-building', color:'blue', text:'<strong>The Hudson Portfolio</strong> added — 248 units in Houston', time:'Jan 15, 2026', ts:1736899200000 },
      { icon:'fa-user-plus', color:'green', text:'<strong>Phil Chapman</strong> added to The Hudson Portfolio — $300K commitment', time:'Jan 22, 2026', ts:1737504000000 },
      { icon:'fa-user-plus', color:'green', text:'<strong>Priya Patel</strong> linked to Meridian Industrial — $1M commitment', time:'Dec 10, 2025', ts:1733788800000 },
      { icon:'fa-file-contract', color:'amber', text:'Operating Agreement auto-generated for <strong>Riverside Flats</strong>', time:'Nov 10, 2025', ts:1731196800000 },
    ]);
  }

  // ─── Invite token helpers ────────────────────────────────────────────────────

  function createInviteToken(investorEmail, orgId) {
    const payload = btoa(`${investorEmail}|${orgId}|${Date.now()}`);
    return payload.replace(/=/g, '');
  }

  function decodeInviteToken(token) {
    try {
      const padded = token + '=='.slice(0, (4 - token.length % 4) % 4);
      const decoded = atob(padded.replace(/-/g,'+').replace(/_/g,'/'));
      const parts = decoded.split('|');
      return { email: parts[0], orgId: parts[1], ts: parseInt(parts[2]) };
    } catch(e) { return null; }
  }

  // ─── Audit log ───────────────────────────────────────────────────────────────
  function auditLog(action, entity, detail) {
    const s = getSession();
    const logs = loadAuditLogs();
    logs.unshift({ ts: Date.now(), user: s?.email||'unknown', action, entity, detail });
    const key = makeOrgKey('auditLog');
    try { localStorage.setItem(key, JSON.stringify(logs.slice(0, 500))); } catch(e) {}
  }

  function loadAuditLogs() {
    try { return JSON.parse(localStorage.getItem(makeOrgKey('auditLog')) || '[]'); } catch(e) { return []; }
  }

  // Patch save functions to auto-audit
  const _origSaveDeals = SP => SP.saveDeals;

  // ─── Distributions ──────────────────────────────────────────────────────────

  function getCapitalCalls() { return load('capitalCalls', []); }
  function saveCapitalCalls(c) { save('capitalCalls', c); }

  function getDistributions() { return load('distributions', []); }
  function saveDistributions(d) { save('distributions', d); }

  function getDistributionsForInvestor(investorId) {
    return getDistributions().filter(d =>
      Array.isArray(d.recipients) ? d.recipients.some(r => r.investorId === investorId)
      : d.investorId === investorId
    );
  }

  // ─── Data Ready Gate ─────────────────────────────────────────────────────────
  // SP.onDataReady(cb) — guaranteed to fire AFTER Firestore data is available.
  // If SPData is already initialized, fires immediately. Otherwise waits for
  // spdata-ready event OR SPFB.onReady(). Use this instead of raw init() calls.
  const _dataReadyQueue = [];
  let _dataReady = false;

  function _flushDataReady() {
    if (_dataReady) return;
    _dataReady = true;
    while (_dataReadyQueue.length) {
      try { _dataReadyQueue.shift()(); } catch(e) { console.error('SP.onDataReady callback error:', e); }
    }
  }

  function onDataReady(cb) {
    if (_dataReady || (typeof SPData !== 'undefined' && SPData.isReady && SPData.isReady())) {
      _dataReady = true;
      try { cb(); } catch(e) { console.error('SP.onDataReady callback error:', e); }
      // Flush any queued callbacks too
      while (_dataReadyQueue.length) {
        try { _dataReadyQueue.shift()(); } catch(e) { console.error('SP.onDataReady callback error:', e); }
      }
      return;
    }
    _dataReadyQueue.push(cb);
  }

  // Listen for the event fired by sp-firebase.js after SPData.init() completes
  window.addEventListener('spdata-ready', _flushDataReady);
  // Also listen for SPFB.onReady if it's loaded after us
  if (typeof SPFB !== 'undefined' && SPFB.onReady) {
    SPFB.onReady(_flushDataReady);
  } else {
    // SPFB not loaded yet — re-check after a tick
    setTimeout(() => {
      if (typeof SPFB !== 'undefined' && SPFB.onReady) SPFB.onReady(_flushDataReady);
    }, 0);
  }

  // ── FAILSAFE: poll for data readiness ──────────────────────────────────────
  // Covers edge cases where spdata-ready fires before listeners register,
  // dynamic script loading races, or SP.onDataReady is called after _dataReady
  // was set but the check somehow missed. Polls every 500ms up to 15s.
  let _failsafeChecks = 0;
  const _failsafeInterval = setInterval(() => {
    _failsafeChecks++;
    if (_failsafeChecks > 30) { clearInterval(_failsafeInterval); return; } // give up after 15s
    if (_dataReady) {
      // Already flushed — but check if new callbacks snuck in
      if (_dataReadyQueue.length) {
        while (_dataReadyQueue.length) {
          try { _dataReadyQueue.shift()(); } catch(e) { console.error('SP.onDataReady callback error:', e); }
        }
      }
      clearInterval(_failsafeInterval);
      return;
    }
    // Check if data is actually available even though event was missed
    const hasData = (typeof SPData !== 'undefined' && SPData.isReady && SPData.isReady())
      || (typeof SP !== 'undefined' && SP.getDeals && SP.getDeals().length > 0);
    if (hasData) {
      _flushDataReady();
      clearInterval(_failsafeInterval);
    }
  }, 500);

  // ─── Public API ─────────────────────────────────────────────────────────────

  return {
    // Session
    getSession, setSession, clearSession, isLoggedIn, isGP, isInvestor,
    getOrgId, makeOrgKey, simpleHash, generateOrgId,
    escapeHtml, esc,
    // Data ready gate
    onDataReady,
    // Guards
    requireGP, requireInvestor, requireAuth,
    // Storage
    load, save,
    // Deals
    getDeals, saveDeals, getDealById, getDealsForInvestor,
    getDealsForCurrentInvestor, addInvestorToDeal, removeInvestorFromDeal,
    // Investors
    getInvestors, saveInvestors, getInvestorByEmail, getInvestorById,
    getCurrentInvestorRecord,
    // Activity
    logActivity, getActivity,
    // Users / auth
    getUsers, saveUsers, getUserByEmail, createUser, authenticate, logout, isDemoEmail,
    // Invites
    createInviteToken, decodeInviteToken,
    // Capital Calls
    getCapitalCalls, saveCapitalCalls,
    // Distributions
    getDistributions, saveDistributions, getDistributionsForInvestor,
    // Audit
    auditLog, loadAuditLogs,
    // Theme
    applyTheme: (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('sp_theme', theme);
      const label = document.getElementById('themeLabel');
      if(label) label.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
      const icon = document.querySelector('a[onclick*="toggleTheme"] i');
      if(icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
      
      let style = document.getElementById('sp-theme-css');
      if(!style) {
        style = document.createElement('style');
        style.id = 'sp-theme-css';
        document.head.appendChild(style);
      }
      if(theme === 'dark') {
        style.textContent = `
          [data-theme="dark"] body { background: #0a0a0f !important; color: #e2e8f0 !important; }
          [data-theme="dark"] .main { background: #0a0a0f !important; }
          [data-theme="dark"] .top-bar, [data-theme="dark"] .card, [data-theme="dark"] .card-card, [data-theme="dark"] .kpi, [data-theme="dark"] .stat-card, [data-theme="dark"] .input-panel, [data-theme="dark"] .result-panel { background: #11111a !important; border-color: #1e1e2e !important; color: #e2e8f0 !important; }
          [data-theme="dark"] input, [data-theme="dark"] select, [data-theme="dark"] textarea { background: #1a1a2e !important; border-color: #2e2e4a !important; color: #fff !important; }
          [data-theme="dark"] .nav-item:not(.active):hover { background: rgba(255,255,255,0.05); }
          [data-theme="dark"] .breadcrumb-current, [data-theme="dark"] h1, [data-theme="dark"] h2, [data-theme="dark"] h3 { color: #fff !important; }
          [data-theme="dark"] .text-secondary, [data-theme="dark"] .text-muted { color: #94a3b8 !important; }
          [data-theme="dark"] thead { background: #1a1a2e !important; }
          [data-theme="dark"] tr:hover td { background: rgba(255,255,255,0.02) !important; }
          [data-theme="dark"] .btn-secondary { background: #1a1a2e !important; border-color: #2e2e4a !important; color: #e2e8f0 !important; }
        `;
      } else { style.textContent = ''; }
    },
    toggleTheme: () => {
      const current = localStorage.getItem('sp_theme') || 'light';
      SP.applyTheme(current === 'light' ? 'dark' : 'light');
    },
    // Settings
    getSettings: () => { try { return JSON.parse(localStorage.getItem(SP.makeOrgKey('settings')) || '{}'); } catch(e) { return {}; } },
    // v2.0 Global Routing: Multi-role home redirect
    goHome: () => {
      const s = SP.getSession();
      if (!s) { window.location.href = 'index.html'; return; }
      window.location.href = (s.role === 'Investor') ? 'investor-portal.html' : 'dashboard.html';
    }
  };
})();

// ─── Firebase: load SDKs + sp-firebase.js on every page ──────────────────────
(function loadFirebase() {
  if (typeof document === 'undefined') return;
  // Don't load on login/signup (they handle their own Firebase loading)
  const page = window.location.pathname.split('/').pop();
  if (page === 'login.html' || page === 'signup.html') return;

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof firebase !== 'undefined') {
      // Firebase SDKs already loaded via <script> tags
      if (typeof SPFB !== 'undefined') {
        SPFB.init();
      } else {
        // SDKs present but some modules may be missing — load chain
        const loadScript = (src, cb) => { const s = document.createElement('script'); s.src = src; s.onload = cb; s.onerror = cb; document.head.appendChild(s); };
        const has = (name) => Array.from(document.querySelectorAll('script[src]')).some(s => s.src.includes(name));
        const chain = [];
        if (!has('firebase-config')) chain.push('firebase-config.js');
        if (!has('sp-crypto')) chain.push('js/sp-crypto.js');
        if (!has('sp-data')) chain.push('js/sp-data.js?v9');
        if (!has('sp-firebase')) chain.push('js/sp-firebase.js?v9');
        function loadNext() {
          if (!chain.length) { if (typeof SPFB !== 'undefined' && !SPFB.isReady()) SPFB.init(); return; }
          loadScript(chain.shift(), loadNext);
        }
        if (chain.length) loadNext();
      }
      return;
    }

    // Dynamically load Firebase SDKs then sp-firebase.js
    const sdks = [
      'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
      'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
      'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js',
      'https://www.gstatic.com/firebasejs/9.23.0/firebase-functions-compat.js',
    ];

    let loaded = 0;
    function onSDKLoad() {
      loaded++;
      if (loaded < sdks.length) return;
      // All SDKs loaded — load config, then sp-crypto, sp-data, sp-firebase
      const cfg = document.createElement('script'); cfg.src = 'firebase-config.js';
      cfg.onload = () => {
        // Load sp-crypto.js (needed for encrypted fields)
        const loadScript = (src, cb) => { const s = document.createElement('script'); s.src = src; s.onload = cb; s.onerror = cb; document.head.appendChild(s); };
        const hasCrypto = Array.from(document.querySelectorAll('script[src]')).some(s => s.src.includes('sp-crypto'));
        const hasData = Array.from(document.querySelectorAll('script[src]')).some(s => s.src.includes('sp-data'));
        const hasFB = Array.from(document.querySelectorAll('script[src]')).some(s => s.src.includes('sp-firebase'));

        const loadChain = [];
        if (!hasCrypto) loadChain.push('js/sp-crypto.js');
        if (!hasData) loadChain.push('js/sp-data.js?v9');
        if (!hasFB) loadChain.push('js/sp-firebase.js?v9');

        function loadNext() {
          if (!loadChain.length) { if (typeof SPFB !== 'undefined') SPFB.init(); return; }
          loadScript(loadChain.shift(), loadNext);
        }
        loadNext();
      };
      document.head.appendChild(cfg);
    }

    sdks.forEach(src => {
      const s = document.createElement('script');
      s.src = src; s.onload = onSDKLoad; s.onerror = onSDKLoad;
      document.head.appendChild(s);
    });
  });
})();

// ─── Auto Auth Guard ──────────────────────────────────────────────────────────
// Enforces Firebase Auth on all protected pages.
// Checks REAL Firebase Auth state, not just localStorage session.
(function autoAuthGuard() {
  if (typeof document === 'undefined') return;
  const page = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

  // Public pages that don't require auth
  const PUBLIC_PAGES = new Set([
    'login.html', 'signup.html', 'pricing.html', 'index.html', 'landing.html',
    'terms.html', 'privacy.html', 'disclaimer.html', 'security.html',
    '404.html', 'reset-password.html', 'invest.html', 'sign.html',
    'waterfall-explainer.html', 'waterfall-guide.html', 'help-center.html',
    'join-team.html',
  ]);

  if (PUBLIC_PAGES.has(page)) return;

  // Hide page content until auth is confirmed
  const style = document.createElement('style');
  style.id = 'auth-guard-style';
  style.textContent = '.auth-pending { opacity: 0; pointer-events: none; transition: opacity 0.2s; }';
  document.head.appendChild(style);

  document.addEventListener('DOMContentLoaded', () => {
    // If sp-core session exists, show page immediately (fast path)
    if (typeof SP !== 'undefined' && SP.isLoggedIn()) {
      return; // Already authenticated via localStorage — Firebase will confirm async
    }
    // No localStorage session — hide content and wait for Firebase
    document.body.classList.add('auth-pending');
  });

  // Wait for Firebase Auth to resolve
  window.addEventListener('spdata-ready', () => {
    // Firebase resolved — check if authenticated
    document.body.classList.remove('auth-pending');
    const s = document.getElementById('auth-guard-style');
    if (s) s.remove();
  });

  // Timeout: if Firebase doesn't resolve in 5s, redirect to login
  setTimeout(() => {
    if (typeof SP === 'undefined' || !SP.isLoggedIn()) {
      const fbReady = typeof SPFB !== 'undefined' && SPFB.isReady();
      if (!fbReady) {
        console.warn('[AuthGuard] No auth after 5s — redirecting to login');
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
      }
    }
  }, 5000);
})();

(function loadModules() {
    if (typeof document === 'undefined') return;
    document.addEventListener('DOMContentLoaded', function () {
    // Load order: sp-math.js -> sp-ai.js -> sp-theme.js -> sp-reit.js -> sp-chat.js -> sp-audit.js -> sp-esign.js
    const m = document.createElement('script');
    m.src = 'js/sp-math.js';
    m.onload = () => {
      const t = document.createElement('script');
      t.src = 'js/sp-theme.js?v=20260308';
      document.head.appendChild(t);

      const a = document.createElement('script');
      a.src = 'js/sp-ai.js';
      
      const r = document.createElement('script');
      r.src = 'js/sp-reit.js';
      document.head.appendChild(r);

      const c = document.createElement('script');
      c.src = 'js/sp-chat.js';
      document.head.appendChild(c);
      
      document.head.appendChild(a);
    };
    document.head.appendChild(m);

    const s = document.createElement('script');
    s.src = 'js/sp-audit.js';
    s.onload = () => {
      const e = document.createElement('script');
      e.src = 'js/sp-esign.js';
      document.head.appendChild(e);
    };
    document.head.appendChild(s);
  });
})();

// ─── Theme: inject sp-theme.js on every page ─────────────────────────────────
(function loadTheme() {
  if (typeof document === 'undefined') return;
  const s = document.createElement('script');
  s.src = 'js/sp-theme.js?v=20260308';
  document.head.appendChild(s);
})();

// ─── Legal footer + disclaimer banner ────────────────────────────────────────
(function injectLegalFooter() {
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function () {
    // Skip on mobile — footer is hidden via CSS anyway, don't inject useless DOM
    const isMobile = window.innerWidth <= 768;
    
    // Don't inject on legal pages themselves
    const path = window.location.pathname;
    if (['/terms.html','/privacy.html','/disclaimer.html','/login.html','/signup.html'].some(p => path.endsWith(p))) return;

    // Footer disclaimer bar at bottom of every app page
    if (!document.getElementById('dt-legal-footer')) {
      const footer = document.createElement('div');
      footer.id = 'dt-legal-footer';
      footer.style.cssText = 'background:#EDEBE8;color:#9C9590;font-size:.7rem;padding:14px 32px;text-align:center;line-height:1.6;font-family:Inter,sans-serif;margin-top:auto;border-top:1px solid #E2DDD8;';
      footer.innerHTML = `deeltrack is a software tool — not a broker-dealer, investment adviser, or placement agent.<br>Generated documents require independent legal review. &nbsp;·&nbsp; <a href="terms.html" style="color:#6B6560;text-decoration:none;">Terms</a> &nbsp;·&nbsp; <a href="privacy.html" style="color:#6B6560;text-decoration:none;">Privacy</a> &nbsp;·&nbsp; <a href="disclaimer.html" style="color:#6B6560;text-decoration:none;">Disclaimer</a> &nbsp;·&nbsp; <a href="security.html" style="color:#6B6560;text-decoration:none;"><i class="fas fa-shield-alt" style="font-size:.7rem;"></i> Security</a> &nbsp;·&nbsp; <a href="integrations.html" style="color:#6B6560;text-decoration:none;"><i class="fas fa-plug" style="font-size:.7rem;"></i> Integrations</a>`;
      document.body.appendChild(footer);
    }

    // One-time localStorage notice (shows once, dismissed permanently)
    const dismissed = localStorage.getItem('dt_notice_dismissed');
    if (!dismissed && !document.getElementById('dt-notice-banner')) {
      const banner = document.createElement('div');
      banner.id = 'dt-notice-banner';
      banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1B1A19;color:rgba(243,240,237,.85);padding:12px 24px;display:flex;align-items:center;gap:16px;z-index:9000;font-family:Inter,sans-serif;font-size:.78rem;box-shadow:0 -2px 12px rgba(27,26,25,.15);flex-wrap:wrap;border-top:1px solid rgba(255,255,255,.1);';
      banner.innerHTML = `
        <div style="flex:1;min-width:200px;">
          <strong style="color:#F3F0ED;">Notice:</strong> deeltrack is organizational software — not a broker-dealer or investment adviser. Generated documents require independent professional review.
          <a href="disclaimer.html" style="color:#F37925;margin-left:8px;text-decoration:none;">Full Disclaimer</a>
        </div>
        <button onclick="localStorage.setItem('dt_notice_dismissed','1');document.getElementById('dt-notice-banner').remove();document.body.style.paddingBottom=''" style="background:#F37925;color:#1B1A19;border:none;padding:7px 16px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.78rem;font-weight:600;white-space:nowrap;flex-shrink:0;">Got it</button>`;
      // Add bottom padding so content isn't hidden behind the banner
      setTimeout(() => {
        const h = banner.offsetHeight;
        if (h > 0) document.body.style.paddingBottom = h + 'px';
      }, 100);
      document.body.appendChild(banner);
    }
  });

  // ── Email verification banner ──────────────────────────────────────────────
  // Show persistent banner when user hasn't verified their email
  window.addEventListener('spdata-ready', () => {
    if (typeof SPFB === 'undefined' || SPFB.isOffline()) return;
    if (SPFB.isEmailVerified()) return;
    const s = SP.getSession();
    if (!s || !s.loggedIn) return;
    // Don't show on public pages
    const page = window.location.pathname.split('/').pop() || '';
    const skip = ['login.html','signup.html','pricing.html','index.html','terms.html','privacy.html','disclaimer.html','security.html','404.html','reset-password.html'];
    if (skip.includes(page)) return;

    const vBanner = document.createElement('div');
    vBanner.id = 'email-verify-banner';
    vBanner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#FEF3C7;color:#92400E;padding:10px 20px;display:flex;align-items:center;gap:12px;z-index:9999;font-size:.85rem;font-weight:500;border-bottom:1px solid #F59E0B;justify-content:center;flex-wrap:wrap;';
    vBanner.innerHTML = `
      <i class="fas fa-exclamation-triangle" style="color:#F59E0B;"></i>
      <span>Please verify your email address (<strong>${s.email}</strong>) to secure your account.</span>
      <button id="resendVerifyBtn" style="background:#F59E0B;color:#92400E;border:none;padding:5px 14px;border-radius:6px;cursor:pointer;font-weight:600;font-size:.8rem;font-family:inherit;">Resend Email</button>`;
    document.body.prepend(vBanner);
    // Push content down
    document.body.style.paddingTop = (vBanner.offsetHeight || 40) + 'px';

    document.getElementById('resendVerifyBtn').onclick = async () => {
      try {
        await SPFB.resendVerification();
        document.getElementById('resendVerifyBtn').textContent = '✓ Sent!';
        document.getElementById('resendVerifyBtn').disabled = true;
      } catch (e) {
        document.getElementById('resendVerifyBtn').textContent = 'Failed — try again';
      }
    };
  });
})();

// ─── XSS Sanitizer: strip dangerous attributes from dynamically inserted HTML ─
// Defense-in-depth: catches XSS even if innerHTML is used with unescaped user data.
(function initXSSSanitizer() {
  if (typeof MutationObserver === 'undefined') return;
  // Only block truly dangerous injected elements. We do NOT strip onclick/onchange etc.
  // because our own code uses inline handlers extensively on dynamically created elements.
  // The real XSS vectors are: injected <script>, <iframe>, <object>, <embed>, and javascript: URLs.
  const DANGEROUS_TAGS = new Set(['script', 'iframe', 'object', 'embed']);
  const SAFE_SCRIPT_PATTERNS = ['gstatic.com', 'firebase', 'js/sp-', 'emailjs', 'cdnjs', 'stripe', 'googletagmanager'];
  let _initialized = false;

  function sanitizeNode(node) {
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();

    // Block injected dangerous tags
    if (DANGEROUS_TAGS.has(tag) && !node.hasAttribute('data-dt-safe')) {
      const src = node.getAttribute('src') || '';
      // Allow known-safe scripts
      if (tag === 'script' && SAFE_SCRIPT_PATTERNS.some(p => src.includes(p))) return;
      console.warn('[XSS] Blocked injected', tag, node.outerHTML?.slice(0, 100));
      node.remove();
      return;
    }

    // Strip javascript: URLs (the other major XSS vector)
    ['href', 'src', 'action', 'formaction', 'data', 'poster'].forEach(a => {
      const val = node.getAttribute(a);
      if (val && /^\s*javascript:/i.test(val)) {
        console.warn('[XSS] Stripped javascript: URL from', a);
        node.removeAttribute(a);
      }
    });

    // Recurse
    node.querySelectorAll?.('*')?.forEach(sanitizeNode);
  }

  window.addEventListener('load', () => {
    if (_initialized) return;
    _initialized = true;
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          sanitizeNode(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();

// ─── Global Error Tracking ───────────────────────────────────────────────────
// Catches uncaught errors + unhandled promise rejections.
// Logs to Firestore (orgs/{orgId}/errors) for GP visibility.
// Batches errors to avoid spamming Firestore writes.
(function initErrorTracking() {
  if (typeof window === 'undefined') return;
  const _errorQueue = [];
  let _flushTimer = null;

  function _captureError(type, message, source, line, col, stack) {
    _errorQueue.push({
      type,
      message: String(message || '').slice(0, 500),
      source: String(source || '').slice(0, 200),
      line: line || 0,
      col: col || 0,
      stack: String(stack || '').slice(0, 1000),
      page: window.location.pathname.split('/').pop() || 'unknown',
      userAgent: navigator.userAgent.slice(0, 150),
      timestamp: new Date().toISOString(),
    });
    // Debounce flush — batch errors within 2s window
    if (!_flushTimer) {
      _flushTimer = setTimeout(_flushErrors, 2000);
    }
  }

  function _flushErrors() {
    _flushTimer = null;
    if (!_errorQueue.length) return;
    const errors = _errorQueue.splice(0, 10); // max 10 per flush
    // Try Firestore
    if (typeof firebase !== 'undefined' && typeof SPFB !== 'undefined' && SPFB.isReady() && !SPFB.isOffline()) {
      const orgId = SPFB.getOrgId() || (typeof SP !== 'undefined' ? SP.getOrgId() : null);
      if (orgId) {
        const db = firebase.firestore();
        errors.forEach(err => {
          db.collection('orgs').doc(orgId).collection('errors').add(err).catch(() => {});
        });
        return;
      }
    }
    // Fallback: store in localStorage (capped at 50)
    try {
      const key = 'dt_error_log';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const combined = existing.concat(errors).slice(-50);
      localStorage.setItem(key, JSON.stringify(combined));
    } catch (_) {}
  }

  window.onerror = function(message, source, line, col, error) {
    _captureError('uncaught', message, source, line, col, error?.stack);
    return false; // don't suppress — still shows in console
  };

  window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason;
    _captureError('promise',
      reason?.message || String(reason).slice(0, 500),
      reason?.fileName || '',
      reason?.lineNumber || 0,
      reason?.columnNumber || 0,
      reason?.stack || ''
    );
  });
})();

// ─── PWA: Nuke all service workers and caches ────────────────────────────────
// The SW was caching old code and breaking every deploy. Gone for good.
(function nukeSW() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  // Run immediately — don't wait for load event
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  });
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
})();

// ─── Mobile nav: ensure sidebar overlay + toggle works on every page ─────────
(function patchMobileNav() {
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // Ensure overlay exists
    let overlay = document.getElementById('sidebarOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebarOverlay';
      overlay.className = 'sidebar-overlay';
      overlay.onclick = () => { sidebar.classList.remove('open'); overlay.classList.remove('visible'); };
      document.body.appendChild(overlay);
    }

    // Auto-inject dt-header if page has no header bar at all
    const mainEl = document.querySelector('.main, main, #main');
    if (mainEl && !document.querySelector('.dt-header') && !document.querySelector('.top-bar') && !document.querySelector('header.top-bar')) {
      // Try to extract page title from first h1 or document.title
      const existingH1 = mainEl.querySelector('h1');
      const titleText = existingH1 ? existingH1.innerHTML : (document.title.split('|').pop() || '').trim();
      const header = document.createElement('div');
      header.className = 'dt-header';
      header.innerHTML = `<button class="mobile-menu-btn" onclick="toggleSidebar()"><i class="fas fa-bars"></i></button><h1>${titleText}</h1><div class="header-actions"></div>`;
      mainEl.insertBefore(header, mainEl.firstChild);
      // If we grabbed the h1 from a page-top div, hide the original to avoid duplication
      if (existingH1) {
        const pageTop = existingH1.closest('.page-top, .header');
        if (pageTop) pageTop.style.display = 'none';
      }
    }

    // Ensure mobile menu button exists — always first in top-bar or top-left
    if (!document.querySelector('.mobile-menu-btn')) {
      const btn = document.createElement('button');
      btn.className = 'mobile-menu-btn';
      btn.style.cssText = 'display:none;background:none;border:1px solid #e2e8f0;border-radius:8px;width:40px;height:40px;cursor:pointer;align-items:center;justify-content:center;flex-shrink:0;';
      btn.innerHTML = '<i class="fas fa-bars" style="color:#64748b;font-size:1rem;"></i>';
      btn.onclick = () => { sidebar.classList.toggle('open'); overlay.classList.toggle('visible'); };
      // Prefer top-left, then top-bar, then create a minimal top-bar
      const target = document.querySelector('.top-left') || document.querySelector('.top-bar, header.top-bar');
      if (target) {
        target.insertBefore(btn, target.firstChild);
      } else {
        // No top-bar at all — create a minimal one at top of .main
        const main = document.querySelector('.main, main, #main');
        if (main) {
          const bar = document.createElement('header');
          bar.className = 'top-bar';
          bar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 16px;';
          bar.appendChild(btn);
          main.insertBefore(bar, main.firstChild);
        }
      }
    }

    // Wire existing mobile-menu-btn if present but not functional
    document.querySelectorAll('.mobile-menu-btn').forEach(btn => {
      if (!btn.onclick) {
        btn.onclick = () => { sidebar.classList.toggle('open'); overlay.classList.toggle('visible'); };
      }
    });

    // Add mobile responsive CSS if not already present
    if (!document.getElementById('sp-mobile-css')) {
      const style = document.createElement('style');
      style.id = 'sp-mobile-css';
      style.textContent = `
        @media(max-width:768px){
          .sidebar{transform:translateX(-100%)!important;transition:transform .3s!important;}
          .sidebar.open{transform:translateX(0)!important;}
          .main{margin-left:0!important;}
          .mobile-menu-btn{display:flex!important;}
          .sidebar-overlay.visible{display:block!important;}
        }
        .sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99;}
      `;
      document.head.appendChild(style);
    }
  });
})();

// ─── Auto-load notifications module on GP pages ──────────────────────────────
(function loadNotifications() {
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function() {
    if (!SP.isGP()) return;
    if (document.querySelector('script[src*="sp-notifications"]')) return; // already loaded
    const s = document.createElement('script');
    s.src = 'js/sp-notifications.js';
    document.head.appendChild(s);
  });
})();

// ─── Billing enforcement — show paywall when trial expires ──────────────────
(function enforceBilling() {
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function() {
    if (!SP.isGP()) return;
    // Skip billing check on login, signup, settings, and billing-related pages
    const path = window.location.pathname;
    if (['login','signup','settings','pricing','terms','privacy','disclaimer','security','integrations'].some(p => path.includes(p))) return;

    // Load sp-billing.js if not already loaded
    function checkBilling() {
      if (typeof SPBilling === 'undefined') {
        const s = document.createElement('script');
        s.src = 'js/sp-billing.js';
        s.onload = () => setTimeout(checkBilling, 100);
        document.head.appendChild(s);
        return;
      }
      
      const access = SPBilling.canAccess();
      if (access.allowed) {
        // Show trial countdown banner if in trial
        if (access.reason === 'trial') {
          const daysLeft = SPBilling.trialDaysLeft();
          if (daysLeft <= 7 && daysLeft > 0) {
            showBillingBanner(`Trial ends in ${daysLeft} day${daysLeft!==1?'s':''}`, 'warning');
          }
        }
        return;
      }
      
      // Trial expired — show paywall
      if (access.reason === 'trial_expired') {
        showBillingBanner('Your free trial has ended. Upgrade to keep using deeltrack.', 'expired');
      }
    }
    
    function showBillingBanner(msg, type) {
      if (document.getElementById('dt-billing-banner')) return;
      const banner = document.createElement('div');
      banner.id = 'dt-billing-banner';
      const isExpired = type === 'expired';
      banner.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:9999;padding:10px 20px;font-size:.85rem;font-weight:600;display:flex;align-items:center;justify-content:center;gap:12px;font-family:'Inter',sans-serif;${isExpired ? 'background:#D94F3D;color:white;' : 'background:#FEF3C7;color:#92400E;border-bottom:1px solid #FCD34D;'}`;
      banner.innerHTML = `<span>${msg}</span><a href="settings.html#billing" style="padding:5px 14px;border-radius:6px;font-size:.8rem;font-weight:700;text-decoration:none;${isExpired ? 'background:white;color:#D94F3D;' : 'background:#F37925;color:#1B1A19;'}">Upgrade Now</a>${!isExpired ? '<button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;font-size:1rem;color:#92400E;margin-left:8px;">✕</button>' : ''}`;
      document.body.prepend(banner);
      // If expired, also dim the main content
      if (isExpired) {
        const main = document.querySelector('main, .main-content, [class*="content"]');
        if (main) main.style.cssText += 'opacity:0.4;pointer-events:none;user-select:none;';
      }
    }
    
    // Check after a short delay to let SPBilling initialize
    setTimeout(checkBilling, 500);
  });
})();

// ─── Auto-inject logout + user name into sidebar footer ─────────────────────
(function injectSidebarUser() {
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function () {
    const s = SP.getSession();
    if (!s) return;
    // Update user name in sidebar if element exists
    const nameEl = document.querySelector('.sidebar .user-name');
    if (nameEl && s.name) nameEl.textContent = s.name;
    const roleEl = document.querySelector('.sidebar .user-role');
    if (roleEl && s.role) roleEl.textContent = s.role;
    // Inject deeltrack logo into sidebar header
    const sidebarHeader = document.querySelector('.sidebar-header');
    if (sidebarHeader) {
      const logoEl = sidebarHeader.querySelector('.logo, a[href]');
      if (logoEl) {
        const href = logoEl.getAttribute('href') || 'dashboard.html';
        logoEl.outerHTML = `<a href="${href}" style="display:flex;align-items:center;gap:10px;text-decoration:none;">
          <img src="assets/logo-icon.svg" width="28" height="28" alt="dt" style="border-radius:6px;flex-shrink:0;"><span style="display:flex;align-items:center;gap:0;"><span style="font-size:1.25rem;font-weight:900;color:#F3F3F3;letter-spacing:-0.04em;line-height:1;">deel</span><span style="font-size:1.25rem;font-weight:900;color:#F37925;letter-spacing:-0.04em;line-height:1;">track</span></span>
        </a>`;
      }
    } else {
      // v2.0 Hardening: If sidebar-header is missing from HTML but sidebar is present, create it
      const sb = document.getElementById('sidebar');
      if (sb) {
        const header = document.createElement('div');
        header.className = 'sidebar-header';
        header.innerHTML = `<a href="dashboard.html" style="display:flex;align-items:center;gap:10px;text-decoration:none;">
          <img src="assets/logo-icon.svg" width="28" height="28" alt="dt" style="border-radius:6px;flex-shrink:0;"><span style="display:flex;align-items:center;gap:0;"><span style="font-size:1.25rem;font-weight:900;color:#F3F3F3;letter-spacing:-0.04em;line-height:1;">deel</span><span style="font-size:1.25rem;font-weight:900;color:#F37925;letter-spacing:-0.04em;line-height:1;">track</span></span>
        </a>`;
        const innerNav = document.createElement('nav');
        innerNav.className = 'nav';
        sb.appendChild(header);
        sb.appendChild(innerNav);
      }
    }

    // v2.0 Tab Sync Listener
    window.addEventListener('storage', (e) => {
      if (e.key === 'sp_session' && !e.newValue) {
        window.location.href = 'login.html?reason=session_signed_out';
      }
    });

    // ── FORCE FULL SIDEBAR BUILD on every page ────────────────────────────
    // If sidebar exists but is empty, inject the full structure now
    const sb = document.getElementById('sidebar');
    if (sb) {
      // Always ensure sidebar-header exists
      if (!sb.querySelector('.sidebar-header')) {
        const hdr = document.createElement('div');
        hdr.className = 'sidebar-header';
        hdr.innerHTML = `<a href="dashboard.html" style="display:flex;align-items:center;gap:10px;text-decoration:none;">
          <img src="assets/logo-icon.svg" width="28" height="28" alt="dt" style="border-radius:6px;flex-shrink:0;"><span style="display:flex;align-items:center;gap:0;"><span style="font-size:1.25rem;font-weight:900;color:#F3F3F3;letter-spacing:-0.04em;line-height:1;">deel</span><span style="font-size:1.25rem;font-weight:900;color:#F37925;letter-spacing:-0.04em;line-height:1;">track</span></span>
        </a>`;
        sb.insertBefore(hdr, sb.firstChild);
      }
      // Ensure nav container exists
      if (!sb.querySelector('.nav')) {
        const nav = document.createElement('nav');
        nav.className = 'nav';
        const footer = sb.querySelector('.sidebar-footer');
        if (footer) sb.insertBefore(nav, footer);
        else sb.appendChild(nav);
      }
      // Ensure sidebar-footer exists
      if (!sb.querySelector('.sidebar-footer')) {
        const footer = document.createElement('div');
        footer.className = 'sidebar-footer';
        const initials = (s?.name || 'U').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
        footer.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0;">${initials}</div>
            <div style="flex:1;min-width:0;">
              <div class="user-name" style="font-size:13px;font-weight:600;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s?.name || 'User'}</div>
              <div class="user-role" style="font-size:11px;color:rgba(255,255,255,0.45);">${s?.role || 'GP'}</div>
            </div>
          </div>
          <div id="sidebarPlanBadge" style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:8px;display:none;"></div>
          <button class="logout-btn" onclick="SP.logout()" style="width:100%;padding:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:8px;color:#f87171;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;transition:all 0.15s;" onmouseenter="this.style.background='rgba(239,68,68,0.2)'" onmouseleave="this.style.background='rgba(239,68,68,0.1)'">
            <i class="fas fa-sign-out-alt"></i> Sign Out
          </button>`;
        sb.appendChild(footer);
      }

      // Load plan badge in sidebar
      try {
        if (typeof firebase !== 'undefined' && firebase.functions) {
          firebase.auth().onAuthStateChanged(async function(u) {
            if (!u) return;
            try {
              const getStatus = firebase.functions().httpsCallable('getSubscriptionStatus');
              const r = await getStatus();
              const badge = document.getElementById('sidebarPlanBadge');
              if (!badge) return;
              const d = r.data;
              if (d.status === 'trialing') {
                const days = Math.ceil((new Date(d.trialEnd) - new Date()) / 86400000);
                badge.innerHTML = '<i class="fas fa-clock" style="margin-right:4px;"></i> Trial · ' + days + ' days left';
                badge.style.display = '';
                badge.style.color = '#F37925';
              } else if (d.status === 'active') {
                const planName = d.plan === 'per_deal' ? 'Per Deal' : d.plan === 'enterprise' ? 'Enterprise' : d.plan;
                const qty = d.plan === 'per_deal' && d.quantity ? ' · ' + d.quantity + ' deals' : '';
                badge.innerHTML = '<i class="fas fa-check-circle" style="margin-right:4px;color:#2D9A6B;"></i> ' + planName + qty;
                badge.style.display = '';
                badge.style.color = 'rgba(255,255,255,0.55)';
              }
            } catch(e) { /* silent */ }
          });
        }
      } catch(e) { /* silent */ }
    }

    // Rebuild sidebar nav completely — ensures every page has the correct full nav
    const nav = document.querySelector('#sidebar .nav, .sidebar .nav');
    if (nav) {
      const page = window.location.pathname.split('/').pop() || 'dashboard.html';
      // ── Collapsible sidebar navigation ──────────────────────────────
      // Each section has primary items (always visible) and overflow items
      // (shown when the section is expanded). The current page's section
      // auto-expands so the user always sees where they are.
      const navSections = [
        // ── Home ─────────────────────────────────────────────────
        { id:'home', items:[
          { href:'dashboard.html', icon:'fa-th-large', label:'Dashboard' },
          { href:'pulse.html',     icon:'fa-heartbeat', label:'Pulse' },
          { href:'help-center.html', icon:'fa-question-circle', label:'Help Center' },
        ]},
        // ── Deals ────────────────────────────────────────────────
        { id:'deals', title:'DEALS', items:[
          { href:'deals.html',        icon:'fa-building',          label:'Properties' },
          { href:'new-deal.html',     icon:'fa-plus',              label:'New Deal' },
          { href:'deal-import.html', icon:'fa-file-import',        label:'Import Deals' },
          { href:'sourcing-crm.html', icon:'fa-stream',            label:'Pipeline' },
          { href:'deal-room.html',    icon:'fa-folder-open',       label:'Deal Room' },
        ]},
        // ── Investors ────────────────────────────────────────────
        { id:'investors', title:'INVESTORS', items:[
          { href:'investors.html',       icon:'fa-users',           label:'Investors' },
          // Inbox removed — admin email managed by PikeClaw, not GPs
          { href:'investor-update.html', icon:'fa-bullhorn',        label:'Updates' },
        ]},
        // ── Finance ──────────────────────────────────────────────
        { id:'finance', title:'FINANCE', items:[
          { href:'commitments.html',      icon:'fa-handshake',           label:'Commitments' },
          { href:'distributions.html',    icon:'fa-wallet',              label:'Distributions' },
          { href:'capital-calls.html',    icon:'fa-hand-holding-usd',    label:'Capital Calls' },
          { href:'capital-account.html',  icon:'fa-list-ol',             label:'Capital Accounts' },
          { href:'wire-instructions.html',icon:'fa-university',          label:'Payment Files' },
        ]},
        // ── Documents ────────────────────────────────────────────
        { id:'docs', title:'DOCUMENTS', items:[
          { href:'documents.html',   icon:'fa-file-contract',  label:'Documents' },
          { href:'k1-vault.html',    icon:'fa-vault',          label:'K-1 Vault' },
          { href:'k1-generator.html',icon:'fa-calculator',     label:'K-1 Estimator' },
          { href:'om-builder.html',  icon:'fa-file-pdf',       label:'OM Builder' },
        ]},
        // ── Compliance ───────────────────────────────────────────
        { id:'compliance', title:'COMPLIANCE', items:[
          { href:'kyc.html',            icon:'fa-shield-alt',    label:'KYC / AML' },
          { href:'accreditation.html',  icon:'fa-certificate',   label:'Accreditation' },
          { href:'compliance-hub.html', icon:'fa-balance-scale', label:'Compliance Hub' },
        ]},
        // ── Tools ────────────────────────────────────────────────
        { id:'tools', title:'TOOLS', items:[
          { href:'tools.html', icon:'fa-wrench', label:'All Tools' },
        ]},
        // ── Account ──────────────────────────────────────────────
        { id:'account', title:'ACCOUNT', items:[
          { href:'settings.html', icon:'fa-cog', label:'Settings' },
          { href:'integrations.html', icon:'fa-plug', label:'Integrations' },
          { href:'security.html', icon:'fa-shield-alt', label:'Security' },
        ]},
      ];

      // Map pages to their section so the active section auto-expands
      const pageToSection = {};
      navSections.forEach(sec => {
        (sec.items||[]).concat(sec.overflow||[]).forEach(item => {
          if (item.href) pageToSection[item.href] = sec.id;
        });
      });
      // Extra aliases — pages not in navSections but that should highlight a section
      const extraAliases = {
        // Deals section
        'deal-detail.html':'deals', 'deal-teaser.html':'deals', 'pipeline.html':'deals',
        'new-deal.html':'deals',
        // Investors section
        'investor-detail.html':'investors', 'investor-portal.html':'investors',
        // Compliance section
        'accreditation.html':'compliance', 'compliance-hub.html':'compliance',
        'compliance-hud.html':'compliance', 'compliance-calendar.html':'compliance',
        // Finance section
        'distribution-calc.html':'finance', 'capital-call-calc.html':'finance',
        'capital-account-statement.html':'finance', 'distribution-reconciliation.html':'finance',
        'investor-statements.html':'finance',
        // Docs section
        'rent-roll-analyzer.html':'docs', 'ic-memo-builder.html':'docs',
        'teaser-generator.html':'docs', 'deal-room.html':'docs',
        // Tools section — all tool pages light up "All Tools"
        'proforma.html':'tools', 'exit-calc.html':'tools', 'scenario-planner.html':'tools',
        'sensitivity-matrix.html':'tools', 'dynamic-valuation.html':'tools',
        'capital-stack.html':'tools', 'amortization.html':'tools', 'cap-rate.html':'tools',
        'deal-compare.html':'tools', 'deal-scoring.html':'tools', 'irr-calc.html':'tools',
        'dscr-calc.html':'tools', 'ltc-calc.html':'tools', 'equity-multiple.html':'tools',
        'rehab-estimator.html':'tools', 'waterfall-guide.html':'tools',
        'waterfall-explainer.html':'tools', 'investment-thesis.html':'tools',
        'portfolio.html':'tools', 'reports.html':'tools', 'gp-pl.html':'tools',
        'gp-benchmarks.html':'tools', 'portfolio-health.html':'tools',
        'carry-tracker.html':'tools', 'accounting.html':'tools',
        'budget-actual.html':'tools', 'cap-table.html':'tools', 'cap-table-v2.html':'tools',
        'reit-rollup.html':'tools', 'risk-register.html':'tools',
        'capital-account-statement.html':'tools', 'distribution-reconciliation.html':'tools',
        'investor-statements.html':'tools', 'wire-confirm.html':'tools',
        'tax-center.html':'tools', 'currency-center.html':'tools',
        'investor-pipeline.html':'tools', 'investor-onboarding.html':'tools',
        'investor-update.html':'tools', 'email-templates.html':'tools',
        'network-map.html':'tools', 'investor-retention.html':'tools',
        'investor-sentiment-v2.html':'tools', 'investor-heatmap.html':'tools',
        'referrals.html':'tools', 'investor-feedback.html':'tools',
        'webinars.html':'tools', 'investor-chat.html':'tools', 'anchor-map.html':'tools',
        'debt-tracker.html':'tools', 'compliance-hub.html':'tools',
        'om-v2.html':'tools', 'lender-crm.html':'tools', 'lenders-crm.html':'tools',
        'executive-summary.html':'tools', 'recapitalization.html':'tools',
        'gp-vesting.html':'tools', 'audit-logs.html':'tools', 'rent-roll.html':'tools',
        'sourcing-crm.html':'tools', 'due-diligence.html':'tools',
        'lease-tracking.html':'tools', 'vendors.html':'tools', 'maintenance.html':'tools',
        'tenant-directory.html':'tools', 'insurance.html':'tools',
        'property-inspections.html':'tools', 'tasks.html':'tools',
        'quarterly-report.html':'tools', 'reservations.html':'tools',
        'exchange-1031.html':'tools', 'cost-segregation.html':'tools',
        'tax-appeal.html':'tools', 'deal-room-log.html':'tools',
        'deal-approvals.html':'tools', 'market-comps.html':'tools',
        'insurance-tracker.html':'tools', 'exit-strategy.html':'tools',
        'team.html':'tools', 'gp-dashboard-v3.html':'tools',
        'pipeline-forecast.html':'tools', 'portfolio-explorer.html':'tools',
        'risk-matrix.html':'tools', 'capital-call-calc.html':'tools',
        'rehab-estimator.html':'tools',
      };
      Object.assign(pageToSection, extraAliases);

      const activeMap = pageToSection; // backwards compat
      const activeSection = pageToSection[page] || 'home';

      // Restore expanded sections from sessionStorage (persists during tab life)
      const expandedKey = 'dt_nav_expanded';
      let expandedSections = {};
      try { expandedSections = JSON.parse(sessionStorage.getItem(expandedKey)||'{}'); } catch(e){}
      // Auto-expand the section containing the current page
      expandedSections[activeSection] = true;

      function renderItem(item, isActive) {
        return `<a href="${item.href}" class="nav-item ${isActive ? 'active' : ''}" title="${item.label}"><i class="fas ${item.icon}"></i><span>${item.label}</span></a>`;
      }

      nav.innerHTML = navSections.map(sec => {
        const isExpanded = !!expandedSections[sec.id];
        const hasOverflow = sec.overflow && sec.overflow.length > 0;
        const titleHtml = sec.title
          ? `<div class="nav-section" style="display:flex;justify-content:space-between;align-items:center;cursor:${hasOverflow?'pointer':'default'};user-select:none;" ${hasOverflow ? `onclick="(function(el){var o=el.parentElement.querySelector('.nav-overflow');var k='${sec.id}';var s=JSON.parse(sessionStorage.getItem('${expandedKey}')||'{}');if(o.style.display==='none'){o.style.display='';s[k]=true;el.querySelector('.chevron').style.transform='rotate(90deg)'}else{o.style.display='none';delete s[k];el.querySelector('.chevron').style.transform=''}sessionStorage.setItem('${expandedKey}',JSON.stringify(s))})(this)"` : ''}>
              <span>${sec.title}</span>
              ${hasOverflow ? `<i class="fas fa-chevron-right chevron" style="font-size:0.55rem;opacity:0.5;transition:transform 0.15s;${isExpanded?'transform:rotate(90deg)':''}"></i>` : ''}
            </div>`
          : '';
        const mainItems = sec.items.map(item => renderItem(item, page === item.href)).join('');
        const overflowItems = hasOverflow
          ? `<div class="nav-overflow" style="display:${isExpanded?'':'none'}">${sec.overflow.map(item => renderItem(item, page === item.href)).join('')}</div>`
          : '';
        return titleHtml + mainItems + overflowItems;
      }).join('');
    }

    // Apply saved theme
    SP.applyTheme(localStorage.getItem('sp_theme') || 'light');

    // Mobile sidebar toggle (global function)
    window.toggleSidebar = function() {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        sidebar.classList.toggle('open');
        let overlay = document.getElementById('sidebarOverlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'sidebarOverlay';
          overlay.className = 'sidebar-overlay';
          overlay.onclick = () => { sidebar.classList.remove('open'); overlay.classList.remove('visible'); };
          document.body.appendChild(overlay);
        }
        overlay.classList.toggle('visible');
      }
    };

    // Inject logout link if not already present
    const footer = document.querySelector('.sidebar-footer');
    if (footer && !footer.querySelector('.logout-btn')) {
      const logoutBtn = document.createElement('button');
      logoutBtn.className = 'logout-btn';
      logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sign Out';
      logoutBtn.style.cssText = 'width:100%;margin-top:10px;padding:8px 12px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25);border-radius:8px;color:#f87171;font-size:0.82rem;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:8px;transition:all 0.15s;';
      logoutBtn.onmouseenter = () => { logoutBtn.style.background = 'rgba(239,68,68,0.22)'; };
      logoutBtn.onmouseleave = () => { logoutBtn.style.background = 'rgba(239,68,68,0.12)'; };
      logoutBtn.onclick = () => SP.logout();
      footer.appendChild(logoutBtn);
    }

    // Floating help button (bottom-right) — shown on all GP pages except help-center itself
    const pg = (window.location.pathname.split('/').pop() || '').toLowerCase();
    const isLP = ['portal.html','investor-portal.html','login.html','index.html',''].some(p => pg === p || pg.endsWith(p));
    if (pg !== 'help-center.html' && !isLP) {
      const helpBtn = document.createElement('a');
      helpBtn.href = 'help-center.html';
      helpBtn.title = 'Help Center';
      helpBtn.innerHTML = '<i class="fas fa-question"></i>';
      helpBtn.style.cssText = 'position:fixed;bottom:24px;right:24px;width:44px;height:44px;border-radius:50%;background:#F37925;color:white;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 4px 12px rgba(243,121,37,0.35);z-index:999;text-decoration:none;transition:all 0.2s;';
      helpBtn.onmouseenter = () => { helpBtn.style.transform = 'scale(1.1)'; helpBtn.style.boxShadow = '0 6px 20px rgba(243,121,37,0.45)'; };
      helpBtn.onmouseleave = () => { helpBtn.style.transform = ''; helpBtn.style.boxShadow = '0 4px 12px rgba(243,121,37,0.35)'; };
      document.body.appendChild(helpBtn);
    }
  });
})();
