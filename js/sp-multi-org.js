/**
 * sp-multi-org.js — Multi-GP support for LP investors
 *
 * LPs can invest with multiple GPs. Each GP has their own orgId.
 * This module loads deals/distributions/docs from ALL orgs an LP belongs to
 * and returns them grouped by GP for the LP portal.
 *
 * User doc model:
 *   user.orgId   = primary org (for GPs: their firm; for LPs: first GP they joined)
 *   user.orgIds  = [orgId1, orgId2, ...] all orgs (LP only, populated by invite flow)
 *
 * Usage (LP portal only):
 *   const multiOrg = await SPMultiOrg.load(db, user);
 *   multiOrg.deals      → [{ ...deal, _orgId, _gpName }]
 *   multiOrg.dists       → [{ ...dist, _orgId, _gpName }]
 *   multiOrg.k1s         → [{ ...k1, _orgId, _gpName }]
 *   multiOrg.orgs        → [{ orgId, gpName, dealCount }]
 */

const SPMultiOrg = (() => {
  'use strict';

  let _loaded = false;
  let _data = { deals: [], dists: [], k1s: [], calls: [], orgs: [], investors: [] };

  /**
   * Load all data across all orgs for the current LP.
   * @param {Firestore} db
   * @param {Object} user — user doc with .email, .orgId, .orgIds
   * @returns {Object} aggregated data
   */
  async function load(db, user) {
    if (!db || !user || !user.email) return _data;

    // Determine all org IDs this LP belongs to
    const orgIds = _getOrgIds(user);
    if (!orgIds.length) return _data;

    const email = user.email.toLowerCase();
    const allDeals = [];
    const allDists = [];
    const allK1s = [];
    const allCalls = [];
    const allInvestors = [];
    const orgInfo = [];

    // Load data from each org in parallel
    await Promise.all(orgIds.map(async (orgId) => {
      const orgRef = db.collection('orgs').doc(orgId);

      try {
        // Get org settings for GP name
        let gpName = orgId;
        try {
          const settingsDoc = await orgRef.collection('settings').doc('main').get();
          if (settingsDoc.exists) {
            const s = settingsDoc.data();
            gpName = s.firmName || s.gpFullName || orgId;
          }
        } catch(e) {}

        // Find this LP's investor record in this org
        let investorId = null;
        try {
          const invSnap = await orgRef.collection('investors').where('email', '==', email).limit(1).get();
          if (!invSnap.empty) {
            const invDoc = invSnap.docs[0];
            investorId = invDoc.id;
            allInvestors.push({ ...invDoc.data(), id: invDoc.id, _orgId: orgId, _gpName: gpName });
          }
        } catch(e) {}

        if (!investorId) return; // LP not linked to any deals in this org

        // Load deals where this LP is an investor
        try {
          const dealsSnap = await orgRef.collection('deals').get();
          const orgDeals = dealsSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(d => (d.investors || []).some(i => i.investorId === investorId));

          orgDeals.forEach(d => {
            allDeals.push({ ...d, _orgId: orgId, _gpName: gpName });
          });
        } catch(e) { console.warn(`SPMultiOrg: deals from ${orgId} failed:`, e.message); }

        // Load distributions
        try {
          const distSnap = await orgRef.collection('distributions').get();
          distSnap.docs.forEach(d => {
            const dist = { id: d.id, ...d.data() };
            // Check if this LP is a recipient
            if (Array.isArray(dist.recipients) && dist.recipients.some(r => r.investorId === investorId)) {
              allDists.push({ ...dist, _orgId: orgId, _gpName: gpName });
            }
          });
        } catch(e) {}

        // Load K-1s from custom data
        try {
          const k1Doc = await orgRef.collection('custom_data').doc('k1_vault').get();
          if (k1Doc.exists && Array.isArray(k1Doc.data().value)) {
            k1Doc.data().value.forEach(k1 => {
              if (k1.investorId === investorId) {
                allK1s.push({ ...k1, _orgId: orgId, _gpName: gpName });
              }
            });
          }
        } catch(e) {}

        // Load capital calls
        try {
          const callSnap = await orgRef.collection('capitalCalls').get();
          callSnap.docs.forEach(d => {
            const call = { id: d.id, ...d.data() };
            // Check if call is for a deal the LP is in
            if (orgDeals && orgDeals.some(deal => deal.id === call.dealId)) {
              allCalls.push({ ...call, _orgId: orgId, _gpName: gpName });
            }
          });
        } catch(e) {}

        orgInfo.push({
          orgId,
          gpName,
          dealCount: allDeals.filter(d => d._orgId === orgId).length,
        });

      } catch(e) {
        console.warn(`SPMultiOrg: failed to load org ${orgId}:`, e.message);
      }
    }));

    _data = { deals: allDeals, dists: allDists, k1s: allK1s, calls: allCalls, orgs: orgInfo, investors: allInvestors };
    _loaded = true;
    return _data;
  }

  /**
   * Get all org IDs for a user. Handles both old (single orgId) and new (orgIds array) format.
   */
  function _getOrgIds(user) {
    const ids = new Set();
    if (user.orgId) ids.add(user.orgId);
    if (Array.isArray(user.orgIds)) user.orgIds.forEach(id => ids.add(id));
    return Array.from(ids);
  }

  /**
   * Add an org to a user's orgIds array (called during invite acceptance).
   */
  async function addOrgToUser(db, uid, orgId) {
    if (!db || !uid || !orgId) return;
    try {
      const userRef = db.collection('users').doc(uid);
      const doc = await userRef.get();
      if (!doc.exists) return;

      const data = doc.data();
      const current = Array.isArray(data.orgIds) ? data.orgIds : [];
      if (data.orgId && !current.includes(data.orgId)) current.push(data.orgId);
      if (!current.includes(orgId)) {
        current.push(orgId);
        await userRef.update({ orgIds: current });
      }
    } catch(e) {
      console.warn('SPMultiOrg: addOrgToUser failed:', e.message);
    }
  }

  function isLoaded() { return _loaded; }
  function getData() { return _data; }

  return { load, addOrgToUser, isLoaded, getData };
})();
