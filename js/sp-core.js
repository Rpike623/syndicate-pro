/**
 * SyndicatePro Core — Auth, Data Access, Org Scoping
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
    return {
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
    // Seed demo GP if not exists
    if (!users.find(u => u.email === 'demo@syndicatepro.com')) {
      const orgId = simpleHash('demo@syndicatepro.com');
      users.push({ email: 'demo@syndicatepro.com', password: 'demo123', name: 'Robert Pike', role: 'General Partner', orgId });
      localStorage.setItem('sp_users', JSON.stringify(users));
    }
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
    return session;
  }

  function logout() {
    clearSession();
    window.location.href = 'login.html';
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
    // Settings
    getSettings: () => { try { return JSON.parse(localStorage.getItem(SP.makeOrgKey('settings')) || '{}'); } catch(e) { return {}; } },
  };
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
    // Inject Settings nav link if sidebar nav exists and doesn't already have it
    const nav = document.querySelector('.sidebar .nav');
    if (nav && !nav.querySelector('a[href="settings.html"]')) {
      const section = document.createElement('div');
      section.className = 'nav-section';
      section.textContent = 'Account';
      const link = document.createElement('a');
      link.href = 'settings.html';
      link.className = 'nav-item';
      link.innerHTML = '<i class="fas fa-cog"></i><span>Settings</span>';
      // Mark active if on settings page
      if (window.location.pathname.endsWith('settings.html')) link.classList.add('active');
      nav.appendChild(section);
      nav.appendChild(link);
    }

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
