/**
 * sp-firebase.js — deeltrack Cloud Backend
 *
 * Wraps Firebase Firestore + Storage.
 * Exposes the same interface as SP.* so sp-core.js stays unchanged.
 *
 * Data model:
 *   orgs/{orgId}/                 ← one per GP firm
 *     deals/{dealId}
 *     investors/{investorId}
 *     distributions/{distId}
 *     capitalCalls/{callId}
 *     activity/{actId}
 *     settings                    ← single doc
 *     documents/{docId}           ← document metadata
 *
 *   users/{uid}                   ← Firebase Auth UID
 *     email, name, role, orgId
 *
 * Storage:
 *   documents/{orgId}/{dealId}/{filename}
 *   avatars/{orgId}/{userId}
 *
 * Security: Firestore rules restrict reads/writes to the user's orgId.
 */

const SPFB = (function () {
  'use strict';

  // ── Internal state ──────────────────────────────────────────────────────────
  let _db = null;
  let _storage = null;
  let _auth = null;
  let _orgId = null;
  let _user = null;         // Firebase Auth user
  let _spUser = null;       // { email, name, role, orgId }
  let _ready = false;
  let _readyCallbacks = [];
  let _offlineMode = false;

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    if (_ready || _db) return; // Already initialized — prevent double-init
    if (typeof firebase === 'undefined') {
      console.warn('SPFB: Firebase SDK not loaded — offline mode');
      _offlineMode = true;
      return;
    }
    try {
      _db = firebase.firestore();
      // Configure Firestore with cache settings (replaces deprecated enablePersistence)
      try {
        const cacheSize = firebase.firestore.CACHE_SIZE_UNLIMITED || 104857600; // 100MB fallback
        _db.settings({ cacheSizeBytes: cacheSize, merge: true });
      } catch(settingsErr) {
        // Settings already applied or not supported — safe to ignore
      }
      _storage = (typeof firebase.storage === 'function') ? firebase.storage() : null;
      _auth    = firebase.auth();
      _auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

      // Note: enablePersistence removed - using FirestoreSettings.cache instead

      // Watch auth state
      _auth.onAuthStateChanged(fbUser => {
        if (fbUser) {
          _user = fbUser;
          _initUserProfile(fbUser);
        } else {
          // No Firebase session yet — try auto sign-in from localStorage session
          _tryAutoSignIn();
        }
      });
    } catch (e) {
      console.error('SPFB init error:', e);
      _offlineMode = true;
    }
  }

  // Build user profile from Firebase Auth user
  function _initUserProfile(fbUser) {
    // Pull the current localStorage session to get name/role/email
    const localSession = (typeof SP !== 'undefined') ? SP.getSession() : null;
    const localEmail   = localSession?.email || fbUser.email || '';
    const localName    = localSession?.name  || fbUser.displayName || localEmail;
    const localRole    = localSession?.role  || 'General Partner';

    // OrgId: demo emails share deeltrack_demo org; Marcus gets unique org; everyone else gets hash
    const emailLower = localEmail.toLowerCase();
    const DEMO_ORG_EMAILS = ['gp@deeltrack.com','demo@deeltrack.com','philip@jchapmancpa.com','investor@deeltrack.com'];
    const isMarcus = emailLower === 'demo-gp2@deeltrack.com';
    const isDemo = DEMO_ORG_EMAILS.includes(emailLower);
    const derivedOrgId = isMarcus ? 'marcus_rivera_org' : isDemo ? 'deeltrack_demo' : (localEmail ? _hashEmail(localEmail) : fbUser.uid);

    _db.collection('users').doc(fbUser.uid).get().then(doc => {
      if (doc.exists) {
        _spUser = doc.data();
        // If user upgraded from anonymous to real account, update email/name
        if (fbUser.email && (!_spUser.email || _spUser.isAnonymous)) {
          const update = { email: fbUser.email, name: fbUser.displayName || _spUser.name, isAnonymous: false };
          _db.collection('users').doc(fbUser.uid).update(update);
          _spUser = { ..._spUser, ...update };
        }
        _orgId = _spUser.orgId;
      } else {
        // New user (anonymous or first real signup) — create profile
        // Use derivedOrgId which handles Marcus's unique orgId
        _spUser = {
          uid:         fbUser.uid,
          email:       localEmail,
          name:        localName,
          role:        localRole,
          orgId:       derivedOrgId,
          isAnonymous: fbUser.isAnonymous,
          createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
        };
        _orgId = _spUser.orgId;
        _db.collection('users').doc(fbUser.uid).set(_spUser);
      }
      _markReady();
    }).catch(err => {
      // Firestore read failed (rules not deployed yet?) — still go ready with local data
      console.warn('SPFB: could not read user profile, using local session:', err.message);
      _spUser = { uid: fbUser.uid, email: localEmail, name: localName, role: localRole, orgId: derivedOrgId };
      _orgId  = derivedOrgId;
      _markReady();
    });
  }

  function _tryAutoSignIn() {
    const s = (typeof SP !== 'undefined') ? SP.getSession() : null;
    if (!s || !s.email || !s.password) return; // No password stored — don't waste a 400 request
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().signInWithEmailAndPassword(s.email, s.password).then(() => {
        // onAuthStateChanged will fire again with the user
      }).catch(() => {
        // Failed — stay anonymous and let manual login proceed
      });
    }
  }

  // Simple hash for non-demo org IDs
  function _hashEmail(email) {
    let h = 0;
    for (let i = 0; i < email.length; i++) {
      h = (h << 5) - h + email.charCodeAt(i);
      h = h & h; // Convert to 32bit
    }
    return 'org_' + Math.abs(h).toString(36);
  }

  // ── Ready callback system ───────────────────────────────────────────────────
  function _markReady() {
    _ready = true;

    // Sync the session with Firebase user info if needed
    if (_spUser && typeof SP !== 'undefined') {
      const existing = SP.getSession();
      const emailLc = (_spUser.email || '').toLowerCase();

      // Auto-fix: ensure demo users have the right orgId
      const DEMO_ORG_EMAILS = ['gp@deeltrack.com','demo@deeltrack.com','philip@jchapmancpa.com','investor@deeltrack.com'];
      const shouldBeDemo = DEMO_ORG_EMAILS.includes(emailLc);
      const resolvedOrg = shouldBeDemo ? 'deeltrack_demo'
        : (existing?.orgId || _spUser.orgId || _orgId);

      if (_spUser && _spUser.email) {
        // If Firestore doc has wrong orgId for demo user, fix it
        if (DEMO_ORG_EMAILS.includes(emailLc) && _spUser.orgId !== 'deeltrack_demo' && _spUser.uid && _db) {
          _db.collection('users').doc(_spUser.uid).update({ orgId: 'deeltrack_demo' }).catch(() => {});
          _spUser.orgId = 'deeltrack_demo';
        }
        _orgId = resolvedOrg;
        SP.setSession({
          email:     _spUser.email,
          name:      _spUser.name || _spUser.displayName || _spUser.email,
          role:      _spUser.role || 'General Partner',
          orgId:     resolvedOrg,
          loggedIn:  true,
          loginTime: Date.now(),
          uid:       _spUser.uid,
          isAnonymous: _spUser.isAnonymous,
        });

        // Initialize SPCrypto with Firebase app and orgId
        if (typeof SPCrypto !== 'undefined' && SPCrypto.init) {
          SPCrypto.init(firebase, _orgId);
        }
      }
    }

    // Always trigger SPData (re)init when user auth resolves.
    // reinit() safely skips if same context, or resets + re-loads for a new user.
    if (typeof SPData !== 'undefined' && _db && _orgId) {
      const _initFn = typeof SPData.reinit === 'function' ? SPData.reinit : SPData.init;
      _initFn(_db, _orgId, _spUser?.role || 'General Partner', _spUser?.email || '').then(() => {
        _readyCallbacks.forEach(cb => { try { cb(); } catch(e) {} });
        _readyCallbacks = [];
        window.dispatchEvent(new CustomEvent('spdata-ready'));
      }).catch(err => {
        console.error('SPData init/reinit failed:', err);
        _readyCallbacks.forEach(cb => { try { cb(); } catch(e) {} });
        _readyCallbacks = [];
        window.dispatchEvent(new CustomEvent('spdata-ready'));
      });
    } else {
      // SPData not loaded — patch SP.* to Firestore writes, then do a one-time
      // Firestore fetch so pages without sp-data.js still get real data.
      if (typeof window !== 'undefined' && typeof patchSPCore === 'function') {
        patchSPCore(); // synchronous — patches SP.getDeals etc
      }
      // Fetch deals/investors/distributions from Firestore → localStorage
      // THEN fire callbacks so SP.getDeals() returns real data.
      if (_db && _orgId) {
        Promise.all([
          getDeals().then(deals => {
            if (deals && deals.length) {
              try { localStorage.setItem(SP.makeOrgKey('deals'), JSON.stringify(deals)); } catch(e) {}
            }
          }).catch(() => {}),
          getInvestors().then(inv => {
            if (inv && inv.length) {
              try { localStorage.setItem(SP.makeOrgKey('investors'), JSON.stringify(inv)); } catch(e) {}
            }
          }).catch(() => {}),
          getDistributions().then(dists => {
            if (dists && dists.length) {
              try { localStorage.setItem(SP.makeOrgKey('distributions'), JSON.stringify(dists)); } catch(e) {}
            }
          }).catch(() => {}),
        ]).finally(() => {
          _readyCallbacks.forEach(cb => { try { cb(); } catch(e) {} });
          _readyCallbacks = [];
          window.dispatchEvent(new CustomEvent('spdata-ready'));
        });
      } else {
        _readyCallbacks.forEach(cb => { try { cb(); } catch(e) {} });
        _readyCallbacks = [];
        window.dispatchEvent(new CustomEvent('spdata-ready'));
      }
    }
  }

  function onReady(cb) {
    if (_ready || (typeof SPData !== 'undefined' && SPData.isReady && SPData.isReady())) {
      try { cb(); } catch(e) {}
    } else {
      _readyCallbacks.push(cb);
    }
  }

  function isReady() { return _ready; }
  function getOrgId() { return _orgId; }
  function getUser() { return _spUser; }

  // ── Firestore references ────────────────────────────────────────────────────
  function _orgRef() {
    if (!_db || !_orgId) throw new Error('SPFB not ready');
    return _db.collection('orgs').doc(_orgId);
  }
  function _col(name) { return _orgRef().collection(name); }
  function _ts()      { return firebase.firestore.FieldValue.serverTimestamp(); }

  // ── Deals ───────────────────────────────────────────────────────────────────
  async function getDeals() {
    if (_offlineMode || !_ready) return SP.getDeals();
    try {
      const snap = await _col('deals').orderBy('added', 'desc').get();
      let deals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Investors only see deals they are linked to — FIXED: match by email if investorId missing
      if (_spUser && _spUser.role === 'Investor') {
        // Get the investor record to find the investorId
        const invQuery = await _col('investors').where('email', '==', _spUser.email).limit(1).get();
        let investorId = null;
        if (!invQuery.empty) {
          investorId = invQuery.docs[0].id;
        }
        deals = deals.filter(d =>
          Array.isArray(d.investors) && d.investors.some(i =>
            i.investorId === investorId ||
            i.investorId === _spUser.investorId ||
            i.investorId === _spUser.firestoreInvestorId ||
            // Fallback: match by email directly in deal investor entry
            (i.email && i.email.toLowerCase() === _spUser.email?.toLowerCase())
          )
        );
      }
      SP.saveDeals(deals);
      return deals;
    } catch (e) {
      console.warn('SPFB getDeals — using cache:', e.message);
      return SP.getDeals();
    }
  }

  async function saveDeal(deal) {
    if (_offlineMode || !_ready) { SP.saveDeal(deal); return deal; }
    try {
      const data = {
        ...deal,
        orgId: _orgId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      await _col('deals').doc(deal.id).set(data, { merge: true });
      return deal;
    } catch(e) {
      console.warn('SPFB saveDeal — falling back to localStorage:', e.message);
      SP.saveDeal(deal);
      return deal;
    }
  }

  async function saveDeals(deals) {
    if (_offlineMode || !_ready) { SP.saveDeals(deals); return; }
    await Promise.all(deals.map(d => saveDeal(d)));
  }

  async function deleteDeal(id) {
    if (_offlineMode || !_ready) { SP.deleteDeal(id); return; }
    try {
      await _col('deals').doc(id).delete();
    } catch(e) {
      console.warn('SPFB deleteDeal — falling back to localStorage:', e.message);
      SP.deleteDeal(id);
    }
  }

  // ── Investors ───────────────────────────────────────────────────────────────
  async function getInvestors() {
    if (_offlineMode || !_ready) return SP.getInvestors();
    try {
      let snap;
      // Investors can only read their own record (Firestore rules enforce this)
      if (_spUser && _spUser.role === 'Investor' && _spUser.email) {
        snap = await _col('investors').where('email', '==', _spUser.email).get();
      } else {
        snap = await _col('investors').orderBy('lastName').get();
      }
      const investors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      SP.saveInvestors(investors);
      return investors;
    } catch (e) {
      console.warn('SPFB getInvestors — using cache:', e.message);
      return SP.getInvestors();
    }
  }

  async function saveInvestors(investors) {
    if (_offlineMode || !_ready) { SP.saveInvestors(investors); return; }
    try {
      const batch = _db.batch();
      for (const inv of investors) {
        const ref = _col('investors').doc(inv.id);
        batch.set(ref, { ...inv, orgId: _orgId, updatedAt: _ts() }, { merge: true });
      }
      await batch.commit();
    } catch(e) {
      console.warn('SPFB saveInvestors — falling back to localStorage:', e.message);
      SP.saveInvestors(investors);
    }
  }

  async function deleteInvestor(id) {
    if (_offlineMode || !_ready) { SP.deleteInvestor(id); return; }
    try {
      await _col('investors').doc(id).delete();
    } catch(e) {
      console.warn('SPFB deleteInvestor — falling back to localStorage:', e.message);
      SP.deleteInvestor(id);
    }
  }

  // ── Distributions ───────────────────────────────────────────────────────────
  async function getDistributions() {
    if (_offlineMode || !_ready) return SP.getDistributions();
    try {
      const snap = await _col('distributions').orderBy('date', 'desc').get();
      let dists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Investors only see distributions for deals they are linked to
      if (_spUser && _spUser.role === 'Investor') {
        const deals = await getDeals(); // already filtered
        const allowedDealIds = new Set(deals.map(d => d.id));
        dists = dists.filter(d => allowedDealIds.has(d.dealId));
      }
      SP.saveDistributions(dists);
      return dists;
    } catch (e) {
      console.warn('SPFB getDistributions — using cache:', e.message);
      return SP.getDistributions();
    }
  }

  async function saveDistribution(dist) {
    if (_offlineMode || !_ready) { SP.saveDistribution(dist); return dist; }
    try {
      await _col('distributions').doc(dist.id).set({ ...dist, orgId: _orgId, updatedAt: _ts() }, { merge: true });
      return dist;
    } catch(e) {
      console.warn('SPFB saveDistribution — falling back to localStorage:', e.message);
      SP.saveDistribution(dist);
      return dist;
    }
  }

  // ── Capital Calls ───────────────────────────────────────────────────────────
  async function getCapitalCalls() {
    if (_offlineMode || !_ready) return SP.getCapitalCalls ? SP.getCapitalCalls() : [];
    try {
      const snap = await _col('capitalCalls').orderBy('dueDate', 'desc').get();
      let calls = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Investors only see capital calls for deals they are linked to
      if (_spUser && _spUser.role === 'Investor') {
        const deals = await getDeals(); // already filtered
        const allowedDealIds = new Set(deals.map(d => d.id));
        calls = calls.filter(c => allowedDealIds.has(c.dealId));
      }
      return calls;
    } catch (e) {
      console.warn('SPFB getCapitalCalls — using cache:', e.message);
      return SP.getCapitalCalls ? SP.getCapitalCalls() : [];
    }
  }

  async function saveCapitalCall(call) {
    if (_offlineMode || !_ready) { SP.saveCapitalCall(call); return call; }
    try {
      await _col('capitalCalls').doc(call.id).set({ ...call, orgId: _orgId, updatedAt: _ts() }, { merge: true });
      return call;
    } catch(e) {
      console.warn('SPFB saveCapitalCall — falling back to localStorage:', e.message);
      SP.saveCapitalCall(call);
      return call;
    }
  }

  // ── Settings ──────────────────────────────────────────────────────────────────
  async function getSettings() {
    if (_offlineMode || !_ready) return SP.getSettings ? SP.getSettings() : {};
    try {
      const doc = await _col('settings').doc('main').get();
      if (doc.exists) return doc.data();
      return {};
    } catch(e) {
      console.warn('SPFB getSettings — using cache:', e.message);
      return SP.getSettings ? SP.getSettings() : {};
    }
  }

  async function saveSettings(settings) {
    if (_offlineMode || !_ready) { SP.saveSettings(settings); return; }
    try {
      await _col('settings').doc('main').set({ ...settings, orgId: _orgId, updatedAt: _ts() }, { merge: true });
    } catch(e) {
      console.warn('SPFB saveSettings — falling back to localStorage:', e.message);
      SP.saveSettings(settings);
    }
  }

  // ── Document Storage ─────────────────────────────────────────────────────────
  async function uploadDocument(dealId, file, metadata) {
    if (!_storage) throw new Error('Storage not available');
    const path = `documents/${_orgId}/${dealId}/${file.name}`;
    const ref = _storage.ref(path);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    // Save metadata to Firestore
    await _col('documents').add({
      dealId, name: file.name, path, url, ...metadata,
      orgId: _orgId, uploadedAt: _ts(),
    });
    return url;
  }

  // ── Auth helpers ────────────────────────────────────────────────────────────
  async function signUp(email, password, name, role, orgId) {
    const cred = await _auth.createUserWithEmailAndPassword(email, password);
    const profile = {
      uid: cred.user.uid, email, name, role,
      orgId: orgId || _hashEmail(email),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await _db.collection('users').doc(cred.user.uid).set(profile);
    return cred;
  }

  async function ensureUserRecord(uid, email, name, role, orgId) {
    const ref = _db.collection('users').doc(uid);
    const doc = await ref.get();
    if (doc.exists) {
      const data = doc.data();
      // Update missing fields
      const updates = {};
      if (!data.email && email) updates.email = email;
      if (!data.name && name) updates.name = name;
      if (!data.role && role) updates.role = role;
      if (!data.orgId && orgId) updates.orgId = orgId;
      if (Object.keys(updates).length) await ref.update(updates);
      return data;
    } else {
      const profile = {
        uid, email, name, role,
        orgId: orgId || _hashEmail(email),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      const orgRef = _db.collection('orgs').doc(profile.orgId);
      const orgDoc = await orgRef.get();
      if (!orgDoc.exists) {
        await orgRef.set({ orgId: profile.orgId, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      }
      await ref.set(profile);
      return profile;
    }
  }

  async function logIn(email, password) {
    const cred = await _auth.signInWithEmailAndPassword(email, password);
    return cred;
  }

  async function logOut() {
    await _auth.signOut();
    _ready = false;
    _readyCallbacks = [];
    _spUser = null;
    _orgId = null;
    _user = null;
  }

  async function sendPasswordReset(email) {
    await _auth.sendPasswordResetEmail(email);
  }

  async function updatePassword(newPassword) {
    if (!_user) throw new Error('No user logged in');
    await _user.updatePassword(newPassword);
  }

  async function updateProfile(profile) {
    if (!_user) throw new Error('No user logged in');
    await _user.updateProfile(profile);
    // Also update Firestore user doc
    await _db.collection('users').doc(_user.uid).update(profile);
    _spUser = { ..._spUser, ...profile };
  }

  // ── Realtime subscriptions ────────────────────────────────────────────────
  function subscribeToDeals(callback) {
    if (!_db || !_orgId) return () => {};
    return _col('deals').onSnapshot(snap => {
      const deals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      SP.saveDeals(deals);
      callback(deals);
    }, err => {
      console.warn('SPFB subscribeToDeals error:', err.message);
    });
  }

  function subscribeToInvestors(callback) {
    if (!_db || !_orgId) return () => {};
    return _col('investors').onSnapshot(snap => {
      const investors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      SP.saveInvestors(investors);
      callback(investors);
    }, err => {
      console.warn('SPFB subscribeToInvestors error:', err.message);
    });
  }

  function subscribeToDistributions(callback) {
    if (!_db || !_orgId) return () => {};
    return _col('distributions').onSnapshot(snap => {
      const dists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      SP.saveDistributions(dists);
      callback(dists);
    }, err => {
      console.warn('SPFB subscribeToDistributions error:', err.message);
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    init, onReady, isReady, getOrgId, getUser,
    getDeals, saveDeal, saveDeals, deleteDeal,
    getInvestors, saveInvestors, deleteInvestor,
    getDistributions, saveDistribution,
    getCapitalCalls, saveCapitalCall,
    getSettings, saveSettings,
    uploadDocument,
    signUp, logIn, logOut,
    sendPasswordReset, updatePassword, updateProfile,
    ensureUserRecord,
    subscribeToDeals, subscribeToInvestors, subscribeToDistributions,
  };
})();

// Auto-init when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  SPFB.init();
});

// Also try init immediately in case DOM already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  SPFB.init();
}
