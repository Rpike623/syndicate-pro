/**
 * deeltrack Core — Auth, Data Access, Org Scoping
 * Include this on every page: <script src="js/sp-core.js"></script>
 */

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
  link.href = base + 'css/dt-global.css';
  document.head.prepend(link);
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

  function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36);
  }

  // All demo accounts share one org so data flows freely between GP and LP views
  // NOTE: demo-gp2 is EXCLUDED from this list to test data isolation — it gets its own unique org
  const DEMO_EMAILS = ['gp@deeltrack.com','demo@deeltrack.com','demo@syndicatepro.com','philip@jchapmancpa.com','investor@deeltrack.com'];
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

  function createUser(email, password, name, role, orgId) {
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) return false;
    users.push({ email, password, name, role, orgId });
    saveUsers(users);
    return true;
  }

  function authenticate(email, password) {
    const users = getUsers();
    // Seed demo GP — accept both old and new demo emails
    // ALL demo accounts share ONE org so data is visible across sessions
    // EXCEPT demo-gp2@deeltrack.com (Marcus Rivera) who needs data isolation for testing
    const DEMO_ORG_ID = 'deeltrack_demo';
    const demoEmails = ['demo@deeltrack.com', 'demo@syndicatepro.com', 'gp@deeltrack.com', 'philip@jchapmancpa.com', 'investor@deeltrack.com'];
    demoEmails.forEach(demoEmail => {
      const existing = users.find(u => u.email === demoEmail);
      if (!existing) {
        const name = demoEmail.includes('philip') ? 'Phil Chapman' : demoEmail.includes('investor') ? 'Demo Investor' : 'Robert Pike';
        const role = (demoEmail.includes('philip') || demoEmail.includes('investor@')) ? 'Investor' : 'General Partner';
        users.push({ email: demoEmail, password: 'Demo1234!', name, role, orgId: DEMO_ORG_ID });
      }
    });
    
    // Handle Marcus Rivera (demo-gp2) separately — he gets his own unique org for data isolation testing
    const marcusEmail = 'demo-gp2@deeltrack.com';
    const marcusExisting = users.find(u => u.email === marcusEmail);
    const marcusOrgId = 'marcus_rivera_org';
    if (!marcusExisting) {
      users.push({ email: marcusEmail, password: 'Demo1234!', name: 'Marcus Rivera', role: 'General Partner', orgId: marcusOrgId });
    } else if (marcusExisting.orgId !== marcusOrgId) {
      // Ensure Marcus always has his unique orgId
      marcusExisting.orgId = marcusOrgId;
    }
    
    localStorage.setItem('sp_users', JSON.stringify(users));
    const user = getUsers().find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) return null;
    // Ensure orgId
    if (!user.orgId) {
      user.orgId = simpleHash(user.email.toLowerCase());
      saveUsers(getUsers().map(u => u.email === user.email ? user : u));
    }
    const session = {
      email: user.email, name: user.name, role: user.role,
      orgId: user.orgId, loggedIn: true, loginTime: Date.now()
    };
    setSession(session);

    // Seed rich demo data for both GP and Phil the Investor on first login
    if (['demo@deeltrack.com','demo@syndicatepro.com','gp@deeltrack.com','philip@jchapmancpa.com'].includes(email.toLowerCase())) {
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
    if (localStorage.getItem(demoOrgKey)) return; // already seeded

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
      { id:'di1', firstName:'James', lastName:'Hartwell', email:'j.hartwell@email.com', phone:'(214) 555-0101', address:'4521 Oak Blvd, Dallas, TX 75201', accredMethod:'cpa', accredStatus:'verified', accredDate:'2024-03-15', accredExpiry:'2026-03-15', minInvest:100000, maxInvest:500000, totalInvested:650000, deals:2, status:'active', notes:'High net worth individual. Prefers multifamily.' },
      { id:'di2', firstName:'Sarah', lastName:'Chen', email:'s.chen@capitalgroup.com', phone:'(713) 555-0202', address:'1800 Post Oak Blvd, Houston, TX 77056', accredMethod:'entity', accredStatus:'verified', accredDate:'2024-01-10', accredExpiry:'2026-01-10', minInvest:250000, maxInvest:1000000, totalInvested:1000000, deals:2, status:'active', notes:'Family office rep. Very responsive.' },
      { id:'di3', firstName:'Marcus', lastName:'Williams', email:'mwilliams@invest.com', phone:'(512) 555-0303', address:'200 W Cesar Chavez, Austin, TX 78701', accredMethod:'attorney', accredStatus:'verified', accredDate:'2024-06-01', accredExpiry:'2026-06-01', minInvest:50000, maxInvest:250000, totalInvested:250000, deals:1, status:'active', notes:'First-time syndication investor.' },
      { id:'di4', firstName:'Priya', lastName:'Patel', email:'ppatel@wealth.com', phone:'(469) 555-0404', address:'5000 Granite Pkwy, Plano, TX 75024', accredMethod:'cpa', accredStatus:'verified', accredDate:'2025-01-15', accredExpiry:'2027-01-15', minInvest:500000, maxInvest:2000000, totalInvested:1000000, deals:1, status:'active', notes:'Prefers industrial. Long-term hold.' },
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
        status:'raising', location:'Fort Worth, TX', added:new Date().toISOString().split('T')[0], units:128, state:'TX',
        companyName:'Pecan Hollow Partners LLC', purchasePrice:24500000, loanAmount:19000000,
        totalEquity:5500000, gpEquity:10, lpEquity:90, prefReturn:8, gpPromote:20, acqFee:3, assetMgmtFee:2,
        investors:[
          {investorId:'i7',committed:250000,ownership:4.54,status:'active',linkedAt:new Date().toISOString(),subStatus:'signed'},
        ],
        documents:[], notes:'128-unit B+ value-add opportunity. 1980s build. Under market rents by $175/unit. Plans for $1.2M renovation cap-ex.'
      },
      {
        id:'d1', name:'Riverside Flats', type:'multifamily', raise:4200000, irr:18.5, equity:1.9,
        status:'operating', location:'Austin, TX', added:'2025-11-10', closeDate:'2025-11-15', units:96, state:'TX',
        companyName:'Riverside Flats Capital LLC', purchasePrice:21000000, loanAmount:16800000,
        totalEquity:4200000, gpEquity:10, lpEquity:90, prefReturn:8, gpPromote:20, acqFee:3, assetMgmtFee:2,
        // OA generated below after deals array is built
        investors:[
          {investorId:'di1',committed:250000,ownership:5.95,status:'active',linkedAt:'2025-11-15T10:00:00.000Z',subStatus:'signed'},
          {investorId:'di2',committed:500000,ownership:11.9,status:'active',linkedAt:'2025-11-15T10:00:00.000Z',subStatus:'funded'},
          {investorId:'di3',committed:250000,ownership:5.95,status:'active',linkedAt:'2025-11-20T10:00:00.000Z',subStatus:'signed'},
        ],
        documents:[], notes:'96-unit Class B multifamily. Value-add play with $200/unit rent upside.'
      },
      {
        id:'d2', name:'Meridian Industrial', type:'industrial', raise:7500000, irr:21.2, equity:2.1,
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
        status:'operating', location:'Houston, TX', added:'2026-01-15', closeDate:'2026-01-20', units:248, state:'TX',
        companyName:'Hudson Portfolio Capital LLC', purchasePrice:60000000, loanAmount:48000000,
        totalEquity:12000000, gpEquity:10, lpEquity:90, prefReturn:8, gpPromote:20, acqFee:3, assetMgmtFee:2,
        // OA generated below after deals array is built
        investors:[
          {investorId:'di1',committed:400000,ownership:3.33,status:'active',linkedAt:'2026-01-20T10:00:00.000Z',subStatus:'funded'},
          {investorId:'di2',committed:500000,ownership:4.17,status:'active',linkedAt:'2026-01-20T10:00:00.000Z',subStatus:'funded'},
        ],
        documents:[], notes:'248-unit portfolio across 3 Houston submarkets.'
      },
      {
        id:'d4', name:'Parkview Commons', type:'multifamily', raise:3100000, irr:19.0, equity:1.95,
        status:'dd', location:'San Antonio, TX', added:'2026-02-01', units:72, state:'TX',
        companyName:'Parkview Commons Capital LLC', purchasePrice:15500000, loanAmount:12400000,
        totalEquity:3100000, gpEquity:10, lpEquity:90, prefReturn:8, gpPromote:20, acqFee:3, assetMgmtFee:2,
        investors:[], documents:[], notes:'72-unit Class C value-add in San Antonio.',
        due: new Date(Date.now() + 5*86400000).toISOString().split('T')[0]
      },
      {
        id:'d5', name:'Westgate Retail Center', type:'retail', raise:5800000, irr:14.5, equity:1.6,
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
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'js/sp-documents.js', false); // synchronous
        xhr.send();
        if (xhr.status === 200) { eval(xhr.responseText); }
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
        totalAmount:84000, amount:84000,
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
        ]
      },
      // Q1 2026 Riverside Flats dist — pref fully current, all excess
      // Pref for Q1: di1 $5k, di2 $10k, di3 $5k = $20k. Dist=$90,000 → $20k pref + $70k excess
      // di1: 5000+70000*(5.95/23.8)=5000+17500=22500, di2: 10000+35000=45000, di3: 5000+17500=22500
      {
        id:'dd3', dealId:'d1', dealName:'Riverside Flats',
        period:'Q1 2026', quarter:'Q1', year:2026,
        totalAmount:90000, amount:90000,
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

    // Capital calls
    save('capitalCalls', [
      { id:'cc1', dealId:'d1', dealName:'Riverside Flats', callNumber:'Initial', amount:4200000, dueDate:'2025-11-20', purpose:'Property acquisition and closing costs', status:'received', sentAt:'2025-11-10T09:00:00.000Z', receivedAt:'2025-11-18T09:00:00.000Z' },
      { id:'cc2', dealId:'d4', dealName:'Parkview Commons', callNumber:'Initial', amount:3100000, dueDate:new Date(Date.now()+10*86400000).toISOString().split('T')[0], purpose:'Property acquisition — pending due diligence completion', status:'sent', sentAt:new Date().toISOString() },
    ]);

    // Activity log
    save('activity', [
      { icon:'fa-wallet', color:'purple', text:'Q4 distribution of <strong>$84,000</strong> sent to 3 investors from Riverside Flats', time:'Jan 5, 2026' },
      { icon:'fa-wallet', color:'purple', text:'Q4 distribution of <strong>$150,000</strong> sent to 2 investors from Meridian Industrial', time:'Jan 8, 2026' },
      { icon:'fa-building', color:'blue', text:'<strong>The Hudson Portfolio</strong> added — 248 units in Houston', time:'Jan 15, 2026' },
      { icon:'fa-user-plus', color:'green', text:'<strong>Priya Patel</strong> linked to Meridian Industrial — $1M commitment', time:'Dec 10, 2025' },
      { icon:'fa-file-contract', color:'amber', text:'Operating Agreement auto-generated for <strong>Riverside Flats</strong>', time:'Nov 10, 2025' },
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
    getOrgId, makeOrgKey, simpleHash,
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
    getUsers, saveUsers, getUserByEmail, createUser, authenticate, logout,
    // Invites
    createInviteToken, decodeInviteToken,
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
        // SDKs present but sp-firebase.js not loaded yet — load it
        const hasSPFB = Array.from(document.querySelectorAll('script[src]')).some(s => s.src.includes('sp-firebase'));
        if (!hasSPFB) {
          const cfg = document.createElement('script'); cfg.src = 'firebase-config.js';
          cfg.onload = () => {
            const fb = document.createElement('script'); fb.src = 'js/sp-firebase.js?v2';
            fb.onload = () => { if (typeof SPFB !== 'undefined') SPFB.init(); };
            document.head.appendChild(fb);
          };
          document.head.appendChild(cfg);
        }
        // If sp-firebase.js is in <head> as a sync script, it will load and call SPFB.init() on its own
      }
      return;
    }

    // Dynamically load Firebase SDKs then sp-firebase.js
    const sdks = [
      'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
      'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
      'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js',
    ];

    let loaded = 0;
    function onSDKLoad() {
      loaded++;
      if (loaded < sdks.length) return;
      // All SDKs loaded — load config then sp-firebase
      const cfg = document.createElement('script'); cfg.src = 'firebase-config.js';
      cfg.onload = () => {
        const fb = document.createElement('script'); fb.src = 'js/sp-firebase.js?v2';
        fb.onload = () => { if (typeof SPFB !== 'undefined') SPFB.init(); };
        document.head.appendChild(fb);
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
        <button onclick="localStorage.setItem('dt_notice_dismissed','1');document.getElementById('dt-notice-banner').remove();document.body.style.paddingBottom=''" style="background:#F37925;color:white;border:none;padding:7px 16px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.78rem;font-weight:600;white-space:nowrap;flex-shrink:0;">Got it</button>`;
      // Add bottom padding so content isn't hidden behind the banner
      setTimeout(() => {
        const h = banner.offsetHeight;
        if (h > 0) document.body.style.paddingBottom = h + 'px';
      }, 100);
      document.body.appendChild(banner);
    }
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

    // Ensure mobile menu button exists in top-bar
    const topLeft = document.querySelector('.top-left, .top-bar');
    if (topLeft && !document.querySelector('.mobile-menu-btn')) {
      const btn = document.createElement('button');
      btn.className = 'mobile-menu-btn';
      btn.style.cssText = 'display:none;background:none;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;cursor:pointer;align-items:center;justify-content:center;';
      btn.innerHTML = '<i class="fas fa-bars" style="color:#64748b;"></i>';
      btn.onclick = () => { sidebar.classList.toggle('open'); overlay.classList.toggle('visible'); };
      topLeft.insertBefore(btn, topLeft.firstChild);
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
          <span style="display:flex;align-items:center;gap:0;text-decoration:none;"><span style="font-size:1.25rem;font-weight:900;color:#F3F3F3;letter-spacing:-0.04em;line-height:1;">deel</span><span style="font-size:1.25rem;font-weight:900;color:#F37925;letter-spacing:-0.04em;line-height:1;">track</span></span>
        </a>`;
      }
    } else {
      // v2.0 Hardening: If sidebar-header is missing from HTML but sidebar is present, create it
      const sb = document.getElementById('sidebar');
      if (sb) {
        const header = document.createElement('div');
        header.className = 'sidebar-header';
        header.innerHTML = `<a href="dashboard.html" style="display:flex;align-items:center;gap:10px;text-decoration:none;">
          <span style="display:flex;align-items:center;gap:0;text-decoration:none;"><span style="font-size:1.25rem;font-weight:900;color:#F3F3F3;letter-spacing:-0.04em;line-height:1;">deel</span><span style="font-size:1.25rem;font-weight:900;color:#F37925;letter-spacing:-0.04em;line-height:1;">track</span></span>
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
          <span style="display:flex;align-items:center;gap:0;text-decoration:none;"><span style="font-size:1.25rem;font-weight:900;color:#F3F3F3;letter-spacing:-0.04em;line-height:1;">deel</span><span style="font-size:1.25rem;font-weight:900;color:#F37925;letter-spacing:-0.04em;line-height:1;">track</span></span>
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
          <button class="logout-btn" onclick="SP.logout()" style="width:100%;padding:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:8px;color:#f87171;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;transition:all 0.15s;" onmouseenter="this.style.background='rgba(239,68,68,0.2)'" onmouseleave="this.style.background='rgba(239,68,68,0.1)'">
            <i class="fas fa-sign-out-alt"></i> Sign Out
          </button>`;
        sb.appendChild(footer);
      }
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
        ]},
        // ── Deals ────────────────────────────────────────────────
        { id:'deals', title:'DEALS', items:[
          { href:'deals.html',        icon:'fa-building',          label:'Properties' },
          { href:'new-deal.html',     icon:'fa-plus',              label:'New Deal' },
          { href:'sourcing-crm.html', icon:'fa-stream',            label:'Pipeline' },
          { href:'deal-room.html',    icon:'fa-folder-open',       label:'Deal Room' },
        ]},
        // ── Investors ────────────────────────────────────────────
        { id:'investors', title:'INVESTORS', items:[
          { href:'investors.html',       icon:'fa-users',           label:'Investors' },
          { href:'inbox.html',           icon:'fa-inbox',           label:'Inbox' },
          { href:'investor-update.html', icon:'fa-bullhorn',        label:'Updates' },
        ]},
        // ── Finance ──────────────────────────────────────────────
        { id:'finance', title:'FINANCE', items:[
          { href:'distributions.html',    icon:'fa-wallet',              label:'Distributions' },
          { href:'capital-calls.html',    icon:'fa-hand-holding-usd',    label:'Capital Calls' },
          { href:'capital-account.html',  icon:'fa-list-ol',             label:'Capital Accounts' },
        ]},
        // ── Documents ────────────────────────────────────────────
        { id:'docs', title:'DOCUMENTS', items:[
          { href:'documents.html',   icon:'fa-file-contract',  label:'Documents' },
          { href:'k1-generator.html',icon:'fa-file-invoice-dollar', label:'K-1 / Tax' },
          { href:'om-builder.html',  icon:'fa-file-pdf',       label:'OM Builder' },
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
  });
})();
