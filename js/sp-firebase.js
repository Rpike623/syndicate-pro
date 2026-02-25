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
    if (typeof firebase === 'undefined') {
      console.warn('SPFB: Firebase SDK not loaded — offline mode');
      _offlineMode = true;
      return;
    }
    try {
      _db      = firebase.firestore();
      _storage = firebase.storage();
      _auth    = firebase.auth();

      // Enable offline persistence
      _db.enablePersistence({ synchronizeTabs: true })
        .catch(err => {
          if (err.code === 'failed-precondition') console.warn('SPFB: persistence limited to one tab');
          else if (err.code === 'unimplemented') console.warn('SPFB: persistence not supported');
        });

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

    // OrgId: prefer localStorage org (so existing data maps correctly), else hash email
    const derivedOrgId = localEmail ? _hashEmail(localEmail) : fbUser.uid;

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

  // Try to auto sign-in using the localStorage session credentials
  // Works silently for the demo account and any previously-signed-in user
  async function _tryAutoSignIn() {
    const localSession = (typeof SP !== 'undefined') ? SP.getSession() : null;
    if (!localSession?.email) {
      // No local session at all — nothing to do, stay logged out
      return;
    }

    // Demo accounts have known passwords — sign in automatically
    const DEMO_PASSWORDS = {
      'gp@deeltrack.com':       'Demo1234!',
      'investor@deeltrack.com': 'Demo1234!',
    };
    const email = localSession.email.toLowerCase();
    const demoPassword = DEMO_PASSWORDS[email];

    if (demoPassword) {
      try {
        await _auth.signInWithEmailAndPassword(email, demoPassword);
        // onAuthStateChanged will fire again with the user
        return;
      } catch (e) {
        console.warn('SPFB: auto sign-in failed:', e.message);
      }
    }

    // Non-demo user with a local session but no Firebase token
    // (e.g. signed up before Firebase was integrated)
    // Bootstrap locally so the app works, mark as needing upgrade
    _spUser = {
      ...localSession,
      orgId: _hashEmail(email),
      needsFirebaseUpgrade: true,
    };
    _orgId = _spUser.orgId;
    _offlineMode = true; // no Firebase Auth token — read-only Firestore
    _markReady();
    console.info('SPFB: running in local mode — sign out and back in to enable cloud sync');
  }

  function _markReady() {
    _ready = true;
    // Auto-patch SP.* on every page as soon as Firebase is ready
    if (typeof window !== 'undefined') {
      window.setTimeout(() => patchSPCore(), 0);
    }
    _readyCallbacks.forEach(cb => cb());
    _readyCallbacks = [];
  }

  function onReady(cb) {
    if (_ready) { cb(); return; }
    _readyCallbacks.push(cb);
  }

  function isReady() { return _ready; }
  function isOffline() { return _offlineMode; }
  function getOrgId() { return _orgId; }
  function getUser() { return _spUser; }

  // ── Hash helper (matches sp-core) ────────────────────────────────────────────
  function _hashEmail(email) {
    let h = 0;
    const s = (email || '').toLowerCase();
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36);
  }

  // ── Org collection ref ───────────────────────────────────────────────────────
  function _orgRef() {
    if (!_db || !_orgId) throw new Error('SPFB not ready');
    return _db.collection('orgs').doc(_orgId);
  }

  function _col(name) { return _orgRef().collection(name); }

  // ── Auth ─────────────────────────────────────────────────────────────────────

  async function signIn(email, password) {
    if (_offlineMode) return _offlineSignIn(email, password);
    try {
      const cred = await _auth.signInWithEmailAndPassword(email, password);
      return cred.user;
    } catch (e) {
      // Fall through to localStorage auth if Firebase fails
      console.warn('SPFB signIn error, trying local:', e.message);
      return _offlineSignIn(email, password);
    }
  }

  async function signUp(email, password, name, role, orgId) {
    if (_offlineMode) return null;
    try {
      const cred = await _auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });
      const profile = {
        uid: cred.user.uid,
        email,
        name,
        role: role || 'General Partner',
        orgId: orgId || _hashEmail(email),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      await _db.collection('users').doc(cred.user.uid).set(profile);
      return cred.user;
    } catch (e) {
      console.error('SPFB signUp error:', e);
      return null;
    }
  }

  async function signOut() {
    if (_offlineMode) { SP.logout(); return; }
    await _auth.signOut();
    SP.clearSession();
    window.location.href = 'login.html';
  }

  // Offline fallback — uses SP localStorage auth
  function _offlineSignIn(email, password) {
    return SP.authenticate(email, password);
  }

  // ── Deals ────────────────────────────────────────────────────────────────────

  async function getDeals() {
    if (_offlineMode || !_ready) return SP.getDeals();
    try {
      const snap = await _col('deals').orderBy('added', 'desc').get();
      const deals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sync to localStorage cache
      SP.saveDeals(deals);
      return deals;
    } catch (e) {
      console.warn('SPFB getDeals — using cache:', e.message);
      return SP.getDeals();
    }
  }

  async function saveDeal(deal) {
    if (_offlineMode || !_ready) { _localSaveDeal(deal); return deal; }
    try {
      const data = {
        ...deal,
        orgId: _orgId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (!deal.added) data.added = new Date().toISOString().split('T')[0];

      await _col('deals').doc(deal.id).set(data, { merge: true });

      // Update local cache
      _localSaveDeal(deal);
      return deal;
    } catch (e) {
      console.warn('SPFB saveDeal — using cache:', e.message);
      _localSaveDeal(deal);
      return deal;
    }
  }

  async function saveDeals(deals) {
    if (_offlineMode || !_ready) { SP.saveDeals(deals); return; }
    // Batch write for efficiency
    const batch = _db.batch();
    deals.forEach(deal => {
      const ref = _col('deals').doc(deal.id);
      batch.set(ref, {
        ...deal,
        orgId: _orgId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    try {
      await batch.commit();
      SP.saveDeals(deals);
    } catch (e) {
      console.warn('SPFB saveDeals batch — using cache:', e.message);
      SP.saveDeals(deals);
    }
  }

  async function deleteDeal(dealId) {
    if (_offlineMode || !_ready) return;
    try {
      await _col('deals').doc(dealId).delete();
      const deals = SP.getDeals().filter(d => d.id !== dealId);
      SP.saveDeals(deals);
    } catch (e) {
      console.warn('SPFB deleteDeal:', e.message);
    }
  }

  function _localSaveDeal(deal) {
    const deals = SP.getDeals();
    const idx = deals.findIndex(d => d.id === deal.id);
    if (idx >= 0) deals[idx] = { ...deals[idx], ...deal };
    else deals.unshift(deal);
    SP.saveDeals(deals);
  }

  // ── Investors ────────────────────────────────────────────────────────────────

  async function getInvestors() {
    if (_offlineMode || !_ready) return SP.getInvestors();
    try {
      const snap = await _col('investors').orderBy('lastName').get();
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
    const batch = _db.batch();
    investors.forEach(inv => {
      const ref = _col('investors').doc(inv.id);
      batch.set(ref, {
        ...inv,
        orgId: _orgId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    try {
      await batch.commit();
      SP.saveInvestors(investors);
    } catch (e) {
      console.warn('SPFB saveInvestors — using cache:', e.message);
      SP.saveInvestors(investors);
    }
  }

  async function deleteInvestor(invId) {
    if (_offlineMode || !_ready) return;
    try {
      await _col('investors').doc(invId).delete();
    } catch (e) {
      console.warn('SPFB deleteInvestor:', e.message);
    }
  }

  // ── Documents ────────────────────────────────────────────────────────────────

  /**
   * Save a generated document (OA, PPM, Sub Doc) to Firestore.
   * The HTML content is stored in Firestore (up to 1MB per doc).
   * For larger files, use uploadFile() instead.
   */
  async function saveGeneratedDoc(dealId, type, name, htmlContent, accessLevel = 'gp') {
    if (_offlineMode || !_ready) return null;
    try {
      const docRef = await _col('documents').add({
        dealId,
        orgId: _orgId,
        type,          // 'oa' | 'ppm' | 'subscription' | 'k1' | 'capital-call'
        name,
        htmlContent,   // Full HTML string — stored in Firestore
        fileUrl: null, // No separate file for generated docs
        accessLevel,   // 'gp' | 'all_investors' | investorId
        generatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        isGenerated: true,
      });
      return docRef.id;
    } catch (e) {
      console.warn('SPFB saveGeneratedDoc:', e.message);
      return null;
    }
  }

  /**
   * Upload an actual file (PDF, Word, Excel, image) to Firebase Storage.
   * Saves metadata to Firestore.
   * Returns { docId, fileUrl }
   */
  async function uploadFile(file, dealId, category = 'other', accessLevel = 'gp') {
    if (_offlineMode || !_ready) throw new Error('Firebase not available');
    if (!_storage) throw new Error('Storage not initialized');
    if (file.size > 25 * 1024 * 1024) throw new Error('File too large (max 25MB)');

    const ext = file.name.split('.').pop();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `documents/${_orgId}/${dealId}/${Date.now()}_${safeName}`;
    const storageRef = _storage.ref(path);

    // Upload with progress tracking
    return new Promise((resolve, reject) => {
      const task = storageRef.put(file, {
        contentType: file.type,
        customMetadata: { orgId: _orgId, dealId, uploadedBy: _user?.uid || 'unknown' }
      });

      task.on('state_changed',
        snapshot => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          // Emit progress event for UI to listen to
          window.dispatchEvent(new CustomEvent('spfb-upload-progress', { detail: { pct, name: file.name } }));
        },
        error => reject(error),
        async () => {
          try {
            const fileUrl = await task.snapshot.ref.getDownloadURL();
            const docRef = await _col('documents').add({
              dealId,
              orgId: _orgId,
              type: category,
              name: file.name,
              htmlContent: null,
              fileUrl,
              storagePath: path,
              mimeType: file.type,
              size: file.size,
              accessLevel,
              uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
              isGenerated: false,
            });
            resolve({ docId: docRef.id, fileUrl });
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  }

  /**
   * Get all documents for a deal, filtered by access level.
   * GPs see everything. Investors see only 'all_investors' or their specific docId.
   */
  async function getDealDocuments(dealId, investorId = null) {
    if (_offlineMode || !_ready) return [];
    try {
      let query = _col('documents').where('dealId', '==', dealId);
      const snap = await query.get();
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Filter for investor access
      if (investorId) {
        docs = docs.filter(d =>
          d.accessLevel === 'all_investors' ||
          d.accessLevel === investorId
        );
      }

      return docs.sort((a, b) => {
        const at = a.generatedAt?.toDate?.() || a.uploadedAt?.toDate?.() || 0;
        const bt = b.generatedAt?.toDate?.() || b.uploadedAt?.toDate?.() || 0;
        return bt - at;
      });
    } catch (e) {
      console.warn('SPFB getDealDocuments:', e.message);
      return [];
    }
  }

  async function deleteDocument(docId) {
    if (_offlineMode || !_ready) return;
    try {
      const doc = await _col('documents').doc(docId).get();
      if (doc.exists && doc.data().storagePath) {
        await _storage.ref(doc.data().storagePath).delete().catch(() => {});
      }
      await _col('documents').doc(docId).delete();
    } catch (e) {
      console.warn('SPFB deleteDocument:', e.message);
    }
  }

  async function updateDocumentAccess(docId, accessLevel) {
    if (_offlineMode || !_ready) return;
    try {
      await _col('documents').doc(docId).update({ accessLevel });
    } catch (e) {
      console.warn('SPFB updateDocumentAccess:', e.message);
    }
  }

  // ── Distributions ────────────────────────────────────────────────────────────

  async function getDistributions() {
    if (_offlineMode || !_ready) return SP.getDistributions();
    try {
      const snap = await _col('distributions').orderBy('date', 'desc').get();
      const dists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      SP.saveDistributions(dists);
      return dists;
    } catch (e) {
      console.warn('SPFB getDistributions — using cache:', e.message);
      return SP.getDistributions();
    }
  }

  async function saveDistribution(dist) {
    if (_offlineMode || !_ready) {
      const dists = SP.getDistributions();
      dists.unshift(dist);
      SP.saveDistributions(dists);
      return dist.id;
    }
    try {
      await _col('distributions').doc(dist.id).set({
        ...dist,
        orgId: _orgId,
        savedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      const dists = SP.getDistributions();
      dists.unshift(dist);
      SP.saveDistributions(dists);
      return dist.id;
    } catch (e) {
      console.warn('SPFB saveDistribution — using cache:', e.message);
      const dists = SP.getDistributions();
      dists.unshift(dist);
      SP.saveDistributions(dists);
      return dist.id;
    }
  }

  // ── Capital Calls ────────────────────────────────────────────────────────────

  async function getCapitalCalls() {
    if (_offlineMode || !_ready) return SP.load('capitalCalls', []);
    try {
      const snap = await _col('capitalCalls').orderBy('sentAt', 'desc').get();
      const calls = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      SP.save('capitalCalls', calls);
      return calls;
    } catch (e) {
      console.warn('SPFB getCapitalCalls — using cache:', e.message);
      return SP.load('capitalCalls', []);
    }
  }

  async function saveCapitalCall(call) {
    if (_offlineMode || !_ready) {
      const calls = SP.load('capitalCalls', []);
      calls.unshift(call);
      SP.save('capitalCalls', calls);
      return;
    }
    try {
      await _col('capitalCalls').doc(call.id).set({
        ...call,
        orgId: _orgId,
        savedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      const calls = SP.load('capitalCalls', []);
      const idx = calls.findIndex(c => c.id === call.id);
      if (idx >= 0) calls[idx] = call; else calls.unshift(call);
      SP.save('capitalCalls', calls);
    } catch (e) {
      console.warn('SPFB saveCapitalCall — using cache:', e.message);
    }
  }

  // ── Settings ─────────────────────────────────────────────────────────────────

  async function getSettings() {
    if (_offlineMode || !_ready) return SP.load('settings', {});
    try {
      const doc = await _orgRef().collection('settings').doc('main').get();
      if (doc.exists) {
        const s = doc.data();
        SP.save('settings', s);
        return s;
      }
      return SP.load('settings', {});
    } catch (e) {
      console.warn('SPFB getSettings — using cache:', e.message);
      return SP.load('settings', {});
    }
  }

  async function saveSettings(settings) {
    if (_offlineMode || !_ready) { SP.save('settings', settings); return; }
    try {
      await _orgRef().collection('settings').doc('main').set({
        ...settings,
        orgId: _orgId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      SP.save('settings', settings);
    } catch (e) {
      console.warn('SPFB saveSettings — using cache:', e.message);
      SP.save('settings', settings);
    }
  }

  // ── Activity Log ─────────────────────────────────────────────────────────────

  async function logActivity(icon, color, text) {
    SP.logActivity(icon, color, text); // Always log locally first
    if (_offlineMode || !_ready) return;
    try {
      await _col('activity').add({
        icon, color, text,
        orgId: _orgId,
        userId: _user?.uid,
        ts: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      // Silently fail — local log is fine
    }
  }

  // ── Real-time listeners ──────────────────────────────────────────────────────

  /**
   * Listen to deal changes in real-time.
   * Useful for multi-user (two GPs editing simultaneously).
   * Returns unsubscribe function.
   */
  function watchDeals(callback) {
    if (_offlineMode || !_ready || !_db) return () => {};
    return _col('deals').orderBy('added', 'desc').onSnapshot(snap => {
      const deals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      SP.saveDeals(deals);
      callback(deals);
    });
  }

  function watchInvestors(callback) {
    if (_offlineMode || !_ready || !_db) return () => {};
    return _col('investors').onSnapshot(snap => {
      const investors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      SP.saveInvestors(investors);
      callback(investors);
    });
  }

  // ── Investor portal access ────────────────────────────────────────────────────

  /**
   * Get all documents an investor is allowed to see.
   * Called from investor-portal.html after login.
   */
  async function getInvestorDocuments(investorEmail) {
    if (_offlineMode || !_ready) return [];
    try {
      // Find investor record
      const invSnap = await _col('investors')
        .where('email', '==', investorEmail.toLowerCase())
        .limit(1)
        .get();
      if (invSnap.empty) return [];

      const invId = invSnap.docs[0].id;

      // Get all documents accessible to this investor
      const docsSnap = await _col('documents')
        .where('accessLevel', 'in', ['all_investors', invId])
        .get();

      return docsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('SPFB getInvestorDocuments:', e.message);
      return [];
    }
  }

  // ── Migration: localStorage → Firebase ─────────────────────────────────────

  /**
   * One-time migration of all localStorage data to Firestore.
   * Safe to call multiple times — uses merge so nothing is overwritten.
   */
  async function migrateFromLocalStorage() {
    if (_offlineMode || !_ready) return { success: false, reason: 'offline' };
    try {
      const deals = SP.getDeals();
      const investors = SP.getInvestors();
      const dists = SP.getDistributions();
      const calls = SP.load('capitalCalls', []);
      const settings = SP.load('settings', {});

      let written = 0;

      // Deals
      if (deals.length) {
        await saveDeals(deals);
        written += deals.length;
      }

      // Investors
      if (investors.length) {
        await saveInvestors(investors);
        written += investors.length;
      }

      // Distributions
      for (const d of dists) {
        await _col('distributions').doc(d.id || ('d' + Date.now() + Math.random())).set({
          ...d, orgId: _orgId
        }, { merge: true });
        written++;
      }

      // Capital calls
      for (const c of calls) {
        await _col('capitalCalls').doc(c.id || ('cc' + Date.now())).set({
          ...c, orgId: _orgId
        }, { merge: true });
        written++;
      }

      // Settings
      if (Object.keys(settings).length) {
        await saveSettings(settings);
        written++;
      }

      console.log(`SPFB migration: ${written} records written to Firestore`);
      return { success: true, written };
    } catch (e) {
      console.error('SPFB migration error:', e);
      return { success: false, error: e.message };
    }
  }

  // ── Patch SP.* to transparently write to Firestore ───────────────────────────
  // Called once after SP and SPFB are both loaded and user is authenticated.
  function patchSPCore() {
    if (!window.SP) return;

    // Patch SP.saveDeals
    const _origSaveDeals = SP.saveDeals.bind(SP);
    SP.saveDeals = function(deals) {
      _origSaveDeals(deals); // always save locally first
      if (SPFB.isReady() && !SPFB.isOffline()) {
        SPFB.saveDeals(deals).catch(e => console.warn('SPFB.saveDeals bg:', e.message));
      }
    };

    // Patch SP.saveInvestors
    const _origSaveInvestors = SP.saveInvestors.bind(SP);
    SP.saveInvestors = function(investors) {
      _origSaveInvestors(investors);
      if (SPFB.isReady() && !SPFB.isOffline()) {
        SPFB.saveInvestors(investors).catch(e => console.warn('SPFB.saveInvestors bg:', e.message));
      }
    };

    // Patch SP.saveDistributions
    const _origSaveDist = SP.saveDistributions.bind(SP);
    SP.saveDistributions = function(dists) {
      _origSaveDist(dists);
      if (SPFB.isReady() && !SPFB.isOffline()) {
        // Write each new/changed distribution
        dists.forEach(d => {
          SPFB.saveDistribution(d).catch(e => console.warn('SPFB.saveDistribution bg:', e.message));
        });
      }
    };

    // Patch SP.logActivity to also write to Firestore
    const _origLog = SP.logActivity.bind(SP);
    SP.logActivity = function(icon, color, text) {
      _origLog(icon, color, text);
      if (SPFB.isReady() && !SPFB.isOffline()) {
        SPFB.logActivity(icon, color, text).catch(() => {});
      }
    };

    // Patch SP.save for capitalCalls key
    const _origSave = SP.save.bind(SP);
    SP.save = function(key, value) {
      _origSave(key, value);
      if (key === 'capitalCalls' && SPFB.isReady() && !SPFB.isOffline()) {
        const calls = Array.isArray(value) ? value : [value];
        calls.forEach(c => {
          if (c && c.id) SPFB.saveCapitalCall(c).catch(() => {});
        });
      }
      if (key === 'settings' && SPFB.isReady() && !SPFB.isOffline()) {
        SPFB.saveSettings(value).catch(() => {});
      }
    };

    console.log('SPFB: SP.* patched — all saves now write to Firestore');
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  return {
    init,
    onReady,
    isReady,
    isOffline,
    getOrgId,
    getUser,

    // Auth
    signIn,
    signUp,
    signOut,

    // Deals
    getDeals,
    saveDeal,
    saveDeals,
    deleteDeal,

    // Investors
    getInvestors,
    saveInvestors,
    deleteInvestor,

    // Documents
    saveGeneratedDoc,
    uploadFile,
    getDealDocuments,
    deleteDocument,
    updateDocumentAccess,

    // Distributions
    getDistributions,
    saveDistribution,

    // Capital calls
    getCapitalCalls,
    saveCapitalCall,

    // Settings
    getSettings,
    saveSettings,

    // Activity
    logActivity,

    // Real-time
    watchDeals,
    watchInvestors,

    // Investor portal
    getInvestorDocuments,

    // Migration
    migrateFromLocalStorage,

    // Patch SP core methods to write to Firestore
    patchSPCore,
  };
})();
