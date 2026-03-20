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
    if (!items || !items.length) return;
    const CHUNK = 400;
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK);
      if (!chunk.length) continue;
      const batch = _db.batch();
      chunk.forEach(item => {
        batch.set(refFn(item), { ...item, orgId: _orgId, updatedAt: _ts() }, { merge: true });
      });
      await batch.commit();
    }
  }

  // Load investors with decryption of sensitive fields
  async function _loadInvestors() {
    try {
      const snap = await _col('investors').get();
      let investors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (investors.length > 0) {
        // Decrypt sensitive fields for in-memory use
        if (typeof SPCrypto !== 'undefined' && SPCrypto.isReady()) {
          investors = await SPCrypto.decryptInvestors(investors);
        }
        _cache.investors = investors;
        // Sync decrypted values to localStorage cache for SP.getInvestors fallback
        if (typeof SP !== 'undefined') SP.saveInvestors(investors);
      } else {
        // Firestore empty — fall back to localStorage
        const lsData = (typeof SP !== 'undefined') ? SP.getInvestors() : [];
        _cache.investors = lsData && lsData.length ? lsData : [];
        if (_cache.investors.length) {
          console.log('SPData: investors — Firestore empty, seeding from localStorage');
          await _saveInvestorsToFirestore(_cache.investors);
        }
      }
    } catch(e) {
      console.warn('SPData: load investors failed:', e.message);
      _cache.investors = (typeof SP !== 'undefined') ? SP.getInvestors() : [];
    }
  }

  // Save investors to Firestore with encryption
  async function _saveInvestorsToFirestore(investors) {
    if (!_db || !_orgId) return;
    let toSave = investors;
    if (typeof SPCrypto !== 'undefined' && SPCrypto.isReady()) {
      toSave = await SPCrypto.encryptInvestors(investors);
    }
    await _batchWrite(toSave, item => _col('investors').doc(item.id || _id('inv')))
      .catch(e => console.warn('SPData._saveInvestorsToFirestore:', e.message));
  }

  // Load a collection into cache, with fallback to localStorage
  async function _load(name) {
    try {
      const snap = await _col(name).get();
      const firestoreDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (firestoreDocs.length > 0) {
        // Firestore has data — use it and sync back to localStorage
        _cache[name] = firestoreDocs;
        if (typeof SP !== 'undefined') {
          if (name === 'deals')         SP.saveDeals(firestoreDocs);
          if (name === 'investors')     SP.saveInvestors(firestoreDocs);
          if (name === 'distributions') SP.saveDistributions(firestoreDocs);
        }
      } else {
        // Firestore empty — fall back to localStorage (demo data / offline)
        const lsData = (typeof SP !== 'undefined') ? (
          name === 'deals'         ? SP.getDeals() :
          name === 'investors'     ? SP.getInvestors() :
          name === 'distributions' ? SP.getDistributions() :
          name === 'capitalCalls'  ? SP.load('capitalCalls', []) :
          []
        ) : [];
        _cache[name] = lsData && lsData.length ? lsData : [];
        if (_cache[name].length) {
          console.log(`SPData: ${name} — Firestore empty, seeding ${_cache[name].length} items to Firestore from localStorage`);
          // Push localStorage data TO Firestore so it becomes the single source of truth
          _batchWrite(_cache[name], item => _col(name).doc(item.id)).catch(e =>
            console.warn(`SPData: seed ${name} to Firestore failed:`, e.message)
          );
        }
      }
    } catch(e) {
      console.warn(`SPData: load ${name} failed:`, e.message);
      // On error, fall back to localStorage
      _cache[name] = (typeof SP !== 'undefined') ? (
        name === 'deals'         ? SP.getDeals() :
        name === 'investors'     ? SP.getInvestors() :
        name === 'distributions' ? SP.getDistributions() :
        []
      ) : [];
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  let _initialized = false;
  async function init(db, orgId, role, email) {
    if (_initialized) return; // prevent double-init
    _initialized = true;
    _db    = db;
    _orgId = orgId;
    _role  = role  || 'General Partner';
    _email = email || '';

    // Initialize field-level encryption for sensitive data
    if (typeof SPCrypto !== 'undefined') {
      await SPCrypto.init(db, orgId).catch(e =>
        console.warn('SPData: SPCrypto init failed (sensitive fields unencrypted):', e.message)
      );
    }

    // Load all collections in parallel
    // For Investor role, only load their own investor record (security rule compliance)
    const investorLoad = (_role === 'Investor' && _email)
      ? _col('investors').where('email', '==', _email).get().then(async snap => {
          let investors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          // Decrypt sensitive fields for display
          if (typeof SPCrypto !== 'undefined' && SPCrypto.isReady()) {
            investors = await SPCrypto.decryptInvestors(investors);
          }
          _cache.investors = investors;
        }).catch(e => { console.warn('SPData: load investors (investor role) failed:', e.message); _cache.investors = []; })
      : _loadInvestors();

    await Promise.all([
      _load('deals'),
      investorLoad,
      _load('distributions'),
      _load('capitalCalls'),
      _load('activity'),
    ]);
    // Sort activity by ts desc after load
    if (_cache.activity) _cache.activity.sort((a, b) => (b.ts || 0) - (a.ts || 0));

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

    // Pre-hydrate custom_data keys that pages need immediately (dealroom_docs_*, k1_vault, etc.)
    // This prevents Pulse and other pages from seeing empty data on first render
    try {
      const customSnap = await _col('custom_data').get();
      customSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data && data.key && data.value !== undefined) {
          _customCache[data.key] = data.value;
          _customLoaded.add(data.key);
          // Also sync to localStorage cache
          try { _origSave(data.key, data.value); } catch(e) {}
        }
      });
      if (customSnap.size) console.log(`SPData: pre-hydrated ${customSnap.size} custom_data docs`);
    } catch(e) {
      console.warn('SPData: custom_data pre-hydrate failed:', e.message);
    }

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
    const action = idx >= 0 ? 'update' : 'create';
    if (idx >= 0) _cache.deals[idx] = deal; else (_cache.deals = _cache.deals || []).unshift(deal);
    if (_db) await _col('deals').doc(deal.id)
      .set({ ...deal, orgId: _orgId, updatedAt: _ts() }, { merge: true })
      .catch(e => console.warn('SPData.saveDeal:', e.message));
    
    if(typeof SPAudit !== 'undefined') SPAudit.log(action, 'deal', deal.id, deal.name, {});
    return deal;
  }
  async function saveDeals(deals) {
    _cache.deals = deals;
    if (!_db || !_orgId) return;
    await _batchWrite(deals, item => _col('deals').doc(item.id || _id('deal')))
      .catch(e => console.warn('SPData.saveDeals:', e.message));
  }
  async function deleteDeal(id) {
    const deal = getDealById(id);
    _cache.deals = (_cache.deals || []).filter(d => d.id !== id);
    if (_db) await _col('deals').doc(id).delete().catch(() => {});
    if(typeof SPAudit !== 'undefined') SPAudit.log('delete', 'deal', id, deal?.name || 'Unknown', {});
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
    _cache.investors = investors; // Cache stores decrypted values for UI
    if (!_db || !_orgId) return;
    // Encrypt sensitive fields before writing to Firestore
    let toSave = investors;
    if (typeof SPCrypto !== 'undefined' && SPCrypto.isReady()) {
      toSave = await SPCrypto.encryptInvestors(investors);
    }
    await _batchWrite(toSave, item => _col('investors').doc(item.id || _id('inv')))
      .catch(e => console.warn('SPData.saveInvestors:', e.message));
    if(typeof SPAudit !== 'undefined') SPAudit.log('update', 'investor_group', 'multiple', 'Bulk Investor Sync', { count: investors.length });
  }
  async function deleteInvestor(id) {
    const inv = getInvestorById(id);
    _cache.investors = (_cache.investors || []).filter(i => i.id !== id);
    if (_db) await _col('investors').doc(id).delete().catch(() => {});
    if(typeof SPAudit !== 'undefined') SPAudit.log('delete', 'investor', id, `${inv?.firstName} ${inv?.lastName}`, {});
  }

  // ── DISTRIBUTIONS ──────────────────────────────────────────────────────────
  function getDistributions() { 
    const dists = _cache.distributions || []; 
    // v2.0 Schema Normalization: Ensure all dists have totalAmount
    return dists.map(d => ({
      ...d,
      totalAmount: d.totalAmount || d.amount || 0
    }));
  }
  function getDistributionsForInvestor(investorId) {
    return getDistributions().filter(d =>
      Array.isArray(d.recipients)
        ? d.recipients.some(r => r.investorId === investorId)
        : d.investorId === investorId
    );
  }
  async function saveDistribution(dist) {
    if (!dist.id) dist.id = _id('dist');
    // Update cache
    if (!_cache.distributions) _cache.distributions = [];
    const idx = _cache.distributions.findIndex(d => d.id === dist.id);
    if (idx >= 0) _cache.distributions[idx] = dist;
    else _cache.distributions.unshift(dist);
    // Always persist to localStorage immediately as fallback
    try {
      const _lsKey = (SP.makeOrgKey ? SP.makeOrgKey('distributions') : (_orgId + '_distributions'));
      localStorage.setItem(_lsKey, JSON.stringify(_cache.distributions));
    } catch(e) {}
    // Write to Firestore
    if (_db && _orgId) {
      try {
        await _col('distributions').doc(dist.id)
          .set({ ...dist, orgId: _orgId, updatedAt: _ts() }, { merge: true });
      } catch(e) {
        console.warn('SPData.saveDistribution Firestore failed (localStorage backup saved):', e.message);
        // Don't re-throw — localStorage has the data
      }
    }
    return dist.id;
  }

  async function saveDistributions(dists) {
    _cache.distributions = dists;
    // Always persist to localStorage immediately
    try {
      const _lsKey = (SP.makeOrgKey ? SP.makeOrgKey('distributions') : (_orgId + '_distributions'));
      localStorage.setItem(_lsKey, JSON.stringify(dists));
    } catch(e) {}
    if (!_db || !_orgId) return;
    await _batchWrite(dists.map(d => ({ ...d, id: d.id || _id('dist') })),
      item => { if (!item.id) item.id = _id('dist'); return _col('distributions').doc(item.id); })
      .catch(e => console.warn('SPData.saveDistributions Firestore batch failed (localStorage backup saved):', e.message));
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
      item => { if (!item.id) item.id = _id('call'); return _col('capitalCalls').doc(item.id); })
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
    SP.saveDistribution  = saveDistribution;   // Single-dist write (preferred path)
    SP.logActivity       = logActivity;
    SP.saveSettings      = saveSettings;

    // Compound operations — must use SPData's versions so writes go to Firestore
    // Single deal save (efficient — only writes the changed deal)
    SP.saveDeal = saveDeal;

    // Delete operations — remove from cache AND Firestore
    SP.deleteDeal = async function(id) { await deleteDeal(id); };
    SP.deleteInvestor = async function(id) { await deleteInvestor(id); };

    SP.addInvestorToDeal = function(dealId, entry) {
      const deal = getDealById(dealId);
      if (!deal) return false;
      if (!Array.isArray(deal.investors)) deal.investors = [];
      const idx = deal.investors.findIndex(i => i.investorId === entry.investorId);
      if (idx >= 0) deal.investors[idx] = { ...deal.investors[idx], ...entry };
      else deal.investors.push(entry);
      saveDeal(deal);
      return true;
    };
    SP.removeInvestorFromDeal = function(dealId, investorId) {
      const deal = getDealById(dealId);
      if (!deal) return false;
      deal.investors = (deal.investors || []).filter(i => i.investorId !== investorId);
      saveDeal(deal);
      return true;
    };

    // ── Firestore-backed custom data (k1_vault, dealroom_docs_*, etc.) ────────
    // Every SP.load/SP.save key goes through Firestore. localStorage is ONLY a cache.
    const _customCache = {};
    const _customLoaded = new Set();
    const _origLoad = SP.load.bind(SP);
    const _origSave = SP.save.bind(SP);

    // Synchronous read from cache/localStorage; async Firestore hydration happens on init
    function _customGet(key, def) {
      if (key in _customCache) return _customCache[key];
      // Fall back to localStorage cache (will be overwritten by Firestore on hydration)
      const lsVal = _origLoad(key, def);
      _customCache[key] = lsVal;
      // Trigger async Firestore load if not already loaded
      if (!_customLoaded.has(key) && _db && _orgId) {
        _customLoaded.add(key);
        _col('custom_data').doc(_sanitizeKey(key)).get().then(doc => {
          if (doc.exists && doc.data().value !== undefined) {
            _customCache[key] = doc.data().value;
            // Sync Firestore → localStorage cache
            try { _origSave(key, doc.data().value); } catch(e) {}
          } else if (lsVal !== undefined && lsVal !== null && (Array.isArray(lsVal) ? lsVal.length : Object.keys(lsVal).length)) {
            // localStorage has data Firestore doesn't — seed Firestore
            _col('custom_data').doc(_sanitizeKey(key))
              .set({ value: lsVal, key, orgId: _orgId, updatedAt: _ts() })
              .catch(() => {});
          }
        }).catch(() => {});
      }
      return lsVal;
    }

    function _customSet(key, value) {
      _customCache[key] = value;
      // Write to Firestore (primary)
      if (_db && _orgId) {
        _col('custom_data').doc(_sanitizeKey(key))
          .set({ value, key, orgId: _orgId, updatedAt: _ts() }, { merge: true })
          .catch(e => console.warn('SPData: custom save to Firestore failed for', key, e.message));
      }
      // Write to localStorage (cache only)
      try { _origSave(key, value); } catch(e) {}
    }

    // Firestore doc IDs can't contain / so sanitize keys like 'dealroom_docs_deal123'
    function _sanitizeKey(key) { return key.replace(/[\/\.]/g, '_'); }

    // SP.load — Firestore-first for ALL keys
    SP.load = function(key, def) {
      if (key === 'deals')          return getDeals();
      if (key === 'investors')      return getInvestors();
      if (key === 'distributions')  return getDistributions();
      if (key === 'capitalCalls')   return getCapitalCalls();
      if (key === 'settings')       return getSettings();
      if (key === 'activity')       return getActivity();
      return _customGet(key, def);
    };

    // SP.save — Firestore-first for ALL keys
    SP.save = function(key, value) {
      if (key === 'deals')          { saveDeals(Array.isArray(value) ? value : [value]); return; }
      if (key === 'capitalCalls')   { saveCapitalCalls(Array.isArray(value) ? value : [value]); return; }
      if (key === 'distributions')  { saveDistributions(Array.isArray(value) ? value : [value]); return; }
      if (key === 'settings')       { saveSettings(value); return; }
      _customSet(key, value);
    };

    console.log('SPData: SP.* patched — ALL data routes through Firestore. localStorage is cache only.');
  }

  // ── Reinit: reset and reload for a new user/role context ─────────────────
  // Called by sp-firebase.js when onAuthStateChanged fires with a new user
  async function reinit(db, orgId, role, email) {
    // If same user and already ready, skip
    if (_initialized && _ready && _orgId === orgId && _role === role && _email === email) {
      console.log('SPData reinit — same context, skipping');
      return;
    }
    // Reset state
    _initialized = false;
    _ready = false;
    _cache.deals = null;
    _cache.investors = null;
    _cache.distributions = null;
    _cache.capitalCalls = null;
    _cache.settings = null;
    _cache.activity = [];
    // Re-run init with new context
    return init(db, orgId, role, email);
  }

  return {
    _cache, init, reinit, onReady, isReady, getOrgId,
    getDeals, getDealById, getDealsForInvestor, saveDeal, saveDeals, deleteDeal,
    getInvestors, getInvestorById, getInvestorByEmail, getCurrentInvestorRecord, saveInvestors, deleteInvestor,
    getDistributions, getDistributionsForInvestor, saveDistribution, saveDistributions,
    getCapitalCalls, saveCapitalCall, saveCapitalCalls,
    getSettings, saveSettings,
    logActivity, getActivity,
  };
})();
