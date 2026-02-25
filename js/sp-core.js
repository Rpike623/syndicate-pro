/**
 * deeltrack Core — Auth, Data Access, Org Scoping
 * Include this on every page: <script src="js/sp-core.js"></script>
 */

const SP = (function () {

  // ─── Session ────────────────────────────────────────────────────────────────

  function getSession() {
    try { return JSON.parse(localStorage.getItem('sp_session') || 'null'); } catch(e) { return null; }
  }

  function setSession(s) {
    localStorage.setItem('sp_session', JSON.stringify(s));
  }

  function clearSession() {
    localStorage.removeItem('sp_session');
  }

  function isLoggedIn() {
    const s = getSession();
    return !!(s && s.loggedIn);
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
  // orgId = hash of GP email. Investors share the GP's orgId (stored on their user record).

  function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36);
  }

  function getOrgId() {
    const s = getSession();
    if (!s) return null;
    // GPs: orgId stored on session. Investors: orgId stored on their user record (set at invite time).
    if (s.orgId) return s.orgId;
    // Fallback: derive from email
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
    if (!isLoggedIn()) { window.location.href = 'login.html'; return false; }
    if (isInvestor()) { window.location.href = 'investor-portal.html'; return false; }
    return true;
  }

  function requireInvestor() {
    if (!isLoggedIn()) { window.location.href = 'login.html'; return false; }
    if (isGP()) { window.location.href = 'dashboard.html'; return false; }
    return true;
  }

  function requireAuth() {
    if (!isLoggedIn()) { window.location.href = 'login.html'; return false; }
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
    const demoEmails = ['demo@deeltrack.com', 'demo@syndicatepro.com'];
    demoEmails.forEach(demoEmail => {
      if (!users.find(u => u.email === demoEmail)) {
        const orgId = simpleHash('demo@deeltrack.com'); // same orgId for both so data is shared
        users.push({ email: demoEmail, password: 'demo123', name: 'Robert Pike', role: 'General Partner', orgId });
      }
    });
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

    // Seed rich demo data for the demo account on first login
    if (['demo@deeltrack.com','demo@syndicatepro.com'].includes(email.toLowerCase())) {
      seedDemoData(session);
    }

    return session;
  }

  function logout() {
    clearSession();
    window.location.href = 'login.html';
  }

  // ─── Demo data seeding ──────────────────────────────────────────────────────
  function seedDemoData(session) {
    const orgKey = makeOrgKey('deals');
    if (localStorage.getItem(orgKey)) return; // already seeded

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
    ];
    save('investors', investors);

    function makeOA(deal, gpName, gpRep) {
      const state = deal.state || 'TX';
      const sc = state === 'TX' ? '<p><strong>Tax Treatment.</strong> The Company elects partnership treatment under Texas Tax Code § 171.0002.</p><p><strong>Community Property.</strong> Spousal consent obtained per Texas Family Code § 3.104.</p>' : '<p><strong>Charging Order.</strong> Sole remedy per Delaware LLC Act Section 18-703.</p>';
      const today = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
      const equity = deal.totalEquity || deal.raise || 0;
      return `<div style="font-family:Georgia,serif;line-height:1.8;">
        <div style="background:#fef9c3;border:1px solid #fbbf24;border-radius:6px;padding:12px 16px;margin-bottom:24px;font-size:.8rem;font-family:sans-serif;color:#78350f;"><strong>⚠ PLACEHOLDER DOCUMENT</strong> — Auto-generated for reference. Have your attorney review before use with actual investors.</div>
        <h1 style="text-align:center;font-size:1.4rem;">${deal.companyName || gpName}</h1>
        <p style="text-align:center;color:#64748b;">A ${state} Limited Liability Company — Operating Agreement — ${today}</p>
        <h2 style="font-size:1rem;margin-top:20px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">ARTICLE I — FORMATION</h2>
        <p><strong>1.2 Name.</strong> ${deal.companyName || gpName}.</p>
        <p><strong>1.4 Purpose.</strong> Acquire, own, and operate <strong>${deal.name}</strong> at ${deal.location}.</p>
        <h2 style="font-size:1rem;margin-top:20px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">ARTICLE II — CAPITAL</h2>
        <p><strong>2.1 Total Equity:</strong> $${equity.toLocaleString()} &nbsp;·&nbsp; GP: ${deal.gpEquity||10}% &nbsp;/&nbsp; LP: ${deal.lpEquity||90}%</p>
        <p><strong>2.4 Minimum Investment:</strong> $${(deal.minInvestment||50000).toLocaleString()}</p>
        <h2 style="font-size:1rem;margin-top:20px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">ARTICLE III — DISTRIBUTIONS</h2>
        <p><strong>Waterfall:</strong> (a) Return of capital; (b) ${deal.prefReturn||8}% preferred return to LPs; (c) GP catch-up to ${deal.gpPromote||20}%; (d) ${deal.gpPromote||20}/${100-(deal.gpPromote||20)} GP/LP split on remaining cash.</p>
        <p><strong>Fees:</strong> Acquisition fee ${deal.acqFee||3}% · Asset management fee ${deal.assetMgmtFee||2}% of gross revenues.</p>
        <h2 style="font-size:1rem;margin-top:20px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">STATE PROVISIONS (${state})</h2>
        ${sc}
        <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;">
          <div><div style="border-top:1px solid #333;padding-top:6px;margin-top:40px;"></div><div>${gpRep}, Managing Member</div></div>
          <div><div style="border-top:1px solid #333;padding-top:6px;margin-top:40px;"></div><div>Limited Partners (See Schedule A)</div></div>
        </div>
      </div>`;
    }

    const oa1 = makeOA({name:'Riverside Flats',location:'Austin, TX',state:'TX',raise:4200000,totalEquity:4200000,gpEquity:10,lpEquity:90,prefReturn:8,gpPromote:20,acqFee:3,assetMgmtFee:2,minInvestment:100000,companyName:'Riverside Flats Capital LLC'}, 'Pike Capital Management LLC', 'Robert Pike');
    const oa2 = makeOA({name:'The Hudson Portfolio',location:'Houston, TX',state:'TX',raise:12000000,totalEquity:12000000,gpEquity:10,lpEquity:90,prefReturn:8,gpPromote:20,acqFee:3,assetMgmtFee:2,minInvestment:250000,companyName:'Hudson Portfolio Capital LLC'}, 'Pike Capital Management LLC', 'Robert Pike');

    // Deals with investors linked, OAs pre-generated
    const deals = [
      {
        id:'d1', name:'Riverside Flats', type:'multifamily', raise:4200000, irr:18.5, equity:1.9,
        status:'operating', location:'Austin, TX', added:'2025-11-10', units:96, state:'TX',
        companyName:'Riverside Flats Capital LLC', purchasePrice:21000000, loanAmount:16800000,
        totalEquity:4200000, gpEquity:10, lpEquity:90, prefReturn:8, gpPromote:20, acqFee:3, assetMgmtFee:2,
        generatedOA: oa1, oaGeneratedAt:'2025-11-10T09:00:00.000Z',
        investors:[
          {investorId:'di1',committed:250000,ownership:5.95,status:'active',linkedAt:'2025-11-15T10:00:00.000Z',subStatus:'signed'},
          {investorId:'di2',committed:500000,ownership:11.9,status:'active',linkedAt:'2025-11-15T10:00:00.000Z',subStatus:'funded'},
          {investorId:'di3',committed:250000,ownership:5.95,status:'active',linkedAt:'2025-11-20T10:00:00.000Z',subStatus:'signed'},
        ],
        documents:[], notes:'96-unit Class B multifamily. Value-add play with $200/unit rent upside.'
      },
      {
        id:'d2', name:'Meridian Industrial', type:'industrial', raise:7500000, irr:21.2, equity:2.1,
        status:'closed', location:'Dallas, TX', added:'2025-12-01', units:0, state:'TX',
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
        status:'operating', location:'Houston, TX', added:'2026-01-15', units:248, state:'TX',
        companyName:'Hudson Portfolio Capital LLC', purchasePrice:60000000, loanAmount:48000000,
        totalEquity:12000000, gpEquity:10, lpEquity:90, prefReturn:8, gpPromote:20, acqFee:3, assetMgmtFee:2,
        generatedOA: oa2, oaGeneratedAt:'2026-01-15T09:00:00.000Z',
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
    save('deals', deals);

    // Distributions (so investor portal shows real history)
    save('distributions', [
      { id:'dd1', dealId:'d1', dealName:'Riverside Flats', period:'Q4 2025', quarter:'Q4', year:2025, totalAmount:84000, amount:84000, date:'2026-01-05', method:'Wire', investorCount:3,
        recipients:[{investorId:'di1',amount:14875,ownership:5.95},{investorId:'di2',amount:29750,ownership:11.9},{investorId:'di3',amount:14875,ownership:5.95}] },
      { id:'dd2', dealId:'d2', dealName:'Meridian Industrial', period:'Q4 2025', quarter:'Q4', year:2025, totalAmount:150000, amount:150000, date:'2026-01-08', method:'Wire', investorCount:2,
        recipients:[{investorId:'di2',amount:50025,ownership:6.67},{investorId:'di4',amount:99975,ownership:13.33}] },
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

  // ─── Public API ─────────────────────────────────────────────────────────────

  return {
    // Session
    getSession, setSession, clearSession, isLoggedIn, isGP, isInvestor,
    getOrgId, makeOrgKey, simpleHash,
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
      // Firebase already loaded (e.g. login.html injected it)
      if (typeof SPFB !== 'undefined') { SPFB.init(); }
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
        const fb = document.createElement('script'); fb.src = 'js/sp-firebase.js';
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

// ─── Theme: inject sp-theme.js on every page ─────────────────────────────────
(function loadTheme() {
  if (typeof document === 'undefined') return;
  const s = document.createElement('script');
  s.src = (document.currentScript?.src || '').replace('sp-core.js','') + 'sp-theme.js';
  // Fallback path resolution
  if (!s.src || s.src === 'sp-theme.js') s.src = 'js/sp-theme.js';
  document.head.appendChild(s);
})();

// ─── Legal footer + disclaimer banner ────────────────────────────────────────
(function injectLegalFooter() {
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function () {
    // Don't inject on legal pages themselves
    const path = window.location.pathname;
    if (['/terms.html','/privacy.html','/disclaimer.html','/login.html','/signup.html'].some(p => path.endsWith(p))) return;

    // Footer disclaimer bar at bottom of every app page
    if (!document.getElementById('dt-legal-footer')) {
      const footer = document.createElement('div');
      footer.id = 'dt-legal-footer';
      footer.style.cssText = 'background:#0f172a;color:rgba(255,255,255,0.45);font-size:.7rem;padding:12px 32px;text-align:center;line-height:1.6;font-family:Inter,sans-serif;margin-top:auto;';
      footer.innerHTML = `deeltrack is a software tool, not a registered broker-dealer, investment adviser, or placement agent. Nothing on this platform constitutes investment advice or a solicitation to buy or sell securities. Financial projections are estimates only — not guarantees. All generated documents are templates requiring attorney review before use. &nbsp;·&nbsp; <a href="terms.html" style="color:rgba(255,255,255,0.6);text-decoration:none;">Terms</a> &nbsp;·&nbsp; <a href="privacy.html" style="color:rgba(255,255,255,0.6);text-decoration:none;">Privacy</a> &nbsp;·&nbsp; <a href="disclaimer.html" style="color:rgba(255,255,255,0.6);text-decoration:none;">Disclaimer</a>`;
      document.body.appendChild(footer);
    }

    // One-time localStorage notice (shows once, dismissed permanently)
    const dismissed = localStorage.getItem('dt_notice_dismissed');
    if (!dismissed && !document.getElementById('dt-notice-banner')) {
      const banner = document.createElement('div');
      banner.id = 'dt-notice-banner';
      banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1e293b;color:rgba(255,255,255,.85);padding:14px 24px;display:flex;align-items:center;gap:16px;z-index:9000;font-family:Inter,sans-serif;font-size:.8rem;box-shadow:0 -4px 20px rgba(0,0,0,.3);flex-wrap:wrap;';
      banner.innerHTML = `
        <div style="flex:1;min-width:200px;">
          <strong style="color:white;">Platform Notice:</strong> deeltrack is organizational software — not a broker-dealer or investment adviser. Financial projections and generated documents require independent professional review. Your data is stored in your browser.
          <a href="disclaimer.html" style="color:#60a5fa;margin-left:8px;">Full Disclaimer</a>
        </div>
        <button onclick="localStorage.setItem('dt_notice_dismissed','1');document.getElementById('dt-notice-banner').remove()" style="background:#3b82f6;color:white;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.8rem;font-weight:600;white-space:nowrap;flex-shrink:0;">Got it</button>`;
      document.body.appendChild(banner);
    }
  });
})();

// ─── PWA: Register service worker ────────────────────────────────────────────
(function registerSW() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/syndicate-pro/sw.js')
      .then(reg => {
        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Show update banner
              const banner = document.createElement('div');
              banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#3b82f6;color:white;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;z-index:9999;font-family:Inter,sans-serif;font-size:.875rem;';
              banner.innerHTML = '<span><i class="fas fa-download" style="margin-right:8px;"></i>New version available</span><button onclick="window.location.reload()" style="background:white;color:#3b82f6;border:none;padding:6px 14px;border-radius:6px;font-weight:700;cursor:pointer;">Update Now</button>';
              document.body.appendChild(banner);
            }
          });
        });
      })
      .catch(err => console.warn('SW registration failed:', err));
  });
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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="34" height="34" style="flex-shrink:0;">
            <circle cx="16" cy="16" r="15" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1.5"/>
            <circle cx="16" cy="16" r="15" fill="none" stroke="#3b82f6" stroke-width="1.5"/>
            <rect x="7" y="5" width="3.5" height="22" rx="1.5" fill="#3b82f6"/>
            <path d="M 13 11 L 23 16 L 13 21" stroke="#3b82f6" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span style="font-size:1.2rem;font-weight:700;color:white;letter-spacing:-0.3px;">deel<span style="color:#60a5fa;">track</span></span>
        </a>`;
      }
    }

    // Rebuild sidebar nav completely — ensures every page has the correct full nav
    const nav = document.querySelector('.sidebar .nav');
    if (nav) {
      const page = window.location.pathname.split('/').pop() || 'dashboard.html';
      const navItems = [
        { section: 'Main' },
        { href: 'dashboard.html', icon: 'fa-th-large', label: 'Dashboard' },
        { href: 'pipeline.html', icon: 'fa-stream', label: 'Pipeline' },
        { href: 'new-deal.html', icon: 'fa-calculator', label: 'Deal Modeling' },
        { href: 'investors.html', icon: 'fa-users', label: 'Investors' },
        { href: 'documents.html', icon: 'fa-file-contract', label: 'Documents' },
        { href: 'reports.html', icon: 'fa-chart-bar', label: 'Reports' },
        { section: 'Tools' },
        { href: 'proforma.html', icon: 'fa-table', label: 'Pro Forma' },
        { href: 'distributions.html', icon: 'fa-wallet', label: 'Distributions' },
        { href: 'capital-calls.html', icon: 'fa-hand-holding-usd', label: 'Capital Calls' },
        { href: 'k1-generator.html', icon: 'fa-file-invoice-dollar', label: 'K-1 Generator' },
        { href: 'email-templates.html', icon: 'fa-envelope', label: 'Email Templates' },
        { href: 'deal-room.html', icon: 'fa-folder-open', label: 'Deal Room' },
        { href: 'deal-compare.html', icon: 'fa-balance-scale', label: 'Compare Deals' },
        { section: 'Account' },
        { href: 'settings.html', icon: 'fa-cog', label: 'Settings' },
      ];

      // Also active for deal-detail, investor-detail, etc.
      const activeMap = {
        'deal-detail.html': 'pipeline.html',
        'deals.html': 'pipeline.html',
        'investor-detail.html': 'investors.html',
        'investor-statements.html': 'reports.html',
        'distribution-calc.html': 'distributions.html',
        'deal-teaser.html': 'pipeline.html',
        'deal-compare.html': 'deal-compare.html',
        'rent-roll-analyzer.html': 'proforma.html',
        'market-comps.html': 'reports.html',
        'ic-memo-builder.html': 'documents.html',
      };
      const activePage = activeMap[page] || page;

      nav.innerHTML = navItems.map(item => {
        if (item.section) return `<div class="nav-section">${item.section}</div>`;
        const isActive = item.href === activePage;
        return `<a href="${item.href}" class="nav-item ${isActive ? 'active' : ''}"><i class="fas ${item.icon}"></i><span>${item.label}</span></a>`;
      }).join('');
    }

    // Apply saved theme
    SP.applyTheme(localStorage.getItem('sp_theme') || 'light');

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
