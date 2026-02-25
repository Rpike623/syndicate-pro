/**
 * sp-data.js — Firestore-first data layer for deeltrack
 *
 * Single source of truth: Firestore.
 * In-memory cache for instant synchronous reads after first load.
 * localStorage is NOT used for data — only for auth session.
 *
 * Usage: same API as SP.* — existing pages work without changes.
 * Patches SP.getDeals, SP.saveDeals, etc. once Firestore is ready.
 *
 * Load order: firebase-config.js → sp-core.js → sp-firebase.js → sp-data.js
 */

const SPData = (() => {
  // ── In-memory cache ────────────────────────────────────────────────────────
  const _cache = {
    deals:         null,  // [] once loaded
    investors:     null,
    distributions: null,
    capitalCalls:  null,
    settings:      null,
    activity:      null,
  };

  let _ready   = false;
  let _db      = null;
  let _orgId   = null;
  let _role    = null;
  let _email   = null;
  const _readyCallbacks = [];

  // ── Internal helpers ────────────────────────────────────────────────────────
  function _col(name) {
    return _db.collection('orgs').doc(_orgId).collection(name);
  }

  function _ts() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  async function _loadCollection(name) {
    try {
      let query = _col(name);
      if (name === 'deals' || name === 'distributions') {
        query = query.orderBy('updatedAt', 'desc');
      }
      const snap = await query.get();
      _cache[name] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      // orderBy fails if no index or no docs — retry without ordering
      try {
        const snap = await _col(name).get();
        _cache[name] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch(e2) {
        console.warn(`SPData: failed to load ${name}:`, e2.message);
        _cache[name] = [];
      }
    }
  }

  async function _loadSettings() {
    try {
      const snap = await _col('settings').limit(1).get();
      _cache.settings = snap.empty ? {} : { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch(e) {
      _cache.settings = {};
    }
  }

  // ── Init — called by sp-firebase.js once auth is ready ────────────────────
  async function init(db, orgId, role, email) {
    _db    = db;
    _orgId = orgId;
    _role  = role;
    _email = email;

    // Pre-warm cache: load all collections in parallel
    await Promise.all([
      _loadCollection('deals'),
      _loadCollection('investors'),
      _loadCollection('distributions'),
      _loadCollection('capitalCalls'),
      _loadSettings(),
    ]);

    _ready = true;
    _patchSP();

    // Fire ready callbacks
    _readyCallbacks.forEach(cb => { try { cb(); } catch(e) {} });
    _readyCallbacks.length = 0;

    // Dispatch event so pages can re-render with fresh data
    window.dispatchEvent(new CustomEvent('spdata-ready'));

    console.log(`SPData: ready — org=${orgId} role=${role} deals=${_cache.deals.length} investors=${_cache.investors.length}`);
  }

  function onReady(cb) {
    if (_ready) { cb(); return; }
    _readyCallbacks.push(cb);
  }

  function isReady() { return _ready; }

  // ── DEALS ──────────────────────────────────────────────────────────────────
  function getDeals() {
    if (!_ready) return _lsFallback('deals');
    const deals = _cache.deals || [];
    // Investors only see their linked deals
    if (_role === 'Investor') {
      const inv = getInvestorByEmail(_email);
      if (!inv) return [];
      return deals.filter(d => (d.investors || []).some(i => i.investorId === inv.id));
    }
    return deals;
  }

  function getDealById(id) {
    return (_cache.deals || _lsFallback('deals')).find(d => d.id === id) || null;
  }

  function getDealsForInvestor(investorId) {
    return (_cache.deals || []).filter(d =>
      (d.investors || []).some(i => i.investorId === investorId)
    );
  }

  async function saveDeal(deal) {
    if (!deal.id) deal.id = 'deal_' + Date.now();
    // Update cache immediately for instant UI
    const idx = (_cache.deals || []).findIndex(d => d.id === deal.id);
    if (idx >= 0) _cache.deals[idx] = deal;
    else (_cache.deals = _cache.deals || []).push(deal);

    await _col('deals').doc(deal.id).set({
      ...deal, orgId: _orgId, updatedAt: _ts(),
    }, { merge: true }).catch(e => console.warn('SPData.saveDeal:', e.message));
    return deal;
  }

  async function saveDeals(deals) {
    _cache.deals = deals;
    if (!_db || !_orgId) return;
    const batch = _db.batch();
    deals.forEach(d => batch.set(_col('deals').doc(d.id), { ...d, orgId: _orgId, updatedAt: _ts() }, { merge: true }));
    await batch.commit().catch(e => console.warn('SPData.saveDeals:', e.message));
  }

  async function deleteDeal(id) {
    _cache.deals = (_cache.deals || []).filter(d => d.id !== id);
    await _col('deals').doc(id).delete().catch(e => console.warn('SPData.deleteDeal:', e.message));
  }

  // ── INVESTORS ──────────────────────────────────────────────────────────────
  function getInvestors() {
    if (!_ready) return _lsFallback('investors');
    const invs = _cache.investors || [];
    if (_role === 'Investor') return invs.filter(i => i.email?.toLowerCase() === _email?.toLowerCase());
    return invs;
  }

  function getInvestorById(id) {
    return (_cache.investors || _lsFallback('investors')).find(i => i.id === id) || null;
  }

  function getInvestorByEmail(email) {
    if (!email) return null;
    return (_cache.investors || _lsFallback('investors'))
      .find(i => i.email?.toLowerCase() === email.toLowerCase()) || null;
  }

  function getCurrentInvestorRecord() {
    const session = SP && SP.getSession ? SP.getSession() : null;
    if (!session?.email) return null;
    return getInvestorByEmail(session.email);
  }

  async function saveInvestors(investors) {
    _cache.investors = investors;
    if (!_db || !_orgId) return;
    const batch = _db.batch();
    investors.forEach(i => batch.set(_col('investors').doc(i.id), { ...i, orgId: _orgId, updatedAt: _ts() }, { merge: true }));
    await batch.commit().catch(e => console.warn('SPData.saveInvestors:', e.message));
  }

  async function deleteInvestor(id) {
    _cache.investors = (_cache.investors || []).filter(i => i.id !== id);
    await _col('investors').doc(id).delete().catch(e => console.warn('SPData.deleteInvestor:', e.message));
  }

  // ── DISTRIBUTIONS ──────────────────────────────────────────────────────────
  function getDistributions() {
    return _cache.distributions || _lsFallback('distributions');
  }

  function getDistributionsForInvestor(investorId) {
    return getDistributions().filter(d =>
      Array.isArray(d.recipients)
        ? d.recipients.some(r => r.investorId === investorId)
        : d.investorId === investorId
    );
  }

  async function saveDistributions(dists) {
    _cache.distributions = dists;
    if (!_db || !_orgId) return;
    const batch = _db.batch();
    dists.forEach(d => {
      if (!d.id) d.id = 'dist_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      batch.set(_col('distributions').doc(d.id), { ...d, orgId: _orgId, updatedAt: _ts() }, { merge: true });
    });
    await batch.commit().catch(e => console.warn('SPData.saveDistributions:', e.message));
  }

  async function saveDistribution(dist) {
    if (!dist.id) dist.id = 'dist_' + Date.now();
    const idx = (_cache.distributions || []).findIndex(d => d.id === dist.id);
    if (idx >= 0) _cache.distributions[idx] = dist;
    else (_cache.distributions = _cache.distributions || []).push(dist);
    await _col('distributions').doc(dist.id).set({ ...dist, orgId: _orgId, updatedAt: _ts() }, { merge: true })
      .catch(e => console.warn('SPData.saveDistribution:', e.message));
  }

  // ── CAPITAL CALLS ──────────────────────────────────────────────────────────
  function getCapitalCalls() {
    return _cache.capitalCalls || [];
  }

  async function saveCapitalCalls(calls) {
    _cache.capitalCalls = calls;
    if (!_db || !_orgId) return;
    const batch = _db.batch();
    calls.forEach(c => {
      if (!c.id) c.id = 'call_' + Date.now();
      batch.set(_col('capitalCalls').doc(c.id), { ...c, orgId: _orgId, updatedAt: _ts() }, { merge: true });
    });
    await batch.commit().catch(e => console.warn('SPData.saveCapitalCalls:', e.message));
  }

  async function saveCapitalCall(call) {
    if (!call.id) call.id = 'call_' + Date.now();
    const idx = (_cache.capitalCalls || []).findIndex(c => c.id === call.id);
    if (idx >= 0) _cache.capitalCalls[idx] = call;
    else (_cache.capitalCalls = _cache.capitalCalls || []).push(call);
    await _col('capitalCalls').doc(call.id).set({ ...call, orgId: _orgId, updatedAt: _ts() }, { merge: true })
      .catch(e => console.warn('SPData.saveCapitalCall:', e.message));
  }

  // ── SETTINGS ───────────────────────────────────────────────────────────────
  function getSettings() {
    return _cache.settings || {};
  }

  async function saveSettings(settings) {
    _cache.settings = settings;
    if (!_db || !_orgId) return;
    await _col('settings').doc('main').set({ ...settings, orgId: _orgId, updatedAt: _ts() }, { merge: true })
      .catch(e => console.warn('SPData.saveSettings:', e.message));
  }

  // ── ACTIVITY ───────────────────────────────────────────────────────────────
  function logActivity(icon, color, text) {
    const entry = { icon, color, text, time: 'Just now', ts: Date.now() };
    _cache.activity = [entry, ...(_cache.activity || [])].slice(0, 50);
    if (_db && _orgId) {
      _col('activity').add({ ...entry, orgId: _orgId }).catch(() => {});
    }
  }

  function getActivity() {
    if (_cache.activity) return _cache.activity;
    try { return JSON.parse(localStorage.getItem(SP.makeOrgKey('activity')) || '[]'); } catch(e) { return []; }
  }

  // ── localStorage fallback (pre-init only) ──────────────────────────────────
  function _lsFallback(key) {
    if (!window.SP) return [];
    try {
      const k = SP.makeOrgKey ? SP.makeOrgKey(key) : `sp_${key}`;
      return JSON.parse(localStorage.getItem(k) || '[]');
    } catch(e) { return []; }
  }

  // ── Patch SP.* — existing page code works without changes ─────────────────
  function _patchSP() {
    if (!window.SP) return;

    // Reads
    SP.getDeals                 = getDeals;
    SP.getDealById              = getDealById;
    SP.getDealsForInvestor      = getDealsForInvestor;
    SP.getDealsForCurrentInvestor = () => {
      const inv = getCurrentInvestorRecord();
      return inv ? getDealsForInvestor(inv.id) : [];
    };
    SP.getInvestors             = getInvestors;
    SP.getInvestorById          = getInvestorById;
    SP.getInvestorByEmail       = getInvestorByEmail;
    SP.getCurrentInvestorRecord = getCurrentInvestorRecord;
    SP.getDistributions         = getDistributions;
    SP.getDistributionsForInvestor = getDistributionsForInvestor;
    SP.getActivity              = getActivity;

    // Writes
    SP.saveDeals         = saveDeals;
    SP.saveInvestors     = saveInvestors;
    SP.saveDistributions = saveDistributions;
    SP.logActivity       = logActivity;

    // SP.load / SP.save — intercept data keys, pass others through
    const _origLoad = SP.load.bind(SP);
    const _origSave = SP.save.bind(SP);

    SP.load = function(key, def) {
      if (key === 'capitalCalls')   return getCapitalCalls();
      if (key === 'distributions')  return getDistributions();
      if (key === 'settings')       return getSettings();
      if (key === 'activity')       return getActivity();
      if (key === 'deals')          return getDeals();
      if (key === 'investors')      return getInvestors();
      return _origLoad(key, def);
    };

    SP.save = function(key, value) {
      if (key === 'capitalCalls') { saveCapitalCalls(Array.isArray(value) ? value : [value]); return; }
      if (key === 'distributions') { saveDistributions(Array.isArray(value) ? value : [value]); return; }
      if (key === 'settings')     { saveSettings(value); return; }
      _origSave(key, value);
    };

    console.log('SPData: SP.* patched — Firestore is now the single source of truth');
  }

  return {
    init, onReady, isReady,
    // Deals
    getDeals, getDealById, getDealsForInvestor, saveDeal, saveDeals, deleteDeal,
    // Investors
    getInvestors, getInvestorById, getInvestorByEmail, getCurrentInvestorRecord,
    saveInvestors, deleteInvestor,
    // Distributions
    getDistributions, getDistributionsForInvestor, saveDistribution, saveDistributions,
    // Capital calls
    getCapitalCalls, saveCapitalCall, saveCapitalCalls,
    // Settings
    getSettings, saveSettings,
    // Activity
    logActivity, getActivity,
  };
})();
