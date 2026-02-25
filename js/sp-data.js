/**
 * sp-data.js — Firestore-first data layer for deeltrack
 *
 * Single source of truth: Firestore.
 * In-memory cache for instant synchronous reads after first load.
 * localStorage is NOT used for data — only for auth session (SP.getSession).
 *
 * Load order: sp-data.js → sp-firebase.js (sp-data must be defined first)
 * sp-firebase calls SPData.init() once Firebase Auth resolves.
 * Pages listen for 'spdata-ready' event to re-render with live data.
 */

const SPData = (() => {

  // ── In-memory cache ────────────────────────────────────────────────────────
  const _cache = {
    deals:         null,
    investors:     null,
    distributions: null,
    capitalCalls:  null,
    settings:      null,
    activity:      [],
  };

  let _ready   = false;
  let _db      = null;
  let _orgId   = null;
  let _role    = null;
  let _email   = null;
  const _readyCallbacks = [];

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function _col(name) {
    return _db.collection('orgs').doc(_orgId).collection(name);
  }
  function _ts() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }
  function _id(prefix) {
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  }

  // Chunked batch write to avoid Firestore 500-doc limit
  async function _batchWrite(items, refFn) {
    const CHUNK = 400;
    for (let i = 0; i < items.length; i += CHUNK) {
      const batch = _db.batch();
      items.slice(i, i + CHUNK).forEach(item => {
        batch.set(refFn(item), { ...item, orgId: _orgId, updatedAt: _ts() }, { merge: true });
      });
      await batch.commit();
    }
  }

  // Load a collection into cache, with fallback
  async function _load(name, orderField) {
    try {
      const snap = await (orderField
        ? _col(name).orderBy(orderField, 'desc').get()
        : _col(name).get()
      );
      _cache[name] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      // orderBy fails with no index — retry without ordering
      try {
        const snap = await _col(name).get();
        _cache[name] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch(e2) {
        console.warn(`SPData: load ${name} failed:`, e2.message);
        _cache[name] = [];
      }
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init(db, orgId, role, email) {
    _db    = db;
    _orgId = orgId;
    _role  = role  || 'General Partner';
    _email = email || '';

    // Load all collections in parallel
    await Promise.all([
      _load('deals'),
      _load('investors'),
      _load('distributions'),
      _load('capitalCalls'),
      _load('activity'),
    ]);

    // Load settings separately (single doc, not collection)
    try {
      const snap = await _col('settings').doc('main').get();
      _cache.settings = snap.exists ? { id: snap.id, ...snap.data() } : {};
    } catch(e) {
      try {
        // Fallback: settings may be stored as multiple docs
        const snap = await _col('settings').limit(1).get();
        _cache.settings = snap.empty ? {} : { id: snap.docs[0].id, ...snap.docs[0].data() };
      } catch(e2) { _cache.settings = {}; }
    }

    _ready = true;
    _patchSP();

    // Fire ready callbacks
    _readyCallbacks.forEach(cb => { try { cb(); } catch(e) {} });
    _readyCallbacks.length = 0;

    // Dispatch event so pages re-render with live data
    window.dispatchEvent(new CustomEvent('spdata-ready'));

    console.log(`SPData ready — org=${orgId} role=${role} deals=${_cache.deals.length} investors=${_cache.investors.length}`);
  }

  function onReady(cb) {
    if (_ready) { cb(); return; }
    _readyCallbacks.push(cb);
  }
  function isReady() { return _ready; }
  function getOrgId() { return _orgId; }

  // ── DEALS ──────────────────────────────────────────────────────────────────
  function getDeals() {
    const all = _cache.deals || [];
    if (_role === 'Investor') {
      const inv = getInvestorByEmail(_email);
      if (!inv) return [];
      return all.filter(d => (d.investors || []).some(i => i.investorId === inv.id));
    }
    return all;
  }
  function getDealById(id) {
    return (_cache.deals || []).find(d => d.id === id) || null;
  }
  function getDealsForInvestor(investorId) {
    return (_cache.deals || []).filter(d =>
      (d.investors || []).some(i => i.investorId === investorId)
    );
  }
  async function saveDeal(deal) {
    if (!deal.id) deal.id = _id('deal');
    const idx = (_cache.deals || []).findIndex(d => d.id === deal.id);
    if (idx >= 0) _cache.deals[idx] = deal; else (_cache.deals = _cache.deals || []).unshift(deal);
    if (_db) await _col('deals').doc(deal.id)
      .set({ ...deal, orgId: _orgId, updatedAt: _ts() }, { merge: true })
      .catch(e => console.warn('SPData.saveDeal:', e.message));
    return deal;
  }
  async function saveDeals(deals) {
    _cache.deals = deals;
    if (!_db || !_orgId) return;
    await _batchWrite(deals, item => _col('deals').doc(item.id || _id('deal')))
      .catch(e => console.warn('SPData.saveDeals:', e.message));
  }
  async function deleteDeal(id) {
    _cache.deals = (_cache.deals || []).filter(d => d.id !== id);
    if (_db) await _col('deals').doc(id).delete().catch(() => {});
  }

  // ── INVESTORS ──────────────────────────────────────────────────────────────
  function getInvestors() {
    const all = _cache.investors || [];
    if (_role === 'Investor') return all.filter(i => i.email?.toLowerCase() === _email?.toLowerCase());
    return all;
  }
  function getInvestorById(id) {
    return (_cache.investors || []).find(i => i.id === id) || null;
  }
  function getInvestorByEmail(email) {
    if (!email) return null;
    return (_cache.investors || []).find(i => i.email?.toLowerCase() === email.toLowerCase()) || null;
  }
  function getCurrentInvestorRecord() {
    const session = typeof SP !== 'undefined' && SP.getSession ? SP.getSession() : null;
    return session?.email ? getInvestorByEmail(session.email) : null;
  }
  async function saveInvestors(investors) {
    _cache.investors = investors;
    if (!_db || !_orgId) return;
    await _batchWrite(investors, item => _col('investors').doc(item.id || _id('inv')))
      .catch(e => console.warn('SPData.saveInvestors:', e.message));
  }
  async function deleteInvestor(id) {
    _cache.investors = (_cache.investors || []).filter(i => i.id !== id);
    if (_db) await _col('investors').doc(id).delete().catch(() => {});
  }

  // ── DISTRIBUTIONS ──────────────────────────────────────────────────────────
  function getDistributions() { return _cache.distributions || []; }
  function getDistributionsForInvestor(investorId) {
    return getDistributions().filter(d =>
      Array.isArray(d.recipients)
        ? d.recipients.some(r => r.investorId === investorId)
        : d.investorId === investorId
    );
  }
  async function saveDistribution(dist) {
    if (!dist.id) dist.id = _id('dist');
    const idx = (_cache.distributions || []).findIndex(d => d.id === dist.id);
    if (idx >= 0) _cache.distributions[idx] = dist;
    else (_cache.distributions = _cache.distributions || []).unshift(dist);
    if (_db) await _col('distributions').doc(dist.id)
      .set({ ...dist, orgId: _orgId, updatedAt: _ts() }, { merge: true })
      .catch(e => console.warn('SPData.saveDistribution:', e.message));
  }
  async function saveDistributions(dists) {
    _cache.distributions = dists;
    if (!_db || !_orgId) return;
    await _batchWrite(dists.map(d => ({ ...d, id: d.id || _id('dist') })),
      item => _col('distributions').doc(item.id))
      .catch(e => console.warn('SPData.saveDistributions:', e.message));
  }

  // ── CAPITAL CALLS ──────────────────────────────────────────────────────────
  function getCapitalCalls() { return _cache.capitalCalls || []; }
  async function saveCapitalCall(call) {
    if (!call.id) call.id = _id('call');
    const idx = (_cache.capitalCalls || []).findIndex(c => c.id === call.id);
    if (idx >= 0) _cache.capitalCalls[idx] = call;
    else (_cache.capitalCalls = _cache.capitalCalls || []).unshift(call);
    if (_db) await _col('capitalCalls').doc(call.id)
      .set({ ...call, orgId: _orgId, updatedAt: _ts() }, { merge: true })
      .catch(e => console.warn('SPData.saveCapitalCall:', e.message));
  }
  async function saveCapitalCalls(calls) {
    _cache.capitalCalls = calls;
    if (!_db || !_orgId) return;
    await _batchWrite(calls.map(c => ({ ...c, id: c.id || _id('call') })),
      item => _col('capitalCalls').doc(item.id))
      .catch(e => console.warn('SPData.saveCapitalCalls:', e.message));
  }

  // ── SETTINGS ───────────────────────────────────────────────────────────────
  function getSettings() { return _cache.settings || {}; }
  async function saveSettings(settings) {
    _cache.settings = settings;
    if (_db) await _col('settings').doc('main')
      .set({ ...settings, orgId: _orgId, updatedAt: _ts() }, { merge: true })
      .catch(e => console.warn('SPData.saveSettings:', e.message));
  }

  // ── ACTIVITY ───────────────────────────────────────────────────────────────
  function logActivity(icon, color, text) {
    const entry = { icon, color, text, time: 'Just now', ts: Date.now(), id: _id('act') };
    _cache.activity = [entry, ...(_cache.activity || [])].slice(0, 50);
    if (_db && _orgId) _col('activity').doc(entry.id)
      .set({ ...entry, orgId: _orgId }).catch(() => {});
  }
  function getActivity() { return _cache.activity || []; }

  // ── Patch SP.* so existing page code works unchanged ───────────────────────
  function _patchSP() {
    if (!window.SP) return;

    // Reads
    SP.getDeals                    = getDeals;
    SP.getDealById                 = getDealById;
    SP.getDealsForInvestor         = getDealsForInvestor;
    SP.getDealsForCurrentInvestor  = () => { const inv = getCurrentInvestorRecord(); return inv ? getDealsForInvestor(inv.id) : []; };
    SP.getInvestors                = getInvestors;
    SP.getInvestorById             = getInvestorById;
    SP.getInvestorByEmail          = getInvestorByEmail;
    SP.getCurrentInvestorRecord    = getCurrentInvestorRecord;
    SP.getDistributions            = getDistributions;
    SP.getDistributionsForInvestor = getDistributionsForInvestor;
    SP.getActivity                 = getActivity;
    SP.getSettings                 = getSettings;

    // Writes
    SP.saveDeals         = saveDeals;
    SP.saveInvestors     = saveInvestors;
    SP.saveDistributions = saveDistributions;
    SP.logActivity       = logActivity;
    SP.saveSettings      = saveSettings;

    // SP.load — intercept data keys
    const _origLoad = SP.load.bind(SP);
    SP.load = function(key, def) {
      if (key === 'deals')          return getDeals();
      if (key === 'investors')      return getInvestors();
      if (key === 'distributions')  return getDistributions();
      if (key === 'capitalCalls')   return getCapitalCalls();
      if (key === 'settings')       return getSettings();
      if (key === 'activity')       return getActivity();
      return _origLoad(key, def);
    };

    // SP.save — intercept data keys
    const _origSave = SP.save.bind(SP);
    SP.save = function(key, value) {
      if (key === 'deals')          { saveDeals(Array.isArray(value) ? value : [value]); return; }
      if (key === 'capitalCalls')   { saveCapitalCalls(Array.isArray(value) ? value : [value]); return; }
      if (key === 'distributions')  { saveDistributions(Array.isArray(value) ? value : [value]); return; }
      if (key === 'settings')       { saveSettings(value); return; }
      _origSave(key, value);
    };

    console.log('SPData: SP.* patched — Firestore is the single source of truth');
  }

  return {
    init, onReady, isReady, getOrgId,
    getDeals, getDealById, getDealsForInvestor, saveDeal, saveDeals, deleteDeal,
    getInvestors, getInvestorById, getInvestorByEmail, getCurrentInvestorRecord, saveInvestors, deleteInvestor,
    getDistributions, getDistributionsForInvestor, saveDistribution, saveDistributions,
    getCapitalCalls, saveCapitalCall, saveCapitalCalls,
    getSettings, saveSettings,
    logActivity, getActivity,
  };
})();
