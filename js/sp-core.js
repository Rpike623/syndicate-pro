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

      // Theme toggle Link
      const themeLink = document.createElement('a');
      themeLink.href = '#';
      themeLink.className = 'nav-item';
      themeLink.innerHTML = '<i class="fas fa-moon"></i><span id="themeLabel">Dark Mode</span>';
      themeLink.onclick = (e) => { e.preventDefault(); SP.toggleTheme(); };
      nav.appendChild(themeLink);
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
