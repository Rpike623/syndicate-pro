/**
 * sp-multi-org.js — Multi-GP Support for LP Portal
 *
 * Allows an LP to see investments across multiple GPs on deeltrack.
 * Each GP has their own org. An LP can be linked to deals in multiple orgs.
 *
 * Data model:
 *   users/{uid}.orgIds = ["deeltrack_demo", "smith_equity_org", ...]
 *   When an LP is added to a deal in a new org, that orgId is appended.
 *
 * This module:
 *   1. Reads user.orgIds (falling back to [user.orgId] for single-GP users)
 *   2. Queries deals/distributions/investors across all orgs
 *   3. Returns aggregated data with orgId/gpName tagged on each record
 *   4. Portal renders grouped by GP
 */

const SPMultiOrg = (() => {
  'use strict';

  let _db = null;
  let _orgIds = [];
  let _orgNames = {}; // orgId → GP firm name
  let _ready = false;

  // Aggregated data across all orgs
  let _allDeals = [];
  let _allDistributions = [];
  let _allInvestorRecords = []; // LP's investor record in each org
  let _allCapitalCalls = [];

  async function init(db, userDoc) {
    _db = db;

    // Build org list: prefer orgIds array, fallback to single orgId
    if (Array.isArray(userDoc.orgIds) && userDoc.orgIds.length) {
      _orgIds = [...new Set(userDoc.orgIds)];
    } else if (userDoc.orgId) {
      _orgIds = [userDoc.orgId];
    } else {
      _orgIds = [];
    }

    if (!_orgIds.length || !_db) {
      _ready = true;
      return;
    }

    const email = (userDoc.email || '').toLowerCase();

    // Query each org in parallel
    const orgPromises = _orgIds.map(async (orgId) => {
      const orgRef = _db.collection('orgs').doc(orgId);

      try {
        // Load org settings for GP name
        const settingsDoc = await orgRef.collection('settings').doc('main').get();
        const gpName = settingsDoc.exists
          ? (settingsDoc.data().firmName || settingsDoc.data().gpFullName || orgId)
          : orgId;
        _orgNames[orgId] = gpName;

        // Load investor record for this LP in this org
        const invSnap = await orgRef.collection('investors').where('email', '==', email).limit(1).get();
        let investorId = null;
        if (!invSnap.empty) {
          const invDoc = invSnap.docs[0];
          const invData = { id: invDoc.id, ...invDoc.data(), _orgId: orgId, _gpName: gpName };
          _allInvestorRecords.push(invData);
          investorId = invDoc.id;
        }

        if (!investorId) return; // LP not in this org's investor list

        // Load deals (filter to ones LP is linked to)
        const dealsSnap = await orgRef.collection('deals').get();
        dealsSnap.docs.forEach(d => {
          const deal = { id: d.id, ...d.data(), _orgId: orgId, _gpName: gpName };
          if (Array.isArray(deal.investors) && deal.investors.some(i => i.investorId === investorId)) {
            _allDeals.push(deal);
          }
        });

        // Load distributions
        const distSnap = await orgRef.collection('distributions').get();
        distSnap.docs.forEach(d => {
          const dist = { id: d.id, ...d.data(), _orgId: orgId, _gpName: gpName };
          _allDistributions.push(dist);
        });

        // Load capital calls
        const callSnap = await orgRef.collection('capitalCalls').get();
        callSnap.docs.forEach(d => {
          const call = { id: d.id, ...d.data(), _orgId: orgId, _gpName: gpName };
          _allCapitalCalls.push(call);
        });

      } catch(e) {
        console.warn(`SPMultiOrg: Failed to load org ${orgId}:`, e.message);
      }
    });

    await Promise.all(orgPromises);
    _ready = true;

    console.log(`SPMultiOrg ready — ${_orgIds.length} org(s), ${_allDeals.length} deals, ${_allDistributions.length} distributions`);
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  function isReady() { return _ready; }
  function getOrgIds() { return [..._orgIds]; }
  function getOrgName(orgId) { return _orgNames[orgId] || orgId; }
  function getOrgNames() { return { ..._orgNames }; }
  function isMultiOrg() { return _orgIds.length > 1; }

  function getAllDeals() { return _allDeals; }
  function getAllDistributions() { return _allDistributions; }
  function getAllInvestorRecords() { return _allInvestorRecords; }
  function getAllCapitalCalls() { return _allCapitalCalls; }

  // Get deals grouped by GP
  function getDealsByOrg() {
    const grouped = {};
    _allDeals.forEach(d => {
      const key = d._orgId;
      if (!grouped[key]) grouped[key] = { orgId: key, gpName: d._gpName, deals: [] };
      grouped[key].deals.push(d);
    });
    return Object.values(grouped);
  }

  // Get LP's linked deal entries with investor match across all orgs
  function getLinkedEntries(email) {
    const emailLc = (email || '').toLowerCase();
    const entries = [];
    _allDeals.forEach(deal => {
      if (!Array.isArray(deal.investors)) return;
      // Find investor record in this org
      const invRec = _allInvestorRecords.find(r => r._orgId === deal._orgId);
      if (!invRec) return;
      const entry = deal.investors.find(i => i.investorId === invRec.id);
      if (entry) {
        entries.push({ deal, entry, gpName: deal._gpName, orgId: deal._orgId });
      }
    });
    return entries;
  }

  // Get distributions for this LP across all orgs
  function getMyDistributions(email) {
    const emailLc = (email || '').toLowerCase();
    const results = [];
    _allDistributions.forEach(dist => {
      if (!Array.isArray(dist.recipients)) return;
      const invRec = _allInvestorRecords.find(r => r._orgId === dist._orgId);
      if (!invRec) return;
      const r = dist.recipients.find(r => r.investorId === invRec.id);
      if (r) results.push({ dist, recipient: r, gpName: dist._gpName, orgId: dist._orgId });
    });
    return results;
  }

  // ── Add org to user (called when GP adds LP to a deal in their org) ─────
  async function addOrgToUser(db, uid, orgId) {
    try {
      const userRef = db.collection('users').doc(uid);
      const doc = await userRef.get();
      if (!doc.exists) return;

      const data = doc.data();
      const existing = Array.isArray(data.orgIds) ? data.orgIds : (data.orgId ? [data.orgId] : []);

      if (!existing.includes(orgId)) {
        existing.push(orgId);
        await userRef.update({ orgIds: existing });
        console.log(`SPMultiOrg: Added org ${orgId} to user ${uid}`);
      }
    } catch(e) {
      console.warn('SPMultiOrg: Failed to add org to user:', e.message);
    }
  }

  return {
    init, isReady, isMultiOrg,
    getOrgIds, getOrgName, getOrgNames,
    getAllDeals, getAllDistributions, getAllInvestorRecords, getAllCapitalCalls,
    getDealsByOrg, getLinkedEntries, getMyDistributions,
    addOrgToUser,
  };
})();
